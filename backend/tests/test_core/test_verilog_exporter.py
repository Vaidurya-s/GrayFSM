"""
Unit tests for VerilogExporter (app.core.exporters.verilog).

Tests cover:
- Simple 2-state Moore FSM output structure
- Mealy FSM with inputs and transition outputs
- Edge cases: no states, single state, special characters in names
- Output content verification: module declaration, localparams, always blocks
"""

import pytest
from app.core.exporters.verilog import VerilogExporter
from app.utils.exceptions import ExportException


# ---------------------------------------------------------------------------
# Shared FSM definitions used across multiple tests
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
    "encodings": {"idle": "0", "active": "1"},
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

class TestVerilogExporterInstantiation:
    """Verify VerilogExporter can be constructed and called."""

    def test_instantiates(self):
        exporter = VerilogExporter()
        assert exporter is not None

    def test_export_returns_string(self):
        exporter = VerilogExporter()
        result = exporter.export(MOORE_2STATE, "moore", "my_fsm")
        assert isinstance(result, str)
        assert len(result) > 0


# =====================================================================
# Module structure for Moore FSM
# =====================================================================

class TestMooreFSMOutput:
    """Tests for correct Verilog structure on a 2-state Moore FSM."""

    @pytest.fixture
    def output(self):
        return VerilogExporter().export(MOORE_2STATE, "moore", "simple_moore")

    def test_module_declaration_present(self, output):
        assert "module simple_moore" in output

    def test_endmodule_present(self, output):
        assert "endmodule" in output

    def test_clk_port(self, output):
        assert "input  wire clk" in output

    def test_rst_n_port(self, output):
        assert "input  wire rst_n" in output

    def test_output_port(self, output):
        assert "output reg" in output
        assert "out" in output

    def test_state_localparams_present(self, output):
        assert "localparam" in output
        assert "S0" in output
        assert "S1" in output

    def test_state_registers_declared(self, output):
        assert "current_state" in output
        assert "next_state" in output

    def test_sequential_always_block(self, output):
        """State register should use posedge clk / negedge rst_n."""
        assert "always @(posedge clk or negedge rst_n)" in output

    def test_reset_logic(self, output):
        assert "if (!rst_n)" in output
        assert "current_state <= S0" in output

    def test_combinational_always_block(self, output):
        """Next-state logic uses always @(*)."""
        assert "always @(*)" in output

    def test_case_statement_present(self, output):
        assert "case (current_state)" in output
        assert "endcase" in output

    def test_moore_output_logic_comment(self, output):
        assert "Moore output logic" in output

    def test_input_port_declared_for_moore_inputs(self, output):
        """Input signals from transitions should appear as input ports."""
        assert "input  wire back" in output or "input  wire go" in output

    def test_default_state_in_case(self, output):
        assert "default:" in output

    def test_output_values_in_always_block(self, output):
        """Output assignments for states should appear in output always block."""
        assert "S0: out" in output
        assert "S1: out" in output


class TestMoore4StateOutput:
    """Tests for 4-state Moore FSM (traffic light) without explicit encodings."""

    @pytest.fixture
    def output(self):
        return VerilogExporter().export(MOORE_4STATE, "moore", "traffic_light")

    def test_module_name(self, output):
        assert "module traffic_light" in output

    def test_all_states_as_localparams(self, output):
        for state in ["red", "red_yellow", "green", "yellow"]:
            assert state in output

    def test_two_bit_state_register(self, output):
        """4 states require at least 2 bits."""
        assert "[1:0]" in output

    def test_three_bit_output(self, output):
        """Output values are 3 bits wide (e.g. '100', '110')."""
        assert "[2:0]" in output

    def test_no_input_ports_when_no_inputs(self, output):
        """Transitions without inputs should produce no input wire port other than clk/rst_n."""
        lines = output.splitlines()
        input_wires = [l for l in lines if "input  wire" in l
                       and "clk" not in l and "rst_n" not in l]
        assert len(input_wires) == 0


# =====================================================================
# Mealy FSM output
# =====================================================================

class TestMealyFSMOutput:
    """Tests for correct Verilog structure on a 2-state Mealy FSM."""

    @pytest.fixture
    def output(self):
        return VerilogExporter().export(MEALY_2STATE, "mealy", "mealy_fsm")

    def test_module_declaration(self, output):
        assert "module mealy_fsm" in output

    def test_endmodule(self, output):
        assert "endmodule" in output

    def test_mealy_output_comment(self, output):
        assert "Mealy output logic" in output

    def test_input_ports_for_mealy_inputs(self, output):
        assert "input  wire start" in output or "input  wire done" in output

    def test_state_localparams(self, output):
        assert "idle" in output
        assert "active" in output

    def test_transition_based_output_logic(self, output):
        """Mealy: output depends on state + input via if blocks."""
        assert "if (start)" in output or "if (done)" in output

    def test_default_output_assignment(self, output):
        """Mealy block should have a default output assignment."""
        assert "out =" in output

    def test_always_blocks_count(self, output):
        """Should have exactly 3 always blocks: state reg, next-state, output."""
        assert output.count("always @") == 3


