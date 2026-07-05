# Algorithms — Presenter Prep

Deep reference for the four optimization algorithms shipped in
`backend/app/core/algorithms/`. Written for someone about to defend the
design against cross-questions. Every non-obvious claim has a code
reference. Complexity is derived, not asserted. Discrepancies between
what the code does and what the metadata in
`backend/app/core/algorithms/__init__.py` claims are called out
explicitly (see the "Discrepancies" callouts throughout, and section 9).

Table of contents:

1. Preliminaries — the math you must be able to reproduce at the board
2. Algorithm 1: Greedy dummy-state insertion (`greedy`)
3. Algorithm 2: BFS-optimal dummy insertion (`bfs_optimal`)
4. Algorithm 3: Simulated Annealing (`global_sa` / `simulated_annealing`)
5. Algorithm 4: Genetic Algorithm (`global_ga`)
6. Cross-algorithm comparison
7. How results are persisted and displayed
8. Common cross-questions (Q&A)
9. Discrepancy log (code vs. metadata / claims)

---

## 1. Preliminaries

### 1.1 Gray code — the reflected binary construction

A **binary Gray code of length k** is an ordering of all `2^k` binary
strings such that consecutive strings differ in exactly one bit. The
reflected binary construction gives a closed form:

```
G(n) = n XOR (n >> 1)
```

Proof sketch (that consecutive `G(n)` and `G(n+1)` differ by one bit):

```
G(n)   = n     XOR (n >> 1)
G(n+1) = (n+1) XOR ((n+1) >> 1)
G(n) XOR G(n+1) = (n XOR (n+1)) XOR ((n >> 1) XOR ((n+1) >> 1))
```

If `n` ends in a run of `t` ones followed by a zero at position `t`,
then `n XOR (n+1)` is `2^(t+1) - 1` (flip all bits up to and including
position `t`). Right-shifted by one, `(n >> 1) XOR ((n+1) >> 1)` is
`2^t - 1` (same run, shifted). XOR of those two is exactly `2^t`, i.e.
a single bit at position `t`. So `HD(G(n), G(n+1)) = 1`. QED.

Implementation lives at `backend/app/core/gray_code.py:6-22`:

```python
def int_to_gray(n: int, bit_width: int) -> str:
    gray = n ^ (n >> 1)
    return format(gray, f"0{bit_width}b")
```

`generate_gray_codes(bit_width)` (`backend/app/core/gray_code.py:43-58`)
just calls `int_to_gray` for `0 <= n < 2^bit_width`. For `k=2` it
returns `['00', '01', '11', '10']` — the 4-cycle around the 2D
hypercube, in Gray order.

### 1.2 Hamming distance

For two equal-length binary strings `a`, `b`:

```
HD(a, b) = popcount(a XOR b) = sum(a_i != b_i for i in range(k))
```

Reference implementation at `backend/app/core/gray_code.py:61-75`:

```python
def hamming_distance(code1: str, code2: str) -> int:
    if len(code1) != len(code2):
        raise ValueError("Codes must have same length")
    return sum(b1 != b2 for b1, b2 in zip(code1, code2, strict=False))
```

That character-wise comparison is O(k). For hot paths a `popcount` on
the XOR-of-integers form would be one instruction, but the strings we
store are already the wire format the DB serializes, and O(k) with
`k <= 8` for realistic FSMs is not the bottleneck. The bottleneck is
computing HD across all transitions, once per SA iteration (see §4).

### 1.3 The optimization problem — formal statement

Let an FSM be a tuple `M = (S, Sigma, delta, s0, Y, lambda)` where:

- `S = {s_1, ..., s_N}` — finite state set
- `Sigma` — input alphabet
- `delta: S x Sigma -> S` — transition function
- `s_0 in S` — initial state
- `Y` — output alphabet
- `lambda: S -> Y` (Moore) or `lambda: S x Sigma -> Y` (Mealy)

Let `k = ceil(log2(N))` be the state-register bit-width. Define the set
of transitions actually exercised in the FSM as `T = {(s_i, sigma, s_j) :
delta(s_i, sigma) = s_j}` — this is what the code iterates over
(`backend/app/services/optimization_service.py:266-271`, feeding
`definition["transitions"]` into the optimizer).

An **encoding** is an injection `enc: S -> {0,1}^k`. The
naive **encoding-only** optimization problem is:

```
min_{enc}  sum_{(s_i, sigma, s_j) in T}  HD(enc(s_i), enc(s_j))
subject to: enc is injective
```

That is what `global_sa` and `global_ga` solve directly. But GrayFSM's
primary optimization has a different objective, because in real
hardware two constraints bite:

**Constraint A — bit-width is fixed by the register width.** You cannot
usually just "add another bit" to the state register mid-project;
that changes downstream RTL, timing, and area budget.

**Constraint B — even the optimal encoding may leave HD > 1 edges.**
As soon as `|T| > k * 2^k / 2` (edge count of the k-hypercube), by
pigeonhole some transition must have HD >= 2. Example in §1.5 below.

So the problem GrayFSM actually solves is:

```
Given an FSM M with initial encoding enc_0 and fixed bit-width k,
produce an equivalent FSM M' with transition set T' such that
    for every (u, sigma, v) in T':  HD(enc'(u), enc'(v)) = 1
and (T' - T) consists only of transitions to/from dummy states that
preserve the observable behaviour of M.
```

Minimizing the number of dummy states inserted is the *secondary*
objective; correctness of behaviour is the *primary* one.

### 1.4 What a "dummy state" is, in FSM semantics

A **dummy state** is a state added between two real states along a
transition whose HD was > 1, so that each hop in the expanded path has
HD = 1. Its output is chosen so that no external observer can tell the
FSM is passing through the dummy:

- **Moore machines** — a dummy that sits at position `i` in a path of
  length `L` (`0 = source`, `L = target`) emits the source state's
  output for `i < L-1`, and the target state's output for `i = L-1`
  (`greedy.py:121-126`):

  ```python
  if fsm_type == "moore":
      if i < len(path) - 2:
          dummy_output = outputs.get(from_state, "0")
      else:
          dummy_output = outputs.get(to_state, "0")
  ```

  The intuition: an observer polls the Moore output each clock cycle.
  If we keep emitting the source output right up to the last hop, the
  observed output changes on exactly the cycle the original FSM would
  have moved to `to_state`, and matches its output value from that
  cycle onwards. Net effect: the observer sees the same output trace,
  but a purely single-bit transition history on the state register.

- **Mealy machines** — the dummy's output is `"X"` (don't-care)
  because Mealy outputs are edge-triggered by input, not state
  (`greedy.py:128`: `dummy_output = "X"`). The intermediate transitions
  are synthesized with `input=None, output=None` (`greedy.py:142-145`,
  `greedy.py:154-155`), meaning they fire on the internal clock without
  an external input event. In synthesis this becomes an unconditional
  fanout edge from the dummy to its successor.

Note that the algorithm treats these fanout edges as first-class
`new_trans` dicts with `is_dummy_transition: True`
(`greedy.py:144, 156`), so downstream code — exporters, radar / metric
computation, the graph visualizer — can filter or highlight them.

### 1.5 Why we do not just widen the register

The immediate reaction is: if HD > 1 is the problem, add one more bit
so that we have `2^(k+1)` codes instead of `2^k`, spread the states out
in the enlarged hypercube, and choose an encoding where every
transition is HD = 1.

Two reasons this is not enough:

1. **The register width is a hard external constraint.** A GrayFSM
   optimization pass runs against an FSM with an already-committed
   `bit_width`. That column is stamped on the row
   (`backend/app/services/optimization_service.py:262`:
   `optimizer = algorithm_cls(original_fsm.bit_width)`). Widening the
   register would be a schema change, not a re-encoding.

