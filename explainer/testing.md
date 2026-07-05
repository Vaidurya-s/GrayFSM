# Testing — Presenter Prep

Senior-engineer walk-through of the test tree, what each tier pins,
and how CI wires them together. All line refs against the current
tree.

---

## 1. Tier overview

| Tier | Location | Runner | DB | Scope | Runs in CI |
|---|---|---|---|---|---|
| Unit (core / algorithms) | `backend/tests/test_core/` | pytest | none | Pure-function tests: Gray code, hypercube, greedy/BFS/SA/GA optimizers, exporters, token blacklist | Every PR |
| Property-based | `backend/tests/test_core/test_property_based.py` | pytest + `hypothesis` | none | Invariant checks over generated FSMs across optimizers | Every PR |
| API integration (in-memory) | `backend/tests/api/` | pytest + `pytest-asyncio` + `httpx.AsyncClient` | in-memory SQLite via aiosqlite | Route handlers + middleware + services, DB swapped for SQLite | Every PR (with the rest of the backend suite) |
| HDL round-trip | `backend/tests/integration/test_hdl_roundtrip.py` | pytest | none | Runs `iverilog` / `ghdl` against exporter output | Every PR (requires the tool binaries in the runner) |
| Integration (real Postgres) | `tests/integration/` | pytest + httpx against running server | Postgres 15 service container | End-to-end HTTP against a live FastAPI process | Every PR (`.github/workflows/contract-tests.yml`) |
| Contract | `tests/contract/` | Schemathesis + Dredd | Postgres | Schema-conformance against `docs/openapi-spec.yaml` | Every PR |
| Frontend unit | `frontend/src/__tests__/` | Vitest + jsdom + Testing Library | none | Store logic, API normalization, UI primitives | Currently local; not gated in shipped workflows |
| Load | `tests/load/` | Locust + K6 | Postgres | Perf / capacity | Nightly + `[load-test]` commit tag only |

---

## 2. Backend test tree walk

### `backend/tests/test_core/` — pure-function unit tests

17 files, ~7,033 LOC total. Everything algorithm-adjacent lives here.
Highlights:

- `test_gray_code.py` (315 LOC) — the primitive `int_to_gray`,
  `hamming_distance`, `generate_gray_codes` functions.
- `test_hypercube.py` (218 LOC) — hypercube shortest-path invariants.
- `test_greedy.py`, `test_bfs_optimal.py`,
  `test_simulated_annealing.py` (455 / 377 / 756 LOC) — algorithm
  correctness with hand-crafted FSMs, expected dummy-state
  insertions, expected encodings.
- `test_property_based.py` (532 LOC) — see §3.
- `test_verilog_exporter.py`, `test_vhdl_exporter.py`,
  `test_sva_exporter.py`, `test_json_exporter.py`, `test_csv_exporter.py`,
  `test_testbench_exporter.py` — one file per exporter, ~500 LOC
  each. String-shape tests, not synthesis tests (that's HDL
  round-trip).
- `test_token_blacklist.py` (169 LOC) — the `TokenBlacklist` class
  with and without a mocked Redis.
- `test_optimization_service_helpers.py` (221 LOC) — the
  service-layer pure helpers (`_build_outcome` etc., see
  `optimization_service.py:297`).
- `test_auth.py` (220 LOC) — bcrypt helpers, JWT encode/decode
  round-trip, timing-dummy hash constant.

No DB. No HTTP. Fast — the whole `test_core` suite is a couple
seconds cold.

### `backend/tests/api/` — new integration tests (PR #73)

Five test files, ~570 LOC. Every one pins a specific regression that
recently bit us in production. Fixture layer is in
`backend/tests/api/conftest.py` (see §4). Each test's docstring
identifies the fix SHA it pins — grep for `Pins fix at` if a test
fails and you need to know which commit is being reverted.

