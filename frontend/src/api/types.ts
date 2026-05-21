export interface SchoolSummary {
  urn: number
  name: string
  la_name: string | null
  la_code: string | null
  establishment_group: string | null
  phase: string | null
  gender: string | null
  religious_character: string | null
  is_selective: boolean
  has_sixth_form: boolean
  postcode: string | null
  lat: number | null
  lng: number | null
  ofsted_date: string | null
  ofsted_overall: string | null
  ofsted_quality: string | null
  ofsted_behaviour: string | null
  ofsted_personal: string | null
  ofsted_leadership: string | null
  attainment_8: number | null
  progress_8: number | null
  pct_grade5_english_maths: number | null
  ks4_suppressed: boolean | null
  avg_points_per_alevel_entry: number | null
  pct_astar_or_a: number | null
  ks5_suppressed: boolean | null
  pct_expected_rwm: number | null
  ks2_suppressed: boolean | null
  total_pupils: number | null
  pct_fsm6: number | null
  distance_km: number | null
}

export interface InspectionRecord {
  id: number
  inspection_date: string
  publication_date: string | null
  inspection_type: string | null
  overall_effectiveness_legacy: string | null
  quality_of_education: string | null
  behaviour_attitudes: string | null
  personal_development: string | null
  leadership_management: string | null
  sixth_form_provision: string | null
  early_years_provision: string | null
  report_url: string | null
}

export interface KS4Record {
  academic_year: string
  cohort_size: number | null
  attainment_8: number | null
  progress_8: number | null
  progress_8_lower_ci: number | null
  progress_8_upper_ci: number | null
  pct_grade5_english_maths: number | null
  pct_grade4_english_maths: number | null
  ebacc_avg_points: number | null
  suppressed: boolean
}

export interface KS5Record {
  academic_year: string
  total_cohort: number | null
  alevel_cohort: number | null
  avg_points_per_entry: number | null
  avg_points_per_alevel_entry: number | null
  pct_astar_to_e: number | null
  pct_astar_to_b: number | null
  pct_astar_or_a: number | null
  suppressed: boolean
}

export interface KS2Record {
  academic_year: string
  cohort_size: number | null
  pct_expected_rwm: number | null
  pct_greater_depth_rwm: number | null
  progress_reading: number | null
  progress_writing: number | null
  progress_maths: number | null
  suppressed: boolean
}

export interface DestKS4Record {
  cohort_year: string
  destination_year: string
  cohort_size: number | null
  pct_sustained: number | null
  pct_school_sixth_form: number | null
  pct_sixth_form_college: number | null
  pct_fe_college: number | null
  pct_other_education: number | null
  pct_apprenticeship: number | null
  pct_employment: number | null
  pct_not_captured: number | null
}

export interface DestKS5Record {
  cohort_year: string
  destination_year: string
  cohort_size: number | null
  pct_sustained: number | null
  pct_higher_education: number | null
  pct_further_education: number | null
  pct_apprenticeship_l2: number | null
  pct_apprenticeship_l3: number | null
  pct_apprenticeship_l4_plus: number | null
  pct_employment: number | null
  pct_not_captured: number | null
}

export interface PupilsRecord {
  academic_year: string
  total_pupils: number | null
  boys: number | null
  girls: number | null
  pct_fsm6: number | null
  pct_fsm_eligible: number | null
  pct_sen_ehcp: number | null
  pct_sen_support: number | null
  pct_eal: number | null
  pct_absence_overall: number | null
  pct_persistent_absence: number | null
}

export interface WorkforceRecord {
  academic_year: string
  fte_teachers: number | null
  fte_support_staff: number | null
  pupil_teacher_ratio: number | null
  pct_qualified_teachers: number | null
  high_staff_turnover: boolean | null
}

export interface FinancialsRecord {
  financial_year: string
  funding_type: string | null
  income_per_pupil: number | null
  expenditure_per_pupil: number | null
  balance_per_pupil: number | null
  pct_teaching_staff_expenditure: number | null
  in_deficit: boolean | null
}

export interface SchoolDetail extends SchoolSummary {
  street: string | null
  locality: string | null
  town: string | null
  website: string | null
  telephone: string | null
  headteacher_name: string | null
  open_date: string | null
  capacity: number | null
  establishment_type: string | null
  ofsted_sixth_form: string | null
  ks4_year: string | null
  ks4_cohort: number | null
  progress_8_lower_ci: number | null
  progress_8_upper_ci: number | null
  pct_grade4_english_maths: number | null
  ebacc_avg_points: number | null
  ks5_year: string | null
  pct_astar_to_b: number | null
  pct_astar_to_e: number | null
  ks2_year: string | null
  dest_ks4_pct_sustained: number | null
  dest_ks5_pct_sustained: number | null
  pct_eal: number | null
  pct_sen_ehcp: number | null
  pct_absence_overall: number | null
  pupil_teacher_ratio: number | null
  fte_teachers: number | null
  pct_qualified_teachers: number | null
  financial_year: string | null
  income_per_pupil: number | null
  expenditure_per_pupil: number | null
  balance_per_pupil: number | null
  in_deficit: boolean | null
  inspections: InspectionRecord[]
  performance_ks4_history: KS4Record[]
  performance_ks5_history: KS5Record[]
  performance_ks2_history: KS2Record[]
  destinations_ks4_history: DestKS4Record[]
  destinations_ks5_history: DestKS5Record[]
  pupils_history: PupilsRecord[]
  workforce_history: WorkforceRecord[]
  financials_history: FinancialsRecord[]
}

export interface PaginatedSchools {
  total: number
  page: number
  page_size: number
  results: SchoolSummary[]
}

export interface Borough {
  la_code: string
  la_name: string
}

export interface SchoolFilters {
  q?: string
  borough?: string
  phase?: string
  establishment_group?: string
  has_sixth_form?: boolean
  is_selective?: boolean
  gender?: string
  faith_only?: boolean
  establishment_groups?: string
  lat?: number
  lng?: number
  radius_km?: number
  sort_by?: string
  page?: number
  page_size?: number
}

export interface BenchmarkSummary {
  ks2_pct_expected_rwm: number | null
  ks4_attainment_8: number | null
  ks4_progress_8: number | null
  ks4_pct_grade5_english_maths: number | null
  ks5_avg_points: number | null
}
