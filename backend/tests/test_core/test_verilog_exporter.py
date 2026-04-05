"""
Unit tests for Verilog Exporter (app.core.exporters.verilog).

Tests cover:
- VerilogExporter.export: Verilog generation for Moore and Mealy FSMs
- Synthesis pragmas and directives (fsm_encoding, full_case, parallel_case)
- Target tool-specific pragmas (Vivado, Quartus, generic)
- Error handling for invalid FSMs
"""

import pytest
from app.core.exporters.verilog import VerilogExporter
from app.utils.exceptions import ExportException


class TestVerilogExporterBasic:
    """Basic Verilog generation tests."""

    def test_export_simple_2state_moore_fsm(self):
        """Generate Verilog for a 2-state Moore FSM."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
                {"from_state": "S1", "to_state": "S0", "input": "back"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
            "encodings": {"S0": "0", "S1": "1"},
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # Check for required Verilog elements
        assert "module test_fsm" in result
        assert "endmodule" in result
        assert "input  wire clk" in result
        assert "input  wire rst_n" in result
        assert "output reg" in result
        assert "always @(posedge clk or negedge rst_n)" in result
        assert "always @(*)" in result

    def test_export_simple_mealy_fsm(self):
        """Generate Verilog for a 2-state Mealy FSM."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {
                    "from_state": "S0",
                    "to_state": "S1",
                    "input": "a",
                    "output": "1",
                },
                {
                    "from_state": "S1",
                    "to_state": "S0",
                    "input": "b",
                    "output": "0",
                },
            ],
            "initial_state": "S0",
            "encodings": {"S0": "0", "S1": "1"},
        }

        result = exporter.export(definition, "mealy", "mealy_fsm")

        assert "module mealy_fsm" in result
        assert "endmodule" in result
        # Mealy FSMs may have conditional outputs
        assert "always @(*)" in result

    def test_export_includes_state_encoding_comments(self):
        """Generated Verilog includes state encoding."""
        exporter = VerilogExporter()
        definition = {
            "states": ["IDLE", "ACTIVE"],
            "transitions": [
                {"from_state": "IDLE", "to_state": "ACTIVE", "input": "start"},
            ],
            "outputs": {"IDLE": "0", "ACTIVE": "1"},
            "initial_state": "IDLE",
            "encodings": {"IDLE": "0", "ACTIVE": "1"},
        }

        result = exporter.export(definition, "moore", "test", options={"include_comments": True})

        assert "// State encoding" in result

    def test_export_module_name_from_options(self):
        """Custom module name from options."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition, "moore", "test", options={"module_name": "my_custom_module"}
        )

        assert "module my_custom_module" in result
        assert "endmodule" in result


class TestVerilogExporterSynthesisPragmas:
    """Tests for synthesis pragma generation."""

    def test_pragmas_included_by_default(self):
        """Synthesis pragmas are included by default."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # FSM encoding pragma should be present
        assert '(* fsm_encoding = "gray" *)' in result
        # Default synopsys pragmas for case statements
        assert "// synopsys full_case parallel_case" in result

    def test_pragmas_disabled_with_option(self):
        """Pragmas can be disabled with include_synthesis_pragmas=False."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition,
            "moore",
            "test_fsm",
            options={"include_synthesis_pragmas": False},
        )

        # FSM encoding pragma should NOT be present
        assert '(* fsm_encoding = "gray" *)' not in result
        # Case pragmas should NOT be present
        assert "synopsys full_case parallel_case" not in result
        assert "synthesis full_case parallel_case" not in result

    def test_fsm_encoding_pragma_before_state_register(self):
        """FSM encoding pragma appears before state register declaration."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # Pragma should be present in the output
        assert '(* fsm_encoding = "gray" *)' in result
        assert "reg [" in result

    def test_case_pragmas_appear_before_case_statements(self):
        """Case pragmas appear before case keyword in both combinational blocks."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1", "S2"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "a"},
                {"from_state": "S1", "to_state": "S2", "input": "b"},
            ],
            "outputs": {"S0": "0", "S1": "1", "S2": "2"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        lines = result.split("\n")
        pragma_indices = [i for i, line in enumerate(lines) if "synopsys full_case parallel_case" in line]
        case_indices = [i for i, line in enumerate(lines) if "case (current_state)" in line]

        # Should have at least 2 pragma lines (one for next state, one for output)
        assert len(pragma_indices) >= 2
        # Should have at least 2 case statements
        assert len(case_indices) >= 2

        # First pragma should come before first case
        assert pragma_indices[0] < case_indices[0]


class TestVerilogExporterVivadoTarget:
    """Tests for Vivado-specific pragmas."""

    def test_vivado_target_includes_fsm_safe_state(self):
        """Vivado target adds fsm_safe_state pragma."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition,
            "moore",
            "test_fsm",
            options={"target_tool": "vivado"},
        )

        # Should have both fsm_encoding and fsm_safe_state
        assert '(* fsm_encoding = "gray" *)' in result
        assert '(* fsm_safe_state = "default_state" *)' in result
        # Should also have synopsys pragmas for case statements
        assert "// synopsys full_case parallel_case" in result

    def test_vivado_target_pragmas_before_register(self):
        """Both Vivado pragmas appear before state register."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition, "moore", "test_fsm", options={"target_tool": "vivado"}
        )

        lines = result.split("\n")
        encoding_line = None
        safe_state_line = None
        register_line = None

        for i, line in enumerate(lines):
            if '(* fsm_encoding = "gray" *)' in line:
                encoding_line = i
            elif '(* fsm_safe_state = "default_state" *)' in line:
                safe_state_line = i
            elif "reg [" in line and "current_state" in line:
                register_line = i

        # Both pragmas should come before register
        assert encoding_line is not None
        assert safe_state_line is not None
        assert register_line is not None
        assert encoding_line < register_line
        assert safe_state_line < register_line


class TestVerilogExporterQuartusTarget:
    """Tests for Quartus-specific pragmas."""

    def test_quartus_target_uses_synthesis_comment(self):
        """Quartus target uses /* synthesis */ comment style."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition,
            "moore",
            "test_fsm",
            options={"target_tool": "quartus"},
        )

        # Should NOT have synopsys pragmas
        assert "// synopsys full_case parallel_case" not in result
        # Should have Quartus-style pragmas
        assert "/* synthesis full_case parallel_case */" in result
        # Should still have fsm_encoding (generic pragma)
        assert '(* fsm_encoding = "gray" *)' in result

    def test_quartus_no_fsm_safe_state(self):
        """Quartus target does not include fsm_safe_state (Vivado-specific)."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition, "moore", "test_fsm", options={"target_tool": "quartus"}
        )

        # Should NOT have Vivado-specific pragma
        assert '(* fsm_safe_state = "default_state" *)' not in result


class TestVerilogExporterGenericTarget:
    """Tests for generic (neutral) target tool."""

    def test_generic_target_uses_synopsys_pragmas(self):
        """Generic target uses standard synopsys pragmas."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition,
            "moore",
            "test_fsm",
            options={"target_tool": "generic"},
        )

        # Should have standard pragmas
        assert '(* fsm_encoding = "gray" *)' in result
        assert "// synopsys full_case parallel_case" in result
        # Should NOT have tool-specific pragmas
        assert '(* fsm_safe_state = "default_state" *)' not in result
        assert "/* synthesis full_case parallel_case */" not in result

    def test_generic_default_when_tool_not_specified(self):
        """Generic pragmas are used when target_tool is not specified."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # Should default to generic pragmas
        assert '(* fsm_encoding = "gray" *)' in result
        assert "// synopsys full_case parallel_case" in result
        assert '(* fsm_safe_state = "default_state" *)' not in result


class TestVerilogExporterMooreVsMealy:
    """Tests for Moore vs Mealy FSM handling."""

    def test_moore_fsm_output_logic_pragmas(self):
        """Moore FSM includes pragmas in output logic."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # Count synopsys pragmas - should be 2 (one for next state, one for output)
        pragma_count = result.count("// synopsys full_case parallel_case")
        assert pragma_count >= 2

    def test_mealy_fsm_output_logic_pragmas(self):
        """Mealy FSM includes pragmas in output logic."""
        exporter = VerilogExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {
                    "from_state": "S0",
                    "to_state": "S1",
                    "input": "a",
                    "output": "1",
                },
                {
                    "from_state": "S1",
                    "to_state": "S0",
                    "input": "b",
                    "output": "0",
                },
            ],
            "initial_state": "S0",
        }

        result = exporter.export(definition, "mealy", "test_fsm")

        # Count synopsys pragmas - should be 2 (one for next state, one for output)
        pragma_count = result.count("// synopsys full_case parallel_case")
        assert pragma_count >= 2


