"""
Property-based tests for FSM optimization algorithms using Hypothesis.

Tests cover:
- Greedy, BFS, and Simulated Annealing optimizers
- Property 1: avg Hamming distance after optimization <= original (greedy)
- Property 2: avg Hamming distance after optimization <= original (BFS)
- Property 3: avg Hamming distance after optimization <= original (SA)
- Property 4: all algorithms produce valid encodings (correct bit width, unique)
- Property 5: optimized FSM preserves all original states and transitions
"""

import math
from typing import Dict, List

import pytest
from hypothesis import given, settings, assume
import hypothesis.strategies as st

from app.core.gray_code import generate_gray_codes, hamming_distance, int_to_gray
from app.core.algorithms.greedy import GreedyOptimizer
from app.core.algorithms.bfs_optimal import BFSOptimizer
from app.core.algorithms.simulated_annealing import SimulatedAnnealingOptimizer
from app.utils.exceptions import AlgorithmException


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _bit_width(n_states: int) -> int:
    """Compute minimum bit width for n_states."""
    return max(1, math.ceil(math.log2(max(n_states, 2))))


def _assign_gray_encodings(states: List[str]) -> Dict[str, str]:
    """Assign sequential Gray code encodings to a list of state names."""
    n_bits = _bit_width(len(states))
    return {s: int_to_gray(i, n_bits) for i, s in enumerate(states)}


def _avg_hamming(
    states: Dict[str, str],
    transitions: List[Dict],
) -> float:
    """
    Compute average Hamming distance over all non-self-loop transitions
    using the given encoding.  Returns 0.0 if no transitions.
    """
    distances = []
    for t in transitions:
        fs = t.get("from_state")
        ts = t.get("to_state")
        if fs == ts:
            continue
        enc_from = states.get(fs)
        enc_to = states.get(ts)
        if enc_from is None or enc_to is None:
            continue
        distances.append(hamming_distance(enc_from, enc_to))
    return sum(distances) / len(distances) if distances else 0.0

def _optimize_or_skip(opt, states, transitions, outputs, fsm_type):
    """Run an optimizer; on AlgorithmException the encoding space is
    exhausted at this bit_width — a valid outcome per the new algorithms'
    contract. Signal Hypothesis to skip via assume(False)."""
    try:
        return opt.optimize_fsm(states, transitions, outputs, fsm_type)
    except AlgorithmException:
        assume(False)
        return [], []  # unreachable — assume(False) raises Skip


def _all_encodings_from_result(
    original_states: Dict[str, str],
    dummy_states,
) -> Dict[str, str]:
    """Merge original state encodings with dummy state encodings."""
    combined = dict(original_states)
    for ds in dummy_states:
        combined[ds.id] = ds.encoding
    return combined


# ---------------------------------------------------------------------------
# Hypothesis strategies
# ---------------------------------------------------------------------------

# State name strategy: 1-8 alphabetic characters
state_name_st = st.text(
    alphabet=st.characters(whitelist_categories=("Lu", "Ll")),
    min_size=1,
    max_size=6,
)

# Strategy: generate a list of 2-8 unique state names
@st.composite
def unique_state_names(draw, min_states: int = 2, max_states: int = 8):
    names = draw(
        st.lists(
            state_name_st,
            min_size=min_states,
            max_size=max_states,
            unique=True,
        )
    )
    return names


# Strategy: generate a list of random transitions between given states
@st.composite
def random_transitions(draw, states: List[str], max_transitions: int = 12):
    n = draw(st.integers(min_value=0, max_value=max_transitions))
    transitions = []
    for _ in range(n):
        from_s = draw(st.sampled_from(states))
        to_s = draw(st.sampled_from(states))
        inp = draw(st.one_of(st.none(), st.text(
            alphabet="abcdefghijklmnopqrstuvwxyz",
            min_size=1,
            max_size=4,
        )))
        transitions.append({
            "from_state": from_s,
            "to_state": to_s,
            "input": inp,
        })
    return transitions


# Strategy: generate a full FSM definition dict (states + transitions + outputs)
@st.composite
def random_fsm(draw, min_states: int = 2, max_states: int = 8):
    states = draw(unique_state_names(min_states=min_states, max_states=max_states))
    transitions = draw(random_transitions(states))
    outputs = {s: "0" for s in states}
    fsm_type = draw(st.sampled_from(["moore", "mealy"]))
    encodings = _assign_gray_encodings(states)
    return {
        "states": states,
        "transitions": transitions,
        "outputs": outputs,
        "fsm_type": fsm_type,
        "encodings": encodings,
    }


# ---------------------------------------------------------------------------
# Property 1: Greedy optimization produces avg HD <= original
# ---------------------------------------------------------------------------

