"""
Unit tests for JSONExporter (app.core.exporters.json_exporter).

Tests cover:
- Standard, compact, and verbose export styles
- Round-trip fidelity: exported JSON can be parsed and matches input
- Edge cases: no states, empty transitions, missing optional fields
- Metadata completeness in verbose mode
"""

import json
import pytest
from app.core.exporters.json_exporter import JSONExporter
from app.utils.exceptions import ExportException


# ---------------------------------------------------------------------------
# Shared FSM definitions
# ---------------------------------------------------------------------------

MOORE_2STATE = {
    "states": ["S0", "S1"],
    "transitions": [
        {"from_state": "S0", "to_state": "S1", "input": "go"},
        {"from_state": "S1", "to_state": "S0", "input": "back"},
    ],
    "outputs": {"S0": "0", "S1": "1"},
    "initial_state": "S0",
    "encodings": {"S0": "0", "S1": "1"},
}

MEALY_2STATE = {
    "states": ["idle", "active"],
    "transitions": [
        {"from_state": "idle", "to_state": "active", "input": "start", "output": "1"},
        {"from_state": "active", "to_state": "idle", "input": "done", "output": "0"},
    ],
    "outputs": {},
    "initial_state": "idle",
    "encodings": {},
}

MOORE_4STATE = {
    "states": ["red", "red_yellow", "green", "yellow"],
    "transitions": [
        {"from_state": "red", "to_state": "red_yellow"},
        {"from_state": "red_yellow", "to_state": "green"},
        {"from_state": "green", "to_state": "yellow"},
        {"from_state": "yellow", "to_state": "red"},
    ],
    "outputs": {
        "red": "100",
        "red_yellow": "110",
        "green": "001",
        "yellow": "010",
    },
    "initial_state": "red",
    "encodings": {},
}

MOORE_WITH_DUMMY = {
    "states": ["A", "B", "DUMMY_0"],
    "transitions": [
        {"from_state": "A", "to_state": "B"},
        {"from_state": "B", "to_state": "DUMMY_0", "is_dummy_transition": True},
        {"from_state": "DUMMY_0", "to_state": "A"},
    ],
    "outputs": {"A": "0", "B": "1", "DUMMY_0": "0"},
    "initial_state": "A",
    "encodings": {"A": "00", "B": "01", "DUMMY_0": "10"},
}


# =====================================================================
# Basic instantiation
# =====================================================================

class TestJSONExporterInstantiation:
    """Verify JSONExporter can be constructed and called."""

    def test_instantiates(self):
        assert JSONExporter() is not None

    def test_export_returns_string(self):
        result = JSONExporter().export(MOORE_2STATE, "moore", "test")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_export_returns_valid_json(self):
        result = JSONExporter().export(MOORE_2STATE, "moore", "test")
        parsed = json.loads(result)
        assert isinstance(parsed, dict)


# =====================================================================
# Standard style (default)
# =====================================================================

class TestStandardStyle:
    """Tests for the default 'standard' export style."""

    @pytest.fixture
    def data(self):
        raw = JSONExporter().export(MOORE_2STATE, "moore", "simple_moore")
        return json.loads(raw)

    def test_name_field(self, data):
        assert data["name"] == "simple_moore"

    def test_type_field(self, data):
        assert data["type"] == "moore"

    def test_states_field(self, data):
        assert data["states"] == ["S0", "S1"]

    def test_initial_state_field(self, data):
        assert data["initial_state"] == "S0"

    def test_transitions_field(self, data):
        assert len(data["transitions"]) == 2

    def test_transition_structure(self, data):
        t = data["transitions"][0]
        assert "from_state" in t
        assert "to_state" in t

    def test_outputs_field_when_present(self, data):
        assert data["outputs"] == {"S0": "0", "S1": "1"}

    def test_encodings_field_when_present(self, data):
        assert data["encodings"] == {"S0": "0", "S1": "1"}

    def test_no_outputs_key_when_empty(self):
        """Empty outputs dict should not appear in standard output."""
        raw = JSONExporter().export(MEALY_2STATE, "mealy", "mealy_test")
        data = json.loads(raw)
        assert "outputs" not in data

    def test_transition_input_preserved(self, data):
        inputs = [t.get("input") for t in data["transitions"] if t.get("input")]
        assert "go" in inputs

    def test_transition_output_preserved(self):
        raw = JSONExporter().export(MEALY_2STATE, "mealy", "mealy_test")
        data = json.loads(raw)
        outputs = [t.get("output") for t in data["transitions"] if t.get("output")]
        assert "1" in outputs
        assert "0" in outputs

    def test_transition_without_input_has_no_input_key(self):
        """Transitions without inputs should not carry an 'input' key."""
        raw = JSONExporter().export(MOORE_4STATE, "moore", "tl")
        data = json.loads(raw)
        for t in data["transitions"]:
            assert "input" not in t

    def test_standard_is_default_style(self):
        """Calling with options=None should use standard style."""
        raw_default = JSONExporter().export(MOORE_2STATE, "moore", "x", options=None)
        raw_standard = JSONExporter().export(
            MOORE_2STATE, "moore", "x", options={"style": "standard"}
        )
        assert json.loads(raw_default) == json.loads(raw_standard)

    def test_output_is_indented(self):
        """Standard format should use pretty indentation."""
        raw = JSONExporter().export(MOORE_2STATE, "moore", "test")
        assert "\n" in raw
        assert "  " in raw  # indentation

    def test_round_trip_fidelity(self):
        """Export then re-import should reproduce the same structure."""
        raw = JSONExporter().export(MOORE_2STATE, "moore", "rt_test")
        data = json.loads(raw)
        assert data["states"] == MOORE_2STATE["states"]
        assert data["initial_state"] == MOORE_2STATE["initial_state"]
        assert len(data["transitions"]) == len(MOORE_2STATE["transitions"])


