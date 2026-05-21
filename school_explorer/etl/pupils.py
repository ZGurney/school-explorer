"""
Pupil characteristics ingestor (January school census).
Populates the `pupils` table.

Source: DfE Schools, pupils and their characteristics
  https://explore-education-statistics.service.gov.uk/find-statistics/school-pupils-and-their-characteristics

We use the school-level underlying data CSV, which has one row per school.

DfE COLUMN NAMES (verify against actual CSV — these are illustrative):
  time_period         — academic year, e.g. "202425"
  urn                 — school URN
  headcount           — total pupils on roll
  headcount_boys      — boys
  headcount_girls     — girls
  pct_fsm6            — % ever eligible for FSM in last 6 years
  pct_fsm             — % currently eligible
  pct_sen_ehcp        — % with EHC plan
  pct_sen_support     — % SEN support (no plan)
  pct_eal             — % English as additional language
  pct_white_british   — % White British
  pct_asian           — % Asian or Asian British
  pct_black           — % Black or Black British
  pct_mixed           — % Mixed
  overall_absence_rate — overall absence %
  persistent_absence_rate — persistent absence %
"""

import logging
from pathlib import Path
from typing import Any, Optional

import pandas as pd
import requests
from bs4 import BeautifulSoup

from school_explorer.config import settings
from school_explorer.etl.base import BaseIngestor
from school_explorer.models.context import Pupils

logger = logging.getLogger(__name__)

ACADEMIC_YEAR = "2024/25"

EES_PUPILS_PUBLICATION_URL = (
    "https://explore-education-statistics.service.gov.uk"
    "/find-statistics/school-pupils-and-their-characteristics"
)
EES_PUPILS_ZIP_URL = (
    "https://content.explore-education-statistics.service.gov.uk"
    "/api/releases/63491b17-2037-4533-b719-d3656aaf6ed5/files"
)

INSTITUTION_FILE_PATTERN = "spc_school_level_underlying_data"


class PupilsIngestor(BaseIngestor):
    SOURCE_NAME = "pupils"
    TARGET_TABLE = "pupils"
    ACADEMIC_YEAR = ACADEMIC_YEAR

    def download(self, force: bool = False) -> Path:
        zip_filename = f"pupils_{ACADEMIC_YEAR.replace('/', '_')}.zip"
        zip_path = settings.raw_path(zip_filename)
        if zip_path.exists() and not force:
            return self._extract_zip(zip_path, INSTITUTION_FILE_PATTERN)
        url = self._find_download_url()
        zip_path = self._download_file(url, zip_filename, force=force)
        return self._extract_zip(zip_path, INSTITUTION_FILE_PATTERN)

    def _find_download_url(self) -> str:
        try:
            resp = requests.get(EES_PUPILS_PUBLICATION_URL, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            for a in soup.find_all("a", href=True):
                if "/releases/" in a["href"] and "/files" in a["href"]:
                    return a["href"].split("?")[0]
        except Exception as exc:
            logger.warning("Could not scrape pupils EES page: %s", exc)
        return EES_PUPILS_ZIP_URL

    def transform(self, path: Path) -> list[dict[str, Any]]:
        df = pd.read_csv(path, dtype=str, low_memory=False, encoding="cp1252")
        logger.info("Raw pupils rows: %d", len(df))

        # Strip BOM and normalise column names to lowercase
        df.columns = [c.strip().lower().lstrip("﻿") for c in df.columns]

        # Filter school-level rows (underlying data may include LA/national aggregates)
        if "geographic_level" in df.columns:
            df = df[df["geographic_level"].str.lower() == "school"]

        df["urn"] = pd.to_numeric(df.get("urn", pd.Series()), errors="coerce")
        df = df[df["urn"].isin(self._get_london_urns())]
        logger.info("London pupils rows: %d", len(df))

        def _get(row: pd.Series, *keys: str):
            """Return first non-null value across a list of column name candidates."""
            for k in keys:
                v = row.get(k)
                if v is not None and str(v).strip() not in {"", "nan"}:
                    return v
            return None

        def _sum_pcts(row: pd.Series, *col_names: str) -> Optional[float]:
            """
            Sum percentage columns, ignoring suppressed/missing values.
            Returns None only if every component is missing; otherwise sums
            what is available (treating missing sub-groups as 0).
            """
            total = 0.0
            any_found = False
            for col in col_names:
                v = self._parse_float(row.get(col))
                if v is not None:
                    total += v
                    any_found = True
            return round(total, 1) if any_found else None

        # Column names as they appear in spc_school_level_underlying_data (lowercase after normalisation)
        rows = []
        for _, row in df.iterrows():
            rows.append({
                "urn": self._parse_int(row.get("urn")),
                "academic_year": ACADEMIC_YEAR,
                "total_pupils": self._parse_int(_get(
                    row,
                    "headcount of pupils", "headcount_of_pupils",
                    "headcount", "number_of_pupils",
                )),
                "boys": self._parse_int(_get(
                    row,
                    "headcount total male", "headcount_total_male", "headcount_boys",
                )),
                "girls": self._parse_int(_get(
                    row,
                    "headcount total female", "headcount_total_female", "headcount_girls",
                )),
                # FSM6 (ever 6-year eligible) is not present in the school-level census file;
                # it is published only as LA-level aggregates in a separate DfE release.
                "pct_fsm6": None,
                "pct_fsm_eligible": self._parse_float(_get(
                    row,
                    "% of pupils known to be eligible for free school meals",
                    "% of pupils known to be eligible for free school meals (performance tables)",
                    "pct_fsm", "percentage_eligible_fsm",
                )),
                # SEN breakdown is from the SEN2 publication, not the January census file.
                "pct_sen_ehcp": None,
                "pct_sen_support": None,
                "pct_eal": self._parse_float(_get(
                    row,
                    "% of pupils whose first language is known or believed to be other than english",
                    "pct_eal", "percentage_eal",
                )),
                "pct_white_british": self._parse_float(_get(
                    row,
                    "% of pupils classified as white british ethnic origin",
                    "pct_white_british", "percentage_white_british",
                )),
                # Aggregated ethnic groups: sum the sub-group percentage columns.
                # Asian/Asian British = Indian + Pakistani + Bangladeshi + any other Asian
                "pct_asian_or_asian_british": _sum_pcts(
                    row,
                    "% of pupils classified as indian ethnic origin",
                    "% of pupils classified as pakistani ethnic origin",
                    "% of pupils classified as bangladeshi ethnic origin",
                    "% of pupils classified as any other asian background ethnic origin",
                ),
                # Black/Black British = Caribbean + African + any other black
                "pct_black_or_black_british": _sum_pcts(
                    row,
                    "% of pupils classified as caribbean ethnic origin",
                    "% of pupils classified as african ethnic origin",
                    "% of pupils classified as any other black background ethnic origin",
                ),
                # Mixed = white & black Caribbean + white & black African + white & Asian + any other mixed
                "pct_mixed": _sum_pcts(
                    row,
                    "% of pupils classified as white and black caribbean ethnic origin",
                    "% of pupils classified as white and black african ethnic origin",
                    "% of pupils classified as white and asian ethnic origin",
                    "% of pupils classified as any other mixed background ethnic origin",
                ),
                # Absence data is from the DfE 'Pupil absence in schools in England' publication,
                # not the January census. Not available in this source file.
                "pct_absence_overall": None,
                "pct_persistent_absence": None,
            })
        return [r for r in rows if r["urn"] is not None]

    def load(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        return self._upsert(Pupils, rows, conflict_columns=["urn", "academic_year"])