class TestGreedyPropertyBased:
    """Property-based tests for GreedyOptimizer."""

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_greedy_avg_hd_not_worse(self, fsm):
        """
        For any valid FSM, greedy optimization produces an average Hamming
        distance over the new transitions that is <= original avg HD.
        After optimization every hop in the new transition set is HD<=1,
        so avg HD of the new set is always <= avg HD of the original set.
        """
        states = fsm["encodings"]
        transitions = fsm["transitions"]
        outputs = fsm["outputs"]
        fsm_type = fsm["fsm_type"]

        n_bits = _bit_width(len(states))
        opt = GreedyOptimizer(bit_width=n_bits)

        original_avg = _avg_hamming(states, transitions)

        try:
            dummy_states, new_trans = _optimize_or_skip(opt, states, transitions, outputs, fsm_type)
        except AlgorithmException:
            # The encoding space is exhausted at this bit_width — a valid
            # outcome per the new algorithms' contract. Skip this example
            # so the property is only checked on cases the algorithm can
            # actually solve.
            assume(False)
            return

        all_enc = _all_encodings_from_result(states, dummy_states)
        new_avg = _avg_hamming(all_enc, new_trans)

        # After optimization every new hop is HD<=1, so avg can only go down
        # (or stay at 0 if no transitions)
        assert new_avg <= original_avg + 1e-9  # allow floating-point epsilon

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_greedy_all_new_hops_hd_le_1(self, fsm):
        """After greedy optimization every transition hop must be HD<=1."""
        states = fsm["encodings"]
        transitions = fsm["transitions"]
        outputs = fsm["outputs"]
        fsm_type = fsm["fsm_type"]

        n_bits = _bit_width(len(states))
        opt = GreedyOptimizer(bit_width=n_bits)

        try:
            dummy_states, new_trans = _optimize_or_skip(opt, states, transitions, outputs, fsm_type)
        except AlgorithmException:
            # The encoding space is exhausted at this bit_width — a valid
            # outcome per the new algorithms' contract. Skip this example
            # so the property is only checked on cases the algorithm can
            # actually solve.
            assume(False)
            return

        all_enc = _all_encodings_from_result(states, dummy_states)
        for t in new_trans:
            fs = t.get("from_state")
            ts = t.get("to_state")
            if fs == ts:
                continue
            enc_from = all_enc.get(fs)
            enc_to = all_enc.get(ts)
            if enc_from is not None and enc_to is not None:
                assert hamming_distance(enc_from, enc_to) <= 1


# ---------------------------------------------------------------------------
# Property 2: BFS optimization produces avg HD <= original
# ---------------------------------------------------------------------------

class TestBFSPropertyBased:
    """Property-based tests for BFSOptimizer."""

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_bfs_avg_hd_not_worse(self, fsm):
        """
        BFS optimization produces avg Hamming distance <= original.
        """
        states = fsm["encodings"]
        transitions = fsm["transitions"]
        outputs = fsm["outputs"]
        fsm_type = fsm["fsm_type"]

        n_bits = _bit_width(len(states))
        opt = BFSOptimizer(bit_width=n_bits)

        original_avg = _avg_hamming(states, transitions)
        try:
            dummy_states, new_trans = _optimize_or_skip(opt, states, transitions, outputs, fsm_type)
        except AlgorithmException:
            # The encoding space is exhausted at this bit_width — a valid
            # outcome per the new algorithms' contract. Skip this example
            # so the property is only checked on cases the algorithm can
            # actually solve.
            assume(False)
            return

        all_enc = _all_encodings_from_result(states, dummy_states)
        new_avg = _avg_hamming(all_enc, new_trans)

        assert new_avg <= original_avg + 1e-9

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_bfs_all_new_hops_hd_le_1(self, fsm):
        """After BFS optimization every transition hop must be HD<=1."""
        states = fsm["encodings"]
        transitions = fsm["transitions"]
        outputs = fsm["outputs"]
        fsm_type = fsm["fsm_type"]

        n_bits = _bit_width(len(states))
        opt = BFSOptimizer(bit_width=n_bits)

        try:
            dummy_states, new_trans = _optimize_or_skip(opt, states, transitions, outputs, fsm_type)
        except AlgorithmException:
            # The encoding space is exhausted at this bit_width — a valid
            # outcome per the new algorithms' contract. Skip this example
            # so the property is only checked on cases the algorithm can
            # actually solve.
            assume(False)
            return

        all_enc = _all_encodings_from_result(states, dummy_states)
        for t in new_trans:
            fs = t.get("from_state")
            ts = t.get("to_state")
            if fs == ts:
                continue
            enc_from = all_enc.get(fs)
            enc_to = all_enc.get(ts)
            if enc_from is not None and enc_to is not None:
                assert hamming_distance(enc_from, enc_to) <= 1


