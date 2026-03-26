"""
N-dimensional hypercube graph for Gray code navigation.

An n-bit Gray code set forms the vertices of an n-dimensional hypercube.
Each edge connects two Gray codes that differ by exactly one bit.
This module provides operations for finding shortest paths between Gray codes.
"""

import networkx as nx
from typing import List, Optional
from .gray_code import int_to_gray, gray_to_int


class HypercubeGraph:
    """
    N-dimensional hypercube graph for shortest path operations.

    The hypercube represents all possible n-bit Gray codes as vertices,
    with edges connecting codes that differ by a single bit.
    """

    def __init__(self, n_bits: int):
        """
        Initialize hypercube graph for n-bit Gray codes.

        Args:
            n_bits: Number of bits (dimension of hypercube)

        Raises:
            ValueError: If n_bits is negative or too large
        """
        if n_bits < 1:
            raise ValueError(f"n_bits must be at least 1, got {n_bits}")
        if n_bits > 10:
            raise ValueError(
                f"n_bits={n_bits} creates 2^{n_bits}={2**n_bits} nodes, "
                "which may be too large for performance. Consider n_bits <= 10."
            )

        self.n_bits = n_bits
        self.graph = self._build_hypercube()

    def _build_hypercube(self) -> nx.Graph:
        """
        Build the n-dimensional hypercube using NetworkX.

        Returns:
            NetworkX graph with Gray codes as node labels
        """
        # NetworkX provides hypercube graph with binary tuple nodes
        # e.g., (0,0,0), (0,0,1), (0,1,1), etc.
        G = nx.hypercube_graph(self.n_bits)

        # Relabel nodes from tuples to Gray code strings
        mapping = {}
        for node in G.nodes():
            # node is tuple like (0, 1, 0)
            binary_str = ''.join(map(str, node))
            binary_int = int(binary_str, 2)
            gray_code = int_to_gray(binary_int, self.n_bits)
            mapping[node] = gray_code

        return nx.relabel_nodes(G, mapping)

    def shortest_path(self, src: str, dst: str) -> List[str]:
        """
        Find shortest path between two Gray codes in the hypercube.

        The path length equals the Hamming distance between the codes,
        which is the minimum number of single-bit transitions needed.

        Args:
            src: Source Gray code
            dst: Destination Gray code

        Returns:
            List of Gray codes forming the path from src to dst (inclusive)

        Raises:
            ValueError: If src or dst are not valid nodes
            nx.NetworkXNoPath: If no path exists (shouldn't happen in hypercube)

        Example:
            >>> hc = HypercubeGraph(3)
            >>> path = hc.shortest_path('000', '111')
            >>> len(path) == 4  # Hamming distance of 3 + 1 for start node
            True
        """
        self._validate_code(src)
        self._validate_code(dst)

        try:
            return nx.shortest_path(self.graph, src, dst)
        except nx.NetworkXNoPath:
            raise ValueError(f"No path found from '{src}' to '{dst}'")

    def all_shortest_paths(self, src: str, dst: str) -> List[List[str]]:
        """
        Find all shortest paths between two Gray codes.

        Useful when multiple optimal paths exist and we want to choose
        based on other criteria (e.g., preferring certain intermediate codes).

        Args:
            src: Source Gray code
            dst: Destination Gray code

        Returns:
            List of paths, where each path is a list of Gray codes

        Example:
            >>> hc = HypercubeGraph(2)
            >>> paths = hc.all_shortest_paths('00', '11')
            >>> len(paths) == 2  # Two paths: 00->01->11 and 00->10->11
            True
        """
        self._validate_code(src)
        self._validate_code(dst)

        try:
            return list(nx.all_shortest_paths(self.graph, src, dst))
        except nx.NetworkXNoPath:
            raise ValueError(f"No path found from '{src}' to '{dst}'")

    def path_length(self, src: str, dst: str) -> int:
        """
        Get the length of the shortest path (number of edges).

        This equals the Hamming distance between the codes.

        Args:
            src: Source Gray code
            dst: Destination Gray code

        Returns:
            Length of shortest path (number of edges)

        Example:
            >>> hc = HypercubeGraph(3)
            >>> hc.path_length('000', '001')
            1
            >>> hc.path_length('000', '111')
            3
        """
        self._validate_code(src)
        self._validate_code(dst)

        try:
            return nx.shortest_path_length(self.graph, src, dst)
        except nx.NetworkXNoPath:
            raise ValueError(f"No path found from '{src}' to '{dst}'")

    def neighbors(self, code: str) -> List[str]:
        """
        Get all neighbors of a Gray code (codes differing by 1 bit).

        In an n-dimensional hypercube, each node has exactly n neighbors.

        Args:
            code: Gray code

        Returns:
            List of neighboring Gray codes

        Example:
            >>> hc = HypercubeGraph(2)
            >>> neighbors = hc.neighbors('00')
            >>> len(neighbors) == 2
            True
            >>> '01' in neighbors and '10' in neighbors
            True
        """
        self._validate_code(code)
        return list(self.graph.neighbors(code))

    def has_code(self, code: str) -> bool:
        """
        Check if a Gray code exists in this hypercube.

        Args:
            code: Gray code to check

        Returns:
            True if code is a valid node in the graph
        """
        return code in self.graph

    def get_all_codes(self) -> List[str]:
        """
        Get all Gray codes in the hypercube.

        Returns:
            List of all n-bit Gray codes

        Example:
            >>> hc = HypercubeGraph(2)
            >>> codes = hc.get_all_codes()
            >>> len(codes) == 4
            True
        """
        return list(self.graph.nodes())

    def _validate_code(self, code: str) -> None:
        """
        Validate that a code exists in the graph.

        Args:
            code: Gray code to validate

        Raises:
            ValueError: If code is not in the graph
        """
        if not self.has_code(code):
            raise ValueError(
                f"Code '{code}' not in {self.n_bits}-bit hypercube. "
                f"Expected {self.n_bits}-bit Gray code."
            )

    def __repr__(self) -> str:
        """String representation of hypercube."""
        return (
            f"HypercubeGraph(n_bits={self.n_bits}, "
            f"nodes={self.graph.number_of_nodes()}, "
            f"edges={self.graph.number_of_edges()})"
        )

    def get_statistics(self) -> dict:
        """
        Get statistics about the hypercube graph.

        Returns:
            Dictionary with graph statistics
        """
        return {
            "n_bits": self.n_bits,
            "total_nodes": self.graph.number_of_nodes(),
            "total_edges": self.graph.number_of_edges(),
            "expected_nodes": 2**self.n_bits,
            "expected_edges_per_node": self.n_bits,
            "diameter": nx.diameter(self.graph),  # Maximum shortest path length
        }


def find_shortest_gray_path(src: str, dst: str) -> List[str]:
    """
    Convenience function to find shortest path without creating HypercubeGraph.

    Args:
        src: Source Gray code
        dst: Destination Gray code

    Returns:
        Shortest path as list of Gray codes

    Raises:
        ValueError: If codes have different lengths

    Example:
        >>> find_shortest_gray_path('000', '111')
        ['000', '001', '011', '111']
    """
    if len(src) != len(dst):
        raise ValueError(
            f"Codes must have same length: '{src}' ({len(src)} bits) "
            f"vs '{dst}' ({len(dst)} bits)"
        )

    n_bits = len(src)
    hypercube = HypercubeGraph(n_bits)
    return hypercube.shortest_path(src, dst)
