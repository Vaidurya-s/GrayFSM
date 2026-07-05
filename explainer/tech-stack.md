# Tech stack

Every runtime and framework in the tree, with the version pin, the reason
it's there, the naive alternative, and (where useful) an answer to "why
not X?". Read from `backend/pyproject.toml`, `backend/requirements.txt`,
`frontend/package.json`, and `.github/workflows/*.yml` at the current
`main` (session 2026-07-05).

Cross-links: the request lifecycle that these components sit inside is in
[`architecture.md`](architecture.md); how they get shipped is in
[`deployment.md`](deployment.md). The problem statement they exist to
solve is in [`overview.md`](overview.md).

---

## 1. Backend runtime

### 1.1 FastAPI + Uvicorn (Python 3.10+)

| Piece | Version pin | Where |
|---|---|---|
| `fastapi` | `^0.115.0` / `>=0.115.0,<0.116.0` | `pyproject.toml:11`, `requirements.txt:9` |
| `uvicorn[standard]` | `^0.30.0` / `>=0.30.0,<1.0.0` | `pyproject.toml:12`, `requirements.txt:10` |
| App factory | `app.main:app` | `backend/app/main.py:88` |

**Why FastAPI.** Type-native routing (Pydantic in, Pydantic out) with
async-first request handling. The optimisation endpoint is I/O-bound
(DB, Redis cache, then a CPU-heavy algorithm) and benefits from ASGI:
uvicorn workers stay unblocked on the DB/Redis roundtrips while the
algorithm loop runs. FastAPI's dependency-injection primitive is used
across the codebase (`Depends(get_db)`, `Depends(get_required_current_user)`
— see `backend/app/api/v1/algorithm.py:70-71`).

**Why the 0.115 floor.** The pin is deliberate: `fastapi>=0.115` pulls a
`starlette` new enough to close three known CVEs (PYSEC-2024-38 ReDoS in
Content-Type parsing, CVE-2024-47874 multipart DoS, CVE-2025-54121). This
is documented in `requirements.txt:5-8`.

**Why not.** Django/DRF would have brought a heavier ORM stack (Django's
ORM is sync-first; async support is partial), a batteries-included
admin and auth that we'd override anyway, and a request cycle that
predates ASGI. Flask would have needed a bolt-on for async, Pydantic
integration, and OpenAPI generation — all three of which FastAPI ships.

### 1.2 Pydantic v2 (+ pydantic-settings, pydantic[email])

| Piece | Version pin | Where |
|---|---|---|
| `pydantic` | `>=2.5.0,<3.0.0` | `requirements.txt:13` |
| `pydantic-settings` | `>=2.1.0,<3.0.0` | `requirements.txt:14` |
| Config validator | `backend/app/config.py:166-226` |

**Why v2.** Rust-backed validation is order-of-magnitude faster than v1,
and FastAPI 0.100+ aligned on v2 as the supported target. `model_validator`
gives one call site (`validate_runtime_settings`) that enforces
environment-specific hardening — placeholder DATABASE_URL rejection,
SECRET_KEY strength check in production, wildcard-CORS-with-credentials
short-circuit — before the app can start.

**Why not.** Marshmallow / attrs+cattrs would have decoupled validation
from the ORM/HTTP layer but reintroduced the "define the shape three
times" problem that Pydantic-native FastAPI removes.

### 1.3 SQLAlchemy 2.0 async + asyncpg + psycopg2-binary + Alembic

| Piece | Version pin | Where |
|---|---|---|
| `sqlalchemy` | `>=2.0.23,<2.1.0` | `requirements.txt:18` |
| `asyncpg` | `>=0.29.0,<1.0.0` | `requirements.txt:20` |
| `psycopg2-binary` | `>=2.9.9,<3.0.0` | `requirements.txt:21` |
| `alembic` | `>=1.13.0,<2.0.0` | `requirements.txt:19` |
| Engine construction | `backend/app/db/session.py:20-42` |

**Why the 2.0 line.** Native async engine with a stable API. Uses:
`pool_pre_ping=True` (avoids stale-connection errors on cloud Postgres
with idle-timeout policies), `pool_recycle=3600` (guards against silent
proxy resets), `pool_size` + `max_overflow` configurable per environment.

