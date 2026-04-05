"""
Algorithm Registry

Maps algorithm names to their optimizer classes.
All algorithms share the same interface:
    __init__(bit_width: int)
    optimize_fsm(states, transitions, outputs, fsm_type) -> (dummy_states, new_transitions)
"""
from typing import Dict, Type

from app.core.algorithms.greedy import GreedyOptimizer
from app.core.algorithms.bfs_optimal import BFSOptimizer
from app.core.algorithms.simulated_annealing import SimulatedAnnealingOptimizer
from app.utils.exceptions import AlgorithmException


# Registry mapping algorithm name -> optimizer class
ALGORITHM_REGISTRY: Dict[str, Type[GreedyOptimizer]] = {
    "greedy": GreedyOptimizer,
    "bfs_optimal": BFSOptimizer,
    "simulated_annealing": SimulatedAnnealingOptimizer,
}

# Algorithm metadata for API consumers
ALGORITHM_INFO = {
    "greedy": {
        "name": "Greedy Dummy State Insertion",
        "version": "1.0.0",
        "description": "Processes each problematic transition independently, inserting minimum dummy states per transition.",
        "complexity": "O(T * log(N))",
    },
    "bfs_optimal": {
        "name": "BFS-Optimized Dummy State Insertion",
        "version": "1.0.0",
        "description": "Uses BFS with smart encoding reuse to minimize total dummy states across all transitions.",
        "complexity": "O(T * N)",
    },
    "simulated_annealing": {
        "name": "Simulated Annealing Encoding Optimizer",
        "version": "1.0.0",
        "description": (
            "Optimises the state encoding assignment to minimise total Hamming distance "
            "across all transitions before resolving remaining HD>1 transitions with dummy "
            "states. Accepts worse solutions with a temperature-dependent probability to "
            "escape local optima."
        ),
        "complexity": "O(I * T) where I is max_iterations, T is transitions",
    },
}


def get_algorithm(name: str) -> Type[GreedyOptimizer]:
    """
    Get an algorithm class by name.

    Args:
        name: Algorithm identifier (e.g., 'greedy', 'bfs_optimal')

    Returns:
        Algorithm class (not an instance)

    Raises:
        AlgorithmException: If the algorithm name is not registered
    """
    if name not in ALGORITHM_REGISTRY:
        available = ", ".join(ALGORITHM_REGISTRY.keys())
        raise AlgorithmException(
            f"Unknown algorithm: '{name}'. Available algorithms: {available}"
        )
    return ALGORITHM_REGISTRY[name]


def get_algorithm_info(name: str) -> dict:
    """
    Get metadata about an algorithm.

    Args:
        name: Algorithm identifier

    Returns:
        Dictionary with algorithm metadata

    Raises:
        AlgorithmException: If the algorithm name is not registered
    """
    if name not in ALGORITHM_INFO:
        raise AlgorithmException(f"Unknown algorithm: '{name}'")
    return ALGORITHM_INFO[name]


def list_algorithms() -> list:
    """
    List all available algorithms with metadata.

    Returns:
        List of dictionaries with algorithm info
    """
    return [
        {"id": name, **info}
        for name, info in ALGORITHM_INFO.items()
    ]
