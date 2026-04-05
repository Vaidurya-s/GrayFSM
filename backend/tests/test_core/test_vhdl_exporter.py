"""
Unit tests for VHDL Exporter (app.core.exporters.vhdl).

Tests cover:
- VHDLExporter.export: VHDL generation for Moore and Mealy FSMs
- Synthesis pragmas and attributes (fsm_encoding, fsm_safe_state)
- Target tool-specific pragmas (Vivado, Quartus, generic)
- Error handling for invalid FSMs
"""

import pytest
from app.core.exporters.vhdl import VHDLExporter
from app.utils.exceptions import ExportException


class TestVHDLExporterBasic:
    """Basic VHDL generation tests."""

    def test_export_simple_2state_moore_fsm(self):
        """Generate VHDL for a 2-state Moore FSM."""
        exporter = VHDLExporter()
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

        # Check for required VHDL elements
        assert "library IEEE" in result
        assert "use IEEE.STD_LOGIC_1164.ALL" in result
        assert "entity test_fsm is" in result
        assert "architecture behavioral of test_fsm is" in result
        assert "end architecture behavioral" in result
        assert "process" in result

    def test_export_simple_mealy_fsm(self):
        """Generate VHDL for a 2-state Mealy FSM."""
        exporter = VHDLExporter()
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

        assert "entity mealy_fsm is" in result
        assert "architecture behavioral of mealy_fsm is" in result
        assert "process" in result

    def test_export_includes_port_declarations(self):
        """Generated VHDL includes port declarations."""
        exporter = VHDLExporter()
        definition = {
            "states": ["IDLE", "ACTIVE"],
            "transitions": [
                {"from_state": "IDLE", "to_state": "ACTIVE", "input": "start"},
            ],
            "outputs": {"IDLE": "0", "ACTIVE": "1"},
            "initial_state": "IDLE",
        }

        result = exporter.export(definition, "moore", "test", options={"include_comments": True})

        assert "clk" in result
        assert "rst_n" in result
        assert "fsm_out" in result
        assert "port (" in result

    def test_export_entity_name_from_options(self):
        """Custom entity name from options."""
        exporter = VHDLExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition, "moore", "test", options={"module_name": "my_custom_entity"}
        )

        assert "entity my_custom_entity is" in result
        assert "architecture behavioral of my_custom_entity is" in result


class TestVHDLExporterSynthesisPragmas:
    """Tests for synthesis pragma/attribute generation."""

    def test_pragmas_included_by_default(self):
        """Synthesis pragmas are included by default."""
        exporter = VHDLExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # FSM encoding attribute should be present
        assert "attribute fsm_encoding : string;" in result
        assert 'attribute fsm_encoding of current_state : signal is "gray";' in result

    def test_pragmas_disabled_with_option(self):
        """Pragmas can be disabled with include_synthesis_pragmas=False."""
        exporter = VHDLExporter()
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

        # Attribute declarations should NOT be present
        assert "attribute fsm_encoding : string;" not in result
        assert 'attribute fsm_encoding of current_state : signal is "gray";' not in result

    def test_fsm_encoding_attribute_syntax(self):
        """FSM encoding attribute has correct VHDL syntax."""
        exporter = VHDLExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # Both attribute declaration and usage should be present
        assert "attribute fsm_encoding : string;" in result
        assert 'attribute fsm_encoding of current_state : signal is "gray";' in result

    def test_attributes_in_declaration_region(self):
        """Attributes appear in the architecture declaration region."""
        exporter = VHDLExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # Find positions
        architecture_pos = result.find("architecture behavioral")
        begin_pos = result.find("begin", architecture_pos)
        attr_decl_pos = result.find("attribute fsm_encoding : string;")

        # Attribute should come after architecture and before begin
        assert architecture_pos > 0
        assert attr_decl_pos > architecture_pos
        assert attr_decl_pos < begin_pos


class TestVHDLExporterVivadoTarget:
    """Tests for Vivado-specific pragmas."""

    def test_vivado_target_includes_fsm_safe_state(self):
        """Vivado target adds fsm_safe_state attribute."""
        exporter = VHDLExporter()
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
        assert "attribute fsm_encoding : string;" in result
        assert 'attribute fsm_encoding of current_state : signal is "gray";' in result
        assert "attribute fsm_safe_state : string;" in result
        assert 'attribute fsm_safe_state of current_state : signal is "default_state";' in result

    def test_vivado_target_attributes_in_architecture(self):
        """Vivado attributes appear in architecture declaration."""
        exporter = VHDLExporter()
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
        arch_line = None
        begin_line = None
        encoding_decl_line = None
        safe_state_decl_line = None

        for i, line in enumerate(lines):
            if "architecture behavioral" in line:
                arch_line = i
            elif line.strip() == "begin":
                begin_line = i
            elif "attribute fsm_encoding : string;" in line:
                encoding_decl_line = i
            elif "attribute fsm_safe_state : string;" in line:
                safe_state_decl_line = i

        # Both attributes should come after architecture and before begin
        assert arch_line is not None
        assert begin_line is not None
        assert encoding_decl_line is not None
        assert safe_state_decl_line is not None
        assert arch_line < encoding_decl_line < begin_line
        assert arch_line < safe_state_decl_line < begin_line


