"""
School Workforce Census ingestor.
Populates the `workforce` table.

Source: DfE School workforce in England
  https://explore-education-statistics.service.gov.uk/find-statistics/school-workforce-in-england

Published annually in July. The November census data appears the following July,
so the 2024/25 academic year workforce data appears in July 2025.

We use the school-level underlying data which contains aggregate counts
(not individual staff — that data is restricted).

DfE COLUMN NAMES (illustrative — verify against actual CSV):
  urn                     — school URN
  fte_teachers            — FTE teacher headcount
  fte_support_staff       — FTE teaching assistants + other support
  pupil_teacher_ratio     — PTR
  pct_qualified_teachers  — % teachers with QTS
  high_turnover           — "1" if in top 20% for turnover in any of last 3 years
"""

import logging
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from bs4 import BeautifulSoup

from school_explorer.config import settings
from school_explorer.etl.base import BaseIngestor
from school_explorer.models.context import Workforce

logger = logging.getLogger(__name__)

ACADEMIC_YEAR = "2024/25"   # updated to match current EES release

EES_WORKFORCE_PUBLICATION_URL = (
    "https://explore-education-statistics.service.gov.uk"
    "/find-statistics/school-workforce-in-england"
)
EES_WORKFORCE_ZIP_URL = (
    "https://content.explore-education-statistics.service.gov.uk"
    "/api/releases/ba5318f9-2f18-4ef5-8c71-a4db8546758c/files"
)

INSTITUTION_FILE_PATTERN = "workforce_ptrs_2010_2024_sch"
FTE_HC_FILE_PATTERN = "workforce_2010_2024_fte_hc_nat_reg_la_sch"
TURNOVER_FILE_PATTERN = "teacher_turnover_2010_2024_sch"


