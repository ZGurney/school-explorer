#!/usr/bin/env python3
"""
CLI entry point for the ETL pipeline.

Usage:
    # Run everything in the correct order
    python scripts/run_etl.py run-all

    # Run a specific source
    python scripts/run_etl.py run gias
    python scripts/run_etl.py run ofsted
    python scripts/run_etl.py run ks2
    python scripts/run_etl.py run ks4
    python scripts/run_etl.py run ks5
    python scripts/run_etl.py run destinations_ks4
    python scripts/run_etl.py run destinations_ks5
    python scripts/run_etl.py run pupils
    python scripts/run_etl.py run workforce
    python scripts/run_etl.py run financials

    # Force re-download even if cached file exists
    python scripts/run_etl.py run gias --force

    # Check current database status
    python scripts/run_etl.py status

    # Initialise the database (create all tables)
    python scripts/run_etl.py init-db

    # Refresh the school_summary_latest materialised view
    python scripts/run_etl.py refresh-summary
"""

import logging
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

# Make sure the project root is on sys.path when running as a script
sys.path.insert(0, str(Path(__file__).parent.parent))

from school_explorer.database import check_connection, create_all_tables
from school_explorer.etl import (
    DestinationsKS4Ingestor,
    DestinationsKS5Ingestor,
    FinancialsIngestor,
    GIASIngestor,
    KS2Ingestor,
    KS4Ingestor,
    KS5Ingestor,
    OfstedIngestor,
    PupilsIngestor,
    WorkforceIngestor,
)

console = Console()

# Registry: name → ingestor class
# ORDER MATTERS: GIAS must run first (all other tables FK to schools.urn)
INGESTORS = {
    "gias": GIASIngestor,
    "ofsted": OfstedIngestor,
    "ks2": KS2Ingestor,
    "ks4": KS4Ingestor,
    "ks5": KS5Ingestor,
    "destinations_ks4": DestinationsKS4Ingestor,
    "destinations_ks5": DestinationsKS5Ingestor,
    "pupils": PupilsIngestor,
    "workforce": WorkforceIngestor,
    "financials": FinancialsIngestor,
}


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )


@click.group()
@click.option("--log-level", default="INFO", help="Logging level")
def cli(log_level: str) -> None:
    setup_logging(log_level)


@cli.command("init-db")
def init_db() -> None:
    """Create all database tables (safe to re-run — won't drop existing tables)."""
    if not check_connection():
        console.print("[red]✗ Cannot connect to database. Check DATABASE_URL in .env[/red]")
        sys.exit(1)
    create_all_tables()
    console.print("[green]✓ Database tables created (or already existed)[/green]")


@cli.command("run")
@click.argument("source", type=click.Choice(list(INGESTORS.keys())))
@click.option("--force", is_flag=True, help="Force re-download even if cached")
def run_one(source: str, force: bool) -> None:
    """Run a single ETL source."""
    if not check_connection():
        console.print("[red]✗ Cannot connect to database[/red]")
        sys.exit(1)

    console.rule(f"[bold]{source}[/bold]")
    ingestor = INGESTORS[source]()
    try:
        loaded, skipped = ingestor.run(force_download=force)
    except Exception as exc:
        console.print(f"[red]Failed: {exc}[/red]")
        sys.exit(1)


