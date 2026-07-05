# Q&A — Anticipated Cross-Questions

Compiled cross-questions organised by category. Each answer aims for
three to eight lines with real code refs, no marketing tone.

---

## Algorithm / correctness

**Q1. Prove that greedy always produces valid Hamming-distance-1
transitions post-insertion.**
`GreedyOptimizer._insert_dummy_states` (`backend/app/core/algorithms/greedy.py:92`)
calls `HypercubeGraph.shortest_path(from_code, to_code)` and creates
one dummy state per intermediate encoding (`greedy.py:115`).
By construction of the hypercube graph, adjacent path nodes differ in
exactly one bit — the graph's edges are the single-bit-flip
adjacencies. So every emitted transition (`from -> dummy_1`,
`dummy_1 -> dummy_2`, …, `dummy_k -> to`) has Hamming distance 1.
The `hamming_distance(from_code, to_code) <= 1` guard at
`greedy.py:74` skips the insertion when it's already safe.

**Q2. Encoding-level vs. dummy-level optimisation — what's the difference?**
Encoding-level: pick a different assignment of Gray codes to states so
fewer transitions have HD > 1. That's SA and GA — they permute the
initial encoding. Dummy-level: keep the encoding, insert intermediate
states along hypercube paths so every emitted transition is HD=1.
That's greedy and BFS-optimal. The two compose: SA can be followed
by greedy dummy insertion to close residual HD>1 transitions.
`OptimizationService.optimize_fsm` (`optimization_service.py:142-147`)
computes `pre_encodings` first, then hands them to the algorithm,
which returns dummy states — so the pipeline is encoding-then-dummies.

**Q3. Sketch why SA converges.**
Homogeneous Metropolis-Hastings with exponential temperature schedule
gives a time-inhomogeneous Markov chain whose stationary distribution
is Boltzmann over the cost surface. As `T -> 0` the Boltzmann mass
concentrates on argmin. Guarantee is asymptotic; in practice the
schedule (`temp_start`, `cooling_rate`) is tuned to give
"good enough" in a bounded step count. The GrayFSM SA
(`backend/app/core/algorithms/simulated_annealing.py`) exposes those
as options; the cost function is average Hamming over transitions.
Convergence to global optimum is not guaranteed within budget —
that's why BFS-optimal exists for small state counts.

**Q4. Why can't GA guarantee optimality?**
GA is a heuristic — no proof of convergence to global optimum in
finite generations under generic crossover/mutation operators on
non-convex integer-permutation spaces. The state-encoding search
space is `n!` for `n` states; GA samples it and recombines but there
is no monotone objective it must reach. It's shipped as an option
because it finds good solutions faster than BFS on medium n where
SA can get stuck.

**Q5. How do you handle unreachable states?**
Unreachable states are still Gray-encoded and still contribute to
`bit_width` (`ceil(log2(n_states))`) because they occupy a code
point in the encoding. They don't participate in the average
Hamming metric because they have no incoming transitions — see the
enumeration in `_avg_hamming` (`test_property_based.py:41-60`) which
iterates transitions, not states. Practically, we don't detect and
prune unreachable states — the optimizer treats them as encoding
weight only.

**Q6. Why is `bit_width` computed as `ceil(log2(max(n, 2)))` and not `ceil(log2(n))`?**
`log2(1) = 0`, which would give a zero-bit encoding. `max(n, 2)`
guarantees at least one bit so single-state FSMs still have a
representable register. See `FSMService.create_fsm`
(`backend/app/services/fsm_service.py:80`), `update_fsm` at `:234`,
and the property-based helper at `test_property_based.py:32`.

**Q7. What determines the output of a dummy state?**
`_insert_dummy_states` for Moore (`greedy.py:121-126`): use the
source state's output for the first `path-3` dummies, then switch
to the target's output for the last two. Rationale: the Moore
output must remain stable during the transition so downstream logic
doesn't see a spurious pulse. Mealy uses `"X"` (don't-care,
`greedy.py:128`) because Mealy outputs are functions of transitions
not states.

