# School Explorer — Claude Code Agent Brief

## Project overview

A London-wide school data explorer covering primary, secondary, grammar, independent,
and sixth-form schools. Data is sourced from public DfE datasets (GIAS, Ofsted,
EES performance tables, FBIT) and exposed via a FastAPI backend + React frontend.

**Stack:**
- Python 3.11+ managed with **uv**
- PostgreSQL 15+ (local dev; cloud-hosted later)
- SQLAlchemy 2.0 ORM with Alembic migrations
- FastAPI + Uvicorn (API layer — to be built)
- React + TypeScript + Vite (frontend — to be built)

---

## Work phases

### Phase 1 — Migrate to uv and audit the ETL pipeline (do this first)
### Phase 2 — Build the FastAPI backend
### Phase 3 — Build the React frontend

Complete each phase fully and verify it before moving to the next.

---

## Phase 1 — Migrate to uv and fix the ETL pipeline

### 1.1 Migrate to uv

The project currently uses setuptools. Replace it with uv.

**Steps:**

1. If `uv` is not installed: `curl -LsSf https://astral.sh/uv/install.sh | sh`

2. Replace the `[build-system]` block in `pyproject.toml` with:
   ```toml
   [build-system]
   requires = ["hatchling"]
   build-backend = "hatchling.build"
   ```

3. Add a `[tool.hatch.build.targets.wheel]` section so hatchling finds the package:
   ```toml
   [tool.hatch.build.targets.wheel]
   packages = ["school_explorer"]
   ```

4. Add uv lock and sync commands to the README. The workflow becomes:
   ```bash
   uv sync           # install all deps from lockfile
   uv sync --extra dev  # include dev deps
   uv run python scripts/run_etl.py run-all
   ```

5. Generate the lockfile: `uv lock`

6. Update the README setup section to use uv commands throughout. Remove all
   `pip install` references.

7. The `school-etl` entry point in pyproject.toml currently references
   `scripts.run_etl:cli`. The `scripts/` directory has no `__init__.py` so this
   won't resolve as a package entry point. Fix by either:
   - Adding `scripts/__init__.py` (preferred), OR
   - Moving the CLI into `school_explorer/cli.py` and updating the entry point to
     `school_explorer.cli:cli`

### 1.2 Known bugs to fix

Fix all of the following. Verify each fix before continuing.

---

**Bug 1 — Missing destinations ingestors**

`etl/destinations_ks4.py` and `etl/destinations_ks5.py` do not exist.
The models (`DestinationsKS4`, `DestinationsKS5`) are defined in
`school_explorer/models/destinations.py` but there are no corresponding ETL files.

Create both ingestors following the same pattern as `etl/ks4.py` and `etl/ks5.py`.

Sources:
- KS4 destinations: `https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-destination-measures`
- KS5 destinations: `https://explore-education-statistics.service.gov.uk/find-statistics/16-18-destination-measures`

Both are EES ZIP downloads with institution-level CSVs. The KS4 file contains one
row per school with columns for each destination type (sixth form, college, FE,
apprenticeship, employment, not captured). The KS5 file similarly covers HE, FE,
apprenticeship levels, employment.

Register both ingestors in:
- `school_explorer/etl/__init__.py`
- `scripts/run_etl.py` — add `"destinations_ks4"` and `"destinations_ks5"` to `INGESTORS`
  in the correct position (after `ks5`, before `workforce`)

---

**Bug 2 — `DataRefresh` unique constraint blocks repeat runs**

In `school_explorer/models/refresh.py`:
```python
__table_args__ = (
    UniqueConstraint("source_name", "academic_year", name="uq_refresh_source_year"),
)
```

This means running the same source twice (e.g. re-running GIAS after a code fix)
raises a unique constraint violation on the second run. The intent is to log every
run, not just one per source.

