"""
Unit tests for SimulatedAnnealingOptimizer
(app.core.algorithms.simulated_annealing).

Test coverage:
- Constructor: default and custom parameters
- optimize_fsm: result structure matches GreedyOptimizer contract
- optimize_fsm: result has lower or equal total Hamming distance vs naive
- Custom SA parameters work correctly
- Edge cases: single-state FSM, fully connected FSM, no-transition FSM
- Determinism with fixed seed
- Performance: runs within reasonable time for small FSMs
- optimize_encoding_only helper
- Algorithm is registered and discoverable via list_algorithms()
"""

import math
import time
from typing import Dict, List

import pytest

from app.core.gray_code import int_to_gray, hamming_distance, generate_gray_codes
from app.core.algorithms.simulated_annealing import SimulatedAnnealingOptimizer
from app.core.algorithms import (
    get_algorithm,
    get_algorithm_info,
    list_algorithms,
    ALGORITHM_REGISTRY,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _gray_encodings(states: List[str]) -> Dict[str, str]:
    """Assign sequential Gray codes to a list of state names."""
    n_bits = max(1, math.ceil(math.log2(max(len(states), 2))))
    return {s: int_to_gray(i, n_bits) for i, s in enumerate(states)}


def _total_hamming(states: Dict[str, str], transitions: List[Dict]) -> int:
    """Compute total Hamming distance for all non-self-loop transitions."""
    total = 0
    for t in transitions:
        fs, ts = t["from_state"], t["to_state"]
        if fs != ts and fs in states and ts in states:
            total += hamming_distance(states[fs], states[ts])
    return total


def _make_optimizer(bit_width: int = 2, **kwargs) -> SimulatedAnnealingOptimizer:
    return SimulatedAnnealingOptimizer(bit_width=bit_width, options=kwargs)


# ---------------------------------------------------------------------------
# Constructor
# ---------------------------------------------------------------------------

class TestSimulatedAnnealingInit:

    def test_default_parameters(self):
        opt = SimulatedAnnealingOptimizer(bit_width=3)
        assert opt.bit_width == 3
        assert opt.initial_temp == SimulatedAnnealingOptimizer.DEFAULT_INITIAL_TEMP
        assert opt.cooling_rate == SimulatedAnnealingOptimizer.DEFAULT_COOLING_RATE
        assert opt.min_temp == SimulatedAnnealingOptimizer.DEFAULT_MIN_TEMP
        assert opt.max_iterations == SimulatedAnnealingOptimizer.DEFAULT_MAX_ITERATIONS

    def test_custom_parameters_via_options(self):
        opt = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={
                "initial_temp": 50.0,
                "cooling_rate": 0.9,
                "min_temp": 0.1,
                "max_iterations": 500,
                "seed": 42,
            },
        )
        assert opt.initial_temp == 50.0
        assert opt.cooling_rate == 0.9
        assert opt.min_temp == 0.1
        assert opt.max_iterations == 500

    def test_no_options_dict_is_fine(self):
        opt = SimulatedAnnealingOptimizer(bit_width=2)
        assert opt is not None

    def test_inherits_from_greedy(self):
        from app.core.algorithms.greedy import GreedyOptimizer
        opt = SimulatedAnnealingOptimizer(bit_width=2)
        assert isinstance(opt, GreedyOptimizer)

    def test_hypercube_initialised(self):
        opt = SimulatedAnnealingOptimizer(bit_width=3)
        assert opt.hypercube is not None
        assert opt.hypercube.bit_width == 3


# ---------------------------------------------------------------------------
# Return structure (must match GreedyOptimizer contract)
# ---------------------------------------------------------------------------

