"""
Import all models here so that:
  1. Base.metadata.create_all() can see every table.
  2. Alembic's env.py picks them up via `from school_explorer.models import Base`.
"""

from school_explorer.models.base import Base, TimestampMixin
from school_explorer.models.school import Borough, School
from school_explorer.models.inspection import Inspection
from school_explorer.models.performance import PerformanceKS2, PerformanceKS4, PerformanceKS5
from school_explorer.models.destinations import DestinationsKS4, DestinationsKS5
from school_explorer.models.context import Pupils, Workforce, Financials
from school_explorer.models.refresh import DataRefresh

__all__ = [
    "Base",
    "TimestampMixin",
    "Borough",
    "School",
    "Inspection",
    "PerformanceKS2",
    "PerformanceKS4",
    "PerformanceKS5",
    "DestinationsKS4",
    "DestinationsKS5",
    "Pupils",
    "Workforce",
    "Financials",
    "DataRefresh",
]
