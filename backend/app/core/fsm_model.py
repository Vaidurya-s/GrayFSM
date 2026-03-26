"""
FSM validation and manipulation
"""
from typing import List, Dict, Optional, Set
from dataclasses import dataclass
from enum import Enum

from app.utils.exceptions import FSMValidationException


class FSMType(str, Enum):
    """FSM machine type"""
    MOORE = "moore"
    MEALY = "mealy"


@dataclass
class Transition:
    """FSM transition"""
    from_state: str
    to_state: str
    input_value: Optional[str] = None
    output_value: Optional[str] = None
    label: Optional[str] = None


@dataclass
class State:
    """FSM state"""
    id: str
    label: Optional[str] = None
    output: Optional[str] = None  # For Moore machines
    encoding: Optional[str] = None
    is_dummy: bool = False


class FSMValidator:
    """Validates FSM structure and transitions"""

    @staticmethod
    def validate_fsm_structure(
        fsm_type: FSMType,
        states: List[str],
        initial_state: str,
        transitions: List[Dict],
        outputs: Optional[Dict[str, str]] = None
    ) -> None:
        """
        Validate complete FSM structure.

        Args:
            fsm_type: Type of FSM (Moore or Mealy)
            states: List of state IDs
            initial_state: Initial state ID
            transitions: List of transition dictionaries
            outputs: State outputs (Moore machines)

        Raises:
            FSMValidationException: If validation fails
        """
        # Check states list is not empty
        if not states:
            raise FSMValidationException("FSM must have at least one state")

        # Check initial state exists
        if initial_state not in states:
            raise FSMValidationException(
                f"Initial state '{initial_state}' not in states list"
            )

        # Validate transitions
        FSMValidator.validate_transitions(states, transitions)

        # Validate outputs for Moore machines
        if fsm_type == FSMType.MOORE:
            if not outputs:
                raise FSMValidationException(
                    "Moore machines must have outputs defined for all states"
                )

            for state in states:
                if state not in outputs:
                    raise FSMValidationException(
                        f"Missing output for state '{state}'"
                    )

    @staticmethod
    def validate_transitions(
        states: List[str],
        transitions: List[Dict]
    ) -> None:
        """
        Validate all transitions reference valid states.

        Args:
            states: List of valid state IDs
            transitions: List of transition dictionaries

        Raises:
            FSMValidationException: If validation fails
        """
        state_set = set(states)

        for i, trans in enumerate(transitions):
            from_state = trans.get("from_state")
            to_state = trans.get("to_state")

            if not from_state:
                raise FSMValidationException(
                    f"Transition {i} missing 'from_state'"
                )

            if not to_state:
                raise FSMValidationException(
                    f"Transition {i} missing 'to_state'"
                )

            if from_state not in state_set:
                raise FSMValidationException(
                    f"Transition {i} references unknown state '{from_state}'"
                )

            if to_state not in state_set:
                raise FSMValidationException(
                    f"Transition {i} references unknown state '{to_state}'"
                )

    @staticmethod
    def check_reachability(
        states: List[str],
        initial_state: str,
        transitions: List[Dict]
    ) -> Set[str]:
        """
        Check which states are reachable from initial state.

        Args:
            states: List of state IDs
            initial_state: Initial state ID
            transitions: List of transition dictionaries

        Returns:
            Set of reachable state IDs
        """
        # Build adjacency list
        graph: Dict[str, List[str]] = {state: [] for state in states}
        for trans in transitions:
            from_state = trans["from_state"]
            to_state = trans["to_state"]
            if to_state not in graph[from_state]:
                graph[from_state].append(to_state)

        # BFS from initial state
        reachable = {initial_state}
        queue = [initial_state]

        while queue:
            current = queue.pop(0)
            for next_state in graph[current]:
                if next_state not in reachable:
                    reachable.add(next_state)
                    queue.append(next_state)

        return reachable
