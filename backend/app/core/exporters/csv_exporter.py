"""
CSV Exporter

Generates CSV export of FSM states and transitions.
Output format: Two CSV sections separated by a blank line.

Section 1: States
- name, output, encoding, is_initial, is_dummy

Section 2: Transitions
- from_state, to_state, input, output
"""
from typing import Dict, Optional

from app.utils.exceptions import ExportException


class CSVExporter:
    """Generates clean CSV export from FSM definition"""

    def export(
        self,
        definition: dict,
        fsm_type: str,
        name: str,
        options: Optional[Dict] = None,
    ) -> str:
        """
        Generate a CSV representation of the FSM.

        Args:
            definition: FSM definition dict
            fsm_type: 'moore' or 'mealy'
            name: FSM name (not used in CSV output)
            options: Optional settings
                - separator: CSV separator character (default ',')
                - include_headers: Include section headers (default True)
                - include_section_labels: Include section labels like '# States' (default True)

        Returns:
            CSV string with two sections separated by blank line

        Raises:
            ExportException: If the definition is invalid
        """
        options = options or {}
        separator = options.get("separator", ",")
        include_headers = options.get("include_headers", True)
        include_section_labels = options.get("include_section_labels", True)

        states = definition.get("states", [])
        transitions = definition.get("transitions", [])
        outputs = definition.get("outputs", {})
        initial_state = definition.get("initial_state", "")
        encodings = definition.get("encodings", {})

        if not states:
            raise ExportException("FSM has no states to export")

        # Build states section
        states_csv = self._export_states(
            states, outputs, encodings, initial_state, separator, include_headers, include_section_labels
        )

        # Build transitions section
        transitions_csv = self._export_transitions(
            transitions, separator, include_headers, include_section_labels
        )

        # Combine with blank line separator
        return states_csv + "\n\n" + transitions_csv

    def _export_states(
        self,
        states: list,
        outputs: dict,
        encodings: dict,
        initial_state: str,
        separator: str,
        include_headers: bool,
        include_section_labels: bool,
    ) -> str:
        """Export states section."""
        lines = []

        if include_section_labels:
            lines.append("# States")

        if include_headers:
            lines.append(separator.join(["name", "output", "encoding", "is_initial", "is_dummy"]))

        for state in states:
            is_initial = "true" if state == initial_state else "false"
            is_dummy = "true" if state.startswith("DUMMY_") else "false"
            output = outputs.get(state, "")
            encoding = encodings.get(state, "")

            line = separator.join([
                state,
                output,
                encoding,
                is_initial,
                is_dummy,
            ])
            lines.append(line)

        return "\n".join(lines)

    def _export_transitions(
        self,
        transitions: list,
        separator: str,
        include_headers: bool,
        include_section_labels: bool,
    ) -> str:
        """Export transitions section."""
        lines = []

        if include_section_labels:
            lines.append("# Transitions")

        if include_headers:
            lines.append(separator.join(["from_state", "to_state", "input", "output"]))

        for trans in transitions:
            from_state = trans.get("from_state", "")
            to_state = trans.get("to_state", "")
            input_signal = trans.get("input", "")
            output_signal = trans.get("output", "")

            line = separator.join([
                from_state,
                to_state,
                input_signal,
                output_signal,
            ])
            lines.append(line)

        return "\n".join(lines)
