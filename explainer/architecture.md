# Architecture

Component boundaries, the exact middleware chain, and a trace of a real
request from browser click to committed row. Assumes you've read
[`overview.md`](overview.md) for the domain problem and
[`tech-stack.md`](tech-stack.md) for what the boxes below are made of.

---

## 1. Component diagram

```
                    ┌────────────────────────────────────────────┐
                    │                Browser                     │
                    │  ┌──────────────────────────────────────┐  │
                    │  │  React 18 SPA (Vite build)           │  │
                    │  │  react-router · react-query          │  │
                    │  │  Zustand (fsm, auth, ui)             │  │
                    │  │  React Flow canvas · Three.js cube   │  │
                    │  └──────────────┬───────────────────────┘  │
                    │             axios apiClient                │
                    │             (localStorage token)           │
                    └──────────────────┬─────────────────────────┘
                                       │  HTTPS
                                       ▼
                           ┌─────────────────────────┐
                           │      nginx:alpine       │
                           │  ┌───────────────────┐  │
                           │  │  location /       │  │  ← SPA (dist/)
                           │  │  → try_files /    │  │    index.html
                           │  │    index.html     │  │
                           │  ├───────────────────┤  │
                           │  │  location /api    │  │  ← proxy_pass
                           │  │  → BACKEND_PROXY_ │  │    ${BACKEND_
                           │  │    PASS           │  │    PROXY_PASS}
                           │  ├───────────────────┤  │
                           │  │  location         │  │  ← proxy_pass
                           │  │  /openapi.json    │  │
                           │  ├───────────────────┤  │
                           │  │  location /health │  │  ← 200 OK
                           │  └───────────────────┘  │
                           │  CSP · HSTS · XFO       │
                           │  X-Content-Type-Options │
                           └───────────┬─────────────┘
                                       │  HTTP  (host header rewritten
                                       │         to BACKEND_HOST for
                                       │         SNI when upstream is
                                       │         external HTTPS)
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │       FastAPI (uvicorn) on $PORT        │
                    │                                          │
                    │  Middleware stack (outer → inner):       │
                    │    SecurityHeaders                       │
                    │    CORS                                  │
                    │    GZip (minimum_size=1000)              │
                    │    logging_middleware                    │
                    │    error_handler_middleware              │
                    │    rate_limit_middleware  (optional)     │
                    │    response_wrapper_middleware           │
                    │                                          │
                    │  Routers (all under /api/v1):            │
                    │    health · auth · fsms · algorithm      │
                    │    export · category · example · tasks   │
                    │                                          │
                    │  Services:                               │
                    │    OptimizationService · FSMService      │
                    │    AuthService · ExportService · etc.    │
                    │                                          │
                    │  Startup lifespan:                       │
                    │    create_db_and_tables()                │
                    │    _seed_examples_if_empty()             │
                    │    setup_telemetry(app)                  │
                    │    setup_metrics(app) → /metrics         │
                    └───┬─────────────────────────┬───────────┘
                        │                          │
                        ▼                          ▼
              ┌──────────────────┐         ┌────────────────┐
              │  Postgres 15     │         │   Redis 7      │
              │  fsms · users    │         │  cache::opt:*  │
              │  algorithm_      │         │  task::{uuid}  │
              │  results · cats  │         │  rate::{ip}    │
              │  examples        │         │  jwt::blacklist│
              │  (asyncpg pool)  │         │                │
              └──────────────────┘         └────────────────┘
```

**Where the CDN sits.** There is no CDN in the tree. Nginx sets
`Cache-Control: public, immutable` on hashed asset URLs
(`infrastructure/docker/default.conf.template:18-21`); a CDN in front is
free of cache-invalidation concerns because Vite emits content-hashed
filenames. But this is not currently deployed anywhere in the repo.

**Where SPA and API split.** At the nginx `location` boundary. Everything
under `/api/*` is proxied to the backend; everything else falls into
`location /` and gets served as `index.html` (so client-side routing
handles the URL). This means the API base URL is *same-origin* for the
production deploy — no CORS preflight on the same-domain path, and
`VITE_API_BASE_URL` defaults to `/api/v1` in the Dockerfile
(`infrastructure/docker/frontend.Dockerfile:28`).

