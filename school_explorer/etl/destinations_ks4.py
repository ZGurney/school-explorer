"""
KS4 destination measures ingestor.
Populates the `destinations_ks4` table.

Source: DfE Key Stage 4 Destination Measures (via EES)
  https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-destination-measures

The EES ZIP contains institution-level CSVs. We want the file with one row per school.

DfE COLUMN NAMES — verify against actual CSV header after downloading.
The names below are based on DfE naming conventions for this publication; they
can change between releases.

  urn / URN           — school URN
  time_period         — e.g. "2023/24" (destination measurement year)
  cohort_year         — e.g. "2022/23" (year pupils left KS4)
  cohort_size / COHORT — number of pupils in cohort
  overall_destination_percentage — % in any sustained destination
  school_sixth_form_percentage / SS6     — % at school sixth form
  sixth_form_college_percentage / SFC    — % at sixth form college
  further_education_college_percentage / FEC — % at FE college
  other_education_percentage / OED       — % in other education
  apprenticeship_percentage / APW        — % in apprenticeship
  employment_percentage / EMPL           — % in employment
  not_captured_percentage / NC           — % not captured
"""

import logging
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from bs4 import BeautifulSoup

from school_explorer.config import settings
from school_explorer.etl.base import BaseIngestor
from school_explorer.models.destinations import DestinationsKS4

logger = logging.getLogger(__name__)

# Cohort year = year pupils completed KS4; destination year = cohort_year + 1
COHORT_YEAR = "2022/23"
DESTINATION_YEAR = "2023/24"

EES_DEST_KS4_PUBLICATION_URL = (
    "https://explore-education-statistics.service.gov.uk"
    "/find-statistics/key-stage-4-destination-measures"
)
EES_DEST_KS4_ZIP_URL = (
    "https://content.explore-education-statistics.service.gov.uk"
    "/api/releases/66440127-e6ef-4117-af20-8fc5d87ec3ae/files"
)

# Pattern to find the institution-level file inside the ZIP.
# Inspect the ZIP if this doesn't match — update the pattern to match the actual filename.
INSTITUTION_FILE_PATTERN = "ks4_inst"

# Column map: CSV header → model field.
COLUMN_MAP = {
    # Current EES format (ees_ks4_inst file)
    "school_urn": "urn",
    "cohort": "cohort_size",
    "overall": "pct_sustained",
    "ssf": "pct_school_sixth_form",
    "sfc": "pct_sixth_form_college",
    "fe": "pct_fe_college",
    "other_edu": "pct_other_education",
    "appren": "pct_apprenticeship",
    "all_work": "pct_employment",
    "all_unknown": "pct_not_captured",
}


class DestinationsKS4Ingestor(BaseIngestor):
    SOURCE_NAME = "destinations_ks4"
    TARGET_TABLE = "destinations_ks4"
    ACADEMIC_YEAR = DESTINATION_YEAR

    def download(self, force: bool = False) -> Path:
        zip_filename = f"destinations_ks4_{DESTINATION_YEAR.replace('/', '_')}.zip"
        zip_path = settings.raw_path(zip_filename)
        if zip_path.exists() and not force:
            return self._extract_zip(zip_path, INSTITUTION_FILE_PATTERN)
        url = self._find_download_url()
        zip_path = self._download_file(url, zip_filename, force=force)
        return self._extract_zip(zip_path, INSTITUTION_FILE_PATTERN)

    def _find_download_url(self) -> str:
        try:
            resp = requests.get(EES_DEST_KS4_PUBLICATION_URL, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            for a in soup.find_all("a", href=True):
                if "/releases/" in a["href"] and "/files" in a["href"]:
                    return a["href"].split("?")[0]
        except Exception as exc:
            logger.warning("Could not scrape KS4 destinations EES page: %s", exc)
        return EES_DEST_KS4_ZIP_URL

    def transform(self, path: Path) -> list[dict[str, Any]]:
        df = pd.read_csv(path, dtype=str, low_memory=False)
        logger.info("Raw KS4 destinations rows: %d", len(df))

        # Filter to school-level, Total breakdown, Percentage data type
        if "geographic_level" in df.columns:
            df = df[df["geographic_level"] == "School"]
        for col in ("breakdown_topic", "breakdown"):
            if col in df.columns:
                df = df[df[col] == "Total"]
        if "data_type" in df.columns:
            df = df[df["data_type"] == "Percentage"]
        logger.info("After Total/Percentage filter: %d rows", len(df))

        df = df.rename(columns={k: v for k, v in COLUMN_MAP.items() if k in df.columns})

        df["urn"] = pd.to_numeric(df.get("urn", pd.Series()), errors="coerce")
        df = df[df["urn"].isin(self._get_london_urns())]
        logger.info("London KS4 destinations rows: %d", len(df))

        rows = []
        for _, row in df.iterrows():
            g = row.get
            urn = self._parse_int(g("urn"))
            if urn is None:
                continue
            rows.append({
                "urn": urn,
                "cohort_year": COHORT_YEAR,
                "destination_year": DESTINATION_YEAR,
                "cohort_size": self._parse_int(g("cohort_size")),
                "pct_sustained": self._parse_float(g("pct_sustained")),
                "pct_school_sixth_form": self._parse_float(g("pct_school_sixth_form")),
                "pct_sixth_form_college": self._parse_float(g("pct_sixth_form_college")),
                "pct_fe_college": self._parse_float(g("pct_fe_college")),
                "pct_other_education": self._parse_float(g("pct_other_education")),
                "pct_apprenticeship": self._parse_float(g("pct_apprenticeship")),
                "pct_employment": self._parse_float(g("pct_employment")),
                "pct_not_captured": self._parse_float(g("pct_not_captured")),
            })
        return rows

    def load(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        return self._upsert(DestinationsKS4, rows, conflict_columns=["urn", "cohort_year"])
