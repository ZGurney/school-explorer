from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, text

from school_explorer.api.deps import DbSession
from school_explorer.api.schemas import (
    DestKS4Record,
    DestKS5Record,
    FinancialsRecord,
    InspectionRecord,
    KS2Record,
    KS4Record,
    KS5Record,
    PupilsRecord,
    SchoolDetail,
    WorkforceRecord,
)
from school_explorer.models import (
    DestinationsKS4,
    DestinationsKS5,
    Financials,
    Inspection,
    PerformanceKS2,
    PerformanceKS4,
    PerformanceKS5,
    Pupils,
    School,
    Workforce,
)

router = APIRouter()

_DETAIL_COLS = """
    urn, name, la_name, la_code, establishment_group, phase, gender,
    religious_character, is_selective, has_sixth_form, postcode, lat, lng, capacity,
    ofsted_date, ofsted_overall,
    ofsted_quality, ofsted_behaviour, ofsted_personal, ofsted_leadership, ofsted_sixth_form,
    attainment_8, progress_8, progress_8_lower_ci, progress_8_upper_ci,
    pct_grade5_english_maths, pct_grade4_english_maths, ebacc_avg_points,
    ks4_suppressed, ks4_year, ks4_cohort,
    avg_points_per_alevel_entry, pct_astar_to_b, pct_astar_to_e, pct_astar_or_a,
    ks5_suppressed, ks5_year,
    pct_expected_rwm, ks2_suppressed, ks2_year,
    dest_ks4_pct_sustained, dest_ks5_pct_sustained,
    total_pupils, pct_fsm6, pct_eal, pct_sen_ehcp, pct_absence_overall,
    pupil_teacher_ratio, fte_teachers, pct_qualified_teachers,
    financial_year, income_per_pupil, expenditure_per_pupil, balance_per_pupil, in_deficit
"""


def _fetch_school_detail(db: DbSession, urn: int) -> Optional[SchoolDetail]:
    view_row = db.execute(
        text(f"SELECT {_DETAIL_COLS} FROM school_summary_latest WHERE urn = :urn"),
        {"urn": urn},
    ).fetchone()
    if not view_row:
        return None

    school = db.execute(
        select(School).where(School.urn == urn)
    ).scalar_one_or_none()
    if not school:
        return None

    data = dict(view_row._mapping)
    data["street"] = school.street
    data["locality"] = school.locality
    data["town"] = school.town
    data["website"] = school.website
    data["telephone"] = school.telephone
    data["headteacher_name"] = school.headteacher_name
    data["open_date"] = school.open_date

    inspections = db.execute(
        select(Inspection).where(Inspection.urn == urn).order_by(Inspection.inspection_date.desc())
    ).scalars().all()

    ks4_rows = db.execute(
        select(PerformanceKS4).where(PerformanceKS4.urn == urn).order_by(PerformanceKS4.academic_year.desc())
    ).scalars().all()

    ks5_rows = db.execute(
        select(PerformanceKS5).where(PerformanceKS5.urn == urn).order_by(PerformanceKS5.academic_year.desc())
    ).scalars().all()

    ks2_rows = db.execute(
        select(PerformanceKS2).where(PerformanceKS2.urn == urn).order_by(PerformanceKS2.academic_year.desc())
    ).scalars().all()

    dest_ks4_rows = db.execute(
        select(DestinationsKS4).where(DestinationsKS4.urn == urn).order_by(DestinationsKS4.cohort_year.desc())
    ).scalars().all()

    dest_ks5_rows = db.execute(
        select(DestinationsKS5).where(DestinationsKS5.urn == urn).order_by(DestinationsKS5.cohort_year.desc())
    ).scalars().all()

    pupils_rows = db.execute(
        select(Pupils).where(Pupils.urn == urn).order_by(Pupils.academic_year.desc())
    ).scalars().all()

    workforce_rows = db.execute(
        select(Workforce).where(Workforce.urn == urn).order_by(Workforce.academic_year.desc())
    ).scalars().all()

    financials_rows = db.execute(
        select(Financials).where(Financials.urn == urn).order_by(Financials.financial_year.desc())
    ).scalars().all()

    detail = SchoolDetail.model_validate(data)
    detail.inspections = [InspectionRecord.model_validate(i) for i in inspections]
    detail.performance_ks4_history = [KS4Record.model_validate(r) for r in ks4_rows]
    detail.performance_ks5_history = [KS5Record.model_validate(r) for r in ks5_rows]
    detail.performance_ks2_history = [KS2Record.model_validate(r) for r in ks2_rows]
    detail.destinations_ks4_history = [DestKS4Record.model_validate(r) for r in dest_ks4_rows]
    detail.destinations_ks5_history = [DestKS5Record.model_validate(r) for r in dest_ks5_rows]
    detail.pupils_history = [PupilsRecord.model_validate(r) for r in pupils_rows]
    detail.workforce_history = [WorkforceRecord.model_validate(r) for r in workforce_rows]
    detail.financials_history = [FinancialsRecord.model_validate(r) for r in financials_rows]

    return detail


@router.get("/schools/{urn}", response_model=SchoolDetail)
def get_school(urn: int, db: DbSession):
    detail = _fetch_school_detail(db, urn)
    if not detail:
        raise HTTPException(status_code=404, detail=f"School {urn} not found")
    return detail


@router.get("/schools/{urn}/compare", response_model=list[SchoolDetail])
def compare_schools(
    urn: int,
    db: DbSession,
    urns: str = Query(..., description="Comma-separated list of URNs to compare (max 5)"),
):
    all_urns = [urn] + [int(u.strip()) for u in urns.split(",") if u.strip()]
    all_urns = list(dict.fromkeys(all_urns))[:5]

    results = []
    for u in all_urns:
        detail = _fetch_school_detail(db, u)
        if detail:
            results.append(detail)
    return results
