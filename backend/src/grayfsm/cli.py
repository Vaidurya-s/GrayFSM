"""
Command-line interface for GrayFSM.

This CLI exists for local smoke-testing of FSM optimization algorithms.
It is a thin adapter over ``app.core`` — the same code the FastAPI app
uses — so there is a single source of truth for algorithms / encoding.

Equivalence map (old grayfsm.core.*  ->  app.core.*):
  fsm_model.create_fsm_from_dict / fsm_to_dict
      -> no direct equivalent. ``app.core.fsm_model`` exposes
         dataclasses + ``FSMValidator``; the optimizer in ``app.core``
         takes a *definition dict* (states / transitions / outputs)
         directly. This file keeps a tiny local helper, ``_load_fsm_dict``,
         that reads the JSON, normalizes the shape and validates via
         ``FSMValidator.validate_fsm_structure``. The dict-to-FSM-object
         wrapper class is no longer needed.

  algorithms.base.AlgorithmRegistry
      -> ``app.core.algorithms.ALGORITHM_REGISTRY`` (a plain dict) +
         ``get_algorithm(name)`` returning the optimizer class +
         ``list_algorithms()`` returning metadata dicts.
         Algorithms take ``bit_width`` in __init__ and expose
         ``optimize_fsm(states, transitions, outputs, fsm_type)
         -> (dummy_states, new_transitions)`` — the CLI assembles
         the optimized JSON envelope itself (see ``_run_optimization``).

  exporters/
      -> ``app.core.exporters`` (csv/json/verilog/vhdl/sva/testbench).
         The CLI doesn't currently shell out to any exporter; this is
         only documented for future readers.
"""

import argparse
import json
import math
import os
import sys
import time
from pathlib import Path

# The CLI ships under src/grayfsm/ but imports from the sibling app/ package
# (backend/app/). Inject backend/ onto sys.path so ``import app.*`` resolves
# whether the CLI is invoked via ``poetry run grayfsm`` or
# ``python -m grayfsm.cli``. This mirrors what backend/tests/conftest.py does.
_BACKEND_DIR = Path(__file__).resolve().parents[2]  # .../backend/
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Quiet the app's runtime config validator for CLI use — the CLI does not
# touch the DB / secrets layer, but importing app.core.* triggers
# app.config side-effects in some code paths.
os.environ.setdefault("ENVIRONMENT", "test")

from app.core.algorithms import (  # noqa: E402
    ALGORITHM_INFO,
    ALGORITHM_REGISTRY,
    get_algorithm,
)
from app.core.fsm_model import FSMType, FSMValidator  # noqa: E402
from app.core.gray_code import generate_gray_codes, hamming_distance  # noqa: E402


# ---------------------------------------------------------------------------
# JSON <-> definition helpers
# ---------------------------------------------------------------------------


def _load_fsm_dict(file_path: str) -> dict:
    """Read FSM JSON from disk, normalize, and validate.

    Returns the *definition* dict (states / transitions / outputs /
    initial_state / fsm_type / name / description) — the shape
    ``app.core`` algorithms accept directly.
    """
    path = Path(file_path)
    if not path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {file_path}: {e}", file=sys.stderr)
        sys.exit(1)

    # Normalize: the JSON files use "type", but app.core uses "fsm_type"
    # for the same concept. Keep both fields tolerated.
    fsm_type_raw = (data.get("fsm_type") or data.get("type") or "moore").lower()
    try:
        fsm_type = FSMType(fsm_type_raw)
    except ValueError:
        print(f"Error: invalid FSM type '{fsm_type_raw}' (expected 'moore' or 'mealy')",
              file=sys.stderr)
        sys.exit(1)

    states = data.get("states") or []
    transitions = data.get("transitions") or []
    outputs = data.get("outputs") or {}
    initial_state = data.get("initial_state")

    try:
        FSMValidator.validate_fsm_structure(
            fsm_type=fsm_type,
            states=states,
            initial_state=initial_state,
            transitions=transitions,
            outputs=outputs if fsm_type == FSMType.MOORE else None,
        )
    except Exception as e:
        print(f"Error: FSM validation failed: {e}", file=sys.stderr)
        sys.exit(1)

    return {
        "name": data.get("name", path.stem),
        "description": data.get("description"),
        "fsm_type": fsm_type.value,
        "states": list(states),
        "initial_state": initial_state,
        "transitions": list(transitions),
        "outputs": dict(outputs),
    }


def _assign_gray_encodings(states: list[str], bit_width: int) -> dict[str, str]:
    """Assign Gray codes to states (mirrors app.services.optimization_service)."""
    gray_codes = generate_gray_codes(bit_width)
    encodings: dict[str, str] = {}
    for i, state in enumerate(states):
        if i < len(gray_codes):
            encodings[state] = gray_codes[i]
        else:
            encodings[state] = format(i, f"0{bit_width}b")
    return encodings


# ---------------------------------------------------------------------------
# Optimization orchestration (CLI-only adapter — does NOT live in app.core)
# ---------------------------------------------------------------------------


