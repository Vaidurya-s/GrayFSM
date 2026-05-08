"""
Hypercube graph operations using NetworkX

Nodes are Gray code strings (e.g. "010"). Edges connect codes
that differ by exactly one bit.
"""

from typing import List

import networkx as nx

from app.core.gray_code import generate_gray_codes


class HypercubeGraph:
    """
    N-dimensional hypercube graph for Gray code navigation.

    Each vertex is a Gray code string, and edges connect codes
    that differ by exactly one bit.
    """

    def __init__(self, bit_width: int):
        """
        Initialize hypercube graph.

        Args:
            bit_width: Number of bits (dimension of hypercube)
        """
        if bit_width < 1:
            raise ValueError("bit_width must be >= 1")
        self.bit_width = bit_width
        self.graph = self._build_hypercube()

    def _build_hypercube(self) -> nx.Graph:
        """
        Build n-dimensional hypercube graph with Gray code string nodes.

        Each node is a binary string of length bit_width. Two nodes are
        connected iff they differ in exactly one bit position.
        """
        g = nx.Graph()
        codes = generate_gray_codes(self.bit_width)
        g.add_nodes_from(codes)

        # All 2^n codes — connect pairs that differ by exactly 1 bit.
        # We can iterate over each code and flip each bit position.
        for code in codes:
            bits = list(code)
            for pos in range(self.bit_width):
                neighbor_bits = bits.copy()
                neighbor_bits[pos] = "1" if bits[pos] == "0" else "0"
                neighbor = "".join(neighbor_bits)
                if neighbor in g and not g.has_edge(code, neighbor):
                    g.add_edge(code, neighbor)

        return g

    def shortest_path(self, start_code: str, end_code: str) -> List[str]:
        """
        Find shortest path between two Gray codes in hypercube.

        Args:
            start_code: Starting Gray code string
            end_code: Ending Gray code string

        Returns:
            List of Gray code strings forming the shortest path
            (includes start and end)
        """
        if len(start_code) != self.bit_width or len(end_code) != self.bit_width:
            raise ValueError(
                f"Codes must be {self.bit_width} bits, got {len(start_code)} and {len(end_code)}"
            )

        if start_code == end_code:
            return [start_code]

        try:
            return nx.shortest_path(self.graph, start_code, end_code)
        except nx.NodeNotFound as e:
            raise ValueError(f"Code not found in hypercube: {e}")
        except nx.NetworkXNoPath:
            # Should never happen in a hypercube, but handle gracefully
            return [start_code, end_code]

    def find_intermediate_states(self, start_code: str, end_code: str) -> List[str]:
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
        if len(path) <= 2:
            return []
        return path[1:-1]

    def get_neighbors(self, code: str) -> List[str]:
        """
        Get all Gray codes that differ by one bit.

        Args:
            code: Gray code string

        Returns:
            List of neighboring Gray code strings
        """
        if len(code) != self.bit_width:
            raise ValueError(f"Code must be {self.bit_width} bits, got {len(code)}")
        if code not in self.graph:
            raise ValueError(f"Code '{code}' not found in hypercube")
        return list(self.graph.neighbors(code))
