"""
KS4 (GCSE) performance data ingestor.
Populates the `performance_ks4` table.

Source: DfE KS4 performance tables — institution level
  https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance

The EES ZIP contains several CSVs. We want the institution-level file which has
one row per school. Filename pattern: *ks4*school*final*.csv or similar.

DfE COLUMN NAMES (as of 2024/25 release — verify against actual CSV header):
  URN         — school URN
  SCHNAME     — school name
  LEA         — LA code
  TPUP        — KS4 cohort total (pupils at end of KS4)
  ATT8SCR     — Attainment 8 score
  P8MEA       — Progress 8 measure
  P8LOWCOV    — P8 lower confidence interval
  P8UPCOV     — P8 upper confidence interval
  PTL2BASICS_94 — % achieving grade 4+ in English AND Maths
  PTL2BASICS_95 — % achieving grade 5+ in English AND Maths
  EBACCAPS    — EBacc average points score
  PTEBACC_E_PTQ_EE — % entering the EBacc
  PTEBACC_94_EE    — % achieving EBacc at grade 4+

  Suppression: cells contain 'SUPP' or 'NE' (not enough pupils).
"""

import logging
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from bs4 import BeautifulSoup

from school_explorer.config import settings
from school_explorer.etl.base import BaseIngestor
from school_explorer.models.performance import PerformanceKS4

logger = logging.getLogger(__name__)

ACADEMIC_YEAR = "2024/25"  # UPDATE THIS when loading a different year's data

EES_KS4_PUBLICATION_URL = (
    "https://explore-education-statistics.service.gov.uk"
    "/find-statistics/key-stage-4-performance"
)
# Fallback URL — update the release ID if EES publishes a new version.
# Find it by visiting EES_KS4_PUBLICATION_URL and copying the "Download all data" link.
EES_KS4_ZIP_URL = (
    "https://content.explore-education-statistics.service.gov.uk"
    "/api/releases/dfa0dcab-7554-4423-b7bf-8288a7b1b3fe/files"
)

# Filename pattern inside the ZIP for the institution-level file
# The exact name varies between releases — inspect the ZIP if this doesn't match
INSTITUTION_FILE_PATTERN = "performance_tables_schools"  # matches institution-level file

COLUMN_MAP = {
    # Current EES snake_case format (2024/25 release)
    "school_urn": "urn",
    "pupil_count": "cohort_size",
    "attainment8_average": "attainment_8",
    "progress8_average": "progress_8",
    "progress8_lower_95_ci": "progress_8_lower_ci",
    "progress8_upper_95_ci": "progress_8_upper_ci",
    "engmath_94_percent": "pct_grade4_english_maths",
    "engmath_95_percent": "pct_grade5_english_maths",
    "ebacc_aps_average": "ebacc_avg_points",
    "ebacc_entering_percent": "pct_entering_ebacc",
    "ebacc_95_percent": "pct_achieving_ebacc_strong",
    # Legacy column names (pre-2024/25 releases) — kept for backwards compatibility
    "URN": "urn",
    "TPUP": "cohort_size",
    "ATT8SCR": "attainment_8",
    "P8MEA": "progress_8",
    "P8LOWCOV": "progress_8_lower_ci",
    "P8UPCOV": "progress_8_upper_ci",
    "PTL2BASICS_94": "pct_grade4_english_maths",
    "PTL2BASICS_95": "pct_grade5_english_maths",
    "EBACCAPS": "ebacc_avg_points",
    "PTEBACC_E_PTQ_EE": "pct_entering_ebacc",
    "PTEBACC_95_EE": "pct_achieving_ebacc_strong",
}


class KS4Ingestor(BaseIngestor):
    SOURCE_NAME = "ks4_performance"
    TARGET_TABLE = "performance_ks4"
    ACADEMIC_YEAR = ACADEMIC_YEAR

    def download(self, force: bool = False) -> Path:
        zip_filename = f"ks4_performance_{ACADEMIC_YEAR.replace('/', '_')}.zip"
        cached_zip = settings.raw_path(zip_filename)
        if cached_zip.exists() and not force:
            return self._extract_institution_csv(cached_zip)

        url = self._find_download_url()
        zip_path = self._download_file(url, zip_filename, force=force)
        return self._extract_institution_csv(zip_path)

    def _find_download_url(self) -> str:
        """Scrape the EES publication page for the current 'Download all data' URL."""
        try:
            resp = requests.get(EES_KS4_PUBLICATION_URL, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "/releases/" in href and "/files" in href:
                    return href.split("?")[0]  # strip query params
        except Exception as exc:
            logger.warning("Could not scrape KS4 EES page: %s", exc)
        logger.info("Falling back to hardcoded KS4 download URL")
        return EES_KS4_ZIP_URL

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
                    f"Could not find institution-level CSV in KS4 ZIP.\n"
                    f"Available files: {members}\n"
                    f"Expected a file matching pattern: *{INSTITUTION_FILE_PATTERN}*.csv\n"
                    f"Update INSTITUTION_FILE_PATTERN in etl/ks4.py."
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
        logger.info("Raw KS4 rows: %d", len(df))

        # EES tidy format: filter to overall (Total) breakdown row per school
        for col in ("breakdown_topic", "breakdown", "sex", "disadvantage_status",
                    "first_language", "prior_attainment", "mobility"):
            if col in df.columns:
                df = df[df[col] == "Total"]
        logger.info("After Total filter: %d rows", len(df))

        df = df.rename(columns=COLUMN_MAP)

        # Filter to London schools
        df["urn"] = pd.to_numeric(df.get("urn", pd.Series()), errors="coerce")
        london_urns = self._get_london_urns()
        df = df[df["urn"].isin(london_urns)]
        logger.info("London KS4 rows: %d", len(df))

        rows = []
        for _, row in df.iterrows():
            g = row.get

            # Detect suppression: if any key metric is suppressed, flag the row
            suppressed = any(
                self._is_suppressed(row.get(col))
                for col in ["attainment_8", "progress_8", "pct_grade5_english_maths"]
                if col in row.index
            )

            rows.append({
                "urn": self._parse_int(g("urn")),
                "academic_year": ACADEMIC_YEAR,
                "cohort_size": self._parse_int(g("cohort_size")),
                "attainment_8": self._parse_float(g("attainment_8")),
                "progress_8": self._parse_float(g("progress_8")),
                "progress_8_lower_ci": self._parse_float(g("progress_8_lower_ci")),
                "progress_8_upper_ci": self._parse_float(g("progress_8_upper_ci")),
                "pct_grade4_english_maths": self._parse_float(g("pct_grade4_english_maths")),
                "pct_grade5_english_maths": self._parse_float(g("pct_grade5_english_maths")),
                "ebacc_avg_points": self._parse_float(g("ebacc_avg_points")),
                "pct_entering_ebacc": self._parse_float(g("pct_entering_ebacc")),
                "pct_achieving_ebacc_strong": self._parse_float(g("pct_achieving_ebacc_strong")),
                "suppressed": suppressed,
            })

        # Drop rows where URN resolved to None
        return [r for r in rows if r["urn"] is not None]

    def load(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        return self._upsert(PerformanceKS4, rows, conflict_columns=["urn", "academic_year"])
