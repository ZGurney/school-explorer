"""
ETL run tracking. One row per (source, academic_year).
Lets you see at a glance what data is loaded and when it was last refreshed.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from school_explorer.models.base import Base


class DataRefresh(Base):
    __tablename__ = "data_refresh"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # e.g. "gias", "ofsted", "ks4_performance", "ks5_performance"
    source_name: Mapped[str] = mapped_column(String(50), nullable=False)

    # The target table(s) populated by this source
    target_table: Mapped[str] = mapped_column(String(100), nullable=False)

    # e.g. "2024/25". Use "rolling" for sources without an academic year (GIAS, Ofsted)
    academic_year: Mapped[str] = mapped_column(String(10), nullable=False, default="rolling")

    # "success" | "failed" | "running"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")

    rows_loaded: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rows_skipped: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ISO timestamp of the run — always set explicitly by _start_refresh_record
    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Error traceback if status = "failed"
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # URL or filename of the source file that was loaded
    source_file: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    def __repr__(self) -> str:
        return f"<DataRefresh source={self.source_name!r} year={self.academic_year!r} status={self.status!r}>"
