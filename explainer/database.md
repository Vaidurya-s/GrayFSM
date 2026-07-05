# Data Storage — GrayFSM

Presenter-prep notes on how data is stored and moved. Grounded in
`backend/app/models/*.py`, `backend/alembic/versions/*.py`,
`backend/app/db/session.py`, and `backend/app/cache.py`.

Storage stack:

- **PostgreSQL** (asyncpg driver) — canonical state. FSMs, users,
  categories, algorithm results.
- **Redis** — task state, rate-limit counters, JWT revocation list, and
  the optimize/export response cache.
- **On-disk JSON** — example FSMs under `backend/examples/` (loaded by
  `ExampleService`).

---

## 1. Schema overview

### 1.1 `users` — `backend/app/models/user.py:16-37`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| `id` | UUID | PK, default `uuid.uuid4` | Server-side default is `gen_random_uuid()` per migration `c3d4e5f6a7b8`. |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE, indexed | Also has an explicit `idx_users_email` from `f5125b99928d`. |
| `hashed_password` | VARCHAR(255) | NOT NULL | Bcrypt hash from `passlib`. |
| `is_active` | BOOLEAN | nullable, default TRUE | Nullable in the model (`user.py:24`); the `f5125b99928d` migration made this nullable to match. |
| `failed_login_count` | INTEGER | NOT NULL, default 0 | Written under `SELECT ... FOR UPDATE` at login time. |
| `locked_until` | TIMESTAMP (no tz) | nullable | Set when `failed_login_count >= settings.max_failed_logins`. |
| `created_at` | TIMESTAMPTZ | default `now()` | |
| `updated_at` | TIMESTAMPTZ | onupdate `now()` | |

Indexes (`user.py:34-37`):
- `idx_users_email` — supports the `SELECT ... WHERE email = ?` in
  `AuthService._get_user_by_email` (`auth_service.py:167-179`).
- `idx_users_is_active` — supports admin queries filtering active
  accounts. Not currently hit by an API endpoint.

### 1.2 `fsms` — `backend/app/models/fsm.py:54-139`

Central table. **JSONB is the payload** — see §2 for the shape.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `name` | VARCHAR(255) | NOT NULL. No uniqueness constraint. |
| `description` | TEXT | nullable |
| `fsm_type` | ENUM('moore', 'mealy') | NOT NULL. Named PG enum `fsm_type`. |
| `definition` | JSONB | NOT NULL. See §2. |
| `state_count` | INTEGER | NOT NULL. Denormalized from `len(definition["states"])`. |
| `transition_count` | INTEGER | NOT NULL. Denormalized from `len(definition["transitions"])`. |
| `initial_state` | VARCHAR(100) | NOT NULL. Duplicates `definition["initial_state"]` for cheap lookups. |
| `bit_width` | INTEGER | NOT NULL. `ceil(log2(max(state_count, 2)))`. |
| `encoding_type` | VARCHAR(50) | default `'binary'`. Not currently written except by seed. |
| `category_id` | UUID | FK → `categories.id`, nullable |
| `tags` | ARRAY(String) | Postgres text array. |
| `created_by` | UUID | FK → `users.id`, nullable. Nullable rows are unreachable under strict ownership (see backend.md §4.1). |
| `visibility` | ENUM('private', 'public', 'unlisted', 'example') | Named PG enum `fsm_visibility`. Default `'private'`. |
| `is_optimized` | BOOLEAN | default FALSE. Set TRUE for derived FSMs. |
| `optimization_algorithm` | VARCHAR(100) | Which algorithm produced this (only set when `is_optimized=True`). |
| `dummy_state_count` | INTEGER | default 0 |
| `avg_hamming_distance` | DECIMAL(5,2) | Snapshot from the run. |
| `view_count` | INTEGER | default 0. Incremented in `FSMService.get_fsm`. |
| `fork_count` | INTEGER | default 0. Not currently written by any service — appears dead. |
| `export_count` | INTEGER | default 0. Incremented in `ExportService.export_fsm` (`export_service.py:97`). |
| `created_at` | TIMESTAMPTZ | default `now()` |
| `updated_at` | TIMESTAMPTZ | onupdate `now()` |

Indexes declared on the model (`fsm.py:134-139`):

