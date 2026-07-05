# Backend Architecture — GrayFSM API

Presenter-prep notes for the FastAPI backend. Everything here is grounded in a
file/line reference in the current tree; if a claim isn't backed by a
reference, treat it as suspect.

Scope: application bootstrap, configuration, middleware stack, service layer,
async task path, and the end-to-end lifecycle of an FSM row. Deep-dives on
data storage live in `database.md`; endpoint reference lives in
`api-endpoints.md`.

---

## 1. Application bootstrap

Entry point: `backend/app/main.py`. Everything the process does at startup is
in the `lifespan` async context (`backend/app/main.py:35-84`), wired into
FastAPI via `FastAPI(..., lifespan=lifespan)` at
`backend/app/main.py:112`.

### 1.1 Lifespan phases

Startup, in order:

| Step | Code | Purpose |
| --- | --- | --- |
| 1 | `backend/app/main.py:46` `create_db_and_tables()` | Runs `Base.metadata.create_all` synchronously inside `engine.begin()` then seeds examples. See `backend/app/db/session.py:74-78`. |
| 2 | `backend/app/main.py:53-58` `setup_telemetry(app)` + `setup_metrics(app)` | Lazy imports so the app boots even if `opentelemetry` / `prometheus_client` aren't installed — both are wrapped in `try/except` that logs a warning and continues. |
| 3 | `backend/app/main.py:63` `yield` | Hands control to uvicorn. |

Shutdown, in order:

| Step | Code | Purpose |
| --- | --- | --- |
| 1 | `backend/app/main.py:69-74` `shutdown_telemetry()` | Flushes exporter queues; swallowed exception if telemetry never came up. |
| 2 | `backend/app/main.py:77-82` `close_redis()` | Idempotent — safe to call even if the Redis client was never built (see `backend/app/cache.py:14-27`). |
| 3 | `backend/app/main.py:84` `await engine.dispose()` | Drops the asyncpg pool. Runs unconditionally at end of lifespan. |

Note: `create_db_and_tables()` uses `Base.metadata.create_all`, which is
idempotent on repeated boots but does **not** replace Alembic — schema drift
between the ORM and migrations is handled at migration time, not here (see
`backend/alembic/versions/f5125b99928d_align_head_with_models.py`).

### 1.2 App-level config

```python
# backend/app/main.py:88-113
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/api/v1/docs" if settings.debug else None,
    redoc_url="/api/v1/redoc" if settings.debug else None,
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)
```

The docs paths are prefixed with `/api/v1` deliberately (`backend/app/main.py:104-108`
explains why): nginx proxies `/api/v1/*` but not `/openapi.json` at the
root, so the frontend link from the About page would 404 without the prefix.
When `settings.debug=False`, `docs_url` and `redoc_url` are set to `None`,
disabling Swagger UI/Redoc in production.

### 1.3 Router mounting

All routers mount under `API_PREFIX = "/api/v1"`
(`backend/app/main.py:164`):

| Router | Path | Line |
| --- | --- | --- |
| `health.router` | `/api/v1` | `backend/app/main.py:166` |
| `fsm.router` | `/api/v1/fsms` | `backend/app/main.py:168` |
| `algorithm.router` | `/api/v1/fsms` (shares prefix with fsm) | `backend/app/main.py:170` |
| `export.router` | `/api/v1/fsms` (shares prefix) | `backend/app/main.py:172` |
| `category.router` | `/api/v1/categories` | `backend/app/main.py:174` |
| `example.router` | `/api/v1/examples` | `backend/app/main.py:176` |
| `auth.router` | `/api/v1/auth` | `backend/app/main.py:178` |
| `tasks.router` | `/api/v1/tasks` | `backend/app/main.py:180` |

Note the deliberate prefix reuse: `algorithm.router` and `export.router` both
mount under `/api/v1/fsms` so their endpoints appear as
`/api/v1/fsms/{fsm_id}/optimize`, `/api/v1/fsms/{fsm_id}/export`. They also
each expose one non-`{fsm_id}` sibling — `/api/v1/fsms/algorithms` (list) and
`/api/v1/fsms/formats` (list) — which is a slightly awkward URL shape but
avoids adding two extra top-level prefixes.

### 1.4 Root-level exception handlers

Two handlers registered *directly on the app* (not middleware) at
`backend/app/main.py:183-213`:

- `@app.exception_handler(HTTPException)` — wraps `HTTPException.detail` into
  the standard `{success: false, error: {code, message}}` envelope. Without
  this, FastAPI defaults would return `{"detail": "..."}`, breaking the
  frontend's `success/error` contract.
