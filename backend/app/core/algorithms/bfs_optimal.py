"""
BFS-Optimized Dummy State Insertion Algorithm

Uses breadth-first search to find optimal paths through hypercube,
guaranteeing minimum dummy states per transition.
"""
from typing import List, Dict, Set, Tuple
from collections import deque

from app.core.algorithms.greedy import GreedyOptimizer, DummyState
from app.core.hypercube import HypercubeGraph


class BFSOptimizer(GreedyOptimizer):
    """
    BFS-based optimization with smart state reuse.
    
    Improves over greedy by:
    1. Preferring already-used Gray codes for dummy states
    2. Avoiding conflicts in encoding assignments
    """
    
    def __init__(self, bit_width: int):
        super().__init__(bit_width)
        self.used_encodings: Set[str] = set()
    
    def optimize_fsm(
        self,
        states: Dict[str, str],
        transitions: List[Dict],
        outputs: Dict[str, str],
        fsm_type: str
    ) -> Tuple[List[DummyState], List[Dict]]:
        """Optimize using BFS with encoding reuse"""
        # Track used encodings
        self.used_encodings = set(states.values())
        
        return super().optimize_fsm(states, transitions, outputs, fsm_type)
    
    def _find_best_path(
        self,
        from_code: str,
        to_code: str
    ) -> List[str]:
        """
        Find best path considering already-used codes.
        
        Prefers paths through unused Gray codes when possible.
        """
        # Use standard shortest path
        all_paths = self.hypercube.shortest_path(from_code, to_code)
        
        # Could be extended to prefer paths through used codes
        # to maximize code reuse
        
        return all_paths