class TestVHDLExporterQuartusTarget:
    """Tests for Quartus-specific behavior."""

    def test_quartus_target_includes_fsm_encoding(self):
        """Quartus target includes fsm_encoding attribute."""
        exporter = VHDLExporter()
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

        # Should have fsm_encoding (generic attribute)
        assert "attribute fsm_encoding : string;" in result
        assert 'attribute fsm_encoding of current_state : signal is "gray";' in result

    def test_quartus_no_fsm_safe_state(self):
        """Quartus target does not include fsm_safe_state (Vivado-specific)."""
        exporter = VHDLExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition, "moore", "test_fsm", options={"target_tool": "quartus"}
        )

        # Should NOT have Vivado-specific attribute
        assert "attribute fsm_safe_state : string;" not in result
        assert 'attribute fsm_safe_state of current_state : signal is "default_state";' not in result


class TestVHDLExporterGenericTarget:
    """Tests for generic (neutral) target tool."""

    def test_generic_target_includes_fsm_encoding(self):
        """Generic target includes fsm_encoding attribute."""
        exporter = VHDLExporter()
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

        # Should have generic attributes
        assert "attribute fsm_encoding : string;" in result
        assert 'attribute fsm_encoding of current_state : signal is "gray";' in result
        # Should NOT have tool-specific attributes
        assert "attribute fsm_safe_state : string;" not in result

    def test_generic_default_when_tool_not_specified(self):
        """Generic pragmas are used when target_tool is not specified."""
        exporter = VHDLExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # Should default to generic attributes
        assert "attribute fsm_encoding : string;" in result
        assert 'attribute fsm_encoding of current_state : signal is "gray";' in result
        assert "attribute fsm_safe_state : string;" not in result


class TestVHDLExporterMooreVsMealy:
    """Tests for Moore vs Mealy FSM handling."""

    def test_moore_fsm_state_output(self):
        """Moore FSM has output logic based on state only."""
        exporter = VHDLExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # Moore output should depend only on current_state
        assert "output_logic: process(current_state)" in result

    def test_mealy_fsm_state_and_input_output(self):
        """Mealy FSM has output logic based on state and input."""
        exporter = VHDLExporter()
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

        # Mealy output should depend on current_state and input
        assert "output_logic: process(current_state, a, b)" in result


class TestVHDLExporterErrorHandling:
    """Tests for error handling."""

    def test_export_empty_states_raises_exception(self):
        """Empty states list raises ExportException."""
        exporter = VHDLExporter()
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
        exporter = VHDLExporter()
        definition = {
            "transitions": [],
            "outputs": {},
            "initial_state": "",
        }

        with pytest.raises(ExportException, match="FSM has no states to export"):
            exporter.export(definition, "moore", "bad_fsm")


class TestVHDLExporterEdgeCases:
    """Tests for edge cases."""

    def test_export_single_state_fsm(self):
        """Single-state FSM export."""
        exporter = VHDLExporter()
        definition = {
            "states": ["IDLE"],
            "transitions": [],
            "outputs": {"IDLE": "0"},
            "initial_state": "IDLE",
        }

        result = exporter.export(definition, "moore", "simple")

        assert "entity simple is" in result
        assert "IDLE" in result
        assert "attribute fsm_encoding : string;" in result

    def test_export_many_state_fsm(self):
        """FSM with many states."""
        exporter = VHDLExporter()
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

        assert "entity big_fsm is" in result
        assert "type state_type is" in result

    def test_sanitize_names_with_special_characters(self):
        """State names with special characters are sanitized."""
        exporter = VHDLExporter()
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

    def test_output_as_std_logic_vector(self):
        """Multi-bit outputs are declared as STD_LOGIC_VECTOR."""
        exporter = VHDLExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [],
            "outputs": {"S0": "00", "S1": "11"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # Multi-bit output should be STD_LOGIC_VECTOR
        assert "fsm_out : out STD_LOGIC_VECTOR(1 downto 0)" in result

    def test_output_as_std_logic_single_bit(self):
        """Single-bit outputs are declared as STD_LOGIC."""
        exporter = VHDLExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # Single-bit output should be STD_LOGIC
        assert "fsm_out : out STD_LOGIC" in result


class TestVHDLExporterWithFixtures:
    """Tests using standard FSM fixtures."""

    def test_export_traffic_light_fsm(self, traffic_light_fsm_data):
        """Generate VHDL for traffic light FSM fixture."""
        exporter = VHDLExporter()
        data = traffic_light_fsm_data

        result = exporter.export(
            data,
            data.get("type", "moore"),
            "traffic_light",
        )

        # Verify core elements
        assert "entity traffic_light is" in result
        assert "architecture behavioral of traffic_light is" in result
        assert "attribute fsm_encoding : string;" in result

    def test_export_elevator_fsm(self, elevator_fsm_data):
        """Generate VHDL for elevator FSM fixture."""
        exporter = VHDLExporter()
        data = elevator_fsm_data

        result = exporter.export(
            data,
            data.get("type", "moore"),
            "elevator_controller",
        )

        # Verify core elements
        assert "entity elevator_controller is" in result
        assert "architecture behavioral of elevator_controller is" in result

    def test_export_sequence_detector_fsm(self, sequence_detector_fsm_data):
        """Generate VHDL for sequence detector (Mealy) FSM fixture."""
        exporter = VHDLExporter()
        data = sequence_detector_fsm_data

        result = exporter.export(
            data,
            data.get("type", "mealy"),
            "sequence_detector",
        )

        # Verify core elements
        assert "entity sequence_detector is" in result
        assert "architecture behavioral of sequence_detector is" in result
        # Mealy FSMs should also have attributes
        assert "attribute fsm_encoding : string;" in result
