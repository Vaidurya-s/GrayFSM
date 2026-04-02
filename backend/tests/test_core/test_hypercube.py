"""
Unit tests for HypercubeGraph (app.core.hypercube).

Tests cover:
- Constructor: correct graph dimensions
- get_neighbors: returns exactly n neighbors for n-bit codes
- shortest_path: correct path length, single-bit steps
- find_intermediate_states: correct dummy states between endpoints
"""

import pytest
import networkx as nx
from app.core.gray_code import int_to_gray, gray_to_int, hamming_distance
from app.core.hypercube import HypercubeGraph


# =====================================================================
# Constructor
# =====================================================================

class TestHypercubeConstructor:
    """Tests for HypercubeGraph.__init__."""

    @pytest.mark.parametrize("bit_width", [1, 2, 3, 4, 5])
    def test_creates_correct_node_count(self, bit_width):
        """A bit_width-dimensional hypercube should have 2^bit_width nodes."""
        hg = HypercubeGraph(bit_width)
        assert hg.graph.number_of_nodes() == 2**bit_width

    @pytest.mark.parametrize("bit_width", [1, 2, 3, 4])
    def test_creates_correct_edge_count(self, bit_width):
        """An n-dim hypercube should have n * 2^(n-1) edges."""
        hg = HypercubeGraph(bit_width)
        expected_edges = bit_width * (2 ** (bit_width - 1))
        assert hg.graph.number_of_edges() == expected_edges

    def test_stores_bit_width(self):
        hg = HypercubeGraph(3)
        assert hg.bit_width == 3

    def test_graph_is_networkx_graph(self):
        hg = HypercubeGraph(2)
        assert isinstance(hg.graph, nx.Graph)

    @pytest.mark.parametrize("bit_width", [1, 2, 3])
    def test_graph_is_connected(self, bit_width):
        """Every hypercube graph should be connected."""
        hg = HypercubeGraph(bit_width)
        assert nx.is_connected(hg.graph)


# =====================================================================
# get_neighbors
# =====================================================================

class TestGetNeighbors:
    """Tests for HypercubeGraph.get_neighbors."""

    @pytest.mark.parametrize("bit_width", [2, 3, 4])
    def test_neighbor_count_equals_bit_width(self, bit_width):
        """Each node in an n-dim hypercube has exactly n neighbors."""
        hg = HypercubeGraph(bit_width)
        code = "0" * bit_width  # all-zeros code
        neighbors = hg.get_neighbors(code)
        assert len(neighbors) == bit_width

    def test_neighbors_differ_by_one_bit(self):
        """Every neighbor should differ from the original code by exactly 1 bit."""
        hg = HypercubeGraph(3)
        code = "000"
        neighbors = hg.get_neighbors(code)
        for neighbor in neighbors:
            assert hamming_distance(code, neighbor) == 1

    def test_neighbors_are_valid_gray_codes(self):
        """Returned neighbors should be valid binary strings of correct length."""
        hg = HypercubeGraph(3)
        neighbors = hg.get_neighbors("010")
        for n in neighbors:
            assert len(n) == 3
            assert all(c in ("0", "1") for c in n)


# =====================================================================
# shortest_path
# =====================================================================

class TestShortestPath:
    """Tests for HypercubeGraph.shortest_path."""

    def test_same_node_returns_single_element(self):
        """Path from a code to itself should be just that code."""
        hg = HypercubeGraph(3)
        path = hg.shortest_path("010", "010")
        assert path == ["010"]

    def test_adjacent_codes_path_length_two(self):
        """Adjacent codes (HD=1) should have a path of length 2."""
        hg = HypercubeGraph(3)
        path = hg.shortest_path("000", "001")
        assert len(path) == 2
        assert path[0] == "000"
        assert path[-1] == "001"

    @pytest.mark.parametrize("start, end, expected_hops", [
        ("000", "111", 3),
        ("000", "011", 2),
        ("000", "001", 1),
    ])
    def test_path_length_equals_hamming_distance(self, start, end, expected_hops):
        """Shortest path length (hops) should equal hamming distance."""
        hg = HypercubeGraph(3)
        path = hg.shortest_path(start, end)
        assert len(path) - 1 == expected_hops

    def test_every_step_differs_by_one_bit(self):
        """Each consecutive pair in the path should differ by exactly 1 bit."""
        hg = HypercubeGraph(3)
        path = hg.shortest_path("000", "111")
        for i in range(len(path) - 1):
            assert hamming_distance(path[i], path[i + 1]) == 1

    def test_path_starts_and_ends_correctly(self):
        """Path should start with start_code and end with end_code."""
        hg = HypercubeGraph(3)
        path = hg.shortest_path("010", "101")
        assert path[0] == "010"
        assert path[-1] == "101"


