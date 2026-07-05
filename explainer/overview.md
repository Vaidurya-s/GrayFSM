# Overview

The engineering problem, the electrical reasoning behind Gray codes,
the role of dummy states, and a bird's-eye view of what happens between a
user click and a Verilog file. Aimed at a reader who will have to justify
every design choice to a hardware engineer or a compiler person and answer
follow-ups without hand-waving.

Other files in this folder go deeper on the pieces sketched here:
[`tech-stack.md`](tech-stack.md), [`architecture.md`](architecture.md),
[`deployment.md`](deployment.md).

---

## 1. The problem

A finite-state machine synthesised into a synchronous digital circuit stores
its current state in a bank of flip-flops. When the machine transitions from
state `A` to state `B`, the register bits update on a single clock edge. If
`A` and `B` are encoded such that more than one bit differs, several flip-flops
switch nominally simultaneously — but real gates don't switch simultaneously.

Two problems follow:

1. **Combinational glitches downstream.** Any logic that reads the state
   register — output decoders in a Moore machine, next-state logic in a
   Mealy machine — sees a transient invalid encoding while the bits settle.
   For a transition `A=00 → B=11`, the bus can pass through `01` or `10`
   during the propagation window. If those intermediate encodings map to
   *other* legal states, downstream logic asserts spurious outputs.
2. **Peak switching current (dI/dt) and crosstalk.** Simultaneous transitions
   of many bits pull larger transient current from the supply rail; this
   is a well-known contributor to ground bounce and SSN (simultaneous
   switching noise) in dense designs.

The classic fix — a fully synchronous output register that latches the
decoded output one cycle later — hides the glitch from the downstream user
but adds a cycle of latency and does nothing for the supply noise. Encoding
the state graph so that adjacent transitions differ by exactly one bit
addresses both problems at the source.

---

## 2. Why Gray codes

A Gray code is a binary encoding sequence in which **consecutive codes differ
by exactly one bit**:

```
n=2:  00 → 01 → 11 → 10
n=3:  000 → 001 → 011 → 010 → 110 → 111 → 101 → 100
```

Generated in the codebase by XOR-with-shift:
`gray = n ^ (n >> 1)` — see `backend/app/core/gray_code.py:16`.

For an FSM, if every `(current_state, next_state)` transition maps to an
adjacent pair in the Gray sequence, the register bus is guaranteed to
change exactly one bit per clock edge. No transient invalid encoding, no
peak dI/dt from a wide bus swing.

The state graph, however, is not a straight line. It's a directed graph
that can have branches, cycles, and one-to-many fan-out. Gray codes lay out
neighbors on the *n*-dimensional hypercube; the graph embedding problem
becomes:

> Given a directed graph `G = (V, E)` and a hypercube `Q_n`, find an
> injective mapping `φ: V → Q_n` such that for every edge `(u, v) ∈ E`,
> `Hamming(φ(u), φ(v)) = 1`.

Such an embedding does not always exist for a given `n`. It exists if and
only if `G` is a *subgraph of `Q_n`*. That's the constraint the optimisers
have to work around.

---

## 3. Why dummy states

Two escape hatches when the embedding doesn't fit:

**Option A — widen the register.** Move to `n+1` bits. Doubles the address
space, always solves adjacency for well-behaved graphs, wastes a flip-flop
per state.

**Option B — insert intermediate ("dummy") states.** For any transition
whose endpoints have Hamming distance `d > 1`, insert `d - 1` dummy states
that bridge from `φ(u)` to `φ(v)` one bit at a time. The dummy state has no
observable Moore output (it inherits the source state's output for Moore
machines, or is transparent for Mealy). The FSM now takes `d` clock cycles
to traverse the original edge, but each individual step is a single-bit
change.

GrayFSM does Option B and reports how many dummies it added. The optimiser
picks the smaller `n` that can be made to work with the fewest bridging
states, and each shipped algorithm trades off "dummies added" against
"maximum Hamming remaining":

- `greedy` — cheap, may leave some multi-bit hops
- `bfs_optimal` — exact over the encoding search space; only tractable at
  small `n`
- `global_sa`, `global_ga` — encoding-reassignment searches (simulated
  annealing / genetic algorithm) that also relabel non-dummy states

Deep dives on each algorithm's cost function live outside this folder; the
present file only argues that the `dummy_states_added` count is a real
resource — every dummy state adds a clock cycle of latency to a real
transition, and adds an entry to the next-state ROM/logic.

The bit-width for an optimised FSM is picked at persistence time as
`ceil(log2(max(N, 2)))` where `N` is the final state count — see
`backend/app/services/optimization_service.py:335`. So the optimiser
never emits a bit-width narrower than what the *post-dummy* state set
needs.

---

## 4. Concrete worked example

A 4-state Moore machine that idles then counts a two-input sequence:

