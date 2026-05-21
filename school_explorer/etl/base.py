"""
Base class for all ETL ingestors.

Each ingestor subclass implements:
  - SOURCE_NAME: str          — unique key, used in DataRefresh
  - TARGET_TABLE: str         — DB table name
  - ACADEMIC_YEAR: str        — e.g. "2024/25", or "rolling" for GIAS/Ofsted
  - download() -> Path        — fetch file to disk (or return cached path)
  - transform(path) -> list   — parse file, return list of dicts ready for DB
  - load(rows) -> tuple       — upsert rows, return (inserted, skipped)

The run() method orchestrates all three steps and writes a DataRefresh record.
"""

import logging
import shutil
import traceback
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from zipfile import ZipFile

import pandas as pd
import requests
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from school_explorer.config import settings
from school_explorer.database import get_session
from school_explorer.models.refresh import DataRefresh

logger = logging.getLogger(__name__)
console = Console()


class BaseIngestor(ABC):
    SOURCE_NAME: str = ""
    TARGET_TABLE: str = ""
    ACADEMIC_YEAR: str = "rolling"  # override in performance/destinations ingestors

    # London LA codes — inner (201-213) + outer (301-320) boroughs
    LONDON_LA_CODES: frozenset[int] = frozenset({
        201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213,  # inner
        301, 302, 303, 304, 305, 306, 307, 308, 309, 310,                  # outer
        311, 312, 313, 314, 315, 316, 317, 318, 319, 320,                  # outer cont.
    })

    def __init__(self) -> None:
        if not self.SOURCE_NAME:
            raise ValueError(f"{self.__class__.__name__} must define SOURCE_NAME")
        self._refresh_id: Optional[int] = None

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def run(self, force_download: bool = False) -> tuple[int, int]:
        """
        Orchestrate download → transform → load.
        Returns (rows_loaded, rows_skipped).
        """
        self._start_refresh_record()
        try:
            with console.status(f"[bold]{self.SOURCE_NAME}[/bold] downloading…"):
                path = self.download(force=force_download or settings.force_download)

            console.print(f"  ↓ Downloaded to [dim]{path}[/dim]")

            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                transient=True,
            ) as progress:
                progress.add_task(f"{self.SOURCE_NAME}: transforming…", total=None)
                rows = self.transform(path)

            console.print(f"  ✓ Transformed {len(rows):,} rows")

            loaded, skipped = self.load(rows)
            self._complete_refresh_record(rows_loaded=loaded, rows_skipped=skipped, source_file=str(path))
            console.print(
                f"  ✓ [green]Loaded {loaded:,}[/green] rows "
                f"([dim]{skipped:,} unchanged[/dim]) → {self.TARGET_TABLE}"
            )
            return loaded, skipped

        except Exception as exc:
            tb = traceback.format_exc()
            self._fail_refresh_record(error=tb)
            console.print(f"  ✗ [red]{self.SOURCE_NAME} failed:[/red] {exc}")
            raise

    @abstractmethod
    def download(self, force: bool = False) -> Path:
        """Fetch the source file and cache it under settings.data_raw_dir."""
        ...

    @abstractmethod
    def transform(self, path: Path) -> list[dict[str, Any]]:
        """Parse the raw file and return a list of dicts matching the DB model."""
        ...

    @abstractmethod
    def load(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        """Upsert rows into the database. Return (inserted_or_updated, unchanged)."""
        ...

    # ------------------------------------------------------------------
    # Helpers available to subclasses
    # ------------------------------------------------------------------

    def _download_file(self, url: str, filename: str, force: bool = False) -> Path:
        """
        Download a file to data/raw/<filename> unless it already exists.
        Returns the local path.
        """
        dest = settings.raw_path(filename)
        if dest.exists() and not force:
            logger.debug("Using cached %s", dest)
            return dest

        logger.info("Downloading %s → %s", url, dest)
        response = requests.get(url, stream=True, timeout=120)
        response.raise_for_status()

        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            for chunk in response.iter_content(chunk_size=65_536):
                f.write(chunk)

        return dest

    def _extract_zip(self, zip_path: Path, pattern: str) -> Path:
        """
        Extract the first file matching *pattern* (substring) from a ZIP archive.
        Always returns a path directly inside zip_path.parent (flattens subdirs).
        """
        with ZipFile(zip_path) as zf:
            members = zf.namelist()
            match = next((m for m in members if pattern in m.lower()), None)
            if match is None:
                raise FileNotFoundError(
                    f"Could not find a file matching {pattern!r} in {zip_path}.\n"
                    f"Available files: {members}"
                )
            filename = match.split("/")[-1]
            dest = zip_path.parent / filename
            if not dest.exists():
                zf.extract(match, path=zip_path.parent)
                # ZipFile may create subdirectories; move the file to a flat path
                extracted = zip_path.parent / match
                if extracted.exists() and extracted != dest:
                    shutil.move(str(extracted), str(dest))
                elif not dest.exists():
                    # Fallback: search recursively
                    candidates = list(zip_path.parent.rglob(filename))
                    if candidates and candidates[0] != dest:
                        shutil.move(str(candidates[0]), str(dest))

        return dest

    def _get_london_urns(self) -> frozenset[int]:
        """Return the set of URNs for all currently loaded London schools."""
        with get_session() as session:
            result = session.execute(text("SELECT urn FROM schools"))
            return frozenset(row[0] for row in result)

    @staticmethod
    def _parse_float(value: Any) -> Optional[float]:
        """Parse a value that might be a DfE suppression marker, NaN, or a number.
        Handles both legacy (SUPP, NE) and EES tidy format (z=N/A, c=suppressed)."""
        if pd.isna(value):
            return None
        s = str(value).strip()
        # z = not applicable/available; c = count suppressed; others are legacy markers
        if s in {"SUPP", "NE", "NP", "NA", "N/A", "DNS", "", ".", "x", "z", "c", "u"}:
            return None
        try:
            return float(s)
        except ValueError:
            return None

    @staticmethod
    def _parse_int(value: Any) -> Optional[int]:
        f = BaseIngestor._parse_float(value)
        return int(f) if f is not None else None

    @staticmethod
    def _is_suppressed(value: Any) -> bool:
        """Return True if the value indicates DfE suppression (not just N/A).
        'c' = count suppressed; 'SUPP'/'SP'/'NP'/'NE' are legacy markers.
        'z' = not applicable — this is NOT suppression."""
        if pd.isna(value):
            return False
        return str(value).strip() in {"SUPP", "SP", "NP", "NE", "c"}

    def _upsert(
        self,
        model_class: Any,
        rows: list[dict[str, Any]],
        conflict_columns: list[str],
    ) -> tuple[int, int]:
        """
        PostgreSQL upsert (INSERT ... ON CONFLICT DO UPDATE).
        Returns (rows_upserted, rows_unchanged).
        Safe to run multiple times — re-running overwrites with the same data.
        """
        if not rows:
            return 0, 0

        loaded = 0
        with get_session() as session:
            # Process in batches of 500 to avoid oversized statements
            for batch_start in range(0, len(rows), 500):
                batch = rows[batch_start : batch_start + 500]
                stmt = pg_insert(model_class).values(batch)
                update_cols = {
                    col: stmt.excluded[col]
                    for col in batch[0]
                    if col not in conflict_columns
                }
                stmt = stmt.on_conflict_do_update(
                    index_elements=conflict_columns,
                    set_=update_cols,
                )
                session.execute(stmt)
                loaded += len(batch)

        return loaded, 0  # TODO: track genuinely unchanged rows if needed

    # ------------------------------------------------------------------
    # DataRefresh bookkeeping
    # ------------------------------------------------------------------

    def _start_refresh_record(self) -> None:
        with get_session() as session:
            record = DataRefresh(
                source_name=self.SOURCE_NAME,
                target_table=self.TARGET_TABLE,
                academic_year=self.ACADEMIC_YEAR,
                status="running",
                run_at=datetime.now(timezone.utc),
            )
            session.add(record)
            session.flush()
            self._refresh_id = record.id

    def _complete_refresh_record(
        self, rows_loaded: int, rows_skipped: int, source_file: str
    ) -> None:
        if self._refresh_id is None:
            return
        with get_session() as session:
            record = session.get(DataRefresh, self._refresh_id)
            if record:
                record.status = "success"
                record.rows_loaded = rows_loaded
                record.rows_skipped = rows_skipped
                record.source_file = source_file
                record.completed_at = datetime.now(timezone.utc)

    def _fail_refresh_record(self, error: str) -> None:
        if self._refresh_id is None:
            return
        with get_session() as session:
            record = session.get(DataRefresh, self._refresh_id)
            if record:
                record.status = "failed"
                record.error = error
                record.completed_at = datetime.now(timezone.utc)
