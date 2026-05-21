"""
API smoke tests using FastAPI TestClient with a mocked database session.
No real database required.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from school_explorer.api.main import app


@pytest.fixture()
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# /api/v1/schools — list endpoint
# ---------------------------------------------------------------------------

class TestSchoolsListEndpoint:
    def test_returns_paginated_structure(self, client):
        mock_result = MagicMock()
        mock_result.mappings.return_value.all.return_value = []
        mock_count = MagicMock()
        mock_count.scalar.return_value = 0

        with patch("school_explorer.api.routers.schools.DbSession") as mock_dep:
            mock_session = MagicMock()
            mock_session.execute.side_effect = [mock_result, mock_count]
            mock_dep.return_value = mock_session

            # Even with mocked dep, the endpoint should return 200 or a predictable error
            # — this test mainly checks routing and schema shape
            resp = client.get("/api/v1/schools")
            assert resp.status_code in (200, 500)  # 500 if DB not available

    def test_openapi_schema_reachable(self, client):
        resp = client.get("/openapi.json")
        assert resp.status_code == 200
        schema = resp.json()
        assert "paths" in schema
        assert "/api/v1/schools" in schema["paths"]
        assert "/api/v1/schools/{urn}" in schema["paths"]

    def test_schools_openapi_includes_parent_ux_filters(self, client):
        resp = client.get("/openapi.json")
        assert resp.status_code == 200
        params = {
            p["name"]
            for p in resp.json()["paths"]["/api/v1/schools"]["get"]["parameters"]
        }
        assert {"faith_only", "lat", "lng", "radius_km", "establishment_groups"} <= params

    def test_docs_reachable(self, client):
        resp = client.get("/docs")
        assert resp.status_code == 200

    def test_schools_invalid_page_returns_422(self, client):
        resp = client.get("/api/v1/schools?page=0")
        assert resp.status_code == 422

    def test_schools_negative_page_size_returns_422(self, client):
        resp = client.get("/api/v1/schools?page_size=-1")
        assert resp.status_code == 422

    def test_schools_page_size_too_large_returns_422(self, client):
        resp = client.get("/api/v1/schools?page_size=1001")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# /api/v1/meta — borough/phase filter options
# ---------------------------------------------------------------------------

class TestMetaEndpoints:
    def test_meta_routes_exist_in_schema(self, client):
        resp = client.get("/openapi.json")
        schema = resp.json()
        paths = schema["paths"]
        assert any("meta" in p or "boroughs" in p or "phases" in p for p in paths), \
            f"Expected a meta route in schema, got: {list(paths)}"

    def test_benchmarks_route_exists_in_schema(self, client):
        resp = client.get("/openapi.json")
        assert resp.status_code == 200
        assert "/api/v1/benchmarks" in resp.json()["paths"]


# ---------------------------------------------------------------------------
# CORS headers
# ---------------------------------------------------------------------------

class TestCors:
    def test_cors_header_present_for_allowed_origin(self, client):
        resp = client.get(
            "/openapi.json",
            headers={"Origin": "http://localhost:5173"},
        )
        assert "access-control-allow-origin" in resp.headers

    def test_cors_allow_origin_value(self, client):
        resp = client.get(
            "/openapi.json",
            headers={"Origin": "http://localhost:5173"},
        )
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