- `@app.exception_handler(RequestValidationError)` — wraps 422 responses
  with `code: "VALIDATION_ERROR"` and includes `exc.errors()` in `details`.
  Note: this is a **different** validation-error path from
  `error_handler_middleware` (`backend/app/middleware/error_handler.py:42-68`),
  which sanitizes the errors more aggressively (`field`+`message` only). In
  practice `RequestValidationError` is raised by FastAPI *before* the
  middleware chain wraps the endpoint's return, so this app-level handler
  usually fires first. See cross-questions below.

### 1.5 Root endpoint

`GET /` (`backend/app/main.py:216-233`) returns a hand-built envelope
`{success, data, metadata}`. This is one of the two paths that pre-wrap
their response — see §3.6.

---

## 2. Configuration layer

`backend/app/config.py` uses **Pydantic Settings** (`pydantic_settings`)
which reads from `.env` and environment variables and validates on
instantiation.

### 2.1 Loading

```python
# backend/app/config.py:121-123
model_config = SettingsConfigDict(
    env_file=".env",
    env_file_encoding="utf-8",
    case_sensitive=False,
    extra="ignore",
)
```

- `case_sensitive=False` → `DATABASE_URL`, `database_url`, `Database_Url`
  are all accepted.
- `extra="ignore"` → unknown env vars don't crash startup.
- The global instance `settings = Settings()` is built at import time
  (`backend/app/config.py:240`), which means **any validation failure blocks
  the import of `app.config`** — the process dies before `main.py` even
  runs.

### 2.2 The runtime validator (security control)

`validate_runtime_settings` (`backend/app/config.py:166-226`) is a
`@model_validator(mode="after")` that fires once at settings construction.
It enforces three tiers of policy:

1. **test / ci** (`environment in ("test", "ci")`): skip all checks. Tests
   run with placeholder URLs that would otherwise fail.
2. **development / staging / production**: reject `DATABASE_URL` or
   `REDIS_URL` that still contain the `_placeholder_` sentinel. Fails fast
   at `Settings()` construction with a clear message, instead of dying
   inside SQLAlchemy on the first query.
