from fastapi import APIRouter
from sqlalchemy import text

from school_explorer.api.deps import DbSession
from school_explorer.api.schemas import BoroughSummary, RefreshStatus

router = APIRouter()


@router.get("/boroughs", response_model=list[BoroughSummary])
def get_boroughs(db: DbSession):
    rows = db.execute(
        text("SELECT la_code, la_name FROM boroughs ORDER BY la_name")
    ).fetchall()
    return [BoroughSummary(la_code=r.la_code, la_name=r.la_name) for r in rows]


@router.get("/refresh-status", response_model=list[RefreshStatus])
def get_refresh_status(db: DbSession):
    rows = db.execute(
        text("""
            SELECT DISTINCT ON (source_name)
                source_name, target_table, academic_year, status, rows_loaded, run_at, completed_at
            FROM data_refresh
            ORDER BY source_name, run_at DESC
        """)
    ).fetchall()
    return [
        RefreshStatus(
            source_name=r.source_name,
            target_table=r.target_table,
            academic_year=r.academic_year,
            status=r.status,
            rows_loaded=r.rows_loaded,
            run_at=r.run_at.isoformat() if r.run_at else None,
            completed_at=r.completed_at.isoformat() if r.completed_at else None,
        )
        for r in rows
    ]
