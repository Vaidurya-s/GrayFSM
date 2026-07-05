"""
BFS-Optimal Dummy State Insertion.

Greedy inserts a fresh dummy at every intermediate code, per transition.
Two transitions that could share an intermediate never do. BFS-Optimal
does the reuse: when a bridge would land on a code where a dummy already
exists (from a previously-processed transition), route through that
dummy instead of creating a new one.

Complexity
    Time  O(T · k · 2^k) worst case per BFS — bounded because we cap at
          the shortest path (length = Hamming distance ≤ k). For a fixed
          bit-width k, this is O(T · N log N) ≈ O(T · N) with N = 2^k.
    Space O(D + 2^k) — dummy registry + BFS frontier.

Guarantees vs Greedy
    - Same HD=1 hop guarantee on every emitted transition (correctness).
    - Same or fewer total dummies (reuse only ever reduces the count).
    - Same collision-detection behavior (raises when the encoding space
      is genuinely exhausted).

Reuse mechanics
    A dummy is reusable iff its encoding sits on some shortest bit-flip
    path between the current transition's endpoints. BFS finds all
    shortest paths; if any pass through an existing dummy's encoding,
    prefer that path. If multiple existing dummies could be reused,
    prefer the one that reuses the most (longest overlap).

Semantic caveat
    Sharing a dummy across two transitions means the dummy's OUTPUT is
    used in two contexts. For Moore this is safe only when both source
    transitions want the same output at that dummy (they do, when both
    dummies would carry the source-state output — the from-state's
    output). For Mealy the shared dummy carries 'X' regardless, so
    sharing is always safe. When a Moore reuse would require conflicting
    outputs, we fall back to inserting a fresh dummy.
"""

from collections import deque

from app.core.algorithms.greedy import DummyState, _bit_flip_path
from app.core.gray_code import hamming_distance
from app.utils.exceptions import AlgorithmException