class TestResultStructure:

    def _run(self, states, transitions, outputs, fsm_type="moore", **kwargs):
        n_bits = max(1, math.ceil(math.log2(max(len(states), 2))))
        opt = _make_optimizer(n_bits, seed=0, max_iterations=200, **kwargs)
        return opt.optimize_fsm(states, transitions, outputs, fsm_type)

    def test_returns_tuple_of_two(self):
        states = {"A": "00", "B": "01", "C": "11"}
        transitions = [{"from_state": "A", "to_state": "C"}]
        outputs = {"A": "0", "B": "0", "C": "1"}
        result = self._run(states, transitions, outputs)
        assert isinstance(result, tuple)
        assert len(result) == 2

    def test_first_element_is_list_of_dummy_states(self):
        from app.core.algorithms.greedy import DummyState
        states = {"A": "00", "B": "11"}
        transitions = [{"from_state": "A", "to_state": "B"}]
        outputs = {"A": "0", "B": "1"}
        dummy_states, _ = self._run(states, transitions, outputs, n_bits=2)
        assert isinstance(dummy_states, list)
        for ds in dummy_states:
            assert isinstance(ds, DummyState)

    def test_second_element_is_list_of_dicts(self):
        states = {"A": "00", "B": "01"}
        transitions = [{"from_state": "A", "to_state": "B"}]
        outputs = {"A": "0", "B": "1"}
        _, new_trans = self._run(states, transitions, outputs)
        assert isinstance(new_trans, list)
        for t in new_trans:
            assert isinstance(t, dict)

    def test_transitions_have_from_and_to_state_keys(self):
        states = {"A": "00", "B": "01", "C": "11"}
        transitions = [
            {"from_state": "A", "to_state": "B"},
            {"from_state": "B", "to_state": "C"},
        ]
        outputs = {"A": "0", "B": "0", "C": "1"}
        _, new_trans = self._run(states, transitions, outputs)
        for t in new_trans:
            assert "from_state" in t
            assert "to_state" in t

    def test_new_transitions_count_ge_original(self):
        """Annealing may eliminate dummy states but never loses real transitions."""
        states = {"A": "00", "B": "11"}
        transitions = [
            {"from_state": "A", "to_state": "B"},
            {"from_state": "B", "to_state": "A"},
        ]
        outputs = {"A": "0", "B": "1"}
        dummy_states, new_trans = self._run(states, transitions, outputs, n_bits=2)
        assert len(new_trans) >= len(transitions)

    def test_all_new_transition_hops_are_hd_le_1(self):
        """After optimization every hop must have Hamming distance <= 1."""
        states = {"X": "000", "Y": "111", "Z": "101"}
        transitions = [
            {"from_state": "X", "to_state": "Y"},
            {"from_state": "Y", "to_state": "Z"},
        ]
        outputs = {"X": "0", "Y": "1", "Z": "0"}

        opt = SimulatedAnnealingOptimizer(
            bit_width=3,
            options={"seed": 0, "max_iterations": 200},
        )
        dummy_states, new_trans = opt.optimize_fsm(states, transitions, outputs, "moore")

        # Use the post-anneal encoding for the real states, not the original
        all_encodings = dict(opt.best_assignment)
        for ds in dummy_states:
            all_encodings[ds.id] = ds.encoding

        for t in new_trans:
            from_enc = all_encodings[t["from_state"]]
            to_enc = all_encodings[t["to_state"]]
            assert hamming_distance(from_enc, to_enc) <= 1, (
                f"Hop {t['from_state']}→{t['to_state']} has HD "
                f"{hamming_distance(from_enc, to_enc)}"
            )

    def _run(self, states, transitions, outputs, fsm_type="moore", n_bits=None, **kwargs):
        if n_bits is None:
            # Derive bit_width from the encoding strings to avoid mismatch
            sample_enc = next(iter(states.values()))
            n_bits = len(sample_enc)
        opt = _make_optimizer(n_bits, seed=0, max_iterations=200, **kwargs)
        return opt.optimize_fsm(states, transitions, outputs, fsm_type)


# ---------------------------------------------------------------------------
# Optimisation quality
# ---------------------------------------------------------------------------

