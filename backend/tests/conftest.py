"""
Pytest configuration and fixtures for GrayFSM backend tests.

All core algorithm tests are pure functions with no database dependency.
"""

import os

# Pin ENVIRONMENT=test BEFORE the first `app.*` import so config.py's
# runtime validator skips the placeholder-URL check. Without this, a
# fresh clone without backend/.env would fail at `from app.config import
# settings` (transitively imported by app.middleware.token_blacklist
# and others). Matches the env var the CI workflows already export.
os.environ.setdefault("ENVIRONMENT", "test")

import json  # noqa: E402
import sys  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

# Ensure 'backend/' is on the import path so 'app.*' imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ---------------------------------------------------------------------------
# Example FSM data loaded from backend/examples/ JSON files
# ---------------------------------------------------------------------------

EXAMPLES_DIR = os.path.join(os.path.dirname(__file__), "..", "examples")


def _load_example(filename: str) -> dict:
    """Load an example FSM JSON file."""
    path = os.path.join(EXAMPLES_DIR, filename)
    with open(path, "r") as f:
        return json.load(f)


@pytest.fixture
def elevator_fsm_data():
    """Elevator controller FSM data (7-state Moore)."""
    return _load_example("elevator.json")


@pytest.fixture
def traffic_light_fsm_data():
    """Traffic light controller FSM data (4-state Moore)."""
    return _load_example("traffic_light.json")


@pytest.fixture
def sequence_detector_fsm_data():
    """101 sequence detector FSM data (4-state Mealy)."""
    return _load_example("sequence_detector.json")


@pytest.fixture
def vending_machine_fsm_data():
    """Vending machine FSM data (4-state Moore)."""
    return _load_example("vending_machine.json")


@pytest.fixture(
    params=["elevator.json", "traffic_light.json", "sequence_detector.json", "vending_machine.json"]
)
def any_example_fsm_data(request):
    """Parametrized fixture that yields each example FSM in turn."""
    return _load_example(request.param)


# ---------------------------------------------------------------------------
# Pre-built dictionaries suitable for the optimizer APIs
# ---------------------------------------------------------------------------


@pytest.fixture
def simple_moore_2state():
    """Minimal 2-state Moore FSM with Gray encodings."""
    return {
        "states": {"S0": "0", "S1": "1"},
        "transitions": [
            {"from_state": "S0", "to_state": "S1", "input": "go"},
            {"from_state": "S1", "to_state": "S0", "input": "back"},
        ],
        "outputs": {"S0": "0", "S1": "1"},
        "fsm_type": "moore",
    }


@pytest_asyncio.fixture
async def client():
    """Async HTTP test client for the FastAPI application.

    Uses an in-process ASGI transport so no real server is needed.
    The database dependency must be available (or overridden in the test
    module) for endpoints that hit the DB.
    """
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# Sample FSM payload helpers used by integration tests
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_fsm_payload():
    """Minimal valid FSM creation payload (3-state Moore)."""
    return {
        "name": "Test Traffic Light",
        "description": "A simple 3-state traffic light FSM",
        "fsm_type": "moore",
        "states": ["red", "green", "yellow"],
        "initial_state": "red",
        "transitions": [
            {"from_state": "red", "to_state": "green", "input": "go"},
            {"from_state": "green", "to_state": "yellow", "input": "slow"},
            {"from_state": "yellow", "to_state": "red", "input": "stop"},
        ],
        "outputs": {"red": "stop", "green": "go", "yellow": "slow"},
        "visibility": "public",
    }


@pytest.fixture
def four_state_moore_with_gap():
    """4-state Moore FSM where some transitions have Hamming distance > 1."""
    import math

    states = ["A", "B", "C", "D"]
    n_bits = math.ceil(math.log2(len(states)))  # 2 bits
    from app.core.gray_code import int_to_gray

    encodings = {s: int_to_gray(i, n_bits) for i, s in enumerate(states)}
    # A=00, B=01, C=11, D=10
    return {
        "states": encodings,
        "transitions": [
            {"from_state": "A", "to_state": "C", "input": "x"},  # 00->11 HD=2
            {"from_state": "C", "to_state": "A", "input": "y"},  # 11->00 HD=2
            {"from_state": "B", "to_state": "D", "input": "z"},  # 01->10 HD=2
        ],
        "outputs": {"A": "00", "B": "01", "C": "10", "D": "11"},
        "fsm_type": "moore",
    }
