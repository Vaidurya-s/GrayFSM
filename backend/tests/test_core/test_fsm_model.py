"""
Unit tests for FSM validation (app.core.fsm_model).

Tests cover:
- FSMValidator.validate_fsm_structure: complete FSM validation
- FSMValidator.validate_transitions: transition integrity
- FSMValidator.check_reachability: BFS reachability analysis
- FSMType enum and dataclasses (Transition, State)
"""

import pytest
from app.core.fsm_model import (
    FSMValidator,
    FSMType,
    Transition,
    State,
)
from app.utils.exceptions import FSMValidationException


# =====================================================================
# FSMType enum
# =====================================================================

class TestFSMType:
    """Tests for the FSMType enum."""

    def test_moore_value(self):
        assert FSMType.MOORE == "moore"
        assert FSMType.MOORE.value == "moore"

    def test_mealy_value(self):
        assert FSMType.MEALY == "mealy"
        assert FSMType.MEALY.value == "mealy"

    def test_string_comparison(self):
        """FSMType inherits from str, so direct string comparison works."""
        assert FSMType.MOORE == "moore"
        assert FSMType.MEALY == "mealy"


# =====================================================================
# Transition and State dataclasses
# =====================================================================

class TestTransitionDataclass:
    """Tests for the Transition dataclass."""

    def test_basic_creation(self):
        t = Transition(from_state="S0", to_state="S1")
        assert t.from_state == "S0"
        assert t.to_state == "S1"
        assert t.input_value is None
        assert t.output_value is None
        assert t.label is None

    def test_with_optional_fields(self):
        t = Transition(
            from_state="S0",
            to_state="S1",
            input_value="1",
            output_value="0",
            label="go",
        )
        assert t.input_value == "1"
        assert t.output_value == "0"
        assert t.label == "go"


class TestStateDataclass:
    """Tests for the State dataclass."""

    def test_basic_creation(self):
        s = State(id="S0")
        assert s.id == "S0"
        assert s.label is None
        assert s.output is None
        assert s.encoding is None
        assert s.is_dummy is False

    def test_dummy_state(self):
        s = State(id="DUMMY_0", encoding="010", is_dummy=True)
        assert s.is_dummy is True
        assert s.encoding == "010"


# =====================================================================
# FSMValidator.validate_fsm_structure
# =====================================================================

