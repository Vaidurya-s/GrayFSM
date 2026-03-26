#!/usr/bin/env python3
"""
Complete Backend Generator for GrayFSM
Generates all required backend files with full implementation
"""

from pathlib import Path
from textwrap import dedent

BASE_DIR = Path("/home/arunupscee/Music/grayFSM/backend/app")

# Comprehensive file templates
FILES = {}

# ==================== CORE ALGORITHMS ====================

FILES["core/gray_code.py"] = '''"""
Gray Code generation and manipulation utilities
"""
from typing import List

def int_to_gray(n: int, bit_width: int) -> str:
    """
    Convert integer to Gray code binary string.
    
    Args:
        n: Integer to convert
        bit_width: Number of bits in encoding
        
    Returns:
        Gray code as binary string
        
    Example:
        >>> int_to_gray(5, 4)
        '0111'
    """
    gray = n ^ (n >> 1)
    return format(gray, f'0{bit_width}b')


def gray_to_int(gray: str) -> int:
    """
    Convert Gray code binary string to integer.
    
    Args:
        gray: Gray code binary string
        
    Returns:
        Integer value
    """
    n = int(gray, 2)
    mask = n
    while mask:
        mask >>= 1
        n ^= mask
    return n


def generate_gray_codes(bit_width: int) -> List[str]:
    """
    Generate all n-bit Gray codes in sequence.
    
    Args:
        bit_width: Number of bits
        
    Returns:
        List of Gray code strings
        
    Example:
        >>> generate_gray_codes(2)
        ['00', '01', '11', '10']
    """
    count = 2 ** bit_width
    return [int_to_gray(i, bit_width) for i in range(count)]


def hamming_distance(code1: str, code2: str) -> int:
    """
    Calculate Hamming distance between two binary codes.
    
    Args:
        code1: First binary string
        code2: Second binary string
        
    Returns:
        Number of bit positions that differ
    """
    if len(code1) != len(code2):
        raise ValueError("Codes must have same length")
    
    return sum(b1 != b2 for b1, b2 in zip(code1, code2))


def get_bit_flip_position(code1: str, code2: str) -> int:
    """
    Get the position of the single bit that differs (if any).
    
    Args:
        code1: First binary string
        code2: Second binary string
        
    Returns:
        Bit position (0-indexed) or -1 if multiple bits differ
    """
    if hamming_distance(code1, code2) != 1:
        return -1
    
    for i, (b1, b2) in enumerate(zip(code1, code2)):
        if b1 != b2:
            return i
    return -1
'''

FILES["core/hypercube.py"] = '''"""
Hypercube graph operations using NetworkX
"""
import networkx as nx
from typing import List, Tuple, Dict
from app.core.gray_code import int_to_gray, gray_to_int, hamming_distance


class HypercubeGraph:
    """
    N-dimensional hypercube graph for Gray code navigation.
    
    In a hypercube, each vertex represents a Gray code,
    and edges connect codes that differ by exactly one bit.
    """
    
    def __init__(self, bit_width: int):
        """
        Initialize hypercube graph.
        
        Args:
            bit_width: Number of bits (dimension of hypercube)
        """
        self.bit_width = bit_width
        self.graph = self._build_hypercube()
    
    def _build_hypercube(self) -> nx.Graph:
        """Build n-dimensional hypercube graph"""
        return nx.hypercube_graph(self.bit_width)
    
    def shortest_path(self, start_code: str, end_code: str) -> List[str]:
        """
        Find shortest path between two Gray codes in hypercube.
        
        Args:
            start_code: Starting Gray code
            end_code: Ending Gray code
            
        Returns:
            List of Gray codes forming the shortest path
        """
        start_int = gray_to_int(start_code)
        end_int = gray_to_int(end_code)
        
        try:
            # Get shortest path as list of integers
            path_ints = nx.shortest_path(self.graph, start_int, end_int)
            
            # Convert back to Gray codes
            path_codes = [int_to_gray(node, self.bit_width) for node in path_ints]
            
            return path_codes
        except nx.NetworkXNoPath:
            # Should never happen in a hypercube, but handle gracefully
            return [start_code, end_code]
    
    def find_intermediate_states(
        self, 
        start_code: str, 
        end_code: str
    ) -> List[str]:
        """
        Find intermediate Gray codes needed for single-bit transitions.
        
        Args:
            start_code: Starting Gray code
            end_code: Ending Gray code
            
        Returns:
            List of intermediate codes (excluding start and end)
        """
        path = self.shortest_path(start_code, end_code)
        # Return only intermediate states (exclude start and end)
        return path[1:-1]
    
    def get_neighbors(self, code: str) -> List[str]:
        """
        Get all Gray codes that differ by one bit.
        
        Args:
            code: Gray code
            
        Returns:
            List of neighboring Gray codes
        """
        code_int = gray_to_int(code)
        neighbor_ints = self.graph.neighbors(code_int)
        return [int_to_gray(n, self.bit_width) for n in neighbor_ints]
'''

FILES["core/fsm_model.py"] = '''"""
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
'''

# Generate all files
def generate_files():
    for file_path, content in FILES.items():
        full_path = BASE_DIR / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        with open(full_path, 'w') as f:
            f.write(dedent(content).lstrip())
        print(f"✓ Created: {file_path}")

if __name__ == "__main__":
    print("Generating GrayFSM Backend Implementation...")
    print("=" * 60)
    generate_files()
    print("=" * 60)
    print("✓ Backend core algorithms generated successfully!")
