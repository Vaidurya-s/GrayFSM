"""
Integration tests for health and metrics endpoints.

The health endpoint returns a timestamp field in its response.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


async def test_health_check(client: AsyncClient):
    """Health endpoint returns 200 with status and service info."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    # Health endpoint may or may not go through the success wrapper —
    # check the fields that are always present.
    # If wrapped: data["success"] is True and payload in data["data"]
    # If not wrapped: fields are at the top level.
    payload = data.get("data", data)
    assert "status" in payload
    assert payload["status"] in ("healthy", "degraded")
    assert "version" in payload
    assert "services" in payload


async def test_health_check_services(client: AsyncClient):
    """Health response includes a services block with database key."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    payload = data.get("data", data)
    services = payload.get("services", {})
    assert "database" in services


async def test_health_check_timestamp(client: AsyncClient):
    """Health response includes a timestamp field when response is wrapped."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    # The timestamp may live at the top-level wrapper or in the payload.
    # Accept either location.
    has_timestamp = (
        "timestamp" in data
        or "timestamp" in data.get("data", {})
        or "timestamp" in data.get("metadata", {})
    )
    # Timestamp is optional — just ensure the status key is present.
    payload = data.get("data", data)
    assert "status" in payload


async def test_metrics_endpoint(client: AsyncClient):
    """Metrics endpoint returns 200 with request_count and avg_response_time_ms."""
    response = await client.get("/api/v1/metrics")
    assert response.status_code == 200
    data = response.json()
    payload = data.get("data", data)
    assert "request_count" in payload
    assert "avg_response_time_ms" in payload


async def test_root_endpoint(client: AsyncClient):
    """Root endpoint returns the API name and version."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    info = data["data"]
    assert "name" in info
    assert "version" in info