class TestValidateFSMStructure:
    """Tests for FSMValidator.validate_fsm_structure."""

    def test_valid_moore_fsm(self):
        """A valid Moore FSM should pass without raising."""
        FSMValidator.validate_fsm_structure(
            fsm_type=FSMType.MOORE,
            states=["S0", "S1"],
            initial_state="S0",
            transitions=[
                {"from_state": "S0", "to_state": "S1"},
                {"from_state": "S1", "to_state": "S0"},
            ],
            outputs={"S0": "0", "S1": "1"},
        )

    def test_valid_mealy_fsm(self):
        """A valid Mealy FSM should pass (outputs are per-transition, not per-state)."""
        FSMValidator.validate_fsm_structure(
            fsm_type=FSMType.MEALY,
            states=["S0", "S1"],
            initial_state="S0",
            transitions=[
                {"from_state": "S0", "to_state": "S1"},
                {"from_state": "S1", "to_state": "S0"},
            ],
            outputs=None,
        )

    def test_empty_states_raises(self):
        """Empty states list should fail."""
        with pytest.raises(FSMValidationException, match="at least one state"):
            FSMValidator.validate_fsm_structure(
                fsm_type=FSMType.MOORE,
                states=[],
                initial_state="S0",
                transitions=[],
                outputs={},
            )

    def test_initial_state_not_in_states_raises(self):
        """Initial state not in states list should fail."""
        with pytest.raises(FSMValidationException, match="Initial state.*not in states"):
            FSMValidator.validate_fsm_structure(
                fsm_type=FSMType.MOORE,
                states=["S0", "S1"],
                initial_state="S99",
                transitions=[],
                outputs={"S0": "0", "S1": "1"},
            )

    def test_moore_without_outputs_raises(self):
        """Moore machine without outputs should fail."""
        with pytest.raises(FSMValidationException, match="Moore machines must have outputs"):
            FSMValidator.validate_fsm_structure(
                fsm_type=FSMType.MOORE,
                states=["S0", "S1"],
                initial_state="S0",
                transitions=[
                    {"from_state": "S0", "to_state": "S1"},
                ],
                outputs=None,
            )

    def test_moore_missing_output_for_one_state_raises(self):
        """Moore machine missing output for a specific state should fail."""
        with pytest.raises(FSMValidationException, match="Missing output for state"):
            FSMValidator.validate_fsm_structure(
                fsm_type=FSMType.MOORE,
                states=["S0", "S1", "S2"],
                initial_state="S0",
                transitions=[
                    {"from_state": "S0", "to_state": "S1"},
                    {"from_state": "S1", "to_state": "S2"},
                ],
                outputs={"S0": "0", "S1": "1"},  # Missing S2
            )

    def test_transition_to_nonexistent_state_raises(self):
        """Transition referencing a state not in the states list should fail."""
        with pytest.raises(FSMValidationException, match="unknown state"):
            FSMValidator.validate_fsm_structure(
                fsm_type=FSMType.MEALY,
                states=["S0", "S1"],
                initial_state="S0",
                transitions=[
                    {"from_state": "S0", "to_state": "NONEXISTENT"},
                ],
                outputs=None,
            )

    def test_valid_moore_with_many_states(self):
        """Moore FSM with several states and transitions passes validation."""
        states = ["Red", "RedYellow", "Green", "Yellow"]
        FSMValidator.validate_fsm_structure(
            fsm_type=FSMType.MOORE,
            states=states,
            initial_state="Red",
            transitions=[
                {"from_state": "Red", "to_state": "RedYellow"},
                {"from_state": "RedYellow", "to_state": "Green"},
                {"from_state": "Green", "to_state": "Yellow"},
                {"from_state": "Yellow", "to_state": "Red"},
            ],
            outputs={"Red": "100", "RedYellow": "110", "Green": "001", "Yellow": "010"},
        )

    def test_single_state_moore(self):
        """Single-state Moore FSM with self-loop should be valid."""
        FSMValidator.validate_fsm_structure(
            fsm_type=FSMType.MOORE,
            states=["S0"],
            initial_state="S0",
            transitions=[
                {"from_state": "S0", "to_state": "S0"},
            ],
            outputs={"S0": "0"},
        )

    def test_mealy_with_empty_outputs_passes(self):
        """Mealy machine with empty dict outputs still passes (no per-state output requirement)."""
        FSMValidator.validate_fsm_structure(
            fsm_type=FSMType.MEALY,
            states=["S0", "S1"],
            initial_state="S0",
            transitions=[
                {"from_state": "S0", "to_state": "S1"},
            ],
            outputs={},  # Empty dict is falsy, but Mealy doesn't require outputs
        )

    def test_no_transitions_valid(self):
        """An FSM with no transitions is structurally valid (just a single state)."""
        FSMValidator.validate_fsm_structure(
            fsm_type=FSMType.MOORE,
            states=["S0"],
            initial_state="S0",
            transitions=[],
            outputs={"S0": "0"},
        )


# =====================================================================
# FSMValidator.validate_transitions
# =====================================================================

