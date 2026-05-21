"""
Core registry tables. Every other table joins to School on URN.

Sources:
  - Borough: ONS LA boundaries (GeoJSON, loaded once)
  - School:  GIAS bulk CSV download — updated monthly
             https://get-information-schools.service.gov.uk/Downloads
"""

from datetime import date
from typing import Optional

from sqlalchemy import Date, Float, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from school_explorer.models.base import Base, TimestampMixin


# ---------------------------------------------------------------------------
# Borough
# ---------------------------------------------------------------------------

class Borough(Base, TimestampMixin):
    __tablename__ = "boroughs"

    la_code: Mapped[str] = mapped_column(String(10), primary_key=True)
    la_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Stored as GeoJSON text. Use PostGIS geometry column in a future migration
    # once you add the PostGIS extension (CREATE EXTENSION postgis).
    boundary_geojson: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    schools: Mapped[list["School"]] = relationship("School", back_populates="borough")

    def __repr__(self) -> str:
        return f"<Borough {self.la_code} {self.la_name}>"


# ---------------------------------------------------------------------------
# School
# ---------------------------------------------------------------------------

class School(Base, TimestampMixin):
    """
    One row per school / college. Primary key is the DfE URN.

    Covers all establishment types in scope:
      - State-funded (community, voluntary aided/controlled, foundation)
      - Academies (converter, sponsor-led, free schools)
      - Grammar/selective schools (is_selective = True)
      - Independent schools
      - Sixth-form colleges (phase = '16 plus', type = 'Further education')
      - UTC / studio schools

    Notes:
      - predecessor_urn: set when a school converts to academy or merges.
        Allows linking historical data across the URN change.
      - has_sixth_form: derived from OfficialSixthForm GIAS field OR from
        age_high >= 18. Both signals are checked during ingestion.
      - is_selective: derived from AdmissionsPolicy = 'Selective' in GIAS.
        Also catches partially-selective schools (banding) via admissions_policy.
    """

    __tablename__ = "schools"

    # --- Identity ---
    urn: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    laestab: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # --- Name & Borough ---
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    la_code: Mapped[Optional[str]] = mapped_column(
        String(10), ForeignKey("boroughs.la_code"), nullable=True, index=True
    )
    la_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # --- Type & Phase ---
    # Raw GIAS type name, e.g. "Academy converter", "Community school"
    establishment_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Simplified bucket: state | academy | free | independent | sixth_form_college
    #                    grammar | utc | studio | pru | other
    establishment_group: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # GIAS phase: Primary | Secondary | All-through | 16 plus | Nursery | Not applicable
    phase: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    age_low: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    age_high: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # --- Characteristics ---
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # Mixed|Boys|Girls
    religious_character: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Full GIAS admissions policy string: Selective | Non-selective | Not applicable
    admissions_policy: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_selective: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    has_sixth_form: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    capacity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # --- Location ---
    street: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    locality: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    town: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postcode: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, index=True)
    lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # --- Contact ---
    website: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    telephone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    headteacher_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)

    # --- Status & Lifecycle ---
    # Open | Closed | Open, but proposed to close | Proposed to open
    status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    open_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    close_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # Populated when a school converts or merges — allows linking historical data
    predecessor_urn: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # --- Relationships ---
    borough: Mapped[Optional["Borough"]] = relationship("Borough", back_populates="schools")
    inspections: Mapped[list["Inspection"]] = relationship(  # noqa: F821
        "Inspection", back_populates="school", order_by="Inspection.inspection_date.desc()"
    )
    performance_ks2: Mapped[list["PerformanceKS2"]] = relationship(  # noqa: F821
        "PerformanceKS2", back_populates="school"
    )
    performance_ks4: Mapped[list["PerformanceKS4"]] = relationship(  # noqa: F821
        "PerformanceKS4", back_populates="school"
    )
    performance_ks5: Mapped[list["PerformanceKS5"]] = relationship(  # noqa: F821
        "PerformanceKS5", back_populates="school"
    )
    destinations_ks4: Mapped[list["DestinationsKS4"]] = relationship(  # noqa: F821
        "DestinationsKS4", back_populates="school"
    )
    destinations_ks5: Mapped[list["DestinationsKS5"]] = relationship(  # noqa: F821
        "DestinationsKS5", back_populates="school"
    )
    pupils: Mapped[list["Pupils"]] = relationship("Pupils", back_populates="school")  # noqa: F821
    workforce: Mapped[list["Workforce"]] = relationship(  # noqa: F821
        "Workforce", back_populates="school"
    )
    financials: Mapped[list["Financials"]] = relationship(  # noqa: F821
        "Financials", back_populates="school"
    )

    def __repr__(self) -> str:
        return f"<School urn={self.urn} name={self.name!r}>"
