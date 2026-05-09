"""
Example Service - Loads example FSMs from JSON files on disk
"""

import json
import math
from pathlib import Path
from typing import Any

from app.utils.exceptions import FSMNotFoundException
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Path to example JSON files
EXAMPLES_DIR = Path(__file__).resolve().parent.parent.parent / "examples"


class ExampleService:
    """Service for loading and serving example FSMs"""

    def __init__(self) -> None:
        self._cache: list[dict[str, Any]] | None = None

    async def list_examples(self) -> list[dict[str, Any]]:
        """
        Load all example FSMs from the examples directory.

        Returns:
            List of example FSM dictionaries formatted for API response
        """
        if self._cache is not None:
            return self._cache

        examples: list[dict[str, Any]] = []
        if not EXAMPLES_DIR.exists():
            logger.warning(
                "Examples directory not found",
                path=str(EXAMPLES_DIR),
            )
            return examples

        for json_file in sorted(EXAMPLES_DIR.glob("*.json")):
            try:
                example = self._load_example_file(json_file)
                if example:
                    examples.append(example)
            except Exception as e:
                logger.error(
                    "Failed to load example file",
                    file=str(json_file),
                    error=str(e),
                )

        self._cache = examples
        logger.info("Loaded example FSMs", count=len(examples))
        return examples

    async def get_example(self, example_name: str) -> dict[str, Any]:
        """
        Get a single example FSM by name (derived from filename).

        Args:
            example_name: Name identifier (filename without extension, e.g., 'elevator')

        Returns:
            Example FSM dictionary

        Raises:
            FSMNotFoundException: If example not found
        """
        examples = await self.list_examples()
        for example in examples:
            if example.get("slug") == example_name:
                return example

        raise FSMNotFoundException(f"example:{example_name}")

    def _load_example_file(self, file_path: Path) -> dict[str, Any] | None:
        """
        Load and parse a single example JSON file.

        Args:
            file_path: Path to the JSON file

        Returns:
            Parsed example dictionary or None on failure
        """
        with open(file_path) as f:
            raw = json.load(f)

        states = raw.get("states", [])
        transitions = raw.get("transitions", [])
        outputs = raw.get("outputs", {})
        fsm_type = raw.get("type", "moore")
        initial_state = raw.get("initial_state", "")
        name = raw.get("name", file_path.stem)
        description = raw.get("description", "")

        state_count = len(states)
        bit_width = max(math.ceil(math.log2(max(state_count, 2))), 1)

        slug = file_path.stem  # e.g., "elevator", "traffic_light"

        # Read difficulty from JSON; fall back to deriving from state count
        difficulty = raw.get("difficulty") or (
            "beginner" if state_count <= 4 else "intermediate" if state_count <= 8 else "advanced"
        )

        return {
            "slug": slug,
            "name": name,
            "description": description,
            "fsm_type": fsm_type,
            "difficulty": difficulty,
            "states": states,
            "initial_state": initial_state,
            "transitions": transitions,
            "outputs": outputs,
            "state_count": state_count,
            "transition_count": len(transitions),
            "bit_width": bit_width,
            "is_optimized": False,
            "dummy_state_count": 0,
        }
