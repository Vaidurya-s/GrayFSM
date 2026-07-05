"""
Simulated Annealing State Encoding Optimizer

Optimizes FSM state encoding assignments to minimize total weighted
Hamming distance across all transitions. Unlike greedy/BFS algorithms
that insert dummy states, this algorithm reassigns encodings to the
existing states so that frequently-used transitions naturally have
low Hamming distance.

Algorithm:
    1. Start with the current encoding assignment (or random if none exists)
    2. Cost function: sum of Hamming distances for all transitions
    3. At each iteration: randomly swap encodings of two distinct states
    4. Accept improvement unconditionally; accept degradation with probability
       exp(-delta_cost / T)
    5. Cool: T = T * cooling_rate
    6. Terminate when T < min_temp or max_iterations reached
"""

import math
import random

from app.core.algorithms.greedy import DummyState, GreedyOptimizer
from app.core.gray_code import hamming_distance


class SimulatedAnnealingOptimizer(GreedyOptimizer):
    """
    Simulated annealing optimizer for FSM state encoding.

    Inherits from GreedyOptimizer to share the DummyState insertion
    infrastructure.  After finding an improved encoding assignment via
    annealing, the optimizer runs the greedy pass on the rearranged
    states so that any remaining HD > 1 transitions are resolved with
    dummy states — exactly like the other algorithms.

    Parameters (via options dict):
        initial_temp   (float, default 100)   – starting temperature
        cooling_rate   (float, default 0.995) – multiplicative cooling factor
        min_temp       (float, default 0.01)  – termination temperature
        max_iterations (int,   default 10000) – hard iteration limit
        seed           (int,   optional)      – RNG seed for reproducibility
    """

    DEFAULT_INITIAL_TEMP: float = 100.0
    DEFAULT_COOLING_RATE: float = 0.995
    DEFAULT_MIN_TEMP: float = 0.01
    DEFAULT_MAX_ITERATIONS: int = 10000

    def __init__(self, bit_width: int, options: dict | None = None):
        """
        Initialise the optimizer.

        Args:
            bit_width: Number of bits in state encoding
            options:   Optional parameter overrides (see class docstring)
        """
        super().__init__(bit_width)

        opts = options or {}
        self.initial_temp: float = float(opts.get("initial_temp", self.DEFAULT_INITIAL_TEMP))
        self.cooling_rate: float = float(opts.get("cooling_rate", self.DEFAULT_COOLING_RATE))
        self.min_temp: float = float(opts.get("min_temp", self.DEFAULT_MIN_TEMP))
        self.max_iterations: int = int(opts.get("max_iterations", self.DEFAULT_MAX_ITERATIONS))
        seed = opts.get("seed")
        self._rng = random.Random(seed)

        # Diagnostics exposed after a run
        self.iterations_run: int = 0
        self.initial_cost: float = 0.0
        self.final_cost: float = 0.0
        self.improvement_ratio: float = 0.0
        # Best encoding assignment found (populated after optimize_fsm / optimize_encoding_only)
        self.best_assignment: dict[str, str] = {}

    # ------------------------------------------------------------------
    # Public interface (matches GreedyOptimizer exactly)
    # ------------------------------------------------------------------

    def optimize_fsm(
        self,
        states: dict[str, str],  # state_id -> gray_encoding
        transitions: list[dict],
        outputs: dict[str, str],
        fsm_type: str,
    ) -> tuple[list[DummyState], list[dict]]:
        """
        Optimise the FSM encoding assignment via simulated annealing,
        then resolve remaining HD > 1 transitions with dummy states.

        Args:
            states:      Mapping of state IDs to initial Gray encodings
            transitions: List of transition dictionaries
            outputs:     State outputs (used only for Moore dummy states)
            fsm_type:    'moore' or 'mealy'

        Returns:
            Tuple of (dummy_states_list, new_transitions_list)
            — identical structure to GreedyOptimizer.optimize_fsm
        """
        if len(states) <= 1:
            # Nothing to optimise: single-state or empty FSM
            return super().optimize_fsm(states, transitions, outputs, fsm_type)

        # 1. Find the best encoding assignment using simulated annealing
        best_assignment = self._anneal(states, transitions)
        self.best_assignment = best_assignment

        # 2. Delegate the dummy-state insertion to the parent greedy pass
        #    using the improved assignment
        return super().optimize_fsm(best_assignment, transitions, outputs, fsm_type)

    # ------------------------------------------------------------------
    # Simulated annealing core
    # ------------------------------------------------------------------

    def _compute_cost(
        self,
        assignment: dict[str, str],
        transitions: list[dict],
    ) -> float:
        """
        Cost = total Hamming distance summed over all transitions.

        Self-loops contribute 0. Transitions between states that
        both appear in the assignment are included; any transition
        referencing an unknown state is skipped.
        """
        total = 0
        for trans in transitions:
            from_state = trans.get("from_state")
            to_state = trans.get("to_state")
            if not isinstance(from_state, str) or not isinstance(to_state, str):
                continue
            if from_state == to_state:
                continue
            enc_from = assignment.get(from_state)
            enc_to = assignment.get(to_state)
            if enc_from is None or enc_to is None:
                continue
            total += hamming_distance(enc_from, enc_to)
        return float(total)

    def _anneal(
        self,
        initial_states: dict[str, str],
        transitions: list[dict],
    ) -> dict[str, str]:
        """
        Run the simulated annealing loop.

        Search space: any injective assignment of states to codes drawn
        from the FULL 2^bit_width Gray code alphabet. When there are
        unused codes (n_states < 2^k), SA can migrate a state to an
        unused code — not just swap two used codes. Previously it only
        swapped used codes, which meant states never explored the
        empty slots of the code space, capping the reachable minimum.

        Two move types are chosen uniformly at random when unused codes
        exist; only the swap move is available otherwise:
          - Swap: pick two states, swap their codes.
          - Migrate: pick a state and an unused code, move the state
            there. The vacated code becomes the new unused code.

        Returns:
            Best encoding assignment found (state_id -> encoding string).
        """
        from app.core.gray_code import generate_gray_codes

        state_ids = list(initial_states.keys())
        n_states = len(state_ids)

        current = dict(initial_states)
        current_cost = self._compute_cost(current, transitions)

        # Full code alphabet minus the codes already assigned. Anything
        # left over is a legal migration target.
        all_codes = set(generate_gray_codes(self.bit_width))
        unused_codes: set[str] = all_codes - set(current.values())

        best = dict(current)
        best_cost = current_cost
        best_unused = set(unused_codes)

        self.initial_cost = current_cost

        temperature = self.initial_temp
        iteration = 0

        # Short-circuit: nothing left to fix
        if current_cost == 0.0:
            self.iterations_run = 0
            self.final_cost = 0.0
            self.improvement_ratio = 0.0
            return best

        while temperature > self.min_temp and iteration < self.max_iterations:
            # --- Generate neighbour -------------------------------------
            # 50/50 pick between swap and migrate when both are viable;
            # swap-only when there are no unused codes.
            do_migrate = bool(unused_codes) and self._rng.random() < 0.5
            if do_migrate:
                s = state_ids[self._rng.randrange(n_states)]
                new_code = self._rng.choice(list(unused_codes))
                old_code = current[s]
                current[s] = new_code
                unused_codes.discard(new_code)
                unused_codes.add(old_code)
                # Neighbour parameters we may need to undo:
                undo = ("migrate", s, old_code, new_code)
            else:
                i, j = self._rng.sample(range(n_states), 2)
                s1, s2 = state_ids[i], state_ids[j]
                current[s1], current[s2] = current[s2], current[s1]
                undo = ("swap", s1, s2, None)

            # --- Evaluate neighbour ------------------------------------
            neighbour_cost = self._compute_cost(current, transitions)
            delta = neighbour_cost - current_cost

            # --- Accept / reject ---------------------------------------
            if delta < 0:
                current_cost = neighbour_cost
            else:
                try:
                    prob = math.exp(-delta / temperature)
                except OverflowError:
                    prob = 0.0
                if self._rng.random() < prob:
                    current_cost = neighbour_cost
                else:
                    # Reject — undo the move exactly.
                    kind = undo[0]
                    if kind == "swap":
                        s1, s2 = undo[1], undo[2]
                        current[s1], current[s2] = current[s2], current[s1]
                    else:  # migrate
                        s, old_code, new_code = undo[1], undo[2], undo[3]
                        current[s] = old_code
                        unused_codes.add(new_code)
                        unused_codes.discard(old_code)

            # --- Track global best -------------------------------------
            if current_cost < best_cost:
                best = dict(current)
                best_cost = current_cost
                best_unused = set(unused_codes)

            # --- Cool --------------------------------------------------
            temperature *= self.cooling_rate
            iteration += 1

        self.iterations_run = iteration
        self.final_cost = best_cost
        self.improvement_ratio = (
            (self.initial_cost - best_cost) / self.initial_cost if self.initial_cost > 0 else 0.0
        )
        # `best_unused` is not returned but kept for future debug hooks.
        _ = best_unused
        return best

    # ------------------------------------------------------------------
    # Convenience: encoding-only optimisation (no dummy insertion)
    # ------------------------------------------------------------------

    def optimize_encoding_only(
        self,
        states: dict[str, str],
        transitions: list[dict],
    ) -> dict[str, str]:
        """
        Return the improved encoding assignment without inserting dummy states.

        Useful when the caller only wants the rearranged state-to-code
        mapping (e.g. for visualisation or further processing).

        Args:
            states:      Initial state_id -> encoding mapping
            transitions: Transitions to optimise against

        Returns:
            Improved state_id -> encoding mapping
        """
        if len(states) <= 1:
            self.best_assignment = dict(states)
            return self.best_assignment
        self.best_assignment = self._anneal(states, transitions)
        return self.best_assignment
