"""
KS5 (A-level / 16-18) performance data ingestor.
Populates the `performance_ks5` table.

Source: DfE A level and other 16 to 18 results
  https://explore-education-statistics.service.gov.uk/find-statistics/a-level-and-other-16-to-18-results

DfE COLUMN NAMES (institution-level file, verify against actual CSV):
  URN         — school URN
  TALLPPE     — total A-level cohort (pupils with at least 1 A-level)
  TALLPPE_APS — average points per A-level entry
  APS_PER_ENTRY — average points per entry (all qual types)
  P970        — % A*-E (pass rate for A-level entries)
  P940        — % A*-B
  P920        — % A*-A (top grades)
  TALLAPP     — applied general cohort
  TALLTL      — tech level cohort

  Total provider cohort (all 16-18 qualifications): TOTALPROV or similar.
"""

import logging
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from bs4 import BeautifulSoup

from school_explorer.config import settings
from school_explorer.etl.base import BaseIngestor
from school_explorer.models.performance import PerformanceKS5

logger = logging.getLogger(__name__)

ACADEMIC_YEAR = "2024/25"

EES_KS5_PUBLICATION_URL = (
    "https://explore-education-statistics.service.gov.uk"
    "/find-statistics/a-level-and-other-16-to-18-results"
)
# Fallback — update release ID when EES publishes a new version.
EES_KS5_ZIP_URL = (
    "https://content.explore-education-statistics.service.gov.uk"
    "/api/releases/f7e58259-9a8f-4eaa-be12-86a9c297004b/files"
)

INSTITUTION_FILE_PATTERN = "institution_performance"

COLUMN_MAP = {
    # Current EES snake_case format (2024/25 release — institution_performance file)
    "school_urn": "urn",
    "end1618_student_count": "total_cohort",
    "aps_per_entry": "avg_points_per_alevel_entry",
    "aab_percent": "pct_astar_to_b",  # % achieving AAB+ in best 3 A-levels (close to A*-B%)
    # Legacy column names (pre-2024/25 releases)
    "URN": "urn",
    "TALLPPE": "alevel_cohort",
    "TALLPPE_APS": "avg_points_per_alevel_entry",
    "APS_PER_ENTRY": "avg_points_per_entry",
    "P970": "pct_astar_to_e",
    "P940": "pct_astar_to_b",
    "P920": "pct_astar_or_a",
    "TALLAPP": "applied_general_cohort",
    "TALLTL": "tech_level_cohort",
    "TOTALPROV": "total_cohort",
}


class KS5Ingestor(BaseIngestor):
    SOURCE_NAME = "ks5_performance"
    TARGET_TABLE = "performance_ks5"
    ACADEMIC_YEAR = ACADEMIC_YEAR

    def download(self, force: bool = False) -> Path:
        zip_filename = f"ks5_performance_{ACADEMIC_YEAR.replace('/', '_')}.zip"
        zip_path = settings.raw_path(zip_filename)
        if zip_path.exists() and not force:
            return self._extract_institution_csv(zip_path)
        url = self._find_download_url()
        zip_path = self._download_file(url, zip_filename, force=force)
        return self._extract_institution_csv(zip_path)

    def _find_download_url(self) -> str:
        """Scrape the EES publication page for the current 'Download all data' URL."""
        try:
            resp = requests.get(EES_KS5_PUBLICATION_URL, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "/releases/" in href and "/files" in href:
                    return href.split("?")[0]
        except Exception as exc:
            logger.warning("Could not scrape KS5 EES page: %s", exc)
        logger.info("Falling back to hardcoded KS5 download URL")
        return EES_KS5_ZIP_URL

    def _extract_institution_csv(self, zip_path: Path) -> Path:
        import shutil
        from zipfile import ZipFile
        with ZipFile(zip_path) as zf:
            members = zf.namelist()
            match = next(
                (m for m in members if INSTITUTION_FILE_PATTERN in m.lower() and m.endswith(".csv")),
                None,
            )
            if match is None:
                raise FileNotFoundError(
                    f"Could not find institution-level CSV in KS5 ZIP.\n"
                    f"Available: {members}"
                )
            dest = zip_path.parent / match.split("/")[-1]
            if not dest.exists():
                zf.extract(match, path=zip_path.parent)
                extracted = zip_path.parent / match
                if extracted != dest and extracted.exists():
                    shutil.move(str(extracted), str(dest))
            return dest

    def transform(self, path: Path) -> list[dict[str, Any]]:
        df = pd.read_csv(path, dtype=str, low_memory=False)
        logger.info("Raw KS5 rows: %d", len(df))

        # EES tidy format: filter to latest year, Academic cohort, Total disadvantage
        if "time_period" in df.columns:
            latest_year = df["time_period"].dropna().max()
            df = df[df["time_period"] == latest_year]
        if "exam_cohort" in df.columns:
            df = df[df["exam_cohort"] == "Academic"]
        if "disadvantage_status" in df.columns:
            df = df[df["disadvantage_status"] == "Total"]
        logger.info("After filters: %d rows", len(df))

        df = df.rename(columns=COLUMN_MAP)
        df["urn"] = pd.to_numeric(df.get("urn", pd.Series()), errors="coerce")
        df = df[df["urn"].isin(self._get_london_urns())]
        logger.info("London KS5 rows: %d", len(df))

        rows = []
        for _, row in df.iterrows():
            g = row.get
            suppressed = self._is_suppressed(g("avg_points_per_alevel_entry"))
            rows.append({
                "urn": self._parse_int(g("urn")),
                "academic_year": ACADEMIC_YEAR,
                "total_cohort": self._parse_int(g("total_cohort")),
                "alevel_cohort": self._parse_int(g("alevel_cohort")),
                "avg_points_per_entry": self._parse_float(g("avg_points_per_entry")),
                "avg_points_per_alevel_entry": self._parse_float(g("avg_points_per_alevel_entry")),
                "pct_astar_to_e": self._parse_float(g("pct_astar_to_e")),
                "pct_astar_to_b": self._parse_float(g("pct_astar_to_b")),
                "pct_astar_or_a": self._parse_float(g("pct_astar_or_a")),
                "applied_general_cohort": self._parse_int(g("applied_general_cohort")),
                "tech_level_cohort": self._parse_int(g("tech_level_cohort")),
                "suppressed": suppressed,
            })
        return [r for r in rows if r["urn"] is not None]

    def load(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        return self._upsert(PerformanceKS5, rows, conflict_columns=["urn", "academic_year"])