**Why asyncpg AND psycopg2-binary.** asyncpg is the async driver used at
runtime (`postgresql+asyncpg://` DSN). psycopg2-binary is present because
Alembic runs sync migrations (`alembic upgrade head`) and defaults to
psycopg2 unless configured otherwise. Both drivers speak the same wire
protocol; the app pays a small install-size cost to avoid coupling the
migration harness to the async driver.

**Why Alembic.** Declarative migration history with autogenerate against
model changes. Migration files under `backend/alembic/versions/` are the
authoritative schema history. There's also
`backend/app/db/session.py:74-78` which calls
`Base.metadata.create_all` at startup — see the runtime-vs-migration
note in [`deployment.md`](deployment.md); the two mechanisms coexist
uneasily.

**Why not.** Raw SQL + hand-rolled migrations is faster to write for the
first two tables and much slower after that. Peewee/Tortoise are
async-native but don't have SQLAlchemy's introspection ecosystem (which
is why Alembic autogenerate works at all).

### 1.4 Redis (redis-py async)

| Piece | Version pin | Where |
|---|---|---|
| `redis` | `>=4.6.0,<6.0.0` | `requirements.txt:50` |
| Client (async) | `backend/app/cache.py` |

**Why the range.** 4.6 introduced first-class `redis.asyncio`. 6.0
would tighten but breaks the pinned surface elsewhere; the pin is
conservative on purpose.

**What Redis is used for** (four distinct concerns, one deployment):
1. **Optimisation result cache** — SHA-truncated key includes fsm_id,
   algorithm, and canonicalised options; hit → skip the whole optimiser
   (`backend/app/services/optimization_service.py:110-119`).
2. **Async task store** — `task:{uuid}` JSON blobs with TTL policy that
   differs by status (7d for running, 24h for terminal). Falls back to
   an in-process dict if Redis is unreachable so the API contract is
   preserved in dev (`backend/app/api/v1/tasks.py:10-30`).
3. **Rate-limit counters** — sliding-window per-IP / per-user with the
   same in-memory fallback pattern (`backend/app/middleware/rate_limit.py`).
4. **JWT blacklist** — logged-out refresh tokens are added to a Redis
   set so they can't be re-used before natural expiry
   (`backend/app/middleware/token_blacklist.py`).

### 1.5 python-jose + passlib[bcrypt]

| Piece | Version pin | Notes |
|---|---|---|
| `python-jose[cryptography]` | `>=3.3.0,<4.0.0` | JWT signing/verification |
| `passlib[bcrypt]` | `>=1.7.4,<2.0.0` | Password hashing |
| `bcrypt` | `>=4.0.0,<4.1.0` | Pinned because passlib 1.7.x is incompatible with bcrypt >=4.1 — see `requirements.txt:28` |

The bcrypt pin is a load-bearing footgun. Without it, `pip install` on
a fresh machine picks bcrypt 4.1+ and passlib's hash routine raises
`AttributeError: module 'bcrypt' has no attribute '__about__'` at first
login. The pin comment in `requirements.txt:28` is deliberate.

### 1.6 NetworkX

| Piece | Version pin | Where |
|---|---|---|
| `networkx` | `>=3.2.1,<4.0.0` | `requirements.txt:24` |

Used inside the graph-embedding algorithms for shortest-path work,
adjacency computation, and graph representation. Not exposed through the
HTTP surface.

---

## 2. Frontend runtime

| Piece | Version pin | Where |
|---|---|---|
| `react` / `react-dom` | `^18.2.0` | `frontend/package.json:26-27` |
| `typescript` | `^5.3.3` | `frontend/package.json:59` |
| `vite` | `^5.4.20` | `frontend/package.json:60` |
| `@vitejs/plugin-react` | `^4.2.1` | dev dep |
| `tailwindcss` | `^3.3.6` | dev dep |
| `react-router-dom` | `^6.28.0` | dep |
| `@tanstack/react-query` | `^5.12.0` | dep |
| `zustand` | `^4.4.7` | dep |
| `reactflow` | `^11.10.1` | dep |
| `recharts` | `^2.10.3` | dep |
| `three` + `@react-three/fiber` + `@react-three/drei` | `^0.159.0` / `^8.15.11` / `^9.92.0` | dep |
| `axios` | `^1.7.9` | dep |
| `react-hook-form` + `@hookform/resolvers` + `zod` | `^7.48.2` / `^3.3.2` / `^3.22.4` | dep |