---

## 2. Middleware stack (starlette registration → runtime order)

Registration order in `backend/app/main.py:132-161` is the reverse of
execution order. The header comment at `main.py:115-130` documents this
inversion. The **runtime** order, outer → inner, is:

| # | Layer | Type | Registered at | Purpose |
|---|---|---|---|---|
| 1 | `SecurityHeadersMiddleware` | class | `main.py:153` (added last) | HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| 2 | `CORSMiddleware` | class | `main.py:144` | Origin allowlist, credentials flag |
| 3 | `GZipMiddleware(minimum_size=1000)` | class | `main.py:135` (added first) | Response compression |
| 4 | `logging_middleware` | http-decorator | `main.py:161` (registered last) | Correlation-ID assign, structured log line per request + latency |
| 5 | `error_handler_middleware` | http-decorator | `main.py:160` | Catch `GrayFSMException` + unknown, produce error envelope |
| 6 | `rate_limit_middleware` | http-decorator | `main.py:159` (conditional) | Only if `settings.rate_limit_enabled`; sliding window Redis-backed |
| 7 | `response_wrapper_middleware` | http-decorator | `main.py:157` (registered first / innermost) | Wrap successful 2xx JSON in `{success, data}` |

Two inversions to internalise:
- `add_middleware(...)` calls: **first added is innermost.**
- `app.middleware("http")(...)` decorators: **first registered is
  innermost.**

Both are documented in-source so nobody reorders them by intuition
(`main.py:117-130`).

---

## 3. Request lifecycle: `POST /api/v1/fsms/{id}/optimize` (sync path)

The user clicks "Optimize" with `async_mode=false` in the request body.
The trace below is the linear happy path; branches noted inline.