2. **Even with slack in the encoding, HD >= 2 edges may be
   unavoidable.** Consider N=4 states in k=2 bits (the vending machine
   in §2.5). The 2D hypercube has only 4 undirected edges. The vending
   machine has 6 transitions. By pigeonhole, at least 6 - 4 = 2
   transitions cannot be hypercube-edges regardless of encoding, so
   have HD >= 2.

   Formal statement of the general bound: if the transition graph has
   `|T|` distinct edges and the k-hypercube has `k * 2^(k-1)`
   undirected edges, then `|T| - k * 2^(k-1)` transitions must have
   HD >= 2 no matter which encoding you pick.

Dummies are the only mechanism that unconditionally satisfies the
adjacency invariant under fixed `k`.

---

## 2. Algorithm 1: Greedy Dummy-State Insertion (`greedy`)

Code: `backend/app/core/algorithms/greedy.py` (161 lines).
Registry entry: `backend/app/core/algorithms/__init__.py:18` maps
`"greedy"` to `GreedyOptimizer`.

### 2.1 What it does

For each transition `(u, sigma, v)`:

1. Compute `d = HD(enc(u), enc(v))` (`greedy.py:74`).
2. If `d <= 1`, keep it (`greedy.py:76`).
3. If `d > 1`, ask the hypercube for a shortest path from `enc(u)` to
   `enc(v)`; insert `d - 1` dummy states along the intermediate codes,
   and wire them into a chain of HD-1 transitions
   (`greedy.py:79-88, 92-160`).

Each transition is handled in isolation — the algorithm never looks at
what dummies previous transitions created, and does no back-tracking.
This is the "greedy" part.

### 2.2 Pseudocode using real names from `greedy.py`

```
GreedyOptimizer.optimize_fsm(states, transitions, outputs, fsm_type):
    self.dummy_states = []
    self.dummy_counter = 0
    new_transitions = []
    for trans in transitions:
        u, v = trans["from_state"], trans["to_state"]
        eu, ev = states[u], states[v]        # encoding lookup
        if hamming_distance(eu, ev) <= 1:
            new_transitions.append(trans)    # nothing to fix
        else:
            new_transitions.extend(
                self._insert_dummy_states(u, v, eu, ev, trans, outputs, fsm_type)
            )
    return self.dummy_states, new_transitions

_insert_dummy_states(u, v, eu, ev, trans, outputs, fsm_type):
    path = self.hypercube.shortest_path(eu, ev)   # BFS on 2^k-vertex graph
    current_state = u
    for i, code in enumerate(path[1:-1], start=1):
        dummy_id = f"DUMMY_{counter}_{u}_to_{v}"
        dummy_output = pick_moore_or_mealy_output(...)   # see §1.4
        self.dummy_states.append(DummyState(dummy_id, code, dummy_output, ...))
        new_transitions.append({
            "from_state": current_state,
            "to_state":   dummy_id,
            "input":      trans["input"] if i == 1 else None,
            "output":     trans["output"] if fsm_type == "mealy" else None,
            "is_dummy_transition": True,
        })
        current_state = dummy_id
    new_transitions.append({           # final hop to v
        "from_state": current_state,
        "to_state":   v,
        "input":      None,
        "output":     None,
        "is_dummy_transition": True,
    })
    return new_transitions
```

Two things to notice:

- The **input character is only preserved on the first hop of the
  expanded chain** (`greedy.py:142`:
  `"input": original_trans.get("input") if i == 1 else None`). The
  intermediate hops are unconditional. Under Moore semantics, this is
  fine — the state-register clock advances once per cycle and the
  input is what caused the original edge to fire; subsequent hops
  are internal, and the observer sees the correct output trace
  because of the Moore output rule in §1.4.

- The **final hop is a separate append** after the loop
  (`greedy.py:151-158`). This is why the number of transitions
  produced for a HD = d edge is exactly `d` (`d-1` intermediate hops
  plus one final hop), and the number of new dummies is `d - 1`.

### 2.3 Bit-flip path selection — which bit does it flip first?

The greedy algorithm does not choose bit positions — it delegates
entirely to `self.hypercube.shortest_path(eu, ev)`
(`greedy.py:109`), which in turn calls `nx.shortest_path`
(`backend/app/core/hypercube.py:78`):

```python
try:
    path: list[str] = nx.shortest_path(self.graph, start_code, end_code)
    return path
```

NetworkX's default `shortest_path` on an unweighted graph is BFS. On a
k-hypercube every shortest path between codes at distance `d` has
length `d + 1` (nodes), and there are exactly `d!` distinct shortest
paths (permutations of the differing bit positions). Which one BFS
returns depends on adjacency-list ordering, and adjacency lists are
built in `HypercubeGraph._build_hypercube`
(`backend/app/core/hypercube.py:33-55`) by scanning codes in
Gray-code order and, for each, flipping bit positions `0` through
`k-1`. So the neighbor scan order at any node is deterministic and
biased toward flipping low-index bits first, which is why greedy
tends to produce dummy encodings that differ from the source in the
lower bits before the higher ones. This is worth knowing when a
reviewer asks "why did the algorithm pick this particular chain of
dummies and not the mirror-image one?" — the answer is Python
dictionary insertion order into NetworkX, not any design choice.

### 2.4 Correctness

**Claim.** After `optimize_fsm` returns, every transition in
`new_transitions` has HD = 1 between the encodings of its endpoints.

**Proof.** Two cases per input transition `t`:

1. `HD(enc(u), enc(v)) <= 1`. Then `t` is appended unchanged
   (`greedy.py:76`) and already satisfies the invariant. The `<= 1`
   case includes self-loops (HD = 0), which technically violate the
   "= 1" invariant but are harmless because they don't correspond to
   a state-register bit-flip at all. Downstream, self-loops are
   filtered from the SA cost function
   (`simulated_annealing.py:135-136`:
   `if from_state == to_state: continue`).

2. `HD(enc(u), enc(v)) = d > 1`. The hypercube gives a path
   `[eu = c_0, c_1, ..., c_d = ev]` with `HD(c_i, c_{i+1}) = 1` for
   all `i` (guaranteed by hypercube edge definition,
   `hypercube.py:44-53`). The chain of transitions produced is
   `u -> dummy_1, dummy_1 -> dummy_2, ..., dummy_{d-1} -> v` with
   encodings `c_0 -> c_1, c_1 -> c_2, ..., c_{d-1} -> c_d`. Each hop
   has HD = 1. QED.

An important **caveat not enforced by the code**: nothing checks that
the intermediate encoding `c_i` is distinct from the encoding of an
existing state. In a "tight" encoding — every code in `{0,1}^k` is
already assigned to a real state — a dummy will silently *collide* on
encoding with some real state. This produces an FSM whose state
register cannot distinguish the two, which is semantically broken.
See §2.5 for a concrete example and §8 Q&A for the mitigation
strategy.

### 2.5 Worked example — vending machine (`backend/examples/vending_machine.json`)

The FSM has 4 states, `bit_width = ceil(log2(4)) = 2`, 6 transitions.
Initial encoding is Gray-order:

| state    | Gray code |
|----------|-----------|
| S0_0c    | 00        |
| S1_5c    | 01        |
| S2_10c   | 11        |
| S3_15c   | 10        |

(Assignment produced by
`OptimizationService._assign_gray_encodings`,
`optimization_service.py:432-444`, iterating states in list order and
handing out Gray codes.)

Transition table with pre-optimization Hamming distances:

| # | from → to           | encodings   | HD |
|---|---------------------|-------------|----|
| 1 | S0_0c → S1_5c       | 00 → 01     | 1  |
| 2 | S0_0c → S2_10c      | 00 → 11     | 2  |
| 3 | S1_5c → S2_10c      | 01 → 11     | 1  |
| 4 | S1_5c → S3_15c      | 01 → 10     | 2  |
| 5 | S2_10c → S3_15c     | 11 → 10     | 1  |
| 6 | S3_15c → S0_0c      | 10 → 00     | 1  |

