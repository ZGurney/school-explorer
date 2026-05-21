"""
Post-school destination measures.

Sources (all via EES):
  KS4: https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-destination-measures
  KS5: https://explore-education-statistics.service.gov.uk/find-statistics/16-18-destination-measures

IMPORTANT — destinations data lags by ~18 months:
  The 2023/24 KS5 cohort's destinations won't be published until ~March 2026.
  cohort_year = the year the pupils LEFT the school
  destination_year = the year in which destinations were measured (cohort_year + 1)

  Always surface both years in the UI so users understand which cohort they're
  looking at vs which years' A-level results the same school might be showing.
"""

from typing import Optional

from sqlalchemy import Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from school_explorer.models.base import Base, TimestampMixin


class DestinationsKS4(Base, TimestampMixin):
    """Where did Year 11 leavers go? (one year after completing GCSEs)"""

    __tablename__ = "destinations_ks4"
    __table_args__ = (
        UniqueConstraint("urn", "cohort_year", name="uq_dest_ks4_urn_year"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    urn: Mapped[int] = mapped_column(Integer, ForeignKey("schools.urn"), nullable=False, index=True)

    # Year the KS4 cohort left school, e.g. "2022/23"
    cohort_year: Mapped[str] = mapped_column(String(7), nullable=False)
    # Year destinations were measured, e.g. "2023/24"
    destination_year: Mapped[str] = mapped_column(String(7), nullable=False)
    cohort_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # % in any sustained education, employment, or apprenticeship destination
    pct_sustained: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Education breakdown
    pct_school_sixth_form: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_sixth_form_college: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_fe_college: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_other_education: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    pct_apprenticeship: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_employment: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Pupils whose activity was not captured in any data source
    pct_not_captured: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    school: Mapped["School"] = relationship(  # noqa: F821
        "School", back_populates="destinations_ks4"
    )


class DestinationsKS5(Base, TimestampMixin):
    """Where did 16-18 study leavers go? (one year after completing sixth form/college)"""

    __tablename__ = "destinations_ks5"
    __table_args__ = (
        UniqueConstraint("urn", "cohort_year", name="uq_dest_ks5_urn_year"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    urn: Mapped[int] = mapped_column(Integer, ForeignKey("schools.urn"), nullable=False, index=True)

    cohort_year: Mapped[str] = mapped_column(String(7), nullable=False)
    destination_year: Mapped[str] = mapped_column(String(7), nullable=False)
    cohort_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    pct_sustained: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Higher education — the headline metric for most users
    pct_higher_education: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_further_education: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Apprenticeship breakdown by level
    pct_apprenticeship_l2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_apprenticeship_l3: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_apprenticeship_l4_plus: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    pct_employment: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_not_captured: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    school: Mapped["School"] = relationship(  # noqa: F821
        "School", back_populates="destinations_ks5"
    )
