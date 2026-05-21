"""
Academic performance tables. One row per (school, academic_year).

Sources (all via Explore Education Statistics):
  KS2: https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-2-attainment
  KS4: https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance
  KS5: https://explore-education-statistics.service.gov.uk/find-statistics/a-level-and-other-16-to-18-results

academic_year format: "2024/25"

SUPPRESSION:
  The DfE suppresses cells where cohort < 6 pupils. A suppressed metric is stored
  as None (NULL in DB) with suppressed=True. Do NOT treat NULL as zero in the UI —
  label it "N/A (small cohort)" instead.

INDEPENDENT SCHOOLS:
  Independent schools do not submit to DfE performance tables. Their rows will
  have no corresponding performance records. Show "Not available" in the UI.
"""

from typing import Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from school_explorer.models.base import Base, TimestampMixin


# ---------------------------------------------------------------------------
# Key Stage 2 (primary schools)
# ---------------------------------------------------------------------------

class PerformanceKS2(Base, TimestampMixin):
    __tablename__ = "performance_ks2"
    __table_args__ = (
        UniqueConstraint("urn", "academic_year", name="uq_ks2_urn_year"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    urn: Mapped[int] = mapped_column(Integer, ForeignKey("schools.urn"), nullable=False, index=True)
    academic_year: Mapped[str] = mapped_column(String(7), nullable=False)  # e.g. "2024/25"

    cohort_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # % at expected standard in Reading, Writing, and Maths combined
    pct_expected_rwm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # % at greater depth in RWM combined
    pct_greater_depth_rwm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # School-level progress scores (national average = 0; negative is below average)
    progress_reading: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    progress_writing: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    progress_maths: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # KS2 average scaled score for reading and maths
    avg_scaled_score_reading: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_scaled_score_maths: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    suppressed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    school: Mapped["School"] = relationship("School", back_populates="performance_ks2")  # noqa: F821


# ---------------------------------------------------------------------------
# Key Stage 4 / GCSE (secondary schools)
# ---------------------------------------------------------------------------

class PerformanceKS4(Base, TimestampMixin):
    __tablename__ = "performance_ks4"
    __table_args__ = (
        UniqueConstraint("urn", "academic_year", name="uq_ks4_urn_year"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    urn: Mapped[int] = mapped_column(Integer, ForeignKey("schools.urn"), nullable=False, index=True)
    academic_year: Mapped[str] = mapped_column(String(7), nullable=False)

    cohort_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Attainment 8: average points score across 8 qualifications
    attainment_8: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Progress 8: value-added measure; 0 = national average; positive = above
    progress_8: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # 95% confidence interval around P8 — useful to show uncertainty in the UI
    progress_8_lower_ci: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    progress_8_upper_ci: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # % achieving grade 5+ (strong pass) in English AND Maths
    pct_grade5_english_maths: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # % achieving grade 4+ (standard pass) in English AND Maths
    pct_grade4_english_maths: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # EBacc average points score (science, humanities, language + English + Maths)
    ebacc_avg_points: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # % of pupils entered for the full EBacc suite
    pct_entering_ebacc: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # % achieving EBacc at grade 5+ (strong pass)
    pct_achieving_ebacc_strong: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    suppressed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    school: Mapped["School"] = relationship("School", back_populates="performance_ks4")  # noqa: F821


# ---------------------------------------------------------------------------
# Key Stage 5 / A-level (sixth forms & colleges)
# ---------------------------------------------------------------------------

class PerformanceKS5(Base, TimestampMixin):
    __tablename__ = "performance_ks5"
    __table_args__ = (
        UniqueConstraint("urn", "academic_year", name="uq_ks5_urn_year"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    urn: Mapped[int] = mapped_column(Integer, ForeignKey("schools.urn"), nullable=False, index=True)
    academic_year: Mapped[str] = mapped_column(String(7), nullable=False)

    # Total number of students completing 16-18 study
    total_cohort: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Number sitting at least one A-level
    alevel_cohort: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Average Points Score per entry (A* = 56, A = 48, B = 40 … E = 16)
    avg_points_per_entry: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Average points per A-level entry only
    avg_points_per_alevel_entry: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Grade distribution for A-level entries
    pct_astar_to_e: Mapped[Optional[float]] = mapped_column(Float, nullable=True)   # pass rate
    pct_astar_to_b: Mapped[Optional[float]] = mapped_column(Float, nullable=True)   # high grades
    pct_astar_or_a: Mapped[Optional[float]] = mapped_column(Float, nullable=True)   # top grades

    # Applied General and Tech Level cohort sizes (vocational track)
    applied_general_cohort: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tech_level_cohort: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    suppressed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    school: Mapped["School"] = relationship("School", back_populates="performance_ks5")  # noqa: F821