```
[1]  Browser: React Flow canvas holds a saved FSM. User clicks the
     "Run optimization" button. useOptimization hook fires:
     apiClient.post(`/fsms/${id}/optimize`, {algorithm: 'greedy',
     async: false, options: {}})

[2]  axios apiClient (frontend/src/api/client.ts:4-11) attaches
     Authorization: Bearer <token> from localStorage
     (client.ts:14-24). withCredentials: false.

[3]  Request hits nginx. location /api matches
     (default.conf.template:35). Headers rewritten: Host =
     ${BACKEND_HOST}, X-Real-IP = $remote_addr,
     X-Forwarded-For = $proxy_add_x_forwarded_for,
     X-Forwarded-Proto = $scheme. proxy_read_timeout 60s.

[4]  Backend uvicorn worker picks up the request. Middleware stack
     enters outer → inner:

     [4a] SecurityHeadersMiddleware — records nothing on the request;
          will add response headers on the way out.

     [4b] CORSMiddleware — sync check against
          settings.cors_origins. For the same-origin production
          deploy this is a no-op (no Origin header set on same-
          origin fetches from the SPA). For local dev with
          http://localhost:3000 talking to :8000 it does the
          preflight/actual dance.

     [4c] GZipMiddleware — records nothing on the request; wraps
          the response body if it comes back >= 1000 bytes with a
          gzip-encoded stream.

     [4d] logging_middleware
          (backend/app/middleware/logging.py) — assigns
          request.state.request_id = uuid4(). Logs a structured
          "Request started" line with method/path/id. Sets a
          monotonic start_time.

     [4e] error_handler_middleware — wraps the rest in try/except
          so any GrayFSMException or unhandled Exception becomes a
          consistent {success:false, error:{...}} response instead
          of a stack trace.

     [4f] rate_limit_middleware — checks the sliding window
          counter for this IP + user. Increments and either passes
          through or returns 429. Redis-backed with in-memory
          fallback (backend/app/middleware/rate_limit.py).

     [4g] response_wrapper_middleware — records nothing on the
          request; will wrap the response body on the way out
          (see §4 below).

[5]  Route handler resolved: algorithm.optimize_fsm at
     backend/app/api/v1/algorithm.py:65. Dependencies inject:
       - db: AsyncSession from get_db() — from
         AsyncSessionLocal() context manager
         (backend/app/db/session.py:44-71) with begin/commit/
         rollback lifecycle.
       - current_user: UserToken from get_required_current_user
         (backend/app/middleware/auth.py) — decodes the JWT,
         checks the blacklist, returns {user_id, ...}. Raises
         401 on any failure.

[6]  Body validated against OptimizationRequest (pydantic).
     request.async_mode is false so the sync branch runs
     (algorithm.py:134). service = OptimizationService(db);
     result = await service.optimize_fsm(fsm_id, request,
     user_id=user_id).

[7]  Inside OptimizationService.optimize_fsm
     (backend/app/services/optimization_service.py:94):

     [7a] Build cache key:
          options_hash = sha256(sorted(options.items()))[:8]
          cache_key   = f"optimize:{fsm_id}:{algo}:{options_hash}"
          (optimization_service.py:112-116).
          cache_get(cache_key) — Redis GET on miss returns None;
          on hit returns the cached OptimizationResponse dict
          reconstituted via OptimizationResponse(**cached). If the
          Redis client is unreachable, cache_get returns None
          silently (backend/app/cache.py:30-40).

     [7b] Load FSM via _load_fsm — SELECT with ownership check
          (private FSMs owned by another user 404 instead of
          403 to avoid leaking existence).

     [7c] Guard: original_fsm.is_optimized → raise
          FSMValidationException. See overview §7.

     [7d] Pre-metrics: assign Gray codes to the original state
          list at original_fsm.bit_width, compute avg + max
          Hamming across all transitions
          (optimization_service.py:145-147). Done BEFORE running
          the algorithm so a failure row still records the
          "before" numbers.

     [7e] Run the algorithm: _run_algorithm dispatches to
          get_algorithm(request.algorithm)(bit_width) — greedy /
          bfs_optimal / global_sa / global_ga. Returns an
          _OptimizationOutcome dataclass with states_list,
          transitions, outputs, encodings, dummy_states,
          execution_time_ms.

     [7f] Post-metrics: same Hamming computations on the outcome.
          Build _MetricsBundle; improvement_pct is a property on
          it. Bit-width for the derived FSM is picked as
          ceil(log2(max(len(states_list), 2)))
          (optimization_service.py:335).

     [7g] Persist:
            _persist_optimized_fsm → INSERT a new FSM row with
              is_optimized=True, visibility=private, source_fsm_id
              pointing back at the original.
            _record_attempt → INSERT an AlgorithmResult row
              (fsm_id, optimized_fsm_id, algorithm, timings, both
              hamming averages, both maxes, encoding_map, success,
              executed_at). This is the row the Lab Report reads
              from later.
          db.commit()  db.refresh(optimized_fsm).

     [7h] Build the response object; cache_set(cache_key,
          response.model_dump(mode="json")) with default TTL
          (see cache.py). Return response.

[8]  Handler returns OptimizationResponse. FastAPI serialises to
     JSON via jsonable_encoder.

[9]  Response walks the middleware stack in reverse (inner → outer):

     [9a] response_wrapper_middleware
          (backend/app/middleware/response_wrapper.py:25-73):
            - Skips paths in {"/", "/docs", "/redoc",
              "/openapi.json"} and any path containing "/health"
              or "/metrics".
            - Skips non-2xx (error_handler already wrapped them).
            - Skips non-JSON content types.
            - Consumes body_iterator.
            - If body isn't valid JSON: pass through.
            - If body is a dict AND already has a "success" key
              (like the async 202 branch that returns
              {"success":true, "task_id":...}): pass through.
            - Otherwise wrap as {"success": true, "data": body}
              and return a fresh JSONResponse.

     [9b] rate_limit_middleware — no-op on egress.

     [9c] error_handler_middleware — no-op on the happy path;
          on exception it would emit
          {"success":false, "error":{...}}.

     [9d] logging_middleware — record duration = time.time() -
          start_time, log a structured "Request completed" line
          with status + duration_ms + request_id. (See
          backend/app/middleware/logging.py.)

     [9e] GZipMiddleware — content-encodes the body if >= 1000
          bytes; sets Content-Encoding: gzip.

     [9f] CORSMiddleware — adds Access-Control-Allow-Origin +
          related headers if the request had an Origin header.

     [9g] SecurityHeadersMiddleware — adds HSTS, CSP,
          X-Content-Type-Options, X-Frame-Options,
          Referrer-Policy. Same header set as the nginx template
          (default.conf.template:72-83). Both are in the request
          path in production; both agree so header order doesn't
          matter for correctness, only for who "wins" on
          conflicts.

[10] Response reaches nginx. nginx adds its own SecurityHeaders
     (they're `add_header ... always` so they apply to proxied
     responses too — default.conf.template:72-83). Duplicate
     headers are the cost of defense-in-depth here.

[11] Client receives {"success": true, "data": {optimized_fsm_id,
     algorithm, metrics, encoding_map, ...}}. axios interceptor
     unwraps: response.data is now the envelope's `data` field
     (client.ts:28). React-query cache is invalidated for
     optimizationKeys.results(fsmId) and fsmKeys.detail(fsmId)
     via the useOptimization hook's onSuccess callback
     (frontend/src/hooks/useOptimization.ts:25-28).

[12] User is navigated to the Lab Report / OptimizationPage
     which reads the optimized FSM plus the AlgorithmResult snapshot
     for radar, hypercube, and comparison views.
```

