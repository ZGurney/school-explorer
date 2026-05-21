"""
GIAS (Get Information About Schools) ingestor.
Populates the `schools` and `boroughs` tables.

Source: https://get-information-schools.service.gov.uk/Downloads
File:   edubasealldata<YYYYMMDD>.csv  (~30 MB, ~50k rows, all of England)

We filter to London LA codes and all school types in scope.

COLUMN NAMES: these are the actual GIAS CSV column headers as of 2024.
If a run fails with KeyError, check the downloaded CSV header row — DfE
occasionally renames columns (e.g. the RSC Region field was removed in
July 2024). Add new mappings to COLUMN_MAP below.

COORDINATES: The GIAS CSV exposes OS National Grid (OSGB36) Easting/Northing
columns, not WGS84 lat/lng. We convert using the OS transverse Mercator
inverse formula plus a 7-parameter Helmert datum shift. Accuracy ~5 metres.
"""

import logging
import math
from datetime import date
from pathlib import Path
from typing import Any, Optional

import pandas as pd
import requests
from bs4 import BeautifulSoup

from school_explorer.etl.base import BaseIngestor
from school_explorer.models.school import Borough, School

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GIAS_DOWNLOADS_PAGE = "https://get-information-schools.service.gov.uk/Downloads"

# Maps GIAS TypeOfEstablishment (name) → our simplified establishment_group
ESTABLISHMENT_GROUP_MAP: dict[str, str] = {
    # State / LA-maintained
    "Community school": "state",
    "Voluntary aided school": "state",
    "Voluntary controlled school": "state",
    "Foundation school": "state",
    "Community special school": "state_special",
    "Foundation special school": "state_special",
    # Academies
    "Academy sponsor led": "academy",
    "Academy converter": "academy",
    "Academy special sponsor led": "academy",
    "Academy special converter": "academy",
    # Free schools
    "Free schools": "free",
    "Free schools special": "free",
    "Free schools alternative provision": "free",
    # Other state types
    "University technical college": "utc",
    "Studio schools": "studio",
    "City technology college": "ctc",
    "Pupil referral unit": "pru",
    # Post-16
    "Further education": "sixth_form_college",
    "Sixth form centres": "sixth_form_college",
    # Independent
    "Independent school": "independent",
    "Non-maintained special school": "independent",
}

# London borough LA codes (inner + outer)
LONDON_LA_CODES: frozenset[int] = frozenset({
    # Inner London
    201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213,
    # Outer London
    301, 302, 303, 304, 305, 306, 307, 308, 309, 310,
    311, 312, 313, 314, 315, 316, 317, 318, 319, 320,
})

# London borough names keyed by LA code (used to populate boroughs table)
LONDON_BOROUGHS: dict[int, str] = {
    201: "City of London",
    202: "Camden",
    203: "Greenwich",
    204: "Hackney",
    205: "Hammersmith and Fulham",
    206: "Islington",
    207: "Kensington and Chelsea",
    208: "Lambeth",
    209: "Lewisham",
    210: "Southwark",
    211: "Tower Hamlets",
    212: "Wandsworth",
    213: "Westminster",
    301: "Barking and Dagenham",
    302: "Barnet",
    303: "Bexley",
    304: "Brent",
    305: "Bromley",
    306: "Croydon",
    307: "Ealing",
    308: "Enfield",
    309: "Haringey",
    310: "Harrow",
    311: "Havering",
    312: "Hillingdon",
    313: "Hounslow",
    314: "Kingston upon Thames",
    315: "Merton",
    316: "Newham",
    317: "Redbridge",
    318: "Richmond upon Thames",
    319: "Sutton",
    320: "Waltham Forest",
}

# Statuses we want to keep (ignore historical closed schools with no recent data)
ACTIVE_STATUSES: frozenset[str] = frozenset({
    "Open",
    "Open, but proposed to close",
    "Proposed to open",
})


# ---------------------------------------------------------------------------
# Ingestor
# ---------------------------------------------------------------------------