class TestValidateTransitions:
    """Tests for FSMValidator.validate_transitions."""

    def test_valid_transitions(self):
        """All transitions reference valid states."""
        FSMValidator.validate_transitions(
            states=["A", "B", "C"],
            transitions=[
                {"from_state": "A", "to_state": "B"},
                {"from_state": "B", "to_state": "C"},
                {"from_state": "C", "to_state": "A"},
            ],
        )

    def test_self_loop_valid(self):
        """Self-loop transition should be valid."""
        FSMValidator.validate_transitions(
            states=["A"],
            transitions=[{"from_state": "A", "to_state": "A"}],
        )

    def test_missing_from_state_raises(self):
        """Transition without 'from_state' key should fail."""
        with pytest.raises(FSMValidationException, match="missing 'from_state'"):
            FSMValidator.validate_transitions(
                states=["A", "B"],
                transitions=[{"to_state": "B"}],
            )

    def test_missing_to_state_raises(self):
        """Transition without 'to_state' key should fail."""
        with pytest.raises(FSMValidationException, match="missing 'to_state'"):
            FSMValidator.validate_transitions(
                states=["A", "B"],
                transitions=[{"from_state": "A"}],
            )

    def test_unknown_from_state_raises(self):
        """Transition with from_state not in states should fail."""
        with pytest.raises(FSMValidationException, match="unknown state 'X'"):
            FSMValidator.validate_transitions(
                states=["A", "B"],
                transitions=[{"from_state": "X", "to_state": "B"}],
            )

    def test_unknown_to_state_raises(self):
        """Transition with to_state not in states should fail."""
        with pytest.raises(FSMValidationException, match="unknown state 'Y'"):
            FSMValidator.validate_transitions(
                states=["A", "B"],
                transitions=[{"from_state": "A", "to_state": "Y"}],
            )

    def test_empty_transitions_valid(self):
        """No transitions should be valid (nothing to check)."""
        FSMValidator.validate_transitions(
            states=["A", "B"],
            transitions=[],
        )

    def test_error_includes_transition_index(self):
        """Error message should include the index of the bad transition."""
        with pytest.raises(FSMValidationException, match="Transition 2"):
            FSMValidator.validate_transitions(
                states=["A", "B"],
                transitions=[
                    {"from_state": "A", "to_state": "B"},
                    {"from_state": "B", "to_state": "A"},
                    {"from_state": "A", "to_state": "INVALID"},  # index 2
                ],
            )


# =====================================================================
# FSMValidator.check_reachability
# =====================================================================

