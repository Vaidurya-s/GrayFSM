"""
Unit tests for Verilog Testbench Exporter (app.core.exporters.testbench).

Tests cover:
- TestbenchExporter.export: testbench generation for Moore and Mealy FSMs
- Stimulus generation for FSM transitions
- Clock and reset sequence generation
- Waveform dump configuration
- Error handling for invalid FSMs
"""

import pytest
from app.core.exporters.testbench import TestbenchExporter
from app.utils.exceptions import ExportException


class TestTestbenchExporterBasic:
    """Basic testbench generation tests."""

    def test_export_simple_2state_moore_fsm(self):
        """Generate testbench for a 2-state Moore FSM."""
        exporter = TestbenchExporter()
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
        assert "`timescale 1ns/1ps" in result
        assert "module test_fsm_tb" in result
        assert "endmodule" in result
        assert "test_fsm dut" in result
        assert "reg clk" in result
        assert "reg rst_n" in result
        assert "wire [0:0] out" in result

    def test_export_includes_clock_generation(self):
        """Verify clock generation logic is present."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "simple")

        assert "forever #HALF_PERIOD clk = ~clk;" in result
        assert "localparam CLOCK_PERIOD = 10;" in result
        assert "localparam HALF_PERIOD = 5;" in result

    def test_export_includes_reset_sequence(self):
        """Verify reset assertion and deassertion."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "simple")

        assert "rst_n = 1'b0;" in result
        assert "rst_n = 1'b1;" in result
        assert "#RESET_TIME;" in result
        assert "localparam RESET_TIME = 20;" in result

    def test_export_includes_finish_statement(self):
        """Verify $finish is called to end simulation."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "simple")

        assert "$finish;" in result

    def test_export_includes_dumpfile_by_default(self):
        """Verify VCD waveform dump is enabled by default."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "myfsm")

        assert "$dumpfile" in result
        assert "myfsm_tb.vcd" in result
        assert "$dumpvars" in result


class TestTestbenchExporterInputs:
    """Tests for input signal handling."""

    def test_export_with_single_input(self):
        """Testbench with single input signal."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "enable"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        assert "reg enable;" in result
        assert ".enable(enable)," in result

    def test_export_with_multiple_inputs(self):
        """Testbench with multiple input signals."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0", "S1", "S2"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "reset"},
                {"from_state": "S1", "to_state": "S2", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1", "S2": "2"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        assert "reg reset;" in result
        assert "reg go;" in result
        assert ".reset(reset)," in result
        assert ".go(go)," in result

    def test_export_with_special_char_input(self):
        """Input names with special characters are sanitized."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "data-valid"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        # Special char should be converted to underscore
        assert "reg data_valid;" in result
        assert ".data_valid(data_valid)," in result


class TestTestbenchExporterStimulus:
    """Tests for stimulus generation."""

    def test_export_generates_stimulus_for_transitions(self):
        """Stimulus is generated for each transition in FSM."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        assert "@(posedge clk) go = 1'b1;" in result
        assert "@(posedge clk) go = 1'b0;" in result

    def test_export_includes_display_statements(self):
        """$display statements for monitoring state and output."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        assert "$display" in result
        assert "current_state" in result
        assert "out" in result

    def test_export_multiple_transitions_from_same_state(self):
        """Multiple transitions from one state generate separate stimulus."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0", "S1", "S2"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "a"},
                {"from_state": "S0", "to_state": "S2", "input": "b"},
            ],
            "outputs": {"S0": "0", "S1": "1", "S2": "2"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        assert "a = 1'b1;" in result
        assert "b = 1'b1;" in result


class TestTestbenchExporterOutputWidth:
    """Tests for output signal width handling."""

    def test_export_single_bit_output(self):
        """Single-bit output width."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        assert "wire [0:0] out;" in result

    def test_export_multi_bit_output(self):
        """Multi-bit output width (e.g., 3-bit)."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [],
            "outputs": {"S0": "001", "S1": "110"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        assert "wire [2:0] out;" in result


class TestTestbenchExporterOptions:
    """Tests for optional configuration."""

    def test_export_with_custom_clock_period(self):
        """Custom clock period option."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition, "moore", "test", options={"clock_period": 20}
        )

        assert "localparam CLOCK_PERIOD = 20;" in result
        assert "localparam HALF_PERIOD = 10;" in result

    def test_export_with_waveform_disabled(self):
        """Disable waveform generation with option."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition, "moore", "test", options={"include_waveform": False}
        )

        assert "$dumpfile" not in result
        assert "$dumpvars" not in result

    def test_export_with_custom_module_name(self):
        """Custom DUT module name."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition, "moore", "my_fsm", options={"module_name": "custom_dut"}
        )

        assert "custom_dut dut" in result


class TestTestbenchExporterNameSanitization:
    """Tests for name sanitization."""

    def test_sanitize_special_chars_in_fsm_name(self):
        """FSM name with special characters is sanitized."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "My-FSM_01")

        assert "module My_FSM_01_tb" in result

    def test_sanitize_leading_digit(self):
        """Names starting with digits get underscore prefix."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "2state")

        assert "module _2state_tb" in result

    def test_sanitize_state_name_in_comments(self):
        """State names in comments are properly formatted."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["State-A", "State-B"],
            "transitions": [
                {"from_state": "State-A", "to_state": "State-B", "input": "go"},
            ],
            "outputs": {"State-A": "0", "State-B": "1"},
            "initial_state": "State-A",
        }

        result = exporter.export(definition, "moore", "test")

        # Should have both the transition stimulus and comments
        assert "go = 1'b1;" in result