| Index | Column(s) | Purpose |
| --- | --- | --- |
| `idx_fsms_type` | `fsm_type` | Filter list by Moore/Mealy. |
| `idx_fsms_category` | `category_id` | Category listing. |
| `idx_fsms_visibility` | `visibility` | Filter public/example vs private. |
| `idx_fsms_is_optimized` | `is_optimized` | Distinguish derived FSMs. |

Many additional indexes come from migration `b2c3d4e5f6a7` — see §4.

### 1.3 `categories` — `backend/app/models/fsm.py:29-51`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL |
| `slug` | VARCHAR(100) | UNIQUE, NOT NULL |
| `description` | TEXT | nullable |
| `parent_category_id` | UUID | FK → `categories.id` (self-ref) |
| `level` | INTEGER | default 0. Hierarchy depth. |
| `display_order` | INTEGER | default 0 |
| `fsm_count` | INTEGER | default 0. Not maintained by triggers — set only by the seed migration. |
| `created_at` | TIMESTAMPTZ | default `now()` |
| `updated_at` | TIMESTAMPTZ | onupdate `now()` |

Seed rows have fixed UUIDs (`c0000001-0000-0000-0000-00000000000{1..5}`)
so slug↔id mappings survive re-seeds — see
`g7b9d0e1c4f2:38-44`.

### 1.4 `algorithm_results` — `backend/app/models/fsm.py:142-190`

One row per optimization run (success or failure).

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `original_fsm_id` | UUID | FK → `fsms.id`, NOT NULL. |
| `optimized_fsm_id` | UUID | FK → `fsms.id`, nullable. NULL for failures. |
| `algorithm` | ENUM('greedy', 'bfs_optimal', 'global_sa', 'global_ga', 'hybrid') | Named PG enum `algorithm_name`. |
| `algorithm_version` | VARCHAR(50) | From `get_algorithm_info`. |
| `algorithm_parameters` | JSONB | The `options` dict from the request. |
| `dummy_states_added` | INTEGER | default 0 |
| `total_states_final` | INTEGER | NOT NULL |
| `avg_hamming_before` | DECIMAL(5,2) | Pre-optimization avg Hamming. |
| `avg_hamming_after` | DECIMAL(5,2) | Post-optimization avg Hamming. |
| `max_hamming_before` | INTEGER | Added by `e6a8c9d0b3f1`. Radar chart needs this. |
| `max_hamming_after` | INTEGER | Added by `e6a8c9d0b3f1`. |
| `improvement_percentage` | DECIMAL(5,2) | `(avg_before - avg_after) / avg_before * 100`. |
| `encoding_map` | JSONB | Added by `e6a8c9d0b3f1`. Final state→Gray-code map so the hypercube tab reconstructs historically. |
| `execution_time_ms` | INTEGER | NOT NULL |
| `memory_used_mb` | DECIMAL(10,2) | Nullable. Not currently populated. |
| `success` | BOOLEAN | default TRUE |
| `error_message` | TEXT | Only set on failures. Raw exception message — server-side only. |
| `executed_at` | TIMESTAMPTZ | default `now()` |

---

## 2. Relationships and FK diagram

```
   users                       categories ◀──┐
     ▲                              ▲        │ parent_category_id (self-ref)
     │ created_by (nullable)        │ category_id (nullable)
     │                              │
     └──── fsms ──────────────────┬─┘
             ▲                    │
             │ original_fsm_id    │ optimized_fsm_id
             │  (NOT NULL)        │ (nullable)
             │                    │
        algorithm_results ────────┘
```

**Cascade rules**: none of the FKs declare `ondelete` — SQLAlchemy default
is `NO ACTION` / restrict. Practical consequences:

- Deleting a user with FSMs raises FK violation. The API has no
  user-delete endpoint, so this is currently only reachable via
  direct SQL.
- Deleting an FSM that has any `algorithm_results` referencing it
  (either as `original_fsm_id` or `optimized_fsm_id`) raises FK
  violation. `FSMService.delete_fsm` (`fsm_service.py:296-307`) does not
  guard against this — the DELETE will 500 with the FK error. Not a
  common path (users tend to delete source FSMs, not derived ones), but
  a real footgun. See §7.