```
States:   S0 (idle)   S1 (saw 1)   S2 (saw 10)   S3 (saw 101, output=1)
Bit-width required to enumerate: ceil(log2(4)) = 2

Original graph (edges labelled with input):
    S0 --1--> S1 --0--> S2 --1--> S3 --0--> S0
    S0 --0--> S0
    S1 --1--> S1
    S2 --0--> S0
    S3 --1--> S1
```

The 2-bit Gray sequence is `00, 01, 11, 10`. A naive Gray assignment
walks the sequence in listed order:

```
S0=00  S1=01  S2=11  S3=10
```

Check each transition's Hamming distance under this encoding:

| edge          | codes       | ΔH |
|---------------|-------------|----|
| S0→S1 (on 1)  | 00 → 01     | 1  |
| S1→S2 (on 0)  | 01 → 11     | 1  |
| S2→S3 (on 1)  | 11 → 10     | 1  |
| S3→S0 (on 0)  | 10 → 00     | 1  |
| S0→S0 (on 0)  | 00 → 00     | 0  |
| S1→S1 (on 1)  | 01 → 01     | 0  |
| S2→S0 (on 0)  | 11 → 00     | **2** |
| S3→S1 (on 1)  | 10 → 01     | **2** |

Two transitions have `ΔH = 2`. Fixing them at `n=2` is impossible — every
2-bit encoding of a 4-node graph has these constraint conflicts because
the graph is not a subgraph of `Q_2`. Options:

1. Widen to `n=3` (waste 4 codes for 4 states) and re-embed.
2. Keep `n=2`, insert one dummy state per multi-bit edge to bridge the
   Hamming distance.

Option 2 with two dummies:

```
S2 --0--> DUMMY_A --continue--> S0    where DUMMY_A = 01 (bridges 11→00 via 11→01→00)
S3 --1--> DUMMY_B --continue--> S1    where DUMMY_B = 00 (bridges 10→01 via 10→00→01)
```

That doesn't fit either — 2-bit Gray space only has 4 codes, all already
claimed by `S0..S3`. So Option 2 at width 2 *forces* a bit-width bump to
3, giving 8 codes to place 4 real states + 2 dummies. The optimiser makes
that call automatically via the `optimized_bit_width` computation cited
above.

The point of the example is not the specific dummy count. It's that:
- adjacency is a graph-embedding constraint, not a heuristic,
- the constraint interacts with the flip-flop budget,
- and a single problematic transition can force a bit-width increase.

---

## 5. Full request lifecycle

The steady-state user flow, from click to Verilog file. Each stage is
covered in depth by [`architecture.md`](architecture.md); this is the
elevator view.

```
┌──────────────┐     ┌─────────┐     ┌────────────┐     ┌──────────┐
│  Browser     │     │  nginx  │     │  FastAPI   │     │ Postgres │
│  React SPA   │◀──▶ │  SPA +  │◀──▶ │  /api/v1/* │◀──▶ │  Redis   │
└──────────────┘     │  /api → │     │            │     └──────────┘
                     └─────────┘     └────────────┘
                                          ▲
   1. User builds FSM in FSMCanvas         │
      (React Flow) → click Save            │
   2. POST /api/v1/fsms                    │
   3. Client-side: react-query invalidate  │
      fsmKeys.lists                        │
   4. User clicks "Optimize"               │
   5. POST /api/v1/fsms/{id}/optimize      │
      (async=false path in this walk)      │
   6. OptimizationService.optimize_fsm:    │
      cache_get → miss                     │
      load original FSM (ownership check)  │
      run algorithm (greedy / bfs / sa / ga)
      compute Hamming metrics before/after │
      persist derived FSM (visibility=private, is_optimized=true)
      insert AlgorithmResult row (snapshot for lab report)
      cache_set                            │
   7. Response with optimized_fsm_id, metrics, encoding_map
   8. User clicks "Export → Verilog"       │
   9. GET /api/v1/fsms/{id}/export?format=verilog
      → exporter reads FSM.definition and encoding
      → returns Verilog text
```

Steps 6-7 are the load-bearing ones. See
`backend/app/services/optimization_service.py:99-202` for the concrete flow
and `backend/app/api/v1/algorithm.py:65-147` for the HTTP surface (both the
sync and async branches).

---

## 6. What's shipped vs what isn't