class GIASIngestor(BaseIngestor):
    SOURCE_NAME = "gias"
    TARGET_TABLE = "schools"
    ACADEMIC_YEAR = "rolling"

    def download(self, force: bool = False) -> Path:
        """
        Scrape the GIAS downloads page to find the current 'All establishments'
        CSV link, then download it.
        """
        cached = list(self._find_cached_gias_files())
        if cached and not force:
            logger.info("Using cached GIAS file: %s", cached[0])
            return cached[0]

        url = self._find_download_url()
        filename = url.split("/")[-1]
        return self._download_file(url, filename, force=force)

    def _find_cached_gias_files(self):
        """Yield any previously downloaded GIAS CSV files."""
        from school_explorer.config import settings
        yield from sorted(
            settings.data_raw_dir.glob("edubasealldata*.csv"), reverse=True
        )

    def _find_download_url(self) -> str:
        """
        Scrape the GIAS downloads page to find the current full extract URL.
        Falls back to a hardcoded pattern if scraping fails.
        """
        try:
            resp = requests.get(GIAS_DOWNLOADS_PAGE, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            # Find links whose href contains 'edubasealldata' (the full extract)
            for link in soup.find_all("a", href=True):
                href = link["href"]
                if "edubasealldata" in href and href.endswith(".csv"):
                    if href.startswith("http"):
                        return href
                    return f"https://get-information-schools.service.gov.uk{href}"
        except Exception as exc:
            logger.warning("Could not scrape GIAS downloads page: %s", exc)

        # Fallback: use today's date (DfE publishes daily)
        from datetime import date
        today = date.today().strftime("%Y%m%d")
        url = (
            f"https://ea-edubase-api-prod.azurewebsites.net"
            f"/edubase/downloads/public/edubasealldata{today}.csv"
        )
        logger.info("Falling back to URL pattern: %s", url)
        return url

    def transform(self, path: Path) -> list[dict[str, Any]]:
        """
        Parse the GIAS CSV and return rows ready for upsert into `schools`.
        Also seeds the `boroughs` table as a side-effect.
        """
        df = pd.read_csv(
            path,
            encoding="cp1252",       # GIAS exports Windows-1252, not UTF-8
            low_memory=False,
            dtype=str,                # read everything as string; parse below
        )

        logger.info("Raw GIAS rows: %d", len(df))

        # --- Filter to London ---
        df["_la_code_int"] = pd.to_numeric(df.get("LA (code)", pd.Series()), errors="coerce")
        df = df[df["_la_code_int"].isin(LONDON_LA_CODES)]

        # --- Filter to active statuses ---
        status_col = "EstablishmentStatus (name)"
        if status_col in df.columns:
            df = df[df[status_col].isin(ACTIVE_STATUSES)]

        logger.info("London active rows: %d", len(df))

        # --- Transform each row ---
        rows = []
        for _, row in df.iterrows():
            rows.append(self._transform_row(row))

        return rows

    def _transform_row(self, row: pd.Series) -> dict[str, Any]:
        g = row.get  # shorthand

        urn = self._parse_int(g("URN"))
        if urn is None:
            raise ValueError(f"Row has no URN: {dict(row)}")

        # Headteacher name
        first = str(g("HeadFirstName", "") or "").strip()
        last = str(g("HeadLastName", "") or "").strip()
        headteacher = f"{first} {last}".strip() or None

        # Sixth form: use only the authoritative GIAS field.
        # The age_high >= 18 heuristic over-fires for all-through and special schools.
        sixth_form_field = str(g("OfficialSixthForm (name)", "") or "").strip()
        age_high = self._parse_int(g("StatutoryHighAge"))
        has_sixth_form = sixth_form_field == "Has a sixth form"

        # Selective / grammar
        admissions_policy = _clean(g("AdmissionsPolicy (name)"))
        is_selective = (admissions_policy or "").lower() == "selective"

        # Establishment group
        est_type = _clean(g("TypeOfEstablishment (name)"))
        est_group = ESTABLISHMENT_GROUP_MAP.get(est_type or "", "other")
        # Override: grammar schools get their own group for easy filtering
        if is_selective and est_group in {"state", "academy", "free"}:
            est_group = "grammar"

        la_code_raw = self._parse_int(g("LA (code)"))
        la_code = str(la_code_raw) if la_code_raw is not None else None

        return {
            "urn": urn,
            "laestab": _clean(g("LAESTAB")),
            "name": _clean(g("EstablishmentName")) or f"School {urn}",
            "la_code": la_code,
            "la_name": _clean(g("LA (name)")),
            "establishment_type": est_type,
            "establishment_group": est_group,
            "phase": _clean(g("PhaseOfEducation (name)")),
            "age_low": self._parse_int(g("StatutoryLowAge")),
            "age_high": age_high,
            "gender": _clean(g("Gender (name)")),
            "religious_character": _clean(g("ReligiousCharacter (name)")),
            "admissions_policy": admissions_policy,
            "is_selective": is_selective,
            "has_sixth_form": has_sixth_form,
            "capacity": self._parse_int(g("SchoolCapacity")),
            "street": _clean(g("Street")),
            "locality": _clean(g("Locality")),
            "town": _clean(g("Town")),
            "postcode": _clean(g("Postcode")),
            "lat": _easting_northing_to_lat(
                self._parse_float(g("Easting")), self._parse_float(g("Northing"))
            ),
            "lng": _easting_northing_to_lng(
                self._parse_float(g("Easting")), self._parse_float(g("Northing"))
            ),
            "website": _clean(g("SchoolWebsite")),
            "telephone": _clean(g("TelephoneNum")),
            "headteacher_name": headteacher or None,
            "status": _clean(g("EstablishmentStatus (name)")),
            "open_date": _parse_date(g("OpenDate")),
            "close_date": _parse_date(g("CloseDate")),
        }

    def _seed_boroughs(self) -> None:
        """Insert/update the 33 London boroughs. Safe to call multiple times."""
        rows = [
            {"la_code": str(code), "la_name": name}
            for code, name in LONDON_BOROUGHS.items()
        ]
        self._upsert(Borough, rows, conflict_columns=["la_code"])

    def load(self, rows: list[dict[str, Any]]) -> tuple[int, int]:
        self._seed_boroughs()
        return self._upsert(School, rows, conflict_columns=["urn"])


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def _clean(value: Any) -> Optional[str]:
    """Strip whitespace and return None for empty/Not applicable strings."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    if s.lower() in {"", "not applicable", "n/a", "nan", "none"}:
        return None
    return s


def _osgb36_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """
    Convert OS National Grid (OSGB36) Easting/Northing to WGS84 lat/lng.

    Uses the OS transverse Mercator inverse formula (Airy 1830 ellipsoid) to
    recover OSGB36 geographic coordinates, then a 7-parameter Helmert shift
    to move from OSGB36 to WGS84. Accurate to ~5 metres across Great Britain.

    Reference: 'A Guide to Coordinate Systems in Great Britain', Ordnance Survey.
    """
    # --- Step 1: inverse TM projection (OSGB36 Easting/Northing → OSGB36 lat/lon) ---
    a, b = 6377563.396, 6356256.909          # Airy 1830 semi-axes (metres)
    F0 = 0.9996012717                        # scale factor on central meridian
    phi0 = math.radians(49.0)               # true origin latitude
    lam0 = math.radians(-2.0)              # true origin longitude (central meridian)
    N0, E0 = -100000.0, 400000.0           # false origin offsets (metres)

    e2 = 1.0 - (b / a) ** 2
    n = (a - b) / (a + b)

    E, N = easting, northing

    phi = phi0
    for _ in range(50):
        M = b * F0 * (
            (1 + n + 1.25 * n**2 + 1.25 * n**3) * (phi - phi0)
            - (3 * n + 3 * n**2 + 2.625 * n**3) * math.sin(phi - phi0) * math.cos(phi + phi0)
            + (1.875 * n**2 + 1.875 * n**3) * math.sin(2 * (phi - phi0)) * math.cos(2 * (phi + phi0))
            - (35.0 / 24.0) * n**3 * math.sin(3 * (phi - phi0)) * math.cos(3 * (phi + phi0))
        )
        delta = (N - N0 - M) / (a * F0)
        phi += delta
        if abs(delta) < 1e-10:
            break

    sp, cp, tp = math.sin(phi), math.cos(phi), math.tan(phi)
    nu = a * F0 / math.sqrt(1 - e2 * sp**2)
    rho = a * F0 * (1 - e2) / (1 - e2 * sp**2) ** 1.5
    eta2 = nu / rho - 1.0
    dE = E - E0

    VII = tp / (2 * rho * nu)
    VIII = tp / (24 * rho * nu**3) * (5 + 3 * tp**2 + eta2 - 9 * tp**2 * eta2)
    IX = tp / (720 * rho * nu**5) * (61 + 90 * tp**2 + 45 * tp**4)
    X = 1.0 / (cp * nu)
    XI = 1.0 / (cp * 6 * nu**3) * (nu / rho + 2 * tp**2)
    XII = 1.0 / (cp * 120 * nu**5) * (5 + 28 * tp**2 + 24 * tp**4)
    XIIA = 1.0 / (cp * 5040 * nu**7) * (61 + 662 * tp**2 + 1320 * tp**4 + 720 * tp**6)

    phi_osgb = phi - VII * dE**2 + VIII * dE**4 - IX * dE**6
    lam_osgb = lam0 + X * dE - XI * dE**3 + XII * dE**5 - XIIA * dE**7

    # --- Step 2: Helmert datum shift OSGB36 → WGS84 ---
    e2_airy = 1.0 - (b / a) ** 2
    nu_airy = a / math.sqrt(1 - e2_airy * math.sin(phi_osgb) ** 2)

    x = nu_airy * math.cos(phi_osgb) * math.cos(lam_osgb)
    y = nu_airy * math.cos(phi_osgb) * math.sin(lam_osgb)
    z = nu_airy * (1 - e2_airy) * math.sin(phi_osgb)

    tx, ty, tz = 446.448, -125.157, 542.060
    rx = math.radians(0.1502 / 3600)
    ry = math.radians(0.2470 / 3600)
    rz = math.radians(0.8421 / 3600)
    s = -20.4894e-6

    x2 = tx + (1 + s) * (x - rz * y + ry * z)
    y2 = ty + (1 + s) * (rz * x + y - rx * z)
    z2 = tz + (1 + s) * (-ry * x + rx * y + z)

    a_wgs, b_wgs = 6378137.0, 6356752.314
    e2_wgs = 1.0 - (b_wgs / a_wgs) ** 2
    p = math.sqrt(x2**2 + y2**2)

    lat = math.atan2(z2, p * (1 - e2_wgs))
    for _ in range(10):
        nu_wgs = a_wgs / math.sqrt(1 - e2_wgs * math.sin(lat) ** 2)
        lat_new = math.atan2(z2 + e2_wgs * nu_wgs * math.sin(lat), p)
        if abs(lat_new - lat) < 1e-12:
            break
        lat = lat_new

    lon = math.atan2(y2, x2)
    return math.degrees(lat), math.degrees(lon)


def _easting_northing_to_lat(easting: Optional[float], northing: Optional[float]) -> Optional[float]:
    if easting is None or northing is None:
        return None
    try:
        lat, _ = _osgb36_to_wgs84(easting, northing)
        return round(lat, 6)
    except Exception:
        return None


def _easting_northing_to_lng(easting: Optional[float], northing: Optional[float]) -> Optional[float]:
    if easting is None or northing is None:
        return None
    try:
        _, lng = _osgb36_to_wgs84(easting, northing)
        return round(lng, 6)
    except Exception:
        return None


def _parse_date(value: Any) -> Optional[date]:
    """Parse GIAS date strings (DD/MM/YYYY) into a Python date object."""
    from datetime import datetime as dt
    s = _clean(value)
    if s is None:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return dt.strptime(s, fmt).date()
        except ValueError:
            continue
    logger.debug("Could not parse date: %r", s)
    return None