**Q8. Why does re-optimizing an already-optimized FSM return 422?**
Because dummy states from the first pass now show up in `states`,
`transitions`, and `encodings`. Running greedy again treats those
dummies as first-class states, tries to smooth transitions between
them, and inserts second-order dummy states — compounding without
bound. Guarded at `api/v1/algorithm.py:104-112` for async mode; the
message is user-facing and directs them to optimize the source FSM
instead. Pinned by `test_optimize_authorization.py` (fix `25d2fed`).

**Q9. What does the derived FSM's `definition` payload look like?**
Assembled in `_persist_optimized_fsm` (`optimization_service.py:336-343`):
`states`, `initial_state` (copied from source), `transitions`,
`outputs`, `encodings` (state -> Gray code), and
`original_fsm_id` (string UUID pointing back at the source). The
`encodings` field is the load-bearing addition — the original FSM
row doesn't carry it because state->code assignment is derived from
`bit_width` deterministically for non-optimized FSMs.

**Q10. How do you verify the optimizer preserved semantics?**
Property 5 in `test_property_based.py`: every original state and
transition must still be reachable in the output. The test at
`test_property_based.py:11` enumerates it. Dummy states are added,
never removed, and original transitions are either kept intact (HD ≤ 1
case, `greedy.py:76`) or replaced by a chain that starts at the
same source, ends at the same target, and reads the same input —
so the language recognised by the FSM is unchanged.

---

## Backend / architecture

**Q11. Walk through what happens on `POST /api/v1/fsms/{id}/optimize`.**
1. Middleware chain: security headers, CORS, gzip, logging, error
   handler, rate limiter, response wrapper (`main.py:132-161`).
2. Route: `algorithm.py:66`. `get_required_current_user` decodes
   the JWT — 401 if missing/invalid. `get_db` yields a session.
3. Sync mode: `OptimizationService.optimize_fsm`
   (`optimization_service.py:120`) loads the FSM via `_load_fsm`
   which enforces the "public/example OR owner" rule
   (`:240-242`).
4. Pre-optimization metrics computed. Algorithm dispatched via
   `_run_algorithm` — timed with `time.perf_counter`, failure
   records an `AlgorithmResult(success=False)` row and re-raises.
5. Post-metrics computed, derived FSM persisted with
   `created_by = original.created_by or user_id`
   (`:365`). Both rows batched into one txn (`:333`).
6. Response goes back through response_wrapper which wraps
   `{success, data}`. Async mode (`algorithm.py:93-132`) queues
   via FastAPI `BackgroundTasks` and returns 202 with a
   `status_url` — the client polls `/api/v1/tasks/{id}`.

**Q12. Where can this system fail? What's the recovery story?**
Points of failure: (a) Postgres — no automated failover in the
repo; ops recovery is "point DATABASE_URL at the standby, restart".
(b) Redis — every hot path fails open (rate limiter → in-memory,
blacklist → non-revoked, task store → in-process). App keeps
serving; consistency degrades until Redis returns.
(c) The optimizer itself — bounded by `algorithm_timeout_ms =
30000` (`config.py:104`). Failures are captured in
`AlgorithmResult` rows for later inspection (`optimization_service.py:274`).
(d) The disk seeder can hang the startup path — mitigated by
running under lifespan (`main.py:112`), not as a request handler.

**Q13. What's the DB pool size and why?**
`database_pool_size = 20`, `database_max_overflow = 10`
(`config.py:45-46`). So 30 connections max per worker. With
`workers = 4` (`config.py:30`) that's 120 connections at peak against
Postgres — well within the default 100-connection limit if pooled
via pgbouncer, tight without. Rule of thumb we picked: pool =
2 × expected concurrent async DB-holding requests per worker.

