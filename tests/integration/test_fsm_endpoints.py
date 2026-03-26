"""
Integration Tests for FSM Endpoints

Tests all FSM-related API endpoints with real database interactions.
"""

import pytest
from uuid import uuid4


@pytest.mark.integration
@pytest.mark.database
@pytest.mark.asyncio
class TestFSMEndpoints:
    """Test suite for FSM CRUD operations."""

    async def test_create_fsm_moore(self, client, sample_fsm_moore):
        """Test creating a Moore FSM."""
        response = await client.post("/fsms", json=sample_fsm_moore)

        assert response.status_code == 201
        data = response.json()

        assert data["success"] is True
        assert "data" in data
        assert data["data"]["name"] == sample_fsm_moore["name"]
        assert data["data"]["fsm_type"] == "moore"
        assert data["data"]["state_count"] == len(sample_fsm_moore["states"])
        assert data["data"]["transition_count"] == len(sample_fsm_moore["transitions"])
        assert "id" in data["data"]
        assert "created_at" in data["data"]

    async def test_create_fsm_mealy(self, client, sample_fsm_mealy):
        """Test creating a Mealy FSM."""
        response = await client.post("/fsms", json=sample_fsm_mealy)

        assert response.status_code == 201
        data = response.json()

        assert data["success"] is True
        assert data["data"]["fsm_type"] == "mealy"

    async def test_create_fsm_invalid_data(self, client):
        """Test creating FSM with invalid data."""
        invalid_fsm = {
            "name": "Invalid FSM",
            "fsm_type": "invalid_type",
            "states": [],
            "initial_state": "S0",
            "transitions": []
        }

        response = await client.post("/fsms", json=invalid_fsm)

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert "error" in data

    async def test_create_fsm_missing_fields(self, client):
        """Test creating FSM with missing required fields."""
        incomplete_fsm = {
            "name": "Incomplete FSM"
        }

        response = await client.post("/fsms", json=incomplete_fsm)

        assert response.status_code == 422

    async def test_get_fsm_by_id(self, client, created_fsm):
        """Test retrieving an FSM by ID."""
        fsm_id = created_fsm["id"]
        response = await client.get(f"/fsms/{fsm_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["id"] == fsm_id
        assert data["data"]["name"] == created_fsm["name"]

    async def test_get_fsm_not_found(self, client):
        """Test retrieving non-existent FSM."""
        fake_id = str(uuid4())
        response = await client.get(f"/fsms/{fake_id}")

        assert response.status_code == 404
        data = response.json()
        assert data["success"] is False

    async def test_list_fsms(self, client, created_fsm):
        """Test listing FSMs with pagination."""
        response = await client.get("/fsms", params={"page": 1, "page_size": 20})

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"], list)
        assert "pagination" in data
        assert data["pagination"]["page"] == 1

    async def test_list_fsms_with_filters(self, client, created_fsm):
        """Test listing FSMs with various filters."""
        # Filter by FSM type
        response = await client.get("/fsms", params={"fsm_type": "moore"})
        assert response.status_code == 200

        # Filter by visibility
        response = await client.get("/fsms", params={"visibility": "public"})
        assert response.status_code == 200

        # Search by name
        response = await client.get("/fsms", params={"search": "Traffic"})
        assert response.status_code == 200

    async def test_update_fsm(self, client, created_fsm):
        """Test updating an FSM."""
        fsm_id = created_fsm["id"]
        update_data = {
            "name": "Updated Traffic Light",
            "description": "Updated description",
            "tags": ["updated", "test"]
        }

        response = await client.put(f"/fsms/{fsm_id}", json=update_data)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["name"] == update_data["name"]
        assert data["data"]["description"] == update_data["description"]

    async def test_delete_fsm(self, client, sample_fsm_moore):
        """Test deleting an FSM."""
        # Create FSM to delete
        create_response = await client.post("/fsms", json=sample_fsm_moore)
        fsm_id = create_response.json()["data"]["id"]

        # Delete FSM
        response = await client.delete(f"/fsms/{fsm_id}")
        assert response.status_code == 204

        # Verify deletion
        get_response = await client.get(f"/fsms/{fsm_id}")
        assert get_response.status_code == 404

    async def test_fork_fsm(self, client, created_fsm):
        """Test forking an FSM."""
        fsm_id = created_fsm["id"]
        fork_data = {"name": "Forked Traffic Light"}

        response = await client.post(f"/fsms/{fsm_id}/fork", json=fork_data)

        assert response.status_code == 201
        data = response.json()

        assert data["success"] is True
        assert data["data"]["name"] == fork_data["name"]
        assert data["data"]["id"] != fsm_id
        assert data["data"]["states"] == created_fsm["states"]

    async def test_pagination_consistency(self, client):
        """Test pagination consistency across multiple requests."""
        # Get first page
        response1 = await client.get("/fsms", params={"page": 1, "page_size": 10})
        data1 = response1.json()

        # Get second page
        response2 = await client.get("/fsms", params={"page": 2, "page_size": 10})
        data2 = response2.json()

        # Verify pagination metadata
        assert data1["pagination"]["page"] == 1
        assert data2["pagination"]["page"] == 2

        # Verify no duplicate items
        ids1 = {item["id"] for item in data1["data"]}
        ids2 = {item["id"] for item in data2["data"]}
        assert ids1.isdisjoint(ids2)

    async def test_sorting(self, client):
        """Test different sorting options."""
        # Sort by created_at descending
        response = await client.get(
            "/fsms",
            params={"sort_by": "created_at", "sort_order": "desc"}
        )
        assert response.status_code == 200

        # Sort by name ascending
        response = await client.get(
            "/fsms",
            params={"sort_by": "name", "sort_order": "asc"}
        )
        assert response.status_code == 200

    async def test_concurrent_fsm_creation(self, client, sample_fsm_moore):
        """Test creating multiple FSMs concurrently."""
        import asyncio

        async def create_fsm(name):
            fsm_data = sample_fsm_moore.copy()
            fsm_data["name"] = name
            return await client.post("/fsms", json=fsm_data)

        # Create 10 FSMs concurrently
        tasks = [create_fsm(f"FSM {i}") for i in range(10)]
        responses = await asyncio.gather(*tasks)

        # All should succeed
        for response in responses:
            assert response.status_code == 201

        # All should have unique IDs
        ids = [r.json()["data"]["id"] for r in responses]
        assert len(ids) == len(set(ids))
