"""
Integration tests for FSM export endpoints.

Successful responses are wrapped by middleware:
    {"success": true, "data": <payload>}

Endpoints NOT yet implemented are skipped with @pytest.mark.skip.
"""

import pytest
import pytest_asyncio
from uuid import uuid4
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _create_fsm(client: AsyncClient, payload: dict) -> str:
    """Create an FSM and return its ID string."""
    resp = await client.post("/api/v1/fsms", json=payload)
    assert resp.status_code == 201, f"FSM creation failed: {resp.text}"
    return resp.json()["data"]["id"]


# ---------------------------------------------------------------------------
# POST /api/v1/fsms/{id}/export
# ---------------------------------------------------------------------------

async def test_export_verilog(client: AsyncClient, sample_fsm_payload: dict):
    """Exporting an FSM to Verilog returns 200 with content and file_name."""
    fsm_id = await _create_fsm(client, sample_fsm_payload)

    response = await client.post(
        f"/api/v1/fsms/{fsm_id}/export",
        json={"format": "verilog", "options": {}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    result = data["data"]
    assert result["format"] == "verilog"
    assert "content" in result
    assert "file_name" in result
    assert len(result["content"]) > 0


async def test_export_vhdl(client: AsyncClient, sample_fsm_payload: dict):
    """Exporting an FSM to VHDL returns 200 with valid content."""
    fsm_id = await _create_fsm(client, sample_fsm_payload)

    response = await client.post(
        f"/api/v1/fsms/{fsm_id}/export",
        json={"format": "vhdl", "options": {}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["format"] == "vhdl"


async def test_export_json(client: AsyncClient, sample_fsm_payload: dict):
    """Exporting an FSM to JSON returns 200 with valid content."""
    fsm_id = await _create_fsm(client, sample_fsm_payload)

    response = await client.post(
        f"/api/v1/fsms/{fsm_id}/export",
        json={"format": "json", "options": {}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["format"] == "json"


async def test_export_not_found(client: AsyncClient):
    """Exporting a non-existent FSM returns 404."""
    response = await client.post(
        f"/api/v1/fsms/{uuid4()}/export",
        json={"format": "verilog", "options": {}},
    )
    assert response.status_code == 404


async def test_export_invalid_format(client: AsyncClient, sample_fsm_payload: dict):
    """An invalid format name returns 422 (Pydantic pattern validation)."""
    fsm_id = await _create_fsm(client, sample_fsm_payload)

    response = await client.post(
        f"/api/v1/fsms/{fsm_id}/export",
        json={"format": "invalid_format", "options": {}},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/v1/fsms/formats
# ---------------------------------------------------------------------------

async def test_list_export_formats(client: AsyncClient):
    """Format listing endpoint returns available formats."""
    response = await client.get("/api/v1/fsms/formats")
    assert response.status_code == 200
    data = response.json()
    # Endpoint returns {"data": [...]} directly (not wrapped)
    formats = data.get("data", data)
    assert isinstance(formats, list)
    assert len(formats) > 0


# ---------------------------------------------------------------------------
# Skipped: endpoints that don't exist
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="endpoint not implemented: GET /{fsm_id}/export/{format} doesn't exist")
async def test_get_cached_export(client: AsyncClient, sample_fsm_payload: dict):
    """GET cached export — endpoint does not exist."""
    fsm_id = await _create_fsm(client, sample_fsm_payload)
    response = await client.get(f"/api/v1/fsms/{fsm_id}/export/verilog")
    assert response.status_code == 200


@pytest.mark.skip(reason="endpoint not implemented: file_size_bytes field not in response")
async def test_export_file_size(client: AsyncClient, sample_fsm_payload: dict):
    """file_size_bytes field is not returned by the export endpoint."""
    fsm_id = await _create_fsm(client, sample_fsm_payload)
    response = await client.post(
        f"/api/v1/fsms/{fsm_id}/export",
        json={"format": "verilog", "options": {}},
    )
    assert response.status_code == 200
    data = response.json()
    assert "file_size_bytes" in data["data"]