Sum of HDs = 8, max = 2, average = 8 / 6 ≈ 1.333. This matches what
`OptimizationService._calculate_avg_hamming` /
`_calculate_max_hamming` compute over the pre-encodings
(`optimization_service.py:146-147`).

Greedy processes transition 2 first that has HD > 1
(`S0_0c → S2_10c`, `00 → 11`). `hypercube.shortest_path("00","11")`
returns `["00","01","11"]` — because in
`_build_hypercube` (`hypercube.py:33-55`) the code `"00"` is
processed with bit-flip order 0,1 which adds edges `00-01` before
`00-10`, so BFS discovers `01` first. `path[1:-1] = ["01"]`. One
dummy is created with encoding `"01"`.

Now transition 4 (`S1_5c → S3_15c`, `01 → 10`).
`hypercube.shortest_path("01","10")` returns `["01","00","10"]` by
similar edge-order reasoning. `path[1:-1] = ["00"]`. One more dummy
with encoding `"00"`.

Final dummy count: 2. Final state count: 6. New Hamming stats: every
transition in `new_transitions` has HD = 1, so `avg_after = 1.0`,
`max_after = 1`. Improvement percentage
(`optimization_service.py:75-78`): `((1.333 - 1.0) / 1.333) * 100 =
25%`.

**The collision problem, made concrete.** The dummy inserted for
transition 2 has encoding `01`, which is *also* the encoding of
`S1_5c`. In a physically synthesized register, no observer can tell
`DUMMY_0_S0_0c_to_S2_10c` from `S1_5c` — they share the same
register value. This is why in production one would either:

- widen the register from `k` to `k+1` before optimization, giving
  room for dummies; or
- ensure at least one `{0,1}^k` code is free (i.e. use at most
  `2^k - 1` real states out of `2^k`).

The current code does not enforce either — it is the caller's
responsibility. Flag this at review time.

### 2.6 Complexity — derivation, not label

**Time.** Per transition:

- HD computation: O(k) (character-wise loop in
  `gray_code.py:75`).
- If HD > 1, `hypercube.shortest_path` calls
  `nx.shortest_path`, which for an unweighted undirected graph runs
  BFS from source until the target is dequeued. Worst case: it must
  scan every one of the `2^k` vertices and their `k` neighbors, so
  O(k * 2^k) = O(N * log N) using `N = 2^k`, `k = log N`. In practice
  BFS terminates as soon as it reaches `enc(v)`, which is at
  distance `d <= k`, so the level-by-level expansion visits at most
  `sum_{i=0}^{d} k choose i` vertices — dominated by the last level
  with `k choose d` <= `2^k`. Path reconstruction is O(d) = O(k).
- Dummy creation + transition append: O(d) per transition (up to `k`
  dummies).

Sum over `|T|` transitions, worst case:

```
Total time = O(|T| * k * 2^k) = O(|T| * N * log N)
```

**Space.** Hypercube storage is one-off: O(k * 2^k) edges =
O(N log N). Dummies produced: at most `|T| * (k - 1)`, so
O(|T| * k).

**Reconcile with metadata claim `O(T * log(N))`
(`__init__.py:31`).** The metadata's derivation assumes we
walk a *specific* bit-flip path in O(k) time per transition,
not that we run BFS on the whole 2^k-vertex hypercube per call.
That is achievable — you can compute `enc(u) XOR enc(v)`, iterate
its set bits, and toggle them one at a time — and would give
O(|T| * k) = O(|T| * log N). The **implementation** does BFS via
NetworkX, so the empirical complexity is higher by a factor of up to
`2^k / k`. For `k = 3` (8 states) that is a factor of 2, negligible;
for `k = 8` (256 states) it is 32x. This is worth investigating as a
performance issue if you ever benchmark on N in the hundreds. See
Discrepancy Log §9.1.

### 2.7 Locality — why greedy is "locally optimal, not globally"

Greedy commits to the first BFS-returned path per transition
(`greedy.py:109`). Two consequences:

1. **No inter-transition sharing.** If transitions
   `u -> v` and `u' -> v'` both pass through encoding `c*` in the
   hypercube, greedy allocates two distinct dummy nodes, both with
   encoding `c*`. A globally-aware algorithm could merge them into
   one dummy state serving both edges.

2. **Path choice is greedy — no lookahead.** Even for a single
   transition, when multiple shortest paths exist (any transition with
   HD >= 2 has `d!` of them), greedy takes whichever adjacency-list
   ordering handed it. It has no criterion for preferring one that
   would create a code that could be *reused* by a later transition.

BFS-Optimal (§3) is designed to fix (2) at least in principle. The
sharing gap in (1) is what a truly global algorithm — SA (§4) or GA
(§5) — attacks from a different direction.

---

## 3. Algorithm 2: BFS-Optimal Dummy Insertion (`bfs_optimal`)

Code: `backend/app/core/algorithms/bfs_optimal.py` (50 lines).
Registry entry: `__init__.py:19`.

### 3.1 What it is *supposed* to do

Per the metadata (`__init__.py:34-38`):

> BFS-Optimized Dummy State Insertion — Uses BFS with smart encoding
> reuse to minimize total dummy states across all transitions.

The intended improvements over greedy:

- **Encoding reuse.** Track the set `used_encodings` of codes already
  claimed by real states or by dummies from earlier transitions.
  When multiple shortest paths exist, prefer the one whose
  intermediate codes are already `in used_encodings` — that way the
  dummy can *share* its code with an existing node instead of
  spawning a new one.
- **Conflict avoidance.** Symmetric to the above: avoid picking
  intermediate codes that already belong to a *real* state, to
  prevent the collision problem described in §2.5.

### 3.2 What it *actually* does

```python
class BFSOptimizer(GreedyOptimizer):
    def __init__(self, bit_width: int):
        super().__init__(bit_width)
        self.used_encodings: set[str] = set()

    def optimize_fsm(self, states, transitions, outputs, fsm_type):
        self.used_encodings = set(states.values())
        return super().optimize_fsm(states, transitions, outputs, fsm_type)

    def _find_best_path(self, from_code: str, to_code: str) -> list[str]:
        all_paths = self.hypercube.shortest_path(from_code, to_code)
        # Could be extended to prefer paths through used codes
        # to maximize code reuse
        return all_paths
```

Two facts to internalize:

1. `BFSOptimizer` overrides only `__init__` and adds `_find_best_path`
   plus a `used_encodings` tracker.
2. **`_find_best_path` is never called from anywhere.** The parent
   `GreedyOptimizer._insert_dummy_states` calls
   `self.hypercube.shortest_path(from_code, to_code)` directly
   (`greedy.py:109`). It does not consult `_find_best_path` on the
   subclass. And `_find_best_path` itself is just a wrapper around
   `self.hypercube.shortest_path` with a `# Could be extended` comment.

**So today, `BFSOptimizer` behaves *identically* to `GreedyOptimizer`.**
The only observable difference is that `bfs_optimal` initializes
`self.used_encodings` and never reads it. This is a Discrepancy —
see §9.2.

The algorithm as a design is well-formed, but the implementation is
a stub. In a demo run against `vending_machine.json`, `greedy` and
`bfs_optimal` produce identical dummies, identical Hamming metrics,
and identical improvement percentages.

### 3.3 Complexity — the design's, and today's

**As designed** (with actual reuse and multi-path exploration): a
proper BFS in encoding space that considers reuse would still visit
O(k * 2^k) nodes per source, so O(|T| * k * 2^k) = O(|T| * N log N)
worst case. The `__init__.py:38` metadata claims `O(T * N)`, which
matches this up to the `log N` (`= k`) factor.

