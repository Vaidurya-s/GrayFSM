# API Endpoints — GrayFSM

Presenter-prep endpoint reference. Grouped by router. All endpoints are
prefixed with `/api/v1` (`backend/app/main.py:164`).

Auth flavours used below:
- **none** — no auth check at all.
- **optional** — uses `get_optional_current_user`; returns `None` when
  unauthenticated but the endpoint still runs. Behavior may branch on
  identity (e.g. visibility).
- **required** — uses `get_required_current_user`; unauthenticated →
  401.

Rate-limit flavours (from `backend/app/middleware/rate_limit.py:293-318`):
- **login-tight** — `settings.rate_limit_login` per
  `rate_limit_login_window` (defaults 5/60s per IP).
- **register-tight** — `settings.rate_limit_register` per
  `rate_limit_register_window` (defaults 3/60s per IP).
- **global** — `settings.rate_limit_anonymous` per `rate_limit_window`
  (defaults 100/hr per IP).
- **exempt** — `/health` and docs paths, always skipped
  (`rate_limit.py:233-241`).

---

## 1. Health

Router: `backend/app/api/v1/health.py`.

### `GET /api/v1/health`

- **Auth**: none
- **Query/path/body**: none
- **Response 200**: `{"status": "healthy"|"degraded", "version",
  "environment", "timestamp", "services": {"database": "up"|"down",
  "cache": "up"|"down"}}`
- **Side effects**: attempts `SELECT 1` on Postgres and `PING` on Redis.
- **Rate limit**: exempt.
- **Source**: `health.py:18-46`.

**Note on `/metrics`**: the old placeholder `/api/v1/health/metrics`
that returned hard-coded zeros was **deleted** (comment at
`health.py:49-53`). The real Prometheus scrape endpoint is
`GET /metrics` at the root, registered by
`observability/metrics.py:setup_metrics` on lifespan startup
(`main.py:58`). `docs/openapi-spec.yaml:696-717` still describes the
old JSON-shaped `/metrics` and is out of date — treat the code as
truth.

---

## 2. Authentication

Router: `backend/app/api/v1/auth.py`. Prefix `/api/v1/auth`.

### `POST /api/v1/auth/register`

- **Auth**: none
- **Body**: `RegisterRequest` — `schemas/auth.py:11-30`. Password
  policy: min 8 chars, must include upper, lower, digit, special char.