| File | Purpose | Pins |
|---|---|---|
| `test_visibility_access.py` (70 LOC) | `GET /api/v1/fsms/{id}` access matrix | Public + example anonymous read; private-NULL unreachable; private cross-user 404; owner 200. Fix `9812a90` (example must be readable without auth). |
| `test_optimize_authorization.py` (141 LOC) | `POST .../optimize` authz + derived-ownership | Example FSM optimizable by any authed caller (fix `b7a5a2d`); re-optimize returns 422 (fix `25d2fed`); derived FSM `created_by = caller` when source is ownerless. |
| `test_export_authorization.py` (141 LOC) | Export mirror rule + CSV None-output regression | Public/example exportable by any authed caller. CSV export of a Moore FSM with `output=None` on transitions must not contain literal `"None"` (fix `71d08ce` — was `str.join(None)` crash). |
| `test_response_envelope.py` (119 LOC) | Response-body shape regression | Load-bearing keys (`id`, `optimized_fsm_id`) reachable at either the top level or under `.data`. Identity fields (`name`, `fsm_type`) not null. Pinned because response_wrapper coverage is inconsistent per-route. |
| `test_optimize_initial_state.py` (63 LOC) | Disk-seed + optimize round-trip | The disk seeder must include `initial_state` inside the JSONB `definition` (not just the top-level column). Pins fix `87f4c18` — seeder used to drop it, which crashed `_persist_optimized_fsm` with `KeyError('initial_state')`. |

### `backend/tests/integration/test_hdl_roundtrip.py`

Sits under `backend/tests/` (not root `tests/`) because it imports
`app.core.exporters` directly and would otherwise fight the import
path. Requires `iverilog` and `ghdl` binaries.

### `tests/integration/` (root)

Four files: `test_health_endpoints.py`, `test_fsm_endpoints.py`,
`test_optimization_endpoints.py`, `test_export_endpoints.py`. These
POST to `/api/v1/...` on a running server backed by a real Postgres.
This is what CI actually runs against a service container (see §7).

---

## 3. Property-based tests

`backend/tests/test_core/test_property_based.py` — 532 LOC using
Hypothesis. Header comment enumerates the properties:

1. `avg_hamming_after <= avg_hamming_before` for Greedy.
2. Same for BFS.
3. Same for SA.
4. All algorithms produce valid encodings — correct bit width, no
   collisions.
5. Optimized FSM preserves all original states and transitions
   (semantics-preserving).

### Strategies

State-name strategy (`test_property_based.py:79`) restricts to Latin
letters (`whitelist_categories=("Lu","Ll")`) so state IDs stay
identifier-shaped. The strategies compose up to a full FSM: state
list -> transition list over those states -> assign initial Gray
codes -> feed into `optimize_fsm`. Non-terminating runs are prevented
by per-example deadlines (`@settings(...)` decorators in the
individual tests) and by the global `--timeout=30`
(`backend/pyproject.toml:43`).

### Why it's pinned in dev deps

Hypothesis is pinned at `^6.92.0` in `backend/pyproject.toml:25` with
an inline comment: "without it the test module fails to import on a
fresh clone." Added in PR #78 after a fresh checkout couldn't run
the property suite.

### Runtime

The suite finishes in seconds because the state/transition
strategies cap generated FSMs at small state counts (necessary — BFS
optimal is exponential). Individual property tests use
`@settings(max_examples=...)` to bound Hypothesis work.

---

## 4. Test config

### `backend/pyproject.toml [tool.pytest.ini_options]`

```
testpaths = ["tests"]
python_files = "test_*.py"
addopts = "-v --timeout=30"
```

`pytest-timeout` at `--timeout=30` (`pyproject.toml:43`) is a hard
per-test ceiling. Long-running property tests override via
`@settings(deadline=...)`. Rationale in the comment at
`pyproject.toml:41-42`: "the api/ integration suite is fast but a
regression that pegs an async loop shouldn't hang CI indefinitely."

Dev deps also pin `pytest-asyncio ^0.21.1` (`:22`) and
`pytest-cov ^4.1.0` (`:21`).

### `backend/tests/api/conftest.py` — cross-dialect adapters

The API integration tests point the real FastAPI app at an in-memory
SQLite database, so:

- **Postgres-only types get compiled to SQLite equivalents at DDL
  time** (`conftest.py:51-66`). Three `@compiles(...)`-based adapters:
  - `JSONB` (Postgres) → `JSON` (SQLite text)
  - `UUID` (Postgres) → `CHAR(36)` (SQLite text)
  - `ARRAY` → `JSON` (SQLite has no array type)

  The model is left untouched — it still declares `JSONB` /
  `UUID` / `ARRAY` — because we want production DDL to be the
  Postgres shape. Only the test DDL bends.

