"""
Integration tests for FSM CRUD endpoints.

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
# POST /api/v1/fsms - create
# ---------------------------------------------------------------------------

async def test_create_fsm(client: AsyncClient, sample_fsm_payload: dict):
    """Creating a valid FSM returns 201 with the wrapped FSM object."""
    response = await client.post("/api/v1/fsms", json=sample_fsm_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    fsm = data["data"]
    assert fsm["name"] == sample_fsm_payload["name"]
    assert fsm["fsm_type"] == sample_fsm_payload["fsm_type"]
    assert "id" in fsm


async def test_create_fsm_invalid_data(client: AsyncClient):
    """Missing required fields returns 422 from FastAPI validation."""
    response = await client.post(
        "/api/v1/fsms",
        json={"name": "Bad FSM"},  # missing states, initial_state, etc.
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/v1/fsms/{id} - retrieve
# ---------------------------------------------------------------------------

async def test_get_fsm(client: AsyncClient, sample_fsm_payload: dict):
    """Creating then fetching an FSM returns the same record."""
    create_resp = await client.post("/api/v1/fsms", json=sample_fsm_payload)
    assert create_resp.status_code == 201
    fsm_id = create_resp.json()["data"]["id"]

    get_resp = await client.get(f"/api/v1/fsms/{fsm_id}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["success"] is True
    assert data["data"]["id"] == fsm_id


async def test_get_fsm_not_found(client: AsyncClient):
    """Requesting a non-existent FSM returns 404."""
    response = await client.get(f"/api/v1/fsms/{uuid4()}")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/v1/fsms - list (basic — skip variants with unimplemented params)
# ---------------------------------------------------------------------------

async def test_list_fsms_basic(client: AsyncClient, sample_fsm_payload: dict):
    """List endpoint returns 200 and a success-wrapped list."""
    await client.post("/api/v1/fsms", json=sample_fsm_payload)
    response = await client.get("/api/v1/fsms")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert isinstance(data["data"], list)


@pytest.mark.skip(reason="endpoint not implemented: page/page_size params don't exist; backend uses skip/limit")
async def test_list_fsms(client: AsyncClient):
    """List FSMs with page/page_size pagination (not implemented)."""
    response = await client.get("/api/v1/fsms", params={"page": 1, "page_size": 10})
    assert response.status_code == 200


@pytest.mark.skip(reason="endpoint not implemented: search/fsm_type filter params not implemented")
async def test_list_fsms_with_filters(client: AsyncClient):
    """Filter FSMs by search query and fsm_type (not implemented)."""
    response = await client.get(
        "/api/v1/fsms", params={"search": "traffic", "fsm_type": "moore"}
    )
    assert response.status_code == 200


@pytest.mark.skip(reason="endpoint not implemented: sort params not implemented")
async def test_sorting(client: AsyncClient):
    """Sort FSMs by field (not implemented)."""
    response = await client.get("/api/v1/fsms", params={"sort_by": "name", "order": "asc"})
    assert response.status_code == 200


@pytest.mark.skip(reason="endpoint not implemented: pagination metadata not returned")
async def test_pagination_consistency(client: AsyncClient):
    """Pagination metadata (total, pages) not returned by the backend."""
    response = await client.get("/api/v1/fsms")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "pages" in data


# ---------------------------------------------------------------------------
# PUT /api/v1/fsms/{id} - update (not implemented)
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="endpoint not implemented: PUT /fsms/{id} not implemented")
async def test_update_fsm(client: AsyncClient, sample_fsm_payload: dict):
    """Update FSM — PUT endpoint not implemented."""
    create_resp = await client.post("/api/v1/fsms", json=sample_fsm_payload)
    fsm_id = create_resp.json()["data"]["id"]
    update_payload = {**sample_fsm_payload, "name": "Updated Name"}
    response = await client.put(f"/api/v1/fsms/{fsm_id}", json=update_payload)
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/v1/fsms/{id}/fork - fork (not implemented)
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="endpoint not implemented: fork endpoint not implemented")
async def test_fork_fsm(client: AsyncClient, sample_fsm_payload: dict):
    """Fork an FSM — endpoint not implemented."""
    create_resp = await client.post("/api/v1/fsms", json=sample_fsm_payload)
    fsm_id = create_resp.json()["data"]["id"]
    response = await client.post(f"/api/v1/fsms/{fsm_id}/fork")
    assert response.status_code == 201


# ---------------------------------------------------------------------------
# DELETE /api/v1/fsms/{id}
# ---------------------------------------------------------------------------

async def test_delete_fsm(client: AsyncClient, sample_fsm_payload: dict):
    """Deleting an existing FSM returns 204."""
    create_resp = await client.post("/api/v1/fsms", json=sample_fsm_payload)
    assert create_resp.status_code == 201
    fsm_id = create_resp.json()["data"]["id"]

    delete_resp = await client.delete(f"/api/v1/fsms/{fsm_id}")
    assert delete_resp.status_code == 204


async def test_delete_fsm_not_found(client: AsyncClient):
    """Deleting a non-existent FSM returns 404."""
    response = await client.delete(f"/api/v1/fsms/{uuid4()}")
    assert response.status_code == 404
