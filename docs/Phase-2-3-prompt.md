# School Explorer — Phase 2 & 3 Prompt

## What this is

London school data explorer. Python/FastAPI backend + React/TypeScript frontend.
Phase 1 (ETL pipeline + database) is **complete and working** with real data.

Full spec is in `docs/Phase-1-3-brief.md`. This prompt is a ready-to-run brief with
the Phase 1 learnings baked in so you don't repeat them.

---

## Current database state (Phase 1 complete)

PostgreSQL 17 running locally (Homebrew). DB: `school_explorer`.
Connection string: read from `.env` → `DATABASE_URL=postgresql://z.gurney@localhost:5432/school_explorer`.

```
Schools          3,196 rows   (London active schools, all types)
Boroughs            33 rows   (all London boroughs)
Inspections     14,650 rows   (Ofsted 5-year ODS file, Sept 2024 framework change)
KS4 Performance    862 rows   (2024/25 EES tidy format)
KS5 Performance    544 rows   (2024/25 institution_performance file)
KS4 Destinations   629 rows   (2022/23 cohort, ees_ks4_inst file)
KS5 Destinations   480 rows   (2022/23 cohort, ees_ks5_inst file)
Pupils           3,019 rows   (Jan 2025 census, spc_school_level_underlying_data)
Workforce        2,508 rows   (PTR + FTE from workforce_ptrs file, 2024/25)
Financials       2,536 rows   (FBIT 2024-25 per-pupil figures)
KS2 Performance      0 rows   (no ingestor — omit from Phase 2/3 for now)
```

The `school_summary_latest` **materialised view** migration exists in
`alembic/versions/a1b2c3d4e5f6_add_summary_view.py` but has **not been applied yet**
(no database connection was available when writing the migration). Run it with:

```bash
uv run alembic upgrade head
```

If Alembic fails (e.g. migration history missing), create the view manually:
```bash
uv run python -c "
from school_explorer.database import engine
from sqlalchemy import text
# paste the CREATE MATERIALIZED VIEW SQL from the migration file
"
```

---

## Key things Phase 1 learned (don't repeat these mistakes)

### Data model quirks

- `inspections.overall_effectiveness_legacy` is NULL for all inspections after Sept 2024.
  The sub-judgements (quality_of_education, behaviour_attitudes, etc.) are the current grades.
  Ofsted grades are stored as strings: `"Outstanding"`, `"Good"`, `"Requires improvement"`,
  `"Inadequate"`. Grade 9 in the source = not applicable = NULL in DB.

- `performance_ks5.pct_astar_to_b` is actually % achieving AAB or better in best 3 A-levels
  (not strictly A*-B%). Label it accordingly in the UI.

- `performance_ks5.alevel_cohort` is NULL for all rows — the EES institution_performance file
  doesn't have a separate A-level cohort count. Use `total_cohort` instead.

- `financials` rows only have `income_per_pupil`, `expenditure_per_pupil`,
  `balance_per_pupil`, `pct_teaching_staff_expenditure`, and `in_deficit`.
  All total/absolute monetary columns are NULL (FBIT API only returns per-pupil).

- `pupils` rows have `total_pupils`, `boys`, `girls`, `pct_fsm_eligible`, `pct_eal`.
  `pct_fsm6`, `pct_sen_ehcp`, `pct_sen_support`, `pct_absence_overall` are all NULL
  (not in the EES school-level file for 2024/25).

- `schools.phase` uses GIAS values: `"Primary"`, `"Secondary"`, `"All-through"`,
  `"16 plus"`, `"Nursery"`, `"Not applicable"`.

- `schools.establishment_group` values: `state`, `academy`, `free`, `grammar`,
  `independent`, `sixth_form_college`, `utc`, `studio`, `pru`, `state_special`, `other`.

### The materialised view

`school_summary_latest` joins every table via LATERAL joins (latest row per URN).
It's the **only** table the list/search API should query — never join 10 tables live.
After any ETL run: `REFRESH MATERIALIZED VIEW CONCURRENTLY school_summary_latest;`
The view already has a UNIQUE INDEX on `urn` which enables concurrent refresh.

---

## Phase 2 — FastAPI backend

Follow `docs/Phase-1-3-brief.md` §2 exactly. Key notes:

### Setup

```bash
# Add deps to pyproject.toml then:
uv lock && uv sync
uv run uvicorn school_explorer.api.main:app --reload
```

Dependencies to add to `pyproject.toml`:
```toml
"fastapi>=0.115",
"uvicorn[standard]>=0.30",
"httpx>=0.27",
```

### Directory structure

Create `school_explorer/api/` with:
- `__init__.py`
- `main.py` — FastAPI app, CORS (`http://localhost:5173`), mounts routers
- `deps.py` — `get_db()` session dependency, `PaginationParams`
- `schemas.py` — Pydantic response models
- `routers/__init__.py`
- `routers/schools.py` — `GET /api/v1/schools` (list + search)
- `routers/school.py` — `GET /api/v1/schools/{urn}` (detail) + compare
- `routers/meta.py` — `GET /api/v1/boroughs`, `GET /api/v1/refresh-status`