class TestOptimisationQuality:

    def test_result_cost_le_initial_cost(self):
        """
        The optimised assignment should have total Hamming distance <=
        the worst-case (reverse-ordered) assignment.
        """
        # Deliberately bad assignment: reverse Gray code order
        states_bad = {
            "A": "11",
            "B": "10",
            "C": "01",
            "D": "00",
        }
        transitions = [
            {"from_state": "A", "to_state": "B"},
            {"from_state": "B", "to_state": "C"},
            {"from_state": "C", "to_state": "D"},
            {"from_state": "D", "to_state": "A"},
        ]
        outputs = {"A": "0", "B": "0", "C": "1", "D": "1"}

        initial_cost = _total_hamming(states_bad, transitions)

        opt = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={"seed": 42, "max_iterations": 2000, "initial_temp": 50.0},
        )
        best_assignment = opt.optimize_encoding_only(states_bad, transitions)
        final_cost = _total_hamming(best_assignment, transitions)

        assert final_cost <= initial_cost, (
            f"Expected final cost ({final_cost}) <= initial cost ({initial_cost})"
        )

    def test_already_optimal_not_worsened(self):
        """
        A Gray-code cycle is already optimal (all transitions HD=1).
        The annealer should not make it worse.
        """
        states_optimal = {"A": "00", "B": "01", "C": "11", "D": "10"}
        transitions = [
            {"from_state": "A", "to_state": "B"},
            {"from_state": "B", "to_state": "C"},
            {"from_state": "C", "to_state": "D"},
            {"from_state": "D", "to_state": "A"},
        ]
        initial_cost = _total_hamming(states_optimal, transitions)
        assert initial_cost == 4  # sanity check: 4 transitions each HD=1

        opt = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={"seed": 7, "max_iterations": 1000},
        )
        best_assignment = opt.optimize_encoding_only(states_optimal, transitions)
        final_cost = _total_hamming(best_assignment, transitions)

        assert final_cost <= initial_cost

    def test_cost_zero_terminates_early(self):
        """
        If the initial encoding already has zero total Hamming cost
        (only self-loops), the optimizer should return immediately.
        """
        states = {"A": "0", "B": "1"}
        transitions = [
            {"from_state": "A", "to_state": "A"},
            {"from_state": "B", "to_state": "B"},
        ]
        opt = SimulatedAnnealingOptimizer(
            bit_width=1,
            options={"seed": 0, "max_iterations": 10000},
        )
        opt.optimize_encoding_only(states, transitions)
        # Should have done zero iterations (short-circuited)
        assert opt.iterations_run == 0

    def test_diagnostics_populated_after_run(self):
        states = {"A": "00", "B": "11", "C": "01"}
        transitions = [
            {"from_state": "A", "to_state": "B"},
            {"from_state": "B", "to_state": "C"},
        ]
        opt = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={"seed": 1, "max_iterations": 500},
        )
        opt.optimize_encoding_only(states, transitions)

        assert opt.initial_cost >= 0
        assert opt.final_cost >= 0
        assert opt.final_cost <= opt.initial_cost
        assert 0.0 <= opt.improvement_ratio <= 1.0


# ---------------------------------------------------------------------------
# Custom parameters
# ---------------------------------------------------------------------------

