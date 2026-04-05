"""
Unit tests for CSV Exporter (app.core.exporters.csv_exporter).

Tests cover:
- CSVExporter.export: CSV generation for Moore and Mealy FSMs
- Custom separator support (tab, semicolon)
- Header and section label toggling
- Error handling for invalid FSMs
- CSV parsing and validation
"""

import csv
import io
import pytest
from app.core.exporters.csv_exporter import CSVExporter
from app.utils.exceptions import ExportException


class TestCSVExporterBasic:
    """Basic CSV generation tests."""

    def test_export_simple_2state_moore_fsm(self):
        """Generate CSV for a 2-state Moore FSM."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
                {"from_state": "S1", "to_state": "S0", "input": "back"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
            "encodings": {"S0": "000", "S1": "001"},
        }

        result = exporter.export(definition, "moore", "test_fsm")

        # Verify structure
        assert "# States" in result
        assert "# Transitions" in result
        assert "S0,0,000,true,false" in result
        assert "S1,1,001,false,false" in result
        assert "S0,S1,go," in result
        assert "S1,S0,back," in result

    def test_export_contains_blank_line_separator(self):
        """Sections are separated by blank line."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        # Count blank lines (two consecutive newlines)
        assert "\n\n" in result

    def test_export_includes_headers_by_default(self):
        """CSV headers are included by default."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        assert "name,output,encoding,is_initial,is_dummy" in result
        assert "from_state,to_state,input,output" in result

    def test_export_includes_section_labels_by_default(self):
        """Section labels (# States, # Transitions) are included by default."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        assert "# States" in result
        assert "# Transitions" in result


class TestCSVExporterMooreFSM:
    """Tests for Moore FSM CSV export."""

    def test_export_3state_moore_fsm(self):
        """Generate CSV for a 3-state Moore FSM."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0", "S1", "S2"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "a"},
                {"from_state": "S1", "to_state": "S2", "input": "b"},
                {"from_state": "S2", "to_state": "S0", "input": "c"},
            ],
            "outputs": {"S0": "00", "S1": "01", "S2": "10"},
            "initial_state": "S0",
            "encodings": {"S0": "00", "S1": "01", "S2": "10"},
        }

        result = exporter.export(definition, "moore", "counter")

        # Verify all states are present
        assert "S0,00,00,true,false" in result
        assert "S1,01,01,false,false" in result
        assert "S2,10,10,false,false" in result

        # Verify all transitions
        assert "S0,S1,a," in result
        assert "S1,S2,b," in result
        assert "S2,S0,c," in result

    def test_export_identifies_initial_state(self):
        """Initial state is marked with is_initial=true."""
        exporter = CSVExporter()
        definition = {
            "states": ["IDLE", "ACTIVE", "DONE"],
            "transitions": [],
            "outputs": {"IDLE": "0", "ACTIVE": "1", "DONE": "0"},
            "initial_state": "IDLE",
        }

        result = exporter.export(definition, "moore", "fsm")

        # Only IDLE should have is_initial=true
        lines = result.split("\n")
        idle_line = [l for l in lines if l.startswith("IDLE,")]
        assert len(idle_line) == 1
        assert "IDLE,0,,true,false" in result

        # Others should have is_initial=false
        assert "ACTIVE,1,,false,false" in result
        assert "DONE,0,,false,false" in result


class TestCSVExporterMealyFSM:
    """Tests for Mealy FSM CSV export."""

    def test_export_mealy_fsm_with_transition_outputs(self):
        """Generate CSV for Mealy FSM with outputs on transitions."""
        exporter = CSVExporter()
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

        # Verify states section (no state outputs for Mealy)
        assert "S0,,0,true,false" in result
        assert "S1,,1,false,false" in result

        # Verify transition outputs
        assert "S0,S1,a,1" in result
        assert "S1,S0,b,0" in result

    def test_export_mealy_fsm_mixed_outputs(self):
        """Mealy FSM with some transitions having outputs, some empty."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "a", "output": "1"},
                {"from_state": "S1", "to_state": "S0", "input": "b"},  # No output
            ],
            "initial_state": "S0",
        }

        result = exporter.export(definition, "mealy", "test")

        assert "S0,S1,a,1" in result
        assert "S1,S0,b," in result  # Empty output


