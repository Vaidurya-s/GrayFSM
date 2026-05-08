"""
JSON Exporter

Generates a clean, portable JSON export of an FSM definition.
Strips internal metadata and produces a standardized format.
"""

import json

from app.utils.exceptions import ExportException


class JSONExporter:
    """Generates clean JSON export from FSM definition"""

    def export(
        self,
        definition: dict,
        fsm_type: str,
        name: str,
        options: dict | None = None,
    ) -> str:
        """
        Generate a clean JSON representation of the FSM.

        Args:
            definition: FSM definition dict
            fsm_type: 'moore' or 'mealy'
            name: FSM name
            options: Optional settings (style: 'standard'|'compact'|'verbose', include_comments)

        Returns:
            JSON string

        Raises:
            ExportException: If the definition is invalid
        """
        options = options or {}
        style = options.get("style", "standard")

        states = definition.get("states", [])
        transitions = definition.get("transitions", [])
        outputs = definition.get("outputs", {})
        initial_state = definition.get("initial_state", "")
        encodings = definition.get("encodings", {})

        if not states:
            raise ExportException("FSM has no states to export")

        if style == "compact":
            return self._export_compact(
                name, fsm_type, states, initial_state, transitions, outputs, encodings
            )
        elif style == "verbose":
            return self._export_verbose(
                name, fsm_type, states, initial_state, transitions, outputs, encodings
            )
        else:
            return self._export_standard(
                name, fsm_type, states, initial_state, transitions, outputs, encodings
            )

    def _export_standard(
        self,
        name: str,
        fsm_type: str,
        states: list,
        initial_state: str,
        transitions: list,
        outputs: dict,
        encodings: dict,
    ) -> str:
        """Standard JSON format -- matches the input format for round-tripping."""
        export_data = {
            "name": name,
            "type": fsm_type,
            "states": states,
            "initial_state": initial_state,
            "transitions": [
                {
                    "from_state": t.get("from_state"),
                    "to_state": t.get("to_state"),
                    **({"input": t["input"]} if t.get("input") else {}),
                    **({"output": t["output"]} if t.get("output") else {}),
                }
                for t in transitions
            ],
        }

        if outputs:
            export_data["outputs"] = outputs

        if encodings:
            export_data["encodings"] = encodings

        return json.dumps(export_data, indent=2)

    def _export_compact(
        self,
        name: str,
        fsm_type: str,
        states: list,
        initial_state: str,
        transitions: list,
        outputs: dict,
        encodings: dict,
    ) -> str:
        """Compact JSON -- minimal whitespace."""
        export_data = {
            "name": name,
            "type": fsm_type,
            "states": states,
            "initial_state": initial_state,
            "transitions": [
                {
                    "from_state": t.get("from_state"),
                    "to_state": t.get("to_state"),
                    **({"input": t["input"]} if t.get("input") else {}),
                    **({"output": t["output"]} if t.get("output") else {}),
                }
                for t in transitions
            ],
        }

        if outputs:
            export_data["outputs"] = outputs

        return json.dumps(export_data, separators=(",", ":"))

    def _export_verbose(
        self,
        name: str,
        fsm_type: str,
        states: list,
        initial_state: str,
        transitions: list,
        outputs: dict,
        encodings: dict,
    ) -> str:
        """Verbose JSON -- includes metadata, descriptions, and encoding info."""
        export_data = {
            "metadata": {
                "name": name,
                "type": fsm_type,
                "state_count": len(states),
                "transition_count": len(transitions),
                "generator": "GrayFSM",
            },
            "fsm": {
                "states": [
                    {
                        "id": s,
                        **({"encoding": encodings[s]} if s in encodings else {}),
                        **({"output": outputs[s]} if s in outputs else {}),
                        "is_dummy": s.startswith("DUMMY_"),
                    }
                    for s in states
                ],
                "initial_state": initial_state,
                "transitions": [
                    {
                        "from_state": t.get("from_state"),
                        "to_state": t.get("to_state"),
                        **({"input": t["input"]} if t.get("input") else {}),
                        **({"output": t["output"]} if t.get("output") else {}),
                        "is_dummy_transition": t.get("is_dummy_transition", False),
                    }
                    for t in transitions
                ],
            },
        }

        if encodings:
            export_data["encodings"] = encodings

        return json.dumps(export_data, indent=2)
