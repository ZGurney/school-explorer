"""
KS5 (16-18) destination measures ingestor.
Populates the `destinations_ks5` table.

Source: DfE 16-18 Destination Measures (via EES)
  https://explore-education-statistics.service.gov.uk/find-statistics/16-18-destination-measures

The EES ZIP contains institution-level CSVs.

DfE COLUMN NAMES — verify against actual CSV header after downloading.
The names below are based on DfE naming conventions; they can change between releases.

  urn / URN            — school URN
  time_period          — e.g. "2023/24" (destination measurement year)
  cohort_year          — e.g. "2022/23" (year pupils left 16-18 study)
  cohort_size          — number of pupils in cohort
  overall_destination  — % in any sustained destination
  higher_education     — % in higher education (university)
  further_education    — % in further education
  apprenticeship_l2    — % in level 2 apprenticeship
  apprenticeship_l3    — % in level 3 apprenticeship
  apprenticeship_l4_plus — % in level 4+ apprenticeship
  employment           — % in employment
  not_captured         — % not captured
"""

import logging
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from bs4 import BeautifulSoup

from school_explorer.config import settings
from school_explorer.etl.base import BaseIngestor
from school_explorer.models.destinations import DestinationsKS5

logger = logging.getLogger(__name__)

COHORT_YEAR = "2022/23"
DESTINATION_YEAR = "2023/24"

EES_DEST_KS5_PUBLICATION_URL = (
    "https://explore-education-statistics.service.gov.uk"
    "/find-statistics/16-18-destination-measures"
)
EES_DEST_KS5_ZIP_URL = (
    "https://content.explore-education-statistics.service.gov.uk"
    "/api/releases/0eaa4713-ae54-41f4-9838-193eca47c44e/files"
)

INSTITUTION_FILE_PATTERN = "ks5_inst"

# Column map: CSV header → model field.
COLUMN_MAP = {
    # Current EES format (ees_ks5_inst file)
    "school_urn": "urn",
    "cohort": "cohort_size",
    "overall": "pct_sustained",
    "he": "pct_higher_education",
    "fe": "pct_further_education",
    "appren": "pct_apprenticeship_l3",  # total apprenticeship mapped to l3 (most common)
    "all_work": "pct_employment",
    "all_unknown": "pct_not_captured",
}


class DestinationsKS5Ingestor(BaseIngestor):
    SOURCE_NAME = "destinations_ks5"
    TARGET_TABLE = "destinations_ks5"
    ACADEMIC_YEAR = DESTINATION_YEAR

    def download(self, force: bool = False) -> Path:
        zip_filename = f"destinations_ks5_{DESTINATION_YEAR.replace('/', '_')}.zip"
        zip_path = settings.raw_path(zip_filename)
        if zip_path.exists() and not force:
            return self._extract_zip(zip_path, INSTITUTION_FILE_PATTERN)
        url = self._find_download_url()
        zip_path = self._download_file(url, zip_filename, force=force)
        return self._extract_zip(zip_path, INSTITUTION_FILE_PATTERN)

    def _find_download_url(self) -> str:
        try:
            resp = requests.get(EES_DEST_KS5_PUBLICATION_URL, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            for a in soup.find_all("a", href=True):
                if "/releases/" in a["href"] and "/files" in a["href"]:
                    return a["href"].split("?")[0]
        except Exception as exc:
            logger.warning("Could not scrape KS5 destinations EES page: %s", exc)
        return EES_DEST_KS5_ZIP_URL

    def transform(self, path: Path) -> list[dict[str, Any]]:
        df = pd.read_csv(path, dtype=str, low_memory=False)
        logger.info("Raw KS5 destinations rows: %d", len(df))

        # Filter to school-level, Total breakdowns, Percentage data type
        if "geographic_level" in df.columns:
            df = df[df["geographic_level"] == "School"]
        for col in ("breakdown_topic", "breakdown", "cohort_level"):
            if col in df.columns:
                df = df[df[col] == "Total"]
        if "cohort_level_group" in df.columns:
            df = df[df["cohort_level_group"] == "Total"]
        if "data_type" in df.columns:
            df = df[df["data_type"] == "Percentage"]
        logger.info("After filters: %d rows", len(df))

        # Prefer 'Revised' over 'Provisional' when duplicates exist
        if "version" in df.columns:
            df = df.sort_values("version", ascending=False)
        df = df.rename(columns={k: v for k, v in COLUMN_MAP.items() if k in df.columns})

        df["urn"] = pd.to_numeric(df.get("urn", pd.Series()), errors="coerce")
        df = df[df["urn"].isin(self._get_london_urns())]
        df = df.drop_duplicates(subset=["urn"])
        logger.info("London KS5 destinations rows: %d", len(df))

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
                "pct_higher_education": self._parse_float(g("pct_higher_education")),
                "pct_further_education": self._parse_float(g("pct_further_education")),
                "pct_apprenticeship_l2": None,
                "pct_apprenticeship_l3": self._parse_float(g("pct_apprenticeship_l3")),
                "pct_apprenticeship_l4_plus": None,
                "pct_employment": self._parse_float(g("pct_employment")),
                "pct_not_captured": self._parse_float(g("pct_not_captured")),
            })
        return rows

    def load(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        return self._upsert(DestinationsKS5, rows, conflict_columns=["urn", "cohort_year"])
