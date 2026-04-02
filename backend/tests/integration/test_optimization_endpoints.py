"""
Integration tests for FSM optimization endpoints.

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
# POST /api/v1/fsms/{id}/optimize
# ---------------------------------------------------------------------------

async def test_optimize_fsm_greedy(client: AsyncClient, sample_fsm_payload: dict):
    """Greedy optimization returns 200 with a wrapped OptimizationResponse."""
    fsm_id = await _create_fsm(client, sample_fsm_payload)

    response = await client.post(
        f"/api/v1/fsms/{fsm_id}/optimize",
        json={"algorithm": "greedy", "async_mode": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    result = data["data"]
    assert "optimized_fsm_id" in result
    assert result["algorithm"] == "greedy"
    assert "execution_time_ms" in result
    assert "dummy_states_added" in result
    assert "total_states" in result
    assert "improvement_percentage" in result


async def test_optimize_fsm_bfs(client: AsyncClient, sample_fsm_payload: dict):
    """BFS-optimal optimization returns 200 with a wrapped response."""
    fsm_id = await _create_fsm(client, sample_fsm_payload)

    response = await client.post(
        f"/api/v1/fsms/{fsm_id}/optimize",
        json={"algorithm": "bfs_optimal", "async_mode": False},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["algorithm"] == "bfs_optimal"


async def test_optimize_fsm_not_found(client: AsyncClient):
    """Optimizing a non-existent FSM returns 404."""
    response = await client.post(
        f"/api/v1/fsms/{uuid4()}/optimize",
        json={"algorithm": "greedy", "async_mode": False},
    )
    assert response.status_code == 404


async def test_optimize_fsm_invalid_algorithm(client: AsyncClient, sample_fsm_payload: dict):
    """Requesting an unknown algorithm returns 422 (Pydantic pattern validation)."""
    fsm_id = await _create_fsm(client, sample_fsm_payload)

    response = await client.post(
        f"/api/v1/fsms/{fsm_id}/optimize",
        json={"algorithm": "nonexistent_algo", "async_mode": False},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Optimization metrics field
# ---------------------------------------------------------------------------

async def test_optimization_metrics(client: AsyncClient, sample_fsm_payload: dict):
    """Optimization response includes a metrics block with Hamming distance stats."""
    fsm_id = await _create_fsm(client, sample_fsm_payload)

    response = await client.post(
        f"/api/v1/fsms/{fsm_id}/optimize",
        json={"algorithm": "greedy", "async_mode": False},
    )
    assert response.status_code == 200
    data = response.json()
    metrics = data["data"]["metrics"]
    assert "avg_hamming_before" in metrics
    assert "avg_hamming_after" in metrics
    assert "max_hamming_before" in metrics
    assert "max_hamming_after" in metrics


# ---------------------------------------------------------------------------
# GET /algorithms
# ---------------------------------------------------------------------------

async def test_list_algorithms(client: AsyncClient):
    """Algorithm listing endpoint returns available algorithm metadata."""
    response = await client.get("/api/v1/fsms/algorithms")
    assert response.status_code == 200
    data = response.json()
    # The endpoint returns {"data": [...]} — may or may not be wrapped
    algorithms = data.get("data", data)
    assert isinstance(algorithms, list)
    assert len(algorithms) > 0


# ---------------------------------------------------------------------------
# Skipped: async tasks not implemented
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="endpoint not implemented: async task support not implemented")
async def test_optimize_async(client: AsyncClient, sample_fsm_payload: dict):
    """Async optimization task submission (not implemented)."""
    fsm_id = await _create_fsm(client, sample_fsm_payload)
    response = await client.post(
        f"/api/v1/fsms/{fsm_id}/optimize",
        json={"algorithm": "greedy", "async_mode": True},
    )
    assert response.status_code == 202
    data = response.json()
    assert "task_id" in data["data"]


@pytest.mark.skip(reason="endpoint not implemented: /results endpoint doesn't exist")
async def test_get_optimization_results(client: AsyncClient, sample_fsm_payload: dict):
    """GET /results — endpoint not implemented."""
    response = await client.get("/api/v1/fsms/results")
    assert response.status_code == 200


@pytest.mark.skip(reason="endpoint not implemented: /results endpoint doesn't exist")
async def test_filter_results_by_algorithm(client: AsyncClient):
    """Filter optimization results by algorithm — endpoint not implemented."""
    response = await client.get(
        "/api/v1/fsms/results", params={"algorithm": "greedy"}
    )
    assert response.status_code == 200


@pytest.mark.skip(reason="endpoint not implemented: /compare endpoint doesn't exist")
async def test_compare_algorithms(client: AsyncClient, sample_fsm_payload: dict):
    """Compare multiple algorithms on one FSM — endpoint not implemented."""
    fsm_id = await _create_fsm(client, sample_fsm_payload)
    response = await client.post(
        f"/api/v1/fsms/{fsm_id}/compare",
        json={"algorithms": ["greedy", "bfs_optimal"]},
    )
    assert response.status_code == 200
