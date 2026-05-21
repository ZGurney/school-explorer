from fastapi import APIRouter
from sqlalchemy import text

from school_explorer.api.deps import DbSession
from school_explorer.api.schemas import BenchmarkSummary

router = APIRouter()


@router.get("/benchmarks", response_model=BenchmarkSummary)
def get_benchmarks(db: DbSession):
    row = db.execute(text("""
        SELECT
          AVG(pct_expected_rwm) FILTER (
            WHERE phase = 'Primary' AND NOT COALESCE(ks2_suppressed, false)
          ) AS ks2_pct_expected_rwm,
          AVG(attainment_8) FILTER (
            WHERE phase IN ('Secondary','All-through') AND NOT COALESCE(ks4_suppressed, false)
          ) AS ks4_attainment_8,
          AVG(progress_8) FILTER (
            WHERE phase IN ('Secondary','All-through') AND NOT COALESCE(ks4_suppressed, false)
          ) AS ks4_progress_8,
          AVG(pct_grade5_english_maths) FILTER (
            WHERE phase IN ('Secondary','All-through') AND NOT COALESCE(ks4_suppressed, false)
          ) AS ks4_pct_grade5_english_maths,
          AVG(avg_points_per_alevel_entry) FILTER (
            WHERE NOT COALESCE(ks5_suppressed, false)
          ) AS ks5_avg_points
        FROM school_summary_latest
    """)).fetchone()
    return BenchmarkSummary.model_validate(dict(row._mapping))
