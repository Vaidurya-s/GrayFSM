"""
Greedy Dummy State Insertion Algorithm.

Per transition (from_state, to_state) with Hamming distance > 1, insert
(HD - 1) intermediate dummy states such that each hop has Hamming
distance exactly 1. Insertion is greedy — no back-tracking, no path
search — the deterministic LSB→MSB bit-flip walk is used every time.

Same-encoding dummies are silently unified when their outputs match
(a hardware register has one physical state per address; if two
transitions want a bridge at the same code AND agree on its output,
they're referring to the same state). When outputs disagree, we
hard-error and ask the caller to widen bit_width. See BFSOptimizer
for the variant that ACTIVELY searches for reuse-friendly paths.

Complexity
    Time  O(T · k)  where T = |transitions|, k = bit_width.
                    Since k = ceil(log2(N)) for N states, equivalently O(T · log N).
                    Direct bit-flip walk — no graph search library.
    Space O(D)      where D = total dummies inserted (upper bound: T · (k - 1)).

Bit-flip path selection: walk the differing bits in ascending index order
(LSB → MSB). This is deterministic and mirrors the reflected Gray-code
construction, keeping the intermediate encodings close to the source.

Dummy encoding collisions
    If the intermediate code that the bit-flip walk lands on is already
    used by a real state, we raise AlgorithmException. Silently
    reusing an existing state's code would break FSM semantics (two
    states with the same address). The caller can retry with a wider
    bit_width.

Dummy state outputs (Moore vs Mealy)
    Moore  — dummies emit the source state's output for all but the last
             hop, which emits the destination's output. This preserves
             the observable output sequence: while walking the bridge,
             an external observer sees the source's output until the
             final one-cycle switch to the destination's output.
    Mealy  — dummies emit "X" (don't-care). Mealy output is transition-
             level, so intermediate transitions don't have a defined
             output value.
"""

from dataclasses import dataclass

from app.core.gray_code import hamming_distance
from app.utils.exceptions import AlgorithmException


@dataclass
class DummyState:
    """A dummy state inserted to bridge a Hamming-distance > 1 transition."""

    id: str
    encoding: str
    output: str
    inserted_for_transition: str


def _bit_flip_path(from_code: str, to_code: str) -> list[str]:
    """Return the sequence of Gray codes from `from_code` to `to_code`,
    flipping one differing bit at a time in ascending bit-position order.

    Length of the returned list is 1 + HD(from_code, to_code). Includes
    both endpoints.
    """
    if len(from_code) != len(to_code):
        raise ValueError(
            f"Code widths differ: {len(from_code)} vs {len(to_code)}"
        )
    diff_positions = [i for i, (a, b) in enumerate(zip(from_code, to_code)) if a != b]
    # Flip differing bits LSB → MSB (rightmost bit index first). This matches
    # the reflected Gray-code construction (successive integers differ in
    # low-order bits), keeping intermediate encodings close to `from_code`.
    diff_positions.reverse()
    path = [from_code]
    current = list(from_code)
    for pos in diff_positions:
        current[pos] = "1" if current[pos] == "0" else "0"
        path.append("".join(current))
    return path