**Why React 18 + Vite.** Vite's dev server is native-ESM and gives
sub-second HMR against the current tree; CRA (which was still the default
scaffold when this project started) is unmaintained. Vite's production
build is Rollup-backed and does the tree-shaking/chunking we rely on to
keep the initial bundle small — see the `lazyWithRetry` split of
`OptimizationPage` in `frontend/src/App.tsx:24`, which is the single
consumer of recharts.

**Why not Next.js.** The app is fundamentally SPA-shaped: authenticated
canvas editor, per-user drafts held in local Zustand stores, few pages
that would benefit from SSR. Next.js would have added a Node runtime to
the deployment, a routing convention that fights with react-router, and
API-route confusion (we already have a real backend on `/api`). None
of that is worth the SEO tradeoff for a tool nobody is expected to reach
via Google.

**Why not raw React state / Context.** The app has three orthogonal
kinds of state — server (FSM records, examples, algorithms), client
canvas draft (states/transitions being edited before save), and UI
(sidebar, active modal, mobile menu). Trying to serve all three from
`useReducer` + Context forces every consumer to re-render on every
touch; the shape is exactly what react-query + Zustand + a tiny UI
store are designed for. Concrete boundaries:
- **react-query** — server state (`fsmKeys`, `optimizationKeys` — see
  `frontend/src/hooks/useFSM.ts:6-12` for the cache-key factory).
- **Zustand `useFSMStore`** — canvas draft + selection + clipboard
  + undo/redo cursor (`frontend/src/store/fsmStore.ts:12-46`).
- **Zustand `useAuthStore`** — token + user + `isAuthenticated`,
  hydrated from localStorage on load
  (`frontend/src/store/authStore.ts:45-55`).
- **Zustand `useUIStore`** — sidebar open, active modal, mobile menu
  (`frontend/src/store/uiStore.ts`).

**Why not Redux Toolkit.** Zustand does what RTK-with-slices does but
without the boilerplate for a codebase this size (three stores, no
async thunks — the async lives in react-query). RTK's advantage —
Redux DevTools time-travel and a battle-tested middleware system —
isn't worth the API surface here.

**Why Tailwind.** Utility-first CSS, dark-mode via `dark:` variants, no
CSS-in-JS runtime cost. The commit history has multiple `fix(ui):
theme tokens` passes (`c56c8c2`, `e7eb8df`, `33bc963`) — Tailwind's
`bg-neutral-*` tokens are what those PRs consolidate on.

**Why React Flow.** Purpose-built for node-and-edge canvases with
draggable custom node types and edge routing. Rolling this from scratch
on top of raw SVG would have consumed weeks and lost pan/zoom/minimap
for free.

**Why Recharts + Three.js side-by-side.** Recharts owns the 2D charts
(radar, bar, line) — cheap DOM+SVG, no WebGL. Three.js drives the 3D
hypercube. Both are heavy — the Three.js bundle is why
`VITE_ENABLE_3D_HYPERCUBE` exists as an at-build toggle
(`docs/RUNBOOK.md:249`) and why `OptimizationPage` is lazy-imported
(`frontend/src/App.tsx:24`).

**Why axios (with a response interceptor).** The interceptor unwraps the
backend's `{success, data}` envelope at the transport layer so
components read `res.data.<field>` directly
(`frontend/src/api/client.ts:26-45`). The interceptor also handles a
401 by clearing the token and forcing `/login` — one place, applied to
every request.

---

## 3. Persistence

### 3.1 Postgres 15

Configured as `postgres:15-alpine` in `docs/RUNBOOK.md:85` and the
compose files under `infrastructure/docker/`. Stores:
- `fsms` — FSM records with a JSONB `definition` column
- `algorithm_results` — one row per optimisation attempt (snapshot
  including `encoding_map`, `avg_hamming_before/after`, `max_hamming_*`
  after migration `e6a8c9d0b3f1`)
- `users`, `categories`, `examples` — self-explanatory

**Why JSONB for `definition`.** State-and-transition graphs are
irregular — outputs are keyed by state name for Moore, by
(state, input) for Mealy. A relational `states` + `transitions` table
was tried in an earlier iteration; the JSONB shape survived because
graphs are read-modify-write as a whole in the editor, not row-by-row.

