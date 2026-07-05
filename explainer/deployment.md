# Deployment

How the app gets from source to a running URL. The intended topology,
the actual Docker layout, the env-var contract, and the migration story
— with the sharp edges called out.

Cross-links: [`tech-stack.md`](tech-stack.md) enumerates what's in each
image; [`architecture.md`](architecture.md) traces a request through
the deployed stack.

---

## 1. Railway-style topology (intended)

The tree is written to run on a container platform that provisions
Postgres and Redis as separate managed services and gives the app its
runtime port via `$PORT`. Railway matches this shape; Render and Fly.io
do too. The topology below is what the Dockerfiles + config were
designed against.

```
┌─────────────────────────────────────────────────────────────┐
│                     Railway project                          │
│                                                              │
│  ┌────────────────┐         ┌────────────────┐               │
│  │  frontend      │         │  backend       │               │
│  │  nginx:alpine  │◀──proxy─│  fastapi       │               │
│  │  serves dist/  │  /api   │  uvicorn:$PORT │               │
│  │  port 80 → 443 │         │  port :$PORT   │               │
│  └────────┬───────┘         └───┬────────┬───┘               │
│           │  public URL         │        │                   │
│           │                     ▼        ▼                   │
│           │           ┌────────────┐  ┌──────────┐           │
│           │           │ postgres   │  │ redis    │           │
│           │           │ 15         │  │ 7        │           │
│           │           │ managed    │  │ managed  │           │
│           │           └────────────┘  └──────────┘           │
│           │                                                  │
│           ▼                                                  │
│      User browser                                            │
└─────────────────────────────────────────────────────────────┘
```

**Actual state of the tree.** `docs/RUNBOOK.md:196-198` states plainly:

> There is no Railway / Render / Fly.io config in the tree. If you
> choose that path, mount the backend image and provide the env vars
> in §6.

The Dockerfile binds `$PORT` with fallback `8000`
(`infrastructure/docker/backend.Dockerfile:71`) and the config
validator normalises `postgres://` scheme prefixes that managed
platforms inject (`backend/app/config.py:139`). Those are the platform
hooks — no `railway.json`, `railway.toml`, or `render.yaml` exists
alongside them. `backend/app/api/v1/tasks.py:14` also cites "Railway
redeploy" as the specific motivation for making the task store durable.

If you shipped this to Railway, you'd have four service definitions
(frontend, backend, postgres, redis). The K8s manifests under
`infrastructure/kubernetes/` are the closest thing in-tree to a
production topology and are a good reference for the env-var wiring
between services.

---

## 2. Docker layout

Two multi-stage Dockerfiles under `infrastructure/docker/`. Multi-stage
is deliberate: the runtime images don't carry build toolchains, cutting
attack surface and image size.

### 2.1 `backend.Dockerfile`