class GreedyOptimizer:
    """
    Greedy per-transition dummy state insertion.

    Time  O(T · k)  Space O(D)
    """

    def __init__(self, bit_width: int):
        if bit_width < 1:
            raise ValueError("bit_width must be >= 1")
        self.bit_width = bit_width
        self.dummy_counter = 0
        self.dummy_states: list[DummyState] = []

    def optimize_fsm(
        self,
        states: dict[str, str],  # state_id -> gray_encoding
        transitions: list[dict],
        outputs: dict[str, str],
        fsm_type: str,
    ) -> tuple[list[DummyState], list[dict]]:
        """Insert dummy states so every transition has Hamming distance 1.

        Args:
            states:      mapping of state_id -> encoding (binary string of
                         `bit_width` bits).
            transitions: list of transition dicts. Each entry must have
                         `from_state` and `to_state`. Optional keys
                         (`input`, `output`) are preserved on the head
                         hop and re-emitted on tail hops for Mealy.
            outputs:     state_id -> output string. Only consulted for
                         Moore FSMs when computing dummy outputs.
            fsm_type:    "moore" or "mealy".

        Returns:
            (dummy_states, new_transitions).

        Raises:
            AlgorithmException: if a bridging dummy's encoding collides
                with a real state's encoding.
        """
        self.dummy_states = []
        self.dummy_counter = 0
        # Real state encodings — a bridge can NEVER route through one of
        # these; doing so would give a real state's output an
        # unintended mid-transition appearance. Hard error on collision.
        real_encodings = set(states.values())
        # Existing dummies keyed by encoding. If greedy's deterministic
        # walk lands on a code already used by a prior dummy, reuse it
        # ONLY when outputs match. There is no way to have two distinct
        # states at the same hardware address — either they're the same
        # state (output must match) or the encoding space is exhausted.
        dummies_by_encoding: dict[str, DummyState] = {}

        new_transitions: list[dict] = []
        for trans in transitions:
            from_state = trans["from_state"]
            to_state = trans["to_state"]
            from_code = states[from_state]
            to_code = states[to_state]

            if hamming_distance(from_code, to_code) <= 1:
                # Transition already glitch-safe.
                new_transitions.append(trans)
                continue

            expanded = self._insert_dummies_for_transition(
                from_state=from_state,
                to_state=to_state,
                from_code=from_code,
                to_code=to_code,
                original_trans=trans,
                state_outputs=outputs,
                fsm_type=fsm_type,
                real_encodings=real_encodings,
                dummies_by_encoding=dummies_by_encoding,
            )
            new_transitions.extend(expanded)

        return self.dummy_states, new_transitions

    def _insert_dummies_for_transition(
        self,
        *,
        from_state: str,
        to_state: str,
        from_code: str,
        to_code: str,
        original_trans: dict,
        state_outputs: dict[str, str],
        fsm_type: str,
        real_encodings: set[str],
        dummies_by_encoding: dict[str, DummyState],
    ) -> list[dict]:
        """Expand a single HD>1 transition into a chain of HD=1 transitions.

        Two failure modes hard-error via AlgorithmException:
        1. The deterministic path routes through a real state's encoding.
        2. The path routes through a prior dummy with an incompatible
           output (hardware can't have two states at the same address).
        Both are the "encoding space is exhausted" signal — the caller
        should widen bit_width.

        Same-output prior dummies are silently reused (they're literally
        the same physical state).
        """
        path = _bit_flip_path(from_code, to_code)  # [from, ..., to]
        intermediate_codes = path[1:-1]

        chain: list[dict] = []
        cursor_state = from_state
        for i, code in enumerate(intermediate_codes, start=1):
            is_last = i == len(intermediate_codes)
            needed_output = self._dummy_output(
                fsm_type=fsm_type,
                state_outputs=state_outputs,
                from_state=from_state,
                to_state=to_state,
                is_last_hop_before_dest=is_last,
            )

            if code in real_encodings:
                raise AlgorithmException(
                    f"Cannot insert dummy at encoding '{code}' for transition "
                    f"{from_state} -> {to_state}: address already used by a real state. "
                    f"The state space at bit_width={self.bit_width} is exhausted; "
                    f"retry with a wider bit_width."
                )

            existing = dummies_by_encoding.get(code)
            if existing is not None:
                if existing.output != needed_output:
                    raise AlgorithmException(
                        f"Cannot insert dummy at encoding '{code}' for transition "
                        f"{from_state} -> {to_state}: an existing dummy at this "
                        f"encoding has output '{existing.output}' but this transition "
                        f"needs output '{needed_output}'. Two distinct states at the "
                        f"same hardware address is impossible; retry with a wider "
                        f"bit_width."
                    )
                # Compatible reuse — same physical state.
                dummy_id = existing.id
            else:
                dummy_id = f"DUMMY_{self.dummy_counter}_{from_state}_to_{to_state}"
                self.dummy_counter += 1
                dummy = DummyState(
                    id=dummy_id,
                    encoding=code,
                    output=needed_output,
                    inserted_for_transition=f"{from_state}->{to_state}",
                )
                self.dummy_states.append(dummy)
                dummies_by_encoding[code] = dummy

            chain.append(
                {
                    "from_state": cursor_state,
                    "to_state": dummy_id,
                    # The original input triggers only the first hop; downstream
                    # hops are unconditional clocked walks.
                    "input": original_trans.get("input") if i == 1 else None,
                    "output": (
                        original_trans.get("output") if fsm_type == "mealy" else None
                    ),
                    "is_dummy_transition": True,
                }
            )
            cursor_state = dummy_id

        # Final hop into the real destination state.
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
        """Compute the output value written to a dummy state.

        Moore: use the source output on all but the last dummy on the
        chain, which emits the destination output. This keeps the visible
        output stable until the final one-cycle switch.

        Mealy: dummies get "X" (don't-care); Mealy output is a function
        of the transition, not the state.
        """
        if fsm_type == "moore":
            source = to_state if is_last_hop_before_dest else from_state
            return state_outputs.get(source, "0")
        return "X"