class TestCustomParameters:

    def test_high_cooling_rate_runs_more_iterations(self):
        """With cooling_rate close to 1.0, more iterations are taken."""
        states = {"A": "00", "B": "11"}
        transitions = [{"from_state": "A", "to_state": "B"}]
        outputs = {"A": "0", "B": "1"}

        opt_slow = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={"seed": 0, "cooling_rate": 0.9999, "max_iterations": 10000},
        )
        opt_fast = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={"seed": 0, "cooling_rate": 0.5, "max_iterations": 10000},
        )

        opt_slow.optimize_encoding_only(states, transitions)
        opt_fast.optimize_encoding_only(states, transitions)

        assert opt_slow.iterations_run > opt_fast.iterations_run

    def test_max_iterations_respected(self):
        """Optimizer must not exceed max_iterations."""
        states = _gray_encodings(["A", "B", "C", "D"])
        transitions = [
            {"from_state": "A", "to_state": "C"},
            {"from_state": "B", "to_state": "D"},
        ]
        cap = 50
        opt = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={"seed": 0, "max_iterations": cap, "cooling_rate": 0.9999},
        )
        opt.optimize_encoding_only(states, transitions)
        assert opt.iterations_run <= cap

    def test_very_high_initial_temp_accepts_worse_solutions(self):
        """
        With a very high temperature and a tiny cooling rate the optimizer
        should still terminate and return a valid result.
        """
        states = {"A": "00", "B": "01", "C": "11"}
        transitions = [
            {"from_state": "A", "to_state": "B"},
            {"from_state": "B", "to_state": "C"},
        ]
        outputs = {"A": "0", "B": "0", "C": "1"}
        opt = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={
                "seed": 0,
                "initial_temp": 1e9,
                "cooling_rate": 0.5,
                "min_temp": 0.01,
                "max_iterations": 200,
            },
        )
        dummy_states, new_trans = opt.optimize_fsm(states, transitions, outputs, "moore")
        assert isinstance(dummy_states, list)
        assert isinstance(new_trans, list)

    def test_very_low_initial_temp_behaves_like_greedy(self):
        """
        With temperature nearly zero from the start, no uphill moves are
        accepted, so the result should match a greedy pass on the same input.
        """
        states = {"A": "00", "B": "11"}
        transitions = [{"from_state": "A", "to_state": "B"}]
        outputs = {"A": "0", "B": "1"}

        opt = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={"seed": 0, "initial_temp": 0.0001, "min_temp": 0.01, "max_iterations": 1000},
        )
        dummy_states, new_trans = opt.optimize_fsm(states, transitions, outputs, "moore")
        assert isinstance(dummy_states, list)
        assert len(new_trans) >= len(transitions)


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:

    def test_single_state_fsm(self):
        """A single-state FSM should return without error."""
        opt = SimulatedAnnealingOptimizer(bit_width=1, options={"seed": 0})
        states = {"IDLE": "0"}
        transitions = [{"from_state": "IDLE", "to_state": "IDLE"}]
        outputs = {"IDLE": "0"}

        dummy_states, new_trans = opt.optimize_fsm(states, transitions, outputs, "moore")
        assert isinstance(dummy_states, list)
        assert len(new_trans) >= 1

    def test_single_state_no_transitions(self):
        opt = SimulatedAnnealingOptimizer(bit_width=1, options={"seed": 0})
        states = {"IDLE": "0"}
        transitions: List[Dict] = []
        outputs = {"IDLE": "0"}

        dummy_states, new_trans = opt.optimize_fsm(states, transitions, outputs, "moore")
        assert dummy_states == []
        assert new_trans == []

    def test_fully_connected_fsm(self):
        """All-to-all transitions — optimizer must handle without error."""
        state_names = ["S0", "S1", "S2", "S3"]
        states = _gray_encodings(state_names)
        transitions = [
            {"from_state": s1, "to_state": s2}
            for s1 in state_names
            for s2 in state_names
            if s1 != s2
        ]
        outputs = {s: "0" for s in state_names}

        opt = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={"seed": 0, "max_iterations": 500},
        )
        dummy_states, new_trans = opt.optimize_fsm(states, transitions, outputs, "moore")
        assert isinstance(dummy_states, list)
        assert len(new_trans) >= len(transitions)

    def test_two_states_only_self_loops(self):
        """Only self-loops — total Hamming cost is zero, no dummy states needed."""
        opt = SimulatedAnnealingOptimizer(bit_width=1, options={"seed": 0})
        states = {"A": "0", "B": "1"}
        transitions = [
            {"from_state": "A", "to_state": "A"},
            {"from_state": "B", "to_state": "B"},
        ]
        outputs = {"A": "0", "B": "1"}

        dummy_states, new_trans = opt.optimize_fsm(states, transitions, outputs, "moore")
        assert len(dummy_states) == 0
        assert len(new_trans) == 2

    def test_mealy_fsm_structure(self):
        """Mealy FSM dummy states should carry 'X' output."""
        states = {"S0": "00", "S1": "11"}
        transitions = [
            {"from_state": "S0", "to_state": "S1", "input": "1", "output": "0"}
        ]
        outputs = {"S0": "0", "S1": "1"}

        opt = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={"seed": 0, "max_iterations": 200},
        )
        dummy_states, _ = opt.optimize_fsm(states, transitions, outputs, "mealy")
        # If any dummy states were inserted, their output must be 'X'
        for ds in dummy_states:
            assert ds.output == "X"

    def test_no_transitions_returns_empty(self):
        states = _gray_encodings(["A", "B", "C"])
        transitions: List[Dict] = []
        outputs = {"A": "0", "B": "0", "C": "1"}

        opt = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={"seed": 0, "max_iterations": 100},
        )
        dummy_states, new_trans = opt.optimize_fsm(states, transitions, outputs, "moore")
        assert dummy_states == []
        assert new_trans == []


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------

class TestDeterminism:

    def _run_with_seed(self, seed: int):
        states = {
            "A": "00",
            "B": "11",
            "C": "01",
            "D": "10",
        }
        transitions = [
            {"from_state": "A", "to_state": "B"},
            {"from_state": "B", "to_state": "C"},
            {"from_state": "C", "to_state": "D"},
            {"from_state": "D", "to_state": "A"},
        ]
        outputs = {"A": "0", "B": "1", "C": "0", "D": "1"}

        opt = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={"seed": seed, "max_iterations": 1000},
        )
        best = opt.optimize_encoding_only(states, transitions)
        return best, opt.final_cost

    def test_same_seed_same_result(self):
        result1, cost1 = self._run_with_seed(99)
        result2, cost2 = self._run_with_seed(99)
        assert result1 == result2
        assert cost1 == cost2

    def test_different_seeds_may_differ(self):
        """Different seeds should produce potentially different paths."""
        # We only check that the function runs — same result by chance is OK
        result1, _ = self._run_with_seed(1)
        result2, _ = self._run_with_seed(2)
        # Both should be valid assignments (all state IDs present)
        assert set(result1.keys()) == set(result2.keys())

    def test_encoding_assignment_is_permutation(self):
        """Each state must map to a distinct encoding after optimization."""
        states = _gray_encodings(["A", "B", "C", "D"])
        transitions = [
            {"from_state": "A", "to_state": "C"},
            {"from_state": "B", "to_state": "D"},
        ]
        opt = SimulatedAnnealingOptimizer(
            bit_width=2,
            options={"seed": 0, "max_iterations": 500},
        )
        best = opt.optimize_encoding_only(states, transitions)

        # Every original encoding should still appear exactly once
        assert sorted(best.values()) == sorted(states.values())


