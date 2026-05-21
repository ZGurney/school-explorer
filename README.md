# School Explorer — London

A data explorer for primary, secondary, grammar, independent, and sixth-form schools across London.

## Prerequisites

- Python 3.11+
- PostgreSQL 15+ running locally
- [uv](https://docs.astral.sh/uv/) — Python package manager

## Setup

```bash
# 1. Clone and install dependencies
git clone <repo>
cd school-explorer
uv sync             # install all dependencies from lockfile
uv sync --extra dev # include dev dependencies (pytest, ruff, mypy)

# 2. Configure
cp env.example .env
# Edit .env — set DATABASE_URL to your local PostgreSQL connection string

# 3. Create the database
createdb school_explorer

# 4. Initialise tables (two options — pick one)

# Option A: Alembic (recommended — tracks schema migrations)
uv run alembic upgrade head

# Option B: Quick setup (no migration history)
uv run python scripts/run_etl.py init-db
```

## Running the ETL pipeline

```bash
# Run everything (takes ~10-20 minutes on first run — downloads ~200 MB of data)
uv run python scripts/run_etl.py run-all

# Run a single source
uv run python scripts/run_etl.py run gias
uv run python scripts/run_etl.py run ofsted
uv run python scripts/run_etl.py run ks4
uv run python scripts/run_etl.py run ks5
uv run python scripts/run_etl.py run destinations_ks4
uv run python scripts/run_etl.py run destinations_ks5
uv run python scripts/run_etl.py run pupils
uv run python scripts/run_etl.py run workforce
uv run python scripts/run_etl.py run financials

# Force re-download (ignores cached files in data/raw/)
uv run python scripts/run_etl.py run gias --force

# Check what's currently in the database
uv run python scripts/run_etl.py status

# Refresh the school_summary_latest materialised view
uv run python scripts/run_etl.py refresh-summary
```

## Data sources

| Source | Table(s) | Update frequency | Notes |
|--------|----------|------------------|-------|
| GIAS | `schools`, `boroughs` | Monthly | Run this first — all other tables FK to it |
| Ofsted | `inspections` | Rolling | Overall grade removed Sept 2024 |
| DfE KS4 | `performance_ks4` | Annual (Oct) | GCSEs — ~2 month lag |
| DfE KS5 | `performance_ks5` | Annual (Oct) | A-levels — ~2 month lag |
| DfE KS4 Destinations | `destinations_ks4` | Annual (Mar) | ~18 month lag |
| DfE KS5 Destinations | `destinations_ks5` | Annual (Mar) | ~18 month lag |
| DfE Pupils | `pupils` | Annual (Jun) | Jan census — ~5 month lag |
| DfE Workforce | `workforce` | Annual (Jul) | Nov census — ~8 month lag |
| FBIT | `financials` | Annual (Dec) | ~16 month lag; calls FBIT API per school |

## Troubleshooting

**Download URLs change between releases.** If a download fails, visit the source URL
listed in the relevant `etl/*.py` file, download the file manually, and place it in
`data/raw/`. The ingestor will detect and use the cached file on the next run.

**Column names change.** DfE occasionally renames CSV columns between annual releases.
If you get a `KeyError` during transform, compare the downloaded CSV header row against
the `COLUMN_MAP` in the relevant ingestor and update the mapping.

**FBIT API changes.** The financials ingestor uses the FBIT internal API which has no
official documentation. If it starts failing, inspect the Network tab on
https://financial-benchmarking-and-insights-tool.education.gov.uk/ to find current
endpoint URLs and field names.

## Project structure

```
school-explorer/
├── school_explorer/
│   ├── config.py           settings (DATABASE_URL, data dir, etc.)
│   ├── database.py         SQLAlchemy engine + session factory
│   ├── models/             SQLAlchemy ORM models
│   │   ├── school.py       Borough, School
│   │   ├── inspection.py   Inspection (Ofsted)
│   │   ├── performance.py  PerformanceKS2, KS4, KS5
│   │   ├── destinations.py DestinationsKS4, KS5
│   │   └── context.py      Pupils, Workforce, Financials
│   └── etl/                ETL ingestors
│       ├── base.py         BaseIngestor (download + transform + load + upsert)
│       ├── gias.py         School registry
│       ├── ofsted.py       Inspection data
│       ├── ks4.py          GCSE performance
│       ├── ks5.py          A-level performance
│       ├── destinations_ks4.py  KS4 destination measures
│       ├── destinations_ks5.py  KS5 destination measures
│       ├── pupils.py       Pupil characteristics
│       ├── workforce.py    Teacher/staff data
│       └── financials.py   Income/expenditure (FBIT)
├── scripts/
│   └── run_etl.py          CLI (run-all | run <source> | status | init-db | refresh-summary)
├── alembic/                Database migration scripts
└── data/raw/               Cached downloaded files (gitignored)
```