def _run_optimization(definition: dict, algorithm_name: str) -> dict:
    """Run a registered algorithm and return a JSON-serializable result envelope.

    The envelope preserves the public shape the previous CLI emitted
    (algorithm / execution_time_ms / states / transitions / encoding /
    dummy_states / metrics / original_fsm) so external callers parsing
    its output don't break.
    """
    states = definition["states"]
    transitions = definition["transitions"]
    outputs = definition["outputs"]
    fsm_type = definition["fsm_type"]

    bit_width = max(1, math.ceil(math.log2(max(len(states), 2))))
    pre_encodings = _assign_gray_encodings(states, bit_width)

    algorithm_cls = get_algorithm(algorithm_name)
    optimizer = algorithm_cls(bit_width)

    start = time.perf_counter()
    dummy_states, new_transitions = optimizer.optimize_fsm(
        states=pre_encodings,
        transitions=transitions,
        outputs=outputs,
        fsm_type=fsm_type,
    )
    elapsed_ms = (time.perf_counter() - start) * 1000.0

    final_states = list(states)
    final_outputs = dict(outputs)
    final_encoding = dict(pre_encodings)
    dummy_state_dicts = []
    for d in dummy_states:
        final_states.append(d.id)
        final_outputs[d.id] = d.output
        final_encoding[d.id] = d.encoding
        dummy_state_dicts.append({
            "id": d.id,
            "encoding": d.encoding,
            "output": d.output,
            "inserted_for_transition": d.inserted_for_transition,
        })

    # Average Hamming distance across transitions in the optimized FSM
    if new_transitions:
        total_hd = 0
        for t in new_transitions:
            f, to = t["from_state"], t["to_state"]
            if f in final_encoding and to in final_encoding:
                total_hd += hamming_distance(final_encoding[f], final_encoding[to])
        avg_hd = total_hd / len(new_transitions)
    else:
        avg_hd = 0.0

    return {
        "algorithm": algorithm_name,
        "execution_time_ms": round(elapsed_ms, 3),
        "original_state_count": len(states),
        "final_state_count": len(final_states),
        "dummy_state_count": len(dummy_state_dicts),
        "states": final_states,
        "transitions": new_transitions,
        "encoding": final_encoding,
        "outputs": final_outputs,
        "dummy_states": dummy_state_dicts,
        "metrics": {
            "avg_hamming_distance": round(avg_hd, 3),
            "bit_width": bit_width,
        },
        "original_fsm": definition,
    }


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------


def save_result(result: dict, output_path: str) -> None:
    """Save optimization result to JSON file."""
    try:
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Result saved to: {output_path}")
    except Exception as e:
        print(f"Error saving result: {e}", file=sys.stderr)
        sys.exit(1)


def print_result(result: dict) -> None:
    """Print optimization result to console."""
    original_count = result["original_state_count"]
    final_count = result["final_state_count"]
    dummy_count = result["dummy_state_count"]
    compression = (dummy_count / final_count) if final_count else 0.0

    print("\n" + "=" * 70)
    print("OPTIMIZATION RESULT")
    print("=" * 70)
    print(f"Algorithm:            {result['algorithm']}")
    print(f"Execution time:       {result['execution_time_ms']:.2f} ms")
    print(f"Original states:      {original_count}")
    print(f"Final states:         {final_count}")
    print(f"Dummy states added:   {dummy_count}")
    print(f"Compression ratio:    {compression:.2%}")
    print(f"Total transitions:    {len(result['transitions'])}")

    if result["dummy_states"]:
        print("\nDummy States Inserted:")
        for dummy in result["dummy_states"]:
            print(f"  - {dummy['id']}: encoding={dummy['encoding']}, "
                  f"output={dummy['output']}, for={dummy['inserted_for_transition']}")

    print("\nState Encodings:")
    for state in result["original_fsm"]["states"]:
        print(f"  - {state}: {result['encoding'][state]}")

    print("=" * 70)


def list_algorithms() -> None:
    """List all available algorithms."""
    print("\nAvailable Algorithms:")
    print("-" * 70)
    for name in ALGORITHM_REGISTRY:
        info = ALGORITHM_INFO.get(name, {})
        desc = info.get("description", "(no description)")
        print(f"  {name:22s} {desc}")
    print()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="GrayFSM - FSM optimization using Gray code encoding",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Optimize FSM using greedy algorithm
  grayfsm optimize examples/traffic_light.json -a greedy

  # Save result to file
  grayfsm optimize examples/traffic_light.json -a greedy -o result.json

  # List available algorithms
  grayfsm list-algorithms
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    optimize_parser = subparsers.add_parser("optimize", help="Optimize an FSM")
    optimize_parser.add_argument("input_file", help="Input FSM JSON file")
    optimize_parser.add_argument(
        "-a", "--algorithm",
        default="greedy",
        help="Algorithm to use (default: greedy)",
    )
    optimize_parser.add_argument(
        "-o", "--output",
        help="Output file for results (JSON)",
    )

    subparsers.add_parser("list-algorithms", help="List available algorithms")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "list-algorithms":
        list_algorithms()
        return

    if args.command == "optimize":
        print(f"Loading FSM from: {args.input_file}")
        definition = _load_fsm_dict(args.input_file)
        print(
            f"Loaded: name='{definition['name']}', type={definition['fsm_type']}, "
            f"states={len(definition['states'])}, "
            f"transitions={len(definition['transitions'])}"
        )

        if args.algorithm not in ALGORITHM_REGISTRY:
            available = ", ".join(ALGORITHM_REGISTRY.keys())
            print(
                f"Error: Unknown algorithm '{args.algorithm}'. Available: {available}",
                file=sys.stderr,
            )
            print("\nUse 'grayfsm list-algorithms' to see available algorithms")
            sys.exit(1)

        print(f"Running optimization with: {args.algorithm}")
        try:
            result = _run_optimization(definition, args.algorithm)
        except Exception as e:
            print(f"Optimization failed: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            sys.exit(1)

        print_result(result)

        if args.output:
            save_result(result, args.output)


if __name__ == "__main__":
    main()