class TestCheckReachability:
    """Tests for FSMValidator.check_reachability."""

    def test_fully_connected(self):
        """All states reachable in a cycle."""
        states = ["A", "B", "C"]
        transitions = [
            {"from_state": "A", "to_state": "B"},
            {"from_state": "B", "to_state": "C"},
            {"from_state": "C", "to_state": "A"},
        ]
        reachable = FSMValidator.check_reachability(states, "A", transitions)
        assert reachable == {"A", "B", "C"}

    def test_unreachable_state(self):
        """State D is not reachable from A."""
        states = ["A", "B", "C", "D"]
        transitions = [
            {"from_state": "A", "to_state": "B"},
            {"from_state": "B", "to_state": "C"},
            {"from_state": "C", "to_state": "A"},
            # D has no incoming transitions from A/B/C
        ]
        reachable = FSMValidator.check_reachability(states, "A", transitions)
        assert reachable == {"A", "B", "C"}
        assert "D" not in reachable

    def test_single_state_self_loop(self):
        """Single state with self-loop is reachable."""
        reachable = FSMValidator.check_reachability(
            states=["S0"],
            initial_state="S0",
            transitions=[{"from_state": "S0", "to_state": "S0"}],
        )
        assert reachable == {"S0"}

    def test_single_state_no_transitions(self):
        """Single state without transitions is still reachable (it's the initial state)."""
        reachable = FSMValidator.check_reachability(
            states=["S0"],
            initial_state="S0",
            transitions=[],
        )
        assert reachable == {"S0"}

    def test_initial_state_always_reachable(self):
        """The initial state is always in the reachable set."""
        states = ["X", "Y"]
        transitions = []  # No transitions, only X is reachable
        reachable = FSMValidator.check_reachability(states, "X", transitions)
        assert "X" in reachable
        assert "Y" not in reachable

    def test_tree_shaped_reachability(self):
        """Tree-shaped FSM: A -> B, A -> C, B -> D."""
        states = ["A", "B", "C", "D", "E"]
        transitions = [
            {"from_state": "A", "to_state": "B"},
            {"from_state": "A", "to_state": "C"},
            {"from_state": "B", "to_state": "D"},
        ]
        reachable = FSMValidator.check_reachability(states, "A", transitions)
        assert reachable == {"A", "B", "C", "D"}
        assert "E" not in reachable

    def test_diamond_reachability(self):
        """Diamond-shaped: A -> B, A -> C, B -> D, C -> D."""
        states = ["A", "B", "C", "D"]
        transitions = [
            {"from_state": "A", "to_state": "B"},
            {"from_state": "A", "to_state": "C"},
            {"from_state": "B", "to_state": "D"},
            {"from_state": "C", "to_state": "D"},
        ]
        reachable = FSMValidator.check_reachability(states, "A", transitions)
        assert reachable == {"A", "B", "C", "D"}

    def test_multiple_unreachable_states(self):
        """Multiple unreachable states detected."""
        states = ["A", "B", "C", "D", "E"]
        transitions = [
            {"from_state": "A", "to_state": "B"},
            {"from_state": "D", "to_state": "E"},  # D->E is reachable from D, not A
        ]
        reachable = FSMValidator.check_reachability(states, "A", transitions)
        assert reachable == {"A", "B"}
        unreachable = set(states) - reachable
        assert unreachable == {"C", "D", "E"}

    def test_with_example_elevator_data(self, elevator_fsm_data):
        """All elevator states should be reachable."""
        data = elevator_fsm_data
        reachable = FSMValidator.check_reachability(
            states=data["states"],
            initial_state=data["initial_state"],
            transitions=data["transitions"],
        )
        assert reachable == set(data["states"])

    def test_with_example_traffic_light_data(self, traffic_light_fsm_data):
        """All traffic light states should be reachable."""
        data = traffic_light_fsm_data
        reachable = FSMValidator.check_reachability(
            states=data["states"],
            initial_state=data["initial_state"],
            transitions=data["transitions"],
        )
        assert reachable == set(data["states"])

    def test_with_example_sequence_detector_data(self, sequence_detector_fsm_data):
        """All sequence detector states should be reachable."""
        data = sequence_detector_fsm_data
        reachable = FSMValidator.check_reachability(
            states=data["states"],
            initial_state=data["initial_state"],
            transitions=data["transitions"],
        )
        assert reachable == set(data["states"])

    def test_with_example_vending_machine_data(self, vending_machine_fsm_data):
        """All vending machine states should be reachable."""
        data = vending_machine_fsm_data
        reachable = FSMValidator.check_reachability(
            states=data["states"],
            initial_state=data["initial_state"],
            transitions=data["transitions"],
        )
        assert reachable == set(data["states"])


# =====================================================================
# Validation with example JSON files
# =====================================================================

class TestValidateExampleFSMs:
    """Validate that all example FSM JSON files pass validation."""

    def test_validate_elevator(self, elevator_fsm_data):
        data = elevator_fsm_data
        FSMValidator.validate_fsm_structure(
            fsm_type=FSMType(data["type"]),
            states=data["states"],
            initial_state=data["initial_state"],
            transitions=data["transitions"],
            outputs=data.get("outputs"),
        )

    def test_validate_traffic_light(self, traffic_light_fsm_data):
        data = traffic_light_fsm_data
        FSMValidator.validate_fsm_structure(
            fsm_type=FSMType(data["type"]),
            states=data["states"],
            initial_state=data["initial_state"],
            transitions=data["transitions"],
            outputs=data.get("outputs"),
        )

    def test_validate_sequence_detector(self, sequence_detector_fsm_data):
        """Mealy FSM with no 'outputs' key at the state level."""
        data = sequence_detector_fsm_data
        FSMValidator.validate_fsm_structure(
            fsm_type=FSMType(data["type"]),
            states=data["states"],
            initial_state=data["initial_state"],
            transitions=data["transitions"],
            outputs=data.get("outputs"),
        )

    def test_validate_vending_machine(self, vending_machine_fsm_data):
        data = vending_machine_fsm_data
        FSMValidator.validate_fsm_structure(
            fsm_type=FSMType(data["type"]),
            states=data["states"],
            initial_state=data["initial_state"],
            transitions=data["transitions"],
            outputs=data.get("outputs"),
        )