3. **production only**: additionally rejects
   - empty or `"change-in-production"`-containing `SECRET_KEY`
     (`backend/app/config.py:199-206`)
   - `SECRET_KEY` shorter than 32 bytes
   - `DEBUG=True`
   - the dev-default DB user `grayfsm:password@` in the URL
     (`backend/app/config.py:214-218`) — catches "shipped the .env
     defaults" mistakes
   - `cors_origins == ["*"]` (warns only — doesn't reject)

This is often overlooked in reviews: the SECRET_KEY placeholder gate is
enforced at *config load*, not at *first token creation*, so a bad prod
deploy fails at boot instead of the first login attempt.

### 2.3 Database URL normalization

```python
# backend/app/config.py:134-148
@field_validator("database_url", mode="after")
def force_async_pg_driver(cls, v: str) -> str:
    for sync_prefix in ("postgresql+psycopg2://", "postgresql://", "postgres://"):
        if v.startswith(sync_prefix):
            return "postgresql+asyncpg://" + v[len(sync_prefix) :]
    return v
```

Why: managed hosts (Railway, Render, Heroku) inject `postgres://` or
`postgresql://`, which SQLAlchemy would resolve to the sync psycopg2 driver.
This app uses asyncpg via `create_async_engine`
(`backend/app/db/session.py:22`) so the URL is rewritten in-place before
the engine is built. Non-postgres URLs (e.g. SQLite in tests) are left
untouched.

### 2.4 CORS parsing

`parse_cors_origins` (`backend/app/config.py:150-156`) accepts a
comma-separated string *or* a list — this lets the same setting come from
`.env` (`CORS_ORIGINS=http://a,http://b`) or a K8s ConfigMap list.

`parse_trusted_proxies` (`backend/app/config.py:158-164`) does the same
for `TRUSTED_PROXIES`, with the extra wrinkle that the field is annotated
with `NoDecode` (`backend/app/config.py:84-87`). Without `NoDecode`,
pydantic-settings' built-in JSON decoding tries to parse the empty string
and blows up.

---

## 3. Middleware chain

**Order matters.** Starlette treats the *last-registered* middleware as the
*outermost* — meaning it runs first on the request and last on the response.
This applies to both `add_middleware(Class, ...)` and
`app.middleware("http")(func)` — they share the same stack.

The comments in `backend/app/main.py:117-130` explicitly document the intended
execution order. Reading the code top-to-bottom, registration order is:

```
GZip                 (add_middleware)
CORS                 (add_middleware)
SecurityHeaders      (add_middleware)     ← outermost of class-based
response_wrapper     (http decorator)     ← first http decorator
rate_limit           (http decorator, if enabled)
error_handler        (http decorator)
logging              (http decorator)     ← last-registered → outermost overall
```

**Execution order** (outermost → innermost), which is what you actually want
to remember:

```
request  ──▶ logging ──▶ error_handler ──▶ rate_limit ──▶ response_wrapper
             │
             └─▶ SecurityHeaders ──▶ CORS ──▶ GZip ──▶ route handler
                                                       │
response ◀───── (headers/body flow back through the same stack, inside-out) ─┘
```

Every response passes through **logging last** (adds `X-Request-ID`) and
**SecurityHeaders eventually** (adds CSP, HSTS, etc.).

### 3.1 SecurityHeadersMiddleware

`backend/app/middleware/security_headers.py:28-140`. Sets on every response:

| Header | Value | Note |
| --- | --- | --- |
| `Content-Security-Policy` | dev vs prod policy | dev allows `'unsafe-inline' 'unsafe-eval'` for React HMR (`security_headers.py:52-66`); prod locks `script-src` to `'self'` (`security_headers.py:76-89`). `style-src 'unsafe-inline'` is retained in prod because three.js / recharts / react-flow inject runtime `<style>` blocks. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Prod only (`security_headers.py:108-111`). |
| `X-Frame-Options` | `DENY` | Anti-clickjacking. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing. |
| `X-XSS-Protection` | `1; mode=block` | Legacy; modern browsers rely on CSP. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | |
| `Permissions-Policy` | disables geolocation/mic/camera/payment/usb | |
| `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` | Prod only (`security_headers.py:132-134`) — COEP breaks some dev tools, so skipped in dev. |

It also **strips the `Server` header** (`security_headers.py:137-138`) to
reduce fingerprinting.

### 3.2 CORS

`fastapi.middleware.cors.CORSMiddleware`, registered at
`backend/app/main.py:144-150`. All parameters come from settings.

There is a **guard** at `backend/app/main.py:138-141`:

```python
if settings.cors_origins == ["*"] and settings.cors_allow_credentials:
    raise RuntimeError("CORS: Cannot use wildcard origins with allow_credentials=True")
```

This is a hard runtime failure. Browsers refuse `Access-Control-Allow-Origin: *`
combined with credentials, so shipping that combo is a config bug — the app
refuses to boot.

Wildcard origins in a non-development environment log a warning
(`backend/app/main.py:140-141`) but don't block startup.

### 3.3 GZipMiddleware

`fastapi.middleware.gzip.GZipMiddleware`, `minimum_size=1000`
(`backend/app/main.py:135`). Responses smaller than 1000 bytes are not
compressed — the CPU cost isn't worth it, and the gzip overhead can make
small payloads *larger*.

Order note: GZip is innermost of the class-based group, which means it
compresses **after** JSON serialization (from the route or
response_wrapper) but **before** SecurityHeaders (which just sets headers,
doesn't touch the body).

### 3.4 `logging_middleware`

`backend/app/middleware/logging.py:16-57`. Runs outermost of the http
decorator group, effectively outermost overall.

- Generates a fresh `request_id = str(uuid.uuid4())`
  (`logging.py:22`) and stashes it on `request.state.request_id` so
  downstream middleware and route handlers can attach it to their own log
  lines.
- Logs `"Request started"` with method/URL/client IP.
- Awaits `call_next(request)`.
- Logs `"Request completed"` with `status_code` and `duration_ms`.
- Sets `response.headers["X-Request-ID"] = request_id`
  (`logging.py:55`) — every response, including error responses, gets the
  header.

### 3.5 `error_handler_middleware`

`backend/app/middleware/error_handler.py:18-81`. Three arms:

| Exception | Status | Envelope |
| --- | --- | --- |
| `GrayFSMException` (`utils/exceptions.py:14`) | 400 | `{success: false, error: {code, message, request_id}}` |
| `RequestValidationError` | 422 | `{success: false, error: {code: "VALIDATION_ERROR", message, details: [{field, message}], request_id}}` |
| Any other `Exception` | 500 | `{success: false, error: {code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred", request_id}}` |

The validation branch is **always sanitized** (comment at
`error_handler.py:45-48`) — a misconfigured environment cannot flip the
gate. Pydantic error dicts can include the input value, internal type
details, and ctx fields; only `loc[-1]` and `msg` survive.

`request_id` is pulled from `request.state.request_id`
(`error_handler.py:38,65,78`) — set by `logging_middleware`, which runs
outermore. If for some reason logging_middleware didn't fire, `getattr(..., None)`
falls back to `None` gracefully.

### 3.6 `rate_limit_middleware`

`backend/app/middleware/rate_limit.py:375-415`. Skipped entirely if
`settings.rate_limit_enabled == False` (`rate_limit.py:385-386`). Health
and docs paths bypass unconditionally (`_EXEMPT_PATHS`,
`rate_limit.py:233-241`).

Rules are declarative (`RateLimitRule`, `rate_limit.py:259-282`) and
evaluated in order; first match wins:

| Rule name | Path predicate | Limit / window | Bucket key |
| --- | --- | --- | --- |
| `auth_login` | exact `/api/v1/auth/login` | `settings.rate_limit_login` per `settings.rate_limit_login_window` (default 5/60s) | `rl:auth:{ip}:{path}` |
| `auth_register` | exact `/api/v1/auth/register` | `settings.rate_limit_register` (default 3/60s) | `rl:auth:{ip}:{path}` |
| `anonymous_global` | catch-all | `settings.rate_limit_anonymous` per `settings.rate_limit_window` (default 100/hr) | `rl:ip:{ip}` |

Note the **first-match-wins** ordering (comment at `rate_limit.py:294-295`):
auth-specific limits are stricter and must come first, otherwise the
catch-all would trip first with the looser threshold.

Storage backend, chosen per-request (`_check` at `rate_limit.py:321-343`):

1. **Redis sorted sets** (`RedisRateLimitStore`, `rate_limit.py:95-179`).
   Sliding window via `ZREMRANGEBYSCORE` + `ZCARD` + `ZADD` in a pipeline.
   Connected lazily (`_get_redis_store`, `rate_limit.py:191-209`) once per
   process.
2. **In-memory sliding window** (`InMemoryRateLimitStore`,
   `rate_limit.py:36-87`). Per-process dict of `key -> [timestamps]`.
   Used when Redis is unavailable or the Redis call itself raises.

**Fail-open**: any exception in `_check` results in
`return True, {}` (`rate_limit.py:334-343`) — a misconfigured rate limiter
never blocks legitimate traffic. Explicit design choice, deliberately not
fail-closed.

**IP resolution** (`_get_client_ip`, `rate_limit.py:217-229`): the direct
TCP peer is used unless it appears in `settings.trusted_proxies`, in
which case the leftmost `X-Forwarded-For` value is used. Without this
guard, an attacker can rotate the XFF header and each request hits a
fresh bucket.

429 responses (`_too_many`, `rate_limit.py:346-367`) carry `Retry-After`,
`X-RateLimit-Limit`, `X-RateLimit-Remaining: 0`, and `X-RateLimit-Reset`
headers. Successful requests also get `X-RateLimit-Remaining` decremented
via `rate_limit.py:411-414`.

### 3.7 `response_wrapper_middleware`

`backend/app/middleware/response_wrapper.py:25-73`. Innermost of the http
decorator group — closest to the route handler.

Contract: wraps a successful JSON response body into
`{"success": true, "data": <original body>}`.

Skip cases (in order of check):

| Case | Code | Rationale |
| --- | --- | --- |
| Path in `{"/", "/docs", "/redoc", "/openapi.json"}` or containing `/health` or `/metrics` | `response_wrapper.py:22, 31` | These endpoints have their own response contract or aren't API surface. |
| `status_code not in [200, 300)` | `response_wrapper.py:37-38` | Errors are already wrapped by `error_handler_middleware` or FastAPI's own handlers. |
| `content-type` doesn't contain `application/json` | `response_wrapper.py:41-43` | Plain text, HDL exports, PDFs, etc. |
| Body is valid JSON but is a dict containing key `"success"` | `response_wrapper.py:63-69` | Already wrapped — don't double-wrap. |
| Body is not valid JSON | `response_wrapper.py:53-60` | Passed through unchanged with a rebuilt `Response`. |

**"Already wrapped" convention**: any handler that returns a dict with
`success` at the top level opts out of automatic wrapping. Two current
callers exploit this deliberately:

- `list_fsms` (`backend/app/api/v1/fsm.py:96-138`) — pre-wraps into a
  `JSONResponse` because it wants a `pagination` sibling to `data` (an
  auto-wrap would nest as `data.pagination`).
- The two app-level exception handlers (`main.py:183-213`) return
  `{success: false, ...}` bodies directly.
- `get_task_status` (`tasks.py:232-256`), `get_optimization_results`
  (`algorithm.py:150-211`), `compare_algorithms` (`algorithm.py:214-273`),
  and `optimize_fsm`'s 202 async response (`algorithm.py:124-132`) all
  pre-wrap.

**Body-iterator consumption caveat**: the middleware calls
`async for chunk in response.body_iterator` (`response_wrapper.py:47-48`)
which drains the streaming iterator. It then rebuilds the response with
either the wrapped body or a passthrough `Response`. Downstream middleware
(none — this is innermost) would see the reconstructed response, so
streaming responses larger than memory would still get buffered here.
For the current API surface (metrics, health, and small JSON bodies)
that's fine.

---

## 4. Service layer

All services live under `backend/app/services/`. They own DB access and
business rules; route handlers are thin.

### 4.1 `FSMService` — `backend/app/services/fsm_service.py`

Public surface: `create_fsm`, `get_fsm`, `list_fsms`, `update_fsm`,
`fork_fsm`, `get_fsm_raw`, `delete_fsm`. Private:
`_check_ownership`.

**Ownership model** (strict, `_check_ownership` at `fsm_service.py:179-195`):

```python
if fsm.created_by is None or user_id is None or fsm.created_by != user_id:
    raise FSMPermissionException(str(fsm.id))
```

Rows with `created_by IS NULL` (legacy pre-user-model data) are
**unreachable** — the audit-flagged "ownerless bypass" is gone.
`create_fsm` has required a `user_id` since commit `78fb9bb`, so new
deployments don't produce NULL rows.

**Visibility rule for reads** (`get_fsm` at `fsm_service.py:98-130`):

```python
if fsm.visibility not in ("public", "example"):
    if fsm.created_by is None or user_id is None or fsm.created_by != user_id:
        raise FSMNotFoundException(str(fsm_id))
```

- Public FSMs → readable by anyone, including anonymous callers.
- `visibility="example"` (disk-seeded FSMs) → also readable by anyone.
- Everything else → owner only. Non-owners get **404, not 403**, to prevent
  enumeration of private IDs (`fsm_service.py:107-109`).

`get_fsm` also increments `view_count` on every read (`fsm_service.py:126-128`).
It commits immediately — no debouncing. See cross-questions on race
conditions.

**Sort-column allowlist** (`_SORTABLE_FIELDS` at `fsm_service.py:25-27`):
`{"created_at", "updated_at", "name", "view_count", "fork_count"}`.
`sort_by="hashed_password"` doesn't work — the check at
`fsm_service.py:164-165` silently falls back to `"created_at"`. Without
this guard, `getattr(FSM, sort_by)` would let callers probe any column
by name via ordering side-channels.

### 4.2 `OptimizationService` — `backend/app/services/optimization_service.py`

Public: `optimize_fsm`, `verify_ownership`. Everything else is a private
helper — the docstring at `optimization_service.py:1-19` explains the
split.

High-level flow of `optimize_fsm` (`optimization_service.py:94-202`):

1. **Cache lookup**: `cache_key = f"optimize:{fsm_id}:{algo}:{options_hash}"`
   (`optimization_service.py:113-119`). Options hash is
   `sha256(json.dumps(sorted(options.items())))[:8]` so equivalent
   dict orderings hit the same key.
2. **Load + ownership** via `_load_fsm` (mirrors `FSMService.get_fsm`'s
   visibility rule).
3. **Re-optimization block** (`optimization_service.py:129-134`): if the
   FSM's `is_optimized == True`, refuse to run — re-optimizing a derived
   FSM would compound the DUMMY_ states from the previous run. The caller
   should target the source FSM (the Lab Report button exposes it).
4. **Pre-metrics**: Gray-encode the states, compute avg + max Hamming on
   the original transitions. Done before the algorithm runs so a failure
   still records `avg_hamming_before`.
5. **Run algorithm** via `_run_algorithm` (`optimization_service.py:249-295`).
   Any exception is logged into an `AlgorithmResult(success=False)` row
   by `_record_failure` (`optimization_service.py:474-499`) before being
   re-raised as `AlgorithmException`.
6. **Post-metrics** on the algorithm's output.
7. **Persist**: `_persist_optimized_fsm` stages the derived FSM,
   `_record_attempt` stages the `AlgorithmResult(success=True)`. **One
   commit** — both rows live-or-die together (`optimization_service.py:181`).
8. **Cache the response** and return.

The derived FSM inherits owner + visibility from the source
(`optimization_service.py:360-365`), falling back to `user_id` if the
source had no owner. Without that fallback, optimized results of
"example"-visibility FSMs would be `created_by=NULL` and unreachable
under strict-ownership.

### 4.3 `ExportService` — `backend/app/services/export_service.py`

Public: `export_fsm`, `list_available_formats`. Private: `_load_fsm`
(same visibility rule as OptimizationService), `_sanitize_filename`.

Cache key: `f"export:{fsm_id}:{format_name}:{options_hash}"`
(`export_service.py:57`). **Ownership is verified BEFORE cache lookup**
(`export_service.py:48-51`) — otherwise a cached export from a previous
owner would be served to whoever asks.

`_sanitize_filename` (`export_service.py:159-176`) whitelists alnum plus
`_-`, converts spaces to `_`, lowercases, defaults to `"fsm_export"` if
everything got stripped. This is the safety layer for filenames that
could otherwise end up in a `Content-Disposition` header.

### 4.4 `ExampleService` — `backend/app/services/example_service.py`

Disk-based, DB-free. Reads all `*.json` files under `backend/examples/`
(`example_service.py:16`), parses them once, and caches the list on the
instance (`example_service.py:23`, populated at `example_service.py:55`).

Public: `list_examples`, `get_example`. Private: `_load_example_file`.

**Cache is per-instance, not process-wide**. `api/v1/example.py:18`
constructs one shared instance
`_example_service = ExampleService()` — so within a process the disk is
hit once. `backend/app/db/session.py:94` constructs a **separate** instance
inside `_seed_examples_if_empty`, so at boot the same JSONs are read
twice.

The dictionary shape returned to the API includes fields not on the FSM
model (`slug`, `difficulty`, `id == slug`) so the frontend can key/link
on it without hitting the DB.

### 4.5 `CategoryService` — `backend/app/services/category_service.py`

Straightforward CRUD reads. Sorted by `(display_order, name)`
(`category_service.py:40`). Nothing exotic.

### 4.6 `AuthService` — `backend/app/services/auth_service.py`

Public: `register`, `login`, `get_user_by_id`. Private helpers around
password hashing.

Key security controls:

- **Bcrypt** via `passlib.context.CryptContext(schemes=["bcrypt"])`
  (`auth_service.py:23`).
- **Timing-oracle mitigation** (`auth_service.py:29`, used in
  `auth_service.py:121`). Login with a non-existent email runs a dummy
  bcrypt verify against `_TIMING_DUMMY_HASH` so response time matches
  the "user exists, wrong password" branch. Otherwise attackers
  distinguish valid emails by response latency (~1ms vs ~100ms).
- **Row-level lock** on the login row via `SELECT ... FOR UPDATE`
  (`_get_user_by_email_for_update`, `auth_service.py:181-197`).
  Without this, 10 parallel bad-password requests all read
  `failed_login_count=4` and write 5 — lockout never fires. With
  `with_for_update()`, they serialize on the DB row.
- **Account lockout** (`auth_service.py:132-136`): after
  `settings.max_failed_logins` (default 5), set
  `locked_until = now + settings.account_lockout_minutes` (default 15).
  On a successful login the counters reset (`auth_service.py:146-147`).
- **No refresh-token endpoint exists**. The openapi spec's mention of
  refresh tokens is aspirational — the code path stops at
  `create_access_token`. Access tokens use `settings.access_token_expire_minutes`
  (default 24h, `config.py:60`).

JWT handling lives in `backend/app/middleware/auth.py`:
- `create_access_token` (`auth.py:115-151`) — includes `sub`, `email`,
  `roles`, `exp`, `iat`, `type: "access"`, `aud: settings.jwt_audience`.
- `_decode_token` (`auth.py:67-112`) — checks blacklist first, then
  `jwt.decode(..., audience=settings.jwt_audience)`, then rejects tokens
  whose `type` claim isn't `"access"` or has no `sub`.
- `get_optional_current_user` / `get_required_current_user`
  (`auth.py:159-222`) — the two dependency-injection entry points. Both
  fall back from Authorization header to `access_token` cookie
  (`auth.py:170-175, 200-205`) so the httpOnly cookie flow works.

Token blacklist: `backend/app/middleware/token_blacklist.py`.
`TokenBlacklist` (line 57-111) stores SHA-256-truncated JWT hashes in
Redis with `SETEX ttl`. The TTL comes from the token's own `exp` claim
via `_remaining_ttl` (`token_blacklist.py:175-188`) — expired entries
clean themselves up. Fail-open: any Redis error falls back to a
per-process `set` (`token_blacklist.py:65-89`).

---

## 5. Async task path

`backend/app/api/v1/tasks.py` owns the task-store abstraction. Fed by
`_run_optimization_task` in `backend/app/api/v1/algorithm.py:33-62`.

### 5.1 Storage

Task state is a JSON blob under `task:{task_id}` in Redis
(`tasks.py:57-58`). Fields: `task_id`, `status`, `fsm_id`, `user_id`,
`progress`, `result`, `error`, `created_at`.

**TTL policy** (`tasks.py:49-54, 68-69`):

| Status | TTL |
| --- | --- |
| pending / running / anything not terminal | 7 days (`TTL_RUNNING`) |
| completed / failed | 24 hours (`TTL_TERMINAL`) |

The 7-day running TTL is generous — it protects a stuck task from being
lost, at the cost of one extra Redis key. Redis's TTL eviction is the
primary cleanup; `cleanup_old_tasks` (`tasks.py:196-229`) is available
as an ops helper but is **not wired to a periodic job**.

### 5.2 Idempotent create

`create_task` (`tasks.py:72-122`) uses **Redis SETNX** (via
`client.set(..., nx=True)`, `tasks.py:99-104`). If the key already
exists, the existing record is read back and returned. UUID v4 collisions
are astronomically improbable, but the guard is cheap.

If Redis is unreachable, `create_task` writes to `_fallback_store`
(`tasks.py:64`, an `asyncio.Lock`-guarded dict). The fallback is
**per-process** — not durable, not multi-worker safe. Explicitly
degraded-mode.

### 5.3 The background task itself

`_run_optimization_task` (`backend/app/api/v1/algorithm.py:33-62`) is
scheduled via FastAPI's `BackgroundTasks` at `algorithm.py:116-123`.
Because `BackgroundTasks` runs after the response is sent, the task
**opens its own DB session** (`AsyncSessionLocal()` at `algorithm.py:50`)
— the request-scoped `db` from `get_db` has already been closed.

Failure handling (`algorithm.py:59-62`):

```python
except Exception:
    logger.exception("optimization_task_failed", extra={"task_id": task_id})
    await update_task(task_id, status="failed", error="Optimization failed")
```

The user-visible error is a fixed generic string — no exception message
leaks into the task record. The full traceback goes to logs via
`logger.exception`.

### 5.4 Poll endpoint

`GET /api/v1/tasks/{task_id}` (`tasks.py:232-256`) is **owner-only** —
authenticated, and returns 404 for both "doesn't exist" and "not yours"
(`tasks.py:241`) so callers can't enumerate task IDs. Internal fields
`user_id` and `created_at` are stripped from the response
(`tasks.py:253-255`).

---

## 6. Data lifecycle — how an FSM row moves through the system

### 6.1 Create

```
POST /api/v1/fsms (fsm.py:27)
  → FSMCreate.model_validate  (schemas/fsm.py:25-63)
      - name / fsm_type / states / initial_state validated
      - outputs regex-validated for HDL-safe characters
      - initial_state ∈ states enforced by field_validator
  → FSMService.create_fsm  (fsm_service.py:36-96)
      - Moore FSMs get default output "0" for any state missing one
      - FSMValidator.validate_fsm_structure runs
      - bit_width = ceil(log2(max(len(states), 2)))
      - INSERT (session.add + commit + refresh)
  → returns FSMResponse  (schemas/fsm.py:66-88)
      - states and transitions surfaced from JSONB via @property accessors
```

### 6.2 Read

```
GET /api/v1/fsms/{id} (fsm.py:44)
  → FSMService.get_fsm  (fsm_service.py:98-130)
      - Visibility check: public / example → anyone; else owner only
      - view_count += 1
      - commit + refresh
  → FSMResponse
```

### 6.3 Optimize

```
POST /api/v1/fsms/{id}/optimize (algorithm.py:65)
  Sync mode:
    → OptimizationService.optimize_fsm  (optimization_service.py:94)
       [cache hit? return OptimizationResponse]
       [else]
       → _load_fsm (ownership + definition-present check)
       → block if is_optimized
       → run algorithm
       → INSERT derived FSM (staged)
       → INSERT AlgorithmResult (staged)
       → COMMIT — both rows together
       → cache_set the response
    → returns OptimizationResponse

  Async mode (request.async_mode = True):
    → verify_ownership synchronously (algorithm.py:101-112)
    → block if is_optimized (algorithm.py:104-112)
    → create Redis task with SETNX
    → schedule background _run_optimization_task
    → return 202 with task_id + status_url immediately
```

### 6.4 Fork

```
POST /api/v1/fsms/{id}/fork (fsm.py:78)
  → FSMService.fork_fsm  (fsm_service.py:249-286)
      - Public/example → anyone; else owner only
      - Deep-copies definition dict
      - created_by = caller
      - inherits visibility, category, tags, fsm_type
```

### 6.5 Delete

```
DELETE /api/v1/fsms/{id} (fsm.py:141)
  → FSMService.delete_fsm  (fsm_service.py:296-307)
      - Strict ownership check
      - Hard delete via session.delete(fsm) + commit
```

No soft-delete. AlgorithmResult rows linked via
`original_fsm_id`/`optimized_fsm_id` FKs — no cascade rules are declared
in the model, so a `DELETE` on a source FSM with existing algorithm
results will fail on the FK. See cross-questions.

---

## 7. Common cross-questions

### Q: Why so many middleware layers? Isn't it slow?

Each middleware is under 100 lines and does one thing. The heaviest work
is `response_wrapper` (buffering the JSON body), and it only runs when
the response is JSON, 2xx, and not already wrapped. GZip only fires above
1000 bytes. Rate limit fails open on any error, so a broken Redis doesn't
add latency. Empirically, middleware overhead is dominated by
`SecurityHeadersMiddleware`'s CSP string build (which is a constant
`" ; ".join(...)` on ~10 items). For a small SPA API this is not the
bottleneck — the DB query and the optimization algorithm are.

### Q: Where does the JSON envelope get added — handler or middleware?

Both, depending on the endpoint. **Middleware** (`response_wrapper`)
handles the default case: a route returns `data`, the wrapper produces
`{success: true, data}`. **Handler** pre-wrap is used when the response
shape needs more than `data`:

- `list_fsms` needs a `pagination` sibling → hand-builds `{success, data, pagination}` at `fsm.py:125-138`.
- `get_optimization_results` returns `{success, data}` directly at `algorithm.py:211` (semantically equivalent to letting the wrapper do it, but explicit).
- 202 async response at `algorithm.py:124-132` includes `task_id` and `status_url` alongside `success`, so it pre-wraps.
- Both app-level exception handlers at `main.py:183-213` build `{success: false, error}` themselves.

The wrapper's "already wrapped" detection (`response_wrapper.py:63`) is
the safety net that lets these paths coexist.

### Q: What happens if response_wrapper receives an already-wrapped body?

It rebuilds the original `Response` verbatim
(`response_wrapper.py:64-69`) — same status, headers, media type. The
detection key is `isinstance(data, dict) and "success" in data`.
Downside: if a handler returns a domain object that happens to have a
`success` field with unrelated meaning, the wrapper skips it. For the
current schemas that's not a concern (no FSM/User field is named
`success`).

