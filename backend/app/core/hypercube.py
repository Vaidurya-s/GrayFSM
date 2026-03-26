"""
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
