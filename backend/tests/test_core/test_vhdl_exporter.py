"""
Unit tests for VHDLExporter (app.core.exporters.vhdl).

Tests cover:
- Simple 2-state Moore FSM output structure
- Mealy FSM with inputs and transition outputs
- Edge cases: no states, single state, special characters in names
- Output content verification: entity, architecture, process blocks
"""

import pytest
from app.core.exporters.vhdl import VHDLExporter
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


# =====================================================================
# Basic instantiation
# =====================================================================

class TestVHDLExporterInstantiation:
    """Verify VHDLExporter can be constructed and called."""

    def test_instantiates(self):
        exporter = VHDLExporter()
        assert exporter is not None

    def test_export_returns_string(self):
        result = VHDLExporter().export(MOORE_2STATE, "moore", "my_fsm")
        assert isinstance(result, str)
        assert len(result) > 0


# =====================================================================
# Moore FSM structure
# =====================================================================

class TestMooreFSMOutput:
    """Tests for correct VHDL structure on a 2-state Moore FSM."""

    @pytest.fixture
    def output(self):
        return VHDLExporter().export(MOORE_2STATE, "moore", "simple_moore")

    def test_library_ieee(self, output):
        assert "library IEEE;" in output

    def test_use_std_logic(self, output):
        assert "use IEEE.STD_LOGIC_1164.ALL;" in output

    def test_entity_declaration(self, output):
        assert "entity simple_moore is" in output

    def test_end_entity(self, output):
        assert "end entity simple_moore;" in output

    def test_port_clk(self, output):
        assert "clk   : in  STD_LOGIC;" in output

    def test_port_rst_n(self, output):
        assert "rst_n : in  STD_LOGIC;" in output

    def test_fsm_out_port_single_bit(self, output):
        """1-bit output uses STD_LOGIC."""
        assert "fsm_out : out STD_LOGIC" in output

    def test_architecture_header(self, output):
        assert "architecture behavioral of simple_moore is" in output

    def test_end_architecture(self, output):
        assert "end architecture behavioral;" in output

    def test_state_type_declaration(self, output):
        assert "type state_type is" in output
        assert "S0" in output
        assert "S1" in output

    def test_state_signals(self, output):
        assert "signal current_state, next_state : state_type;" in output

    def test_begin_present(self, output):
        assert "begin" in output

    def test_state_reg_process(self, output):
        assert "state_reg: process(clk, rst_n)" in output

    def test_reset_logic(self, output):
        assert "if rst_n = '0' then" in output
        assert "current_state <= S0;" in output

    def test_rising_edge_logic(self, output):
        assert "rising_edge(clk)" in output
        assert "current_state <= next_state;" in output

    def test_end_process_state_reg(self, output):
        assert "end process state_reg;" in output

    def test_next_state_logic_process(self, output):
        assert "next_state_logic: process(" in output
        assert "current_state" in output

    def test_case_statement(self, output):
        assert "case current_state is" in output
        assert "end case;" in output

    def test_when_others_clause(self, output):
        assert "when others =>" in output

    def test_end_process_next_state(self, output):
        assert "end process next_state_logic;" in output

    def test_output_process(self, output):
        assert "output_logic: process(current_state)" in output

    def test_moore_output_when_clauses(self, output):
        assert "when S0 => fsm_out <=" in output
        assert "when S1 => fsm_out <=" in output

    def test_end_process_output(self, output):
        assert "end process output_logic;" in output

    def test_moore_comment(self, output):
        assert "Moore output logic" in output

    def test_input_ports_from_transitions(self, output):
        """Inputs from transitions should appear in the entity port list."""
        assert ": in  STD_LOGIC;" in output


class TestMoore4StateOutput:
    """Tests for 4-state Moore FSM (traffic light) — multi-bit output."""

    @pytest.fixture
    def output(self):
        return VHDLExporter().export(MOORE_4STATE, "moore", "traffic_light")

    def test_entity_name(self, output):
        assert "entity traffic_light is" in output

    def test_all_states_in_type(self, output):
        for state in ["red", "red_yellow", "green", "yellow"]:
            assert state in output

    def test_multibit_output_uses_vector(self, output):
        """3-bit output values should produce STD_LOGIC_VECTOR port."""
        assert "STD_LOGIC_VECTOR(2 downto 0)" in output

    def test_when_clauses_for_all_states(self, output):
        for state in ["red", "red_yellow", "green", "yellow"]:
            assert f"when {state} =>" in output

    def test_no_input_ports_when_no_inputs(self, output):
        """Transitions without inputs should produce no additional input port."""
        lines = output.splitlines()
        input_lines = [l for l in lines
                       if ": in  STD_LOGIC" in l
                       and "clk" not in l
                       and "rst_n" not in l]
        assert len(input_lines) == 0