class BFSOptimizer:
    """
    BFS-based optimizer with cross-transition dummy reuse.

    Time  O(T · N log N)  Space O(D + 2^k)
    """

    def __init__(self, bit_width: int):
        if bit_width < 1:
            raise ValueError("bit_width must be >= 1")
        self.bit_width = bit_width
        self.dummy_counter = 0
        self.dummy_states: list[DummyState] = []
        # Registry: encoding -> DummyState. Used both to detect collisions
        # with real states (populated with initial state encodings) and to
        # find reusable dummies from prior transitions.
        self._by_encoding: dict[str, DummyState] = {}
        # Real state encodings — collisions here are hard errors.
        self._real_encodings: set[str] = set()

    def optimize_fsm(
        self,
        states: dict[str, str],
        transitions: list[dict],
        outputs: dict[str, str],
        fsm_type: str,
    ) -> tuple[list[DummyState], list[dict]]:
        """See GreedyOptimizer.optimize_fsm for the contract."""
        self.dummy_states = []
        self.dummy_counter = 0
        self._by_encoding = {}
        self._real_encodings = set(states.values())

        new_transitions: list[dict] = []
        for trans in transitions:
            from_state = trans["from_state"]
            to_state = trans["to_state"]
            from_code = states[from_state]
            to_code = states[to_state]

            if hamming_distance(from_code, to_code) <= 1:
                new_transitions.append(trans)
                continue

            expanded = self._expand_transition(
                from_state=from_state,
                to_state=to_state,
                from_code=from_code,
                to_code=to_code,
                original_trans=trans,
                state_outputs=outputs,
                fsm_type=fsm_type,
            )
            new_transitions.extend(expanded)

        return self.dummy_states, new_transitions

    # ------------------------------------------------------------------
    # Path finding
    # ------------------------------------------------------------------

    def _shortest_path_preferring_reuse(
        self,
        from_code: str,
        to_code: str,
        preferred_outputs: dict[str, str],
    ) -> list[str]:
        """Find a shortest bit-flip path from `from_code` to `to_code`
        that maximises reuse of already-registered dummy encodings whose
        `output` matches `preferred_outputs[code]`.

        Path length is always HD(from, to) (shortest by construction —
        we only ever visit codes on the direct route). Reuse is a
        secondary preference among the ties.

        Args:
            preferred_outputs: for each intermediate code that MUST be
                a fresh dummy, the caller's intended output. Only used
                to decide reuse compatibility — we can reuse an
                existing dummy at code C only if its output matches
                the caller's `preferred_outputs[C]`.
        """
        target_dist = hamming_distance(from_code, to_code)
        if target_dist <= 1:
            return [from_code, to_code] if from_code != to_code else [from_code]

        # BFS from `from_code`, but restrict expansion to bits that
        # differ between current and `to_code` (never flip a bit that
        # would take us further away). This restricts the frontier to
        # exactly the shortest-path subgraph.
        #
        # For each node reached, track (path, reuse_count) so we can
        # break ties by reuse.
        queue: deque[tuple[str, list[str], int]] = deque()
        queue.append((from_code, [from_code], 0))
        # visited maps encoding -> (best reuse count seen). We revisit
        # a node if we found a strictly better reuse.
        best_reuse_at: dict[str, int] = {from_code: 0}
        best_final_path: list[str] | None = None
        best_final_reuse = -1

        while queue:
            code, path, reuse = queue.popleft()
            if code == to_code:
                if reuse > best_final_reuse:
                    best_final_reuse = reuse
                    best_final_path = path
                continue
            # Flip only bits that still differ from the target. Iterate
            # LSB→MSB (rightmost bit first) so ties on reuse resolve to
            # the LSB-first path — this matches the greedy walk order,
            # concentrating dummies in the low-index encoding space and
            # increasing incidental reuse across transitions processed
            # later in the loop.
            neighbor_positions = [i for i, (c, t) in enumerate(zip(code, to_code)) if c != t]
            neighbor_positions.reverse()
            for pos in neighbor_positions:
                c, t = code[pos], to_code[pos]
                neighbor_chars = list(code)
                neighbor_chars[pos] = t
                neighbor = "".join(neighbor_chars)

                # Skip real-state encodings as intermediates. Routing
                # a bridge through a real state would give that state's
                # output an unintended appearance mid-transition — a
                # semantic change we don't allow. The target itself is
                # always the destination state, which is fine.
                if neighbor != to_code and neighbor in self._real_encodings:
                    continue

                # Skip incompatible-output existing dummies as
                # intermediates: the path-picker can't reuse them, and
                # inserting a fresh dummy at that code would collide.
                if neighbor != to_code and neighbor in self._by_encoding:
                    existing_here = self._by_encoding[neighbor]
                    if existing_here.output != preferred_outputs.get(neighbor):
                        continue

                # Compute reuse gained by stepping into neighbor.
                gain = 0
                if neighbor != to_code and neighbor in self._by_encoding:
                    existing = self._by_encoding[neighbor]
                    if existing.output == preferred_outputs.get(neighbor):
                        gain = 1

                new_reuse = reuse + gain
                # Skip if we've reached this node before with equal or
                # better reuse.
                seen_best = best_reuse_at.get(neighbor, -1)
                if new_reuse <= seen_best:
                    continue
                best_reuse_at[neighbor] = new_reuse
                queue.append((neighbor, path + [neighbor], new_reuse))

        if best_final_path is None:
            # Impossible in a hypercube — every pair is connected — but
            # defensive: fall back to the deterministic bit-flip path.
            return _bit_flip_path(from_code, to_code)
        return best_final_path

    # ------------------------------------------------------------------
    # Expansion
    # ------------------------------------------------------------------

    def _expand_transition(
        self,
        *,
        from_state: str,
        to_state: str,
        from_code: str,
        to_code: str,
        original_trans: dict,
        state_outputs: dict[str, str],
        fsm_type: str,
    ) -> list[dict]:
        """Break one HD>1 transition into an HD=1 chain, reusing existing
        dummies where compatible."""
        # First pass — compute what output *each intermediate code would
        # need* if it became a fresh dummy. This lets the path search
        # decide whether an existing dummy at that code is reusable
        # (only if outputs match).
        deterministic_path = _bit_flip_path(from_code, to_code)
        intermediate_codes = deterministic_path[1:-1]
        preferred_outputs: dict[str, str] = {}
        for i, code in enumerate(intermediate_codes, start=1):
            preferred_outputs[code] = self._dummy_output(
                fsm_type=fsm_type,
                state_outputs=state_outputs,
                from_state=from_state,
                to_state=to_state,
                is_last_hop_before_dest=(i == len(intermediate_codes)),
            )

        # Actual path — may differ from deterministic_path if a reuse
        # candidate lives on an alternate shortest path.
        path = self._shortest_path_preferring_reuse(
            from_code=from_code,
            to_code=to_code,
            preferred_outputs=preferred_outputs,
        )
        intermediate_codes = path[1:-1]

        chain: list[dict] = []
        cursor_state = from_state
        for i, code in enumerate(intermediate_codes, start=1):
            # Real-state collision — always hard error.
            if code in self._real_encodings:
                raise AlgorithmException(
                    f"Cannot insert dummy at encoding '{code}' for transition "
                    f"{from_state} -> {to_state}: address already used by a real state. "
                    f"The state space at bit_width={self.bit_width} is exhausted; "
                    f"retry with a wider bit_width."
                )

            existing = self._by_encoding.get(code)
            needed_output = self._dummy_output(
                fsm_type=fsm_type,
                state_outputs=state_outputs,
                from_state=from_state,
                to_state=to_state,
                is_last_hop_before_dest=(i == len(intermediate_codes)),
            )

            if existing is not None and existing.output == needed_output:
                # Reuse: cursor points at an existing dummy.
                dummy_id = existing.id
            else:
                # Fresh dummy. If `existing is not None`, our
                # path-picker chose a shortest path that doesn't
                # collide with any incompatible-output dummy; we
                # should never land on an incompatible existing
                # dummy. If we do, it's a bug in the picker — assert.
                if existing is not None:
                    raise AlgorithmException(
                        f"BFS picker returned a path through incompatible "
                        f"dummy at '{code}' (has output '{existing.output}', "
                        f"transition wants '{needed_output}'). Internal invariant "
                        f"violated."
                    )
                dummy_id = f"DUMMY_{self.dummy_counter}_{from_state}_to_{to_state}"
                self.dummy_counter += 1
                dummy = DummyState(
                    id=dummy_id,
                    encoding=code,
                    output=needed_output,
                    inserted_for_transition=f"{from_state}->{to_state}",
                )
                self.dummy_states.append(dummy)
                self._by_encoding[code] = dummy

            chain.append(
                {
                    "from_state": cursor_state,
                    "to_state": dummy_id,
                    "input": original_trans.get("input") if i == 1 else None,
                    "output": (
                        original_trans.get("output") if fsm_type == "mealy" else None
                    ),
                    "is_dummy_transition": True,
                }
            )
            cursor_state = dummy_id

        chain.append(
            {
                "from_state": cursor_state,
                "to_state": to_state,
                "input": None,
                "output": None,
                "is_dummy_transition": True,
            }
        )
        return chain

    @staticmethod
    def _dummy_output(
        *,
        fsm_type: str,
        state_outputs: dict[str, str],
        from_state: str,
        to_state: str,
        is_last_hop_before_dest: bool,
    ) -> str:
        """Same policy as GreedyOptimizer._dummy_output. Duplicated to
        keep the two algorithms independent."""
        if fsm_type == "moore":
            source = to_state if is_last_hop_before_dest else from_state
            return state_outputs.get(source, "0")
        return "X"
