# GrayFSM Runbook

The canonical operational doc. If you need to run, test, deploy, debug, or
extend GrayFSM, start here. Everything else is either source code, a
subtree-specific README pointing back here, or archived history under
`docs/archive/`.

For the project overview (what it is, why Gray codes, screenshots), see the
top-level [`README.md`](../README.md). For contribution conventions, see
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

---

## 1. What it is

GrayFSM is a full-stack web application that takes a finite-state machine
specification (states, transitions, outputs) and assigns each state a binary
encoding such that adjacent transitions differ by a single bit. Where a
single-bit transition isn't possible at a fixed encoding width, the optimiser
inserts intermediate "dummy" states to enforce one. The output is
synthesisable Verilog / VHDL with no glitches from multi-bit register changes.

---

## 2. Architecture (component map)

```
┌─────────────────────────────────────────────────┐
│  Frontend (Vite + React 18 + TS)                │
│  src/pages, src/components, src/store           │
│  Talks to backend over REST (/api/v1/*)         │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│  Backend (FastAPI, Python 3.10+)                │
│  app/ — HTTP, ORM, business logic               │
│  src/grayfsm/ — CLI + reusable algorithm pkg    │
├──────────────────────┬──────────────────────────┤
│   PostgreSQL 15      │         Redis 7          │
│   FSMs, users        │   cache, rate-limit,     │
│   (Alembic-managed)  │   JWT blacklist          │
└──────────────────────┴──────────────────────────┘
```

The backend has two Python entry points sharing the same algorithm code:

- `backend/app/` — the FastAPI HTTP service (`uvicorn app.main:app`).
- `backend/src/grayfsm/` — the standalone `grayfsm` CLI and library that
  imports core algorithms from `app.core.*` (single source of truth).

---

## 3. Local development

### 3.1 Prerequisites

- Python 3.10+
- Node 18+
- Docker (for Postgres + Redis the easy way)

### 3.2 First-time setup

```bash
# Mandatory: the in-code defaults are placeholders that fail config validation.
cp backend/.env.example backend/.env

# Backend deps
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..

# Frontend deps
cd frontend
npm install
cd ..
```

### 3.3 Postgres + Redis (one-shot via Docker)

```bash
docker run -d --name grayfsm-pg \
  -e POSTGRES_USER=grayfsm -e POSTGRES_PASSWORD=devpass \
  -e POSTGRES_DB=grayfsm -p 5432:5432 postgres:15-alpine

docker run -d --name grayfsm-redis -p 6379:6379 redis:7-alpine
```

Then update `backend/.env`:

```
DATABASE_URL=postgresql+asyncpg://grayfsm:devpass@localhost:5432/grayfsm
REDIS_URL=redis://localhost:6379/0
```

### 3.4 Apply migrations

```bash
cd backend
source venv/bin/activate
alembic upgrade head
```

### 3.5 Run