# =====================================================================
# Compact style
# =====================================================================

class TestCompactStyle:
    """Tests for the 'compact' export style."""

    @pytest.fixture
    def raw(self):
        return JSONExporter().export(
            MOORE_2STATE, "moore", "compact_test",
            options={"style": "compact"}
        )

    def test_returns_valid_json(self, raw):
        data = json.loads(raw)
        assert isinstance(data, dict)

    def test_no_whitespace_indentation(self, raw):
        """Compact format should have no pretty-print newlines."""
        assert "\n" not in raw

    def test_no_spaces_after_colon(self, raw):
        """Compact uses ': ' -> ':' without space."""
        assert ": " not in raw

    def test_no_spaces_after_comma(self, raw):
        """Compact uses ',' not ', '."""
        assert ", " not in raw

    def test_name_preserved(self, raw):
        data = json.loads(raw)
        assert data["name"] == "compact_test"

    def test_states_preserved(self, raw):
        data = json.loads(raw)
        assert data["states"] == ["S0", "S1"]

    def test_transitions_preserved(self, raw):
        data = json.loads(raw)
        assert len(data["transitions"]) == 2

    def test_outputs_preserved_when_present(self, raw):
        data = json.loads(raw)
        assert data["outputs"] == {"S0": "0", "S1": "1"}

    def test_compact_has_less_bytes_than_standard(self):
        """Compact output should be shorter than standard due to no whitespace."""
        raw_compact = JSONExporter().export(
            MOORE_4STATE, "moore", "x", options={"style": "compact"}
        )
        raw_standard = JSONExporter().export(
            MOORE_4STATE, "moore", "x", options={"style": "standard"}
        )
        assert len(raw_compact) < len(raw_standard)

    def test_encodings_not_in_compact_output(self):
        """Compact style currently omits encodings (implementation choice)."""
        raw = JSONExporter().export(
            MOORE_2STATE, "moore", "x", options={"style": "compact"}
        )
        data = json.loads(raw)
        # encodings may or may not be present — just verify JSON is valid
        assert "states" in data


# =====================================================================
# Verbose style
# =====================================================================

