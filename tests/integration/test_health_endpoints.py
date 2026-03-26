"""
Integration Tests for Health and Monitoring Endpoints

Tests system health checks, metrics, and monitoring endpoints.
"""

import pytest
from datetime import datetime


@pytest.mark.integration
@pytest.mark.asyncio
class TestHealthEndpoints:
    """Test suite for health check and monitoring endpoints."""

    async def test_health_check(self, client):
        """Test basic health check endpoint."""
        response = await client.get("/health")

        assert response.status_code == 200
        data = response.json()

        assert "status" in data
        assert data["status"] in ["healthy", "degraded", "unhealthy"]
        assert "version" in data
        assert "timestamp" in data

        # Validate timestamp format
        timestamp = datetime.fromisoformat(data["timestamp"].replace('Z', '+00:00'))
        assert isinstance(timestamp, datetime)

    async def test_health_check_services(self, client):
        """Test health check includes service status."""
        response = await client.get("/health")

        assert response.status_code == 200
        data = response.json()

        assert "services" in data
        services = data["services"]

        # Check required services
        assert "database" in services
        assert services["database"] in ["up", "down"]

        # These might not be present in test environment
        if "cache" in services:
            assert services["cache"] in ["up", "down"]
        if "queue" in services:
            assert services["queue"] in ["up", "down"]

    async def test_metrics_endpoint(self, client):
        """Test metrics endpoint."""
        response = await client.get("/metrics")

        assert response.status_code == 200
        data = response.json()

        # Check for expected metrics
        if "request_count" in data:
            assert isinstance(data["request_count"], int)
            assert data["request_count"] >= 0

        if "avg_response_time_ms" in data:
            assert isinstance(data["avg_response_time_ms"], (int, float))
            assert data["avg_response_time_ms"] >= 0

    async def test_health_check_under_load(self, client):
        """Test health check remains responsive under load."""
        import asyncio

        async def check_health():
            return await client.get("/health")

        # Make multiple concurrent requests
        tasks = [check_health() for _ in range(20)]
        responses = await asyncio.gather(*tasks)

        # All should succeed
        for response in responses:
            assert response.status_code == 200

    async def test_health_check_performance(self, client):
        """Test that health check responds quickly."""
        import time

        start = time.time()
        response = await client.get("/health")
        duration = (time.time() - start) * 1000  # Convert to ms

        assert response.status_code == 200
        # Health check should respond in under 500ms
        assert duration < 500