### Querying the view

The `school_summary_latest` view is NOT mapped as an ORM model.
Use SQLAlchemy `text()` or reflect it:

```python
from sqlalchemy import Table, MetaData
from school_explorer.database import engine

meta = MetaData()
summary_view = Table("school_summary_latest", meta, autoload_with=engine)
```

Then query with `db.execute(select(summary_view).where(...))`.

### Schemas — important nullability

Many fields are nullable. `SchoolSummary` must handle:
- `ofsted_overall`: NULL for all post-Sept 2024 inspections
- `attainment_8`, `progress_8`: NULL for non-secondary schools or suppressed
- `avg_points_per_alevel_entry`: NULL for non-sixth-form schools
- `ks4_suppressed`, `ks5_suppressed`: always present (False if no suppression)

Use `Optional[X] = None` for all nullable fields in Pydantic models.

### `/schools` endpoint filters

These map directly to `school_summary_latest` columns:
- `q` → `ILIKE '%{q}%'` on `name`
- `borough` → exact match on `la_code` (3-digit string like `"204"`)
- `phase` → exact match on `phase` (use GIAS values above)
- `establishment_group` → exact match on `establishment_group`
- `has_sixth_form` → boolean on `has_sixth_form`
- `is_selective` → boolean on `is_selective`
- `gender` → exact match on `gender` (`"Mixed"`, `"Boys"`, `"Girls"`)

### Detail endpoint

`GET /api/v1/schools/{urn}` queries the `schools` table for base info,
then loads all related history tables. Use `selectinload` or explicit queries.
Do NOT use lazy loading.

### Verification

```bash
curl http://localhost:8000/api/v1/schools | python -m json.tool
curl "http://localhost:8000/api/v1/schools?phase=Secondary&borough=204" | python -m json.tool
curl http://localhost:8000/api/v1/schools/136264 | python -m json.tool
curl http://localhost:8000/api/v1/boroughs | python -m json.tool
open http://localhost:8000/docs
```

---

## Phase 3 — React frontend

Follow `docs/Phase-1-3-brief.md` §3 exactly. Key notes:

### Scaffold

```bash
npx create-vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install @tanstack/react-query react-router-dom axios recharts lucide-react
```

Configure `vite.config.ts` proxy:
```ts
server: { proxy: { '/api': 'http://localhost:8000' } }
```

### Data display rules (enforce strictly)

| Situation | Display |
|---|---|
| `ks4_suppressed = true` or `ks5_suppressed = true` | "N/A — small cohort" |
| `null` value, not suppressed | "Not available" |
| `ofsted_overall = null` + inspection after Sept 2024 | Show sub-judgements only; no overall badge |
| `ofsted_overall` present | Show with year e.g. "Good (2022)" |
| `pct_astar_to_b` | Label as "% A*-B (A-level)" — note this is AAB+ in best 3 |
| Financial figures | Always `income_per_pupil`, `expenditure_per_pupil` — never totals |
| Absence rate | Show as "Not available" — not in 2024/25 dataset |

### Ofsted badge colours

```
Outstanding   → green
Good          → blue
Requires improvement → amber
Inadequate    → red
No grade (new framework) → grey, show "New framework (2024+)"
```

### School detail — tabs

1. **Overview** — name, type, Ofsted badge, key stats
2. **Academic results** — KS4 (Att8, P8 with CI band, grade 5 E+M%), KS5 (avg points, % A*-B), KS2 (expected standard % — data currently empty)
3. **Destinations** — KS4 + KS5 bar charts. Label: "2022/23 leavers, measured 2023/24"
4. **Context** — pupils (total, FSM-eligible %, EAL % — FSM6 not available), workforce (PTR, FTE teachers), financials (income/expenditure per pupil, surplus/deficit)
5. **History** — full Ofsted inspection timeline

### API hooks

```ts
// src/api/client.ts
import axios from 'axios'
const api = axios.create({ baseURL: '/api/v1' })
export default api

// Hooks using React Query:
useSchools(params)     → GET /api/v1/schools
useSchool(urn)         → GET /api/v1/schools/:urn
useCompare(urns)       → GET /api/v1/schools/:urn/compare
useBoroughs()          → GET /api/v1/boroughs
```

### Verification

```bash
cd frontend
npm run build   # must pass TypeScript with no errors
npm run dev     # open http://localhost:5173
```

Check:
- Home page loads, filters work, school cards render
- KS4/KS5 suppression flag shows "N/A — small cohort"
- Detail page: all 5 tabs render, charts show years on x-axis
- Financials tab shows per-pupil figures (not totals)
- Context tab shows "Not available" for absence rate
- No console errors

---

## Commands reference

```bash
# Install
uv sync

# Start API
uv run uvicorn school_explorer.api.main:app --reload

# ETL status
uv run python scripts/run_etl.py status

# Refresh materialised view
uv run python scripts/run_etl.py refresh-summary

# Lint
uv run ruff check school_explorer/ scripts/

# Apply migrations
uv run alembic upgrade head
```