@cli.command("run-all")
@click.option("--force", is_flag=True, help="Force re-download all sources")
@click.option(
    "--skip",
    multiple=True,
    type=click.Choice(list(INGESTORS.keys())),
    help="Skip one or more sources (repeatable)",
)
def run_all(force: bool, skip: tuple[str, ...]) -> None:
    """
    Run all ETL sources in the correct order.

    GIAS is always run first — all other tables depend on it.
    Financials is run last because it calls an external API per school.
    """
    if not check_connection():
        console.print("[red]✗ Cannot connect to database[/red]")
        sys.exit(1)

    to_run = [name for name in INGESTORS if name not in skip]
    console.print(f"Running {len(to_run)} sources: {', '.join(to_run)}")
    if skip:
        console.print(f"Skipping: {', '.join(skip)}")

    results = {}
    for name in to_run:
        console.rule(f"[bold]{name}[/bold]")
        ingestor = INGESTORS[name]()
        try:
            loaded, skipped_rows = ingestor.run(force_download=force)
            results[name] = ("✓", loaded, skipped_rows, None)
        except Exception as exc:
            results[name] = ("✗", 0, 0, str(exc))
            console.print("  [red]FAILED — continuing with remaining sources[/red]")

    # Summary table
    console.print()
    table = Table(title="ETL Run Summary", show_header=True)
    table.add_column("Source")
    table.add_column("Status")
    table.add_column("Rows loaded", justify="right")
    table.add_column("Error")
    for name, (status, loaded, _, error) in results.items():
        colour = "green" if status == "✓" else "red"
        table.add_row(
            name,
            f"[{colour}]{status}[/{colour}]",
            str(loaded) if loaded else "-",
            error or "",
        )
    console.print(table)

    # Refresh the summary view after all sources have run
    _refresh_summary_view()


@cli.command("refresh-summary")
def refresh_summary() -> None:
    """Refresh the school_summary_latest materialised view."""
    if not check_connection():
        console.print("[red]✗ Cannot connect to database[/red]")
        sys.exit(1)
    _refresh_summary_view()


def _refresh_summary_view() -> None:
    """REFRESH MATERIALIZED VIEW CONCURRENTLY school_summary_latest."""
    from sqlalchemy import text
    from school_explorer.database import engine

    try:
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(
                text("REFRESH MATERIALIZED VIEW CONCURRENTLY school_summary_latest")
            )
        console.print("[green]✓ school_summary_latest refreshed[/green]")
    except Exception as exc:
        console.print(f"[yellow]⚠ Could not refresh summary view: {exc}[/yellow]")


@cli.command("status")
def status() -> None:
    """Show the current state of each table in the database."""
    if not check_connection():
        console.print("[red]✗ Cannot connect to database[/red]")
        sys.exit(1)

    from sqlalchemy import text
    from school_explorer.database import get_session

    # Whitelist of (table_name, label, timestamp_column) — no user input, just safer style
    TABLE_SPECS = [
        ("schools",        "Schools",          "updated_at"),
        ("boroughs",       "Boroughs",         "updated_at"),
        ("inspections",    "Inspections",      "updated_at"),
        ("performance_ks2","KS2 Performance",  "updated_at"),
        ("performance_ks4","KS4 Performance",  "updated_at"),
        ("performance_ks5","KS5 Performance",  "updated_at"),
        ("destinations_ks4","KS4 Destinations","updated_at"),
        ("destinations_ks5","KS5 Destinations","updated_at"),
        ("pupils",         "Pupils",           "updated_at"),
        ("workforce",      "Workforce",        "updated_at"),
        ("financials",     "Financials",       "updated_at"),
        ("data_refresh",   "Data Refresh Log", "run_at"),
    ]
    _ALLOWED_TABLES = {spec[0] for spec in TABLE_SPECS}
    _ALLOWED_COLS   = {"updated_at", "run_at"}

    table = Table(title="Database Status", show_header=True)
    table.add_column("Table")
    table.add_column("Rows", justify="right")
    table.add_column("Last updated")

    with get_session() as session:
        for tbl, label, ts_col in TABLE_SPECS:
            assert tbl in _ALLOWED_TABLES and ts_col in _ALLOWED_COLS  # noqa: S101
            try:
                count = session.execute(text(f"SELECT COUNT(*) FROM {tbl}")).scalar()
            except Exception:
                table.add_row(label, "—", "table not found")
                continue

            try:
                updated = session.execute(
                    text(f"SELECT MAX({ts_col}) FROM {tbl}")
                ).scalar()
                updated_str = str(updated)[:16] if updated else "—"
            except Exception:
                updated_str = "—"

            table.add_row(label, str(count), updated_str)

    console.print(table)


if __name__ == "__main__":
    cli()
