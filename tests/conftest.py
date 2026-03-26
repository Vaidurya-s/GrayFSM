"""
Pytest Configuration and Shared Fixtures

This module provides shared fixtures and configuration for all test suites.
"""

import asyncio
import os
from typing import AsyncGenerator, Dict, Generator, List
from uuid import uuid4

import httpx
import pytest
from faker import Faker
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Import backend modules
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.config import Settings
from app.db.base import Base
from app.main import app

# Initialize Faker
fake = Faker()
Faker.seed(12345)

# Test database URL
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/grayfsm_test"
)

# Test Redis URL
TEST_REDIS_URL = os.getenv("TEST_REDIS_URL", "redis://localhost:6379/1")


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_db_engine():
    """Create a test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Drop all tables after tests
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest.fixture
async def db_session(test_db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a database session for tests."""
    async_session = sessionmaker(
        test_db_engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """Create an async HTTP client for testing."""
    async with httpx.AsyncClient(
        app=app,
        base_url="http://testserver/api/v1",
        timeout=30.0
    ) as client:
        yield client


@pytest.fixture
def base_url() -> str:
    """Return the base URL for API testing."""
    return os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")


@pytest.fixture
def sample_fsm_moore() -> Dict:
    """Create a sample Moore FSM for testing."""
    return {
        "name": "Traffic Light Controller",
        "description": "A simple traffic light FSM",
        "fsm_type": "moore",
        "states": ["Red", "Yellow", "Green", "RedYellow"],
        "initial_state": "Red",
        "transitions": [
            {"from_state": "Red", "to_state": "RedYellow", "input": "timer"},
            {"from_state": "RedYellow", "to_state": "Green", "input": "timer"},
            {"from_state": "Green", "to_state": "Yellow", "input": "timer"},
            {"from_state": "Yellow", "to_state": "Red", "input": "timer"}
        ],
        "outputs": {
            "Red": "100",
            "RedYellow": "110",
            "Green": "001",
            "Yellow": "010"
        },
        "visibility": "public",
        "tags": ["example", "traffic", "control"]
    }


@pytest.fixture
def sample_fsm_mealy() -> Dict:
    """Create a sample Mealy FSM for testing."""
    return {
        "name": "Sequence Detector",
        "description": "Detects sequence 1011",
        "fsm_type": "mealy",
        "states": ["S0", "S1", "S2", "S3", "S4"],
        "initial_state": "S0",
        "transitions": [
            {"from_state": "S0", "to_state": "S1", "input": "1", "output": "0"},
            {"from_state": "S0", "to_state": "S0", "input": "0", "output": "0"},
            {"from_state": "S1", "to_state": "S2", "input": "0", "output": "0"},
            {"from_state": "S1", "to_state": "S1", "input": "1", "output": "0"},
            {"from_state": "S2", "to_state": "S3", "input": "1", "output": "0"},
            {"from_state": "S2", "to_state": "S0", "input": "0", "output": "0"},
            {"from_state": "S3", "to_state": "S4", "input": "1", "output": "1"},
            {"from_state": "S3", "to_state": "S2", "input": "0", "output": "0"},
            {"from_state": "S4", "to_state": "S1", "input": "1", "output": "0"},
            {"from_state": "S4", "to_state": "S2", "input": "0", "output": "0"}
        ],
        "visibility": "public",
        "tags": ["example", "detector", "mealy"]
    }


@pytest.fixture
def sample_fsm_complex() -> Dict:
    """Create a complex FSM with many states for performance testing."""
    num_states = 16
    states = [f"S{i}" for i in range(num_states)]

    transitions = []
    for i in range(num_states):
        # Create transitions to multiple states
        transitions.append({
            "from_state": f"S{i}",
            "to_state": f"S{(i + 1) % num_states}",
            "input": "next"
        })
        transitions.append({
            "from_state": f"S{i}",
            "to_state": f"S{(i + 3) % num_states}",
            "input": "skip"
        })

    outputs = {f"S{i}": format(i, '04b') for i in range(num_states)}

    return {
        "name": "Complex FSM",
        "description": "Large FSM for performance testing",
        "fsm_type": "moore",
        "states": states,
        "initial_state": "S0",
        "transitions": transitions,
        "outputs": outputs,
        "visibility": "private",
        "tags": ["test", "performance", "complex"]
    }


@pytest.fixture
def optimization_request_greedy() -> Dict:
    """Create a greedy optimization request."""
    return {
        "algorithm": "greedy",
        "async": False,
        "options": {
            "timeout_ms": 5000
        }
    }


@pytest.fixture
def optimization_request_global() -> Dict:
    """Create a global optimization request."""
    return {
        "algorithm": "global_sa",
        "async": False,
        "options": {
            "timeout_ms": 30000,
            "max_iterations": 1000,
            "temperature": 100.0
        }
    }


@pytest.fixture
def export_request_verilog() -> Dict:
    """Create a Verilog export request."""
    return {
        "format": "verilog",
        "options": {
            "module_name": "fsm_optimized",
            "include_comments": True,
            "style": "standard"
        }
    }


@pytest.fixture
def export_request_vhdl() -> Dict:
    """Create a VHDL export request."""
    return {
        "format": "vhdl",
        "options": {
            "module_name": "fsm_optimized",
            "include_comments": True,
            "style": "standard"
        }
    }


@pytest.fixture
async def created_fsm(client, sample_fsm_moore) -> Dict:
    """Create an FSM and return its data."""
    response = await client.post("/fsms", json=sample_fsm_moore)
    assert response.status_code == 201
    data = response.json()
    return data["data"]


@pytest.fixture
async def optimized_fsm(client, created_fsm, optimization_request_greedy) -> Dict:
    """Create and optimize an FSM."""
    fsm_id = created_fsm["id"]
    response = await client.post(
        f"/fsms/{fsm_id}/optimize",
        json=optimization_request_greedy
    )
    assert response.status_code == 200
    data = response.json()
    return data["data"]


# Performance testing markers
def pytest_configure(config):
    """Configure custom pytest markers."""
    config.addinivalue_line(
        "markers", "contract: marks tests as contract tests (deselect with '-m \"not contract\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "load: marks tests as load tests"
    )
    config.addinivalue_line(
        "markers", "slow: marks tests as slow running"
    )
    config.addinivalue_line(
        "markers", "database: marks tests that require database"
    )
    config.addinivalue_line(
        "markers", "redis: marks tests that require Redis"
    )


# Add custom command line options
def pytest_addoption(parser):
    """Add custom command line options."""
    parser.addoption(
        "--run-slow",
        action="store_true",
        default=False,
        help="Run slow tests"
    )
    parser.addoption(
        "--run-load",
        action="store_true",
        default=False,
        help="Run load tests"
    )
    parser.addoption(
        "--api-url",
        action="store",
        default="http://localhost:8000",
        help="API base URL for testing"
    )


def pytest_collection_modifyitems(config, items):
    """Modify test collection based on markers."""
    if not config.getoption("--run-slow"):
        skip_slow = pytest.mark.skip(reason="need --run-slow option to run")
        for item in items:
            if "slow" in item.keywords:
                item.add_marker(skip_slow)

    if not config.getoption("--run-load"):
        skip_load = pytest.mark.skip(reason="need --run-load option to run")
        for item in items:
            if "load" in item.keywords:
                item.add_marker(skip_load)