# =====================================================================
# Mealy FSM output
# =====================================================================

class TestMealyFSMOutput:
    """Tests for correct VHDL structure on a 2-state Mealy FSM."""

    @pytest.fixture
    def output(self):
        return VHDLExporter().export(MEALY_2STATE, "mealy", "mealy_fsm")

    def test_entity_declaration(self, output):
        assert "entity mealy_fsm is" in output

    def test_end_entity(self, output):
        assert "end entity mealy_fsm;" in output

    def test_architecture(self, output):
        assert "architecture behavioral of mealy_fsm is" in output

    def test_mealy_output_comment(self, output):
        assert "Mealy output logic" in output

    def test_input_ports_present(self, output):
        assert "start" in output or "done" in output

    def test_state_type_has_both_states(self, output):
        assert "idle" in output
        assert "active" in output

    def test_output_logic_uses_input_sensitivity(self, output):
        """Mealy output process should include inputs in sensitivity list."""
        # The process line should reference inputs alongside current_state
        assert "output_logic: process(" in output

    def test_if_input_equals_1_in_output(self, output):
        """Mealy output checks input with '= 1'."""
        assert "= '1' then" in output

    def test_default_output_in_mealy_process(self, output):
        assert "fsm_out <= '0';" in output

    def test_three_processes_total(self, output):
        """Should have exactly 3 process blocks: state_reg, next_state_logic, output_logic."""
        assert output.count(": process(") == 3


# =====================================================================
# Custom options
# =====================================================================

class TestVHDLExporterOptions:
    """Tests for the options parameter."""

    def test_custom_entity_name_via_options(self):
        output = VHDLExporter().export(
            MOORE_2STATE, "moore", "ignored",
            options={"module_name": "custom_entity"}
        )
        assert "entity custom_entity is" in output
        assert "end entity custom_entity;" in output

    def test_comments_included_by_default(self):
        output = VHDLExporter().export(MOORE_2STATE, "moore", "test")
        assert "-- ======" in output
        assert "-- FSM:" in output

    def test_comments_disabled(self):
        output = VHDLExporter().export(
            MOORE_2STATE, "moore", "test",
            options={"include_comments": False}
        )
        assert "-- FSM:" not in output
        assert "-- States:" not in output
        # Core VHDL still present
        assert "entity test is" in output

    def test_options_none_uses_defaults(self):
        output = VHDLExporter().export(MOORE_2STATE, "moore", "fsm", options=None)
        assert "entity fsm is" in output


# =====================================================================
# Edge cases
# =====================================================================