**Why Postgres over MySQL/SQLite.** JSONB with GIN indexes (see the
`d4e5f6a7b8c9_add_pg_trgm_index_on_fsms_name.py` migration for the
trigram index on name search) is native and index-able. asyncpg is
built for Postgres. SQLite would have been fine for local dev but
loses the Alembic-managed migrations story once you add a second
service.

### 3.2 Redis 7

Configured as `redis:7-alpine`. Roles enumerated in §1.4 above. The
choice of Redis 7 (over 6) is because RUNBOOK's docker command specifies
it (`docs/RUNBOOK.md:87`); no 7-specific feature is exercised. Downgrade
to 6 would work.

---

## 4. Ops

### 4.1 Docker (multi-stage)

`infrastructure/docker/backend.Dockerfile` — two stages, `python:3.11-slim`.
Builder installs to `--user`; runtime copies `/root/.local` into the
non-root `appuser` home. `postgresql-client` is present in runtime for
`psql`-based smoke tests. Health check hits `/api/v1/health` every 30s.

`infrastructure/docker/frontend.Dockerfile` — three-piece build:
`node:20-alpine` builder → `npm ci` → `npm run build` → nginx:alpine
serves `dist/` and proxies `/api` to the backend. `VITE_API_BASE_URL` is
a **build arg**, not a runtime env — Vite inlines `VITE_*` variables at
build time (`frontend.Dockerfile:26-29`). See
[`deployment.md`](deployment.md) for the consequence.

### 4.2 nginx

Front-of-frontend. Serves the SPA (`try_files $uri $uri/ /index.html`),
proxies `/api`, blocks `.map` sourcemaps, sets cache headers, and adds a
CSP kept in sync with the backend's own SecurityHeaders middleware
(`infrastructure/docker/default.conf.template:82-83`).

**Runtime templating.** `default.conf` is *not* a static config — it's
rendered from `default.conf.template` at container start by the nginx
image's built-in envsubst step. Only variables matching
`NGINX_ENVSUBST_FILTER=BACKEND_` are substituted, so nginx's own
`$host` / `$uri` / `$remote_addr` are left literal
(`frontend.Dockerfile:41-50`). Default is
`BACKEND_PROXY_PASS=http://backend:8000, BACKEND_HOST=backend` — that
works out of the box for docker-compose; a production deploy sets these
to the backend's real hostname.

### 4.3 Railway / Render

The Dockerfile explicitly supports platform-injected `$PORT`
(`backend.Dockerfile:71`) and `config.py:139` normalises
`postgres://` DSNs from managed hosts to `postgresql+asyncpg://`. The
async-task doc string (`backend/app/api/v1/tasks.py:14`) references
"Railway redeploy" as the reason the task store is Redis-backed. **But
there is no `railway.json`, `railway.toml`, or `render.yaml` in the
tree** and `docs/RUNBOOK.md:196-198` explicitly says so. Details in
[`deployment.md`](deployment.md).

---

## 5. CI

| Workflow | File | What it gates |
|---|---|---|
| `ci-cd.yml` | `.github/workflows/ci-cd.yml` | Build + unit tests + image build on tag pushes |
| `contract-tests.yml` | `.github/workflows/contract-tests.yml` | Postgres 15 service, contract tests validate against the OpenAPI spec, plus a nightly cron |
| `database-migration.yml` | `.github/workflows/database-migration.yml` | Alembic `upgrade → downgrade → upgrade` drift check |
| `k8s-validate.yml` | `.github/workflows/k8s-validate.yml` | Static validation of the k8s manifests |
| `secrets-scan.yml` | `.github/workflows/secrets-scan.yml` | `gitleaks` on every PR + weekly cron. Backstop for local pre-commit |
| `security.yml` | `.github/workflows/security.yml` | `npm audit` (blocking on high/critical), `pip-audit` + `bandit` (advisory) |

The `security.yml` blocking policy is deliberately asymmetric (npm audit
blocking, pip-audit advisory) — see the header comment for the
"keeps day-1 noise manageable" rationale.

---

## 6. Observability

| Piece | Version pin | Notes |
|---|---|---|
| `prometheus-client` | `>=0.19.0,<1.0.0` | Backing lib for `/metrics` |
| `opentelemetry-api` / `-sdk` | `>=1.21.0,<2.0.0` | Traces + spans |
| `opentelemetry-instrumentation-fastapi` | `>=0.42b0,<1.0.0` | FastAPI auto-spans |
| `opentelemetry-instrumentation-sqlalchemy` | `>=0.42b0,<1.0.0` | SQLA auto-spans |
| `opentelemetry-exporter-otlp-proto-grpc` | `>=1.21.0,<2.0.0` | OTLP exporter (gRPC) |
| `structlog` | `>=23.2.0,<26.0.0` | Structured request logs |