**Fix:** Remove the `UniqueConstraint` from `DataRefresh`. Each run gets its own row.
If you need "latest run per source" queries, do that at query time with
`ORDER BY run_at DESC LIMIT 1`. Also update the `status` command in `run_etl.py`
to use `MAX(run_at)` rather than `MAX(updated_at)` (see Bug 4).

---

**Bug 3 — `_parse_date` returns a string, models expect `date`**

In `school_explorer/etl/gias.py`, `_parse_date()` returns an ISO string
(`"2023-09-01"`) but `School.open_date` and `School.close_date` are typed as
`Mapped[Optional[date]]`. SQLAlchemy 2.0 with psycopg2 will usually coerce this,
but it is unreliable and will break if you switch to psycopg3.

**Fix:** Make `_parse_date` return `Optional[date]` (a Python `datetime.date` object):
```python
from datetime import date as date_type

def _parse_date(value: Any) -> Optional[date_type]:
    ...
    return dt.strptime(s, fmt).date()   # return date object, not .isoformat()
```

Apply the same fix to `_parse_date` in `school_explorer/etl/ofsted.py`.

---

**Bug 4 — `status` command queries `updated_at` on `DataRefresh`, which has no such column**

In `scripts/run_etl.py`, the `status` command runs:
```python
updated = session.execute(text(f"SELECT MAX(updated_at) FROM {tbl}")).scalar()
```

`DataRefresh` does not inherit `TimestampMixin` and has no `updated_at` column.
This will raise a `ProgrammingError` every time `status` is run.

**Fix:** In the `status` command, handle `DataRefresh` separately — use
`MAX(run_at)` for the `data_refresh` table, and `MAX(updated_at)` for all others.
Or simplify: wrap the query in a try/except and fall back to `MAX(run_at)` if
`updated_at` doesn't exist.

---

**Bug 5 — Unused import in `gias.py`**

```python
import re   # line 17 — imported but never used
```

Remove it. `ruff check` will flag this; fix it so the project is clean from the
start.

---

**Bug 6 — `_seed_boroughs` re-imports already-available names**

In `school_explorer/etl/gias.py`, `_seed_boroughs` does:
```python
def _seed_boroughs(self) -> None:
    from school_explorer.database import get_session       # already imported at module level in base
    from sqlalchemy.dialects.postgresql import insert as pg_insert  # already imported in base
```

These are redundant local imports. Remove them — `get_session` is available via the
inherited `self._upsert` / base class, and `pg_insert` is not needed here (use
`self._upsert(Borough, rows, ["la_code"])` instead, which is consistent with how
all other load steps work).

---

**Bug 7 — `financials.py` ACADEMIC_YEAR set to financial year format**

```python
ACADEMIC_YEAR = FINANCIAL_YEAR   # "2023-24"
```

This stores `"2023-24"` (hyphen) in `DataRefresh.academic_year`, inconsistent with
all other ingestors which use `"2024/25"` (slash). The `Financials` model already
has a separate `financial_year` column. The `DataRefresh` row should use a
consistent label.

**Fix:** Set `ACADEMIC_YEAR = "2023/24"` in `FinancialsIngestor` (the nearest
academic year for display/filtering purposes), while keeping `FINANCIAL_YEAR =
"2023-24"` as the key written to the `financials` table itself.

---

**Bug 8 — `ks5.py` imports `settings` inside a method**

In `school_explorer/etl/ks5.py`:
```python
def download(self, force: bool = False) -> Path:
    ...
    from school_explorer.config import settings  # should be a module-level import
```

Move `from school_explorer.config import settings` to the top of the file.

---

**Bug 9 — `_upsert` uses `pg_insert(model_class)` — verify correct usage**

The base `_upsert` does:
```python
stmt = pg_insert(model_class).values(batch)
```

In SQLAlchemy 2.0, `sqlalchemy.dialects.postgresql.insert` accepts a mapped class
directly. Confirm this works by running:
```python
python -c "
from sqlalchemy.dialects.postgresql import insert
from school_explorer.models import School
stmt = insert(School)
print('OK:', stmt)
"
```