- **Per-test engine** (`conftest.py:75-88`): fresh in-memory SQLite
  per test, `Base.metadata.create_all` on setup, disposed on
  teardown. Cheap and gives row isolation for free.

- **ASGI client** (`conftest.py:107-136`): `AsyncClient(transport=ASGITransport(app))`
  drives the real app in-process. `get_db` dependency is overridden
  to yield from the SQLite session factory — no real network, no
  real Postgres.

- **JWT helpers** (`conftest.py:144-170`): `auth_headers_a`,
  `auth_headers_b` fixtures mint valid tokens without going through
  `/auth/register`. The `SECRET_KEY` and `ENVIRONMENT=test`
  environment vars are set at module top (`conftest.py:26-29`)
  before any `app.*` import.

- **`insert_fsm` helper** (`conftest.py:180-223`): bypass the POST
  route so tests can pin `visibility` and `created_by` exactly.
  Critical for the `NULL created_by` regression tests where the
  normal route always stamps ownership.

### Backend outer `conftest.py`

`backend/tests/conftest.py` pins `ENVIRONMENT=test` before the first
`app.*` import (docstring `:6-14`) so `config.py`'s
`validate_runtime_settings` skips the placeholder-URL check. Without
this, a fresh clone without `.env` fails at
`from app.config import settings`.

---

## 5. Frontend tests

### Runner: Vitest

`frontend/vitest.config.ts`:

```ts
test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.ts', css: true }
```

`jsdom` environment because the primitive tests render actual DOM.
CSS parsing is enabled so component tests exercising class-based
styles work under jsdom without swallowing warnings.

Scripts (`frontend/package.json:6-13`):

- `npm run test` → `vitest` (interactive)
- `npm run test:ui` → `vitest --ui`

There is no `test:run` / `test:ci` script — running under CI would be
`npx vitest run`.

### Files (`frontend/src/__tests__/`)

- `api/normalize.test.ts` — pins the fix at `7f00cea` where the
  previous `fsmAPI.get` spread the bare FSM then overwrote `.data`
  with `normalizeFSM(undefined)`, producing a defaults blob with no
  id (docstring at file top). apiClient is mocked at the call
  boundary so the tests focus on normalization, not transport.

- `store/authStore.test.ts` — pins fix `9039879`: `authStore.init()`
  is 5xx-tolerant. Only 401/403 clears the session; a single 502/
  timeout preserves cached user.

- `store/fsmHistory.test.ts` — undo/redo store integration.

- `utils/{cn,gray-code,hypercube,mermaid}.test.ts` — pure utility
  tests. `gray-code.test.ts` cross-checks the frontend Gray code
  implementation against the backend's expected outputs.

- `components/ui/datasheet-primitives.test.tsx` — the datasheet
  design-system primitives (`Kicktitle`, `TypedSection`,
  `MarginalNote`, `DataBlock`, `RuledTable`, `SpecField`,
  `PullFigure`, `CommandKey`, `CommandKeyRow`). Rendered under a
  `MemoryRouter` because some primitives use `react-router` links.

---

## 6. Contract tests

### `docs/openapi-spec.yaml`

1,282-line hand-authored OpenAPI 3.1.0 spec. Used both as the
contract source AND to make `/api/v1/openapi.json` findable via
the same nginx-proxied prefix as everything else — see comment at
`backend/app/main.py:104-108`.

### Schemathesis

`tests/contract/test_openapi_contract.py` (114 LOC). Loads the spec
from the live `http://localhost:8000/openapi.json`, generates
property-based inputs for every operation, and asserts responses
conform. Compat shim at `:10-19` handles both schemathesis 3.x
(`from_uri`) and 4.x (`from_url`) — if neither is available (a 4.x-
only fork with different entry points), the whole module skips.

### Dredd

`tests/contract/dredd_hooks.py` (165 LOC). Record-and-replay
contract runner. CI invocation:

```
dredd docs/openapi-spec.yaml http://localhost:8000 \
  --hookfiles=tests/contract/dredd_hooks.py \
  --reporter=markdown:dredd-report.md \
  --reporter=html:dredd-report.html \
  --loglevel=warning
```

