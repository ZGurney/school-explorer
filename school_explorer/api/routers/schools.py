from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from school_explorer.api.deps import DbSession, PaginationParams
from school_explorer.api.schemas import PaginatedSchools, SchoolSummary

router = APIRouter()

_SUMMARY_COLS = """
    urn, name, la_name, la_code, establishment_group, phase, gender, religious_character,
    is_selective, has_sixth_form, postcode, lat, lng,
    ofsted_date, ofsted_overall,
    ofsted_quality, ofsted_behaviour, ofsted_personal, ofsted_leadership,
    attainment_8, progress_8, pct_grade5_english_maths, ks4_suppressed,
    avg_points_per_alevel_entry, pct_astar_or_a, ks5_suppressed,
    pct_expected_rwm, ks2_suppressed,
    total_pupils, pct_fsm6
"""


def _build_where(
    q: Optional[str],
    borough: Optional[str],
    phase: Optional[str],
    establishment_group: Optional[str],
    has_sixth_form: Optional[bool],
    is_selective: Optional[bool],
    gender: Optional[str],
) -> tuple[str, dict]:
    clauses = []
    params: dict = {}

    if q:
        clauses.append("name ILIKE :q")
        params["q"] = f"%{q}%"
    if borough:
        clauses.append("la_code = :borough")
        params["borough"] = borough
    if phase:
        clauses.append("phase = :phase")
        params["phase"] = phase
    if establishment_group:
        clauses.append("establishment_group = :establishment_group")
        params["establishment_group"] = establishment_group
    if has_sixth_form is not None:
        clauses.append("has_sixth_form = :has_sixth_form")
        params["has_sixth_form"] = has_sixth_form
    if is_selective is not None:
        clauses.append("is_selective = :is_selective")
        params["is_selective"] = is_selective
    if gender:
        clauses.append("gender = :gender")
        params["gender"] = gender

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


_SORTABLE = {
    "name": "name ASC",
    "progress_8": "progress_8 DESC NULLS LAST",
    "attainment_8": "attainment_8 DESC NULLS LAST",
    "pct_grade5_english_maths": "pct_grade5_english_maths DESC NULLS LAST",
    "pct_expected_rwm": "pct_expected_rwm DESC NULLS LAST",
    "avg_points_per_alevel_entry": "avg_points_per_alevel_entry DESC NULLS LAST",
    "pct_astar_or_a": "pct_astar_or_a DESC NULLS LAST",
    "total_pupils": "total_pupils DESC NULLS LAST",
    "pct_fsm6": "pct_fsm6 DESC NULLS LAST",
    "ofsted_overall": (
        "CASE COALESCE(ofsted_overall, ofsted_leadership) "
        "WHEN 'Outstanding' THEN 1 WHEN 'Good' THEN 2 "
        "WHEN 'Requires improvement' THEN 3 WHEN 'Inadequate' THEN 4 "
        "ELSE 5 END ASC, name ASC"
    ),
}


@router.get("/schools", response_model=PaginatedSchools)
def list_schools(
    db: DbSession,
    pagination: Annotated[PaginationParams, Depends()],
    q: Optional[str] = Query(None),
    borough: Optional[str] = Query(None),
    phase: Optional[str] = Query(None),
    establishment_group: Optional[str] = Query(None),
    has_sixth_form: Optional[bool] = Query(None),
    is_selective: Optional[bool] = Query(None),
    gender: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
):
    where, params = _build_where(q, borough, phase, establishment_group, has_sixth_form, is_selective, gender)
    order = _SORTABLE.get(sort_by or "", _SORTABLE["name"])

    count_sql = text(f"SELECT COUNT(*) FROM school_summary_latest {where}")
    total = db.execute(count_sql, params).scalar() or 0

    data_sql = text(f"""
        SELECT {_SUMMARY_COLS}
        FROM school_summary_latest
        {where}
        ORDER BY {order}
        LIMIT :limit OFFSET :offset
    """)
    params["limit"] = pagination.limit
    params["offset"] = pagination.offset

    rows = db.execute(data_sql, params).fetchall()
    results = [SchoolSummary.model_validate(dict(r._mapping)) for r in rows]

    return PaginatedSchools(
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        results=results,
    )