```bash
# Terminal 1 — backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

Or in one go:

```bash
make dev    # parallel backend + frontend
```

Service URLs:

| Service        | URL                          |
|----------------|------------------------------|
| Frontend       | http://localhost:3000        |
| Backend API    | http://localhost:8000/api/v1 |
| Swagger UI     | http://localhost:8000/docs   |
| OpenAPI JSON   | http://localhost:8000/api/v1/openapi.json |

### 3.6 Docker Compose (alternative)

```bash
cd infrastructure/docker
docker compose up -d
docker compose exec backend alembic upgrade head
```

See `infrastructure/README.md` for details and Kubernetes manifests.

---

## 4. Tests

Run everything:

```bash
make check    # ruff + mypy + pytest + tsc + vitest
```

Individually:

| Stack    | Command                                                          |
|----------|------------------------------------------------------------------|
| Backend lint   | `cd backend && ruff check app && mypy app`               |
| Backend unit   | `cd backend && pytest tests/ -v`                         |
| Frontend lint  | `cd frontend && npm run lint && npx tsc --noEmit`        |
| Frontend unit  | `cd frontend && npm test`                                |
| Frontend build | `cd frontend && npm run build`                           |
| Contract       | `cd tests && pytest contract/ -v` (backend must be up)   |
| Integration    | `cd tests && pytest integration/ -v`                     |
| E2E            | `cd e2e && npx playwright install && npm test`           |

CI (`.github/workflows/ci-cd.yml`, `contract-tests.yml`, `k8s-validate.yml`,
`database-migration.yml`, `secrets-scan.yml`) runs on every PR.

---

## 5. Deployment

GrayFSM is deployed via container images. Two supported targets:

### 5.1 Docker Compose (single-host, demo-grade)

```bash
cd infrastructure/docker
docker compose up -d
docker compose exec backend alembic upgrade head
```

Brings up: backend (FastAPI), frontend (Nginx serving the Vite build),
Postgres, Redis, plus optional Prometheus/Grafana.

### 5.2 Kubernetes (production)

Manifests live in `infrastructure/kubernetes/`. Blue-green deployment script
at `infrastructure/scripts/deploy-blue-green.sh`. Database migrations run as
a Kubernetes Job (`kubernetes/database-job.yaml`); see
`infrastructure/DEPLOYMENT-GUIDE.md` for the full procedure.

CI/CD pipeline definition: `.github/workflows/ci-cd.yml`. It builds both
Docker images on tag pushes; deployment to the cluster is gated on
green tests.

There is no Railway / Render / Fly.io config in the tree. If you choose
that path, mount the backend image and provide the env vars in §6.

---

## 6. Environment variables

Authoritative source: `backend/.env.example` and `frontend/.env.example`.
The table below lists every variable the running services read, where it
applies, and whether it must be set explicitly.

### 6.1 Backend (`backend/.env`)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ENVIRONMENT` | yes | `development` | Affects CORS strictness, debug endpoints, HSTS |
| `DEBUG` | no | `True` (dev) | Must be `False` in production |
| `DATABASE_URL` | yes | placeholder | `postgresql+asyncpg://…`; placeholder fails validation |
| `REDIS_URL` | yes | placeholder | Used for cache, rate-limit, JWT blacklist |
| `SECRET_KEY` | yes (prod) | placeholder | JWT signing key; must be rotated from the example |
| `ALGORITHM` | no | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | `30` | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | no | `7` | |
| `JWT_AUDIENCE` | no | `grayfsm-api` | |
| `MAX_FAILED_LOGINS` | no | `5` | Account lockout threshold |
| `ACCOUNT_LOCKOUT_MINUTES` | no | `15` | |
| `CORS_ORIGINS` | yes | `["http://localhost:3000","http://localhost:5173"]` | JSON list; wildcard rejected when credentials are on |
| `CORS_ALLOW_CREDENTIALS` | no | `True` | |
| `TRUSTED_PROXIES` | no | empty | Comma-separated; only these IPs may set `X-Forwarded-For` |
| `RATE_LIMIT_ENABLED` | no | `True` | |
| `RATE_LIMIT_ANONYMOUS` | no | `100` | Per `RATE_LIMIT_WINDOW` |
| `RATE_LIMIT_AUTHENTICATED` | no | `1000` | |
| `RATE_LIMIT_WINDOW` | no | `3600` | seconds |
| `RATE_LIMIT_LOGIN` / `RATE_LIMIT_LOGIN_WINDOW` | no | `5` / `60` | Brute-force throttle on `/auth/login` |
| `RATE_LIMIT_REGISTER` / `RATE_LIMIT_REGISTER_WINDOW` | no | `3` / `60` | Throttle on `/auth/register` |
| `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` | only if using Celery | redis db 1/2 | Async optimisation queue |
| `DEFAULT_ALGORITHM` | no | `greedy` | |
| `ALGORITHM_TIMEOUT_MS` | no | `30000` | |
| `MAX_FSM_STATES` | no | `256` | Hard cap accepted by the API |
| `MAX_OPTIMIZATION_TIME_MS` | no | `300000` | |
| `EXPORT_CACHE_ENABLED` / `EXPORT_CACHE_TTL_DAYS` / `EXPORT_MAX_FILE_SIZE_MB` | no | sane defaults | |
| `SENTRY_DSN` | no | empty | If set, errors are forwarded |
| `METRICS_ENABLED` | no | `True` | Prometheus `/metrics` endpoint |
| `MAX_UPLOAD_SIZE_MB` / `ALLOWED_UPLOAD_FORMATS` | no | `5` / `["json","csv"]` | |