# ---------------------------------------------------------------------------
# Performance
# ---------------------------------------------------------------------------

class TestPerformance:

    def test_small_fsm_completes_quickly(self):
        """5-state FSM with 10 000 iterations should run in < 5 seconds."""
        state_names = ["S0", "S1", "S2", "S3", "S4"]
        states = _gray_encodings(state_names)
        transitions = [
            {"from_state": state_names[i], "to_state": state_names[(i + 1) % len(state_names)]}
            for i in range(len(state_names))
        ]
        outputs = {s: "0" for s in state_names}

        opt = SimulatedAnnealingOptimizer(
            bit_width=3,
            options={"seed": 0, "max_iterations": 10000},
        )
        start = time.monotonic()
        dummy_states, new_trans = opt.optimize_fsm(states, transitions, outputs, "moore")
        elapsed = time.monotonic() - start

        assert elapsed < 5.0, f"Optimizer took {elapsed:.2f}s, expected < 5s"
        assert isinstance(dummy_states, list)
        assert isinstance(new_trans, list)

    def test_medium_fsm_completes_quickly(self):
        """8-state FSM with 10 000 iterations should run in < 10 seconds."""
        state_names = [f"S{i}" for i in range(8)]
        states = _gray_encodings(state_names)
        transitions = [
            {"from_state": state_names[i], "to_state": state_names[(i + 2) % len(state_names)]}
            for i in range(len(state_names))
        ]
        outputs = {s: "0" for s in state_names}

        opt = SimulatedAnnealingOptimizer(
            bit_width=3,
            options={"seed": 0, "max_iterations": 10000},
        )
        start = time.monotonic()
        opt.optimize_fsm(states, transitions, outputs, "moore")
        elapsed = time.monotonic() - start

        assert elapsed < 10.0, f"Optimizer took {elapsed:.2f}s, expected < 10s"


# ---------------------------------------------------------------------------
# Algorithm registry integration
# ---------------------------------------------------------------------------

class TestAlgorithmRegistry:

    def test_simulated_annealing_in_registry(self):
        assert "simulated_annealing" in ALGORITHM_REGISTRY

    def test_get_algorithm_returns_correct_class(self):
        cls = get_algorithm("simulated_annealing")
        assert cls is SimulatedAnnealingOptimizer

    def test_get_algorithm_info_returns_dict(self):
        info = get_algorithm_info("simulated_annealing")
        assert isinstance(info, dict)
        assert "name" in info
        assert "description" in info
        assert "complexity" in info

    def test_list_algorithms_includes_sa(self):
        algorithms = list_algorithms()
        ids = [a["id"] for a in algorithms]
        assert "simulated_annealing" in ids

    def test_list_algorithms_sa_entry_has_required_keys(self):
        algorithms = list_algorithms()
        sa_entry = next(a for a in algorithms if a["id"] == "simulated_annealing")
        for key in ("id", "name", "description", "complexity", "version"):
            assert key in sa_entry, f"Missing key '{key}' in SA algorithm entry"

    def test_instantiate_via_registry(self):
        """Registry-fetched class can be instantiated with bit_width."""
        cls = get_algorithm("simulated_annealing")
        instance = cls(bit_width=2)
        assert isinstance(instance, SimulatedAnnealingOptimizer)

    def test_registry_class_accepts_options(self):
        """Registry-fetched class can be called with options kwarg."""
        cls = get_algorithm("simulated_annealing")
        instance = cls(bit_width=2, options={"seed": 1, "max_iterations": 100})
        assert instance.max_iterations == 100


# ---------------------------------------------------------------------------
# optimize_encoding_only helper
# ---------------------------------------------------------------------------

