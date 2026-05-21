from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from school_explorer.api.routers import meta, school, schools
from school_explorer.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="School Explorer API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(schools.router, prefix="/api/v1")
app.include_router(school.router, prefix="/api/v1")
app.include_router(meta.router, prefix="/api/v1")
