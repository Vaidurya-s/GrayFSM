"""
Greedy Dummy State Insertion Algorithm

This algorithm processes each problematic transition independently,
inserting the minimum number of dummy states needed for that specific transition.
"""
from typing import List, Dict, Tuple
from dataclasses import dataclass

from app.core.gray_code import hamming_distance
from app.core.hypercube import HypercubeGraph


@dataclass
class DummyState:
    """Represents a dummy state inserted for optimization"""
    id: str
    encoding: str
    output: str
    inserted_for_transition: str


class GreedyOptimizer:
    """
    Greedy algorithm for FSM optimization.
    
    Time Complexity: O(T * log(N)) where T is transitions, N is states
    Space Complexity: O(D) where D is dummy states created
    """
    
    def __init__(self, bit_width: int):
        """
        Initialize optimizer.
        
        Args:
            bit_width: Number of bits in state encoding
        """
        self.bit_width = bit_width
        self.hypercube = HypercubeGraph(bit_width)
        self.dummy_counter = 0
        self.dummy_states: List[DummyState] = []
    
    def optimize_fsm(
        self,
        states: Dict[str, str],  # state_id -> gray_encoding
        transitions: List[Dict],
        outputs: Dict[str, str],
        fsm_type: str
    ) -> Tuple[List[DummyState], List[Dict]]:
        """
        Optimize FSM by inserting dummy states.
        
        Args:
            states: Mapping of state IDs to Gray encodings
            transitions: List of transition dictionaries
            outputs: State outputs (for Moore machines)
            fsm_type: 'moore' or 'mealy'
            
        Returns:
            Tuple of (dummy_states_list, new_transitions_list)
        """
        self.dummy_states = []
        self.dummy_counter = 0
        new_transitions = []
        
        for trans in transitions:
            from_state = trans['from_state']
            to_state = trans['to_state']
            from_code = states[from_state]
            to_code = states[to_state]
            
            # Check if transition needs optimization
            if hamming_distance(from_code, to_code) <= 1:
                # Transition is already safe
                new_transitions.append(trans)
            else:
                # Insert dummy states
                dummy_trans = self._insert_dummy_states(
                    from_state=from_state,
                    to_state=to_state,
                    from_code=from_code,
                    to_code=to_code,
                    original_trans=trans,
                    outputs=outputs,
                    fsm_type=fsm_type
                )
                new_transitions.extend(dummy_trans)
        
        return self.dummy_states, new_transitions
    
    def _insert_dummy_states(
        self,
        from_state: str,
        to_state: str,
        from_code: str,
        to_code: str,
        original_trans: Dict,
        outputs: Dict[str, str],
        fsm_type: str
    ) -> List[Dict]:
        """
        Insert dummy states for a single transition.
        
        Returns:
            List of new transitions including dummy states
        """
        # Find shortest path in hypercube
        path = self.hypercube.shortest_path(from_code, to_code)
        
        # Create dummy states for intermediate codes
        new_transitions = []
        current_state = from_state
        
        for i, code in enumerate(path[1:-1], start=1):
            # Create dummy state
            dummy_id = f"DUMMY_{self.dummy_counter}_{from_state}_to_{to_state}"
            self.dummy_counter += 1
            
            # Determine output for dummy state
            if fsm_type == "moore":
                # Use source state output until near end
                if i < len(path) - 2:
                    dummy_output = outputs.get(from_state, "0")
                else:
                    dummy_output = outputs.get(to_state, "0")
            else:
                dummy_output = "X"  # Don't care for Mealy
            
            dummy_state = DummyState(
                id=dummy_id,
                encoding=code,
                output=dummy_output,
                inserted_for_transition=f"{from_state}->{to_state}"
            )
            self.dummy_states.append(dummy_state)
            
            # Create transition to dummy state
            new_trans = {
                'from_state': current_state,
                'to_state': dummy_id,
                'input': original_trans.get('input') if i == 1 else None,
                'output': original_trans.get('output') if fsm_type == 'mealy' else None,
                'is_dummy_transition': True
            }
            new_transitions.append(new_trans)
            
            current_state = dummy_id
        
        # Final transition to destination
        final_trans = {
            'from_state': current_state,
            'to_state': to_state,
            'input': None,
            'output': None,
            'is_dummy_transition': True
        }
        new_transitions.append(final_trans)
        
        return new_transitions