class TestVerilogExporterErrorHandling:
    """Tests for error handling."""

    def test_export_empty_states_raises_exception(self):
        """Empty states list raises ExportException."""
        exporter = VerilogExporter()
        definition = {
            "states": [],
            "transitions": [],
            "outputs": {},
            "initial_state": "",
        }

        with pytest.raises(ExportException, match="FSM has no states to export"):
            exporter.export(definition, "moore", "bad_fsm")

    def test_export_missing_states_key_raises_exception(self):
        """Missing states key raises ExportException."""
        exporter = VerilogExporter()
        definition = {
            "transitions": [],
            "outputs": {},
            "initial_state": "",
        }

        with pytest.raises(ExportException, match="FSM has no states to export"):
            exporter.export(definition, "moore", "bad_fsm")


class TestVerilogExporterEdgeCases:
    """Tests for edge cases."""

    def test_export_single_state_fsm(self):
        """Single-state FSM export."""
        exporter = VerilogExporter()
        definition = {
            "states": ["IDLE"],
            "transitions": [],
            "outputs": {"IDLE": "0"},
            "initial_state": "IDLE",
        }

        result = exporter.export(definition, "moore", "simple")

        assert "module simple" in result
        assert "IDLE" in result
        assert '(* fsm_encoding = "gray" *)' in result

    def test_export_many_state_fsm(self):
        """FSM with many states."""
        exporter = VerilogExporter()
        states = [f"S{i}" for i in range(16)]
        definition = {
            "states": states,
            "transitions": [
                {"from_state": states[i], "to_state": states[(i + 1) % len(states)], "input": "go"}
                for i in range(len(states))
            ],
            "outputs": {s: str(i % 2) for i, s in enumerate(states)},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "big_fsm")

        assert "module big_fsm" in result
        assert all(s in result for s in states)

    def test_sanitize_names_with_special_characters(self):
        """State names with special characters are sanitized."""
        exporter = VerilogExporter()
        definition = {
            "states": ["State-0", "State@1", "State#2"],
            "transitions": [
                {"from_state": "State-0", "to_state": "State@1", "input": "go"},
            ],
            "outputs": {"State-0": "0", "State@1": "1", "State#2": "0"},
            "initial_state": "State-0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # Special characters should be replaced with underscores
        assert "State_0" in result
        assert "State_1" in result
        assert "State_2" in result
        # Original names should not appear
        assert "State-0" not in result
        assert "State@1" not in result
        assert "State#2" not in result


class TestVerilogExporterWithFixtures:
    """Tests using standard FSM fixtures."""

    def test_export_traffic_light_fsm(self, traffic_light_fsm_data):
        """Generate Verilog for traffic light FSM fixture."""
        exporter = VerilogExporter()
        data = traffic_light_fsm_data

        result = exporter.export(
            data,
            data.get("type", "moore"),
            "traffic_light",
        )

        # Verify core elements
        assert "module traffic_light" in result
        assert "endmodule" in result
        assert '(* fsm_encoding = "gray" *)' in result
        assert "// synopsys full_case parallel_case" in result

    def test_export_elevator_fsm(self, elevator_fsm_data):
        """Generate Verilog for elevator FSM fixture."""
        exporter = VerilogExporter()
        data = elevator_fsm_data

        result = exporter.export(
            data,
            data.get("type", "moore"),
            "elevator_controller",
        )

        # Verify core elements
        assert "module elevator_controller" in result
        assert "endmodule" in result

    def test_export_sequence_detector_fsm(self, sequence_detector_fsm_data):
        """Generate Verilog for sequence detector (Mealy) FSM fixture."""
        exporter = VerilogExporter()
        data = sequence_detector_fsm_data

        result = exporter.export(
            data,
            data.get("type", "mealy"),
            "sequence_detector",
        )

        # Verify core elements
        assert "module sequence_detector" in result
        assert "endmodule" in result
        # Mealy FSMs should also have pragmas
        assert '(* fsm_encoding = "gray" *)' in result
