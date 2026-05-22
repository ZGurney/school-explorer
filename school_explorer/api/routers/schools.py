from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from school_explorer.api.deps import DbSession, PaginationParams
from school_explorer.api.schemas import PaginatedSchools, SchoolMapPoint, SchoolMapResponse, SchoolSummary

router = APIRouter()
MAP_RESULT_LIMIT = 5000
LONDON_BBOX = {
    "min_lat": 51.28,
    "max_lat": 51.70,
    "min_lng": -0.51,
    "max_lng": 0.33,
}

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
    establishment_groups: Optional[str],
    has_sixth_form: Optional[bool],
    is_selective: Optional[bool],
    gender: Optional[str],
    faith_only: Optional[bool],
    ofsted_rating: Optional[str],
    lat: Optional[float],
    lng: Optional[float],
    radius_km: float,
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
    if establishment_groups:
        groups = [g.strip() for g in establishment_groups.split(",") if g.strip()]
        if groups:
            clauses.append("establishment_group = ANY(:establishment_groups)")
            params["establishment_groups"] = groups
    if has_sixth_form is not None:
        clauses.append("has_sixth_form = :has_sixth_form")
        params["has_sixth_form"] = has_sixth_form
    if is_selective is not None:
        clauses.append("is_selective = :is_selective")
        params["is_selective"] = is_selective
    if gender:
        clauses.append("gender = :gender")
        params["gender"] = gender
    if faith_only is True:
        clauses.append("""
            religious_character IS NOT NULL
            AND religious_character <> ''
            AND religious_character NOT IN ('None', 'Does not apply', 'No religious character')
        """)
    if ofsted_rating == "good_or_better":
        clauses.append("COALESCE(ofsted_overall, ofsted_quality, ofsted_leadership) IN ('Outstanding', 'Good')")
    elif ofsted_rating in {"Outstanding", "Good", "Requires improvement", "Inadequate"}:
        clauses.append("COALESCE(ofsted_overall, ofsted_quality, ofsted_leadership) = :ofsted_rating")
        params["ofsted_rating"] = ofsted_rating
    if lat is not None and lng is not None:
        clauses.append("""
            lat IS NOT NULL AND lng IS NOT NULL AND
            6371 * acos(LEAST(1.0,
                cos(radians(:lat)) * cos(radians(lat)) * cos(radians(lng) - radians(:lng)) +
                sin(radians(:lat)) * sin(radians(lat))
            )) <= :radius_km
        """)
        params["lat"] = lat
        params["lng"] = lng
        params["radius_km"] = radius_km

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
    faith_only: Optional[bool] = Query(None),
    ofsted_rating: Optional[str] = Query(None),
    establishment_groups: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    radius_km: float = Query(2.0, gt=0, le=50),
    sort_by: Optional[str] = Query(None),
):
    has_location = lat is not None and lng is not None
    where, params = _build_where(
        q,
        borough,
        phase,
        establishment_group,
        establishment_groups,
        has_sixth_form,
        is_selective,
        gender,
        faith_only,
        ofsted_rating,
        lat,
        lng,
        radius_km,
    )
    order = "distance_km ASC NULLS LAST, name ASC" if has_location and not sort_by else _SORTABLE.get(sort_by or "", _SORTABLE["name"])
    distance_col = """,
        6371 * acos(LEAST(1.0,
            cos(radians(:lat)) * cos(radians(lat)) * cos(radians(lng) - radians(:lng)) +
            sin(radians(:lat)) * sin(radians(lat))
        )) AS distance_km
    """ if has_location else ", NULL::float AS distance_km"

    count_sql = text(f"SELECT COUNT(*) FROM school_summary_latest {where}")
    total = db.execute(count_sql, params).scalar() or 0

    data_sql = text(f"""
        SELECT {_SUMMARY_COLS}{distance_col}
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


@router.get("/schools/map", response_model=SchoolMapResponse)
def map_schools(
    db: DbSession,
    q: Optional[str] = Query(None),
    borough: Optional[str] = Query(None),
    phase: Optional[str] = Query(None),
    establishment_group: Optional[str] = Query(None),
    has_sixth_form: Optional[bool] = Query(None),
    is_selective: Optional[bool] = Query(None),
    gender: Optional[str] = Query(None),
    faith_only: Optional[bool] = Query(None),
    ofsted_rating: Optional[str] = Query(None),
    establishment_groups: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    radius_km: float = Query(2.0, gt=0, le=50),
    within_radius: bool = Query(False),
):
    has_location = lat is not None and lng is not None
    filter_lat = lat if has_location and within_radius else None
    filter_lng = lng if has_location and within_radius else None
    where, params = _build_where(
        q,
        borough,
        phase,
        establishment_group,
        establishment_groups,
        has_sixth_form,
        is_selective,
        gender,
        faith_only,
        ofsted_rating,
        filter_lat,
        filter_lng,
        radius_km,
    )

    location_clause = "lat IS NOT NULL AND lng IS NOT NULL"
    where = f"{where} AND {location_clause}" if where else f"WHERE {location_clause}"
    where += """
        AND lat BETWEEN :min_lat AND :max_lat
        AND lng BETWEEN :min_lng AND :max_lng
    """
    params.update(LONDON_BBOX)
    if has_location:
        params["lat"] = lat
        params["lng"] = lng
    order = "distance_km ASC NULLS LAST, name ASC" if has_location else "name ASC"
    distance_col = """,
        6371 * acos(LEAST(1.0,
            cos(radians(:lat)) * cos(radians(lat)) * cos(radians(lng) - radians(:lng)) +
            sin(radians(:lat)) * sin(radians(lat))
        )) AS distance_km
    """ if has_location else ", NULL::float AS distance_km"

    total = db.execute(text(f"SELECT COUNT(*) FROM school_summary_latest {where}"), params).scalar() or 0

    sql = text(f"""
        SELECT
            urn, name, la_name, establishment_group, phase,
            is_selective, has_sixth_form, postcode, lat, lng,
            ofsted_date, ofsted_overall, ofsted_quality, ofsted_leadership,
            attainment_8, avg_points_per_alevel_entry, pct_expected_rwm,
            total_pupils
            {distance_col}
        FROM school_summary_latest
        {where}
        ORDER BY {order}
        LIMIT :limit
    """)

    params["limit"] = MAP_RESULT_LIMIT
    rows = db.execute(sql, params).fetchall()
    results = [SchoolMapPoint.model_validate(dict(r._mapping)) for r in rows]
    return SchoolMapResponse(
        total=total,
        limit=MAP_RESULT_LIMIT,
        truncated=total > MAP_RESULT_LIMIT,
        results=results,
    )
