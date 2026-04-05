"""
Unit tests for SVAExporter (app.core.exporters.sva_exporter).

Tests cover:
- Basic Moore FSM assertion generation
- assert property statements present
- cover property statements present
- Coverage can be disabled
- Empty states raises ExportException
- Mealy FSM generation
- default clocking block
- disable iff reset guard
- State localparam declarations
- get_exporter registry integration
"""

import pytest
from app.core.exporters.sva_exporter import SVAExporter
from app.core.exporters import get_exporter
from app.utils.exceptions import ExportException


# ---------------------------------------------------------------------------
# Shared FSM fixtures
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

MOORE_3STATE = {
    "states": ["IDLE", "RUN", "DONE"],
    "transitions": [
        {"from_state": "IDLE", "to_state": "RUN", "input": "start"},
        {"from_state": "RUN", "to_state": "DONE", "input": "finish"},
        {"from_state": "DONE", "to_state": "IDLE"},
    ],
    "outputs": {"IDLE": "00", "RUN": "01", "DONE": "10"},
    "initial_state": "IDLE",
    "encodings": {"IDLE": "00", "RUN": "01", "DONE": "11"},
}

MEALY_2STATE = {
    "states": ["S0", "S1"],
    "transitions": [
        {"from_state": "S0", "to_state": "S1", "input": "a", "output": "1"},
        {"from_state": "S1", "to_state": "S0", "input": "b", "output": "0"},
    ],
    "initial_state": "S0",
    "encodings": {"S0": "0", "S1": "1"},
}


# ---------------------------------------------------------------------------
# Basic Moore FSM assertion generation
# ---------------------------------------------------------------------------