class WorkforceIngestor(BaseIngestor):
    SOURCE_NAME = "workforce"
    TARGET_TABLE = "workforce"
    ACADEMIC_YEAR = ACADEMIC_YEAR

    def download(self, force: bool = False) -> Path:
        zip_filename = f"workforce_{ACADEMIC_YEAR.replace('/', '_')}.zip"
        zip_path = settings.raw_path(zip_filename)
        if not zip_path.exists() or force:
            url = self._find_download_url()
            zip_path = self._download_file(url, zip_filename, force=force)
        # Extract all three files we need; _extract_zip is idempotent (skips if exists)
        ptr_path = self._extract_zip(zip_path, INSTITUTION_FILE_PATTERN)
        self._extract_zip(zip_path, FTE_HC_FILE_PATTERN)
        self._extract_zip(zip_path, TURNOVER_FILE_PATTERN)
        return ptr_path

    def _find_download_url(self) -> str:
        try:
            resp = requests.get(EES_WORKFORCE_PUBLICATION_URL, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            for a in soup.find_all("a", href=True):
                if "/releases/" in a["href"] and "/files" in a["href"]:
                    return a["href"].split("?")[0]
        except Exception as exc:
            logger.warning("Could not scrape workforce EES page: %s", exc)
        return EES_WORKFORCE_ZIP_URL

    def transform(self, path: Path) -> list[dict[str, Any]]:
        london_urns = self._get_london_urns()

        # --- Primary file: PTR data (teachers FTE, PTR, qualified%) ---
        df_ptr = pd.read_csv(path, dtype=str, low_memory=False)
        df_ptr.columns = [c.strip().lower().lstrip("﻿") for c in df_ptr.columns]
        logger.info("Raw PTR rows: %d", len(df_ptr))
        if "geographic_level" in df_ptr.columns:
            df_ptr = df_ptr[df_ptr["geographic_level"].str.lower() == "school"]
        if "time_period" in df_ptr.columns:
            df_ptr = df_ptr[df_ptr["time_period"] == df_ptr["time_period"].dropna().max()]
        urn_col = "school_urn" if "school_urn" in df_ptr.columns else "urn"
        df_ptr[urn_col] = pd.to_numeric(df_ptr[urn_col], errors="coerce")
        df_ptr = df_ptr[df_ptr[urn_col].isin(london_urns)].copy()
        df_ptr["_urn"] = df_ptr[urn_col]
        logger.info("London PTR rows: %d", len(df_ptr))

        # --- FTE+HC file: support staff ---
        # _extract_zip preserves the original casing from the ZIP; use a
        # case-insensitive keyword that is unambiguous in the filename.
        fte_hc_candidates = sorted(path.parent.glob("*fte_hc*sch*"))
        fte_hc_path = fte_hc_candidates[0] if fte_hc_candidates else None
        df_fte: pd.DataFrame | None = None
        if fte_hc_path and fte_hc_path.exists():
            df_fte = pd.read_csv(fte_hc_path, dtype=str, low_memory=False, encoding="cp1252")
            df_fte.columns = [c.strip().lower().lstrip("﻿") for c in df_fte.columns]
            if "geographic_level" in df_fte.columns:
                df_fte = df_fte[df_fte["geographic_level"].str.lower() == "school"]
            if "time_period" in df_fte.columns:
                df_fte = df_fte[df_fte["time_period"] == df_fte["time_period"].dropna().max()]
            fte_urn_col = "school_urn" if "school_urn" in df_fte.columns else "urn"
            df_fte[fte_urn_col] = pd.to_numeric(df_fte[fte_urn_col], errors="coerce")
            df_fte = df_fte[df_fte[fte_urn_col].isin(london_urns)].set_index(fte_urn_col)
            logger.info("FTE+HC rows after London filter: %d", len(df_fte))
        else:
            logger.warning("FTE+HC file not found in %s; fte_support_staff will be NULL", path.parent)

        # --- Turnover file: high_staff_turnover flag ---
        # Flag a school as high-turnover if its teacher leaving rate in the latest year
        # is in the top quintile (≥ 80th percentile) across all London schools.
        turnover_candidates = sorted(path.parent.glob("*teacher_turnover*sch*"))
        turnover_path = turnover_candidates[0] if turnover_candidates else None
        high_turnover_urns: set[int] = set()
        if turnover_path and turnover_path.exists():
            df_to = pd.read_csv(turnover_path, dtype=str, low_memory=False)
            df_to.columns = [c.strip().lower().lstrip("﻿") for c in df_to.columns]
            if "geographic_level" in df_to.columns:
                df_to = df_to[df_to["geographic_level"].str.lower() == "school"]
            if "time_period" in df_to.columns:
                df_to = df_to[df_to["time_period"] == df_to["time_period"].dropna().max()]
            to_urn_col = "school_urn" if "school_urn" in df_to.columns else "urn"
            df_to[to_urn_col] = pd.to_numeric(df_to[to_urn_col], errors="coerce")
            df_to = df_to[df_to[to_urn_col].isin(london_urns)].copy()

            left_col = "left_the_state-funded_system"
            other_col = "left_to_another_state-funded_school"
            fte_col = "teacher_fte_in_census_year"
            for col in (left_col, other_col, fte_col):
                df_to[col] = pd.to_numeric(df_to[col], errors="coerce")

            df_to["_leavers"] = df_to[left_col].fillna(0) + df_to[other_col].fillna(0)
            df_to["_rate"] = df_to["_leavers"] / df_to[fte_col].replace(0, float("nan"))
            threshold = df_to["_rate"].quantile(0.80)
            high_turnover_urns = set(
                df_to.loc[df_to["_rate"] >= threshold, to_urn_col].dropna().astype(int).tolist()
            )
            logger.info(
                "Turnover 80th-pct threshold: %.1f%%; %d London schools flagged",
                threshold * 100,
                len(high_turnover_urns),
            )
        else:
            logger.warning("Turnover file not found in %s; high_staff_turnover will be NULL", path.parent)

        rows = []
        for _, row in df_ptr.iterrows():
            g = row.get
            urn = self._parse_int(g("school_urn") or g("urn"))
            if urn is None:
                continue

            qual_fte = self._parse_float(g("qualified_teachers_fte"))
            total_fte = self._parse_float(g("teachers_fte"))
            pct_qual = (
                round(qual_fte / total_fte * 100, 1)
                if qual_fte is not None and total_fte and total_fte > 0
                else None
            )

            support_fte = None
            if df_fte is not None and urn in df_fte.index:
                support_fte = self._parse_float(df_fte.at[urn, "fte_all_support_staff"])

            rows.append({
                "urn": urn,
                "academic_year": ACADEMIC_YEAR,
                "fte_teachers": total_fte,
                "fte_support_staff": support_fte,
                "pupil_teacher_ratio": self._parse_float(
                    g("pupil_to_qual_unqual_teacher_ratio") or g("ptr")
                ),
                "pct_qualified_teachers": pct_qual,
                "high_staff_turnover": (
                    True if urn in high_turnover_urns
                    else (False if high_turnover_urns else None)
                ),
            })
        return rows

    def load(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        return self._upsert(Workforce, rows, conflict_columns=["urn", "academic_year"])