Authoritative list is `docs/RUNBOOK.md` §10 ("Recently-shipped feature
log"). Cross-checked against `git log --oneline` and the code paths that
implement each item.

**Shipped and exercised by tests / used by the frontend:**

| Feature | Code entry point |
|---|---|
| Greedy optimiser | `backend/app/core/algorithms/greedy.py` |
| BFS-optimal optimiser | `backend/app/core/algorithms/bfs_optimal.py` |
| Simulated annealing | `backend/app/core/algorithms/simulated_annealing.py` |
| Global SA / Global GA (encoding-reassignment) | `algorithm.py` registry lists `global_sa`, `global_ga` |
| Verilog / VHDL / JSON / CSV / SystemVerilog assertions / testbench export | `backend/app/core/exporters/`, `backend/app/api/v1/export.py` |
| Optimisation comparison view | `POST /api/v1/fsms/{id}/compare` — `backend/app/api/v1/algorithm.py:214` |
| 2D + 3D hypercube visualisation | `frontend/src/components/visualizations/` (Three.js gated by `VITE_ENABLE_3D_HYPERCUBE`) |
| Lab Report page | `frontend/src/pages/OptimizationPage.tsx` etc. |
| JWT auth + refresh cookie + Redis blacklist | `backend/app/api/v1/auth.py`, `backend/app/middleware/token_blacklist.py` |
| Account lockout after `MAX_FAILED_LOGINS` failed attempts | `backend/app/services/auth_service.py` |
| Rate limiting (per-IP + per-user, Redis-backed with in-memory fallback) | `backend/app/middleware/rate_limit.py` |
| Security headers middleware (CSP, HSTS, X-Frame-Options, …) | `backend/app/middleware/security_headers.py` |
| CORS wildcard-with-credentials rejected at startup | `backend/app/main.py:138` |
| Visibility rule (`private`/`public`/`example`) | `backend/app/services/fsm_service.py:_check_ownership` |
| Block re-optimising a derived FSM | `backend/app/services/optimization_service.py:129` |
| Forking public/example FSMs | `POST /api/v1/fsms/{id}/fork` |
| Async optimisation via `BackgroundTasks` + Redis-backed task store | `backend/app/api/v1/algorithm.py:93`, `backend/app/api/v1/tasks.py` |
| Prometheus `/metrics` endpoint | `backend/app/observability/metrics.py:232` |
| Structured JSON request logging with correlation IDs | `backend/app/middleware/logging.py` |
| Mobile-responsive UI | commit `04feeaf` |

**Not shipped / not in this tree:**

- Celery worker (broker config keys exist in `settings`; there is no
  `Celery()` app object anywhere in the repo — the async path uses
  FastAPI `BackgroundTasks` running in the same process).
- No k8s live deploy config beyond static manifests under
  `infrastructure/kubernetes/`.
- No standalone SaaS control plane, billing, org multitenancy — this is
  a single-tenant app with per-user authentication.

---

## 7. Common cross-questions

**Q. Isn't a Gray code just a specific 1D sequence? How can it possibly
encode a branching graph?**
A. The name "Gray code" refers to the property of adjacent codes differing
by one bit, not to a particular linear order. The `n`-bit Gray sequence is
a Hamiltonian path on `Q_n`. GrayFSM uses `Q_n` itself as the encoding
space and looks for an embedding of the graph in it — not a walk along a
specific Gray sequence. When a linear walk suffices (e.g. a counter), the
graph is exactly the classical Gray sequence.

**Q. Doesn't inserting dummy states change the machine's observable
behaviour?**
A. Not the *sequence* of outputs, but the *timing*. A transition that
previously took 1 cycle now takes `d` cycles. For a Moore machine the
dummy holds the source state's output; for a Mealy machine the output on
each dummy step equals what the source→destination edge would have
asserted. If cycle-accurate timing is a spec (e.g. fixed-period
protocols), the calling code needs to compensate — and the exporter
reports the added latency per edge so downstream tooling can.

**Q. Why not skip Gray entirely and put a synchronous output register
after the decoder?**
A. That's a valid alternative in many designs. It moves the problem instead
of removing it: you pay one cycle of latency on the output, you still have
the multi-bit register transitions inside the state bank contributing to
supply-rail noise, and any next-state logic that reads the state register
still sees the transient. Gray encoding addresses the state register itself.

**Q. What's the state-count ceiling before the search stops being
tractable?**
A. `MAX_FSM_STATES=256` is the API-enforced hard cap (`docs/RUNBOOK.md`
§6.1). BFS-optimal explodes combinatorially well before that; the SA/GA
paths are the intended tools past ~20 states. Concrete numbers are
implementation-dependent and would need measurement on the target
machine to quote responsibly — see the note on unverified benchmarks in
[`tech-stack.md`](tech-stack.md).

**Q. Why does an optimised FSM refuse to be re-optimised?**
A. A derived FSM's `states` list already contains `DUMMY_*` nodes inserted
by the previous pass. Feeding those to a second pass compounds — each
pass re-embeds the graph that includes the previous pass's dummies, and
the second pass typically adds *more* dummies to satisfy adjacency
constraints the previous pass introduced. Enforced in
`backend/app/services/optimization_service.py:129` and short-circuited at
the HTTP layer in `backend/app/api/v1/algorithm.py:104` so the user gets
a 422 immediately rather than after queuing a task.

**Q. When is the dummy-state approach the wrong tool?**
A. When the design cannot afford the extra clock cycles per transition —
tight timing budgets, latency-sensitive signalling, fixed-period bus
protocols. In those cases: widen the register instead of inserting
dummies (Option A above), or use one-hot encoding and pay the flip-flop
cost. GrayFSM's optimiser picks bit-width for the *derived* graph, not
the original — see §3.