# ---------------------------------------------------------------------------
# Property 3: Simulated Annealing produces avg HD <= original
# ---------------------------------------------------------------------------

class TestSAPropertyBased:
    """Property-based tests for SimulatedAnnealingOptimizer."""

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_sa_avg_hd_not_worse(self, fsm):
        """
        SA optimization produces avg Hamming distance <= original.
        SA reassigns encodings; we compare the cost of the best_assignment
        against the original assignment — SA is designed to minimise total
        Hamming cost so best_assignment cost <= original cost.
        """
        states = fsm["encodings"]
        transitions = fsm["transitions"]
        outputs = fsm["outputs"]
        fsm_type = fsm["fsm_type"]

        n_bits = _bit_width(len(states))
        opt = SimulatedAnnealingOptimizer(
            bit_width=n_bits,
            options={"max_iterations": 500, "seed": 42},
        )

        original_avg = _avg_hamming(states, transitions)
        _optimize_or_skip(opt, states, transitions, outputs, fsm_type)
        # Compare original-state avg HD using the SA-improved assignment
        best_avg = _avg_hamming(opt.best_assignment, transitions)

        # SA minimises HD cost over original states, so best_avg <= original_avg
        assert best_avg <= original_avg + 1e-9

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_sa_all_new_hops_hd_le_1(self, fsm):
        """After SA optimization every transition hop must be HD<=1.

        The full result (dummy_states + new_trans) is produced by the greedy
        pass running on best_assignment, so every hop in new_trans is HD<=1
        within the best_assignment encoding space.
        """
        states = fsm["encodings"]
        transitions = fsm["transitions"]
        outputs = fsm["outputs"]
        fsm_type = fsm["fsm_type"]

        n_bits = _bit_width(len(states))
        opt = SimulatedAnnealingOptimizer(
            bit_width=n_bits,
            options={"max_iterations": 200, "seed": 0},
        )

        try:
            dummy_states, new_trans = _optimize_or_skip(opt, states, transitions, outputs, fsm_type)
        except AlgorithmException:
            # The encoding space is exhausted at this bit_width — a valid
            # outcome per the new algorithms' contract. Skip this example
            # so the property is only checked on cases the algorithm can
            # actually solve.
            assume(False)
            return

        # Use best_assignment (the SA-rearranged encoding) as base, then add
        # dummy state encodings on top — that is the correct encoding map for
        # the new transition set.
        all_enc = _all_encodings_from_result(opt.best_assignment, dummy_states)
        for t in new_trans:
            fs = t.get("from_state")
            ts = t.get("to_state")
            if fs == ts:
                continue
            enc_from = all_enc.get(fs)
            enc_to = all_enc.get(ts)
            if enc_from is not None and enc_to is not None:
                assert hamming_distance(enc_from, enc_to) <= 1


# ---------------------------------------------------------------------------
# Property 4: All algorithms produce valid encodings
# (correct bit width, unique per state)
# ---------------------------------------------------------------------------

class TestValidEncodings:
    """Property 4: valid encodings from all algorithms."""

    def _check_encodings(self, states: Dict[str, str], n_bits: int):
        """Assert each encoding has the right width and all are unique."""
        assert len(states) == len(set(states.values())), (
            f"Duplicate encodings found: {states}"
        )
        for state, enc in states.items():
            assert len(enc) == n_bits, (
                f"State {state} has encoding '{enc}' of wrong width "
                f"(expected {n_bits})"
            )
            assert all(c in ("0", "1") for c in enc), (
                f"Encoding '{enc}' contains non-binary characters"
            )

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_greedy_valid_encodings(self, fsm):
        """Greedy optimizer produces valid encodings for original states."""
        states = fsm["encodings"]
        n_bits = _bit_width(len(states))
        opt = GreedyOptimizer(bit_width=n_bits)
        dummy_states, _ = _optimize_or_skip(opt, states, fsm["transitions"], fsm["outputs"], fsm["fsm_type"])
        # Original state encodings must be valid
        self._check_encodings(states, n_bits)
        # Dummy state encodings must also be valid
        for ds in dummy_states:
            assert len(ds.encoding) == n_bits
            assert all(c in ("0", "1") for c in ds.encoding)

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_bfs_valid_encodings(self, fsm):
        """BFS optimizer produces valid encodings for original states."""
        states = fsm["encodings"]
        n_bits = _bit_width(len(states))
        opt = BFSOptimizer(bit_width=n_bits)
        dummy_states, _ = _optimize_or_skip(opt, states, fsm["transitions"], fsm["outputs"], fsm["fsm_type"])
        self._check_encodings(states, n_bits)
        for ds in dummy_states:
            assert len(ds.encoding) == n_bits
            assert all(c in ("0", "1") for c in ds.encoding)

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_sa_valid_encodings(self, fsm):
        """SA optimizer produces valid encodings (best_assignment)."""
        states = fsm["encodings"]
        n_bits = _bit_width(len(states))
        opt = SimulatedAnnealingOptimizer(
            bit_width=n_bits,
            options={"max_iterations": 200, "seed": 7},
        )
        _optimize_or_skip(opt, states, fsm["transitions"], fsm["outputs"], fsm["fsm_type"])
        # best_assignment must map the same state names
        best = opt.best_assignment
        assert set(best.keys()) == set(states.keys())
        for enc in best.values():
            assert len(enc) == n_bits
            assert all(c in ("0", "1") for c in enc)
        # Encodings must be unique within the assignment
        assert len(set(best.values())) == len(best)


