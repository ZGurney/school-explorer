"""add_summary_view

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-05-20 00:00:00.000000

Creates the school_summary_latest materialised view. This is the primary
read target for the API — all list/search queries hit this view rather than
joining across 10 tables at query time. The UNIQUE index on urn enables
REFRESH CONCURRENTLY (non-blocking refresh while the API serves reads).
"""
from alembic import op

revision = "a1b2c3d4e5f6"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
CREATE MATERIALIZED VIEW school_summary_latest AS
SELECT
    s.urn,
    s.name,
    s.la_code,
    s.la_name,
    s.establishment_group,
    s.phase,
    s.gender,
    s.religious_character,
    s.is_selective,
    s.has_sixth_form,
    s.capacity,
    s.postcode,
    s.lat,
    s.lng,
    s.website,
    s.status,

    -- Latest Ofsted
    i.inspection_date        AS ofsted_date,
    i.overall_effectiveness_legacy AS ofsted_overall,
    i.quality_of_education   AS ofsted_quality,
    i.behaviour_attitudes    AS ofsted_behaviour,
    i.personal_development   AS ofsted_personal,
    i.leadership_management  AS ofsted_leadership,
    i.sixth_form_provision   AS ofsted_sixth_form,

    -- Latest KS2
    k2.academic_year         AS ks2_year,
    k2.pct_expected_rwm,
    k2.pct_greater_depth_rwm,
    k2.progress_reading,
    k2.progress_writing,
    k2.progress_maths,
    k2.suppressed            AS ks2_suppressed,

    -- Latest KS4
    k4.academic_year         AS ks4_year,
    k4.cohort_size           AS ks4_cohort,
    k4.attainment_8,
    k4.progress_8,
    k4.progress_8_lower_ci,
    k4.progress_8_upper_ci,
    k4.pct_grade5_english_maths,
    k4.pct_grade4_english_maths,
    k4.ebacc_avg_points,
    k4.suppressed            AS ks4_suppressed,

    -- Latest KS5
    k5.academic_year         AS ks5_year,
    k5.alevel_cohort,
    k5.avg_points_per_alevel_entry,
    k5.pct_astar_to_e,
    k5.pct_astar_to_b,
    k5.pct_astar_or_a,
    k5.suppressed            AS ks5_suppressed,

    -- Latest KS4 destinations
    d4.cohort_year           AS dest_ks4_cohort_year,
    d4.pct_sustained         AS dest_ks4_pct_sustained,
    d4.pct_school_sixth_form,
    d4.pct_sixth_form_college,
    d4.pct_fe_college,
    d4.pct_apprenticeship    AS dest_ks4_pct_apprenticeship,

    -- Latest KS5 destinations
    d5.cohort_year           AS dest_ks5_cohort_year,
    d5.pct_sustained         AS dest_ks5_pct_sustained,
    d5.pct_higher_education,
    d5.pct_apprenticeship_l3 AS dest_ks5_pct_apprenticeship,

    -- Pupils
    p.academic_year          AS pupils_year,
    p.total_pupils,
    p.pct_fsm6,
    p.pct_sen_ehcp,
    p.pct_eal,
    p.pct_absence_overall,

    -- Workforce
    w.pupil_teacher_ratio,
    w.fte_teachers,
    w.pct_qualified_teachers,
    w.high_staff_turnover,

    -- Financials
    f.financial_year,
    f.income_per_pupil,
    f.expenditure_per_pupil,
    f.balance_per_pupil,
    f.in_deficit

FROM schools s
LEFT JOIN LATERAL (
    SELECT * FROM inspections WHERE urn = s.urn ORDER BY inspection_date DESC LIMIT 1
) i ON true
LEFT JOIN LATERAL (
    SELECT * FROM performance_ks2 WHERE urn = s.urn ORDER BY academic_year DESC LIMIT 1
) k2 ON true
LEFT JOIN LATERAL (
    SELECT * FROM performance_ks4 WHERE urn = s.urn ORDER BY academic_year DESC LIMIT 1
) k4 ON true
LEFT JOIN LATERAL (
    SELECT * FROM performance_ks5 WHERE urn = s.urn ORDER BY academic_year DESC LIMIT 1
) k5 ON true
LEFT JOIN LATERAL (
    SELECT * FROM destinations_ks4 WHERE urn = s.urn ORDER BY cohort_year DESC LIMIT 1
) d4 ON true
LEFT JOIN LATERAL (
    SELECT * FROM destinations_ks5 WHERE urn = s.urn ORDER BY cohort_year DESC LIMIT 1
) d5 ON true
LEFT JOIN LATERAL (
    SELECT * FROM pupils WHERE urn = s.urn ORDER BY academic_year DESC LIMIT 1
) p ON true
LEFT JOIN LATERAL (
    SELECT * FROM workforce WHERE urn = s.urn ORDER BY academic_year DESC LIMIT 1
) w ON true
LEFT JOIN LATERAL (
    SELECT * FROM financials WHERE urn = s.urn ORDER BY financial_year DESC LIMIT 1
) f ON true
WHERE s.status IN ('Open', 'Open, but proposed to close')
WITH DATA
    """)

    op.execute("CREATE UNIQUE INDEX ON school_summary_latest (urn)")


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS school_summary_latest")
