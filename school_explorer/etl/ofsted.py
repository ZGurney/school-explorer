"""
Ofsted inspection data ingestor.
Populates the `inspections` table.

Source: DfE Five-Year Ofsted Inspection Data (state-funded schools CSV)
  https://www.gov.uk/government/publications/five-year-ofsted-inspection-data

The file is updated several times a year. The naming convention is:
  management_information_-_state-funded_schools_-_as_at_<DD>_<month>_<YYYY>.csv

IMPORTANT — Ofsted new framework (Sept 2024):
  overall_effectiveness_legacy is only populated for inspections before Sept 2024.
  From Sept 2024, inspections produce only the four sub-judgement grades.
  The page https://reports.ofsted.gov.uk/inspection-reports/find-inspection-report
  has the new report cards, but there is no bulk download yet.

We only load inspections for schools already in our `schools` table.
"""

import logging
from datetime import date
from pathlib import Path
from typing import Any, Optional

import pandas as pd
import requests
from bs4 import BeautifulSoup

from school_explorer.etl.base import BaseIngestor
from school_explorer.models.inspection import Inspection

logger = logging.getLogger(__name__)

OFSTED_PUBLICATION_URL = (
    "https://www.gov.uk/government/publications/five-year-ofsted-inspection-data"
)

# Grade values Ofsted uses — stored as-is (strings survive framework changes)
VALID_GRADES = frozenset({
    "Outstanding", "Good", "Requires improvement", "Inadequate",
    "Not applicable", "Not yet inspected",
})

# Column name mapping: CSV/ODS header → our field name.
# Includes both the old CSV headers (pre-2025) and the current ODS headers.
# NOTE: Ofsted occasionally renames columns between releases. If you get a
# KeyError, compare against the file header row and update this map.
COLUMN_MAP = {
    # URN
    "URN": "urn",
    # Inspection / publication dates
    "Inspection date": "inspection_date",       # old CSV
    "As at date": "inspection_date",            # current ODS
    "Publication date": "publication_date",     # old CSV
    "Published date": "publication_date",       # current ODS
    # Inspection type
    "Inspection type": "inspection_type",       # old CSV
    "Publication type": "inspection_type",      # current ODS (e.g. "OS")
    # Overall grade — only populated pre-Sept 2024
    "Overall effectiveness": "overall_effectiveness_legacy",
    "Overall effectiveness (1-4)": "overall_effectiveness_legacy",
    # Sub-judgements
    "Quality of education": "quality_of_education",
    "Behaviour and attitudes": "behaviour_attitudes",
    "Behaviour and Attitudes": "behaviour_attitudes",
    "Personal development": "personal_development",
    "Leadership and management": "leadership_management",
    "Effectiveness of leadership and management": "leadership_management",  # current ODS
    # Provision-specific
    "Early years provision": "early_years_provision",
    "Early years provision (where applicable)": "early_years_provision",   # current ODS
    "Sixth form provision": "sixth_form_provision",
    "Sixth form provision (where applicable)": "sixth_form_provision",     # current ODS
}


