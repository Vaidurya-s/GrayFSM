"""
Core FSM data structures (framework-independent).

This module defines the fundamental data structures for representing
finite state machines without any external framework dependencies.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Literal
from enum import Enum


class FSMType(str, Enum):
    """FSM type enumeration."""
    MOORE = "moore"  # Output depends only on current state
    MEALY = "mealy"  # Output depends on current state and input


@dataclass
class Transition:
    """
    A single state transition in an FSM.

    Attributes:
        from_state: Source state name
        to_state: Destination state name
        input: Input condition triggering transition (optional)
        output: Output for this transition (Mealy machines only)
    """
    from_state: str
    to_state: str
    input: Optional[str] = None
    output: Optional[str] = None

    def __str__(self) -> str:
        """String representation of transition."""
        if self.input and self.output:
            return f"{self.from_state} --[{self.input}/{self.output}]--> {self.to_state}"
        elif self.input:
            return f"{self.from_state} --[{self.input}]--> {self.to_state}"
        else:
            return f"{self.from_state} --> {self.to_state}"


@dataclass
class FSM:
    """
    Finite State Machine representation.

    Attributes:
        name: Descriptive name for the FSM
        fsm_type: "moore" or "mealy"
        states: List of state names
        initial_state: Name of the initial/start state
        transitions: List of state transitions
        outputs: State outputs for Moore machines (state -> output)
        description: Optional description
    """
    name: str
    fsm_type: FSMType
    states: List[str]
    initial_state: str
    transitions: List[Transition]
    outputs: Optional[Dict[str, str]] = None
    description: Optional[str] = None

    def __post_init__(self) -> None:
        """Validate FSM after initialization."""
        self._validate()

    def _validate(self) -> None:
        """Validate FSM structure."""
        # Check states list
        if not self.states:
            raise ValueError("FSM must have at least one state")

        if len(self.states) != len(set(self.states)):
            raise ValueError("Duplicate states found in FSM")

        # Check initial state
        if self.initial_state not in self.states:
            raise ValueError(
                f"Initial state '{self.initial_state}' not in states list"
            )

        # Check transitions reference valid states
        for trans in self.transitions:
            if trans.from_state not in self.states:
                raise ValueError(
                    f"Transition references unknown source state: {trans.from_state}"
                )
            if trans.to_state not in self.states:
                raise ValueError(
                    f"Transition references unknown destination state: {trans.to_state}"
                )

        # Check outputs for Moore machines
        if self.fsm_type == FSMType.MOORE:
            if self.outputs is None:
                raise ValueError("Moore machine must have outputs defined")
            for state in self.states:
                if state not in self.outputs:
                    raise ValueError(
                        f"Moore machine missing output for state: {state}"
                    )

    def get_state_transitions(self, state: str) -> List[Transition]:
        """
        Get all outgoing transitions from a state.

        Args:
            state: State name

        Returns:
            List of transitions originating from this state
        """
        return [t for t in self.transitions if t.from_state == state]

    def get_successor_states(self, state: str) -> List[str]:
        """
        Get all states directly reachable from a given state.

        Args:
            state: State name

        Returns:
            List of successor state names
        """
        return [t.to_state for t in self.transitions if t.from_state == state]

    def get_state_count(self) -> int:
        """Get number of states."""
        return len(self.states)

    def get_transition_count(self) -> int:
        """Get number of transitions."""
        return len(self.transitions)

    def __str__(self) -> str:
        """String representation of FSM."""
        return (
            f"FSM(name='{self.name}', type={self.fsm_type.value}, "
            f"states={len(self.states)}, transitions={len(self.transitions)})"
        )


@dataclass
class DummyState:
    """
    A dummy state inserted during optimization.

    Dummy states are intermediate states added to break multi-bit transitions
    into single-bit steps.

    Attributes:
        id: Unique identifier for the dummy state
        encoding: Gray code encoding for this state
        output: Output value for this state
        inserted_for_transition: Description of which transition this was inserted for
        position_in_path: Position in the path (1 = first dummy, etc.)
    """
    id: str
    encoding: str
    output: Optional[str] = None
    inserted_for_transition: str = ""
    position_in_path: int = 0

    def __str__(self) -> str:
        """String representation."""
        return f"DummyState({self.id}, encoding={self.encoding})"


@dataclass
class OptimizedFSM:
    """
    Result of FSM optimization with Gray code encoding.

    Attributes:
        original_fsm: The source FSM that was optimized
        algorithm: Name of optimization algorithm used
        execution_time_ms: Time taken to optimize (milliseconds)
        states: All states (original + dummy)
        transitions: All transitions (with dummies inserted)
        encoding: State to Gray code mapping
        dummy_states: List of inserted dummy states
        metrics: Additional optimization metrics
    """
    original_fsm: FSM
    algorithm: str
    execution_time_ms: float
    states: List[str]
    transitions: List[Transition]
    encoding: Dict[str, str]
    dummy_states: List[DummyState] = field(default_factory=list)
    metrics: Dict[str, any] = field(default_factory=dict)

    @property
    def original_state_count(self) -> int:
        """Number of states in original FSM."""
        return len(self.original_fsm.states)

    @property
    def final_state_count(self) -> int:
        """Number of states after optimization (including dummies)."""
        return len(self.states)

    @property
    def dummy_state_count(self) -> int:
        """Number of dummy states inserted."""
        return len(self.dummy_states)

    @property
    def total_transitions(self) -> int:
        """Total number of transitions after optimization."""
        return len(self.transitions)

    def get_compression_ratio(self) -> float:
        """
        Calculate ratio of dummy states to total states.

        Returns:
            Ratio (0.0 = no dummies, 1.0 = all dummies)
        """
        if self.final_state_count == 0:
            return 0.0
        return self.dummy_state_count / self.final_state_count

    def __str__(self) -> str:
        """String representation."""
        return (
            f"OptimizedFSM(algorithm={self.algorithm}, "
            f"original_states={self.original_state_count}, "
            f"final_states={self.final_state_count}, "
            f"dummies={self.dummy_state_count}, "
            f"time={self.execution_time_ms:.2f}ms)"
        )


def create_fsm_from_dict(data: dict) -> FSM:
    """
    Create FSM from dictionary (e.g., from JSON).

    Args:
        data: Dictionary with FSM definition

    Returns:
        FSM instance

    Example:
        >>> data = {
        ...     "name": "Test",
        ...     "type": "moore",
        ...     "states": ["S0", "S1"],
        ...     "initial_state": "S0",
        ...     "transitions": [{"from_state": "S0", "to_state": "S1"}],
        ...     "outputs": {"S0": "0", "S1": "1"}
        ... }
        >>> fsm = create_fsm_from_dict(data)
        >>> fsm.name
        'Test'
    """
    # Convert transition dicts to Transition objects
    transitions = [
        Transition(
            from_state=t["from_state"],
            to_state=t["to_state"],
            input=t.get("input"),
            output=t.get("output")
        )
        for t in data.get("transitions", [])
    ]

    # Normalize type string
    fsm_type_str = data.get("type", "moore").lower()
    fsm_type = FSMType.MOORE if fsm_type_str == "moore" else FSMType.MEALY

    return FSM(
        name=data["name"],
        fsm_type=fsm_type,
        states=data["states"],
        initial_state=data["initial_state"],
        transitions=transitions,
        outputs=data.get("outputs"),
        description=data.get("description")
    )


def fsm_to_dict(fsm: FSM) -> dict:
    """
    Convert FSM to dictionary (for JSON serialization).

    Args:
        fsm: FSM instance

    Returns:
        Dictionary representation

    Example:
        >>> fsm = FSM(
        ...     name="Test",
        ...     fsm_type=FSMType.MOORE,
        ...     states=["S0", "S1"],
        ...     initial_state="S0",
        ...     transitions=[Transition("S0", "S1")],
        ...     outputs={"S0": "0", "S1": "1"}
        ... )
        >>> data = fsm_to_dict(fsm)
        >>> data["name"]
        'Test'
    """
    return {
        "name": fsm.name,
        "type": fsm.fsm_type.value,
        "states": fsm.states,
        "initial_state": fsm.initial_state,
        "transitions": [
            {
                "from_state": t.from_state,
                "to_state": t.to_state,
                "input": t.input,
                "output": t.output
            }
            for t in fsm.transitions
        ],
        "outputs": fsm.outputs,
        "description": fsm.description
    }