**As implemented today** (delegating to `hypercube.shortest_path`):
identical to greedy — O(|T| * k * 2^k) — because it *is* greedy at
runtime.

Space: same as greedy plus O(|encodings|) for the `used_encodings`
set (which is populated but not consulted).

### 3.4 Why "BFS optimal" would be optimal (if implemented)

Given the fixed encoding and fixed bit-width, the minimum number of
dummies for transition `t` is exactly `HD(t) - 1`. This lower bound
is achieved by any shortest hypercube path. So on a per-transition
basis, both greedy and BFS are already optimal. What "BFS-optimal"
adds — and what makes it globally optimal under fixed encoding —
is *sharing dummies across transitions*: if two transitions'
shortest-path spaces both contain an intermediate code `c`, one
dummy node with encoding `c` can service both, cutting the total
count.

**Formal statement of the min-sharing benefit.** Let `P(t)` denote
the set of all shortest-path intermediate encodings for transition
`t`. The minimum total dummy count is:

```
min_{sel: t -> path in P(t)}  | union over t of (sel(t)'s intermediate codes) |
```

This is a set-cover-like problem — NP-hard in general — but on the
hypercube with small `k` it is tractable. The metadata's claim of
"minimum total dummy states" (`__init__.py:36`) implicitly refers
to this minimum-cover formulation.

Today's stub does not compute the union; it recomputes each path
independently, so no sharing occurs.

### 3.5 Worked example — vending machine, revisited

With `bfs_optimal` behaving as greedy today, the vending machine
run produces the same 2 dummies with encodings `01` and `00`. No
sharing happens. If reuse were implemented, we might observe:

- Transition 2 (`00 -> 11`) has two shortest paths:
  `00 -> 01 -> 11` and `00 -> 10 -> 11`. Intermediate options: `{01,
  10}`.
- Transition 4 (`01 -> 10`) has two shortest paths:
  `01 -> 00 -> 10` and `01 -> 11 -> 10`. Intermediate options: `{00,
  11}`.

The two option-sets are disjoint (`{01, 10} intersect {00, 11} =
{}`), so no cross-transition sharing is possible for this FSM. Both
transitions need one fresh dummy each — greedy is already optimal.
This is a good case to point out under cross-questioning: "BFS is
provably >= greedy, but on small FSMs the two often tie".

---

## 4. Algorithm 3: Simulated Annealing (`global_sa` / `simulated_annealing`)

Code: `backend/app/core/algorithms/simulated_annealing.py` (258
lines). Registry entries:

- `simulated_annealing` -> `SimulatedAnnealingOptimizer`
  (`__init__.py:20`)
- `global_sa`           -> `SimulatedAnnealingOptimizer`
  (`__init__.py:21`)

**Both names map to the same class.** The user-facing distinction is
in the descriptions in `ALGORITHM_INFO` (`__init__.py:39-58`) — they
suggest `simulated_annealing` is the "encoding + dummies" flow and
`global_sa` is "encoding-only optimization" — but the class handles
both identically via `optimize_fsm` (which does encoding SA then
dummy insertion, `simulated_annealing.py:80-111`) and
`optimize_encoding_only` (SA only, `simulated_annealing.py:235-257`).
Which method the caller invokes determines the behaviour, not which
registry alias they picked. See Discrepancy §9.3.

### 4.1 What it does

Two phases:

1. **Encoding reassignment via SA.** Search for an injection
   `enc: S -> {0,1}^k` that minimizes total transition Hamming cost
   (`simulated_annealing.py:117-142` — the cost function;
   `144-229` — the anneal loop). Move: swap the encodings of two
   randomly-chosen distinct states.
2. **Dummy insertion via greedy pass.** Hand the improved encoding
   assignment to `super().optimize_fsm(...)`
   (`simulated_annealing.py:111`), which is `GreedyOptimizer` and
   handles residual HD > 1 transitions exactly as in §2.

The class inherits from `GreedyOptimizer` (`simulated_annealing.py:27`)
purely for this composition — SA reuses greedy's dummy machinery
rather than duplicating it. Because greedy is per-transition
optimal (§3.4), phase 2 introduces no unnecessary dummies.

### 4.2 The move — swap two encodings

```python
i, j = self._rng.sample(range(n_states), 2)
s1, s2 = state_ids[i], state_ids[j]
current[s1], current[s2] = current[s2], current[s1]  # in-place swap
neighbour_cost = self._compute_cost(current, transitions)
delta = neighbour_cost - current_cost
```

(`simulated_annealing.py:188-196`.)

Two implementation nuances:

- **In-place swap, not dict copy.** `current[s1], current[s2] =
  current[s2], current[s1]` mutates the working assignment. If the
  move is rejected, the swap is undone by swapping back
  (`simulated_annealing.py:212`). This avoids `dict(current)` per
  iteration — a real performance win: at 10,000 iterations on an
  8-state FSM, that saves ~10 microseconds each, ~0.1 second total.
- **Both indices are guaranteed distinct.** `random.sample(range,
  2)` samples without replacement.

The swap preserves the injection invariant automatically: if
`current` was a valid permutation before the swap, it is after.

### 4.3 The cost function

```python
def _compute_cost(self, assignment, transitions) -> float:
    total = 0
    for trans in transitions:
        u, v = trans.get("from_state"), trans.get("to_state")
        if not isinstance(u, str) or not isinstance(v, str):
            continue
        if u == v:
            continue                          # self-loops skipped
        enc_u, enc_v = assignment.get(u), assignment.get(v)
        if enc_u is None or enc_v is None:
            continue                          # missing state skipped
        total += hamming_distance(enc_u, enc_v)
    return float(total)
```

(`simulated_annealing.py:117-142`.)

Cost is exactly `sum over t in T of HD(enc(u_t), enc(v_t))` — total
transition Hamming distance. Self-loops contribute 0, so filtering
them out doesn't change the sum but avoids a redundant call. If a
transition references an unknown state (defensive against malformed
input), it is silently skipped. `float` for compatibility with the
`math.exp` acceptance rule.

Complexity: one pass over `|T|` transitions, each with an O(k)
HD call. Per iteration: O(|T| * k).

### 4.4 Acceptance rule — Boltzmann

```
if delta < 0:
    accept                       # improvement, always
else:
    p = exp(-delta / temperature)
    if uniform(0, 1) < p:
        accept
    else:
        reject and undo swap
```

(`simulated_annealing.py:199-212`.)

Why `exp(-delta / T)`?

- At **high T**, `-delta / T` is close to 0, so `exp(-delta / T)`
  is close to 1 — most bad moves are accepted. The walk explores.
- At **low T**, `-delta / T` is very negative, so `exp(-delta / T)`
  is close to 0 — bad moves rejected almost always. The walk
  descents-only.
- The exponential shape is the Metropolis criterion, chosen so that
  in the limit `T -> 0` with an infinitely-slow cooling schedule
  and infinite iterations, the walk visits states with frequency
  proportional to `exp(-cost / T)` (the Boltzmann distribution).
  Concentrating on `T -> 0` puts all mass on the global minimum.

There is one edge case handled: `math.exp` overflow when
`delta / temperature` is very large. The code catches `OverflowError`
and sets `prob = 0.0` (`simulated_annealing.py:205-207`) — the move
is rejected. In Python this is rare because `math.exp(-1000)` is
`~5e-435`, a valid float underflow to zero; overflow would need
`delta / T` sufficiently negative that `exp(+huge)` overflows, which
would mean `delta < 0` — but that branch never hits `math.exp` in
the first place. Belt-and-braces defense.

### 4.5 Cooling schedule and termination — exact numbers

Class defaults (`simulated_annealing.py:45-48`):