**Q14. Why FastAPI and not Django REST?**
Two reasons. First, async natively — the optimizer is CPU-bound
but the surrounding IO (Postgres via asyncpg, Redis, task
notifications) benefits from async single-threaded workers. Django
async support is retrofit and awkward around the ORM. Second,
Pydantic v2 schema-first request/response validation and
auto-generated OpenAPI — the OpenAPI spec at `/api/v1/openapi.json`
(`main.py:111`) drives our Schemathesis contract tests
(`tests/contract/test_openapi_contract.py:12`). Django would need a
separate schema layer.

**Q15. How would this scale to 10k concurrent users?**
Not a rewrite question; a headroom question. Concrete: (a) Optimizer
work moves out of BackgroundTasks into a real queue (Celery or RQ
on Redis, both fit) so long optimizations don't sit on the API
process. (b) Postgres connection pool via pgbouncer in
transaction-pool mode — SQLAlchemy async is compatible. (c) Read
replicas for GET `/fsms` — the visibility filter is deterministic
and cache-friendly. (d) Rate limiter runs off shared Redis which
we already do; only concern is Redis capacity, not code. Nothing
in the current design is a fundamental block.

**Q16. Why `SELECT ... FOR UPDATE` on login?**
`auth_service.py:113-117`. Without the row lock, concurrent bad-
password attempts each read `failed_login_count = k`, each write
`k+1`, so lockout never fires — the counter never crosses the
threshold. `FOR UPDATE` serialises the read-modify-write on the
row.

**Q17. Why is the response envelope inconsistent per-route?**
Response wrapper middleware (`middleware/response_wrapper.py:25`)
wraps 2xx JSON that isn't already a `{"success": ...}` shape.
Some routes short-circuit — e.g. the async optimize returns a
pre-wrapped body (`algorithm.py:126-132`) because it must control
the status code (202) and body shape without the middleware
touching it. `test_response_envelope.py` pins the current per-route
behaviour so silent changes to the wrapper have to update the test
consciously.

**Q18. How do JSONB and UUID work under both Postgres and SQLite?**
Model declares them (`sqlalchemy.dialects.postgresql.{JSONB, UUID,
ARRAY}`). Test conftest registers per-dialect DDL compilers
(`backend/tests/api/conftest.py:51-66`) that translate them to
`JSON` / `CHAR(36)` / `JSON` at SQLite DDL time. Application code
is untouched — asyncpg on prod, aiosqlite in tests.

**Q19. What guarantees atomicity of "insert optimized FSM + insert AlgorithmResult"?**
Both are staged in the same `AsyncSession` before a single
`await self.db.commit()` at the end of `optimize_fsm`
(`optimization_service.py:180-190`). Failure between the two rolls
back the whole thing; success flushes atomically. The
`_run_algorithm` failure path is different — it records a failure
`AlgorithmResult` and commits so the failure is observable, then
re-raises (`:274-286`).

**Q20. What does `is_optimized` gate?**
Re-optimization block (`algorithm.py:104-112`, Q8), the "source
FSM" tracking (the frontend follows `original_fsm_id` in the
optimized definition back to the source), and the auth-tier
counters (an optimized FSM is not counted toward the user's
"created FSMs" for quota purposes if we ever add quotas). The
column is set at `optimization_service.py:366`.

---

## Frontend / editor

**Q21. Walk through the render tree when someone clicks a state in the canvas.**
Canvas uses `react-flow` (see `frontend/package.json`). Click →
react-flow onNodeClick → dispatches an action to `fsmStore`
(`frontend/src/store/fsmStore.ts`) which sets `selectedState`. Zustand
subscribers re-render — the inspector panel reads `selectedState`
and pulls the state's full record. Any edit dispatches a mutation
that pushes a snapshot onto the `FSMHistory` instance
(`fsmStore.ts:100`). The canvas itself does not re-render on
selection because the highlighted-node style is derived from
`selectedState` via a stable selector.