### Q: Why is the `/metrics` endpoint at the root instead of `/api/v1/`?

Prometheus scrapes expect `/metrics` by convention, so
`setup_metrics(app)` registers `@app.get("/metrics", include_in_schema=False)`
at the root (`observability/metrics.py:246`). The old placeholder at
`/api/v1/health/metrics` that returned hardcoded zeros was removed
(comment at `api/v1/health.py:49-53`) — misleading data next to a real
scrape endpoint is worse than one canonical answer. `response_wrapper`
also has an explicit exclusion for any path containing `/metrics`
(`response_wrapper.py:31`) so the Prometheus text-format response isn't
wrapped in JSON.

### Q: What guarantees exist that the FSM `definition` JSONB stays well-formed?

Three layers:

1. **Write-side Pydantic validation**: `FSMCreate` (`schemas/fsm.py:25-63`)
   enforces states/transitions/initial_state and that `initial_state ∈ states`.
   Outputs are regex-checked to `[01xXzZ-]*` to prevent HDL injection.
2. **Structural validation**: `FSMValidator.validate_fsm_structure`
   (invoked at `fsm_service.py:58-64`) — cross-checks transitions
   reference known states, that Moore machines have outputs for every
   state, etc. (Definition in `backend/app/core/fsm_model.py`, out of
   scope here.)
