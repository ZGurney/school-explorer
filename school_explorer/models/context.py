"""
Contextual / resource tables.

Sources:
  Pupils:    DfE "Schools, pupils and their characteristics" (Jan census, via EES)
  Workforce: DfE "School workforce in England" (Nov census, published Jul, via EES)
  Financials: FBIT — CFR returns (LA-maintained) + Academy Accounts Returns (academies)
              https://financial-benchmarking-and-insights-tool.education.gov.uk/

FINANCIAL YEAR vs ACADEMIC YEAR:
  Financial data uses April–March years, labelled here as "2023-24" (hyphen, not slash).
  All other tables use academic years "2023/24" (slash).
  Never compare these directly in a query without an explicit mapping comment.
"""

from typing import Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from school_explorer.models.base import Base, TimestampMixin


class Pupils(Base, TimestampMixin):
    """Annual pupil characteristics snapshot from the January school census."""

    __tablename__ = "pupils"
    __table_args__ = (
        UniqueConstraint("urn", "academic_year", name="uq_pupils_urn_year"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    urn: Mapped[int] = mapped_column(Integer, ForeignKey("schools.urn"), nullable=False, index=True)
    academic_year: Mapped[str] = mapped_column(String(7), nullable=False)

    total_pupils: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    boys: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    girls: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Free school meal eligibility in the past 6 years — the pupil premium proxy
    pct_fsm6: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Currently eligible for FSM (narrower measure)
    pct_fsm_eligible: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Special Educational Needs
    pct_sen_ehcp: Mapped[Optional[float]] = mapped_column(Float, nullable=True)   # Education, Health & Care Plan
    pct_sen_support: Mapped[Optional[float]] = mapped_column(Float, nullable=True) # SEN support (no formal plan)

    # English as an Additional Language
    pct_eal: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Ethnicity — broad headline; detailed breakdown omitted for brevity
    pct_white_british: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_asian_or_asian_british: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_black_or_black_british: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_mixed: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Overall absence rate (all authorised + unauthorised absences)
    pct_absence_overall: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pct_persistent_absence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    school: Mapped["School"] = relationship("School", back_populates="pupils")  # noqa: F821


class Workforce(Base, TimestampMixin):
    """
    Annual workforce snapshot from the November School Workforce Census.
    Published aggregates only — individual staff data is restricted.
    """

    __tablename__ = "workforce"
    __table_args__ = (
        UniqueConstraint("urn", "academic_year", name="uq_workforce_urn_year"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    urn: Mapped[int] = mapped_column(Integer, ForeignKey("schools.urn"), nullable=False, index=True)
    academic_year: Mapped[str] = mapped_column(String(7), nullable=False)

    # Full-time equivalent counts
    fte_teachers: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fte_support_staff: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Pupil-teacher ratio (total pupils / FTE teachers)
    pupil_teacher_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # % of teachers with Qualified Teacher Status
    pct_qualified_teachers: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # True if this school was in the top 20% for staff turnover in any of the last 3 years
    # (DfE publishes this as a flag, not an exact figure, to avoid small-school disclosure)
    high_staff_turnover: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    school: Mapped["School"] = relationship("School", back_populates="workforce")  # noqa: F821


class Financials(Base, TimestampMixin):
    """
    Annual income/expenditure data.

    LA-maintained schools → Consistent Financial Reporting (CFR) returns
    Academies → Academy Accounts Returns (AAR)

    Both are normalised into this single table. The funding_type column
    records which schema the row came from so you can apply appropriate
    caveats in the UI.

    All monetary values are in whole pounds (£).
    """

    __tablename__ = "financials"
    __table_args__ = (
        UniqueConstraint("urn", "financial_year", name="uq_financials_urn_year"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    urn: Mapped[int] = mapped_column(Integer, ForeignKey("schools.urn"), nullable=False, index=True)

    # Format: "2023-24" (April 2023 – March 2024). Note hyphen, not slash.
    financial_year: Mapped[str] = mapped_column(String(7), nullable=False)

    # "maintained" | "academy" — affects how figures were compiled
    funding_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Income
    total_income: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    income_per_pupil: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Expenditure
    total_expenditure: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    expenditure_per_pupil: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Expenditure breakdown (£)
    teaching_staff_costs: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    support_staff_costs: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    premises_costs: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    other_costs: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Teaching staff costs as % of total expenditure — key benchmarking metric
    pct_teaching_staff_expenditure: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Year-end revenue balance (positive = surplus, negative = deficit)
    balance: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    balance_per_pupil: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    in_deficit: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)

    school: Mapped["School"] = relationship("School", back_populates="financials")  # noqa: F821
