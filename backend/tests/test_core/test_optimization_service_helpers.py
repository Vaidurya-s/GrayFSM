"""Pure-function unit tests for OptimizationService helpers.

The helpers don't need a DB: `_assign_gray_encodings`,
`_calculate_avg_hamming`, `_calculate_max_hamming`, the `_MetricsBundle`
dataclass, and `_build_outcome` are all pure transforms over plain dicts
and lists. Test them directly so future refactors of the orchestrator
don't silently break the math.
"""

from __future__ import annotations

import pytest

from app.services.optimization_service import (
    OptimizationService,
    _MetricsBundle,
)


# ---------------------------------------------------------------------------
# _MetricsBundle.improvement_pct
# ---------------------------------------------------------------------------


class TestMetricsBundleImprovement:
    def test_50_percent_improvement(self):
        m = _MetricsBundle(avg_before=4.0, avg_after=2.0, max_before=4, max_after=2)
        assert m.improvement_pct == 50.0

    def test_no_improvement(self):
        m = _MetricsBundle(avg_before=2.0, avg_after=2.0, max_before=2, max_after=2)
        assert m.improvement_pct == 0.0

    def test_full_improvement(self):
        m = _MetricsBundle(avg_before=4.0, avg_after=0.0, max_before=4, max_after=0)
        assert m.improvement_pct == 100.0

    def test_zero_before_returns_zero_pct(self):
        # Don't divide by zero. Test confirms the guard works.
        m = _MetricsBundle(avg_before=0.0, avg_after=0.0, max_before=0, max_after=0)
        assert m.improvement_pct == 0.0

    def test_negative_after_means_overshoot_but_pct_still_computes(self):
        # Should not happen in practice, but the math should still produce
        # a sensible number rather than crash.
        m = _MetricsBundle(avg_before=2.0, avg_after=-1.0, max_before=2, max_after=0)
        assert m.improvement_pct == 150.0


# ---------------------------------------------------------------------------
# _assign_gray_encodings
# ---------------------------------------------------------------------------


class TestAssignGrayEncodings:
    def test_basic_assignment(self):
        encs = OptimizationService._assign_gray_encodings(["A", "B", "C", "D"], bit_width=2)
        assert set(encs.keys()) == {"A", "B", "C", "D"}
        # All encodings should be 2-bit binary strings
        assert all(len(v) == 2 for v in encs.values())

    def test_adjacent_encodings_differ_by_one_bit(self):
        # Gray code property: adjacent codes differ by exactly 1 bit.
        encs = OptimizationService._assign_gray_encodings(
            ["S0", "S1", "S2", "S3"], bit_width=2
        )
        codes = [encs["S0"], encs["S1"], encs["S2"], encs["S3"]]
        for a, b in zip(codes, codes[1:]):
            differing_bits = sum(1 for x, y in zip(a, b) if x != y)
            assert differing_bits == 1, f"{a} and {b} differ by {differing_bits} bits"

    def test_overflow_falls_back_to_binary(self):
        # Asking for 5 states with bit_width=2 (only 4 codes available) —
        # the helper should use binary encoding for the overflow.
        encs = OptimizationService._assign_gray_encodings(
            ["A", "B", "C", "D", "E"], bit_width=2
        )
        assert "E" in encs
        # The 5th state gets format(4, '02b') = "100" — wider than bit_width,
        # which is the documented fallback.
        assert encs["E"] == "100"


# ---------------------------------------------------------------------------
# _calculate_avg_hamming / _calculate_max_hamming
# ---------------------------------------------------------------------------