Registration order for step 4 is documented at
`backend/app/main.py:117-130`; the middleware objects themselves at
`main.py:135-161`.

---

## 4. Async vs sync optimize

`OptimizationRequest.async_mode` picks between two branches at
`backend/app/api/v1/algorithm.py:93`:

| Mode | HTTP status | Body | Follow-up |
|---|---|---|---|
| `async=false` | `200` | `OptimizationResponse` | None — full result inline |
| `async=true` | `202` | `{"success": true, "task_id": ..., "status": "pending", "status_url": "/api/v1/tasks/{task_id}"}` | Client polls `GET /api/v1/tasks/{task_id}` |

Key subtleties on the async path:

- **Ownership is verified synchronously** (`algorithm.py:100-112`) so the
  caller gets an immediate 404 on a not-owned FSM instead of a task
  that fails asynchronously.
- **Re-optimisation is blocked synchronously** for the same reason
  (`algorithm.py:104-112`) — 422 up-front rather than a failed task.
- **Task state lives in Redis**, key `task:{uuid}`, JSON blob with
  `status ∈ {pending, running, completed, failed}`. TTL is 7d for
  in-flight, 24h for terminal (`backend/app/api/v1/tasks.py:49-54`).
- **Ownership is stored on the task record** so `GET /api/v1/tasks/{id}`
  only returns to the owner — prevents UUID scraping from leaking
  another user's FSM (`backend/app/api/v1/tasks.py:1-9`).
- **The 202 body already contains a `"success"` key**, so
  response_wrapper_middleware skips wrapping (its "already wrapped"
  short-circuit — see `response_wrapper.py:62-69`).

The background function itself opens a fresh `AsyncSessionLocal()`
inside `_run_optimization_task` (`algorithm.py:50`) because the
request-scoped session is closed by the time the task starts.

---

## 5. Response envelope

`response_wrapper_middleware` wraps successful JSON responses as
`{"success": true, "data": <body>}`. Rules
(`backend/app/middleware/response_wrapper.py:20-73`):

| Skip if... | Reason |
|---|---|
| Path is `/`, `/docs`, `/redoc`, `/openapi.json` | Not API paths |
| Path contains `/health` | Health probes must return raw scrape shape |
| Path contains `/metrics` | Prometheus scrape must stay in the exposition format |
| Status is not 2xx | `error_handler_middleware` already emitted its own envelope |
| Content-Type is not JSON | Binary exports (Verilog text, CSV) go through as-is |
| Body isn't valid JSON | Passed through raw |
| Body is a dict and has a `"success"` key | Already wrapped by the handler (like the async 202) |

