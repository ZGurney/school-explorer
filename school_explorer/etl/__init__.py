"""ETL ingestors — import all here for easy registration in run_etl.py."""

from school_explorer.etl.gias import GIASIngestor
from school_explorer.etl.ofsted import OfstedIngestor
from school_explorer.etl.ks2 import KS2Ingestor
from school_explorer.etl.ks4 import KS4Ingestor
from school_explorer.etl.ks5 import KS5Ingestor
from school_explorer.etl.destinations_ks4 import DestinationsKS4Ingestor
from school_explorer.etl.destinations_ks5 import DestinationsKS5Ingestor
from school_explorer.etl.pupils import PupilsIngestor
from school_explorer.etl.workforce import WorkforceIngestor
from school_explorer.etl.financials import FinancialsIngestor

__all__ = [
    "GIASIngestor",
    "OfstedIngestor",
    "KS2Ingestor",
    "KS4Ingestor",
    "KS5Ingestor",
    "DestinationsKS4Ingestor",
    "DestinationsKS5Ingestor",
    "PupilsIngestor",
    "WorkforceIngestor",
    "FinancialsIngestor",
]
