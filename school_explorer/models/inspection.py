"""
Ofsted inspection records. Multiple rows per school (one per inspection).

Source: DfE Five-Year Ofsted Inspection Data
  https://www.gov.uk/government/publications/five-year-ofsted-inspection-data
  File: management_information_-_state-funded_schools_-_as_at_<date>.csv

IMPORTANT — Ofsted framework change (Sept 2024):
  The overall effectiveness single grade has been REMOVED for state-funded schools.
  It is stored here as overall_effectiveness_legacy (nullable) and will only ever
  be populated for inspections before Sept 2024.

  The four sub-judgements (quality_of_education, behaviour_attitudes,
  personal_development, leadership_management) remain and are the current currency.

  Grade values: Outstanding | Good | Requires improvement | Inadequate
  (stored as strings to survive any future framework changes)
"""

from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from school_explorer.models.base import Base, TimestampMixin


class Inspection(Base, TimestampMixin):
    __tablename__ = "inspections"
    __table_args__ = (
        UniqueConstraint("urn", "inspection_date", name="uq_inspection_urn_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    urn: Mapped[int] = mapped_column(Integer, ForeignKey("schools.urn"), nullable=False, index=True)
    inspection_date: Mapped[date] = mapped_column(Date, nullable=False)
    publication_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # graded | ungraded | monitoring | urgent | section8
    inspection_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Sub-judgements — still current under the new framework
    quality_of_education: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    behaviour_attitudes: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    personal_development: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    leadership_management: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Only applicable where the school has these provisions
    early_years_provision: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    sixth_form_provision: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Legacy — only populated for inspections before Sept 2024
    overall_effectiveness_legacy: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Direct link to the Ofsted report PDF/page
    report_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    school: Mapped["School"] = relationship("School", back_populates="inspections")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Inspection urn={self.urn} date={self.inspection_date}>"
