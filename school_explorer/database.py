from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from school_explorer.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,       # detects stale connections
    pool_size=5,
    max_overflow=10,
    echo=False,               # set True for SQL debugging
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Context manager that yields a Session and commits or rolls back."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def create_all_tables() -> None:
    """Create all tables from SQLAlchemy metadata. Used for local dev setup."""
    from school_explorer.models import Base  # noqa: F401 — side-effect import registers models
    Base.metadata.create_all(bind=engine)


def check_connection() -> bool:
    """Return True if the database is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
