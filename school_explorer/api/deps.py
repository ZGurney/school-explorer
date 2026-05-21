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
