"""
School financials ingestor.
Populates the `financials` table.

Source: FBIT (Financial Benchmarking and Insights Tool)
  https://financial-benchmarking-and-insights-tool.education.gov.uk/

Covers all state-funded schools (maintained and academies) via the FBIT
public API used by the tool's own frontend. The API is not officially
documented but the endpoints below have been stable since 2024.

FBIT API endpoints (all GET, dimension=PerUnit returns per-pupil figures):
  GET /api/expenditure/history?id={urn}&type=school&dimension=PerUnit
  GET /api/income/history?id={urn}&type=school&dimension=PerUnit
  GET /api/balance/history?id={urn}&type=school&dimension=PerUnit

FINANCIAL YEAR format: "2024-25" (hyphen). The `year` field in the API
response is the calendar year in which the financial year ends (e.g. 2025
= April 2024 – March 2025).
"""

import json
import logging
import time
from pathlib import Path
from typing import Any, Optional

import requests

from school_explorer.config import settings
from school_explorer.etl.base import BaseIngestor
from school_explorer.models.context import Financials

logger = logging.getLogger(__name__)

FINANCIAL_YEAR = "2024-25"
FBIT_BASE_URL = "https://financial-benchmarking-and-insights-tool.education.gov.uk"
FBIT_YEAR = 2025  # calendar year when the financial year ends


class FinancialsIngestor(BaseIngestor):
    SOURCE_NAME = "financials"
    TARGET_TABLE = "financials"
    ACADEMIC_YEAR = "2024/25"

    def download(self, force: bool = False) -> Path:
        """Fetch FBIT data for all London schools and cache to JSON."""
        cache_path = settings.raw_path(f"financials_{FINANCIAL_YEAR}.json")
        if cache_path.exists() and not force:
            logger.info("Using cached FBIT data: %s", cache_path)
            return cache_path

        london_urns = self._get_london_urns()
        logger.info("Fetching FBIT data for %d schools…", len(london_urns))
        rows = []
        for i, urn in enumerate(sorted(london_urns)):
            row = self._fetch_fbit_school(urn)
            if row:
                rows.append(row)
            if (i + 1) % 50 == 0:
                logger.info("  FBIT progress: %d/%d", i + 1, len(london_urns))
            time.sleep(0.05)  # be polite
        logger.info("Got FBIT data for %d/%d schools", len(rows), len(london_urns))
        cache_path.write_text(json.dumps(rows))
        return cache_path

    def transform(self, path: Path) -> list[dict[str, Any]]:
        """Load cached FBIT financial data."""
        return json.loads(path.read_text())

    def _fetch_fbit_school(self, urn: int) -> Optional[dict[str, Any]]:
        """
        Fetch one school's financial summary from the FBIT API.
        Uses the expenditure/history, income/history, and balance/history
        endpoints with dimension=PerUnit to get per-pupil figures.
        Returns None if the school has no FBIT data.
        """
        params = {"id": urn, "type": "school", "dimension": "PerUnit"}
        try:
            exp = self._get_latest_row(f"{FBIT_BASE_URL}/api/expenditure/history", params)
            if not exp:
                return None
            inc = self._get_latest_row(f"{FBIT_BASE_URL}/api/income/history", params) or {}
            bal = self._get_latest_row(f"{FBIT_BASE_URL}/api/balance/history", params) or {}
            return self._build_row(urn, exp, inc, bal)
        except Exception as exc:
            logger.debug("FBIT error for URN %d: %s", urn, exc)
            return None

    def _get_latest_row(self, url: str, params: dict) -> Optional[dict]:
        """Fetch a FBIT history endpoint and return the most recent year's row."""
        resp = requests.get(url, params=params, timeout=15)
        if resp.status_code in (404, 400):
            return None
        resp.raise_for_status()
        data = resp.json()
        if not data or not isinstance(data, dict):
            return None
        rows = data.get("rows", [])
        if not rows:
            return None
        # Return the row for FBIT_YEAR, or the latest available year
        target = next((r for r in rows if r.get("year") == FBIT_YEAR), None)
        return target or rows[-1]

    def _build_row(self, urn: int, exp: dict, inc: dict, bal: dict) -> dict[str, Any]:
        """Map FBIT per-pupil figures into our Financials model."""
        expenditure_per_pupil = _to_int(exp.get("totalExpenditure"))
        income_per_pupil = _to_int(inc.get("totalIncome"))
        balance_per_pupil = _to_int(bal.get("revenueReserve"))
        teaching = _to_int(exp.get("teachingStaffCosts"))

        pct_teaching = (
            round(teaching / expenditure_per_pupil * 100, 1)
            if teaching and expenditure_per_pupil
            else None
        )

        return {
            "urn": urn,
            "financial_year": FINANCIAL_YEAR,
            "funding_type": "unknown",  # FBIT API no longer surfaces finance type simply
            "total_income": None,       # API returns per-pupil only (not totals)
            "income_per_pupil": income_per_pupil,
            "total_expenditure": None,
            "expenditure_per_pupil": expenditure_per_pupil,
            "teaching_staff_costs": None,
            "support_staff_costs": None,
            "premises_costs": None,
            "pct_teaching_staff_expenditure": pct_teaching,
            "balance": None,
            "balance_per_pupil": balance_per_pupil,
            "in_deficit": (balance_per_pupil < 0) if balance_per_pupil is not None else None,
        }

    def load(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        return self._upsert(Financials, rows, conflict_columns=["urn", "financial_year"])


def _to_int(value: Any) -> Optional[int]:
    try:
        return int(float(str(value)))
    except (TypeError, ValueError):
        return None