**Q22. Why zustand instead of Redux?**
Two selectors, no boilerplate. Zustand's `create<T>()` returns a hook
that reads specific slices without Provider/HOC wrapping. The undo
history lives outside the store as a plain class instance
(`fsmStore.ts:96-100`) — trivial to compose with zustand, would need
a middleware chain in Redux. Bundle size also — react-flow +
three.js + recharts is already heavy; every KB matters.

**Q23. How does undo/redo compose with async state changes?**
`FSMHistory<Snapshot>` (`frontend/src/store/fsmHistory.ts:36-56`) is
snapshot-based. A user mutation calls `history.push(snapshot)` which
truncates any redo branch (line 38-40) — recording a new mutation
forks history at the current cursor. Async loads bypass the push
(e.g. loading an FSM from the server sets state directly, doesn't
push). `undo()` and `redo()` return the target snapshot without
pushing themselves — which is the fix noted in the file docstring
(`fsmHistory.ts:15-18`) for the older bug where undo pushed and
broke redo.

**Q24. What's the biggest FSM the editor handles smoothly?**
Bounded by `settings.max_fsm_states = 256` (`config.py:105`), which
the backend enforces on create/update. React-flow handles 256 nodes
without perceptible lag on modern hardware. The 3D hypercube view
(`components/canvas/HypercubeVisualization`) is the practical
bottleneck — hypercube edge count is `n × 2^(n-1)` for `n = bit_width`,
so `bit_width = 8` gives 1024 edges which is fine, `bit_width = 12`
starts to matter. Since `bit_width = ceil(log2(state_count))`, 256
states → 8 bits, so we're safely inside the smooth zone.

**Q25. How does the frontend cache FSMs across route changes?**
It doesn't, meaningfully. Each route fetches on mount via
`fsmAPI.get(id)` (see `frontend/src/api/endpoints/fsms.ts`). The
axios response gets normalised into a common `{ data: FSM }` shape by
the interceptor (`client.ts:27-28`), so the store always sees the
same shape regardless of whether the backend wrapped the response.
No react-query, no SWR — invalidation would need those for
non-trivial caching.

**Q26. Why the "envelope + bare-body" tolerance in the API layer?**
Because response_wrapper middleware wraps some routes and not
others (see Q17). The frontend at `frontend/src/api/endpoints/fsms.ts`
handles both shapes so a middleware change doesn't require a
lock-step frontend release. `normalize.test.ts` pins this — both
`{ id: 'x' }` and `{ data: { id: 'x' } }` must produce
`result.data.id === 'x'`. Fix `7f00cea` was the regression where
the earlier normalizer spread the bare body then overwrote `.data`
with `normalizeFSM(undefined)`, losing the id.

**Q27. What triggers a re-render of the whole editor?**
The FSM identity — loading a different FSM ID replaces the draft
in the store, which invalidates every selector deriving from
`draft.states`, `draft.transitions`, `draft.encodings`. The canvas
component keys off the FSM id so react-flow's internal state
resets. Inline edits don't reset the canvas — they update slices
that only the inspector reads.

**Q28. How does the client know when an async optimize job finishes?**
The client polls `/api/v1/tasks/{task_id}` returned by the 202
response (`algorithm.py:130`). No WebSocket in the current
implementation — the spec mentions "Real-time optimization progress
via WebSocket" (`docs/openapi-spec.yaml:10`) but that's aspirational.
Polling interval is client-side (see the task hook). If the tab is
backgrounded, polling slows via `document.visibilityState`
observation — this is the standard pattern; not sure if we've
implemented it in code — flag as "verify against `useTaskStatus`".

**Q29. What's persisted client-side, and where?**
`localStorage`: `auth_token` (`authStore.ts:4`), `auth_user`
(`:10`), and any theme preference set by `ThemeProvider`. No FSM
draft persistence — an unsaved draft is lost on tab close. The
undo/redo stack is in-memory only.

