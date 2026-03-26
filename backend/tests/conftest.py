"""
Pytest configuration and fixtures for GrayFSM tests.
"""

import pytest
from grayfsm.core.fsm_model import FSM, FSMType, Transition


@pytest.fixture
def simple_moore_fsm():
    """Simple 2-state Moore machine for testing."""
    return FSM(
        name="Simple Moore",
        fsm_type=FSMType.MOORE,
        states=["S0", "S1"],
        initial_state="S0",
        transitions=[
            Transition("S0", "S1"),
            Transition("S1", "S0")
        ],
        outputs={"S0": "0", "S1": "1"}
    )


@pytest.fixture
def traffic_light_fsm():
    """Traffic light controller FSM."""
    return FSM(
        name="Traffic Light",
        fsm_type=FSMType.MOORE,
        states=["Red", "RedYellow", "Green", "Yellow"],
        initial_state="Red",
        transitions=[
            Transition("Red", "RedYellow"),
            Transition("RedYellow", "Green"),
            Transition("Green", "Yellow"),
            Transition("Yellow", "Red")
        ],
        outputs={
            "Red": "100",
            "RedYellow": "110",
            "Green": "001",
            "Yellow": "010"
        }
    )


@pytest.fixture
def simple_mealy_fsm():
    """Simple Mealy machine for testing."""
    return FSM(
        name="Simple Mealy",
        fsm_type=FSMType.MEALY,
        states=["S0", "S1"],
        initial_state="S0",
        transitions=[
            Transition("S0", "S1", input="0", output="0"),
            Transition("S1", "S0", input="1", output="1")
        ]
    )