Dredd is `continue-on-error: true` (contract-tests.yml:107) —
advisory only, because the shape it validates against is spec-shape
which drifts against reality often enough that blocking on it would
be noisy. The rendered reports are uploaded as artifacts either way.

---

## 7. Load tests

### Locust — `tests/load/locustfile.py` (350 LOC)

Five user classes, all based on `GrayFSMUser(FastHttpUser)`
(`locustfile.py:16-40`). Task weights in parens; higher = fired
more often:

| Class | Scenario mix |
|---|---|
| `ReadHeavyUser` | list FSMs (8), get FSM (4), get algorithms (4), get examples (2), health (1) |
| `OptimizationHeavyUser` | POST optimize (5), get optimize results (3), compare algorithms (2) |
| `ExportHeavyUser` | export Verilog (4), export VHDL (2), export CSV (2), export JSON (1) |
| `MixedWorkloadUser` | list (10), get (3), optimize (5), export (2), fork (2), create (1) |
| Base `GrayFSMUser` | on_start/on_stop shared setup, `wait_time = between(1, 3)` |

### K6 — `tests/load/k6_load_test.js` (303 LOC)

Complementary runner in JavaScript. Same scenario shape as
Locust — the two exist so we can validate perf numbers under two
independent load generators.

### CI gating

Load tests do not run on PR events. They fire only on the nightly
cron OR when a commit message contains `[load-test]`
(`contract-tests.yml:218`):

```
if: github.event_name == 'schedule' || contains(github.event.head_commit.message, '[load-test]')
```

Perf thresholds are asserted in an inline Python step
(`contract-tests.yml:298-311`): avg response time < 2000ms per
route, failure rate < 5%. Full Locust HTML/CSV report is uploaded
as an artifact regardless.

---

## 8. CI pipelines

### `.github/workflows/contract-tests.yml`

Four jobs on `pull_request` / `push` to `main` or `develop` and a
2am UTC schedule:

1. **`contract-tests`** (`:13-123`) — brings up a Postgres 15 and
   Redis 7 service container, runs Alembic, starts the API on
   port 8000, waits for `/api/v1/health`, then runs Schemathesis
   and Dredd back-to-back. Dredd report uploaded via
   `actions/upload-artifact@v4`.
2. **`integration-tests`** (`:125-213`) — same service containers.
   Runs `pytest tests/integration/` with coverage
   (`--cov=backend/app --cov-report=xml,html,term`). `--maxfail=5`
   bails after 5 failures so a total regression doesn't burn the
   whole runner. `RATE_LIMIT_ENABLED: "false"`
   (`:199`) so limiter doesn't flake the suite. Coverage uploaded
   to Codecov + `htmlcov/` artifact.
3. **`load-tests`** (`:215-318`) — schedule/`[load-test]` gated,
   see §7.
4. **`test-summary`** (`:320-373`) — always runs, downloads all
   artifacts, comments PR with contract + integration status and
   the Dredd markdown report. Needs `pull-requests: write`
   permission (`:328-331`) so fork-PRs don't fail with "Resource
   not accessible by integration".

### `.github/workflows/security.yml`

Three jobs: `pip-audit` (advisory), `npm-audit` (blocking on
HIGH/CRITICAL), `bandit` (advisory). Detailed in
`explainer/auth-security.md §11`.

### `.github/workflows/secrets-scan.yml`

One job: `gitleaks/gitleaks-action@v2` on full history
(`fetch-depth: 0`). Blocking. Dedicated file so PR-level cost stays
low.

---

## 9. Test isolation strategy

- **API integration tests use a fresh in-memory SQLite per test**
  (`backend/tests/api/conftest.py:75-88`). No cleanup, no shared
  state — the engine is disposed on fixture teardown.
- **Redis is not touched** in the API integration tier. The token
  blacklist tests pass `redis_client=None`
  (`test_token_blacklist.py:31`) which forces the in-process set
  fallback. Rate limiter is bypassed via `RATE_LIMIT_ENABLED=false`
  in CI (`.github/workflows/contract-tests.yml:199`).
- **Background task store**: `create_task` / `update_task`
  (imported from `app.api.v1.tasks`) use a process-local fallback
  dict when Redis is absent — same pattern as the blacklist. Tests
  don't need to mock the task store.