**Q30. Why is the response 401 handler in the axios client, not in
the auth store?**
Because 401 can come back on any request, not just auth-store
initiated ones. Centralising the "clear token + redirect to login"
behaviour in the client interceptor (`client.ts:29-40`) means we
can't forget to handle it on a new endpoint. The exception is
`/login` and `/register` themselves (`:37`) where a 401 is
expected and the user hasn't left the page.

---

## Security / auth

**Q31. What happens if I send a valid JWT for a deleted user?**
The token decodes successfully — user existence isn't checked in
`_decode_token`. On `/auth/me`, `AuthService.get_user_by_id`
returns None and the route raises 401
(`api/v1/auth.py:147-152`). On any other authed endpoint, the
user_id is used to filter DB queries, which silently return no
results (looks like "no FSMs owned"). Deletion of a user without
deleting their tokens is a data-integrity gap — we don't have
cascading revocation. Mitigation is the 24h token expiry.

**Q32. How would a malicious FSM in the definition JSONB crash the exporter?**
Bounded. Pydantic schemas constrain types on write
(`backend/app/schemas/fsm.py`). On read, exporters iterate
`definition["states"]`, `["transitions"]`, `["outputs"]` and treat
missing values as defaults. The CSV None-output crash pinned by
`test_export_authorization.py` (fix `71d08ce`) was a real
crash-shape — a Moore transition with `output = None` hit
`str.join(None)`. That's fixed and pinned. Beyond that, a state
name with SQL-shaped content is safe because everything goes
through SQLAlchemy parameter binding.

**Q33. What if the JWT signing key leaks?**
Rotate `SECRET_KEY`, restart. Every issued token fails
`jose.jwt.decode` on the next request (`auth.py:89-97`) and the
client interceptor's 401 handler redirects to login
(`client.ts:29-40`). That's the emergency-revoke-all path. There is
no "rolling key" (JWKS) support today — one active secret at a time.

**Q34. Can I bypass rate limiting by hitting the API from many IPs?**
For anonymous global (100/hour per IP), yes — rotating IPs
sidesteps it. For auth routes, partially — the per-IP+path limiter
resets per IP, but the account-lockout counter on
`AuthService.login` (`auth_service.py:130`) is per-user, so
brute-forcing one email is still bounded at 5 attempts before a
15-minute lock, regardless of source IP. That's the actual
security-relevant bound; the rate limiter is a noise-reduction
layer.

**Q35. What's the CSRF story?**
Documented gap G1 in `docs/SECURITY-GAPS.md`. The
`Authorization: Bearer` header path is not CSRF-attackable — no
browser attaches it automatically. The httpOnly cookie set at
`auth.py:114-122` on login is. Current mitigations: strict CORS
(no wildcard-with-credentials, `main.py:138-139`), `samesite=lax`
on the cookie (`auth.py:120`), same-origin policy. Reference CSRF
middleware sits at `security/fixes/04_csrf_protection.py` but is
not deployed.

---

## Deployment / ops

**Q36. How would you roll back a bad optimize algorithm?**
Algorithm dispatch is registry-based
(`backend/app/core/algorithms/__init__.py`). Delete the entry from
the registry, deploy — the algorithm becomes an unknown-algorithm
400 at the route (`algorithm.py:143-147`). Data survives:
`AlgorithmResult` rows keep the failed history, `is_optimized`
FSMs derived from the bad algorithm are still there but flagged
by `optimization_algorithm` column. No DB migration needed.

**Q37. What runs on container start?**
FastAPI `lifespan` (`main.py:112`) executes on `uvicorn` app start.
Reads DB session module, kicks off `_seed_examples_if_empty` if
the FSM table has no example rows
(`test_optimize_initial_state.py:37` shows the seeder path). Rate
limiter Redis probe is lazy — happens on first request via
`_get_redis_store` (`rate_limit.py:191`). Token blacklist Redis
client is lazy for the same reason (`token_blacklist.py:127-146`).
`Settings()` instantiation at import time runs
`validate_runtime_settings` (`config.py:167`), which is what
enforces the production hardening checks.