### 6.2 Frontend (`frontend/.env`)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | yes | `http://localhost:8000/api/v1` | |
| `VITE_APP_NAME` | no | `GrayFSM` | |
| `VITE_APP_VERSION` | no | `1.0.0` | |
| `VITE_ENABLE_ANALYTICS` | no | `false` | |
| `VITE_ENABLE_3D_HYPERCUBE` | no | `true` | Toggle Three.js hypercube renderer |

---

## 7. Operational tasks

### 7.1 Database migrations

```bash
cd backend && source venv/bin/activate

# Apply latest
alembic upgrade head

# Create new migration after model edits
alembic revision --autogenerate -m "describe change"

# Roll back one revision
alembic downgrade -1
```

Drift detection: see `backend/alembic/DRIFT.md`. CI runs an
alembic-check step on every PR.

### 7.2 Seeding examples

Built-in example FSMs (traffic light, sequence detector, vending machine,
elevator) live in `backend/examples/*.json` and are served by the
`/api/v1/examples` route. They don't need seeding — they're files on disk.

To make an example queryable via the catalog, create the FSM normally and
set `visibility="example"`. The same access rule applies to `"public"`
and `"example"` (see §8).

### 7.3 Resetting state

```bash
# Wipe and recreate the dev database
docker stop grayfsm-pg && docker rm grayfsm-pg
docker run -d --name grayfsm-pg \
  -e POSTGRES_USER=grayfsm -e POSTGRES_PASSWORD=devpass \
  -e POSTGRES_DB=grayfsm -p 5432:5432 postgres:15-alpine
cd backend && alembic upgrade head

# Flush the Redis cache (rate-limit counters, export cache, JWT blacklist)
docker exec grayfsm-redis redis-cli FLUSHALL
```

### 7.4 Inspecting logs

The backend uses structured (JSON) logging via `app/middleware/logging.py`.
Each request gets a correlation ID logged with the response code and
duration.

```bash
# Local
docker logs -f grayfsm-pg
docker logs -f grayfsm-redis
# Backend logs to stdout — visible in your uvicorn terminal

# Docker Compose
docker compose logs -f backend
docker compose logs -f frontend

# Kubernetes
kubectl -n grayfsm logs -f deployment/backend
```

### 7.5 Restarting services

```bash
# Docker Compose
docker compose restart backend

# Kubernetes
kubectl -n grayfsm rollout restart deployment/backend
```

---

## 8. Access control & visibility

Every FSM has a `visibility` field with three values:

| Value      | Who can read | Who can write |
|------------|--------------|---------------|
| `private`  | Owner only   | Owner only    |
| `public`   | Anyone (incl. anonymous) | Owner only |
| `example`  | Anyone (incl. anonymous) | Owner only |

The rule is enforced in `backend/app/services/fsm_service.py:_check_ownership`
and at the read path (`get_fsm`, `list_fsms`, `fork_fsm`). The check is
`fsm.visibility not in ("public", "example")` → require owner match.

Derived (already-optimised) FSMs cannot be re-optimised — the route handler
in `backend/app/api/v1/algorithm.py` rejects this. Set
`visibility="example"` on a curated FSM if you want anonymous users to
read it from the catalog.

---

## 9. Subsystem map

