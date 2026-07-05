"""
Genetic Algorithm State Encoding Optimizer

Evolves a population of state-encoding permutations to minimise total
Hamming distance across all transitions. Complements simulated annealing
by exploring the search space population-wide rather than single-trajectory;
that broader exploration sometimes escapes local optima SA settles into.

Algorithm:
    1. Population of N permutations of the initial encodings.
    2. Fitness = total Hamming distance (lower is better).
    3. Each generation:
        a. Elitism: carry top-K individuals into the next generation.
        b. Fill the rest by tournament-selecting two parents, applying
           order crossover (preserves permutation validity), and mutating
           with probability `mutation_rate` (single swap).
    4. Terminate after `generations` iterations or when cost reaches 0.
    5. Hand the best assignment to the parent GreedyOptimizer for dummy-
       state insertion, exactly like SA does.
"""

import random

from app.core.algorithms.greedy import DummyState, GreedyOptimizer
from app.core.gray_code import hamming_distance


class GeneticAlgorithmOptimizer(GreedyOptimizer):
    """Population-based encoding optimizer.

    Parameters (via the options dict):
        population_size  (int,   default 30)    – individuals per generation
        generations      (int,   default 200)   – number of generations
        mutation_rate    (float, default 0.20)  – per-child mutation chance
        elitism          (int,   default 2)     – top-K carried unchanged
        tournament_size  (int,   default 3)     – contenders per selection
        seed             (int,   optional)      – RNG seed for reproducibility
    """

    DEFAULT_POPULATION_SIZE: int = 30
    DEFAULT_GENERATIONS: int = 200
    DEFAULT_MUTATION_RATE: float = 0.20
    DEFAULT_ELITISM: int = 2
    DEFAULT_TOURNAMENT_SIZE: int = 3

    def __init__(self, bit_width: int, options: dict | None = None):
        super().__init__(bit_width)
        opts = options or {}
        self.population_size: int = int(opts.get("population_size", self.DEFAULT_POPULATION_SIZE))
        self.generations: int = int(opts.get("generations", self.DEFAULT_GENERATIONS))
        self.mutation_rate: float = float(opts.get("mutation_rate", self.DEFAULT_MUTATION_RATE))
        self.elitism: int = int(opts.get("elitism", self.DEFAULT_ELITISM))
        self.tournament_size: int = int(opts.get("tournament_size", self.DEFAULT_TOURNAMENT_SIZE))
        seed = opts.get("seed")
        self._rng = random.Random(seed)

        # Diagnostics
        self.iterations_run: int = 0
        self.initial_cost: float = 0.0
        self.final_cost: float = 0.0
        self.improvement_ratio: float = 0.0
        self.best_assignment: dict[str, str] = {}

    # ------------------------------------------------------------------
    # Public interface (matches GreedyOptimizer / SA exactly)
    # ------------------------------------------------------------------

    def optimize_fsm(
        self,
        states: dict[str, str],
        transitions: list[dict],
        outputs: dict[str, str],
        fsm_type: str,
    ) -> tuple[list[DummyState], list[dict]]:
        if len(states) <= 1:
            return super().optimize_fsm(states, transitions, outputs, fsm_type)

        best = self._evolve(states, transitions)
        self.best_assignment = best
        return super().optimize_fsm(best, transitions, outputs, fsm_type)

    # ------------------------------------------------------------------
    # GA core
    # ------------------------------------------------------------------

    def _compute_cost(
        self,
        assignment: dict[str, str],
        transitions: list[dict],
    ) -> float:
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

    def _random_individual(
        self,
        state_ids: list[str],
        code_pool: list[str],
    ) -> dict[str, str]:
        """Random injective assignment of `len(state_ids)` codes drawn
        from `code_pool` to `state_ids`.

        `code_pool` may be larger than `state_ids` — in that case the
        excess codes are simply unused by this individual. That's how
        GA explores the full 2^k code space rather than only the
        initial pool.
        """
        if len(code_pool) < len(state_ids):
            raise ValueError(
                f"code_pool ({len(code_pool)}) smaller than state count "
                f"({len(state_ids)}) — impossible to build an injective assignment."
            )
        chosen = self._rng.sample(code_pool, len(state_ids))
        return dict(zip(state_ids, chosen, strict=True))

    def _tournament_select(
        self,
        population: list[dict[str, str]],
        fitnesses: list[float],
    ) -> dict[str, str]:
        k = min(self.tournament_size, len(population))
        contenders = self._rng.sample(range(len(population)), k)
        winner = min(contenders, key=lambda i: fitnesses[i])
        return population[winner]

    def _crossover(
        self,
        p1: dict[str, str],
        p2: dict[str, str],
        state_ids: list[str],
        code_pool: list[str],
    ) -> dict[str, str]:
        """
        Order crossover (OX) adapted for the full-code-alphabet case.

        Since p1 and p2 may use DIFFERENT subsets of `code_pool` (each
        picks n_states codes out of the full 2^k), classical OX (which
        assumes the two parents are permutations of the same set) can't
        run unmodified. Adapted OX:
          1. Inherit a contiguous slice of p1's codes as-is.
          2. Fill remaining slots by walking p2's codes in state_ids
             order, skipping any code the child already uses.
          3. If p2 doesn't supply enough remaining codes (because p1's
             slice consumed codes p2 doesn't have), draw from the pool
             of unused codes to complete the child.
        Always yields an injective assignment on `state_ids`.
        """
        n = len(state_ids)
        if n <= 2:
            return dict(p1)
        a, b = sorted(self._rng.sample(range(n), 2))
        child: dict[str, str] = {}
        used: set[str] = set()
        for k in range(a, b + 1):
            sid = state_ids[k]
            enc = p1[sid]
            child[sid] = enc
            used.add(enc)
        # Walk p2's codes (in state_ids order) and fill the gaps.
        p2_codes_in_order = [p2[sid] for sid in state_ids]
        fill = [c for c in p2_codes_in_order if c not in used]
        fill_idx = 0
        # Backup pool for the case where p2 didn't have enough novel codes.
        pool_backup = [c for c in code_pool if c not in used]
        self._rng.shuffle(pool_backup)
        backup_idx = 0
        for k in range(n):
            sid = state_ids[k]
            if sid in child:
                continue
            if fill_idx < len(fill):
                enc = fill[fill_idx]
                fill_idx += 1
            else:
                # p2 ran out — draw an unused code at random.
                while backup_idx < len(pool_backup) and pool_backup[backup_idx] in used:
                    backup_idx += 1
                enc = pool_backup[backup_idx]
                backup_idx += 1
            child[sid] = enc
            used.add(enc)
        return child

    def _mutate(
        self,
        individual: dict[str, str],
        state_ids: list[str],
        code_pool: list[str],
    ) -> dict[str, str]:
        """Mutate `individual` in place with probability `mutation_rate`.

        Two mutation types are chosen with equal probability:
          - Swap: exchange codes of two random states.
          - Migrate: pick a state, move it to an unused code drawn from
            `code_pool`. Requires at least one unused code.
        """
        if self._rng.random() >= self.mutation_rate or len(state_ids) < 2:
            return individual
        used = set(individual.values())
        unused = [c for c in code_pool if c not in used]
        do_migrate = bool(unused) and self._rng.random() < 0.5
        if do_migrate:
            s = state_ids[self._rng.randrange(len(state_ids))]
            new_code = unused[self._rng.randrange(len(unused))]
            individual[s] = new_code
        else:
            i, j = self._rng.sample(range(len(state_ids)), 2)
            s1, s2 = state_ids[i], state_ids[j]
            individual[s1], individual[s2] = individual[s2], individual[s1]
        return individual

    def _evolve(
        self,
        initial_states: dict[str, str],
        transitions: list[dict],
    ) -> dict[str, str]:
        from app.core.gray_code import generate_gray_codes

        state_ids = list(initial_states.keys())
        # Full 2^k code alphabet — GA can pick any subset of size n_states.
        # This is the crucial extension over the previous implementation,
        # which only shuffled the initial_states.values() codes.
        code_pool = generate_gray_codes(self.bit_width)

        # Seed population: random samples from the full pool + one
        # warm-start with the caller's initial assignment so we never
        # get worse than start.
        population: list[dict[str, str]] = [
            self._random_individual(state_ids, code_pool) for _ in range(self.population_size)
        ]
        if self.population_size > 0:
            population[0] = dict(initial_states)

        fitnesses = [self._compute_cost(ind, transitions) for ind in population]
        best_idx = min(range(len(population)), key=lambda i: fitnesses[i])
        best = dict(population[best_idx])
        best_cost = fitnesses[best_idx]

        self.initial_cost = self._compute_cost(initial_states, transitions)

        if best_cost == 0.0:
            self.iterations_run = 0
            self.final_cost = 0.0
            self.improvement_ratio = 1.0 if self.initial_cost > 0 else 0.0
            return best

        generations_run = 0
        for gen in range(self.generations):
            # Elitism: top-K survive unchanged.
            ranked = sorted(range(len(population)), key=lambda i: fitnesses[i])
            elitism = max(0, min(self.elitism, len(population)))
            new_pop: list[dict[str, str]] = [dict(population[ranked[i]]) for i in range(elitism)]
            while len(new_pop) < self.population_size:
                p1 = self._tournament_select(population, fitnesses)
                p2 = self._tournament_select(population, fitnesses)
                child = self._crossover(p1, p2, state_ids, code_pool)
                child = self._mutate(child, state_ids, code_pool)
                new_pop.append(child)
            population = new_pop
            fitnesses = [self._compute_cost(ind, transitions) for ind in population]

            cur_best_idx = min(range(len(population)), key=lambda i: fitnesses[i])
            if fitnesses[cur_best_idx] < best_cost:
                best_cost = fitnesses[cur_best_idx]
                best = dict(population[cur_best_idx])
            generations_run = gen + 1
            if best_cost == 0.0:
                break

        self.iterations_run = generations_run
        self.final_cost = best_cost
        self.improvement_ratio = (
            (self.initial_cost - best_cost) / self.initial_cost if self.initial_cost > 0 else 0.0
        )
        return best