- `initial_temp = 100.0`
- `cooling_rate = 0.995`
- `min_temp = 0.01`
- `max_iterations = 10000`

Cooling is multiplicative:

```
T <- T * cooling_rate         (simulated_annealing.py:220)
```

Number of iterations to cool from `T0` to `T_min` under multiplicative
cooling: solve `T0 * r^n = T_min` for `n`:

```
n = log(T_min / T0) / log(r) = log(0.01 / 100) / log(0.995)
  = log(1e-4) / log(0.995)
  = (-9.2103) / (-0.005013)
  = 1837 iterations
```

So temperature-based termination fires at ~1,837 iterations. But
`max_iterations = 10000` bounds the loop above that
(`simulated_annealing.py:186`:
`while temperature > self.min_temp and iteration < self.max_iterations`),
so under defaults the loop always ends at the temperature floor and
`max_iterations` acts as a safety net only.

There is no explicit "K consecutive rejections" termination criterion.
If you get asked about early stopping, the answer is: none is
implemented. Only the two AND-conditions above.

Also note: the loop short-circuits if `initial_cost == 0.0`
(`simulated_annealing.py:180-184`) — nothing to optimize.

### 4.6 Complexity — derivation

Per iteration:

- Sample two indices: O(1).
- Swap two dict entries: O(1).
- `_compute_cost`: full pass over transitions, O(|T| * k).
- Boltzmann probability + RNG: O(1).
- Possibly copy `current` to `best` on improvement:
  `best = dict(current)`, O(|S|) — but this happens only on
  improvement, which is bounded in total by the number of distinct
  cost levels (an integer between 0 and `|T| * k`), so it does not
  affect asymptotics.

Total iterations: `I = min(max_iterations, iters_to_min_temp)`.

```
Total time = O(I * |T| * k) = O(I * |T| * log N)
```

Metadata (`__init__.py:48`) says `O(I * T)`, dropping the `k` factor
— fine for small `k`, technically an underestimate of `O(I * T *
log N)`.

Space: O(|S|) for the working / best assignments, plus greedy's
post-pass space (§2.6).

### 4.7 Global convergence — the honest version

The textbook theorem (Hajek, 1988): SA with logarithmic cooling
schedule `T_n = c / log(n + n0)` (for a large enough `c`) converges
to the global optimum with probability 1. The geometric schedule
`T_n = T_0 * r^n` used here does **not** satisfy Hajek's conditions;
it is a **fast anneal** that trades convergence proof for practical
runtime. It typically finds a good-quality local minimum, not the
global one.

The right way to describe this under pressure:

> Under a slow-enough cooling schedule and infinite iterations, SA
> is provably globally optimal. In practice we run a fixed budget
> with geometric cooling, so we get a local optimum that's usually
> much better than the initial encoding but has no worst-case
> guarantee.

The diagnostics `iterations_run`, `initial_cost`, `final_cost`,
`improvement_ratio` (`simulated_annealing.py:69-72`) are exposed so
you can *empirically* argue quality even without a theoretical
bound.

### 4.8 Worked example (sketch) — 8-state FSM

Consider an 8-state FSM with `k = 3` and 12 transitions. The
encoding space has `8! = 40320` distinct injections into
`{0,1}^3` — small enough for brute force verification but large
enough that SA is meaningful.

Suppose the initial Gray encoding yields total cost 20. SA at
`T0 = 100`, `r = 0.995`, `T_min = 0.01`:

- Iterations 0-100 (T ≈ 100 -> 60): most moves accepted regardless
  of delta. Walk covers many basins, cost oscillates in the 15-25
  range.
- Iterations 100-500 (T ≈ 60 -> 8): `delta = +1` accepted with
  probability `exp(-1/T)` — at T=10 that's 90%; at T=1 that's 37%.
  Walk narrows.
- Iterations 500-1500 (T ≈ 8 -> 0.05): mostly downhill; converges
  on a locally-good encoding.
- Iterations 1500-1837 (T ≈ 0.05 -> 0.01): almost pure descent;
  refinement.

The `best` assignment is captured every time `current_cost <
best_cost` (`simulated_annealing.py:215-217`), so the returned
result is the *best-ever*, not the *final*.

After SA, greedy runs on the improved assignment. If SA reduced the
sum of HDs but some transitions still have HD > 1, greedy inserts
dummies for exactly those. Improvement % is computed against the
initial `avg_before`, so both the encoding improvement and the
dummies-not-needed contribute.

---

## 5. Algorithm 4: Genetic Algorithm (`global_ga`)

Code: `backend/app/core/algorithms/genetic_algorithm.py` (227 lines).
Registry entry: `__init__.py:22`.

### 5.1 What it does

Evolves a population of encoding assignments (each a valid injection
`S -> {0,1}^k`) by tournament selection + order crossover + swap
mutation, elitism, generation-count termination. After the last
generation, hands the best assignment to the parent
`GreedyOptimizer.optimize_fsm` for dummy insertion — same pattern
as SA (`genetic_algorithm.py:75-80`).

### 5.2 Individual representation

Each individual is a `dict[str, str]` from state id to encoding
string. Together, `initial_states.values()` forms the fixed pool of
encodings, and each individual is a permutation of that pool over
the state ids (`genetic_algorithm.py:106-114`):

```python
def _random_individual(self, state_ids, codes):
    shuffled = list(codes)
    self._rng.shuffle(shuffled)
    return dict(zip(state_ids, shuffled, strict=True))
```

Note that if the initial encoding uses only `|S|` codes out of the
`2^k` available (which is the normal case), the algorithm never
considers assignments that use codes outside the initial pool. This
is a subtle limitation: if `|S| = 5` and `k = 3` (so `2^k = 8`),
three of the eight codes are "free" and might yield lower-HD
assignments, but GA never tries them. SA has the same limitation
(it swaps within the assigned codes only) — see Discrepancy §9.4.

### 5.3 Fitness function

Identical to SA's cost — total Hamming distance across transitions
(`genetic_algorithm.py:86-104`). Same self-loop / missing-state
filters. Lower is better.

### 5.4 Operators — real defaults

Defaults from `genetic_algorithm.py:40-44`:

- `population_size = 30`
- `generations = 200`
- `mutation_rate = 0.20`
- `elitism = 2`
- `tournament_size = 3`

**Tournament selection** (`genetic_algorithm.py:116-124`):

```python
def _tournament_select(self, population, fitnesses):
    k = min(self.tournament_size, len(population))
    contenders = self._rng.sample(range(len(population)), k)
    winner = min(contenders, key=lambda i: fitnesses[i])
    return population[winner]
```

Pick 3 random individuals, return the fittest. Selection pressure
scales with tournament size — larger `k` means the best few
individuals dominate mating faster, at the cost of diversity. `k=3`
is a moderate default; K&N recommend `k = 2` or `3` for most
problems.

**Order crossover (OX)** (`genetic_algorithm.py:126-156`):

```python
a, b = sorted(self._rng.sample(range(n), 2))
# Child inherits parent 1's encodings on state_ids[a..b]
for k in range(a, b+1):
    sid = state_ids[k]
    child[sid] = p1[sid]
    used.add(p1[sid])
# Fill remaining state_ids with parent 2's encoding order,
# skipping codes already used
p2_codes_in_order = [p2[sid] for sid in state_ids]
fill = iter(c for c in p2_codes_in_order if c not in used)
for k in range(n):
    sid = state_ids[k]
    if sid not in child:
        child[sid] = next(fill)
```

Why OX and not one-point crossover? One-point crossover would take
`p1[0..a]` and `p2[a..n]` verbatim, which almost always duplicates
some encodings and drops others — the child would not be an
injection. OX preserves permutation validity by construction: the
inherited slice contributes `b - a + 1` distinct codes; the fill
step yields the remaining `n - (b - a + 1)` codes from `p2` with
duplicates skipped. Because both parents are permutations of the
same code set, the fill sequence always has exactly the right
number of unused codes.