- **HDL round-trip tests write to a tempdir per test.**
- **Contract tests get their own Postgres schema per CI job**
  (`grayfsm_test`) that's dropped when the runner container exits.

---

## 10. Common cross-questions

**Q. How do you test the async optimize path without a real Redis?**
The optimize path uses FastAPI `BackgroundTasks` for async mode
(`backend/app/api/v1/algorithm.py:69, :116`), not a Celery/RQ
Redis queue. The task store falls back to an in-process dict when
Redis is unavailable. Integration tests exercise the sync mode
(`request.async_mode=False`) which runs inline in the request
handler — no queue at all. The async mode is covered by the load
tests hitting a real Redis service container.

**Q. Why in-memory SQLite? Doesn't that miss Postgres-specific behavior?**
It does, and we accept it as the trade for the API tier — that
tier is about auth boundaries, route wiring, and service composition,
not SQL semantics. The three DDL compilers
(`conftest.py:51-66`) bridge JSONB/UUID/ARRAY. Anything that
depends on real Postgres — JSONB indexing, `SELECT ... FOR
UPDATE` semantics under actual row-level locking, generated
columns — has to be exercised in the root `tests/integration/`
suite that runs against Postgres 15. That's the split. Both tiers
run every PR.

**Q. What's the coverage today? What are the biggest gaps?**
Backend coverage is uploaded to Codecov from the integration job
(`.github/workflows/contract-tests.yml:200-205`). Gaps by shape,
not by number: (a) frontend has real unit tests for stores and
primitives but no coverage on the editor canvas — that lives
behind e2e; (b) there is no e2e in this workflow file, the `e2e/`
directory holds Playwright specs but they aren't wired into a
GitHub job yet; (c) the WebSocket task-status stream has unit
coverage on the client wrapper but no server-side integration
test.

**Q. How do property-based tests handle non-terminating optimizer runs?**
Two ceilings: (1) `--timeout=30` global in
`backend/pyproject.toml:43` via `pytest-timeout` — a single test
cannot exceed 30s; (2) individual property tests set
`@settings(max_examples=..., deadline=...)` for Hypothesis-level
bounds. State-count strategies also cap generated FSMs at small
sizes because BFS-optimal is exponential — see `test_property_based.py`
strategy definitions around `:79`.

**Q. How does CI run the load tests? Are they gated?**
Gated — nightly cron OR commit message contains `[load-test]`
(`contract-tests.yml:218`). Not on PRs. Thresholds asserted
inline (`:298-311`). Full HTML + CSVs uploaded as artifacts.

**Q. What are the "PR #73" tests and why did they land?**
The `backend/tests/api/` suite. They pin the specific regressions
from the recent debugging cycle: NULL-created_by unreachable,
example FSMs anonymous-readable, example FSMs optimize/export by
authed callers, response-envelope shape, disk-seed
initial_state. Each file's docstring names the fix SHA it pins so
a future revert fails a targeted test with a legible message.

**Q. Why is `RATE_LIMIT_ENABLED=false` in the integration CI job?**
Because integration tests fire dozens of requests from a single
IP in a burst, which the auth-route limiter (5/60s) would rate-
limit into flake. Turning the limiter off is safer than tuning
its window down and forgetting to restore. The rate limiter has
its own targeted unit coverage.

**Q. Why aren't Vitest frontend tests in the shipped workflow files?**
They live locally under `frontend/src/__tests__/` and run via
`npm run test`. No dedicated `frontend-tests` job in
`.github/workflows/`. This is a known gap — the tests exist and
pass; wiring them into CI is a small follow-up. Call this out
if asked.

**Q. What guarantees the Dredd/Schemathesis spec stays in sync?**
Nothing structural today — `docs/openapi-spec.yaml` is
hand-authored. FastAPI generates its own OpenAPI at
`/api/v1/openapi.json` (`main.py:111`), and Schemathesis pulls
from that live endpoint (`test_openapi_contract.py:12`), so the
Schemathesis run catches drift between routes and reality. Dredd
runs against the hand-authored file — so it catches drift between
the hand-authored file and reality, but not between the two spec
sources. Dredd is `continue-on-error` for that reason.