| Path | What lives there |
|---|---|
| `backend/app/` | FastAPI HTTP service (api, services, models, schemas, middleware) |
| `backend/app/api/v1/` | Route definitions (fsm, auth, algorithm, export, health, tasks, category, example) |
| `backend/app/core/` | Gray code, hypercube, optimisation algorithms, exporters |
| `backend/app/middleware/` | security_headers, error_handler, rate_limit, response_wrapper, logging, auth, token_blacklist |
| `backend/src/grayfsm/` | Standalone CLI + library (imports `app.core.*`) |
| `backend/alembic/` | Migration history + drift docs |
| `backend/examples/` | Built-in example FSMs (JSON) |
| `frontend/src/pages/` | Catalog, Editor, Optimisation, Export, Gallery, About, Lab Report |
| `frontend/src/components/` | UI primitives, FSM canvas, visualisations, layout |
| `frontend/src/store/` | Zustand stores (fsm, editor, ui) |
| `frontend/src/api/` | Axios client + typed endpoint wrappers |
| `database/` | Schema reference snapshot, seed queries (Alembic is authoritative) |
| `infrastructure/` | Dockerfiles, K8s manifests, deploy scripts, monitoring config |
| `tests/` | Contract, integration, and load tests (full-stack) |
| `e2e/` | Playwright end-to-end tests |
| `docs/` | RUNBOOK (this file), OpenAPI spec, architecture diagrams, agents, archive |
| `security/` | Reference middleware drops, deployment checklist (most material now implemented) |

---

## 10. Recently-shipped feature log

The questions of the form "is X done?" — answers below. If a feature is in
this list it is in `main` and exercised by tests.

- **Greedy optimiser** (`app/core/algorithms/greedy.py`)
- **BFS-optimal optimiser** (`app/core/algorithms/bfs_optimal.py`)
- **Simulated annealing** (`app/core/algorithms/simulated_annealing.py`)
- **Global SA / Global GA** — encoding reassignment variants (`global_sa`, `global_ga` algorithm IDs)
- **HDL exporters** — Verilog, VHDL, JSON, CSV, SystemVerilog assertions, testbench
- **CSV export** tolerates `None` input/output on transitions (fixed in `71d08ce`)
- **Optimization comparison view** — side-by-side metrics across algorithms
- **Hypercube visualization** — 2D and 3D (Three.js)
- **Lab Report** page — long-form theory + algorithm walkthrough
- **JWT authentication** with refresh token + httpOnly cookie + Redis-backed blacklist
- **Account lockout** after configurable failed-login threshold
- **Rate limiting** per-IP and per-user, Redis-backed, with brute-force throttle on auth routes
- **Security headers** middleware — CSP, HSTS, X-Frame-Options, etc.
- **CORS hardening** — wildcard-with-credentials rejected at startup
- **Visibility-aware access control** — `private`/`public`/`example` with
  unified rule for anonymous reads
- **Block re-optimization of derived FSMs** — prevents stacking optimisation
  on already-optimised graphs (fixed in `25d2fed`)
- **Mobile-responsive UI** refactor (`04faff…`)
- **Forking** — anonymous-readable FSMs can be forked into a user's catalog
- **Background tasks** — async optimisation via FastAPI BackgroundTasks /
  Celery (configurable)
- **Prometheus `/metrics`** endpoint and structured (JSON) request logging
  with correlation IDs

---

## 11. Where to find more

| Topic | Source of truth |
|---|---|
| API contract | `docs/openapi-spec.yaml` (also exposed at `/api/v1/openapi.json`) |
| Database schema | `backend/alembic/versions/*` (snapshot at `docs/database-schema.sql`) |
| Deployment (K8s) | `infrastructure/DEPLOYMENT-GUIDE.md`, `infrastructure/RUNBOOK.md` |
| Security checklist (pre-deploy) | `security/DEPLOYMENT_SECURITY_CHECKLIST.md` |
| Contributing conventions | `CONTRIBUTING.md` |
| Historical implementation reports | `docs/archive/` |
| Agent personas (for AI workflows) | `docs/agents/` |

If something contradicts this runbook, this runbook is meant to be right —
file a PR to fix it.