3. **No read-side validation**: `FSMResponse` uses `states` and
   `transitions` via `@property` accessors on the model
   (`models/fsm.py:118-132`) that safely default to `[]` if the JSONB
   key is missing. That was the fix for the "seeded FSMs missing
   `initial_state`" bug — the `_seed_examples_if_empty` writer now
   emits `initial_state` explicitly (`db/session.py:105-110`).

Nothing at the DB layer prevents a manual `UPDATE fsms SET definition = '{"garbage": 1}'`.

### Q: How are transactions scoped? What if the optimizer crashes mid-run?

- The route-scoped session comes from `get_db` (`db/session.py:54-71`),
  which uses one `AsyncSession` per request, commits on success, and
  rolls back on any exception before closing.
- Inside `optimize_fsm`, both the derived FSM and its AlgorithmResult
  are staged with `session.add` and committed together at
  `optimization_service.py:181`. If the algorithm raises, no commit
  happens for those two rows — but `_record_failure`
  (`optimization_service.py:474-499`) opens its own commit to write an
  `AlgorithmResult(success=False)` row so the failure is auditable.
- The async task path in `_run_optimization_task` opens its own
  `AsyncSessionLocal()` (`algorithm.py:50`) — request-scoped `db`
  doesn't survive to the background task.
- Redis writes are best-effort and never rolled back on a DB failure.
  A partial commit + failed cache write leaves stale-in-Redis but
  correct-in-DB — acceptable, since the next cache read on a miss
  refetches from DB.

### Q: What happens if `_seed_examples_if_empty` runs on a live DB with existing FSMs?

It's idempotent (`db/session.py:90-92`): if
`SELECT COUNT(*) FROM fsms > 0`, it exits without any write. The seed
only runs on truly empty tables — normal boots after the first are
no-ops.

If two workers boot simultaneously against an empty DB, they can both
pass the count check and race to insert examples. There is no
uniqueness constraint on `fsms.name`, so this produces duplicate rows.
For uvicorn multi-worker deployments the migration `g7b9d0e1c4f2_clean_slate_reseed`
is the canonical seed path; startup seeding is really a dev convenience.
See `database.md` for the migration-based seed.