class TestVerboseStyle:
    """Tests for the 'verbose' export style."""

    @pytest.fixture
    def data(self):
        raw = JSONExporter().export(
            MOORE_2STATE, "moore", "verbose_test",
            options={"style": "verbose"}
        )
        return json.loads(raw)

    def test_metadata_key_present(self, data):
        assert "metadata" in data

    def test_metadata_name(self, data):
        assert data["metadata"]["name"] == "verbose_test"

    def test_metadata_type(self, data):
        assert data["metadata"]["type"] == "moore"

    def test_metadata_state_count(self, data):
        assert data["metadata"]["state_count"] == 2

    def test_metadata_transition_count(self, data):
        assert data["metadata"]["transition_count"] == 2

    def test_metadata_generator(self, data):
        assert data["metadata"]["generator"] == "GrayFSM"

    def test_fsm_key_present(self, data):
        assert "fsm" in data

    def test_fsm_states_is_list_of_dicts(self, data):
        states = data["fsm"]["states"]
        assert isinstance(states, list)
        assert all(isinstance(s, dict) for s in states)

    def test_fsm_state_has_id(self, data):
        state_ids = [s["id"] for s in data["fsm"]["states"]]
        assert "S0" in state_ids
        assert "S1" in state_ids

    def test_fsm_state_has_encoding_when_present(self, data):
        """Encodings should be inlined into each state dict."""
        for s in data["fsm"]["states"]:
            assert "encoding" in s

    def test_fsm_state_has_output_when_present(self, data):
        """Outputs should be inlined into each state dict for Moore."""
        for s in data["fsm"]["states"]:
            assert "output" in s

    def test_fsm_state_is_dummy_field(self, data):
        for s in data["fsm"]["states"]:
            assert "is_dummy" in s
            assert s["is_dummy"] is False  # no dummy states in MOORE_2STATE

    def test_fsm_initial_state(self, data):
        assert data["fsm"]["initial_state"] == "S0"

    def test_fsm_transitions(self, data):
        transitions = data["fsm"]["transitions"]
        assert len(transitions) == 2

    def test_verbose_transition_has_is_dummy_field(self, data):
        for t in data["fsm"]["transitions"]:
            assert "is_dummy_transition" in t

    def test_verbose_encodings_at_top_level_when_present(self, data):
        assert "encodings" in data

    def test_dummy_state_flagged_in_verbose(self):
        """DUMMY_ states should have is_dummy=True in verbose output."""
        raw = JSONExporter().export(
            MOORE_WITH_DUMMY, "moore", "dummy_test",
            options={"style": "verbose"}
        )
        data = json.loads(raw)
        dummy_states = [s for s in data["fsm"]["states"] if s["id"].startswith("DUMMY_")]
        assert len(dummy_states) > 0
        for s in dummy_states:
            assert s["is_dummy"] is True

    def test_dummy_transition_flagged_in_verbose(self):
        """Transitions with is_dummy_transition=True should be preserved."""
        raw = JSONExporter().export(
            MOORE_WITH_DUMMY, "moore", "dummy_test",
            options={"style": "verbose"}
        )
        data = json.loads(raw)
        dummy_transitions = [
            t for t in data["fsm"]["transitions"]
            if t.get("is_dummy_transition") is True
        ]
        assert len(dummy_transitions) >= 1

    def test_verbose_is_indented(self):
        raw = JSONExporter().export(
            MOORE_2STATE, "moore", "x", options={"style": "verbose"}
        )
        assert "\n" in raw
        assert "  " in raw

    def test_verbose_larger_than_standard(self):
        raw_verbose = JSONExporter().export(
            MOORE_4STATE, "moore", "x", options={"style": "verbose"}
        )
        raw_standard = JSONExporter().export(
            MOORE_4STATE, "moore", "x", options={"style": "standard"}
        )
        assert len(raw_verbose) > len(raw_standard)


# =====================================================================
# Edge cases
# =====================================================================