- The `g7b9d0e1c4f2` migration works around this by deleting in
  child-first order: `algorithm_results` first, then `fsms`
  (`g7b9d0e1c4f2:44-46`).

**SQLAlchemy relationships** (`fsm.py:111-116, 190`):

- `Category.fsms` ⇄ `FSM.category` (many-to-one)
- `FSM.algorithm_results` — one-to-many, keyed by `original_fsm_id`
  only. The `optimized_fsm_id` side is not exposed as a relationship,
  because the derived FSM points back at its source via
  `definition["original_fsm_id"]` (JSONB — see §3), not a SQL join.

---

## 3. JSONB deep-dive — `fsms.definition`

The single most important column in the schema. Everything about the FSM
that isn't tabular metadata lives here.

### 3.1 Shape

For a hand-authored FSM (written by `FSMService.create_fsm`,
`fsm_service.py:74-79`):

```json
{
  "states": ["S0", "S1", "S2"],
  "initial_state": "S0",
  "transitions": [
    {"from_state": "S0", "to_state": "S1", "input": "1", "output": "0"},
    {"from_state": "S1", "to_state": "S2", "input": "0", "output": "1"}
  ],
  "outputs": {"S0": "0", "S1": "1", "S2": "0"}
}
```

For a derived (optimized) FSM (written by
`OptimizationService._persist_optimized_fsm`,
`optimization_service.py:336-343`), two extra keys:

```json
{
  "states": [...],
  "initial_state": "S0",
  "transitions": [...],
  "outputs": {...},
  "encodings": {"S0": "000", "S1": "001", "DUMMY_1": "011", ...},
  "original_fsm_id": "f0000001-0000-0000-0000-000000000001"
}
```

- `encodings` — final state→Gray-code map. Also persisted to
  `AlgorithmResult.encoding_map` since `e6a8c9d0b3f1`.
- `original_fsm_id` — string UUID of the source FSM. This is the
  frontend's way to walk back to the source ("Lab Report" link). Not a
  SQL FK — it's just JSON payload.

Transition object keys are validated by the Pydantic
`TransitionBase` (`schemas/fsm.py:13-23`): `from_state`, `to_state`,
`input`, `output`, `label`. `output` is regex-checked to `[01xXzZ-]*`.

### 3.2 Why JSONB, not relational

The obvious alternative is `transitions` as a separate table. The
reasons this shape wins here:

1. **Read pattern is "give me the whole FSM"**. Every consumer
   (editor, optimizer, exporter, response serializer) needs
   the full state + transitions list. A join would return a fanned-out
   result set of the same shape as `SELECT definition`.
2. **Transitions have variable schema**: Moore vs Mealy carry
   different fields, and future transition types (guards, actions,
   labels) can be added without a migration.
3. **JSONB is indexable**. Migration `b2c3d4e5f6a7` creates a general
   GIN index `idx_fsms_definition_gin` and two path-specific indexes
   `idx_fsms_definition_states` / `idx_fsms_definition_transitions`,
   so queries like "FSMs containing state 'S0'" are index-scan
   candidates.

Trade-off: nothing in Postgres constrains the JSONB shape. The
"initial_state key missing after seed" bug (fixed at
`db/session.py:105-110`) landed because the seeder didn't emit the key
that the optimizer then tried to read.

### 3.3 Accessor pattern on the model

```python
# backend/app/models/fsm.py:118-132
@property
def states(self) -> list[Any]:
    if self.definition and isinstance(self.definition, dict):
        states_raw: list[Any] = self.definition.get("states", [])
        return states_raw
    return []

@property
def transitions(self) -> list[Any]:
    if self.definition and isinstance(self.definition, dict):
        transitions_raw: list[Any] = self.definition.get("transitions", [])
        return transitions_raw
    return []
```

These are Python-side computed properties, not SQL-mapped columns. They
give `FSMResponse.model_validate(fsm)` a way to surface JSONB fields
under top-level response keys via `from_attributes=True`
(`schemas/fsm.py:87-88`). They also **fail soft** — a missing `states`
key returns `[]` rather than KeyError. That's what saved the seed-drift
bug from crashing the read path even before it was fixed at the write
side.