class TestCSVExporterCustomSeparators:
    """Tests for custom separator support."""

    def test_export_with_tab_separator(self):
        """Use tab as separator."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test", options={"separator": "\t"})

        # Verify tab is used instead of comma
        assert "S0\t0\t\ttrue\tfalse" in result
        assert "S0\tS1\tgo\t" in result
        assert "," not in result.split("\n\n")[0]  # No commas in states section

    def test_export_with_semicolon_separator(self):
        """Use semicolon as separator."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test", options={"separator": ";"})

        assert "S0;0;;true;false" in result
        assert "S0;S1;go;" in result

    def test_export_with_custom_separator_in_headers(self):
        """Custom separator is also used in headers."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test", options={"separator": ";"})

        assert "name;output;encoding;is_initial;is_dummy" in result
        assert "from_state;to_state;input;output" in result


class TestCSVExporterOptions:
    """Tests for optional configuration."""

    def test_export_without_headers(self):
        """Disable headers with include_headers=false."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition, "moore", "test", options={"include_headers": False}
        )

        # Headers should not be present
        assert "name,output,encoding,is_initial,is_dummy" not in result
        assert "from_state,to_state,input,output" not in result

        # But data should still be present
        assert "S0,0,,true,false" in result
        assert "S0,S1,go," in result

    def test_export_without_section_labels(self):
        """Disable section labels with include_section_labels=false."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0"],
            "transitions": [],
            "outputs": {"S0": "0"},
            "initial_state": "S0",
        }

        result = exporter.export(
            definition, "moore", "test", options={"include_section_labels": False}
        )

        # Section labels should not be present
        assert "# States" not in result
        assert "# Transitions" not in result

        # But headers and data should still be present
        assert "name,output,encoding,is_initial,is_dummy" in result
        assert "from_state,to_state,input,output" in result

    def test_export_without_headers_or_labels(self):
        """Disable both headers and labels."""
        exporter = CSVExporter()
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
            "test",
            options={"include_headers": False, "include_section_labels": False},
        )

        # Only data lines should be present
        assert "S0,0,,true,false" in result
        assert "S1,1,,false,false" in result
        assert "S0,S1,go," in result
        assert "#" not in result
        assert "name," not in result


class TestCSVExporterDummyStates:
    """Tests for dummy state handling."""

    def test_export_identifies_dummy_states(self):
        """Dummy states (starting with DUMMY_) are marked correctly."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0", "DUMMY_1", "S1"],
            "transitions": [],
            "outputs": {"S0": "0", "DUMMY_1": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        assert "S0,0,,true,false" in result
        assert "DUMMY_1,0,,false,true" in result
        assert "S1,1,,false,false" in result


class TestCSVExporterCSVParsing:
    """Tests for CSV parseability and structure."""

    def test_export_result_is_valid_csv(self):
        """Exported CSV can be parsed by csv module."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "go"},
            ],
            "outputs": {"S0": "0", "S1": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        # Split into sections
        sections = result.split("\n\n")
        states_section = sections[0]
        transitions_section = sections[1]

        # Parse states section (skip comment line)
        states_lines = [l for l in states_section.split("\n") if l and not l.startswith("#")]
        reader = csv.reader(io.StringIO("\n".join(states_lines)))
        rows = list(reader)

        # Should have header + 2 states
        assert len(rows) >= 2
        assert rows[0] == ["name", "output", "encoding", "is_initial", "is_dummy"]

    def test_export_transitions_are_valid_csv(self):
        """Transition section is valid CSV."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0", "S1", "S2"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "a"},
                {"from_state": "S1", "to_state": "S2", "input": "b", "output": "1"},
            ],
            "outputs": {"S0": "0", "S1": "0", "S2": "1"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "test")

        # Split into sections
        sections = result.split("\n\n")
        transitions_section = sections[1]

        # Parse transitions section (skip comment line)
        trans_lines = [l for l in transitions_section.split("\n") if l and not l.startswith("#")]
        reader = csv.reader(io.StringIO("\n".join(trans_lines)))
        rows = list(reader)

        # Should have header + 2 transitions
        assert len(rows) >= 2
        assert rows[0] == ["from_state", "to_state", "input", "output"]


class TestCSVExporterEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_export_single_state_no_transitions(self):
        """Single-state FSM with no transitions."""
        exporter = CSVExporter()
        definition = {
            "states": ["idle"],
            "transitions": [],
            "outputs": {"idle": "0"},
            "initial_state": "idle",
        }

        result = exporter.export(definition, "moore", "simple")

        assert "# States" in result
        assert "# Transitions" in result
        assert "idle,0,,true,false" in result

    def test_export_single_state_with_self_loop(self):
        """Single-state FSM with self-loop transition."""
        exporter = CSVExporter()
        definition = {
            "states": ["wait"],
            "transitions": [
                {"from_state": "wait", "to_state": "wait", "input": "nop"},
            ],
            "outputs": {"wait": "1"},
            "initial_state": "wait",
        }

        result = exporter.export(definition, "moore", "waiting")

        assert "wait,1,,true,false" in result
        assert "wait,wait,nop," in result

    def test_export_many_transitions(self):
        """FSM with many transitions."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0", "S1", "S2"],
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "a"},
                {"from_state": "S0", "to_state": "S2", "input": "b"},
                {"from_state": "S1", "to_state": "S0", "input": "c"},
                {"from_state": "S1", "to_state": "S2", "input": "d"},
                {"from_state": "S2", "to_state": "S0", "input": "e"},
            ],
            "outputs": {"S0": "0", "S1": "1", "S2": "2"},
            "initial_state": "S0",
        }

        result = exporter.export(definition, "moore", "complex")

        # All transitions should be present
        assert "S0,S1,a," in result
        assert "S0,S2,b," in result
        assert "S1,S0,c," in result
        assert "S1,S2,d," in result
        assert "S2,S0,e," in result

    def test_export_with_empty_outputs_and_encodings(self):
        """States without outputs or encodings."""
        exporter = CSVExporter()
        definition = {
            "states": ["S0", "S1"],
            "transitions": [],
            "outputs": {},  # No outputs defined
            "initial_state": "S0",
            "encodings": {},  # No encodings defined
        }

        result = exporter.export(definition, "moore", "test")

        # Should have empty output and encoding columns
        assert "S0,,,,true,false" in result or "S0,,,true,false" in result
        assert "S1,,,,false,false" in result or "S1,,,false,false" in result

    def test_export_special_characters_in_state_names(self):
        """State names with underscores and numbers."""
        exporter = CSVExporter()
        definition = {
            "states": ["State_0", "State_1", "Final_State_2"],
            "transitions": [
                {"from_state": "State_0", "to_state": "State_1", "input": "go"},
            ],
            "outputs": {"State_0": "00", "State_1": "01", "Final_State_2": "10"},
            "initial_state": "State_0",
        }

        result = exporter.export(definition, "moore", "test")

        assert "State_0,00,,true,false" in result
        assert "State_1,01,,false,false" in result
        assert "Final_State_2,10,,false,false" in result


class TestCSVExporterErrorHandling:
    """Tests for error handling."""

    def test_export_empty_states_raises_exception(self):
        """Empty states list raises ExportException."""
        exporter = CSVExporter()
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
        exporter = CSVExporter()
        definition = {
            "transitions": [],
            "outputs": {},
            "initial_state": "",
        }

        with pytest.raises(ExportException, match="FSM has no states to export"):
            exporter.export(definition, "moore", "bad_fsm")

    def test_export_none_states_raises_exception(self):
        """None states raises ExportException."""
        exporter = CSVExporter()
        definition = {
            "states": None,
            "transitions": [],
            "outputs": {},
            "initial_state": "",
        }

        with pytest.raises(ExportException, match="FSM has no states to export"):
            exporter.export(definition, "moore", "bad_fsm")


class TestCSVExporterWithFixtures:
    """Tests using standard FSM fixtures."""

    def test_export_traffic_light_fsm(self, traffic_light_fsm_data):
        """Generate CSV for traffic light FSM fixture."""
        exporter = CSVExporter()
        data = traffic_light_fsm_data

        result = exporter.export(
            data,
            data.get("type", "moore"),
            "traffic_light",
        )

        # Verify core elements
        assert "# States" in result
        assert "# Transitions" in result
        assert "name,output,encoding,is_initial,is_dummy" in result
        assert "from_state,to_state,input,output" in result

    def test_export_elevator_fsm(self, elevator_fsm_data):
        """Generate CSV for elevator FSM fixture."""
        exporter = CSVExporter()
        data = elevator_fsm_data

        result = exporter.export(
            data,
            data.get("type", "moore"),
            "elevator_controller",
        )

        # Verify core elements
        assert "# States" in result
        assert "# Transitions" in result

    def test_export_sequence_detector_fsm(self, sequence_detector_fsm_data):
        """Generate CSV for sequence detector (Mealy) FSM fixture."""
        exporter = CSVExporter()
        data = sequence_detector_fsm_data

        result = exporter.export(
            data,
            data.get("type", "mealy"),
            "sequence_detector",
        )

        # Verify core elements
        assert "# States" in result
        assert "# Transitions" in result
