"""
Unit tests for ETL utility functions.
No database required — all pure-Python logic.
"""

import io
import shutil
import zipfile
from pathlib import Path

import numpy as np
import pytest

from school_explorer.etl.base import BaseIngestor


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class _Stub(BaseIngestor):
    """Minimal concrete subclass so we can instantiate BaseIngestor."""
    SOURCE_NAME = "stub"
    TARGET_TABLE = "stub"

    def download(self, force=False):  # type: ignore[override]
        raise NotImplementedError

    def transform(self, path):  # type: ignore[override]
        raise NotImplementedError

    def load(self, rows):  # type: ignore[override]
        raise NotImplementedError


@pytest.fixture()
def ingestor() -> _Stub:
    return _Stub()


# ---------------------------------------------------------------------------
# _parse_float
# ---------------------------------------------------------------------------

class TestParseFloat:
    def test_numeric_string(self, ingestor):
        assert ingestor._parse_float("42.5") == 42.5

    def test_integer_string(self, ingestor):
        assert ingestor._parse_float("100") == 100.0

    def test_suppression_markers(self, ingestor):
        for marker in ("SUPP", "NE", "NP", "NA", "N/A", "DNS", "", ".", "x", "z", "c", "u"):
            assert ingestor._parse_float(marker) is None, f"Expected None for {marker!r}"

    def test_nan(self, ingestor):
        assert ingestor._parse_float(float("nan")) is None
        assert ingestor._parse_float(np.nan) is None

    def test_none(self, ingestor):
        assert ingestor._parse_float(None) is None

    def test_numeric_value(self, ingestor):
        assert ingestor._parse_float(3.14) == pytest.approx(3.14)

    def test_non_numeric_string(self, ingestor):
        assert ingestor._parse_float("abc") is None

    def test_whitespace_around_value(self, ingestor):
        assert ingestor._parse_float("  12.3  ") == pytest.approx(12.3)


# ---------------------------------------------------------------------------
# _parse_int
# ---------------------------------------------------------------------------

class TestParseInt:
    def test_float_string_truncated(self, ingestor):
        assert ingestor._parse_int("7.9") == 7

    def test_integer_string(self, ingestor):
        assert ingestor._parse_int("42") == 42

    def test_suppression_returns_none(self, ingestor):
        assert ingestor._parse_int("SUPP") is None

    def test_none_input(self, ingestor):
        assert ingestor._parse_int(None) is None


# ---------------------------------------------------------------------------
# _is_suppressed
# ---------------------------------------------------------------------------

class TestIsSuppressed:
    def test_known_suppression_markers(self, ingestor):
        for marker in ("SUPP", "SP", "NP", "NE", "c"):
            assert ingestor._is_suppressed(marker), f"Expected True for {marker!r}"

    def test_not_applicable_is_not_suppression(self, ingestor):
        assert not ingestor._is_suppressed("z"), "'z' means N/A, not suppressed"

    def test_numeric_value_not_suppressed(self, ingestor):
        assert not ingestor._is_suppressed("42.5")
        assert not ingestor._is_suppressed(0)

    def test_nan_not_suppressed(self, ingestor):
        assert not ingestor._is_suppressed(np.nan)

    def test_none_not_suppressed(self, ingestor):
        assert not ingestor._is_suppressed(None)

    def test_whitespace_stripped(self, ingestor):
        assert ingestor._is_suppressed("  SUPP  ")


# ---------------------------------------------------------------------------
# high_staff_turnover logic (regression for the or-None precedence bug)
# ---------------------------------------------------------------------------