Missing `initial_state` was a different story — the optimizer reads
`original_fsm.definition["initial_state"]` directly
(`optimization_service.py:338, 356`) and would KeyError mid-transaction.
The db/session.py fix at `db/session.py:105-110` is the write-side
mitigation.

---

## 4. Indexes

Two sources: `Index(...)` in the model, and raw SQL in migrations.

### 4.1 Model-declared

| Index | Table | Column(s) | Model line |
| --- | --- | --- | --- |
| `idx_fsms_type` | fsms | fsm_type | `fsm.py:135` |
| `idx_fsms_category` | fsms | category_id | `fsm.py:136` |
| `idx_fsms_visibility` | fsms | visibility | `fsm.py:137` |
| `idx_fsms_is_optimized` | fsms | is_optimized | `fsm.py:138` |
| `idx_users_email` | users | email | `user.py:35` |
| `idx_users_is_active` | users | is_active | `user.py:36` |

### 4.2 Migration-added on `fsms` (all from `b2c3d4e5f6a7`)

| Index | Definition | Query it accelerates |
| --- | --- | --- |
| `idx_fsms_visibility_category_created` | `(visibility, category_id, created_at DESC) WHERE visibility IN ('public','example')` | Public/example listing filtered by category, newest first. |
| `idx_fsms_created_by_visibility_created` | `(created_by, visibility, created_at DESC) WHERE created_by IS NOT NULL` | User dashboard: my FSMs by visibility. |
| `idx_fsms_is_optimized_algorithm_created` | `(is_optimized, optimization_algorithm, created_at DESC) WHERE is_optimized = true` | "Show me all optimized results, latest first" per algorithm. |
| `idx_fsms_created_at_desc` | `(created_at DESC)` | Generic reverse-chronological listing. |
| `idx_fsms_search_text` | `USING gin(fsm_search_vector(name, description))` | Full-text on name+description. Requires an IMMUTABLE wrapper function (`b2c3d4e5f6a7:62-67`) because `to_tsvector` isn't marked immutable by default. |
| `idx_fsms_definition_gin` | `USING gin(definition)` | Any `definition @> ?` containment lookup. |
| `idx_fsms_definition_states` | `USING gin((definition -> 'states'))` | "FSMs containing state X". |
| `idx_fsms_definition_transitions` | `USING gin((definition -> 'transitions'))` | "FSMs with transition matching Y". |
| `idx_fsms_tags_gin` | `USING gin(tags)` | Tag search. |
| `idx_fsms_popular` | `(view_count DESC, created_at DESC) WHERE visibility IN ('public','example') AND view_count > 100` | "Trending" list. |
| `idx_fsms_recently_updated` | `(updated_at DESC) WHERE visibility IN ('public','example')` | Discovery feed. |
| `idx_fsms_list_covering` | `(visibility, category_id, created_at DESC) INCLUDE (id, name, fsm_type, state_count, is_optimized, view_count) WHERE visibility IN ('public','example')` | Index-only scan for the list page — no heap lookup. |
| `idx_fsms_name_trgm` | `USING gin (name gin_trgm_ops)` — from `d4e5f6a7b8c9` | `ILIKE '%q%'` search in `list_fsms`. Prior to this the search was a seq scan; `to_tsvector` indexes can't serve LIKE with a leading wildcard. |

### 4.3 Migration-added on `algorithm_results` and `categories`

| Index | Definition | Purpose |
| --- | --- | --- |
| `idx_algorithm_results_fsm_algorithm_time` | `(original_fsm_id, algorithm, executed_at DESC)` | The `GET /fsms/{id}/results?algorithm=X` query pattern. |
| `idx_algorithm_results_success_improvement` | `(success, improvement_percentage DESC NULLS LAST) WHERE success = true AND improvement_percentage IS NOT NULL` | "Best runs" leaderboard. Not yet used by any endpoint. |
| `idx_algorithm_results_algorithm_performance` | `(algorithm, execution_time_ms, memory_used_mb) WHERE success = true` | Algorithm comparison analytics. Not yet used. |
| `idx_categories_parent_level_order` | `(parent_category_id NULLS FIRST, level, display_order)` | Sidebar tree render. |
| `idx_categories_fsm_count` | `(fsm_count DESC NULLS LAST, name)` | Popularity listing. |