The envelope is unwrapped on the client by the axios response
interceptor at `frontend/src/api/client.ts:28`
(`(response) => response.data`). That's the transport-level unwrap: after
the interceptor, every call-site sees the envelope's `.data` payload
directly, not the envelope itself.

**Bare-body tolerance.** Even with the middleware in place, some
responses (notably `GET /api/v1/fsms/{id}` right after creating an
optimized FSM) have been observed reaching the client as a bare FSM —
`{id, name, ...}` — without the envelope. The frontend defends against
this at the endpoint wrapper (`frontend/src/api/endpoints/fsms.ts:19-25`):
if `raw.id` is present and `raw.data` is not, synthesise
`{success: true, data: normalizeFSM(raw)}`. Same story for the list
shape (`fsms.ts:26-32`). The comment on `normalizeFSMResponse` is
explicit about the diagnostic that motivated it.

The upstream reason for that specific bare-body case is still open — see
"inconsistencies noted" in the report to the caller. But the client
tolerates it either way.

---

## 6. Frontend ↔ backend boundary

Four layers, in order of what a request touches:

```
Component (page / hook)
    │  invokes React Query
    ▼
useQuery / useMutation (hooks/useFSM.ts, useOptimization.ts, useExport.ts)
    │  invokes endpoint wrapper
    ▼
fsmAPI / authAPI / etc. (api/endpoints/*.ts)
    │  calls axios
    ▼
apiClient (api/client.ts)
    │  request interceptor → attach Authorization header
    │  fires HTTP
    │  response interceptor → response.data (envelope-unwrap)
    │                       → 401 handler (clear token, redirect)
    ▼
network → nginx → FastAPI
```

Between the axios interceptor and the component, one more layer sits in
the endpoint wrapper: `normalizeFSM` /
`normalizeExample` / `normalizeOptimizationResponse` /
`normalizeAlgorithmResult` (`frontend/src/api/normalize.ts`). These fill
optional/display-only fields with stable empties (`states: [] || undefined`,
`metrics.*: 0`, `encoding_map: {}`) so component code doesn't have to
handle `undefined` at every render site. The comment at `normalize.ts:7-14`
is explicit that identity fields (id, name, ownership) are passed through
un-touched — fabricating those would mask real bugs.

**React-query cache keys** (`hooks/useFSM.ts:6-12`,
`hooks/useOptimization.ts` similar):

```
fsmKeys.all              → ['fsms']
fsmKeys.lists()          → ['fsms', 'list']
fsmKeys.list(params)     → ['fsms', 'list', {…params}]
fsmKeys.details()        → ['fsms', 'detail']
fsmKeys.detail(id)       → ['fsms', 'detail', id]
```

Mutations invalidate specifically — an update invalidates
`fsmKeys.detail(id)` AND `fsmKeys.lists()` (list may show updated
fields); a create/delete only invalidates `lists()`. See
`useFSM.ts:29-70` for the concrete `invalidateQueries` calls.

**Query client defaults** (`frontend/src/main.tsx:7-14`):
`refetchOnWindowFocus: false`, `retry: 1`, `staleTime: 5min`. These are
deliberate: focus-refetch would clobber a long-running edit that hasn't
been persisted, and a 5-minute stale window matches how quickly the
data actually mutates on the backend for a typical session.

---

## 7. Frontend state stores

Three Zustand stores, all in `frontend/src/store/*.ts`. Everything not
in these lives either in react-query (server state) or as component-local
`useState` / `useReducer`.