class OfstedIngestor(BaseIngestor):
    SOURCE_NAME = "ofsted"
    TARGET_TABLE = "inspections"
    ACADEMIC_YEAR = "rolling"

    def download(self, force: bool = False) -> Path:
        from school_explorer.config import settings
        # Accept both the old CSV naming and the current ODS/XLSX naming
        patterns = [
            "management_information*state*schools*.csv",
            "five-year-ofsted*state-funded*.ods",
            "five-year-ofsted*state-funded*.xlsx",
            "ofsted_state_funded_schools.*",
        ]
        if not force:
            for pattern in patterns:
                cached = sorted(settings.data_raw_dir.glob(pattern), reverse=True)
                if cached:
                    return cached[0]

        url = self._find_download_url()
        filename = url.split("/")[-1].split("?")[0]
        if not any(filename.endswith(ext) for ext in (".csv", ".ods", ".xlsx")):
            filename = "ofsted_state_funded_schools.ods"
        return self._download_file(url, filename, force=force)

    def _find_download_url(self) -> str:
        """Scrape the GOV.UK publication page to find the state-funded schools file."""
        try:
            resp = requests.get(OFSTED_PUBLICATION_URL, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            for link in soup.find_all("a", href=True):
                href = link["href"]
                text_lower = link.get_text(strip=True).lower()
                href_lower = href.lower()
                # Match the state-funded schools attachment in any supported format
                is_state_schools = (
                    "state" in text_lower and "school" in text_lower
                ) or "state-funded-school" in href_lower
                is_data_file = any(
                    href_lower.endswith(ext) for ext in (".csv", ".ods", ".xlsx")
                )
                if is_state_schools and is_data_file:
                    if href.startswith("http"):
                        return href
                    return f"https://assets.publishing.service.gov.uk{href}"
        except Exception as exc:
            logger.warning("Could not scrape Ofsted publication page: %s", exc)

        raise RuntimeError(
            "Could not find Ofsted download URL. "
            f"Please visit {OFSTED_PUBLICATION_URL}, download the "
            "'State-funded schools' file manually, and place it in data/raw/."
        )

    def transform(self, path: Path) -> list[dict[str, Any]]:
        suffix = path.suffix.lower()
        if suffix == ".csv":
            df = pd.read_csv(path, encoding="cp1252", low_memory=False, dtype=str)
        elif suffix == ".ods":
            # ODS structure: row 0 = title, row 1 = description, row 2 = column headers
            df = pd.read_excel(
                path, engine="odf", sheet_name="Provider_level_data", header=2, dtype=str
            )
        elif suffix == ".xlsx":
            df = pd.read_excel(path, engine="openpyxl", header=1, dtype=str)
        else:
            raise ValueError(f"Unsupported Ofsted file format: {suffix}")
        logger.info("Raw Ofsted rows: %d", len(df))

        # Rename columns to our standard names
        df = df.rename(columns={k: v for k, v in COLUMN_MAP.items() if k in df.columns})

        # Filter to London schools only
        london_urns = self._get_london_urns()
        df["urn"] = pd.to_numeric(df.get("urn", pd.Series()), errors="coerce")
        df = df[df["urn"].isin(london_urns)]
        logger.info("London Ofsted rows: %d", len(df))

        # Drop rows without a URN or inspection date
        df = df.dropna(subset=["urn", "inspection_date"])

        rows = []
        for _, row in df.iterrows():
            r = self._transform_row(row)
            if r:
                rows.append(r)
        return rows

    def _transform_row(self, row: pd.Series) -> Optional[dict[str, Any]]:
        g = row.get
        urn = self._parse_int(g("urn"))
        if not urn:
            return None
        inspection_date = _parse_date(g("inspection_date"))
        if not inspection_date:
            return None

        # overall_effectiveness_legacy: only meaningful pre-Sept 2024
        overall = _clean_grade(g("overall_effectiveness_legacy"))
        if overall and inspection_date is not None and inspection_date >= date(2024, 9, 1):
            # Shouldn't appear under the new framework, but defensively null it out
            overall = None

        return {
            "urn": urn,
            "inspection_date": inspection_date,
            "publication_date": _parse_date(g("publication_date")),
            "inspection_type": _clean(g("inspection_type")),
            "overall_effectiveness_legacy": overall,
            "quality_of_education": _clean_grade(g("quality_of_education")),
            "behaviour_attitudes": _clean_grade(g("behaviour_attitudes")),
            "personal_development": _clean_grade(g("personal_development")),
            "leadership_management": _clean_grade(g("leadership_management")),
            "early_years_provision": _clean_grade(g("early_years_provision")),
            "sixth_form_provision": _clean_grade(g("sixth_form_provision")),
        }

    def load(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        return self._upsert(Inspection, rows, conflict_columns=["urn", "inspection_date"])


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _clean(value: Any) -> Optional[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    return s if s and s.lower() not in {"nan", "none", "n/a", ""} else None


def _clean_grade(value: Any) -> Optional[str]:
    """Normalise Ofsted grade strings. Returns None for non-grade values."""
    s = _clean(value)
    if s is None:
        return None
    # Numeric grades: 1=Outstanding, 2=Good, 3=RI, 4=Inadequate, 9=Not applicable
    grade_from_number = {
        "1": "Outstanding",
        "2": "Good",
        "3": "Requires improvement",
        "4": "Inadequate",
        "9": None,  # Not applicable / not assessed
    }
    if s in grade_from_number:
        return grade_from_number[s]
    # Some files include trailing spaces or different capitalisation
    normalised = s.strip().title()
    if normalised == "Requires Improvement":
        normalised = "Requires improvement"
    return normalised if normalised in VALID_GRADES else s


def _parse_date(value: Any) -> Optional[date]:
    """Parse Ofsted date strings into a Python date object."""
    from datetime import datetime as dt
    s = _clean(value)
    if s is None:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d-%m-%Y", "%d %B %Y"):
        try:
            return dt.strptime(s, fmt).date()
        except ValueError:
            continue
    logger.debug("Could not parse date: %r", s)
    return None