# =====================================================================
# find_intermediate_states
# =====================================================================

class TestFindIntermediateStates:
    """Tests for HypercubeGraph.find_intermediate_states."""

    def test_adjacent_codes_no_intermediates(self):
        """Adjacent codes (HD=1) should need zero intermediate states."""
        hg = HypercubeGraph(3)
        intermediates = hg.find_intermediate_states("000", "001")
        assert intermediates == []

    def test_hd2_one_intermediate(self):
        """Codes with HD=2 need exactly 1 intermediate state."""
        hg = HypercubeGraph(3)
        intermediates = hg.find_intermediate_states("000", "011")
        assert len(intermediates) == 1
        # The intermediate should be adjacent to both start and end
        assert hamming_distance("000", intermediates[0]) == 1
        assert hamming_distance(intermediates[0], "011") == 1

    def test_hd3_two_intermediates(self):
        """Codes with HD=3 need exactly 2 intermediate states."""
        hg = HypercubeGraph(3)
        intermediates = hg.find_intermediate_states("000", "111")
        assert len(intermediates) == 2

    def test_intermediates_form_valid_chain(self):
        """Start -> intermediates -> end should all be single-bit hops."""
        hg = HypercubeGraph(3)
        start, end = "000", "111"
        intermediates = hg.find_intermediate_states(start, end)
        chain = [start] + intermediates + [end]
        for i in range(len(chain) - 1):
            assert hamming_distance(chain[i], chain[i + 1]) == 1

    def test_same_code_no_intermediates(self):
        """Same start and end should produce no intermediates."""
        hg = HypercubeGraph(3)
        intermediates = hg.find_intermediate_states("010", "010")
        assert intermediates == []

    def test_4bit_hypercube(self):
        """Test with 4-bit codes for a larger hypercube."""
        hg = HypercubeGraph(4)
        start = "0000"
        end = "1111"
        intermediates = hg.find_intermediate_states(start, end)
        # HD("0000", "1111") = 4, so we need 3 intermediates
        assert len(intermediates) == 3
        chain = [start] + intermediates + [end]
        for i in range(len(chain) - 1):
            assert hamming_distance(chain[i], chain[i + 1]) == 1


# =====================================================================
# Conceptual / mathematical property tests
# =====================================================================

class TestHypercubeProperties:
    """Tests that verify hypercube properties using the graph structure."""

    @pytest.mark.parametrize("bit_width", [2, 3, 4])
    def test_every_node_has_n_neighbors(self, bit_width):
        """In an n-dimensional hypercube, every node has exactly n neighbors."""
        hg = HypercubeGraph(bit_width)
        for node in hg.graph.nodes:
            assert hg.graph.degree(node) == bit_width

    @pytest.mark.parametrize("bit_width", [2, 3, 4])
    def test_graph_diameter(self, bit_width):
        """The diameter of an n-dimensional hypercube is n."""
        hg = HypercubeGraph(bit_width)
        assert nx.diameter(hg.graph) == bit_width

    def test_hypercube_is_bipartite(self):
        """Hypercube graphs are bipartite."""
        hg = HypercubeGraph(3)
        assert nx.is_bipartite(hg.graph)

    @pytest.mark.parametrize("bit_width", [1, 2, 3, 4])
    def test_hypercube_is_regular(self, bit_width):
        """Hypercube is a regular graph (every node has the same degree)."""
        hg = HypercubeGraph(bit_width)
        degrees = set(d for _, d in hg.graph.degree())
        assert len(degrees) == 1
        assert degrees.pop() == bit_width