All observability imports are wrapped in try/except — the app boots
without any of them installed. `setup_metrics(app)` in
`backend/app/observability/metrics.py:232` registers the `/metrics`
route; if `prometheus_client` isn't available it registers a placeholder
route so a scraper doesn't 404 (`metrics.py:257-264`). `setup_telemetry`
in `backend/app/observability/telemetry.py:22` is similarly defensive.

Both are called from `lifespan()` under a bare `try/except Exception`
(`backend/app/main.py:52-61`) so a broken exporter can't stop the app
from starting.

**Prometheus endpoint** is registered at `/metrics` (unprefixed —
`metrics.py:246`). `response_wrapper_middleware` explicitly skips paths
containing `/metrics` so the scrape output stays raw
(`backend/app/middleware/response_wrapper.py:31`).

**Metric surface** (defined in `MetricNames` in
`observability/metrics.py:26-47`):
- `grayfsm_fsm_created_total`, `_deleted_total`, `_updated_total`
- `grayfsm_optimization_started_total`, `_completed_total`, `_failed_total`,
  `_duration_seconds`
- `grayfsm_export_completed_total`, `_failed_total`
- `grayfsm_api_requests_total`, `_request_duration_seconds`,
  `_errors_total`

**Reported metrics from the repo (not currently verified).** The repo
does not surface p50/p95/p99 numbers we can quote. Any perf number that
gets asked about at delivery time should be labelled "reported at
delivery time, not currently verified" — the metric surface exists, the
scrape target exists, but there's no committed load-test artifact in the
tree that pins actual numbers.

---

## 7. Common cross-questions

**Q. Why are there two Postgres drivers in `requirements.txt`?**
A. asyncpg is the runtime driver; psycopg2-binary is what Alembic uses
by default for migrations. Both talk the same protocol. Removing
psycopg2-binary would work only if the Alembic config were pointed at
an async URL and the env.py rewritten to use `run_sync` — not worth the
churn.

**Q. Why is the bcrypt pin so tight (`>=4.0.0,<4.1.0`)?**
A. passlib 1.7.x reads `bcrypt.__about__`, which bcrypt 4.1 removed.
Without the upper cap, a fresh install picks 4.1 and every login raises
`AttributeError`. Documented at `requirements.txt:28`.

**Q. Zustand + react-query + local-component-state is three state
systems. Why not one?**
A. They cover disjoint concerns. Server state (react-query) needs
staleness/refetching/mutations-with-invalidation. Canvas draft state
(Zustand `useFSMStore`) needs synchronous multi-field updates, undo/redo,
and no serialisation to the wire mid-edit. UI state (Zustand
`useUIStore`) is tiny and needs to be readable from anywhere. Forcing
one system to serve all three either pessimises the network (server
state in Zustand → manual invalidation) or the render loop (draft state
in react-query → refetch races).

**Q. Why gate OpenTelemetry behind a try/except at import time?**
A. The observability stack is opt-in. A stripped deploy (no Jaeger, no
OTLP collector) shouldn't need the exporter installed. `setup_telemetry`
and `setup_metrics` are called under a broader try/except in
`lifespan()` — an observability regression can't kill the app boot
(`backend/app/main.py:52-61`).

**Q. Why is FastAPI's OpenAPI spec at `/api/v1/openapi.json` and not
`/openapi.json`?**
A. So the same nginx `/api/*` proxy rule reaches it without a separate
`location /openapi.json {}` block — see the comment at
`backend/app/main.py:104-108`. The frontend colophon links to
`/api/v1/openapi.json` and used to 404 under nginx because openapi was
mounted at root. That's the "changed to keep the frontend link alive"
story.

**Q. Do we actually run Celery?**
A. No. The env keys `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` are
in `docs/RUNBOOK.md:231` (labelled "only if using Celery") but there is
no `Celery()` app object anywhere in the tree. Async optimisation runs
via FastAPI `BackgroundTasks` in the same process
(`backend/app/api/v1/algorithm.py:116-123`), with task state persisted
to Redis so it survives a redeploy (`backend/app/api/v1/tasks.py:10-30`).