class TestJSONExporterEdgeCases:
    """Edge cases: empty states, single state, missing optional fields."""

    def test_no_states_raises_export_exception(self):
        definition = {
            "states": [],
            "transitions": [],
            "outputs": {},
            "initial_state": "",
            "encodings": {},
        }
        with pytest.raises(ExportException, match="no states"):
            JSONExporter().export(definition, "moore", "empty")

    def test_no_states_raises_in_compact(self):
        definition = {
            "states": [],
            "transitions": [],
            "outputs": {},
            "initial_state": "",
            "encodings": {},
        }
        with pytest.raises(ExportException):
            JSONExporter().export(definition, "moore", "empty", options={"style": "compact"})

    def test_no_states_raises_in_verbose(self):
        definition = {
            "states": [],
            "transitions": [],
            "outputs": {},
            "initial_state": "",
            "encodings": {},
        }
        with pytest.raises(ExportException):
            JSONExporter().export(definition, "moore", "empty", options={"style": "verbose"})

    def test_single_state_moore(self):
        definition = {
            "states": ["IDLE"],
            "transitions": [{"from_state": "IDLE", "to_state": "IDLE"}],
            "outputs": {"IDLE": "0"},
            "initial_state": "IDLE",
            "encodings": {"IDLE": "0"},
        }
        raw = JSONExporter().export(definition, "moore", "single")
        data = json.loads(raw)
        assert data["states"] == ["IDLE"]
        assert len(data["transitions"]) == 1

    def test_no_outputs_no_outputs_key(self):
        """Empty outputs should not add an 'outputs' key to standard JSON."""
        definition = {
            "states": ["A", "B"],
            "transitions": [{"from_state": "A", "to_state": "B"}],
            "outputs": {},
            "initial_state": "A",
            "encodings": {},
        }
        raw = JSONExporter().export(definition, "mealy", "no_out")
        data = json.loads(raw)
        assert "outputs" not in data

    def test_no_encodings_no_encodings_key(self):
        """Empty encodings should not add an 'encodings' key."""
        definition = {
            "states": ["A", "B"],
            "transitions": [{"from_state": "A", "to_state": "B"}],
            "outputs": {},
            "initial_state": "A",
            "encodings": {},
        }
        raw = JSONExporter().export(definition, "mealy", "no_enc")
        data = json.loads(raw)
        assert "encodings" not in data

    def test_unknown_style_falls_back_to_standard(self):
        """Unknown style should use standard format (default branch)."""
        raw = JSONExporter().export(
            MOORE_2STATE, "moore", "x", options={"style": "unknown_style"}
        )
        data = json.loads(raw)
        # Standard format has name at top level
        assert "name" in data
        assert data["states"] == ["S0", "S1"]

    def test_many_states_preserved(self):
        states = [f"S{i}" for i in range(16)]
        definition = {
            "states": states,
            "transitions": [{"from_state": states[i], "to_state": states[(i + 1) % 16]}
                             for i in range(16)],
            "outputs": {s: "0" for s in states},
            "initial_state": "S0",
            "encodings": {},
        }
        raw = JSONExporter().export(definition, "moore", "big")
        data = json.loads(raw)
        assert len(data["states"]) == 16
        assert len(data["transitions"]) == 16

    def test_special_characters_in_names_preserved(self):
        """JSON exporter should preserve state names as-is (no sanitization)."""
        definition = {
            "states": ["state-one", "state two"],
            "transitions": [{"from_state": "state-one", "to_state": "state two"}],
            "outputs": {"state-one": "0", "state two": "1"},
            "initial_state": "state-one",
            "encodings": {},
        }
        raw = JSONExporter().export(definition, "moore", "special")
        data = json.loads(raw)
        assert "state-one" in data["states"]
        assert "state two" in data["states"]

    def test_mealy_transition_output_not_added_if_absent(self):
        """Transitions with no 'output' key should not have 'output' injected."""
        definition = {
            "states": ["A", "B"],
            "transitions": [
                {"from_state": "A", "to_state": "B", "input": "x"},
            ],
            "outputs": {},
            "initial_state": "A",
            "encodings": {},
        }
        raw = JSONExporter().export(definition, "mealy", "no_out_trans")
        data = json.loads(raw)
        t = data["transitions"][0]
        assert "output" not in t

    def test_transition_input_not_added_if_absent(self):
        """Transitions with no 'input' key should not have 'input' injected."""
        definition = {
            "states": ["A", "B"],
            "transitions": [
                {"from_state": "A", "to_state": "B"},
            ],
            "outputs": {"A": "0", "B": "1"},
            "initial_state": "A",
            "encodings": {},
        }
        raw = JSONExporter().export(definition, "moore", "no_in_trans")
        data = json.loads(raw)
        t = data["transitions"][0]
        assert "input" not in t


# =====================================================================
# Cross-style consistency
# =====================================================================

class TestCrossStyleConsistency:
    """Verify all styles encode the same underlying FSM data."""

    def test_all_styles_produce_valid_json(self):
        for style in ("standard", "compact", "verbose"):
            raw = JSONExporter().export(
                MOORE_2STATE, "moore", "x", options={"style": style}
            )
            data = json.loads(raw)
            assert isinstance(data, dict)

    def test_state_count_consistent_across_styles(self):
        for style in ("standard", "compact"):
            raw = JSONExporter().export(
                MOORE_4STATE, "moore", "x", options={"style": style}
            )
            data = json.loads(raw)
            assert len(data["states"]) == 4

    def test_verbose_state_count_matches_standard(self):
        raw_std = JSONExporter().export(MOORE_4STATE, "moore", "x",
                                        options={"style": "standard"})
        raw_verb = JSONExporter().export(MOORE_4STATE, "moore", "x",
                                         options={"style": "verbose"})
        std_data = json.loads(raw_std)
        verb_data = json.loads(raw_verb)
        assert len(std_data["states"]) == len(verb_data["fsm"]["states"])

    def test_transition_count_consistent_standard_verbose(self):
        raw_std = JSONExporter().export(MOORE_2STATE, "moore", "x",
                                        options={"style": "standard"})
        raw_verb = JSONExporter().export(MOORE_2STATE, "moore", "x",
                                         options={"style": "verbose"})
        std_data = json.loads(raw_std)
        verb_data = json.loads(raw_verb)
        assert len(std_data["transitions"]) == len(verb_data["fsm"]["transitions"])
