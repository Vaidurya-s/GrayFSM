"""
Algorithm Registry.

Four optimizers, four distinct implementations:

    greedy       — deterministic per-transition bit-flip walk. Fast, no
                   search. Reuses same-encoding dummies where the walk
                   incidentally lands on them.
    bfs_optimal  — BFS over the shortest-path subgraph; actively avoids
                   real-state intermediates and prefers paths through
                   compatible existing dummies (cross-transition reuse).
    global_sa    — simulated annealing over encoding assignments; swap
                   two used codes OR migrate a state to an unused code
                   from the full 2^k alphabet. Then delegates leftover
                   HD>1 transitions to greedy for dummy insertion.
    global_ga    — genetic algorithm over encoding assignments; tournament
                   selection, order crossover adapted to full-alphabet
                   individuals, swap-or-migrate mutation, elitism. Same
                   dummy fall-through as SA.

All classes share the interface:
    __init__(bit_width: int, options: dict | None = None)
    optimize_fsm(states, transitions, outputs, fsm_type)
        -> (dummy_states, new_transitions)

`simulated_annealing` is kept as a deprecated alias for `global_sa` so
old API clients don't break; new code should use `global_sa`.
"""

from app.core.algorithms.bfs_optimal import BFSOptimizer
from app.core.algorithms.genetic_algorithm import GeneticAlgorithmOptimizer
from app.core.algorithms.greedy import GreedyOptimizer
from app.core.algorithms.simulated_annealing import SimulatedAnnealingOptimizer
from app.utils.exceptions import AlgorithmException

# name -> optimizer class. `simulated_annealing` remains an alias for
# `global_sa` for backward compat with any API clients that were pinned
# to the old name; both resolve to the same implementation.
ALGORITHM_REGISTRY: dict[str, type] = {
    "greedy": GreedyOptimizer,
    "bfs_optimal": BFSOptimizer,
    "global_sa": SimulatedAnnealingOptimizer,
    "global_ga": GeneticAlgorithmOptimizer,
    # Deprecated alias — prefer `global_sa`.
    "simulated_annealing": SimulatedAnnealingOptimizer,
}

# Metadata surfaced to the /algorithms endpoint and any UI that lists
# available optimizers. Complexity strings match the actual code.
ALGORITHM_INFO: dict[str, dict] = {
    "greedy": {
        "name": "Greedy Dummy State Insertion",
        "version": "2.0.0",
        "description": (
            "Deterministic per-transition bit-flip walk (LSB→MSB). Inserts "
            "the minimum dummies for each transition in isolation. Same-code "
            "dummies with matching outputs are silently unified (hardware "
            "constraint: one physical state per address). Hard-errors on "
            "real-state or output-mismatch collisions."
        ),
        "complexity": "O(T · k)  where T = |transitions|, k = bit_width",
    },
    "bfs_optimal": {
        "name": "BFS-Optimized Dummy Insertion",
        "version": "2.0.0",
        "description": (
            "BFS search over the shortest-path subgraph in the Gray-code "
            "hypercube. Skips real-state encodings as intermediates and "
            "actively prefers paths through compatible existing dummies to "
            "share bridges across transitions. Falls back to LSB-first "
            "ordering on reuse ties (matches greedy incidentally, and "
            "concentrates dummies in low-index encoding space)."
        ),
        "complexity": (
            "O(T · N)  amortized  (BFS per transition bounded by the "
            "shortest-path subgraph)"
        ),
    },
    "global_sa": {
        "name": "Global Simulated Annealing",
        "version": "2.0.0",
        "description": (
            "Simulated annealing over encoding assignments. Cost = total "
            "Hamming distance across transitions. Neighbour moves: swap two "
            "used codes, or migrate a state to an unused code from the full "
            "2^k alphabet. Boltzmann acceptance rule, geometric cooling. "
            "Any residual HD>1 transitions are resolved by the greedy pass."
        ),
        "complexity": "O(I · T)  where I = max_iterations, T = |transitions|",
    },
    "global_ga": {
        "name": "Global Genetic Algorithm",
        "version": "2.0.0",
        "description": (
            "Genetic algorithm over encoding assignments. Population of "
            "injective assignments drawn from the full 2^k alphabet. "
            "Tournament selection, adapted order crossover, swap-or-migrate "
            "mutation, elitism. Same greedy fall-through for residual HD>1 "
            "transitions as global_sa."
        ),
        "complexity": (
            "O(G · P · T)  where G = generations, P = population_size, "
            "T = |transitions|"
        ),
    },
    "simulated_annealing": {
        "name": "Simulated Annealing (deprecated alias)",
        "version": "2.0.0",
        "description": (
            "Deprecated alias for `global_sa`. Kept for backward compatibility "
            "with older API clients. Prefer `global_sa`."
        ),
        "complexity": "O(I · T)",
        "deprecated": True,
    },
}


def get_algorithm(name: str) -> type:
    """Get an algorithm class by name.

    Raises:
        AlgorithmException: If the algorithm name is not registered.
    """
    if name not in ALGORITHM_REGISTRY:
        available = ", ".join(
            sorted(k for k in ALGORITHM_REGISTRY if k != "simulated_annealing")
        )
        raise AlgorithmException(
            f"Unknown algorithm: '{name}'. Available algorithms: {available}"
        )
    return ALGORITHM_REGISTRY[name]


def get_algorithm_info(name: str) -> dict:
    """Get metadata for an algorithm.

    Raises:
        AlgorithmException: If the algorithm name is not registered.
    """
    if name not in ALGORITHM_INFO:
        raise AlgorithmException(f"Unknown algorithm: '{name}'")
    return ALGORITHM_INFO[name]


def list_algorithms() -> list:
    """List all available algorithms with metadata.

    Deprecated aliases are excluded from the listing so UIs default to
    the canonical names.
    """
    return [
        {"id": name, **info}
        for name, info in ALGORITHM_INFO.items()
        if not info.get("deprecated")
    ]
