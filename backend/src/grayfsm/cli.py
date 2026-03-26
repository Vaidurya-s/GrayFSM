"""
Command-line interface for GrayFSM.

This CLI allows testing of FSM optimization algorithms from the command line.
"""

import json
import sys
from pathlib import Path
from typing import Optional
import argparse

from .core.fsm_model import create_fsm_from_dict, fsm_to_dict
from .core.algorithms.base import AlgorithmRegistry


def load_fsm(file_path: str):
    """Load FSM from JSON file."""
    path = Path(file_path)
    if not path.exists():
        print(f"Error: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(path, 'r') as f:
            data = json.load(f)
        return create_fsm_from_dict(data)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {file_path}: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error loading FSM: {e}", file=sys.stderr)
        sys.exit(1)


def save_result(result, output_path: str):
    """Save optimization result to JSON file."""
    path = Path(output_path)

    # Convert OptimizedFSM to dict
    data = {
        "algorithm": result.algorithm,
        "execution_time_ms": result.execution_time_ms,
        "original_state_count": result.original_state_count,
        "final_state_count": result.final_state_count,
        "dummy_state_count": result.dummy_state_count,
        "states": result.states,
        "transitions": [
            {
                "from_state": t.from_state,
                "to_state": t.to_state,
                "input": t.input,
                "output": t.output
            }
            for t in result.transitions
        ],
        "encoding": result.encoding,
        "dummy_states": [
            {
                "id": d.id,
                "encoding": d.encoding,
                "output": d.output,
                "inserted_for_transition": d.inserted_for_transition,
                "position_in_path": d.position_in_path
            }
            for d in result.dummy_states
        ],
        "metrics": result.metrics,
        "original_fsm": fsm_to_dict(result.original_fsm)
    }

    try:
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"Result saved to: {output_path}")
    except Exception as e:
        print(f"Error saving result: {e}", file=sys.stderr)
        sys.exit(1)


def print_result(result):
    """Print optimization result to console."""
    print("\n" + "=" * 70)
    print(f"OPTIMIZATION RESULT")
    print("=" * 70)
    print(f"Algorithm:            {result.algorithm}")
    print(f"Execution time:       {result.execution_time_ms:.2f} ms")
    print(f"Original states:      {result.original_state_count}")
    print(f"Final states:         {result.final_state_count}")
    print(f"Dummy states added:   {result.dummy_state_count}")
    print(f"Compression ratio:    {result.get_compression_ratio():.2%}")
    print(f"Total transitions:    {result.total_transitions}")

    if result.dummy_states:
        print(f"\nDummy States Inserted:")
        for dummy in result.dummy_states:
            print(f"  - {dummy.id}: encoding={dummy.encoding}, "
                  f"output={dummy.output}, for={dummy.inserted_for_transition}")

    print(f"\nState Encodings:")
    for state in result.original_fsm.states:
        print(f"  - {state}: {result.encoding[state]}")

    print("=" * 70)


def list_algorithms():
    """List all available algorithms."""
    algorithms = AlgorithmRegistry.list_algorithms()
    print("\nAvailable Algorithms:")
    print("-" * 50)
    for name, algo_class in algorithms.items():
        instance = algo_class()
        print(f"  {name:20s} {instance.description}")
    print()


def main():
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
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to execute')

    # Optimize command
    optimize_parser = subparsers.add_parser('optimize', help='Optimize an FSM')
    optimize_parser.add_argument(
        'input_file',
        help='Input FSM JSON file'
    )
    optimize_parser.add_argument(
        '-a', '--algorithm',
        default='greedy',
        help='Algorithm to use (default: greedy)'
    )
    optimize_parser.add_argument(
        '-o', '--output',
        help='Output file for results (JSON)'
    )

    # List algorithms command
    subparsers.add_parser('list-algorithms', help='List available algorithms')

    # Parse arguments
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    # Handle commands
    if args.command == 'list-algorithms':
        list_algorithms()

    elif args.command == 'optimize':
        # Load FSM
        print(f"Loading FSM from: {args.input_file}")
        fsm = load_fsm(args.input_file)
        print(f"Loaded: {fsm}")

        # Get algorithm
        try:
            algorithm = AlgorithmRegistry.get_instance(args.algorithm)
        except KeyError as e:
            print(f"Error: {e}", file=sys.stderr)
            print("\nUse 'grayfsm list-algorithms' to see available algorithms")
            sys.exit(1)

        # Optimize
        print(f"Running optimization with: {algorithm.name}")
        try:
            result = algorithm.optimize(fsm)
        except Exception as e:
            print(f"Optimization failed: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            sys.exit(1)

        # Print result
        print_result(result)

        # Save if requested
        if args.output:
            save_result(result, args.output)


if __name__ == '__main__':
    main()
