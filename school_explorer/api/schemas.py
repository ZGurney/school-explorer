from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class InspectionRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    inspection_date: date
    publication_date: Optional[date] = None
    inspection_type: Optional[str] = None
    overall_effectiveness_legacy: Optional[str] = None
    quality_of_education: Optional[str] = None
    behaviour_attitudes: Optional[str] = None
    personal_development: Optional[str] = None
    leadership_management: Optional[str] = None
    sixth_form_provision: Optional[str] = None
    early_years_provision: Optional[str] = None
    report_url: Optional[str] = None


class KS2Record(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    academic_year: str
    cohort_size: Optional[int] = None
    pct_expected_rwm: Optional[float] = None
    pct_greater_depth_rwm: Optional[float] = None
    progress_reading: Optional[float] = None
    progress_writing: Optional[float] = None
    progress_maths: Optional[float] = None
    avg_scaled_score_reading: Optional[float] = None
    avg_scaled_score_maths: Optional[float] = None
    suppressed: bool = False


class KS4Record(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    academic_year: str
    cohort_size: Optional[int] = None
    attainment_8: Optional[float] = None
    progress_8: Optional[float] = None
    progress_8_lower_ci: Optional[float] = None
    progress_8_upper_ci: Optional[float] = None
    pct_grade5_english_maths: Optional[float] = None
    pct_grade4_english_maths: Optional[float] = None
    ebacc_avg_points: Optional[float] = None
    pct_entering_ebacc: Optional[float] = None
    pct_achieving_ebacc_strong: Optional[float] = None
    suppressed: bool = False


class KS5Record(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    academic_year: str
    total_cohort: Optional[int] = None
    alevel_cohort: Optional[int] = None
    avg_points_per_entry: Optional[float] = None
    avg_points_per_alevel_entry: Optional[float] = None
    pct_astar_to_e: Optional[float] = None
    pct_astar_to_b: Optional[float] = None
    pct_astar_or_a: Optional[float] = None
    suppressed: bool = False


class DestKS4Record(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cohort_year: str
    destination_year: str
    cohort_size: Optional[int] = None
    pct_sustained: Optional[float] = None
    pct_school_sixth_form: Optional[float] = None
    pct_sixth_form_college: Optional[float] = None
    pct_fe_college: Optional[float] = None
    pct_other_education: Optional[float] = None
    pct_apprenticeship: Optional[float] = None
    pct_employment: Optional[float] = None
    pct_not_captured: Optional[float] = None


class DestKS5Record(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cohort_year: str
    destination_year: str
    cohort_size: Optional[int] = None
    pct_sustained: Optional[float] = None
    pct_higher_education: Optional[float] = None
    pct_further_education: Optional[float] = None
    pct_apprenticeship_l2: Optional[float] = None
    pct_apprenticeship_l3: Optional[float] = None
    pct_apprenticeship_l4_plus: Optional[float] = None
    pct_employment: Optional[float] = None
    pct_not_captured: Optional[float] = None


class PupilsRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    academic_year: str
    total_pupils: Optional[int] = None
    boys: Optional[int] = None
    girls: Optional[int] = None
    pct_fsm6: Optional[float] = None
    pct_fsm_eligible: Optional[float] = None
    pct_sen_ehcp: Optional[float] = None
    pct_sen_support: Optional[float] = None
    pct_eal: Optional[float] = None
    pct_absence_overall: Optional[float] = None
    pct_persistent_absence: Optional[float] = None


class WorkforceRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    academic_year: str
    fte_teachers: Optional[float] = None
    fte_support_staff: Optional[float] = None
    pupil_teacher_ratio: Optional[float] = None
    pct_qualified_teachers: Optional[float] = None
    high_staff_turnover: Optional[bool] = None


class FinancialsRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    financial_year: str
    funding_type: Optional[str] = None
    income_per_pupil: Optional[int] = None
    expenditure_per_pupil: Optional[int] = None
    balance_per_pupil: Optional[int] = None
    pct_teaching_staff_expenditure: Optional[float] = None
    in_deficit: Optional[bool] = None


class SchoolSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    urn: int
    name: str
    la_name: Optional[str] = None
    la_code: Optional[str] = None
    establishment_group: Optional[str] = None
    phase: Optional[str] = None
    gender: Optional[str] = None
    religious_character: Optional[str] = None
    is_selective: bool = False
    has_sixth_form: bool = False
    postcode: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

    # Ofsted
    ofsted_date: Optional[date] = None
    ofsted_overall: Optional[str] = None
    ofsted_quality: Optional[str] = None
    ofsted_behaviour: Optional[str] = None
    ofsted_personal: Optional[str] = None
    ofsted_leadership: Optional[str] = None

    # KS4
    attainment_8: Optional[float] = None
    progress_8: Optional[float] = None
    pct_grade5_english_maths: Optional[float] = None
    ks4_suppressed: Optional[bool] = None

    # KS5
    avg_points_per_alevel_entry: Optional[float] = None
    pct_astar_or_a: Optional[float] = None
    ks5_suppressed: Optional[bool] = None

    # KS2
    pct_expected_rwm: Optional[float] = None
    ks2_suppressed: Optional[bool] = None

    # Pupils
    total_pupils: Optional[int] = None
    pct_fsm6: Optional[float] = None
    distance_km: Optional[float] = None


class SchoolDetail(SchoolSummary):
    # Extra school fields
    street: Optional[str] = None
    locality: Optional[str] = None
    town: Optional[str] = None
    website: Optional[str] = None
    telephone: Optional[str] = None
    headteacher_name: Optional[str] = None
    open_date: Optional[date] = None
    capacity: Optional[int] = None
    establishment_type: Optional[str] = None

    # All sub-judgements for detail view
    ofsted_sixth_form: Optional[str] = None

    # Full KS4
    ks4_year: Optional[str] = None
    ks4_cohort: Optional[int] = None
    progress_8_lower_ci: Optional[float] = None
    progress_8_upper_ci: Optional[float] = None
    pct_grade4_english_maths: Optional[float] = None
    ebacc_avg_points: Optional[float] = None

    # Full KS5
    ks5_year: Optional[str] = None
    pct_astar_to_b: Optional[float] = None
    pct_astar_to_e: Optional[float] = None

    # KS2
    ks2_year: Optional[str] = None

    # Destinations latest
    dest_ks4_pct_sustained: Optional[float] = None
    dest_ks5_pct_sustained: Optional[float] = None

    # Pupils latest
    pct_eal: Optional[float] = None
    pct_sen_ehcp: Optional[float] = None
    pct_absence_overall: Optional[float] = None

    # Workforce latest
    pupil_teacher_ratio: Optional[float] = None
    fte_teachers: Optional[float] = None
    pct_qualified_teachers: Optional[float] = None

    # Financials latest
    financial_year: Optional[str] = None
    income_per_pupil: Optional[int] = None
    expenditure_per_pupil: Optional[int] = None
    balance_per_pupil: Optional[int] = None
    in_deficit: Optional[bool] = None

    # Time-series histories
    inspections: list[InspectionRecord] = []
    performance_ks4_history: list[KS4Record] = []
    performance_ks5_history: list[KS5Record] = []
    performance_ks2_history: list[KS2Record] = []
    destinations_ks4_history: list[DestKS4Record] = []
    destinations_ks5_history: list[DestKS5Record] = []
    pupils_history: list[PupilsRecord] = []
    workforce_history: list[WorkforceRecord] = []
    financials_history: list[FinancialsRecord] = []


class PaginatedSchools(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[SchoolSummary]


class BenchmarkSummary(BaseModel):
    ks2_pct_expected_rwm: Optional[float] = None
    ks4_attainment_8: Optional[float] = None
    ks4_progress_8: Optional[float] = None
    ks4_pct_grade5_english_maths: Optional[float] = None
    ks5_avg_points: Optional[float] = None


class BoroughSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    la_code: str
    la_name: str


class RefreshStatus(BaseModel):
    source_name: str
    target_table: str
    academic_year: str
    status: str
    rows_loaded: Optional[int] = None
    run_at: Optional[str] = None
    completed_at: Optional[str] = None