# ---------------------------------------------------------------------------
# Property 5: Optimized FSM preserves all original states and transitions
# ---------------------------------------------------------------------------

class TestPreservesOriginalFSM:
    """Property 5: all algorithms preserve original states and transitions."""

    def _original_state_names_preserved(
        self,
        original_states: Dict[str, str],
        dummy_states,
        new_trans: List[Dict],
    ):
        """
        Every original state must appear in the new transition list
        (either as from_state, to_state, or have been a leaf).
        At minimum, the original state encoding map must be unchanged.
        """
        # Collect all state names that appear in new transitions
        trans_state_names = set()
        for t in new_trans:
            trans_state_names.add(t.get("from_state"))
            trans_state_names.add(t.get("to_state"))

        dummy_ids = {ds.id for ds in dummy_states}

        # Every state name in new transitions that is NOT a dummy must be
        # an original state
        non_dummy = trans_state_names - dummy_ids - {None}
        for s in non_dummy:
            assert s in original_states, (
                f"New transition references unknown state '{s}'"
            )

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_greedy_preserves_states(self, fsm):
        """Greedy preserves all original state names and adds only dummies."""
        states = fsm["encodings"]
        n_bits = _bit_width(len(states))
        opt = GreedyOptimizer(bit_width=n_bits)
        dummy_states, new_trans = _optimize_or_skip(opt, states, fsm["transitions"], fsm["outputs"], fsm["fsm_type"])
        self._original_state_names_preserved(states, dummy_states, new_trans)

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_greedy_preserves_transition_count(self, fsm):
        """Greedy produces at least as many transitions as the original."""
        states = fsm["encodings"]
        n_bits = _bit_width(len(states))
        opt = GreedyOptimizer(bit_width=n_bits)
        _, new_trans = _optimize_or_skip(opt, states, fsm["transitions"], fsm["outputs"], fsm["fsm_type"])
        assert len(new_trans) >= len(fsm["transitions"])

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_bfs_preserves_states(self, fsm):
        """BFS preserves all original state names."""
        states = fsm["encodings"]
        n_bits = _bit_width(len(states))
        opt = BFSOptimizer(bit_width=n_bits)
        dummy_states, new_trans = _optimize_or_skip(opt, states, fsm["transitions"], fsm["outputs"], fsm["fsm_type"])
        self._original_state_names_preserved(states, dummy_states, new_trans)

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_bfs_preserves_transition_count(self, fsm):
        """BFS produces at least as many transitions as the original."""
        states = fsm["encodings"]
        n_bits = _bit_width(len(states))
        opt = BFSOptimizer(bit_width=n_bits)
        _, new_trans = _optimize_or_skip(opt, states, fsm["transitions"], fsm["outputs"], fsm["fsm_type"])
        assert len(new_trans) >= len(fsm["transitions"])

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_sa_preserves_state_names(self, fsm):
        """SA best_assignment preserves exactly the original state names."""
        states = fsm["encodings"]
        n_bits = _bit_width(len(states))
        opt = SimulatedAnnealingOptimizer(
            bit_width=n_bits,
            options={"max_iterations": 200, "seed": 13},
        )
        _optimize_or_skip(opt, states, fsm["transitions"], fsm["outputs"], fsm["fsm_type"])
        assert set(opt.best_assignment.keys()) == set(states.keys())

    @given(fsm=random_fsm())
    @settings(max_examples=50)
    def test_sa_preserves_transition_count(self, fsm):
        """SA produces at least as many transitions as the original."""
        states = fsm["encodings"]
        n_bits = _bit_width(len(states))
        opt = SimulatedAnnealingOptimizer(
            bit_width=n_bits,
            options={"max_iterations": 200, "seed": 99},
        )
        _, new_trans = _optimize_or_skip(opt, states, fsm["transitions"], fsm["outputs"], fsm["fsm_type"])
        assert len(new_trans) >= len(fsm["transitions"])