**Swap mutation** (`genetic_algorithm.py:158-167`):

```python
if self._rng.random() < self.mutation_rate and len(state_ids) >= 2:
    i, j = self._rng.sample(range(len(state_ids)), 2)
    s1, s2 = state_ids[i], state_ids[j]
    individual[s1], individual[s2] = individual[s2], individual[s1]
```

Same swap move as SA, applied stochastically per child.

**Elitism** (`genetic_algorithm.py:200-203`):

```python
ranked = sorted(range(len(population)), key=lambda i: fitnesses[i])
elitism = max(0, min(self.elitism, len(population)))
new_pop = [dict(population[ranked[i]]) for i in range(elitism)]
```

Top 2 (by default) are copied verbatim into the next generation.
Combined with GA's monotonicity through generations, this guarantees
`best_cost` is non-increasing.

**Warm start** (`genetic_algorithm.py:182-183`):

```python
if self.population_size > 0:
    population[0] = dict(initial_states)
```

The initial encoding is seeded as one individual. Combined with
elitism, this guarantees the returned encoding is never *worse* than
the caller's starting point — a nice invariant to be able to claim
under review.

### 5.5 Complexity — derivation

Per generation:

- Compute fitness for `P` individuals: O(P * |T| * k) — each fitness
  is one pass over all transitions.
- Sort by fitness for elitism: O(P log P).
- Fill remaining `P - elitism` slots. Each fill: two tournament
  picks (O(tournament_size) each = O(1)), one crossover (O(|S|)),
  one mutation (O(1)). Total: O((P - elitism) * |S|).

Dominant term per generation: O(P * |T| * k) if `|T| >= |S|`
(usually true), else O(P * |S|).

Over `G` generations:

```
Total time = O(G * P * |T| * k) = O(G * P * |T| * log N)
```

Metadata (`__init__.py:66`) says `O(G * P * T)`, dropping the `k`
factor — same underestimate as SA. Same reason: for small `k` the
constant hides.

Space: O(P * |S|) for the population (two copies during generation
step).

### 5.6 When GA beats SA

The intuition your reviewer will probe: SA is a **single trajectory**
through the search space; GA is `P` **parallel trajectories** that
recombine. Two implications:

1. GA is more robust to bad initial conditions. A single unlucky
   SA trajectory can settle into a poor local minimum. GA's
   population averages that out — the best individual after
   generation `g` is at least as good as the best of `P` independent
   trajectories after `g` iterations.
2. GA can jump across basins via crossover. If two parents are in
   different basins and each has "good genes" for some states,
   crossover can produce a child in a third basin better than
   either. SA's move space is single-swap only, so it cannot
   perform a coordinated multi-swap in one step.

Empirically GA tends to win over SA for larger state counts (say,
`|S| >= 16`) because the encoding search space grows factorially
(`|S|!`) and population parallelism helps cover it. For very small
FSMs (`|S| <= 8`), both usually find the global optimum and SA gets
there faster because its per-iteration work is smaller (single-swap
vs. full population).

### 5.7 Worked example (sketch) — encoding-space exploration

Take the vending machine (§2.5), `|S| = 4`, `k = 2`. The encoding
pool is `{00, 01, 11, 10}` (the initial Gray codes). GA:

- Generation 0: 30 individuals; individual 0 is the initial
  Gray encoding (warm start), 1-29 are random permutations.
  Fitnesses: initial cost = 8 (per §2.5); random permutations
  cluster around 8-12 (all four encodings are used, so total HD
  is determined by which states get "adjacent" codes).
- Generation 1: top 2 (elitism) carry over. 28 offspring from
  tournament + OX + swap-mutation. Many random permutations
  drift toward 8 or better.
- Generation ~50: best_cost stabilizes at the true minimum (which
  for the vending machine, by the pigeonhole argument in §1.5, is 8
  — you cannot do better than 6 hypercube-edge transitions of 6
  transitions total, but 2 must have HD >= 2, so minimum is
  4 * 1 + 2 * 2 = 8, same as the initial Gray encoding).
- Remaining generations: no improvement; loop terminates at
  `generations = 200`.

For this FSM, GA discovers that the initial Gray encoding is already
optimal (a nice property of Gray codes on cycle-graph FSMs). Greedy
post-pass then inserts the same 2 dummies as in §2.5. No net
improvement — a good honest example to admit that on small
FSMs "global" algorithms often tie with per-transition greedy.

---

## 6. Cross-algorithm comparison

| algorithm     | best-case time            | worst-case time                | avg. quality        | guarantees                        | when to prefer                                    |
|---------------|---------------------------|--------------------------------|---------------------|-----------------------------------|---------------------------------------------------|
| `greedy`      | O(T)  (all HD <= 1)       | O(T * k * 2^k) = O(T * N log N) | per-trans. optimal  | HD = 1 on every output edge       | when initial encoding is already near-Gray-order  |
| `bfs_optimal` | O(T) (behaves as greedy)  | O(T * k * 2^k) = O(T * N log N) | = greedy (stub)     | (design) minimum total dummy count | should behave the same as greedy today (see §9.2) |
| `global_sa`   | O(I) if initial cost = 0  | O(I * T * k)                    | local optimum       | best-ever tracked; monotonic best | mid-size FSMs (|S| in 8..32), needs one strong run |
| `global_ga`   | O(P * T) if best_cost = 0 | O(G * P * T * k)                | often global optimum on small |S| | elitism => monotonic best; warm start >= initial | large FSMs (|S| >= 16) or when SA gets stuck      |

Column notes:

- "per-trans. optimal" means each transition is fixed with the
  minimum dummies possible *given the encoding*. It does not mean
  global optimum across the whole FSM.
- All four end with the same dummy-insertion machinery
  (`GreedyOptimizer`), so all four produce an FSM where every
  transition has HD = 1. They differ only in *how many* dummies
  they need to get there.

---

## 7. How results are persisted and displayed

Location: `backend/app/services/optimization_service.py`
(499 lines). Public entry: `OptimizationService.optimize_fsm`
(`optimization_service.py:94-202`).

### 7.1 The high-level flow

1. **Cache check.** Key includes `fsm_id`, algorithm, and hash of
   options (`optimization_service.py:110-119`). Hit -> return
   cached response verbatim. Bypasses ownership check because
   cache is scoped by fsm_id and options were already validated on
   the write path.
2. **Load + ownership check.** `_load_fsm(fsm_id, user_id)`
   (`optimization_service.py:219-247`). Public/example FSMs may be
   optimized by anyone authenticated; owned FSMs require caller ==
   owner. NULL-`created_by` legacy rows stay unreachable unless
   marked public/example.
3. **Re-optimization block.** `if original_fsm.is_optimized: raise`
   (`optimization_service.py:129-134`). See §7.4 for why.
4. **Pre-optimization Gray encoding + metrics.**
   `_assign_gray_encodings` (line 145) and
   `_calculate_avg_hamming` / `_calculate_max_hamming` (lines 146-
   147) run *before* the algorithm so we can record
   `avg_hamming_before` even if the algorithm crashes.
5. **Run the algorithm.** `_run_algorithm`
   (`optimization_service.py:249-295`). On exception, records
   `AlgorithmResult(success=False)` and re-raises as
   `AlgorithmException`.
6. **Post-optimization metrics.** Same helpers, run against
   `outcome.transitions` and `outcome.encodings` — which now
   include the dummy states.
7. **Persist optimized FSM row + AlgorithmResult row.** Both
   staged, one commit
   (`optimization_service.py:167-181`).
8. **Build response + cache set + return.**