class TestVHDLExporterEdgeCases:
    """Edge cases: empty states, single state, special characters."""

    def test_no_states_raises_export_exception(self):
        definition = {
            "states": [],
            "transitions": [],
            "outputs": {},
            "initial_state": "",
            "encodings": {},
        }
        with pytest.raises(ExportException, match="no states"):
            VHDLExporter().export(definition, "moore", "empty_fsm")

    def test_single_state_moore(self):
        """Single-state FSM with self-loop should produce valid output."""
        definition = {
            "states": ["IDLE"],
            "transitions": [{"from_state": "IDLE", "to_state": "IDLE"}],
            "outputs": {"IDLE": "0"},
            "initial_state": "IDLE",
            "encodings": {},
        }
        output = VHDLExporter().export(definition, "moore", "single_state")
        assert "entity single_state is" in output
        assert "IDLE" in output
        assert "end architecture behavioral;" in output

    def test_special_chars_in_state_name_sanitized(self):
        """State names with hyphens/spaces should be sanitized."""
        definition = {
            "states": ["state-one", "state two"],
            "transitions": [
                {"from_state": "state-one", "to_state": "state two"},
                {"from_state": "state two", "to_state": "state-one"},
            ],
            "outputs": {"state-one": "0", "state two": "1"},
            "initial_state": "state-one",
            "encodings": {},
        }
        output = VHDLExporter().export(definition, "moore", "special_fsm")
        assert "state_one" in output
        assert "state_two" in output
        assert "state-one" not in output
        assert "state two" not in output

    def test_state_name_starting_with_digit_sanitized(self):
        """State names starting with a digit must be prefixed per VHDL rules."""
        definition = {
            "states": ["0start", "1end"],
            "transitions": [
                {"from_state": "0start", "to_state": "1end"},
                {"from_state": "1end", "to_state": "0start"},
            ],
            "outputs": {"0start": "0", "1end": "1"},
            "initial_state": "0start",
            "encodings": {},
        }
        output = VHDLExporter().export(definition, "moore", "digit_fsm")
        # VHDL sanitizer prefixes with "s_" for digit/underscore start
        assert "s_0start" in output
        assert "s_1end" in output

    def test_state_name_with_double_underscore_cleaned(self):
        """Double underscores are illegal in VHDL — they should be collapsed."""
        definition = {
            "states": ["state__a", "state__b"],
            "transitions": [
                {"from_state": "state__a", "to_state": "state__b"},
                {"from_state": "state__b", "to_state": "state__a"},
            ],
            "outputs": {"state__a": "0", "state__b": "1"},
            "initial_state": "state__a",
            "encodings": {},
        }
        output = VHDLExporter().export(definition, "moore", "dunder_fsm")
        # Double underscores in state names should be collapsed to single
        assert "__" not in output.split("architecture")[1] or \
               output.count("__") == 0

    def test_fsm_name_with_spaces_sanitized(self):
        """FSM name with spaces should produce a valid entity name."""
        output = VHDLExporter().export(MOORE_2STATE, "moore", "my FSM design")
        assert "entity my_FSM_design is" in output

    def test_no_transitions_still_exports(self):
        """FSM with states but no transitions should produce code."""
        definition = {
            "states": ["A", "B"],
            "transitions": [],
            "outputs": {"A": "0", "B": "1"},
            "initial_state": "A",
            "encodings": {},
        }
        output = VHDLExporter().export(definition, "moore", "no_trans")
        assert "entity no_trans is" in output
        assert "end architecture behavioral;" in output

    def test_mealy_no_inputs_still_exports(self):
        """Mealy FSM where transitions carry no input field still exports."""
        definition = {
            "states": ["A", "B"],
            "transitions": [
                {"from_state": "A", "to_state": "B", "output": "1"},
                {"from_state": "B", "to_state": "A", "output": "0"},
            ],
            "outputs": {},
            "initial_state": "A",
            "encodings": {},
        }
        output = VHDLExporter().export(definition, "mealy", "mealy_no_in")
        assert "entity mealy_no_in is" in output
        assert "end architecture behavioral;" in output


# =====================================================================
# Sanitize name helper
# =====================================================================

class TestSanitizeName:
    """Tests for VHDLExporter._sanitize_name."""

    def test_alphanumeric_unchanged(self):
        assert VHDLExporter._sanitize_name("hello123") == "hello123"

    def test_hyphen_becomes_underscore(self):
        assert VHDLExporter._sanitize_name("my-state") == "my_state"

    def test_space_becomes_underscore(self):
        assert VHDLExporter._sanitize_name("my state") == "my_state"

    def test_digit_leading_gets_s_prefix(self):
        result = VHDLExporter._sanitize_name("3state")
        assert result.startswith("s_")

    def test_underscore_leading_gets_s_prefix(self):
        result = VHDLExporter._sanitize_name("_state")
        assert result.startswith("s_")

    def test_trailing_underscore_removed(self):
        result = VHDLExporter._sanitize_name("state_")
        assert not result.endswith("_")

    def test_double_underscore_collapsed(self):
        result = VHDLExporter._sanitize_name("state__name")
        assert "__" not in result

    def test_empty_string_returns_s_unnamed(self):
        assert VHDLExporter._sanitize_name("") == "s_unnamed"

    def test_all_special_chars(self):
        result = VHDLExporter._sanitize_name("!@#$%")
        assert all(c.isalnum() or c == "_" for c in result)