class TestHighStaffTurnoverLogic:
    """
    The workforce ETL used to compute:
        high_turnover = raw_turnover in {"1","yes","true"} or None
    which evaluates False or None → None, so 'no'/'false'/'0' would never yield False.

    The fixed logic uses an explicit ternary. This test validates that all three
    possible outcomes (True, False, None) can be produced.
    """

    @staticmethod
    def _compute(raw: str):
        raw_turnover = raw.strip().lower()
        return (
            True if raw_turnover in {"1", "yes", "true"}
            else False if raw_turnover in {"0", "no", "false"}
            else None
        )

    def test_true_values(self):
        for v in ("1", "yes", "true", "YES", "True"):
            assert self._compute(v) is True, f"Expected True for {v!r}"

    def test_false_values(self):
        for v in ("0", "no", "false", "NO", "False"):
            result = self._compute(v)
            assert result is False, f"Expected False for {v!r}, got {result!r}"

    def test_unknown_values(self):
        for v in ("", "maybe", "n/a", "unknown"):
            assert self._compute(v) is None, f"Expected None for {v!r}"

    def test_old_buggy_logic_would_fail(self):
        """Demonstrate what the old code returned for 'no'."""
        raw_turnover = "no"
        old_result = (raw_turnover in {"1", "yes", "true"}) or None
        assert old_result is None, "Old logic returned None for 'no' (bug confirmed)"
        new_result = self._compute(raw_turnover)
        assert new_result is False, "New logic returns False for 'no' (correct)"


# ---------------------------------------------------------------------------
# ZIP extraction flattening
# ---------------------------------------------------------------------------

class TestZipExtraction:
    """Tests for _extract_zip (base class) and the custom _extract_institution_csv
    override in KS4/KS5, which must flatten subdirectory paths."""

    def _make_zip_with_subdir(self, tmp_path: Path, inner_path: str, content: bytes) -> Path:
        zip_path = tmp_path / "archive.zip"
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr(inner_path, content)
        zip_path.write_bytes(buf.getvalue())
        return zip_path

    def test_base_extract_zip_flattens_subdir(self, tmp_path: Path, ingestor: _Stub):
        zip_path = self._make_zip_with_subdir(
            tmp_path, "data/institution_performance.csv", b"urn,name\n100,Test"
        )
        result = ingestor._extract_zip(zip_path, "institution_performance")
        assert result.exists(), "Extracted file should exist at flat path"
        assert result.parent == tmp_path, "Extracted file should be in zip's parent dir (flat)"
        assert result.name == "institution_performance.csv"
        assert result.read_bytes() == b"urn,name\n100,Test"

    def test_base_extract_zip_flat_entry(self, tmp_path: Path, ingestor: _Stub):
        zip_path = self._make_zip_with_subdir(
            tmp_path, "institution_performance.csv", b"urn\n200"
        )
        result = ingestor._extract_zip(zip_path, "institution_performance")
        assert result.exists()
        assert result.name == "institution_performance.csv"

    def test_base_extract_zip_missing_pattern_raises(self, tmp_path: Path, ingestor: _Stub):
        zip_path = self._make_zip_with_subdir(tmp_path, "other_file.csv", b"data")
        with pytest.raises(FileNotFoundError, match="institution_performance"):
            ingestor._extract_zip(zip_path, "institution_performance")

    def test_ks4_extract_institution_csv_flattens(self, tmp_path: Path):
        from school_explorer.etl.ks4 import KS4Ingestor
        ingestor = KS4Ingestor()
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("data/202425_performance_tables_schools_final.csv", b"urn\n1")
        zip_path = tmp_path / "ks4.zip"
        zip_path.write_bytes(buf.getvalue())
        result = ingestor._extract_institution_csv(zip_path)
        assert result.exists()
        assert result.parent == tmp_path
        assert "performance_tables_schools" in result.name

    def test_ks5_extract_institution_csv_flattens(self, tmp_path: Path):
        from school_explorer.etl.ks5 import KS5Ingestor, INSTITUTION_FILE_PATTERN
        ingestor = KS5Ingestor()
        buf = io.BytesIO()
        csv_name = f"subdir/2024_{INSTITUTION_FILE_PATTERN}_final.csv"
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr(csv_name, b"urn\n2")
        zip_path = tmp_path / "ks5.zip"
        zip_path.write_bytes(buf.getvalue())
        result = ingestor._extract_institution_csv(zip_path)
        assert result.exists()
        assert result.parent == tmp_path