### 7.2 `_OptimizationOutcome` — the pure-value payload

`optimization_service.py:53-63`:

```python
@dataclass(frozen=True)
class _OptimizationOutcome:
    states_list: list[str]
    transitions: list[dict[str, Any]]
    outputs: dict[str, Any]
    encodings: dict[str, str]
    dummy_states: list
    execution_time_ms: int
```

`_build_outcome` (`optimization_service.py:297-323`) takes the
`(dummy_states, new_transitions)` tuple returned by any optimizer,
merges the dummies into `states_list` / `outputs` / `encodings`
alongside the originals. The merge is what turns per-algorithm
output (which is "just the changes") into a full FSM definition.

### 7.3 The `AlgorithmResult` row — what gets recorded

Assembled in `_record_attempt` (`optimization_service.py:375-405`):

- `original_fsm_id`, `optimized_fsm_id` — join keys.
- `algorithm`, `algorithm_version`, `algorithm_parameters` —
  reproducibility.
- `dummy_states_added = len(outcome.dummy_states)`.
- `total_states_final = len(outcome.states_list)`.
- `avg_hamming_before`, `avg_hamming_after` — rounded to 2 decimals.
- `max_hamming_before`, `max_hamming_after`.
- `encoding_map = dict(outcome.encodings)` — full state -> code
  mapping, including dummies.
- `improvement_percentage = round(metrics.improvement_pct, 2)`.
- `execution_time_ms`.
- `success = True`.

The reason for **snapshotting `encoding_map` and the full metric
tuple** rather than computing them on read: the Lab Report UI
regenerates the radar chart (uses `max`) and the hypercube view
(uses `encoding`) directly from these fields, so re-visiting a
past optimization is a pure DB read — no algorithm re-run. Comment
at `optimization_service.py:396-397`.

The `improvement_percentage` formula (`_MetricsBundle.improvement_pct`,
`optimization_service.py:74-78`):

```
((avg_before - avg_after) / avg_before) * 100
```

Note: this is *average* Hamming improvement, not *count of dummies
saved* or *max Hamming improvement*. A cross-questioner may ask
"why is improvement_percentage 25% when we added 2 dummy states?" —
the answer is: it measures how much lower the *average* transition
Hamming distance is after the pass, not the state-count change.

### 7.4 The re-optimization block — why it exists

`optimization_service.py:129-134`:

```python
if original_fsm.is_optimized:
    raise FSMValidationException(
        "This FSM is already an optimization result. Re-optimizing it "
        "would compound dummy states. Optimize the source FSM instead "
        "(use the Lab Report link to reach it).",
    )
```

The reasoning (documented in the comment at
`optimization_service.py:123-128`):

An optimized FSM's `states` list includes the `DUMMY_...` nodes
inserted by the previous run. If you re-optimize, the algorithm
treats those dummies as ordinary states with fixed encodings and
computes HDs against them. Any transition through a dummy chain
that happens to have HD > 1 (which can happen when the previous
pass's dummy encoding conflicts with a real state's encoding, per
§2.5) triggers *new* dummy insertion on top of the old dummies —
compounding.

Concretely: if the first pass turned a HD = 2 transition into
`u -> d1 -> v` (single new dummy), and the caller later re-runs
with a different algorithm, the new algorithm sees three
transitions (`u -> d1`, `d1 -> v`), and if either of those becomes
HD = 2 under some intermediate reassignment, more dummies get
inserted for *those* — pathologically producing a chain of chains.

Blocking re-optimization at the service layer is the simplest
mitigation. The `verify_ownership` path
(`optimization_service.py:204-215`) also reads `is_optimized`
upfront so the async task queue rejects re-optimization *before*
enqueueing.

The user-facing remedy pointed to in the error message is the "Lab
Report" button on the editor, which surfaces the source FSM id
(from `definition["original_fsm_id"]`,
`optimization_service.py:342`).

---

## 8. Common cross-questions

**Q1: Why not just use more bits and skip dummies entirely?**

Two reasons. First, `bit_width` is a fixed column on the FSM row —
widening it is a schema-level change, not a re-encoding. Second,
adding one bit doubles the encoding space but does not by itself
guarantee an encoding where every transition has HD = 1. That only
happens if the transition graph is a subgraph of the k+1 hypercube;
for cycle-graph or dense FSMs, even generous bit-widths leave HD > 1
edges that need dummies. See §1.5.

**Q2: How does BFS know when to reuse a dummy vs. make a new one?**

Today it doesn't — the reuse logic is a stub. `BFSOptimizer` inherits
`_insert_dummy_states` from `GreedyOptimizer` verbatim, which calls
`self.hypercube.shortest_path` directly and never consults
`_find_best_path` or `used_encodings`. Behaviorally, `bfs_optimal`
is identical to `greedy` today. The *design* is: track which
encodings are already in use (by real states or prior dummies),
prefer shortest-path candidates whose intermediate codes are in
that set, then attribute the same dummy id to both edges. See
Discrepancy §9.2.

**Q3: Why is `greedy` still in the registry if `bfs_optimal` is
provably better?**

Two answers. Practically, `bfs_optimal` is a stub — greedy is the
production per-transition-optimal algorithm we currently ship
(§3.2). Even if BFS-Optimal were fully implemented, greedy has
value: it is the simplest algorithm to reason about, so it's the
reference implementation reviewers can trace end-to-end. It also
serves as the base class for SA and GA (both inherit from
`GreedyOptimizer` for its dummy-insertion machinery), so it must
stay in the registry to keep those imports working.

**Q4: What's the intuition for SA's acceptance probability?**

`exp(-delta / T)` implements a soft threshold on the move quality
that tightens as temperature drops. At `T = infinity`, `p = 1` for
all deltas — the walk is a random walk. At `T = 0`, `p = 0` for
positive deltas — the walk is greedy descent. Everywhere in between,
larger deltas are exponentially less likely to be accepted. The
exponential shape (rather than linear or step) is what makes SA
converge to the Boltzmann distribution asymptotically, and why —
under a slow-enough cooling schedule — the walk provably concentrates
on the global optimum. In practice we use a geometric schedule that
converges much faster but forfeits the global-optimality proof;
we're satisfied with "much better than start" and empirically
track that via `improvement_ratio`.

**Q5: Why did we need to block re-optimization?**

The optimized FSM's state list contains DUMMY_ nodes. If a second
pass treats them as ordinary states, and any of them collide on
encoding with a real state (which happens when the previous pass ran
against a fully-encoded k-bit FSM — see §2.5 collision problem), the
second pass produces new dummies to bridge the collisions, on top of
the existing ones. Left unchecked, this can compound
arbitrarily — every pass adding dummies to satisfy adjacency
constraints introduced by the previous. Blocking re-optimization at
the service layer (`optimization_service.py:129-134`) is a
one-line prevention. The caller is told to target the source FSM
instead.

**Q6: How do you tell if a suggested encoding is actually valid?**

Three conditions:

1. **Injectivity:** no two states share an encoding.
   `_compute_cost` doesn't check this; it's a precondition
   established by starting from a valid permutation and only ever
   swapping (§4.2 and §5.4). If a bug produced a non-injective
   assignment, HDs would be computed correctly but the resulting
   register value would be ambiguous.
2. **Bit-width match:** every encoding is a string of length
   `bit_width`. Enforced upstream in `_assign_gray_encodings`
   (`optimization_service.py:437-443`); the SA/GA swaps preserve
   it because they never allocate new codes.
3. **Consistent with dummies:** after dummy insertion, no dummy
   shares an encoding with an existing state. This is *not*
   enforced today (§2.4 caveat). A production-grade validator
   would iterate `outcome.encodings` and check no code appears
   twice.

**Q7: What if the FSM has unreachable states?**