**Q38. How do you seed a fresh environment?**
Two steps. (1) `alembic upgrade head` from `backend/` — the
migrations create the schema (CI does this at
`.github/workflows/contract-tests.yml:73-78`). (2) Start the app.
The lifespan handler seeds example FSMs from disk. That's it — no
separate data-load step. If you want to force a re-seed, truncate
the FSM table where `visibility = 'example'` and restart.

**Q39. How is the OpenAPI spec exposed?**
Two paths. (a) FastAPI auto-generated at
`/api/v1/openapi.json` (`main.py:111`). (b) Hand-authored spec at
`docs/openapi-spec.yaml` used for Dredd tests. The `/openapi.json`
prefix at `/api/v1/` is deliberate — before this it was mounted at
root, which the nginx proxy didn't forward, so the frontend's
"OpenAPI" link 404'd. Comment at `main.py:104-108` documents
the fix.

**Q40. What are the production hardening checks?**
Config-layer, all in `validate_runtime_settings` (`config.py:167`):
`SECRET_KEY` non-empty, doesn't contain `"change-in-production"`,
≥ 32 chars; `DEBUG=False`; `DATABASE_URL` doesn't contain
`"grayfsm:password@"` (rejects the dev-default credentials);
wildcard CORS logs a warning. Any of these raise `ValueError` at
`Settings()` instantiation, which happens at import time — a
misconfigured deployment fails to start rather than starting and
serving degraded.

---

## Meta / process

**Q41. What tests would fail if I made the ownership rule stricter?**
If I removed the "public + example" bypass in
`fsm_service.py:121`,
`test_visibility_access.py::test_public_ownerless_is_readable_anonymously`
and `..._example_...` would fail. If I removed it in
`optimization_service.py:240`,
`test_optimize_authorization.py::test_example_fsm_optimize_returns_200_for_authed_user`
fails. If I removed it in `export_service.py:149`,
`test_export_authorization.py::test_export_public_fsm_for_any_authed_user`
fails. Each test docstring names the fix SHA it pins.

**Q42. How would you add a new algorithm?**
Three steps. (1) New file under
`backend/app/core/algorithms/` implementing the
`optimize_fsm(states, transitions, outputs, fsm_type) ->
(dummy_states, new_transitions)` interface — see
`greedy.py:44-90` for the shape. (2) Register it in
`backend/app/core/algorithms/__init__.py`. (3) Add a unit test
under `backend/tests/test_core/` and a Hypothesis property test in
`test_property_based.py` asserting `avg_hamming_after ≤
avg_hamming_before` on generated FSMs. No route change, no schema
change — dispatch is registry-based.

**Q43. How does the frontend know when to invalidate its FSM cache?**
It largely doesn't cache — each route fetches on mount, so
navigating away and back reloads (see Q25). The one persistent
piece is the localStorage user cache (`authStore.ts:10`), which is
refreshed on every successful `/auth/me` call. If we added a
react-query layer this changes; today it's a non-issue because
there's no stale state to invalidate.

**Q44. How do you deprecate a route?**
No formal deprecation policy in `docs/RUNBOOK.md`. Practical
approach: mark the route in `docs/openapi-spec.yaml` with
`deprecated: true`, keep it functional for a version, then remove
the router include from `backend/app/main.py:166-178`. Downstream
callers see the OpenAPI deprecation before it breaks. There's
no `Deprecation:` response header today — worth adding if this
becomes real.

**Q45. What breaks if I remove `pytest-timeout`?**
Two things. First, a genuinely runaway async test (say, a
misconfigured retry loop) can hang CI until the runner-level
timeout kicks in — 6 hours default, expensive. Second, Hypothesis
strategies that hit a rare exponential path in the algorithm
(more likely in BFS-optimal for larger n) can run for minutes.
The `--timeout=30` global (`backend/pyproject.toml:43`) puts a
hard ceiling so the runaway is caught early with a stack trace,
not silently as "CI took 6 hours."