If it raises, change to `pg_insert(model_class.__table__)`.

---

**Bug 10 — `_extract_zip` in base vs reimplemented in `ks4.py`, `ks5.py`**

`BaseIngestor._extract_zip(zip_path, target_filename)` takes a specific filename.
But `ks4.py` and `ks5.py` both reimplement their own `_extract_institution_csv`
using a pattern match (e.g. `"ks4_school"`). This duplication is fine for now but
the base `_extract_zip` is never used.

**Fix:** Update `BaseIngestor._extract_zip` to accept either an exact filename or
a glob pattern, OR simply remove it and rely on the pattern-matching approach used
in the individual ingestors. Either is acceptable — just make it consistent.

---

### 1.3 Add a `school_summary_latest` materialised view

This is the most important database object for API performance. Every list/search
query in the app hits this view rather than joining 10 tables at query time.

Create a migration (`alembic revision --autogenerate -m "add_summary_view"`) that
creates and refreshes this view. If Alembic can't autogenerate it (views aren't
auto-detected), create a manual migration.

The view should flatten the most recent row per URN from every table:

```sql
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
WITH DATA;

CREATE UNIQUE INDEX ON school_summary_latest (urn);
```

Add a `REFRESH MATERIALIZED VIEW CONCURRENTLY school_summary_latest;` call at the
end of `run_etl.py`'s `run-all` command, and expose it as a standalone CLI command:
```
python scripts/run_etl.py refresh-summary
```

---

### 1.4 Verification checklist for Phase 1

Before moving to Phase 2, confirm all of the following pass:

```bash
# 1. uv installs cleanly
uv sync

# 2. ruff finds no errors
uv run ruff check school_explorer/ scripts/

# 3. Syntax check on all Python files
uv run python -c "
import ast, pathlib
files = list(pathlib.Path('school_explorer').rglob('*.py')) + list(pathlib.Path('scripts').rglob('*.py'))
errors = []
for f in files:
    try: ast.parse(f.read_text())
    except SyntaxError as e: errors.append(f'{f}: {e}')
print('ERRORS:', errors if errors else 'none')
print(f'Checked {len(files)} files')
"

# 4. Models import cleanly
uv run python -c "from school_explorer.models import Base; print('Tables:', list(Base.metadata.tables.keys()))"

# 5. ETL registry includes destinations
uv run python -c "
from scripts.run_etl import INGESTORS
print('Registered:', list(INGESTORS.keys()))
assert 'destinations_ks4' in INGESTORS
assert 'destinations_ks5' in INGESTORS
print('OK')
"

# 6. pg_insert accepts mapped class
uv run python -c "
from sqlalchemy.dialects.postgresql import insert
from school_explorer.models import School
insert(School)
print('pg_insert OK')
"

# 7. Database tables create without errors (requires running PostgreSQL)
uv run python scripts/run_etl.py init-db
uv run python scripts/run_etl.py status
```

---

## Phase 2 — FastAPI backend

### 2.1 Dependencies to add to pyproject.toml

```toml
"fastapi>=0.115",
"uvicorn[standard]>=0.30",
"httpx>=0.27",      # for TestClient in tests
```

### 2.2 Directory structure

Create the following under `school_explorer/api/`:

```
school_explorer/api/
├── __init__.py
├── main.py          # FastAPI app, mounts routers, CORS, lifespan
├── deps.py          # Shared dependencies (DB session, pagination params)
├── schemas.py       # Pydantic response models
└── routers/
    ├── __init__.py
    ├── schools.py   # /schools list + search
    ├── school.py    # /schools/{urn} detail
    └── meta.py      # /boroughs, /refresh-status
```

### 2.3 `main.py`

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from school_explorer.api.routers import schools, school, meta

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Any startup/shutdown logic here
    yield