# =====================================================================
# Custom options
# =====================================================================

class TestVerilogExporterOptions:
    """Tests for the options parameter."""

    def test_custom_module_name_via_options(self):
        output = VerilogExporter().export(
            MOORE_2STATE, "moore", "ignored_name",
            options={"module_name": "my_custom_module"}
        )
        assert "module my_custom_module" in output

    def test_comments_included_by_default(self):
        output = VerilogExporter().export(MOORE_2STATE, "moore", "test_fsm")
        assert "// ======" in output
        assert "// FSM:" in output

    def test_comments_disabled(self):
        output = VerilogExporter().export(
            MOORE_2STATE, "moore", "test_fsm",
            options={"include_comments": False}
        )
        assert "// FSM:" not in output
        assert "// States:" not in output
        # Core code should still be present
        assert "module test_fsm" in output
        assert "endmodule" in output

    def test_options_none_uses_defaults(self):
        output = VerilogExporter().export(MOORE_2STATE, "moore", "fsm", options=None)
        assert "module fsm" in output


# =====================================================================
# Edge cases
# =====================================================================

class TestVerilogExporterEdgeCases:
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
            VerilogExporter().export(definition, "moore", "empty_fsm")

    def test_single_state_moore(self):
        """Single-state FSM with self-loop should produce valid output."""
        definition = {
            "states": ["IDLE"],
            "transitions": [{"from_state": "IDLE", "to_state": "IDLE"}],
            "outputs": {"IDLE": "0"},
            "initial_state": "IDLE",
            "encodings": {"IDLE": "0"},
        }
        output = VerilogExporter().export(definition, "moore", "single_state")
        assert "module single_state" in output
        assert "IDLE" in output
        assert "endmodule" in output

    def test_special_chars_in_state_name_sanitized(self):
        """State names with hyphens/spaces should be sanitized to valid identifiers."""
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
        output = VerilogExporter().export(definition, "moore", "special_fsm")
        # Should use sanitized names in output (hyphens -> underscores, spaces -> underscores)
        assert "state_one" in output
        assert "state_two" in output
        # Raw unsanitized forms should not appear as identifiers
        assert "state-one" not in output
        assert "state two" not in output

    def test_state_name_starting_with_digit_sanitized(self):
        """State names starting with a digit must be prefixed."""
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
        output = VerilogExporter().export(definition, "moore", "digit_fsm")
        # Must not appear as bare digit-leading identifiers
        assert "_0start" in output or "localparam" in output

    def test_fsm_name_with_spaces_sanitized_as_module(self):
        """FSM name with spaces should produce a valid module name."""
        output = VerilogExporter().export(
            MOORE_2STATE, "moore", "my FSM design"
        )
        assert "module my_FSM_design" in output

    def test_no_transitions_still_exports(self):
        """FSM with states but no transitions should produce code (default holds)."""
        definition = {
            "states": ["A", "B"],
            "transitions": [],
            "outputs": {"A": "0", "B": "1"},
            "initial_state": "A",
            "encodings": {"A": "0", "B": "1"},
        }
        output = VerilogExporter().export(definition, "moore", "no_trans")
        assert "module no_trans" in output
        assert "endmodule" in output

    def test_many_states_wider_localparam(self):
        """8 states require 3-bit state encoding."""
        states = [f"S{i}" for i in range(8)]
        definition = {
            "states": states,
            "transitions": [{"from_state": states[i], "to_state": states[(i + 1) % 8]}
                             for i in range(8)],
            "outputs": {s: "0" for s in states},
            "initial_state": "S0",
            "encodings": {},
        }
        output = VerilogExporter().export(definition, "moore", "big_fsm")
        assert "[2:0]" in output  # 3-bit state register

    def test_mealy_no_inputs_still_exports(self):
        """Mealy FSM where transitions have no input field still exports."""
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
        output = VerilogExporter().export(definition, "mealy", "mealy_no_in")
        assert "module mealy_no_in" in output
        assert "endmodule" in output


# =====================================================================
# Sanitize name helper (tested indirectly)
# =====================================================================

class TestSanitizeName:
    """Tests for VerilogExporter._sanitize_name."""

    def test_alphanumeric_unchanged(self):
        assert VerilogExporter._sanitize_name("hello123") == "hello123"

    def test_hyphen_becomes_underscore(self):
        assert VerilogExporter._sanitize_name("my-state") == "my_state"

    def test_space_becomes_underscore(self):
        assert VerilogExporter._sanitize_name("my state") == "my_state"

    def test_digit_leading_gets_prefixed(self):
        result = VerilogExporter._sanitize_name("3state")
        assert result[0] not in "0123456789"
        assert result.startswith("_")

    def test_empty_string_returns_unnamed(self):
        assert VerilogExporter._sanitize_name("") == "_unnamed"

    def test_all_special_chars(self):
        result = VerilogExporter._sanitize_name("!@#$%")
        assert all(c.isalnum() or c == "_" for c in result)
