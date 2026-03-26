"""
Greedy algorithm for dummy state insertion.

This algorithm processes each FSM transition independently, inserting dummy states
along the shortest path in the Gray code hypercube when multi-bit transitions are detected.

Characteristics:
- Fast: O(n*m) where n=states, m=transitions
- Simple: Easy to understand and implement
- Local optimization: May not be globally optimal
"""

import math
import time
from typing import Dict, Any, List
from .base import OptimizationAlgorithm, AlgorithmRegistry
from ..fsm_model import FSM, FSMType, OptimizedFSM, DummyState, Transition
from ..gray_code import int_to_gray, hamming_distance
from ..hypercube import HypercubeGraph


class GreedyAlgorithm(OptimizationAlgorithm):
    """
    Greedy dummy state insertion algorithm.

    Strategy:
    1. Assign Gray codes sequentially to states (S0=G(0), S1=G(1), ...)
    2. For each transition, check Hamming distance
    3. If distance > 1, find shortest path in hypercube
    4. Insert all intermediate Gray codes as dummy states
    5. Assign appropriate outputs to dummy states

    Pros:
    - Very fast execution
    - Guaranteed to eliminate all multi-bit transitions
    - Predictable behavior

    Cons:
    - Not globally optimal (different state assignments might need fewer dummies)
    - Each transition handled independently
    """

    @property
    def name(self) -> str:
        """Algorithm name."""
        return "greedy"

    @property
    def description(self) -> str:
        """Algorithm description."""
        return (
            "Greedy algorithm: processes each transition independently, "
            "inserting dummy states along shortest hypercube path"
        )

    def optimize(self, fsm: FSM, options: Dict[str, Any] = None) -> OptimizedFSM:
        """
        Optimize FSM using greedy algorithm.

        Args:
            fsm: Input FSM
            options: Optional configuration (currently unused)

        Returns:
            Optimized FSM with dummy states inserted

        Raises:
            ValueError: If FSM is invalid
        """
        start_time = time.time()

        # Validate FSM
        self.validate_fsm(fsm)

        # Calculate bit width needed
        n_states = len(fsm.states)
        n_bits = math.ceil(math.log2(n_states)) if n_states > 1 else 1

        # Create hypercube for path finding
        hypercube = HypercubeGraph(n_bits)

        # Assign Gray codes sequentially
        encoding = self._assign_gray_codes(fsm.states, n_bits)

        # Process transitions and insert dummies
        new_transitions, dummy_states = self._process_transitions(
            fsm, encoding, hypercube
        )

        # Calculate execution time
        execution_time_ms = (time.time() - start_time) * 1000

        # Build final state list
        all_states = fsm.states + [d.id for d in dummy_states]

        # Calculate metrics
        metrics = self._calculate_metrics(fsm, new_transitions, dummy_states)

        return OptimizedFSM(
            original_fsm=fsm,
            algorithm=self.name,
            execution_time_ms=execution_time_ms,
            states=all_states,
            transitions=new_transitions,
            encoding=encoding,
            dummy_states=dummy_states,
            metrics=metrics
        )

    def _assign_gray_codes(self, states: List[str], n_bits: int) -> Dict[str, str]:
        """
        Assign Gray codes sequentially to states.

        Args:
            states: List of state names
            n_bits: Number of bits for encoding

        Returns:
            Dictionary mapping state names to Gray codes
        """
        encoding = {}
        for i, state in enumerate(states):
            encoding[state] = int_to_gray(i, n_bits)
        return encoding

    def _process_transitions(
        self,
        fsm: FSM,
        encoding: Dict[str, str],
        hypercube: HypercubeGraph
    ) -> tuple[List[Transition], List[DummyState]]:
        """
        Process all transitions, inserting dummy states where needed.

        Args:
            fsm: Original FSM
            encoding: State to Gray code mapping
            hypercube: Hypercube graph for path finding

        Returns:
            Tuple of (new transitions list, dummy states list)
        """
        new_transitions = []
        dummy_states = []
        dummy_counter = 0

        for trans in fsm.transitions:
            src_code = encoding[trans.from_state]
            dst_code = encoding[trans.to_state]

            # Check if transition is safe (single-bit change)
            if hamming_distance(src_code, dst_code) <= 1:
                # Safe transition - keep as is
                new_transitions.append(trans)
            else:
                # Unsafe transition - insert dummy states
                path = hypercube.shortest_path(src_code, dst_code)

                current_state = trans.from_state

                # Insert dummy for each intermediate Gray code
                for i, intermediate_code in enumerate(path[1:-1], start=1):
                    dummy_id = f"D{dummy_counter}"
                    dummy_counter += 1

                    # Determine output for this dummy state
                    dummy_output = self._determine_dummy_output(
                        fsm, trans, i, len(path)
                    )

                    # Create dummy state
                    dummy = DummyState(
                        id=dummy_id,
                        encoding=intermediate_code,
                        output=dummy_output,
                        inserted_for_transition=f"{trans.from_state}->{trans.to_state}",
                        position_in_path=i
                    )
                    dummy_states.append(dummy)

                    # Add encoding for dummy state
                    encoding[dummy_id] = intermediate_code

                    # Create transition to dummy state
                    new_trans = Transition(
                        from_state=current_state,
                        to_state=dummy_id,
                        input=trans.input if i == 1 else None,
                        output=trans.output if i == 1 and fsm.fsm_type == FSMType.MEALY else None
                    )
                    new_transitions.append(new_trans)

                    current_state = dummy_id

                # Add final transition to destination
                final_trans = Transition(
                    from_state=current_state,
                    to_state=trans.to_state,
                    input=None,
                    output=None
                )
                new_transitions.append(final_trans)

        return new_transitions, dummy_states

    def _determine_dummy_output(
        self,
        fsm: FSM,
        original_transition: Transition,
        position: int,
        path_length: int
    ) -> str:
        """
        Determine appropriate output for a dummy state.

        Strategy for Moore machines:
        - Early dummies: use source state output
        - Late dummies: use destination state output
        - Transition point: halfway through path

        Args:
            fsm: Original FSM
            original_transition: The transition being split
            position: Position of dummy in path (1-indexed)
            path_length: Total path length including endpoints

        Returns:
            Output value for dummy state
        """
        if fsm.fsm_type == FSMType.MOORE and fsm.outputs:
            # Determine if we're closer to source or destination
            midpoint = path_length / 2

            if position < midpoint:
                # Closer to source - use source output
                return fsm.outputs.get(original_transition.from_state, "0")
            else:
                # Closer to destination - use destination output
                return fsm.outputs.get(original_transition.to_state, "0")
        else:
            # Mealy machine or no outputs - return default
            return "0"

    def _calculate_metrics(
        self,
        original_fsm: FSM,
        new_transitions: List[Transition],
        dummy_states: List[DummyState]
    ) -> Dict[str, Any]:
        """
        Calculate optimization metrics.

        Args:
            original_fsm: Original FSM
            new_transitions: New transitions after optimization
            dummy_states: Dummy states inserted

        Returns:
            Dictionary of metrics
        """
        # Count multi-bit transitions in original
        original_multibit = 0
        for trans in original_fsm.transitions:
            # This would require encoding, so we estimate
            pass

        return {
            "original_state_count": len(original_fsm.states),
            "final_state_count": len(original_fsm.states) + len(dummy_states),
            "dummy_state_count": len(dummy_states),
            "original_transition_count": len(original_fsm.transitions),
            "final_transition_count": len(new_transitions),
            "avg_dummies_per_original_transition": (
                len(dummy_states) / len(original_fsm.transitions)
                if original_fsm.transitions else 0
            ),
            "compression_ratio": (
                len(dummy_states) / (len(original_fsm.states) + len(dummy_states))
                if (len(original_fsm.states) + len(dummy_states)) > 0 else 0
            )
        }


# Register the greedy algorithm
AlgorithmRegistry.register(GreedyAlgorithm)