app = FastAPI(title="School Explorer API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(schools.router, prefix="/api/v1")
app.include_router(school.router, prefix="/api/v1")
app.include_router(meta.router, prefix="/api/v1")
```

Run with: `uv run uvicorn school_explorer.api.main:app --reload`

### 2.4 `deps.py`

```python
from typing import Annotated
from fastapi import Depends, Query
from sqlalchemy.orm import Session
from school_explorer.database import SessionLocal

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

DbSession = Annotated[Session, Depends(get_db)]

class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1),
        page_size: int = Query(25, ge=1, le=100),
    ):
        self.offset = (page - 1) * page_size
        self.limit = page_size
        self.page = page
        self.page_size = page_size
```

### 2.5 `schemas.py`

Define Pydantic models for all API responses. Use `model_config = ConfigDict(from_attributes=True)`.

Required schemas:

**`SchoolSummary`** — returned in list/search results. Fields from `school_summary_latest`:
- `urn`, `name`, `la_name`, `establishment_group`, `phase`, `gender`
- `is_selective`, `has_sixth_form`, `postcode`, `lat`, `lng`
- `ofsted_overall` (nullable), `ofsted_quality` (nullable)
- `attainment_8` (nullable), `progress_8` (nullable), `pct_grade5_english_maths` (nullable)
- `avg_points_per_alevel_entry` (nullable), `pct_astar_or_a` (nullable)
- `total_pupils` (nullable), `pct_fsm6` (nullable)
- `ks4_suppressed`, `ks5_suppressed`

**`SchoolDetail`** — returned for `/schools/{urn}`. All fields from `school_summary_latest`
plus full detail from the `schools` table (address, website, religious character,
headteacher, open date) and all time-series arrays:

```python
class SchoolDetail(SchoolSummary):
    # Address
    street: str | None
    locality: str | None
    town: str | None
    website: str | None
    headteacher_name: str | None
    open_date: date | None

    # Time series — full history, not just latest
    inspections: list[InspectionRecord]
    performance_ks4_history: list[KS4Record]
    performance_ks5_history: list[KS5Record]
    performance_ks2_history: list[KS2Record]
    destinations_ks4_history: list[DestKS4Record]
    destinations_ks5_history: list[DestKS5Record]
    pupils_history: list[PupilsRecord]
    workforce_history: list[WorkforceRecord]
    financials_history: list[FinancialsRecord]