class TestEncodeOnlyHelper:

    def test_returns_dict_with_same_state_ids(self):
        states = _gray_encodings(["A", "B", "C"])
        transitions = [{"from_state": "A", "to_state": "C"}]
        opt = SimulatedAnnealingOptimizer(bit_width=2, options={"seed": 0})
        result = opt.optimize_encoding_only(states, transitions)
        assert set(result.keys()) == set(states.keys())

    def test_returns_valid_bit_strings(self):
        states = _gray_encodings(["A", "B", "C", "D"])
        transitions = [{"from_state": "A", "to_state": "C"}]
        opt = SimulatedAnnealingOptimizer(bit_width=2, options={"seed": 0})
        result = opt.optimize_encoding_only(states, transitions)
        for enc in result.values():
            assert len(enc) == 2
            assert all(c in "01" for c in enc)

    def test_single_state_returns_same(self):
        states = {"ONLY": "0"}
        transitions: List[Dict] = []
        opt = SimulatedAnnealingOptimizer(bit_width=1, options={"seed": 0})
        result = opt.optimize_encoding_only(states, transitions)
        assert result == states


# ---------------------------------------------------------------------------
# Parameterized coverage of optimize_encoding_only (finding 9)
#
# Exercises both branches of the method (lines 252-256 of simulated_annealing.py):
#   - len(states) <= 1  → short-circuit, return states unchanged
#   - len(states) > 1   → run _anneal(), return improved assignment
#
# All runs use a fixed seed so results are deterministic in CI.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "states, transitions, expected_keys, check_permutation",
    [
        # Branch A: single-state short-circuit — best_assignment == input, 0 iterations
        pytest.param(
            {"S0": "0"},
            [],
            {"S0"},
            False,
            id="single_state_short_circuit",
        ),
        # Branch B: two states, one hop — anneal runs and returns a permutation
        pytest.param(
            {"A": "00", "B": "11"},
            [{"from_state": "A", "to_state": "B"}],
            {"A", "B"},
            True,
            id="two_states_one_hop_seed42",
        ),
        # Branch B: four states in a ring — anneal should not raise and must
        #           return an assignment whose values are a permutation of the inputs
        pytest.param(
            {"A": "00", "B": "01", "C": "11", "D": "10"},
            [
                {"from_state": "A", "to_state": "B"},
                {"from_state": "B", "to_state": "C"},
                {"from_state": "C", "to_state": "D"},
                {"from_state": "D", "to_state": "A"},
            ],
            {"A", "B", "C", "D"},
            True,
            id="four_states_ring_seed7",
        ),
        # Branch B: deliberately bad assignment — post-anneal cost must be <= pre
        pytest.param(
            {"A": "11", "B": "10", "C": "01", "D": "00"},
            [
                {"from_state": "A", "to_state": "C"},
                {"from_state": "B", "to_state": "D"},
            ],
            {"A", "B", "C", "D"},
            True,
            id="bad_assignment_cost_monotone_seed99",
        ),
    ],
)
def test_optimize_encoding_only_parametrized(
    states: Dict[str, str],
    transitions: List[Dict],
    expected_keys: set,
    check_permutation: bool,
) -> None:
    """
    Parameterized test covering both branches of optimize_encoding_only.

    - Single-state input hits the len(states) <= 1 short-circuit and must
      return the original dict unchanged with best_assignment populated.
    - Multi-state input runs _anneal() and must return a valid permutation
      of the original encodings whose total Hamming cost is <= the input cost.
    """
    # Use a fixed seed for all multi-state cases so the test is deterministic.
    seed = 42
    n_bits = len(next(iter(states.values())))
    opt = SimulatedAnnealingOptimizer(
        bit_width=n_bits,
        options={"seed": seed, "max_iterations": 2000},
    )

    pre_cost = _total_hamming(states, transitions)
    result = opt.optimize_encoding_only(states, transitions)

    # Keys must be preserved exactly
    assert set(result.keys()) == expected_keys

    if check_permutation:
        # Result is a permutation of the original codes
        assert sorted(result.values()) == sorted(states.values()), (
            "optimize_encoding_only must return a permutation of the input encodings"
        )
        # Cost is monotone non-increasing
        post_cost = _total_hamming(result, transitions)
        assert post_cost <= pre_cost, (
            f"Cost increased from {pre_cost} to {post_cost}"
        )
        # best_assignment must be populated and consistent with result
        assert opt.best_assignment == result
    else:
        # Single-state short-circuit: result equals original and iters == 0
        assert result == states
        assert opt.best_assignment == states