### 4.4 Indexes to flag

- **`idx_fsms_definition_gin`, `idx_fsms_definition_states`,
  `idx_fsms_definition_transitions`, `idx_fsms_search_text`** — none of
  the current API endpoints use these. They exist speculatively for
  future search features. They cost writes but not reads.
- **`idx_fsms_popular`, `idx_fsms_recently_updated`,
  `idx_algorithm_results_success_improvement`,
  `idx_algorithm_results_algorithm_performance`,
  `idx_categories_fsm_count`, `idx_users_is_active`** — same story,
  currently unused by the API.
- **`fork_count`** column exists but no code path writes to it.
  `fork_fsm` does not increment it (`fsm_service.py:249-286`).

---

## 5. Alembic migration history

Chronological, oldest first. Head is `g7b9d0e1c4f2`.

| Revision | Down-revision | What it does |
| --- | --- | --- |
| `5c754bee004e_initial_migration` | None | Creates `categories`, `fsms`, `algorithm_results` with the shape used at launch. Includes the four `idx_fsms_*` model indexes. No `users` table yet. |
| `a1b2c3d4e5f6_seed_categories_and_examples` | `5c754bee004e` | Inserts 5 fixed-UUID categories and 4 example FSMs (elevator, sequence detector 101, traffic light, vending machine) with inline JSON definitions. Uses a slightly different `definition` shape than the disk-based seeder — the drift that `g7b9d0e1c4f2` later fixes. |
| `b2c3d4e5f6a7_performance_indexes` | `a1b2c3d4e5f6` | Bulk of the performance work: composite/partial/GIN/full-text/covering indexes listed in §4.2 and §4.3. Ends with `ANALYZE` on all three tables. |
| `c3d4e5f6a7b8_add_users_table` | `b2c3d4e5f6a7` | Creates `users` with the columns AuthService relies on. Doesn't yet declare `fsms.created_by → users.id` FK (that comes later in `f5125b99928d`). |
| `f5125b99928d_align_head_with_models` | `c3d4e5f6a7b8` | Fixes model/migration drift documented in `backend/alembic/DRIFT.md`. Adds `fsms.created_by → users.id` FK, aligns users column types (`is_active` → nullable, `created_at`/`updated_at` → TIMESTAMPTZ), adds `idx_users_email` and `idx_users_is_active`. |
| `d4e5f6a7b8c9_add_pg_trgm_index_on_fsms_name` | `f5125b99928d` | `CREATE EXTENSION pg_trgm` + GIN index on `fsms.name` so `ILIKE '%q%'` in `list_fsms` (`fsm_service.py:158-159`) becomes an index scan. |
| `e6a8c9d0b3f1_algorithm_result_full_snapshot` | `d4e5f6a7b8c9` | Adds `algorithm_results.max_hamming_before`, `max_hamming_after`, `encoding_map`. Rationale in the docstring: the radar chart rendered zeros and the hypercube tab was empty when revisiting a lab report because these values weren't persisted. All three columns are nullable so pre-migration rows continue to load. |
| `g7b9d0e1c4f2_clean_slate_reseed` | `e6a8c9d0b3f1` | Destructive. `DELETE FROM algorithm_results / fsms / categories`, then bulk-inserts the 5 seed categories with fixed UUIDs. Explicitly leaves FSM re-seeding to the runtime `_seed_examples_if_empty` hook. Rationale in docstring: the migration-based seed drifted from the disk-based seed, and it's cleaner to flush and rebuild from one canonical source (disk) than to write a per-field repair pass. |

---

## 6. Seeding

Two seed paths coexist.

### 6.1 Migration-based (categories only, since `g7b9d0e1c4f2`)

`g7b9d0e1c4f2` inserts the 5 category rows with fixed UUIDs. That's it —
FSM inserts were removed and delegated to the runtime hook. The fixed
UUIDs mean any older bookmark/screenshot linking to a category by ID
still resolves.

### 6.2 Runtime hook — `_seed_examples_if_empty`

`backend/app/db/session.py:81-127`, called from `create_db_and_tables`
which is called from the app's `lifespan` on every boot.

Behavior:
1. `SELECT COUNT(*) FROM fsms`. If `> 0`, return silently
   (`db/session.py:90-92`).