The optimizer treats unreachable states as any other state —
they're in the `states` dict, they get encodings, and they're
counted toward `|S|`. `_compute_cost` iterates *transitions*
(`simulated_annealing.py:130`), so unreachable states with no
outgoing transitions contribute 0 to cost and are effectively
ignored by SA/GA (any encoding is equally good for them). Greedy
dummy insertion also touches them only if they appear as
`from_state` or `to_state` of some transition. So reachability
is not enforced but does not corrupt results. If the caller cares,
they should prune unreachable states upstream before optimization.

**Q8: Why does GA's OX crossover use the state-id order, not the
encoding-pool order?**

Because the *permutation* being crossed over is "which encoding is
assigned to which state id," so the natural index-space is the
state-id list. OX's inherited slice is a contiguous *range of state
ids*, and the fill step walks *state ids in order* pulling
un-inherited codes from `p2` in the same state-id order
(`genetic_algorithm.py:150-155`). If you crossed over on the
encoding pool instead — inherited slice = "a contiguous range of
codes" — you'd need a mapping from code to state, which is exactly
the inverse of what we store. It works out identically
mathematically, but the state-id-indexed direction is what the code
picked.

**Q9: What's the interaction between `simulated_annealing` and
`global_sa` in the registry?**

They're aliases for the same class (`__init__.py:20-21`). The
metadata descriptions imply a semantic difference ("solves encoding
+ dummies" vs. "solves encoding only"), but the class implements
both flows: `optimize_fsm` does encoding SA plus dummy insertion,
and `optimize_encoding_only` (`simulated_annealing.py:235-257`)
does encoding SA only. Which flow you get is determined by which
method the caller invokes, not by which registry alias you asked
for. The API today calls `optimize_fsm` uniformly
(`optimization_service.py:266-271`), so `global_sa` and
`simulated_annealing` produce identical results. Discrepancy §9.3.

**Q10: Are the results deterministic across runs?**

SA and GA are deterministic if seeded — both accept `seed` in
`options` (`simulated_annealing.py:65-66`,
`genetic_algorithm.py:54-55`) and pass it into a private
`random.Random(seed)` instance rather than touching the global RNG.
Greedy is deterministic without seeding — it walks `nx.shortest_path`
whose output depends only on the graph's adjacency-list order, and
`_build_hypercube` builds edges in a fixed order
(`hypercube.py:33-55`). `bfs_optimal` is deterministic for the same
reason (it delegates to greedy today, per §3.2). So all four are
reproducible; SA and GA additionally need a `seed` option to pin
their RNG.

---

## 9. Discrepancy log

Discrepancies between code behaviour and the metadata / documentation
found while writing this. Flag each explicitly under review.

### 9.1 `greedy` complexity claim vs. actual

- **Metadata** (`__init__.py:31`): `O(T * log(N))`.
- **Actual** (per §2.6): O(T * k * 2^k) = O(T * N log N), because
  `_insert_dummy_states` calls `hypercube.shortest_path` which is
  a NetworkX BFS on the full 2^k-vertex hypercube.
- The metadata is achievable with an alternative implementation
  (bit-flip walk of XOR result in O(k) per transition), but the
  current implementation does not use it.
- **Practical impact:** modest — for `k <= 8` the constant hides.
- **Fix option (if performance matters):** replace
  `nx.shortest_path` with a direct bit-flip walk that iterates set
  bits of `enc(u) XOR enc(v)` in a fixed order and emits the
  intermediate codes. That gives the promised O(T log N).

### 9.2 `bfs_optimal` — the reuse logic is a stub

- **Design** (`__init__.py:34-38`): "Uses BFS with smart encoding
  reuse to minimize total dummy states across all transitions."
- **Actual**: `BFSOptimizer._find_best_path` is defined but never
  called; `_insert_dummy_states` is inherited from `GreedyOptimizer`
  and calls `hypercube.shortest_path` directly. `used_encodings` is
  populated in `optimize_fsm` and never consulted.
- **Behavioral consequence**: `bfs_optimal` produces identical
  results to `greedy` on all inputs.
- **Fix option:** override `_insert_dummy_states` in `BFSOptimizer`
  to (a) enumerate shortest paths in the hypercube — e.g., via
  `nx.all_shortest_paths` — (b) score them by count of intermediates
  already in `used_encodings`, and (c) either pick the highest-reuse
  path or, more ambitiously, formulate as set-cover and solve
  approximately.

### 9.3 `simulated_annealing` vs. `global_sa` — same class, different metadata

- Both registry keys map to `SimulatedAnnealingOptimizer`
  (`__init__.py:20-21`).
- Metadata claims (`__init__.py:39-58`) suggest a "hybrid"
  vs. "encoding-only" distinction. The class supports both via
  `optimize_fsm` (hybrid) and `optimize_encoding_only`
  (encoding-only), but the service always calls `optimize_fsm`
  (`optimization_service.py:266-271`).
- **Behavioral consequence**: choosing `global_sa` or
  `simulated_annealing` at the API level produces identical
  results.
- **Fix option:** either (a) split the class into two, one that
  performs encoding SA only, one that performs the hybrid; or (b)
  route `global_sa` in the service to `optimize_encoding_only` and
  keep `simulated_annealing` on `optimize_fsm`; or (c) drop one of
  the two registry aliases.

### 9.4 SA and GA search only within the initial code pool

- Both algorithms treat `initial_states.values()` as the fixed pool
  of encodings and only ever permute within it
  (`simulated_annealing.py:161-168`,
  `genetic_algorithm.py:174-175`).
- If the FSM uses fewer than `2^k` states, the remaining codes are
  unreachable to SA/GA — potentially missing better encodings that
  use those codes for real states and free up "used" ones for
  dummies.
- **Fix option:** initialise the encoding pool as
  `generate_gray_codes(bit_width)` (or all `2^k` codes) rather than
  `states.values()`, and allow the SA/GA move set to include
  swap-with-unused-code moves.

### 9.5 Both `simulated_annealing` metadata entries claim
"before resolving remaining HD>1 transitions with dummy states"

- Only the `simulated_annealing` entry mentions the dummy pass
  (`__init__.py:42-47`). The `global_sa` entry (`__init__.py:52-56`)
  says "find the best state encoding assignment" without mentioning
  dummies.
- **Actual**: both invoke `optimize_fsm` which does the dummy pass.
- **Fix option:** either sync the two entries, or if `global_sa`
  should genuinely be encoding-only, wire it to
  `optimize_encoding_only` per §9.3.

### 9.6 Hypercube collision on tight encodings is silent

- `GreedyOptimizer._insert_dummy_states` (`greedy.py:130-135`)
  creates a `DummyState` with `encoding=code` (an intermediate Gray
  code from `hypercube.shortest_path`) without checking whether
  `code` is already the encoding of a real state.
- **Consequence**: on a fully-encoded k-bit FSM (all `2^k` codes
  used), every dummy silently collides with some real state,
  producing an FSM whose register value does not distinguish the
  two.
- The vending machine example (§2.5) hits this exact case.
- **Fix option:** either widen the register (increase `bit_width`)
  before dummy insertion, or, before allowing optimization, require
  that `|S| < 2^bit_width` so at least one code is spare.

---

## Appendix — a note on the CLI's role

`backend/src/grayfsm/cli.py` (357 lines) is a thin adapter that
imports from `app.core.*` — the same code paths the FastAPI service
uses. See its module docstring
(`backend/src/grayfsm/cli.py:1-31`) for the equivalence map to the
legacy `grayfsm.core.*` layout. Practical implication for
presenter prep: any behaviour you can reproduce via
`poetry run grayfsm optimize examples/vending_machine.json -a greedy`
is the *same* behaviour the API delivers — there is one source of
truth for algorithms, and it is `backend/app/core/algorithms/`.
