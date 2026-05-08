"""
Integration Tests for Optimization Endpoints

Tests FSM optimization algorithms and related endpoints.
"""

import pytest
import asyncio
from uuid import uuid4


@pytest.mark.integration
@pytest.mark.database
@pytest.mark.asyncio
class TestOptimizationEndpoints:
    """Test suite for FSM optimization operations."""

    async def test_optimize_fsm_greedy(self, auth_client, created_fsm, optimization_request_greedy):
        """Test greedy optimization algorithm."""
        fsm_id = created_fsm["id"]
        response = await auth_client.post(
            f"/fsms/{fsm_id}/optimize",
            json=optimization_request_greedy
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "data" in data
        assert data["data"]["algorithm"] == "greedy"
        assert "execution_time_ms" in data["data"]
        assert "dummy_states_added" in data["data"]
        assert "optimized_fsm_id" in data["data"]
        assert data["data"]["execution_time_ms"] > 0

    async def test_optimize_fsm_global(self, auth_client, created_fsm, optimization_request_global):
        """Test global optimization algorithm."""
        fsm_id = created_fsm["id"]
        response = await auth_client.post(
            f"/fsms/{fsm_id}/optimize",
            json=optimization_request_global
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["algorithm"] == "global_sa"

    async def test_optimize_async(self, auth_client, created_fsm):
        """Test asynchronous optimization."""
        fsm_id = created_fsm["id"]
        request_data = {
            "algorithm": "global_sa",
            "async": True,
            "options": {
                "timeout_ms": 60000,
                "max_iterations": 5000
            }
        }

        response = await auth_client.post(
            f"/fsms/{fsm_id}/optimize",
            json=request_data
        )

        assert response.status_code == 202
        data = response.json()

        assert "task_id" in data
        assert data["status"] in ["pending", "running"]
        assert "status_url" in data

        # Check task status
        task_id = data["task_id"]
        await asyncio.sleep(2)  # Wait for task to process

        status_response = await auth_client.get(f"/tasks/{task_id}")
        assert status_response.status_code == 200
        status_data = status_response.json()
        assert status_data["task_id"] == task_id
        assert status_data["status"] in ["pending", "running", "completed", "failed"]

    async def test_optimize_invalid_algorithm(self, auth_client, created_fsm):
        """Test optimization with invalid algorithm."""
        fsm_id = created_fsm["id"]
        request_data = {
            "algorithm": "invalid_algorithm",
            "async": False
        }

        response = await auth_client.post(
            f"/fsms/{fsm_id}/optimize",
            json=request_data
        )

        assert response.status_code == 422

    async def test_optimize_nonexistent_fsm(self, auth_client, optimization_request_greedy):
        """Test optimizing non-existent FSM."""
        fake_id = str(uuid4())
        response = await auth_client.post(
            f"/fsms/{fake_id}/optimize",
            json=optimization_request_greedy
        )

        assert response.status_code == 404

    async def test_get_optimization_results(self, auth_client, created_fsm, optimization_request_greedy):
        """Test retrieving optimization results."""
        fsm_id = created_fsm["id"]

        # Run optimization
        await auth_client.post(
            f"/fsms/{fsm_id}/optimize",
            json=optimization_request_greedy
        )

        # Get results
        response = await auth_client.get(f"/fsms/{fsm_id}/results")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert isinstance(data["data"], list)
        assert len(data["data"]) > 0

        result = data["data"][0]
        assert "algorithm" in result
        assert "execution_time_ms" in result
        assert "dummy_states_added" in result

    async def test_filter_results_by_algorithm(self, auth_client, created_fsm, optimization_request_greedy):
        """Test filtering optimization results by algorithm."""
        fsm_id = created_fsm["id"]

        # Run optimization
        await auth_client.post(
            f"/fsms/{fsm_id}/optimize",
            json=optimization_request_greedy
        )

        # Filter by algorithm
        response = await auth_client.get(
            f"/fsms/{fsm_id}/results",
            params={"algorithm": "greedy"}
        )

        assert response.status_code == 200
        data = response.json()

        for result in data["data"]:
            assert result["algorithm"] == "greedy"

    async def test_compare_algorithms(self, auth_client, created_fsm):
        """Test comparing multiple optimization algorithms."""
        fsm_id = created_fsm["id"]
        compare_request = {
            "algorithms": ["greedy", "bfs_optimal"],
            "options": {
                "timeout_ms": 10000
            }
        }

        response = await auth_client.post(
            f"/fsms/{fsm_id}/compare",
            json=compare_request
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert len(data["data"]) == 2

        algorithms = {result["algorithm"] for result in data["data"]}
        assert "greedy" in algorithms
        assert "bfs_optimal" in algorithms

    async def test_optimization_metrics(self, auth_client, created_fsm, optimization_request_greedy):
        """Test that optimization provides detailed metrics."""
        fsm_id = created_fsm["id"]
        response = await auth_client.post(
            f"/fsms/{fsm_id}/optimize",
            json=optimization_request_greedy
        )

        data = response.json()
        metrics = data["data"]["metrics"]

        assert "avg_hamming_before" in metrics
        assert "avg_hamming_after" in metrics
        assert "max_hamming_before" in metrics
        assert "max_hamming_after" in metrics
        assert metrics["avg_hamming_after"] <= metrics["avg_hamming_before"]

    async def test_optimization_timeout(self, auth_client, created_fsm):
        """Test optimization timeout handling."""
        fsm_id = created_fsm["id"]
        request_data = {
            "algorithm": "global_sa",
            "async": False,
            "options": {
                "timeout_ms": 100,  # Very short timeout
                "max_iterations": 100000
            }
        }

        response = await auth_client.post(
            f"/fsms/{fsm_id}/optimize",
            json=request_data
        )

        # Should either complete quickly or timeout gracefully
        assert response.status_code in [200, 408, 500]

    async def test_optimization_idempotency(self, auth_client, created_fsm, optimization_request_greedy):
        """Test that running optimization multiple times is idempotent."""
        fsm_id = created_fsm["id"]

        # Run optimization twice
        response1 = await auth_client.post(
            f"/fsms/{fsm_id}/optimize",
            json=optimization_request_greedy
        )
        response2 = await auth_client.post(
            f"/fsms/{fsm_id}/optimize",
            json=optimization_request_greedy
        )

        assert response1.status_code == 200
        assert response2.status_code == 200

        data1 = response1.json()["data"]
        data2 = response2.json()["data"]

        # Results should be consistent
        assert data1["dummy_states_added"] == data2["dummy_states_added"]
        assert data1["algorithm"] == data2["algorithm"]

    @pytest.mark.slow
    async def test_large_fsm_optimization(self, auth_client, sample_fsm_complex):
        """Test optimization performance on large FSM."""
        # Create large FSM
        create_response = await auth_client.post("/fsms", json=sample_fsm_complex)
        assert create_response.status_code == 201
        fsm_id = create_response.json()["data"]["id"]

        # Optimize with greedy (should be fast)
        request_data = {
            "algorithm": "greedy",
            "async": False,
            "options": {"timeout_ms": 30000}
        }

        response = await auth_client.post(
            f"/fsms/{fsm_id}/optimize",
            json=request_data
        )

        assert response.status_code == 200
        data = response.json()

        # Should complete in reasonable time
        assert data["data"]["execution_time_ms"] < 30000
        assert data["data"]["dummy_states_added"] >= 0