2. `ExampleService().list_examples()` reads all `backend/examples/*.json`.
3. For each example, insert an `FSM` row with:
   - `visibility="example"`
   - `is_optimized=False`, `dummy_state_count=0`
   - `created_by=None` — examples are intentionally ownerless. The
     visibility rules in `FSMService.get_fsm` and `_load_fsm` treat
     `"example"` the same as `"public"` for read access.
   - `definition = {states, initial_state, transitions, outputs}` —
     note `initial_state` is included (the recently-fixed key).

The `initial_state` field on the row is set at
`db/session.py:118` — this is the tabular column, redundant with the
JSONB key. Both are required at write time so the optimizer's read of
`definition["initial_state"]` works.

**Race**: on cold-boot with multiple uvicorn workers, both can pass the
count check and both attempt inserts. There's no name uniqueness on
`fsms.name`, so duplicates result. For production single-worker or
uvicorn-with-Alembic-first deploys this isn't hit; for dev it's a
non-issue because reloads are single-process.

---

## 7. Redis usage

Three concerns share one Redis instance. Key namespaces don't collide.

### 7.1 Task store — `task:{task_id}`

Detailed in `backend.md §5`. JSON blob per task; TTL 7d while running,
24h once terminal. Idempotent create via `SET ... NX`.

### 7.2 Response cache

Written by services, read via `backend/app/cache.py`.

| Key pattern | Written by | TTL |
| --- | --- | --- |
| `optimize:{fsm_id}:{algorithm}:{options_hash}` | `OptimizationService.optimize_fsm` (`optimization_service.py:116, 201`) | `settings.redis_cache_ttl` (default 3600s, `config.py:54`) |
| `export:{fsm_id}:{format}:{options_hash}` | `ExportService.export_fsm` (`export_service.py:57, 115`) | Same. |

`options_hash` is `sha256(json.dumps(sorted(options.items())))[:8]` in
both services — dict-ordering-independent. Values are `json.dumps(...)`
of the response model with `default=str` so `UUID`, `datetime` etc.
serialize.

Cache invalidation is TTL-only — there is no explicit purge when an FSM
is updated or deleted. `cache_delete` exists in `cache.py` but no
service calls it. That's tolerable because:
- Optimize responses are effectively immutable per (fsm, algo, options)
  — as long as the FSM definition doesn't change, re-running gives the
  same output.
- Export responses depend on the same tuple.
- If an FSM is updated or forked, the source hash changes only if the
  caller happens to know the FSM was rewritten, which is a UX concern
  not a correctness one.

### 7.3 Rate-limit counters

`backend.md §3.6` covers behavior. Redis keys:

| Rule | Key pattern |
| --- | --- |
| `auth_login` | `rl:auth:{ip}:/api/v1/auth/login` |
| `auth_register` | `rl:auth:{ip}:/api/v1/auth/register` |
| `anonymous_global` | `rl:ip:{ip}` |

Stored as sorted sets (`ZADD`), pruned per request with
`ZREMRANGEBYSCORE`. Key TTL is refreshed to `window` seconds on every
touch (`rate_limit.py:151`).

### 7.4 JWT revocation list

Backed by `TokenBlacklist` in `backend/app/middleware/token_blacklist.py`.
Keys: `jwt:bl:{sha256(token)[:32]}`, value `"1"`, TTL = seconds
remaining until the token's `exp` claim (`token_blacklist.py:175-188`),
falling back to `access_token_expire_minutes * 60` when the claim isn't
parseable.

Since TTL == token lifetime, revoked entries evict themselves — no
cleanup job.

---

## 8. Common cross-questions

### Q: Why not store transitions in a separate table?

Every read path pulls the full FSM (editor, optimizer, exporter,
response serializer), so a `transitions` table would always be joined
back into the same aggregate. JSONB gives that aggregate in one row
read, with GIN indexes available if we later need containment queries.
The trade-off — no schema enforcement — is mitigated by the Pydantic
write-side validation and the model's soft-reading `@property`
accessors. See `backend.md` cross-questions for the layer breakdown.

### Q: How do you migrate the JSONB shape? Are there versions?