```

**`PaginatedSchools`**:
```python
class PaginatedSchools(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[SchoolSummary]
```

Also define `BoroughSummary`, `RefreshStatus`.

### 2.6 `routers/schools.py` — list and search

`GET /api/v1/schools`

Query parameters:
- `q: str | None` — fuzzy name search (use `ILIKE '%{q}%'` against `school_summary_latest.name`)
- `borough: str | None` — filter by `la_code`
- `phase: str | None` — `primary | secondary | all_through | 16_plus`
- `establishment_group: str | None` — `state | academy | grammar | independent | sixth_form_college`
- `has_sixth_form: bool | None`
- `is_selective: bool | None`
- `gender: str | None` — `mixed | boys | girls`
- `page: int = 1`, `page_size: int = 25`

Query against `school_summary_latest` (the materialised view). Use SQLAlchemy `text()`
or the ORM — the view is not mapped as a model so either:
- Use `text()` with explicit columns, OR
- Create a `SchoolSummaryView` SQLAlchemy model mapped to the view with
  `__table__ = Table("school_summary_latest", Base.metadata, autoload_with=engine)`

Return `PaginatedSchools`.

### 2.7 `routers/school.py` — detail

`GET /api/v1/schools/{urn}`

Query the `schools` table directly (not the view) for full detail, then join/subquery
for all historical records across inspections, performance, destinations, pupils,
workforce, financials tables.

Use `selectinload` or explicit subqueries — do not use lazy loading in an async
context (or at all — it causes N+1 queries).

Return `SchoolDetail`.

`GET /api/v1/schools/{urn}/compare?urns=12345,67890`

Return a list of `SchoolDetail` for multiple URNs simultaneously. Used by the
compare view in the frontend. Max 5 URNs.

### 2.8 `routers/meta.py`

`GET /api/v1/boroughs` — return list of `{la_code, la_name}` for all 33 London boroughs.

`GET /api/v1/refresh-status` — return the latest `DataRefresh` record per source name,
showing when each data source was last successfully loaded.

### 2.9 Verification checklist for Phase 2

```bash
# Start the server
uv run uvicorn school_explorer.api.main:app --reload

# In another terminal:
curl http://localhost:8000/api/v1/schools | python -m json.tool
curl "http://localhost:8000/api/v1/schools?phase=secondary&borough=204" | python -m json.tool
curl http://localhost:8000/api/v1/schools/136264 | python -m json.tool   # Hackney Free School
curl http://localhost:8000/api/v1/boroughs | python -m json.tool
curl http://localhost:8000/api/v1/refresh-status | python -m json.tool

# OpenAPI docs should be at:
open http://localhost:8000/docs
```

All endpoints must return 200 with well-formed JSON. No 500 errors. Nullable
fields should be `null` in JSON, not absent.

---

## Phase 3 — React frontend

### 3.1 Scaffold

```bash
cd school-explorer
uv run -- npx create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Add the following to `frontend/package.json` dependencies:
```json
"@tanstack/react-query": "^5.0.0",
"react-router-dom": "^6.0.0",
"axios": "^1.6.0",
"recharts": "^2.10.0",
"lucide-react": "^0.400.0"
```

Configure Vite proxy in `vite.config.ts` to avoid CORS in development:
```ts
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

### 3.2 Pages and components

Build the following views. Prioritise function over visual polish at this stage — clean,
readable layout using plain CSS or Tailwind. No component library required.

**`/` — Home / Search page**

- Prominent search box (name search)
- Filter sidebar or filter bar:
  - Borough dropdown (populated from `/api/v1/boroughs`)
  - Phase toggle (Primary / Secondary / Sixth Form / All)
  - Type checkboxes (State / Academy / Grammar / Independent)
  - Gender filter (Mixed / Boys / Girls)
  - Has sixth form toggle
- Results grid/list of `SchoolCard` components
- Pagination controls
- Results count ("Showing 1–25 of 312 schools")

**`SchoolCard` component**

Compact card showing:
- School name (links to detail page)
- Borough, phase, type badge
- Ofsted grade badge (colour-coded: Outstanding=green, Good=blue, RI=amber, Inadequate=red)
  - If post-Sept 2024 inspection, show "New framework" instead of legacy grade
- Key metric: Progress 8 (secondary) or % expected standard (primary) or A* -B % (sixth form)
  - Show "N/A — small cohort" if suppressed flag is true
- Pupil count

**`/schools/:urn` — School detail page**

Tabs:
1. **Overview** — name, address, type, Ofsted summary, map pin (use a simple static map
   or a Leaflet embed; don't use Google Maps API), key stats at a glance
2. **Academic results** — line charts (Recharts) showing metric trends over available
   years. Secondary: Attainment 8, Progress 8 with CI band, grade 5 English+Maths %.
   Sixth form: avg points per entry, % A*-B, % A*-A. Primary: % expected RWM,
   progress scores. Always show the year on the x-axis.
3. **Destinations** — bar chart or donut showing where leavers went. Show both KS4
   and KS5 if available. Include the cohort year and destination year in the label
   (e.g. "2022/23 leavers, measured 2023/24").
4. **Context** — pupil composition: FSM %, EAL %, SEN %. Absence rate. Workforce:
   PTR, % qualified teachers. Financials: income per pupil, spending breakdown.
5. **History** — full Ofsted inspection history as a timeline list.

**`/compare` — Side-by-side comparison**

- URL format: `/compare?urns=123456,234567,345678` (up to 5 schools)
- Table layout comparing all key metrics side-by-side
- Cells highlighted if a school is best/worst for that metric in the comparison set
- "Add school" button opens a search modal

### 3.3 API client

Create `frontend/src/api/client.ts`:
```ts
import axios from 'axios'

const api = axios.create({ baseURL: '/api/v1' })
export default api
```

Create typed hooks using React Query for each endpoint:
- `useSchools(params)` → `GET /api/v1/schools`
- `useSchool(urn)` → `GET /api/v1/schools/:urn`
- `useCompare(urns)` → `GET /api/v1/schools/:urn/compare`
- `useBoroughs()` → `GET /api/v1/boroughs`

### 3.4 Data display rules (important)

These must be enforced consistently across all components:

| Situation | Display |
|---|---|
| `suppressed = true` | "N/A — small cohort" (never show 0 or blank) |
| `null` value, not suppressed | "Not available" |
| Legacy Ofsted grade (`overall_effectiveness_legacy`) on inspection before Sept 2024 | Show grade with label e.g. "Good (2022)" |
| Post-Sept 2024 inspection, no overall grade | Show sub-judgements only; no overall badge |
| Financial year vs academic year | Always show which year the data is from |
| Progress 8 | Show the value AND the confidence interval where available |

### 3.5 Verification checklist for Phase 3

```bash
cd frontend
npm run build     # must complete with no TypeScript errors
npm run dev       # start dev server

# Then manually verify:
# - Home page loads, search filters work
# - School cards show correct suppression handling
# - Detail page all 5 tabs render without errors
# - Charts render with correct axis labels and year annotations
# - Compare page works with 2+ schools
# - No console errors in browser dev tools
```

---

## Notes on things not yet built

The following are explicitly out of scope for this brief. Do not attempt them:

- **Catchment area data** — intentionally deferred. The CATCHMENT model exists in
  the data model design but no table, ingestor, or UI exists for it yet.
- **KS2 destinations** — not a standard DfE publication. Omit.
- **Independent school performance data** — DfE does not collect this. Independent
  school rows in the DB will have null performance metrics. The UI already handles
  this via the "Not available" rule above.
- **User accounts / saved schools** — out of scope for V1.
- **Authentication on the API** — the API is read-only public data; no auth needed.
- **Hosting / deployment** — local only for now. Do not add Docker, CI, or cloud
  config at this stage.

---

## File map (current state, as of this brief)

```
school-explorer/
├── CLAUDE.md                        ← this file
├── README.md
├── pyproject.toml                   ← needs uv/hatchling migration (Phase 1.1)
├── alembic.ini
├── alembic/
│   ├── env.py
│   └── versions/                   ← empty; migrations go here
├── scripts/
│   └── run_etl.py                  ← CLI entry point
├── data/raw/                       ← gitignored; cached downloads land here
└── school_explorer/
    ├── config.py
    ├── database.py
    ├── models/
    │   ├── __init__.py
    │   ├── base.py
    │   ├── school.py               Borough, School
    │   ├── inspection.py           Inspection
    │   ├── performance.py          PerformanceKS2, KS4, KS5
    │   ├── destinations.py         DestinationsKS4, KS5
    │   ├── context.py              Pupils, Workforce, Financials
    │   └── refresh.py              DataRefresh
    ├── etl/
    │   ├── __init__.py
    │   ├── base.py                 BaseIngestor
    │   ├── gias.py
    │   ├── ofsted.py
    │   ├── ks4.py
    │   ├── ks5.py
    │   ├── pupils.py
    │   ├── workforce.py
    │   ├── financials.py
    │   ├── destinations_ks4.py     ← MISSING — create in Phase 1.2 Bug 1
    │   └── destinations_ks5.py     ← MISSING — create in Phase 1.2 Bug 1
    └── api/                        ← MISSING — create in Phase 2
        ├── __init__.py
        ├── main.py
        ├── deps.py
        ├── schemas.py
        └── routers/
            ├── __init__.py
            ├── schools.py
            ├── school.py
            └── meta.py
```