- **Response 201**: `AuthResponse` — `{access_token, token_type: "bearer"}`.
- **Errors**:
  - **400** ("Registration failed. Please try a different email
    address.") — email already registered. Deliberately generic to
    prevent email enumeration (`auth.py:54-61`).
  - **422** — password policy or email format failure.
- **Side effects**: `INSERT users`, issues JWT.
- **Rate limit**: register-tight.

### `POST /api/v1/auth/login`

- **Auth**: none
- **Body**: `LoginRequest` — `schemas/auth.py:33-37`.
- **Response 200**: JSON `{access_token, token_type: "bearer"}` **and**
  sets an `access_token` httpOnly cookie (`auth.py:114-123`).
  `secure=True` in production, `samesite="lax"`,
  `max_age = access_token_expire_minutes * 60`.
- **Errors**:
  - **401** ("Invalid email or password") — user missing OR password
    wrong. Deliberately merged to prevent email enumeration.
- **Side effects**: on failure, increments `users.failed_login_count`
  under `SELECT ... FOR UPDATE`. On the 5th consecutive failure (or
  whatever `settings.max_failed_logins`), sets `users.locked_until`
  (`services/auth_service.py:130-137`). On success, resets both counters.
- **Rate limit**: login-tight.
- **Timing-oracle mitigation**: `services/auth_service.py:121` runs a
  dummy bcrypt verify on non-existent emails.

### `POST /api/v1/auth/logout`

- **Auth**: required
- **Body**: none
- **Response 200**: `{"message": "Logged out successfully"}` (wrapped by
  middleware into `{success, data: {message}}`).
- **Side effects**: revokes the presenting Bearer token AND the
  `access_token` cookie if different, via
  `middleware.token_blacklist.blacklist_token`
  (`auth.py:189-200`). Redis-backed with process-local fallback.
- **Rate limit**: global.

### `GET /api/v1/auth/me`

- **Auth**: required
- **Response 200**: `UserResponse` — `{id, email, is_active, created_at}`
  (`schemas/auth.py:47-55`).
- **Errors**: **401** on invalid/expired token; **401** if token is
  valid but the referenced user record is gone (`auth.py:147-152`).
- **Rate limit**: global.

**No `/auth/refresh` endpoint exists in code.** The openapi spec and
the config's `refresh_token_expire_days` field
(`config.py:61`) suggest one was planned. Access-token lifetime defaults
to 24h (`access_token_expire_minutes = 1440`), so re-login on expiry is
the current recovery path.

---

## 3. FSMs

Router: `backend/app/api/v1/fsm.py`. Prefix `/api/v1/fsms`.

Ownership model (from `services/fsm_service.py`):
- **Read/fork visibility rule**: `visibility ∈ ("public", "example")`
  → any authenticated caller (fork) or anonymous caller (read); else
  owner only. Non-owners get **404, not 403**, to prevent enumeration.
- **Write ownership (`update_fsm`, `delete_fsm`)**: strict owner match
  via `_check_ownership` (`fsm_service.py:179-195`). No public-writable
  case. Non-owners of a real FSM also get 404.

### `POST /api/v1/fsms`

- **Auth**: required
- **Body**: `FSMCreate` — `schemas/fsm.py:25-63`.
- **Response 201**: `FSMResponse` — `schemas/fsm.py:66-88`. Includes
  the JSONB-derived `states` and `transitions` lists.
- **Errors**:
  - **422** — Pydantic validation OR `FSMValidationException` from
    structural validation (`fsm.py:39-41`).
- **Side effects**: `INSERT fsms` with `created_by = caller`,
  `visibility` from request (default `"private"`), bit_width computed
  as `ceil(log2(max(len(states), 2)))`.
- **Rate limit**: global.

### `GET /api/v1/fsms/{fsm_id}`

- **Auth**: optional
- **Path**: `fsm_id: UUID`
- **Response 200**: `FSMResponse`.
- **Errors**: **404** for missing OR private-not-yours (deliberately
  merged).
- **Side effects**: `view_count += 1`, then `COMMIT` (`fsm_service.py:126-128`).
  See `database.md` §8 for the known race.
- **Ownership rule**: public + example → anyone. Everything else →
  owner only.
- **Rate limit**: global.

### `PUT /api/v1/fsms/{fsm_id}`

- **Auth**: required
- **Body**: `FSMUpdate` — `schemas/fsm.py:91-103`. All fields optional;
  any omitted field is left untouched. Includes `states`, `transitions`,
  `initial_state`, `outputs` so the editor can round-trip the full FSM.
- **Response 200**: `FSMResponse` after refresh.
- **Errors**: **404** for missing OR non-owner.
- **Side effects**: on definition-key edits, rebuilds
  `fsm.definition` dict (`fsm_service.py:219-243`) and recomputes
  `state_count`, `transition_count`, `bit_width` as needed. Reassigns
  a new dict so SQLAlchemy detects the JSONB change.
- **Ownership**: strict owner-only.

### `POST /api/v1/fsms/{fsm_id}/fork`

- **Auth**: required
- **Body**: `FSMFork` — `{name}` (`schemas/fsm.py:106-109`).
- **Response 201**: `FSMResponse` for the new FSM.
- **Errors**: **404** if source missing OR (source is private/unlisted
  and caller isn't owner).
- **Side effects**: `INSERT fsms` with `created_by = caller`,
  deep-copies `definition` and `tags`. Inherits visibility from source.
- **Ownership**: public/example → anyone; else owner-only.
- **Note**: does **not** increment `source.fork_count` — the counter
  column exists but is never written to.

### `GET /api/v1/fsms`

- **Auth**: optional (dependency is bound but not consulted for
  filtering — see below).
- **Query**:

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | int ≥ 1 | 1 | |
| `page_size` | int 1-100 | 20 | |
| `fsm_type` | str? | None | `moore` / `mealy` |
| `visibility` | str? | None | `private` / `public` / `unlisted` / `example` |
| `search` | str? | None | Substring match on `name` via `ILIKE '%q%'`. Uses `idx_fsms_name_trgm`. |
| `sort_by` | str? | `created_at` | Allow-listed to `_SORTABLE_FIELDS` (`fsm_service.py:25-27`). Unknown values silently fall back to `created_at`. |
| `sort_order` | str? | `desc` | `asc` or anything else = `desc`. |

- **Response 200**: **hand-wrapped** JSON (not through
  `response_wrapper_middleware`) — includes pagination sibling:

```json
{
  "success": true,
  "data": [FSMResponse, ...],
  "pagination": {"page", "page_size", "total", "pages"}
}
```

  See `fsm.py:125-138`. The `success` key at top level triggers the
  wrapper's "already wrapped" branch
  (`response_wrapper.py:63-69`).

- **Side effects**: none.
- **Ownership caveat**: the endpoint does **not** filter by the caller's
  `created_by`. Any query with `visibility=private` returns all
  private FSMs regardless of who owns them. This appears intentional —
  the SPA scopes to "my FSMs" client-side — but is worth calling out.
- **Rate limit**: global.

### `DELETE /api/v1/fsms/{fsm_id}`

- **Auth**: required
- **Response 204**: no body.
- **Errors**: **404** for missing OR non-owner.
- **Side effects**: **hard delete** — `session.delete(fsm)` + commit.
  No soft-delete flag. If the FSM has `algorithm_results` referencing
  it (either as `original_fsm_id` or `optimized_fsm_id`), the DB raises
  an FK violation because no `ondelete` is declared. See
  `database.md` §2. Caller sees a 500.
- **Ownership**: strict owner-only.

---

## 4. Algorithms (Optimization)

Router: `backend/app/api/v1/algorithm.py`. Mounted under
`/api/v1/fsms` — endpoint paths are `/fsms/{id}/*` and `/fsms/algorithms`.

### `POST /api/v1/fsms/{fsm_id}/optimize`

- **Auth**: required
- **Path**: `fsm_id: UUID`
- **Body**: `OptimizationRequest` — `schemas/fsm.py:112-119`.
  - `algorithm ∈ {greedy, bfs_optimal, global_sa, global_ga}`
  - `options: dict = {}` (algorithm-specific)
  - `async: bool = False` (alias for `async_mode` — Pydantic
    `populate_by_name=True`, `schemas/fsm.py:115`)

- **Sync mode response 200**: `OptimizationResponse` — `schemas/fsm.py:131-142`.
  Contains `optimized_fsm_id`, `algorithm`, `execution_time_ms`,
  `dummy_states_added`, `total_states`, `improvement_percentage`,
  `metrics` (`OptimizationMetrics`), `encoding_map`.

- **Async mode response 202**: hand-wrapped

```json
{"success": true, "task_id": "<uuid>", "status": "pending",
 "status_url": "/api/v1/tasks/<task_id>"}
```

  Poll `status_url` for progress. See `algorithm.py:124-132`.

- **Errors**:
  - **404** — FSM not found or non-owner (public/example FSMs are still
    optimizable — see `_load_fsm` in `optimization_service.py:219-247`).
  - **422** — `is_optimized == True` on the source FSM (block re-optimize
    to prevent dummy-state compounding). Both the sync
    (`algorithm.py:104-112` — async path pre-check) and the service
    layer (`optimization_service.py:129-134`) enforce this.
  - **400** — algorithm execution failure. Logs the full chain, returns
    a generic "Algorithm execution failed" so no internal message leaks
    (`algorithm.py:143-147`).

- **Side effects (sync)**:
  1. Cache check on `optimize:{fsm_id}:{algo}:{options_hash}`.
  2. Insert derived FSM (`is_optimized=True`, `created_by` inherited or
     caller).
  3. Insert `AlgorithmResult` (`success=True`).
  4. One commit.
  5. Cache the response.

- **Side effects (async)**:
  1. Synchronous ownership + `is_optimized` check.
  2. Redis SETNX `task:{task_id}` with owner metadata.
  3. Schedule `_run_optimization_task` as a `BackgroundTask` — opens
     its own DB session (`algorithm.py:50`) since the request-scoped
     session closes when the 202 returns.
  4. On failure, task record set to `status="failed"`,
     `error="Optimization failed"` (generic string,
     `algorithm.py:59-62`).

- **Rate limit**: global.

### `POST /api/v1/fsms/{fsm_id}/compare`

- **Auth**: required
- **Body**: `{"algorithms": [str, ...], "options": {...}}`.
- **Response 200**: hand-wrapped `{success: true, data: [OptimizationResponse|error_obj, ...]}`.
- **Errors**:
  - **422** — empty algorithms list or unknown algorithm names
    (`algorithm.py:237-245`).
  - **404** — FSM not found or non-owner (raised inside the loop the
    first time a run hits it, then re-raised).
  - Per-algorithm failures are captured as
    `{"algorithm": X, "error": "Algorithm execution failed", "success": false}`
    inside the list — one algorithm failing doesn't abort the whole
    comparison (`algorithm.py:260-271`).
- **Side effects**: runs full `optimize_fsm` per algorithm — each
  writes a derived FSM row and an AlgorithmResult row. Cache hits are
  honored, so re-comparing the same algorithm set is cheap.
- **Rate limit**: global.

### `GET /api/v1/fsms/{fsm_id}/results`

- **Auth**: required
- **Query**: `algorithm: str?` — optional filter.
- **Response 200**: hand-wrapped

```json
{"success": true, "data": [AlgorithmResultRow, ...]}
```

  Each row includes `id`, `optimized_fsm_id`, `algorithm`,
  `execution_time_ms`, `dummy_states_added`, `total_states_final`,
  `avg_hamming_before`, `avg_hamming_after`, **`max_hamming_before`**,
  **`max_hamming_after`**, **`encoding_map`**, `improvement_percentage`,
  `success`, `error_message`, `executed_at`. Bold entries were added
  by migration `e6a8c9d0b3f1` so the lab report reconstructs the
  radar + hypercube charts historically.
- **Errors**: **404** if the FSM doesn't exist or isn't owned (verified
  via `OptimizationService.verify_ownership`, `algorithm.py:166-168`).
- **Ordering**: `ORDER BY executed_at DESC`. Uses
  `idx_algorithm_results_fsm_algorithm_time` (see `database.md` §4.3).
- **Rate limit**: global.

### `GET /api/v1/fsms/algorithms`

- **Auth**: optional (unused — endpoint doesn't branch on identity).
- **Response 200**: `list_algorithms()` output — algorithm metadata list.
- **Note**: this endpoint is mounted at `/api/v1/fsms/algorithms`
  because `algorithm.router` shares the `/api/v1/fsms` prefix with
  `fsm.router`. See cross-questions on the ordering trap.

---

## 5. Export

Router: `backend/app/api/v1/export.py`. Mounted under `/api/v1/fsms`.

### `POST /api/v1/fsms/{fsm_id}/export`

- **Auth**: required
- **Body**: `ExportRequest` (`export.py:40-49`)
  - `format ∈ {verilog, vhdl, json, csv, testbench}`
  - `options: ExportOptions` (`export.py:25-38`) — typed replacement
    for raw dict. Includes `module_name`, `include_comments`,
    `include_synthesis_pragmas`, `target_tool ∈ {vivado, quartus,
    generic}`, `clock_period 1-1000`, `include_waveform`, `separator`
    (single char), `include_headers`, `include_section_labels`,
    `style ∈ {standard, compact, verbose}`.
- **Response 200**: hand-wrapped
  `{"success": true, "data": {"format", "content", "file_name",
  "file_size_bytes"}}`.
- **Errors**:
  - **404** — FSM missing or non-owner (public/example fine).
  - **400** — generation failure; message scrubbed
    (`export.py:95-97`).
- **Side effects**:
  1. Ownership verified BEFORE cache lookup
     (`export_service.py:48-51`) so a previous-owner's cached export
     is not served.
  2. Cache read on `export:{fsm_id}:{format}:{options_hash}`.
  3. Content generated by the registered exporter.
  4. `fsms.export_count += 1` (`export_service.py:97`).
  5. Cache write.
- **Ownership**: public/example → anyone; else owner-only.
- **CSV format**: previously returned `null` values verbatim for
  `None` fields — fixed to emit `""` (or the sanitized default) in the
  exporter layer. Behavior lives in `backend/app/core/exporters/`
  (out of scope of this doc).

### `GET /api/v1/fsms/{fsm_id}/export/{format_name}`

- **Auth**: required
- **Path**: `format_name ∈ {verilog, vhdl, json, csv, testbench}`
  (validated at `export.py:123-125`).
- **Response 200**: `text/plain` body — the raw content, not the
  wrapper envelope. Uses `PlainTextResponse` (`export.py:137`), so
  `response_wrapper_middleware` skips (content-type check).
- **Errors**: **404** missing/non-owner, **400** on bad format or
  export failure.
- **Side effects**: same as POST — cache read (or regenerate), export
  count increment on regen.
- **Ownership**: public/example → anyone; else owner-only.

### `GET /api/v1/fsms/formats`

- **Auth**: none
- **Response 200**: `list_formats()` output.
- **Note**: mounted at `/api/v1/fsms/formats` — same shared-prefix quirk
  as `/algorithms`.

---

## 6. Categories

Router: `backend/app/api/v1/category.py`. Prefix `/api/v1/categories`.

### `GET /api/v1/categories`

- **Auth**: none
- **Query**: `parent_id: UUID?` — filter to direct children of a
  category.
- **Response 200**: list of category dicts with
  `{id, name, slug, description, parent_category_id, level,
  display_order, fsm_count}`. Ordered by `(display_order, name)`.
- **Rate limit**: global.

### `GET /api/v1/categories/{category_id}`

- **Auth**: none
- **Response 200**: one category dict, same shape as list.
- **Errors**: **404** if not found.
- **Rate limit**: global.

---

## 7. Examples

Router: `backend/app/api/v1/example.py`. Prefix `/api/v1/examples`.

**Disk-backed** — reads from `backend/examples/*.json` via a
process-shared `ExampleService` instance (`example.py:18`). No DB
involvement. These are distinct from the **DB-seeded** `visibility="example"`
FSMs — the two data sources overlap in content but not in access path.

### `GET /api/v1/examples`

- **Auth**: none
- **Response 200**: list of dicts, each with `id` (= slug), `slug`,
  `name`, `description`, `fsm_type`, `difficulty`, `states`,
  `initial_state`, `transitions`, `outputs`, `state_count`,
  `transition_count`, `bit_width`, `is_optimized`, `dummy_state_count`.
  See `example_service.py:110-128`.
- **Rate limit**: global.

### `GET /api/v1/examples/{example_name}`

- **Auth**: none
- **Path**: `example_name` — the JSON file stem, e.g. `elevator`,
  `traffic_light`.
- **Response 200**: single example dict, same shape.
- **Errors**: **404** if no matching file.
- **Rate limit**: global.

---

## 8. Tasks

Router: `backend/app/api/v1/tasks.py`. Prefix `/api/v1/tasks`. Redis-backed
(see `backend.md` §5).

### `GET /api/v1/tasks/{task_id}`

- **Auth**: required
- **Response 200**: hand-wrapped

```json
{"success": true, "task_id", "status", "fsm_id",
 "progress"?, "result"?, "error"?}
```

  `progress`, `result`, `error` are only present when non-null
  (`tasks.py:251-256`). Internal fields `user_id` and `created_at` are
  stripped.
- **Errors**: **404** — task doesn't exist OR is owned by a different
  user (`tasks.py:241`). Deliberately merged to prevent task-ID
  enumeration.
- **Rate limit**: global.

Storage: `task:{task_id}` in Redis, JSON blob. TTL 7d while
pending/running, 24h once completed/failed
(`tasks.py:49-54, 68-69`). Fallback: per-process
`_fallback_store` dict when Redis is unreachable (`tasks.py:64`).

---

## 9. Response envelope

All 2xx JSON responses eventually carry the envelope

```json
{"success": true, "data": <T>}
```

or the pre-wrapped variant with siblings (see `list_fsms`,
`get_optimization_results`, `compare_algorithms`, the async 202,
`get_task_status`). All non-2xx JSON carries

```json
{
  "success": false,
  "error": {
    "code": "<string>",
    "message": "<human-readable>",
    "details"?: [...],
    "request_id"?: "<uuid>"
  }
}
```

Sources of the error envelope:

| Source | Line | Codes it emits |
| --- | --- | --- |
| App-level `HTTPException` handler | `main.py:183-195` | `"<status_code>"` as string; e.g. `"404"`. |
| App-level `RequestValidationError` handler | `main.py:198-213` | `"VALIDATION_ERROR"` with `exc.errors()` details. |
| `error_handler_middleware` (`GrayFSMException`) | `middleware/error_handler.py:27-41` | `e.code` — one of `"GRAYFSM_ERROR"`, or a per-subclass code (see `utils/exceptions.py`). Attaches `request_id`. |
| `error_handler_middleware` (validation) | `middleware/error_handler.py:42-68` | `"VALIDATION_ERROR"` with sanitized `[{field, message}]`. Attaches `request_id`. |
| `error_handler_middleware` (catch-all) | `middleware/error_handler.py:69-81` | `"INTERNAL_SERVER_ERROR"`. Attaches `request_id`. |
| `rate_limit_middleware._too_many` | `middleware/rate_limit.py:346-367` | `"RATE_LIMIT_EXCEEDED"` with `{limit, reset}`. |

**Frontend contract note**: the two paths that emit VALIDATION_ERROR
(app-level handler vs middleware) produce **different `details`
shapes**. The app-level handler emits raw `exc.errors()` (list of
Pydantic error dicts with `loc`, `msg`, `type`, `input`, etc.). The
middleware handler emits `[{field, message}]` only. In practice
`RequestValidationError` fires at the FastAPI boundary before
middleware sees it, so the app-level path is what clients see most of
the time. The middleware branch stays as a safety net.

Some endpoints return responses that intentionally skip the wrapper —
`GET /api/v1/fsms/{id}/export/{format}` returns `PlainTextResponse`
directly, `GET /metrics` returns Prometheus text. Frontend consumers
should tolerate both wrapped and bare bodies. The `normalizeFSMResponse`
helper on the frontend exists specifically because a subset of paths
(the pre-wrapped ones) can look different from the pure-middleware
default.

---

## 10. Common cross-questions

### Q: Why is `/algorithms` under `/fsms/`? Would that break if someone re-mounts the router?

Yes, it's an accident of shared-prefix routing.
`algorithm.router` is mounted at `/api/v1/fsms` in `main.py:170`, so
every route it declares lands under `/fsms`. It happens to include
`@router.get("/algorithms")` (`algorithm.py:276`), which resolves to
`/api/v1/fsms/algorithms` even though the endpoint has nothing to do
with a specific FSM. Same story for `export.router`'s
`/api/v1/fsms/formats` (`export.py:145`).

If someone remounted `algorithm.router` at, say, `/api/v1/algo`, the
list endpoint would move to `/api/v1/algo/algorithms` and the
frontend's calls would 404. Nothing enforces the current mount point
except `main.py`.

The clean fix is to move `/algorithms` and `/formats` into their own
routers mounted at `/api/v1/algorithms` and `/api/v1/formats`, but
that's a URL-changing move that has to be coordinated with the frontend
call sites.

### Q: How does the frontend know if `/optimize` is running sync or async?

Two signals:
1. The **request** sends `"async": true` when it wants async
   (Pydantic alias `async` for `async_mode`, `schemas/fsm.py:119`).
2. The **response status code** is 200 for sync (`OptimizationResponse`)
   and **202 Accepted** for async
   (`{success, task_id, status, status_url}`, `algorithm.py:124-132`).

The frontend keys on the 202: if it sees the `task_id`, it starts
polling `status_url` (which is `/api/v1/tasks/{task_id}`) until
`status ∈ {"completed", "failed"}`. On completion, `result` in the
task record contains the full `OptimizationResponse` model_dump.

### Q: What's the difference between `visibility=public` and `visibility=example`?

At the access-control level: **none** — both are treated identically
by `FSMService.get_fsm` (`fsm_service.py:121`),
`OptimizationService._load_fsm` (`optimization_service.py:240`),
`ExportService._load_fsm` (`export_service.py:149`), and
`FSMService.fork_fsm` (`fsm_service.py:264`).

At the semantic level:
- `public` — a user chose to publish their FSM.
- `example` — the disk-seeded reference FSMs from
  `backend/examples/*.json`, inserted with `created_by=None` by
  `_seed_examples_if_empty` (`db/session.py:111-124`). They're
  intentionally ownerless so no one user "owns the elevator FSM".

The distinction matters for future work — e.g. hiding examples from a
"my publications" tab, filtering them out of a moderation queue.

### Q: How is the async task's result surfaced back to the frontend?

The task record has a `result` field. When
`_run_optimization_task` completes successfully
(`algorithm.py:56-58`), it calls
`update_task(task_id, status="completed", result=result.model_dump(mode="json"))`.
The polling client sees the terminal status and the fully-serialized
`OptimizationResponse` in one payload — no separate fetch. On failure,
`error: "Optimization failed"` is set instead
(`algorithm.py:59-62`) — a generic string, never the raw exception.

### Q: What happens to the derived FSM if the source is deleted?

FK is declared but no `ondelete` rule
(`algorithm_results.original_fsm_id → fsms.id`,
`algorithm_results.optimized_fsm_id → fsms.id`), so Postgres uses the
default `NO ACTION`.

If you `DELETE FROM fsms WHERE id = source_id` and any
`algorithm_results` row references it, the delete fails with an FK
violation. `FSMService.delete_fsm` (`fsm_service.py:296-307`) doesn't
handle this — the caller gets a 500 wrapped as
`INTERNAL_SERVER_ERROR`.

The derived FSM row itself isn't FK-linked back to the source at the
SQL level; the link is
`derived.definition["original_fsm_id"]` (JSONB). So deleting the
source and the algorithm results together would leave the derived FSM
orphaned but reachable — its "Lab Report" link would 404 because the
`original_fsm_id` no longer exists in `fsms`.

Cleaner behavior would be `ondelete="CASCADE"` on the algorithm_results
FKs plus a JSONB-key cleanup, but that's future work.