There is no schema version tag inside the JSONB. Historical shape
changes have been handled two ways:

1. **Additive**: new keys (`encodings`, `original_fsm_id`) added by the
   writer, defaulted at read time via `.get(key, default)` in
   `models/fsm.py:118-132`, `optimization_service.py:308-309`.
2. **Corrective**: when the writer omitted a required key
   (`initial_state` in the disk seeder), we fixed the writer and used
   `g7b9d0e1c4f2` to flush and re-seed. No in-place `UPDATE ... SET
   definition = jsonb_set(...)` migration exists in the history.

For a version tag we'd add a top-level `"schema_version"` key and
branch in the readers. Not currently needed.

### Q: What's the cost of `SELECT * FROM fsms WHERE definition @> '{"states": ["S0"]}'`?

With `idx_fsms_definition_gin` from `b2c3d4e5f6a7`, Postgres can plan
this as a bitmap index scan — the containment operator `@>` is the
canonical GIN-indexed JSONB operator. Cost is proportional to the
number of matching rows, not the whole table.

The path-specific `idx_fsms_definition_states` narrows the index to
just the `states` sub-array, which is cheaper for state-membership
queries. Neither index is currently exercised by an API endpoint;
they're forward-looking.

`definition ->> 'states'` (the text extractor) is a different beast —
it materializes the extracted value as text, and `@>` doesn't apply
directly. If you needed `SELECT WHERE definition->>'initial_state' = 'S0'`,
you'd want an expression index on `((definition ->> 'initial_state'))`.
None exists today.

### Q: How does `visibility='example'` access work at the SQL layer?

The visibility check is Python-side, in the services. `_load_fsm` and
`get_fsm` both do:

```python
if fsm.visibility not in ("public", "example"):
    if fsm.created_by is None or user_id is None or fsm.created_by != user_id:
        raise FSMNotFoundException(str(fsm_id))
```

So `SELECT * FROM fsms WHERE id = ?` runs unconditionally, and the
service decides whether to return or 404. There is no row-level security
policy in Postgres itself. If a service is bypassed (e.g. an ORM query
elsewhere), the row is reachable — the enforcement is in one place per
concern, not defense-in-depth.

Query optimizer: several indexes have a partial predicate
`WHERE visibility IN ('public', 'example')`
(`idx_fsms_visibility_category_created`, `idx_fsms_popular`,
`idx_fsms_recently_updated`, `idx_fsms_list_covering`). Public listings
hit these; user-dashboard queries hit
`idx_fsms_created_by_visibility_created`.

### Q: What happens during `_seed_examples_if_empty` if two workers boot simultaneously?

Both count → both see 0 → both walk `examples/*.json` → both call
`session.add(...)` → both `session.commit()`. No `UNIQUE` constraint
on `fsms.name` and no advisory lock, so duplicates land.

Mitigation options if this becomes real:
- `pg_advisory_lock(hash('seed_examples'))` around the whole block.
- `INSERT ... ON CONFLICT DO NOTHING` on a synthetic natural key
  (there isn't one today).
- Move the seed entirely into a migration (like categories) and stop
  running it at boot.

Currently not addressed. Production deploys typically run Alembic
before starting the app process, which populates categories only.
Example FSMs land on first boot of a single worker.

### Q: Are there race conditions on view_count increment?

Yes, technically. `FSMService.get_fsm` (`fsm_service.py:126-128`)
does:

```python
fsm.view_count = (fsm.view_count or 0) + 1
await self.db.commit()
```

Two concurrent reads of the same FSM both fetch `view_count=N`, both
compute `N+1`, and the second commit overwrites — final value is `N+1`
instead of `N+2`. There's no `SELECT ... FOR UPDATE` or `UPDATE fsms
SET view_count = view_count + 1 WHERE id = ?` (which would be atomic
in SQL and race-free).

For a view counter this is acceptable drift. `list_fsms` doesn't
increment (that's noise), so the counter only moves on explicit
`GET /fsms/{id}`, which is user-driven and modest volume. If it grew
into a hot column, the fix is to swap to a SQL-level atomic UPDATE and
drop the round-trip through the ORM object.

The equivalent pattern in `ExportService.export_fsm`
(`export_service.py:97-98`) has the same characteristics.