| Store | What's in it | Persistence |
|---|---|---|
| `useAuthStore` (`authStore.ts`) | `token`, `user` (`AuthUser`), `isAuthenticated`, `loading`, actions `login/register/logout/init`. On startup, hydrates from `localStorage['auth_token']` and `localStorage['auth_user']` to survive a page reload. On `/auth/me` failure keeps the cached user rather than blanking the navbar — see the comment at `authStore.ts:5-11`. | `localStorage` (token + user JSON) |
| `useFSMStore` (`fsmStore.ts`) | `currentFSM`, `selectedNode`, `selectedEdge`, `isEditing`, draft-* fields (`draftStates`, `draftTransitions`, `draftName`, `draftDescription`, `draftFsmType`, `draftInitialState`, `draftEncoding`), `canUndo/canRedo` cursor mirrors, `clipboard`. Undo/redo stack lives in a `FSMHistory` instance (`fsmStore.ts:65`); the store only mirrors the cursor so components can subscribe to enable/disable. | in-memory |
| `useUIStore` (`uiStore.ts`) | `sidebarOpen`, `activeModal`, `mobileMenuOpen` and toggles. Sidebar default is media-query-aware (open ≥1024px, closed below) — see `uiStore.ts:19-22`. | in-memory |

What is NOT in these stores:
- **FSM records from the server** — that's react-query.
- **React Flow node/edge positions during a drag** — React Flow's own
  internal state.
- **Form fields inside modals** — react-hook-form.
- **Toast state** — `ToastProvider` context.

Rule of thumb: if it's a wire type, it's react-query. If it needs to be
readable from far away in the tree, it's a Zustand store. If it dies with
the component, it's `useState`.

---

## 8. Common cross-questions

**Q. Why is `response_wrapper_middleware` innermost instead of outermost?**
A. It needs to see the response body BEFORE GZipMiddleware compresses it
and BEFORE the security headers get computed. Innermost = closest to the
handler = the last thing that runs on the way in and the first thing
that runs on the way out. Being innermost also means it sees only 2xx
JSON — errors are already wrapped by `error_handler_middleware`, which
sits above it. See `main.py:117-130` for the full ordering rationale.

**Q. There are two security-headers layers (nginx + FastAPI). Which
one wins?**
A. Both fire. nginx uses `add_header ... always` so its headers apply to
proxied responses (`default.conf.template:72-83`). FastAPI's
`SecurityHeadersMiddleware` sets the same header set on the FastAPI
response. The client sees whichever nginx forwards. In practice the sets
are the same (kept in sync deliberately, per the comment at
`default.conf.template:81-82`); this is intentional defense-in-depth so
a direct-FastAPI deploy (no nginx) still ships hardened responses.

**Q. Where does the Authorization header come from on a page reload?**
A. localStorage. `apiClient.interceptors.request` reads
`localStorage['auth_token']` on every request
(`frontend/src/api/client.ts:14-24`). `useAuthStore` initialises
`isAuthenticated` from the same key so the UI doesn't flash
unauthenticated on reload (`authStore.ts:45`).

**Q. Why is the AsyncSessionLocal committed inside `get_db` and again
inside the service?**
A. It isn't twice. `get_db` (`db/session.py:56-70`) opens the session
context manager and calls `session.commit()` at the end of the request —
but the OptimizationService also calls `db.commit()` explicitly
(`optimization_service.py:181`) so the derived FSM + AlgorithmResult
rows are visible for the read that immediately follows (the response
uses `db.refresh(optimized_fsm)`). The trailing `session.commit()` in
`get_db` is a no-op after the explicit one.

**Q. The middleware documentation says `rate_limit_middleware` sits at
position 6 but the code shows a conditional. What happens when rate
limiting is off?**
A. If `settings.rate_limit_enabled` is false, the `app.middleware("http")`
decorator is never called (`main.py:158-159`) and the stack collapses to
5 layers. The runtime order comment at `main.py:117-130` describes the
maximum stack; the actual runtime stack matches it exactly whenever rate
limiting is on (the default). No re-ordering needed.

**Q. Why does the frontend still have `normalizeFSM` after the axios
interceptor already unwraps the envelope?**
A. Different concerns. The interceptor unwraps the *transport* envelope
(`{success, data}` → `data`). `normalizeFSM` defends *domain* fields
(states, transitions, tags, outputs, encoding, definition) against being
`undefined`. Without normalize, every render site that iterates
`fsm.states.map(...)` would need a defensive `?? []`. The comment at
`normalize.ts:7-14` calls out this specific split of concerns.