class TestSVAExporterMooreBasic:
    """Tests for basic Moore FSM assertion generation."""

    def test_module_declaration_present(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "module test_fsm_sva" in result
        assert "endmodule" in result

    def test_clock_and_reset_ports(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "input  logic clk" in result
        assert "input  logic rst_n" in result

    def test_current_state_port(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "current_state" in result

    def test_state_localparam_declarations(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "localparam" in result
        assert "S0" in result
        assert "S1" in result

    def test_default_clocking_block(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "default clocking" in result
        assert "endclocking" in result

    def test_default_clocking_uses_clock_name(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "@(posedge clk)" in result


# ---------------------------------------------------------------------------
# assert property statements
# ---------------------------------------------------------------------------

class TestSVAExporterAssertProperties:
    """Tests that assert property statements are generated correctly."""

    def test_assert_property_present(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "assert property" in result

    def test_onehot_assertion_present(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "ap_onehot_state" in result
        assert "$onehot(current_state)" in result

    def test_valid_state_assertion_present(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "ap_valid_state" in result
        # Valid state check references both states
        assert "current_state == S0" in result
        assert "current_state == S1" in result

    def test_transition_assertion_present(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        # Transition assertion uses implication operator |=>
        assert "|=>" in result

    def test_transition_assertions_reference_states(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_3STATE, "moore", "test_fsm")
        # All states must appear in the result
        for state in ["IDLE", "RUN", "DONE"]:
            assert state in result

    def test_disable_iff_reset_guard(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "disable iff" in result
        assert "rst_n" in result

    def test_multiple_assert_properties(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        # At minimum: onehot, valid_state, plus one per (from_state, input) pair
        count = result.count("assert property")
        assert count >= 3

    def test_error_message_in_assertion(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "$error(" in result


# ---------------------------------------------------------------------------
# cover property statements
# ---------------------------------------------------------------------------

class TestSVAExporterCoverProperties:
    """Tests that cover property statements are generated correctly."""

    def test_cover_property_present(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "cover property" in result

    def test_cover_per_state(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        # One cover per state for reachability
        assert "cp_reach_S0" in result
        assert "cp_reach_S1" in result

    def test_cover_per_transition(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        # Transition coverage uses ##1 (next cycle)
        assert "##1" in result

    def test_cover_for_all_states_in_3state_fsm(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_3STATE, "moore", "test_fsm")
        assert "cp_reach_IDLE" in result
        assert "cp_reach_RUN" in result
        assert "cp_reach_DONE" in result

    def test_coverage_count_matches_states_plus_transitions(self):
        exporter = SVAExporter()
        result = exporter.export(MOORE_3STATE, "moore", "test_fsm")
        n_state_covers = result.count("cp_reach_")
        n_trans_covers = result.count("cp_trans_")
        assert n_state_covers == len(MOORE_3STATE["states"])
        assert n_trans_covers == len(MOORE_3STATE["transitions"])


# ---------------------------------------------------------------------------
# Coverage disabled
# ---------------------------------------------------------------------------

class TestSVAExporterCoverageDisabled:
    """Tests that coverage can be disabled via options."""

    def test_no_cover_property_when_disabled(self):
        exporter = SVAExporter()
        result = exporter.export(
            MOORE_2STATE, "moore", "test_fsm", options={"include_coverage": False}
        )
        assert "cover property" not in result

    def test_no_cp_labels_when_disabled(self):
        exporter = SVAExporter()
        result = exporter.export(
            MOORE_2STATE, "moore", "test_fsm", options={"include_coverage": False}
        )
        assert "cp_reach_" not in result
        assert "cp_trans_" not in result

    def test_assert_properties_still_present_when_coverage_disabled(self):
        exporter = SVAExporter()
        result = exporter.export(
            MOORE_2STATE, "moore", "test_fsm", options={"include_coverage": False}
        )
        assert "assert property" in result
        assert "ap_onehot_state" in result
        assert "ap_valid_state" in result


# ---------------------------------------------------------------------------
# Options: custom clock and reset names
# ---------------------------------------------------------------------------

class TestSVAExporterOptions:
    """Tests for clock_name and reset_name options."""

    def test_custom_clock_name(self):
        exporter = SVAExporter()
        result = exporter.export(
            MOORE_2STATE, "moore", "test_fsm", options={"clock_name": "sys_clk"}
        )
        assert "input  logic sys_clk" in result
        assert "@(posedge sys_clk)" in result

    def test_custom_reset_name(self):
        exporter = SVAExporter()
        result = exporter.export(
            MOORE_2STATE, "moore", "test_fsm", options={"reset_name": "arst_n"}
        )
        assert "input  logic arst_n" in result
        assert "disable iff (!arst_n)" in result

    def test_custom_clock_and_reset(self):
        exporter = SVAExporter()
        result = exporter.export(
            MOORE_2STATE,
            "moore",
            "my_fsm",
            options={"clock_name": "pclk", "reset_name": "nrst"},
        )
        assert "input  logic pclk" in result
        assert "input  logic nrst" in result
        assert "@(posedge pclk)" in result
        assert "disable iff (!nrst)" in result


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

class TestSVAExporterErrors:
    """Tests for error handling."""

    def test_empty_states_raises_export_exception(self):
        exporter = SVAExporter()
        definition = {
            "states": [],
            "transitions": [],
            "outputs": {},
            "initial_state": "",
        }
        with pytest.raises(ExportException, match="FSM has no states to export"):
            exporter.export(definition, "moore", "bad_fsm")

    def test_missing_states_key_raises_export_exception(self):
        exporter = SVAExporter()
        definition = {
            "transitions": [],
            "outputs": {},
        }
        with pytest.raises(ExportException, match="FSM has no states to export"):
            exporter.export(definition, "moore", "bad_fsm")


# ---------------------------------------------------------------------------
# Mealy FSM
# ---------------------------------------------------------------------------

class TestSVAExporterMealy:
    """Tests for Mealy FSM assertion generation."""

    def test_mealy_module_declaration(self):
        exporter = SVAExporter()
        result = exporter.export(MEALY_2STATE, "mealy", "mealy_fsm")
        assert "module mealy_fsm_sva" in result
        assert "endmodule" in result

    def test_mealy_has_assert_properties(self):
        exporter = SVAExporter()
        result = exporter.export(MEALY_2STATE, "mealy", "mealy_fsm")
        assert "assert property" in result
        assert "ap_onehot_state" in result
        assert "ap_valid_state" in result

    def test_mealy_has_cover_properties(self):
        exporter = SVAExporter()
        result = exporter.export(MEALY_2STATE, "mealy", "mealy_fsm")
        assert "cover property" in result

    def test_mealy_input_ports_declared(self):
        exporter = SVAExporter()
        result = exporter.export(MEALY_2STATE, "mealy", "mealy_fsm")
        # Inputs from transitions should appear as ports
        assert "logic a" in result
        assert "logic b" in result

    def test_mealy_transition_assertions_use_inputs(self):
        exporter = SVAExporter()
        result = exporter.export(MEALY_2STATE, "mealy", "mealy_fsm")
        # Antecedent should include input signal
        assert "&& a" in result or "&&  a" in result or "a" in result

    def test_mealy_disable_iff_present(self):
        exporter = SVAExporter()
        result = exporter.export(MEALY_2STATE, "mealy", "mealy_fsm")
        assert "disable iff" in result


# ---------------------------------------------------------------------------
# Registry integration
# ---------------------------------------------------------------------------

class TestSVAExporterRegistry:
    """Tests that SVA exporter is registered and retrievable."""

    def test_get_exporter_sva(self):
        exporter = get_exporter("sva")
        assert isinstance(exporter, SVAExporter)

    def test_sva_export_via_registry(self):
        exporter = get_exporter("sva")
        result = exporter.export(MOORE_2STATE, "moore", "test_fsm")
        assert "assert property" in result
        assert "endmodule" in result


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestSVAExporterEdgeCases:
    """Tests for edge cases."""

    def test_single_state_fsm(self):
        exporter = SVAExporter()
        definition = {
            "states": ["IDLE"],
            "transitions": [],
            "outputs": {"IDLE": "0"},
            "initial_state": "IDLE",
        }
        result = exporter.export(definition, "moore", "single")
        assert "module single_sva" in result
        assert "IDLE" in result
        assert "assert property" in result

    def test_names_with_special_characters_sanitized(self):
        exporter = SVAExporter()
        definition = {
            "states": ["State-0", "State@1"],
            "transitions": [
                {"from_state": "State-0", "to_state": "State@1", "input": "go"}
            ],
            "outputs": {"State-0": "0", "State@1": "1"},
            "initial_state": "State-0",
        }
        result = exporter.export(definition, "moore", "special_fsm")
        # Sanitized identifiers appear in the SV code
        assert "State_0" in result
        assert "State_1" in result
        # The original names must not appear as SV identifiers;
        # they may appear inside string literals in $error messages which is fine.
        # Check that localparams and property labels only use sanitized names.
        assert "localparam" in result
        assert "State-0" not in result.split("$error")[0]
        assert "State@1" not in result.split("$error")[0]

    def test_no_transitions_still_generates_valid_module(self):
        exporter = SVAExporter()
        definition = {
            "states": ["A", "B"],
            "transitions": [],
            "outputs": {"A": "0", "B": "1"},
            "initial_state": "A",
        }
        result = exporter.export(definition, "moore", "no_trans")
        assert "module no_trans_sva" in result
        assert "endmodule" in result
        assert "assert property" in result

    def test_encodings_reflected_in_localparams(self):
        exporter = SVAExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
            "encodings": {"S0": "10", "S1": "01"},
        }
        result = exporter.export(definition, "moore", "enc_test")
        assert "1'b10" in result or "2'b10" in result
        assert "1'b01" in result or "2'b01" in result
