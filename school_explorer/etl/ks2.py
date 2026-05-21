"""
KS2 (primary school) attainment data ingestor.
Populates the `performance_ks2` table.

Source: DfE Key Stage 2 attainment (via EES)
  https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-2-attainment

The EES ZIP contains several CSVs. We use `ks2_school_attainment_data.csv`,
which is school-level and pivoted by subject. Each row is one school × subject
× breakdown combination. We filter to Total breakdowns and pivot subjects into
wide format.

  school_urn                         — school URN
  subject                            — one of:
      "Reading, writing and maths"   → RWM combined
      "Reading"
      "Writing"
      "Maths"
  breakdown                          — filter to "Total"
  expected_standard_pupil_percent    — % at expected standard
  higher_standard_pupil_percent      — % at greater depth / higher standard
  average_scaled_score               — average scaled score (reading and maths only)
  progress_measure_score             — progress score (reading, writing, maths only)

  Suppression: 'z' (not applicable), 'c' (suppressed), empty — handled by _parse_float.
"""

import logging
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from bs4 import BeautifulSoup

from school_explorer.config import settings
from school_explorer.etl.base import BaseIngestor
from school_explorer.models.performance import PerformanceKS2

logger = logging.getLogger(__name__)

ACADEMIC_YEAR = "2024/25"
TIME_PERIOD = "202425"  # DfE format for 2024/25 academic year

EES_KS2_PUBLICATION_URL = (
    "https://explore-education-statistics.service.gov.uk"
    "/find-statistics/key-stage-2-attainment"
)
# Fallback — update the release ID when EES publishes a new version.
EES_KS2_ZIP_URL = (
    "https://content.explore-education-statistics.service.gov.uk"
    "/api/releases/d5bce7e2-6ca0-44a7-a6b5-a8a05babafc2/files"
)

INSTITUTION_FILE_PATTERN = "ks2_school_attainment_data"


class KS2Ingestor(BaseIngestor):
    SOURCE_NAME = "ks2_performance"
    TARGET_TABLE = "performance_ks2"
    ACADEMIC_YEAR = ACADEMIC_YEAR

    def download(self, force: bool = False) -> Path:
        zip_filename = f"ks2_performance_{ACADEMIC_YEAR.replace('/', '_')}.zip"
        cached_zip = settings.raw_path(zip_filename)
        if cached_zip.exists() and not force:
            return self._extract_zip(cached_zip, INSTITUTION_FILE_PATTERN)
        url = self._find_download_url()
        zip_path = self._download_file(url, zip_filename, force=force)
        return self._extract_zip(zip_path, INSTITUTION_FILE_PATTERN)

    def _find_download_url(self) -> str:
        try:
            resp = requests.get(EES_KS2_PUBLICATION_URL, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "/releases/" in href and "/files" in href:
                    return href.split("?")[0]
        except Exception as exc:
            logger.warning("Could not scrape KS2 EES page: %s", exc)
        logger.info("Falling back to hardcoded KS2 download URL")
        return EES_KS2_ZIP_URL

    def transform(self, path: Path) -> list[dict[str, Any]]:
        df = pd.read_csv(path, dtype=str, low_memory=False)
        logger.info("Raw KS2 rows: %d", len(df))

        # Strip quotes that EES sometimes adds around values
        df.columns = [c.strip('"') for c in df.columns]
        for col in df.columns:
            if df[col].dtype == object:
                df[col] = df[col].str.strip('"')

        # Filter to school level, Total breakdown, latest year
        if "geographic_level" in df.columns:
            df = df[df["geographic_level"] == "School"]
        if "breakdown" in df.columns:
            df = df[df["breakdown"] == "Total"]
        if "time_period" in df.columns:
            available = df["time_period"].dropna().unique()
            target = TIME_PERIOD if TIME_PERIOD in available else df["time_period"].dropna().max()
            df = df[df["time_period"] == target]
            logger.info("Using time_period=%s; rows after filter: %d", target, len(df))

        df["school_urn"] = pd.to_numeric(df.get("school_urn", pd.Series()), errors="coerce")
        london_urns = self._get_london_urns()
        df = df[df["school_urn"].isin(london_urns)]
        logger.info("London KS2 rows: %d", len(df))

        # Pivot: group by URN and extract metrics per subject
        rows = []
        for urn, grp in df.groupby("school_urn"):
            urn = int(urn)

            def _subject(name: str) -> pd.Series | None:
                sub = grp[grp["subject"] == name]
                return sub.iloc[0] if len(sub) > 0 else None

            rwm = _subject("Reading, writing and maths")
            reading = _subject("Reading")
            writing = _subject("Writing")
            maths = _subject("Maths")

            def _pf(row: pd.Series | None, col: str):
                return self._parse_float(row.get(col)) if row is not None else None

            pct_expected_rwm = _pf(rwm, "expected_standard_pupil_percent")
            pct_greater_depth_rwm = _pf(rwm, "higher_standard_pupil_percent")

            suppressed = (
                self._is_suppressed(rwm.get("expected_standard_pupil_percent")) if rwm is not None
                else False
            )

            # Cohort size: not directly in this file; approximated from reading row
            # (DfE does not publish a single cohort count in the attainment file)
            cohort_size = None

            rows.append({
                "urn": urn,
                "academic_year": ACADEMIC_YEAR,
                "cohort_size": cohort_size,
                "pct_expected_rwm": pct_expected_rwm,
                "pct_greater_depth_rwm": pct_greater_depth_rwm,
                "progress_reading": _pf(reading, "progress_measure_score"),
                "progress_writing": _pf(writing, "progress_measure_score"),
                "progress_maths": _pf(maths, "progress_measure_score"),
                "avg_scaled_score_reading": _pf(reading, "average_scaled_score"),
                "avg_scaled_score_maths": _pf(maths, "average_scaled_score"),
                "suppressed": suppressed,
            })

        return rows

    def load(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        return self._upsert(PerformanceKS2, rows, conflict_columns=["urn", "academic_year"])