class TestHammingMetrics:
    @staticmethod
    def _t(from_state: str, to_state: str) -> dict:
        return {"from_state": from_state, "to_state": to_state}

    def test_empty_transitions_returns_zero(self):
        assert OptimizationService._calculate_avg_hamming([], {}) == 0.0
        assert OptimizationService._calculate_max_hamming([], {}) == 0

    def test_single_transition_distance_1(self):
        # 00 -> 01 = 1-bit difference
        encs = {"A": "00", "B": "01"}
        trans = [self._t("A", "B")]
        assert OptimizationService._calculate_avg_hamming(trans, encs) == 1.0
        assert OptimizationService._calculate_max_hamming(trans, encs) == 1

    def test_single_transition_distance_2(self):
        # 00 -> 11 = 2-bit difference
        encs = {"A": "00", "B": "11"}
        trans = [self._t("A", "B")]
        assert OptimizationService._calculate_avg_hamming(trans, encs) == 2.0
        assert OptimizationService._calculate_max_hamming(trans, encs) == 2

    def test_avg_across_multiple_transitions(self):
        # 1 + 2 + 3 = 6 / 3 = 2.0
        encs = {"A": "000", "B": "001", "C": "011", "D": "111"}
        trans = [
            self._t("A", "B"),  # 1 bit
            self._t("A", "C"),  # 2 bits
            self._t("A", "D"),  # 3 bits
        ]
        assert OptimizationService._calculate_avg_hamming(trans, encs) == 2.0
        assert OptimizationService._calculate_max_hamming(trans, encs) == 3

    def test_missing_state_skipped(self):
        # If a transition references an unknown state, it's silently skipped
        # rather than raising. Documents the helper's defensive behaviour.
        encs = {"A": "00"}
        trans = [self._t("A", "MISSING"), self._t("A", "ALSO_MISSING")]
        assert OptimizationService._calculate_avg_hamming(trans, encs) == 0.0
        assert OptimizationService._calculate_max_hamming(trans, encs) == 0

    def test_mismatched_widths_skipped(self):
        # Transitions whose endpoints have different-length codes are skipped.
        encs = {"A": "00", "B": "100"}
        trans = [{"from_state": "A", "to_state": "B"}]
        assert OptimizationService._calculate_avg_hamming(trans, encs) == 0.0


# ---------------------------------------------------------------------------
# _build_outcome
# ---------------------------------------------------------------------------


class FakeDummyState:
    """Stand-in for the algorithm's DummyState dataclass — only the fields
    `_build_outcome` reads."""

    def __init__(self, sid: str, output: str, encoding: str):
        self.id = sid
        self.output = output
        self.encoding = encoding


class TestBuildOutcome:
    def test_no_dummies_passes_through(self):
        definition = {
            "states": ["A", "B"],
            "transitions": [{"from_state": "A", "to_state": "B"}],
            "outputs": {"A": "0", "B": "1"},
        }
        pre = {"A": "0", "B": "1"}

        outcome = OptimizationService._build_outcome(
            definition=definition,
            pre_encodings=pre,
            dummy_states=[],
            new_transitions=definition["transitions"],
            execution_time_ms=42,
        )

        assert outcome.states_list == ["A", "B"]
        assert outcome.encodings == pre
        assert outcome.outputs == definition["outputs"]
        assert outcome.dummy_states == []
        assert outcome.execution_time_ms == 42

    def test_dummies_appended_to_states_outputs_encodings(self):
        definition = {
            "states": ["A", "B"],
            "transitions": [],
            "outputs": {"A": "0", "B": "1"},
        }
        pre = {"A": "00", "B": "11"}
        dummies = [FakeDummyState("D1", "0", "01"), FakeDummyState("D2", "0", "10")]

        outcome = OptimizationService._build_outcome(
            definition=definition,
            pre_encodings=pre,
            dummy_states=dummies,
            new_transitions=[],
            execution_time_ms=10,
        )

        assert outcome.states_list == ["A", "B", "D1", "D2"]
        assert outcome.outputs["D1"] == "0"
        assert outcome.encodings["D1"] == "01"
        assert outcome.encodings["D2"] == "10"
        # Original encodings unchanged.
        assert outcome.encodings["A"] == "00"
        assert outcome.encodings["B"] == "11"

    def test_inputs_are_not_mutated(self):
        # _build_outcome must not modify its inputs — callers reuse them.
        definition = {
            "states": ["A"],
            "transitions": [],
            "outputs": {"A": "0"},
        }
        pre = {"A": "0"}
        dummies = [FakeDummyState("D1", "1", "1")]

        OptimizationService._build_outcome(
            definition=definition,
            pre_encodings=pre,
            dummy_states=dummies,
            new_transitions=[],
            execution_time_ms=1,
        )

        assert definition["states"] == ["A"]
        assert definition["outputs"] == {"A": "0"}
        assert pre == {"A": "0"}