class TestTestbenchExporterMealyFSM:
    """Tests for Mealy FSM testbench generation."""

    def test_export_mealy_fsm(self):
        """Testbench generation for Mealy FSM."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {
                    "from_state": "S0",
                    "to_state": "S1",
                    "input": "go",
                    "output": "1",
                },
                {
                    "from_state": "S1",
                    "to_state": "S0",
                    "input": "back",
                    "output": "0",
                },
            ],
            "initial_state": "S0",
        }

        result = exporter.export(definition, "mealy", "mealy_test")

        # Should still have clock, reset, stimulus
        assert "forever #HALF_PERIOD clk = ~clk;" in result
        assert "rst_n = 1'b1;" in result
        assert "go = 1'b1;" in result


class TestTestbenchExporterErrorHandling:
    """Tests for error handling."""

    def test_export_empty_states_raises_exception(self):
        """Empty states list raises ExportException."""
        exporter = TestbenchExporter()
        definition = {
            "states": [],
            "transitions": [],
            "outputs": {},
            "initial_state": "",
        }

        with pytest.raises(ExportException, match="FSM has no states to export"):
            exporter.export(definition, "moore", "bad_fsm")

    def test_export_none_states_raises_exception(self):
        """Missing states key raises ExportException."""
        exporter = TestbenchExporter()
        definition = {
            "transitions": [],
            "outputs": {},
            "initial_state": "",
        }

        with pytest.raises(ExportException, match="FSM has no states to export"):
            exporter.export(definition, "moore", "bad_fsm")


class TestTestbenchExporterWithFixtures:
    """Tests using standard FSM fixtures."""

    def test_export_traffic_light_fsm(self, traffic_light_fsm_data):
        """Generate testbench for traffic light FSM fixture."""
        exporter = TestbenchExporter()
        data = traffic_light_fsm_data

        result = exporter.export(
            data,
            data.get("type", "moore"),
            "traffic_light",
        )

        # Verify core elements
        assert "`timescale 1ns/1ps" in result
        assert "module traffic_light_tb" in result
        assert "endmodule" in result
        assert "forever #HALF_PERIOD clk = ~clk;" in result

    def test_export_elevator_fsm(self, elevator_fsm_data):
        """Generate testbench for elevator FSM fixture."""
        exporter = TestbenchExporter()
        data = elevator_fsm_data

        result = exporter.export(
            data,
            data.get("type", "moore"),
            "elevator_controller",
        )

        # Verify core elements
        assert "`timescale 1ns/1ps" in result
        assert "module elevator_controller_tb" in result
        assert "endmodule" in result

    def test_export_sequence_detector_fsm(self, sequence_detector_fsm_data):
        """Generate testbench for sequence detector (Mealy) FSM fixture."""
        exporter = TestbenchExporter()
        data = sequence_detector_fsm_data

        result = exporter.export(
            data,
            data.get("type", "mealy"),
            "sequence_detector",
        )

        # Verify core elements and Mealy-specific aspects
        assert "`timescale 1ns/1ps" in result
        assert "module sequence_detector_tb" in result
        assert "forever #HALF_PERIOD clk = ~clk;" in result


class TestTestbenchExporterDUTInstantiation:
    """Tests for DUT module instantiation."""

    def test_dut_port_mapping(self):
        """DUT instantiation has correct port mappings."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "sig"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        assert ".clk(clk)" in result
        assert ".rst_n(rst_n)" in result
        assert ".sig(sig)" in result
        assert ".out(out)" in result

    def test_dut_module_reference_matches_dut_name(self):
        """DUT instance name matches module name."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition, "moore", "my_design", options={"module_name": "my_design"}
        )

        assert "my_design dut" in result


class TestTestbenchExporterEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_export_single_state_no_transitions(self):
        """Single-state FSM with no transitions."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["idle"],
            "transitions": [],
            "outputs": {"idle": "0"},
            "initial_state": "idle",
        }

        result = exporter.export(definition, "moore", "simple")

        assert "module simple_tb" in result
        assert "localparam CLOCK_PERIOD = 10;" in result
        assert "$finish;" in result

    def test_export_single_state_self_loop(self):
        """Single-state FSM with self-loop transition."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["wait_state"],
            "transitions": [
                {"from_state": "wait_state", "to_state": "wait_state", "input": "nop"},
            ],
            "outputs": {"wait_state": "1"},
            "initial_state": "wait_state",
        }

        result = exporter.export(definition, "moore", "waiting")

        assert "nop = 1'b1;" in result

    def test_export_many_transitions(self):
        """FSM with many transitions from one state."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["S0", "S1", "S2", "S3"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "in_a"},
                {"from_state": "S0", "to_state": "S2", "input": "in_b"},
                {"from_state": "S0", "to_state": "S3", "input": "in_c"},
            ],
            "outputs": {"S0": "0", "S1": "1", "S2": "2", "S3": "3"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "mux_fsm")

        # All three stimulus blocks should be present
        assert "in_a = 1'b1;" in result
        assert "in_b = 1'b1;" in result
        assert "in_c = 1'b1;" in result

    def test_export_preserves_state_order(self):
        """Stimulus generation processes states in order."""
        exporter = TestbenchExporter()
        definition = {
            "states": ["A", "B", "C"],
            "transitions": [
                {"from_state": "A", "to_state": "B", "input": "a2b"},
                {"from_state": "B", "to_state": "C", "input": "b2c"},
            ],
            "outputs": {"A": "0", "B": "1", "C": "2"},
            "initial_state": "A",
        }

        result = exporter.export(definition, "moore", "ordered")

        # Both transitions should be in the output
        a2b_pos = result.find("a2b = 1'b1;")
        b2c_pos = result.find("b2c = 1'b1;")
        assert a2b_pos > 0
        assert b2c_pos > 0