```
Stage 1 (builder)   python:3.11-slim
  apt-get install build-essential, postgresql-client
  pip install --user -r backend/requirements.txt

Stage 2 (runtime)   python:3.11-slim
  apt-get install postgresql-client, curl  (no build tools)
  useradd -r appuser  (non-root)
  COPY --from=builder /root/.local /home/appuser/.local
  COPY backend/app        → /app/app
  COPY backend/alembic*   → /app/alembic*  (config + migrations)
  COPY backend/examples   → /app/examples   (seed source)
  HEALTHCHECK GET /api/v1/health
  CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Key decisions:

- **postgresql-client stays in the runtime.** Not for the app to use —
  for `psql` in `docker exec` when you need to poke the DB from inside
  the container. Adds ~5MB.
- **Migrations bundled into the image.** `alembic.ini` + `alembic/` are
  copied so `alembic upgrade head` can run inside the container. The
  CMD does **not** run it. See §4.
- **Examples bundled into the image.** `ExampleService` reads
  `<app>/../examples/*.json` — without the copy the `/api/v1/examples`
  route returns nothing (`backend.Dockerfile:49-51`).
- **Non-root user.** `appuser` owns `/app`; the container drops root
  before uvicorn starts.

### 2.2 `frontend.Dockerfile`

```
Stage 1 (builder)   node:20-alpine
  apk add python3, make, g++    (for native deps in some packages)
  npm ci --prefer-offline --no-audit
  ARG VITE_API_BASE_URL=/api/v1
  ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
  npm run build   → /app/dist

Stage 2 (runtime)   nginx:alpine
  COPY nginx.conf                → /etc/nginx/nginx.conf
  COPY default.conf.template     → /etc/nginx/templates/default.conf.template
  ENV BACKEND_PROXY_PASS=http://backend:8000
  ENV BACKEND_HOST=backend
  ENV NGINX_ENVSUBST_FILTER=BACKEND_
  COPY --from=builder /app/dist  → /usr/share/nginx/html
```

Multi-stage rationale: Node isn't in the runtime image. nginx serves the
static `dist/` output only. That drops the runtime image from a couple
of hundred MB to ~20-40 MB and removes every Node CVE surface from the
prod attack surface.

---

## 3. Environment variables

The complete, authoritative table is in `docs/RUNBOOK.md` §6.1 (backend)
and §6.2 (frontend). Highlights that shape deployment:

**Backend, must-be-set-in-every-env-except-test:**

| Var | Rejects | Enforced at |
|---|---|---|
| `DATABASE_URL` | placeholder `_placeholder_` sentinel | `config.py:183-189` |
| `REDIS_URL` | placeholder `_placeholder_` sentinel | `config.py:190-193` |

**Backend, production-only additional hardening**
(`backend/app/config.py:198-218`):

| Check | Fails on |
|---|---|
| `SECRET_KEY` must not be empty or contain `change-in-production` | placeholder |
| `SECRET_KEY` must be ≥ 32 bytes | short key |
| `DEBUG` must be `False` | development leak |
| `DATABASE_URL` must not contain `grayfsm:password@` | dev-default creds |
| `CORS_ORIGINS != ["*"]` | wildcard CORS in prod → warning |

The check that will most reliably catch a misconfigured deploy is the
`SECRET_KEY` one. The `model_validator` fires at
`Settings()` instantiation — before `create_engine`, before any route
registration — so a misconfigured container crashes fast with a clear
`ValueError` at boot instead of dying midway through the first request.

**Frontend, build-time only:**

| Var | Notes |
|---|---|
| `VITE_API_BASE_URL` | Baked in at `vite build`. Not read at runtime. Default `/api/v1` for same-origin nginx. |
| `VITE_ENABLE_ANALYTICS` | Compile-time flag. |
| `VITE_ENABLE_3D_HYPERCUBE` | Compile-time flag; disables Three.js chunk-loading paths when false. |

See §6 for the Vite baked-in-at-build-time constraint.

---

## 4. Migrations

The authoritative migration history lives in
`backend/alembic/versions/`. Eight revisions from `5c754bee004e` (initial)
through `g7b9d0e1c4f2` (clean-slate reseed).

**The awkward part.** Two mechanisms exist to bring a fresh DB up:

1. **`alembic upgrade head`** — the documented, versioned, drift-checked
   mechanism. RUNBOOK §7.1 (`docs/RUNBOOK.md:257-268`) tells operators
   to run this. K8s deploys have a dedicated job
   (`infrastructure/kubernetes/database-job.yaml:58`) that runs
   `alembic upgrade head` before the app pods start. CI drift check
   (`.github/workflows/database-migration.yml`) exercises the
   `upgrade → downgrade → upgrade` cycle on every PR.

2. **`Base.metadata.create_all`** — called from
   `backend/app/db/session.py:74-78` inside the `create_db_and_tables`
   coroutine, which is invoked from the FastAPI `lifespan` at
   `backend/app/main.py:46`. This creates all tables from the SQLAlchemy
   models at boot regardless of migration state.

The container CMD does not run `alembic upgrade head`
(`infrastructure/docker/backend.Dockerfile:71`). So on a container
platform (Railway, Docker Compose), what actually creates the schema is
mechanism 2, not mechanism 1. That's fine on a *first boot against an
empty database* (`create_all` is idempotent and won't touch existing
tables). It's dangerous when you add a migration that alters an existing
table — `create_all` won't apply it, and the app will crash on a query
that expects the new column.

**Practical implication.** On Railway or any other platform that just
runs `CMD`, an operator has to run `alembic upgrade head` themselves
before the deploy — either as a release phase, a one-shot task, or by
overriding the CMD. RUNBOOK §5.1 tells you to do this in Docker Compose:

```
docker compose exec backend alembic upgrade head
```

If a redeploy lands a code path that needs a schema change and the
operator forgets, `create_all` will silently do nothing (the tables
already exist) and requests hitting the un-migrated columns will 500.

The `docs/RUNBOOK.md` line that mentions "alembic upgrade head runs at
container start" (paraphrased in the task prompt) does not match the
actual container CMD — see the inconsistencies noted in the report to
the caller.

**What happens on a redeploy mid-migration.** Because migrations run
externally (K8s job or manual exec), the deployment is expected to be
gated on migration completion. A mid-migration redeploy of the app pods
would race: half the fleet queries against the pre-migration schema, half
against the post-migration schema. K8s manifests treat the migration
job's success as a precondition. Docker Compose has no such gate; the
operator is expected to sequence `alembic upgrade head` before
restarting the backend.

---

## 5. Boot-time example seeder

`backend/app/db/session.py:81-127` — `_seed_examples_if_empty()`. Called
from `create_db_and_tables()` after `create_all`, meaning it runs on
every boot but short-circuits when the `fsms` table is non-empty. What
it does:

```python
count = await session.scalar(select(func.count()).select_from(FSM))
if count and count > 0:
    return
# else:
examples = await ExampleService().list_examples()   # reads examples/*.json
for example in examples:
    session.add(FSM(
        name=example["name"],
        ...
        visibility="example",       # anonymous-readable
        is_optimized=False,
        dummy_state_count=0,
    ))
await session.commit()
```

Consequences to know:

- **Idempotent by empty-table gate, not by conflict handling.** Once the
  `fsms` table has any row, seeding is skipped forever. There's no
  reconciliation — if `examples/*.json` changes after first boot, the
  new example doesn't get inserted automatically.
- **Runs inside `create_db_and_tables`** — before observability
  initialisation (`main.py:52-61`), before any request. A slow seed
  would delay readiness.
- **JSON files are what's copied into the image**
  (`backend.Dockerfile:51`). Adding an example needs a rebuild.
- **The `definition` JSONB includes `initial_state`** — this was a bug
  fix ("KeyError mid-transaction" comment at `session.py:101-104`); the
  optimizer reads `definition["initial_state"]` when persisting the
  derived FSM.

The examples get `visibility="example"`, which per the visibility rule
in `backend/app/services/fsm_service.py` is anonymous-readable. That's
why the catalog and gallery pages work without a login.

---

## 6. nginx template rendering

The frontend image ships `default.conf.template`, not `default.conf`.
The nginx alpine image's entrypoint runs `envsubst` over
`/etc/nginx/templates/*.template` at container start, filtered by
`NGINX_ENVSUBST_FILTER=BACKEND_` (`frontend.Dockerfile:50`).

Variables substituted:

| Template variable | Default | What to override for real deploy |
|---|---|---|
| `${BACKEND_PROXY_PASS}` | `http://backend:8000` | `https://your-backend.railway.app` or wherever |
| `${BACKEND_HOST}` | `backend` | The upstream's canonical hostname (used for `Host:` + SNI) |

Every other nginx variable (`$host`, `$uri`, `$remote_addr`,
`$proxy_add_x_forwarded_for`, `$scheme`, `$http_upgrade`) is left
literal because the filter only matches `BACKEND_*`. That's why the
security-headers section renders correctly without wrapping `$` in a
dozen escapes (`default.conf.template:72-83`).

**Same-origin production deploy.** Frontend and backend on the same
domain (`app.example.com`) → nginx proxies `/api/*` to a sidecar or
same-cluster upstream. No CORS. `VITE_API_BASE_URL=/api/v1`.

**Cross-origin production deploy.** Frontend at `app.example.com`, API
at `api.example.com`. Two choices:
- Continue to proxy through the frontend's nginx — set
  `BACKEND_PROXY_PASS=https://api.example.com`,
  `BACKEND_HOST=api.example.com`. Frontend sees same-origin.
- Bypass the proxy — set `VITE_API_BASE_URL=https://api.example.com/api/v1`
  at *frontend build time* (§7). CORS gets involved; the backend's
  `CORS_ORIGINS` must include the frontend origin, and
  `CORS_ALLOW_CREDENTIALS=true` requires an exact-origin allowlist (not
  wildcard — enforced at `backend/app/main.py:138`).

---

## 7. Vite bakes VITE_API_BASE_URL at build time

Vite inlines `VITE_*` environment variables at `vite build` time as
literal string constants in the emitted JavaScript
(`frontend.Dockerfile:26-29`). This is a Vite constraint, not a project
choice — Vite has no runtime env-loading mechanism for the browser
bundle, because there is no server to read env from once the SPA is
loaded.

Practical implications:

- **You cannot change `VITE_API_BASE_URL` on an existing image by
  setting an env var at runtime.** The value is already burned into
  `assets/index-<hash>.js`.
- **Same image cannot serve two backends.** If staging talks to
  `api-staging.example.com` and production talks to `api.example.com`,
  you build two frontend images — or you configure nginx's `/api`
  proxy to route to the right upstream per deploy.
- **The Dockerfile passes it as a `--build-arg`** — the standard
  pattern is `docker build --build-arg VITE_API_BASE_URL=/api/v1
  -t frontend .`.

The default `/api/v1` in the ARG line
(`frontend.Dockerfile:28`) targets a same-origin nginx proxy, which is
the topology this project expects to run in.

---

## 8. What breaks on a redeploy (and what PR #71 fixed)

Container platforms restart your process on every deploy. What survives
a restart, what doesn't:

| Thing | Before PR #71 (72f3c15) | After |
|---|---|---|
| DB rows | Survives | Survives (Postgres is external) |
| Cached optimisation results | Survives | Survives (Redis is external) |
| Rate-limit counters | Survives | Survives (Redis) |
| JWT blacklist | Survives | Survives (Redis) |
| **In-flight async optimisation task state** | **Dies with the process** (in-memory dict) | **Survives** (Redis-backed with in-memory fallback) |

The last row is what PR #71 fixed —
`72f3c15 feat(infra): durable Redis-backed task store + security CI gates (#71)`.
Before, if a user hit `POST /optimize` with `async=true` and the platform
redeployed the backend during the run, the task was lost — the polling
loop would eventually 404 the `task_id`. After PR #71, task state lives
in Redis at `task:{uuid}` with a TTL policy that reflects task status
(`backend/app/api/v1/tasks.py:49-54`).

The Redis-backed store keeps a per-process in-memory fallback so the
optimize endpoint still works in dev when Redis is down (see the
"degraded mode by design" comment at `tasks.py:61-65`) — but that
fallback loses durability, which is exactly the failure mode the PR
fixed for prod.

**Note on background task continuity.** Making the *store* durable does
not make the *worker* durable. The optimisation actually runs inside
the FastAPI process's `BackgroundTasks` runner
(`backend/app/api/v1/algorithm.py:116-123`). A mid-run redeploy still
kills the worker mid-computation. What the Redis-backed store gives you
is that the *task record* is preserved with `status="running"` until
its TTL expires (7 days for running tasks) — so a poll still gets a
useful response instead of a 404. The user experience is "task stuck
in running", not "task vanished". True worker-level durability would
require an out-of-process queue (Celery / Arq / RQ), which the tree is
wired for (`CELERY_BROKER_URL` env keys exist) but does not currently
run.

---

## 9. Common cross-questions

**Q. Why isn't there a `railway.json` if the app is designed for
Railway?**
A. It's designed to be Railway-*compatible* — `$PORT` binding, DSN
scheme normalisation, durable task store — but the operator provides
the platform config themselves. The RUNBOOK explicitly disclaims a
committed Railway config (`docs/RUNBOOK.md:196-198`). K8s is the
in-tree "known-good production topology" reference.

**Q. If `Base.metadata.create_all` runs at boot, what does Alembic even
do?**
A. `create_all` handles the "fresh database, no tables" case idempotently.
Alembic handles every case *after* that: renaming a column, adding an
index, changing a nullable → not null, seeding categories. On a fresh
boot against an empty DB either mechanism works; on any evolution
Alembic is authoritative. The K8s and Docker-Compose workflows run
`alembic upgrade head` as a separate step. The Dockerfile CMD does not.
That coexistence is uneasy — see §4.

**Q. How do I run a migration on Railway if the CMD doesn't run it?**
A. Either (a) run `alembic upgrade head` as a Railway release command
before the app process starts, (b) `railway run alembic upgrade head`
from a local shell against the deployed environment, or (c) override
the CMD to `sh -c "alembic upgrade head && uvicorn ..."`. Option (c)
gets you the intended "migrate at container start" story; the tradeoff
is that during a rolling deploy every replica tries to migrate,
which is fine for Alembic's own locking but adds seconds to each cold
start. K8s solves it with a Job.

**Q. Is the seeder idempotent enough for a multi-replica deploy?**
A. Not really. Two backends starting at once against an empty DB will
both count `fsms=0`, both start seeding, and both try to INSERT the
same examples. The primary-key clash raises on `commit()`. In practice
this hasn't hit because the seeder is fast (< 1s for a handful of
examples) and platforms tend to start replicas serially. For a robust
multi-replica boot, the seed should either happen as a migration or be
wrapped in a Postgres advisory lock. Currently it's neither.

**Q. Why does the frontend nginx also emit security headers when the
backend already does?**
A. So a direct-to-nginx deploy without the FastAPI SecurityHeaders
middleware behind it (or with it misconfigured) still ships hardened
responses. And so the SPA's own bundle — served by nginx, not proxied —
picks up the same policy. The FastAPI middleware and the nginx template
are kept intentionally in sync
(`infrastructure/docker/default.conf.template:81-82`).

**Q. What's the smallest set of env vars to boot the backend against a
real DB and Redis?**
A. Four: `ENVIRONMENT` (anything other than the default `development`
if you want the prod-hardening branch), `DATABASE_URL`, `REDIS_URL`,
`SECRET_KEY`. The validator will reject anything with the placeholder
sentinel or the dev password. Everything else has a working default in
`backend/app/config.py`.

**Q. What breaks if I set `CORS_ORIGINS=["*"]` and `CORS_ALLOW_CREDENTIALS=true`?**
A. The app refuses to boot. `backend/app/main.py:138` raises
`RuntimeError` before the middleware is registered. Wildcard-with-
credentials is a spec violation (browsers reject it) and every real
deploy has been misconfigured this way at some point; the check is
there to fail loudly at boot rather than silently at first cross-origin
request.
