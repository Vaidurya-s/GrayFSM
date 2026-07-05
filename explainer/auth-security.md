# Auth & Security — Presenter Prep

Senior-engineer walk-through of the authentication pipeline, session
management, ownership model, and the middleware defences that sit around
them. All line references are against the current tree.

---

## 1. JWT flow end-to-end

### Register / login

- `POST /api/v1/auth/register` — `backend/app/api/v1/auth.py:31`. Calls
  `AuthService.register` (`backend/app/services/auth_service.py:67`),
  which bcrypts the password with `passlib` (`auth_service.py:23`),
  inserts a `User` row, then mints an access token via
  `create_access_token` (`backend/app/middleware/auth.py:115`).
- `POST /api/v1/auth/login` — `auth.py:75`. Two things worth calling
  out:
  1. Response body carries the token AND the middleware sets it as an
     httpOnly cookie (`auth.py:114-122`, `samesite=lax`, `secure` only
     in production). That is why we have two token paths (see G1 in
     SECURITY-GAPS).
  2. Registration collision returns a generic 400 (`auth.py:56-61`) so
     an attacker cannot enumerate registered emails.

### Client-side storage

Frontend stores the raw token in `localStorage` under the key
`auth_token` (`frontend/src/store/authStore.ts:4`) and caches the user
record under `auth_user` (`authStore.ts:10`). Cached user exists so a
transient `/auth/me` failure doesn't half-log-out the UI — see §3
below.

### Request path

Every outbound request goes through the axios interceptor at
`frontend/src/api/client.ts:14-24`:

```
localStorage.getItem('auth_token') -> Authorization: Bearer <token>
```

### Server-side decode

`get_optional_current_user` / `get_required_current_user`
(`backend/app/middleware/auth.py:159` and `:190`) both take the bearer
header first, then fall back to the `access_token` cookie
(`auth.py:172-175`, `:201-205`). Decoding lives in `_decode_token`
(`auth.py:67`):

1. Check blacklist (`auth.py:75`) — early exit if revoked.
2. `jose.jwt.decode` with `settings.secret_key`, `settings.algorithm`,
   and audience `settings.jwt_audience` (`auth.py:89-94`).
3. Reject the token if `type != "access"` (`auth.py:100-102`) — guards
   against a future refresh-token being replayed on data endpoints.
4. Return `{"user_id", "email", "roles"}`. That's all the routes see;
   they do not touch the raw JWT.

### 401 handling on the client

`client.ts:29-40` — a 401 response clears `localStorage.auth_token`
and redirects to `/login` (unless we are already on `/login` or
`/register`). This is the mechanism that keeps stale-token traffic
from silently failing while the navbar still claims the user is
authenticated.

### Session restore on reload

`authStore.init()` (`authStore.ts:82-108`) runs on app boot:

- If no token in localStorage, do nothing.
- Otherwise call `authAPI.me()` (GET `/api/v1/auth/me`, backed by
  `auth.py:126`).
- **5xx-tolerance:** only 401/403 clears the session
  (`authStore.ts:96-99`). Any other rejection (502, timeout, network
  error) preserves the cached user (`authStore.ts:100-104`). Before
  fix 9039879 a single hiccup left the navbar with `token` gone but
  `isAuthenticated` still true — email disappeared and a "LOGOUT"
  button hung around. This is what `authStore.test.ts` pins.

### Logout

`POST /api/v1/auth/logout` (`auth.py:167-203`) blacklists two tokens:
the one from the `Authorization` header AND the one from the
`access_token` cookie if different (`auth.py:198-200`). Without the
second call, users who logged in via the cookie flow kept a live
session after clicking Logout. Client side, `authStore.logout()`
(`authStore.ts:71-80`) does `authAPI.logout()` best-effort and clears
localStorage regardless of the server response.

### Token contents / TTL

- Claims added by `create_access_token`: `exp`, `iat`, `type=access`,
  `aud=grayfsm-api`, plus caller-supplied `sub` (user id), `email`,
  `roles` (`auth.py:137-144`).
- Algorithm: `HS256` (`config.py:59`).
- TTL: `access_token_expire_minutes = 1440` — 24 hours
  (`config.py:60`). The comment there is candid: "avoid mid-session
  expiry." See §"common cross-questions" for the trade-off.
- There is a `refresh_token_expire_days = 7` field in config
  (`config.py:61`) but **no refresh endpoint is implemented**. The
  system is single-token today; the setting is aspirational.

---

## 2. Auth flow at a glance

| Step | Path | Client action | Server action | Failure mode |
|---|---|---|---|---|
| Register | `POST /auth/register` | Send email + password | `AuthService.register` bcrypt-hashes, inserts, mints JWT | 400 generic on duplicate email |
| Login | `POST /auth/login` | Send credentials | `AuthService.login` verifies bcrypt, resets lockout counter, mints JWT, sets cookie | 401 generic; lockout counter increments |
| Store | — | `localStorage.auth_token` + `auth_user` | — | `localStorage` unavailable → cached user reads swallow the error (`authStore.ts:15-18`) |
| Attach | any authed call | axios request interceptor adds `Authorization: Bearer` | `get_required_current_user` decodes | Missing token → 401 with `WWW-Authenticate: Bearer` |
| Session restore | reload | `authStore.init()` → GET `/auth/me` | Decode token, return user record | 401/403 clears; 5xx keeps cached user |
| Logout | `POST /auth/logout` | Fire best-effort, clear localStorage | Blacklist header token AND cookie token | Redis down → in-memory fallback (§4) |
| Failed login | `POST /auth/login` | Response 401 | Increment `failed_login_count`, lock after N | Row-level `SELECT ... FOR UPDATE` so concurrent bad tries serialise |

---

## 3. Token blacklist

`backend/app/middleware/token_blacklist.py`. Small module doing one
thing: "is this token revoked?"

- Class `TokenBlacklist` (`token_blacklist.py:57`) wraps an optional
  sync `redis.Redis` client and a process-local `set[str]` fallback.
- Storage key: `f"jwt:bl:{sha256(token)[:32]}"` (`token_blacklist.py:110`).
  Truncated hash keeps Redis keys short and prevents raw-token leakage
  if someone dumps the keyspace.
- `revoke` uses `SETEX` (`token_blacklist.py:82`) with TTL = "remaining
  seconds until the token's `exp` claim" (`_remaining_ttl`,
  `token_blacklist.py:175-188`, best-effort via
  `jwt.get_unverified_claims`). So revocations auto-clean when the
  token would have naturally expired.
- `is_revoked` (`token_blacklist.py:91`) is the checked-first step
  inside `_decode_token` (`auth.py:75`).
- **Fail-open policy** on Redis errors: revoke that can't write to
  Redis falls back to the in-memory set (`token_blacklist.py:84-89`).
  A read that can't reach Redis returns "not revoked"
  (`token_blacklist.py:99-100`) — the trade-off is that a truly-revoked
  token can be re-used briefly during a Redis outage on any worker
  that never saw the original revoke. The alternative (fail closed)
  would take the entire authed API down when Redis blips. Documented
  in the module docstring.
- Test coverage: `backend/tests/test_core/test_token_blacklist.py`
  covers Redis-mocked and no-Redis (`redis_client=None`) paths across
  ~15 cases.

---

## 4. Rate limiting

`backend/app/middleware/rate_limit.py`.

### Stores

- `InMemoryRateLimitStore` (`:36`) — dict of `key -> list[timestamp]`,
  sliding window, prunes on read.
- `RedisRateLimitStore` (`:95`) — Redis sorted set per key,
  `ZREMRANGEBYSCORE` + `ZADD` + `EXPIRE` in a single pipeline
  (`:147-152`). If limit is exceeded, the ZADD is undone (`:166`) so
  we don't inflate the count with rejected requests.
- Lazy Redis connect (`_get_redis_store`, `:191`): tries once, caches
  the result. Failure downgrades silently to the in-memory store.

### Rule model

`RateLimitRule` dataclass (`:260`) collapses the previous duplicated
blocks. Each rule has a `matches` predicate, a `key_for` bucket key,
and late-bound `limit_factory` / `window_factory` so a settings reload
picks up new limits without middleware restart.

`_build_rules()` (`:293`) returns three rules; first match wins:

| Name | Match | Bucket | Default limits (from `config.py`) |
|---|---|---|---|
| `auth_login` | `path == /api/v1/auth/login` | per-IP + path | `rate_limit_login = 5` / `rate_limit_login_window = 60s` (`config.py:97`) |
| `auth_register` | `path == /api/v1/auth/register` | per-IP + path | `rate_limit_register = 3` / `60s` (`config.py:99`) |
| `anonymous_global` | catch-all | `rl:ip:<ip>` | `rate_limit_anonymous = 100` / `rate_limit_window = 3600s` (`config.py:91,93`) |

There is a `rate_limit_authenticated = 1000` setting in
`config.py:92` but it isn't wired into a rule — the catch-all does not
distinguish authed vs anonymous today.

### Exempt paths

`_EXEMPT_PATHS` (`:233`): `/health`, `/api/v1/health`, `/docs`,
`/redoc`, `/openapi.json`. WebSocket paths bypass because the
middleware is registered against `http` only (`main.py:159`).

Global bypass: `settings.rate_limit_enabled = False`
(`rate_limit.py:385`). CI turns this off explicitly
(`.github/workflows/contract-tests.yml:199` sets
`RATE_LIMIT_ENABLED: "false"`).

### Response shape

`_too_many` (`:346`) returns HTTP 429 with:
- Body: `{"success": false, "error": {"code": "RATE_LIMIT_EXCEEDED", "message": ..., "details": {"limit": ..., "reset": ...}}}`.
- Headers: `Retry-After: <window seconds>`, `X-RateLimit-Limit`,
  `X-RateLimit-Remaining: 0`, `X-RateLimit-Reset`.

On the happy path the `X-RateLimit-*` triple is added to the outbound
response (`:411-414`).

### Client IP resolution

`_get_client_ip` (`:217`) trusts `X-Forwarded-For` only when the
direct connection is in `settings.trusted_proxies` (`config.py:84`).
Without this guard an attacker rotates the leftmost XFF value and
bypasses per-IP limits. The default list is empty — deployments
behind nginx must set `TRUSTED_PROXIES=<edge-ip>` in the environment.

### Fail-open

`_check` (`:321`) wraps store calls in `try/except`; any internal
failure logs and returns `(True, {})` so a broken limiter never
takes production offline. Comment at `:327` marks it as a deliberate
policy trade.

---

## 5. Account lockout

Enforced inside `AuthService.login` (`auth_service.py:98-151`):

- Load the user row `SELECT ... FOR UPDATE`
  (`_get_user_by_email_for_update`, `:181`). Without the row lock,
  concurrent bad-password requests all read `failed_login_count=4`
  and write `5`, so lockout never fires. This is one of the subtle
  wins in the current path — call it out on cross-questions.
- Compare with `pwd_context.verify`. On mismatch, increment
  `failed_login_count`; if it reaches `settings.max_failed_logins`
  (default 5, `config.py:68`), set `locked_until = now +
  account_lockout_minutes` (default 15, `config.py:69`)
  (`auth_service.py:130-137`).
- If a login attempt comes in while `locked_until > now`, raise
  `InvalidCredentialsException` before running the bcrypt verify
  (`auth_service.py:126-128`). Presented to the caller as a generic
  401 (no separate 423 / Retry-After) so the surface doesn't
  distinguish "wrong password" from "locked".
- Successful login clears both counters (`auth_service.py:146-148`).

### Timing-oracle mitigation

If a login comes in for a non-existent email, we still run a bcrypt
verify against a pre-computed dummy hash (`_TIMING_DUMMY_HASH`,
`auth_service.py:29`, `pwd_context.verify(password, _TIMING_DUMMY_HASH)`
at `:121`) before raising `UserNotFoundException`. Without it the
response time distinguishes "user exists, wrong password" (~100ms
bcrypt) from "no such user" (~1ms lookup), leaking email validity.

---

## 6. Ownership rules — visibility model

### Enum values

`visibility` on the FSM row is one of `private`, `public`, `unlisted`,
`example` (used in tests and services, e.g.
`test_visibility_access.py`, `optimization_service.py:240`).

### Anonymous read matrix

Enforced in `FSMService.get_fsm` (`fsm_service.py:98-130`):

| `visibility` | `created_by` | anonymous | authed non-owner | owner |
|---|---|---|---|---|
| `public` | any | 200 | 200 | 200 |
| `example` | usually NULL | 200 | 200 | 200 |
| `private` | user X | 404 | 404 | 200 |
| `unlisted` | user X | 404 | 404 | 200 |
| any | NULL, not public/example | 404 | 404 | 404 (nobody) |

Key rule at `fsm_service.py:121-123`:

```python
if fsm.visibility not in ("public", "example"):
    if fsm.created_by is None or user_id is None or fsm.created_by != user_id:
        raise FSMNotFoundException(str(fsm_id))
```

Note the deliberate `FSMNotFoundException` (surface: 404) rather than
`FSMPermissionException` (403). Reasoning at `fsm_service.py:107-109`:
you must not be able to distinguish "does not exist" from "not yours"
because that leaks the existence of private IDs. Whole classes of
side-channel enumeration attacks are closed by that choice — the same
pattern repeats in `optimization_service.py:242` and
`export_service.py:151`.

### Fork

`FSMService.fork_fsm` (`fsm_service.py:249-286`). Public + example
FSMs are forkable by anyone; anything else requires ownership
(`:264-266`). The forked row is stamped with `created_by = user_id`
(`:280`) so the caller owns the copy.

### Optimize + export — the mirror rule

Both `OptimizationService._load_fsm` (`optimization_service.py:219-247`)
and `ExportService._load_fsm` (`export_service.py:128-157`) implement
the identical predicate: `visibility in ("public","example")` bypasses
ownership; otherwise strict owner match. This is intentional so
"anyone authenticated can optimize an example, and the resulting FSM
is theirs" works.

Derived-FSM ownership: `_persist_optimized_fsm` at
`optimization_service.py:365`:

```python
created_by=original_fsm.created_by or user_id,
```

So an optimize of an ownerless example (`created_by=NULL`) is owned by
the caller. Without the `or user_id` fallback the derived row would
be NULL-owned and immediately unreachable under strict-ownership —
the exact regression that led to fix `b7a5a2d`, which
`test_optimize_authorization.py` now pins.

### Update / delete

`update_fsm` and `delete_fsm` route through `_check_ownership`
(`fsm_service.py:179-195`), which is stricter than the read rule:

```python
if fsm.created_by is None or user_id is None or fsm.created_by != user_id:
    raise FSMPermissionException(str(fsm.id))
```

Even "example" and "public" FSMs must be owned by the caller to be
mutated. Legacy NULL-`created_by` rows are unreachable to writers
regardless of visibility — the docstring at `:184-192` calls this out
and points at `alembic/DRIFT.md` for the backfill migration path.

### Re-optimization block

`api/v1/algorithm.py:104-112` — an async optimize on an FSM whose
`is_optimized == True` returns 422 with an explanatory message. This
is what `test_optimize_authorization.py` pins at fix `25d2fed`.
Compounding dummy states from repeated optimize passes is a real
correctness bug that this guard prevents.

---

## 7. Security headers

Middleware: `backend/app/middleware/security_headers.py`. Applied to
**every** response (`main.py:153`) — including 4xx/5xx.

| Header | Value | Mitigates |
|---|---|---|
| `Content-Security-Policy` | Development: `'unsafe-inline' 'unsafe-eval'` for scripts, `ws:` for HMR. Production: `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `frame-ancestors 'none'`, `object-src 'none'`, `upgrade-insecure-requests` (`security_headers.py:76-89`). | XSS, framing, mixed-content. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` (production only, `:108-111`). | Protocol downgrade. |
| `X-Frame-Options` | `DENY` (`:114`). | Clickjacking. Belt-and-braces with CSP `frame-ancestors`. |
| `X-Content-Type-Options` | `nosniff` (`:117`). | MIME-sniffing exploits. |
| `X-XSS-Protection` | `1; mode=block` (`:120`). | Legacy IE/older-Chrome. Modern browsers rely on CSP. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` (`:123`). | Leaking URL secrets in `Referer`. |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=(), payment=(), usb=()` (`:126`). | Disables APIs the app never needs. |
| `Cross-Origin-Opener-Policy` | `same-origin` (production only, `:133`). | Cross-window attacks. |
| `Cross-Origin-Embedder-Policy` | `require-corp` (production only, `:134`). | Enables cross-origin isolation. |
| `Server` | stripped (`:137-138`). | Fingerprinting reduction. |

Why `style-src 'unsafe-inline'` in production (`:73-75`): the bundled
SPA (three.js, recharts, react-flow) injects runtime `<style>` blocks
for dynamic theming. Removing it would require refactoring those
libs' style paths — outside the scope of the security consolidation.

---

## 8. CORS

`backend/app/main.py:137-150`. Two startup-time guards:

1. **Wildcard-with-credentials is a hard error** (`main.py:138-139`):
   `if cors_origins == ["*"] and cors_allow_credentials: raise RuntimeError`.
   Browsers ignore `Access-Control-Allow-Origin: *` when credentials
   are requested — you cannot ship "authenticated + wildcard" and
   have anything work, and it's a common misconfiguration, so we
   refuse to boot.
2. **Wildcard in non-dev logs a warning** (`main.py:140-141`).

Configured origins: `settings.cors_origins` (`config.py:72`, defaults
to `localhost:3000` and `localhost:5173`). Parsed from either a Python
list or a comma-separated env string via
`parse_cors_origins` (`config.py:150-156`).

---

## 9. Config-layer defenses

`backend/app/config.py::validate_runtime_settings` (`:166-226`) runs
on every `Settings()` instantiation:

- **Placeholder DB / Redis URL rejection** (`:183-193`): if
  `DATABASE_URL` or `REDIS_URL` contain the sentinel `_placeholder_`,
  refuse to start. Exception is `ENVIRONMENT in ("test", "ci")` where
  placeholders are legitimate (tests never touch a real backend).
- **Placeholder `SECRET_KEY` rejection in production** (`:199-203`):
  empty or containing `"change-in-production"` fails.
- **Minimum secret length** (`:205-206`): production requires
  `len(secret_key) >= 32`.
- **`DEBUG=False` in production** (`:208-211`).
- **Dev credentials in production DB URL** (`:214-218`): rejects
  `"grayfsm:password@"` — a specific string that shows up in the
  `.env.example` and would otherwise be an easy accidental deploy.
- **Wildcard CORS in production** (`:220-224`): logs a warning
  (deliberately non-fatal so ops can still ship an intentionally-open
  API).

Related: `force_async_pg_driver` (`:134-148`) rewrites `postgres://`
and `postgresql://` to `postgresql+asyncpg://`. Not security per se
but often mistaken for one — managed hosts inject the sync driver
prefix, we need async.

---

## 10. Open gaps — `docs/SECURITY-GAPS.md`

Two items open, tracked with severity, at `docs/SECURITY-GAPS.md:11-39`:

- **G1: No CSRF middleware.** Medium. The Authorization-header path
  is not CSRF-attackable but the httpOnly cookie set by
  `POST /auth/login` (`auth.py:114-122`) is. Reference implementation
  sits at `security/fixes/04_csrf_protection.py`. Mitigations today:
  strict CORS (§8), `samesite=lax` cookie attribute, same-origin
  policy.
- **G2: No project-specific `SecureValidator` utility.** Low.
  Superseded by Pydantic v2 `field_validator`s in
  `backend/app/schemas/`. Would be worth resurrecting only if we ever
  need to validate FSM input outside the request layer (e.g. CLI
  imports).

The closed table in the same file (`SECURITY-GAPS.md:41-58`) is the
canonical "what audit findings are done" — refer to it during Q&A so
we don't rehash the historical audit.

---

## 11. Security CI gates

### `.github/workflows/security.yml`

Runs on PRs touching `backend/**` or `frontend/**`, on push to main,
and nightly at 03:17 UTC (`security.yml:22-32`).

| Job | Tool | Blocking? | Notes |
|---|---|---|---|
| `pip-audit` | pip-audit against `backend/requirements.txt` | Advisory (`continue-on-error: true`, `security.yml:62`) | Uses OSV as the vulnerability service. |
| `npm-audit` | `npm audit --audit-level=high` in `frontend/` | **Blocking** on HIGH/CRITICAL (`security.yml:98`) | Install with `--ignore-scripts` (`:92`) so a compromised dep can't run install-time code. |
| `bandit` | `bandit --recursive backend/app` | Advisory (`:120`) | Medium severity + medium confidence floor. Skips `B101` (asserts). |

### `.github/workflows/secrets-scan.yml`

Runs `gitleaks/gitleaks-action@v2` on PRs, pushes to `main` /
`develop`, and weekly Mondays 04:00 UTC. Full history
(`fetch-depth: 0`) so PRs that added a leak in an earlier commit are
still caught. Dedicated workflow so the PR-level cost of the security
gate stays low.

### `.gitleaks.toml`

Extends the upstream default ruleset (`[extend] useDefault = true`).
The allowlist scopes:
- Path exemptions: `*.env.example`, `*.env.template`,
  `backend/tests/*` (test JWT fixtures are signed with a test key),
  `frontend/src/**/*.test.{ts,tsx,js,jsx}`, lockfiles.
- Regex exemptions: `your_secret_here`, `change_me`, `placeholder`,
  `dev_secret`, `super_secret`.

The allowlist is narrowly scoped — we don't disable any detector
globally.

### `.github/workflows/contract-tests.yml`

Not a security workflow per se but relevant because it runs the
integration tests with `RATE_LIMIT_ENABLED: "false"`
(`contract-tests.yml:199`) — worth knowing when someone asks "how do
you keep rate limits from flaking CI".

---

## 12. Common cross-questions

**Q. How is the JWT signed? What algorithm?**
HS256 (`config.py:59`), symmetric secret in
`settings.secret_key`. We rejected asymmetric (RS256/ES256) for
simplicity — one process signs and verifies. Rotating the secret
invalidates every issued token, which is a feature for emergency
revoke-all.

**Q. What if someone steals a token? How fast can we revoke it?**
Global revoke of a single token: any request that reaches
`_decode_token` sees the blacklist immediately after
`blacklist_token` writes to Redis (single-writer semantics on
`SETEX`, `token_blacklist.py:82`). The 24h TTL is the outer bound —
if we lose the blacklist we lose the revoke, but the token still
expires within a day. For "revoke everyone right now," rotate
`SECRET_KEY` and restart. Every issued JWT fails
`jwt.decode` (`auth.py:89`) on the next request.

**Q. Why 24h token expiry — isn't that too long?**
Trade-off documented at `config.py:60`. Short expiries need a
refresh flow; we don't have one (see §1). The alternative was
"users get logged out mid-session", which was intolerable during
the current UX. When refresh lands we shorten access to ~15min.

**Q. Why is the ownership rule "return 404 not 403" for private FSMs?**
Enumeration protection. 403 tells the attacker "this ID exists,
you just can't see it." 404 makes existence indistinguishable
from absence. See the docstring at `fsm_service.py:107-109` — the
same pattern intentionally repeats across
`optimization_service.py:222-223` and
`export_service.py:132-133`.

**Q. What prevents rate-limit bypass by rotating IPs?**
Nothing — that's an accepted limitation of IP-based rate limits
under distributed attack. Mitigations we do have: (1) auth-route
throttles are per-IP + per-path so a rotating IP still triggers
account lockout on the target email (§5); (2) trusted-proxy list
means the leftmost XFF can't be forged unless the attacker
controls the direct connection (`rate_limit.py:224-229`); (3) the
underlying account-lockout counter (`auth_service.py:130-137`) is
per-user, not per-IP, so brute-force against one email is bounded
regardless of source IP.

**Q. Which security controls are shipped vs still on the SECURITY-GAPS list?**
Two open (G1 CSRF, G2 SecureValidator), both medium/low. Nine
closed and cross-referenced in `SECURITY-GAPS.md:47-58`. That table
is authoritative — the audit report is historical.

**Q. How is CSP configured — does it block inline scripts?**
Yes in production (`script-src 'self'`, `security_headers.py:78`).
No in development where HMR needs `unsafe-eval`
(`security_headers.py:56`). Inline styles are still allowed in
production because runtime dynamic-style injection from bundled
libs (three.js, react-flow) would otherwise break — trade-off
documented in the comment at `security_headers.py:73-75`.

**Q. What happens if Redis is down — does auth still work?**
Yes, on both paths. Blacklist reads treat "no Redis" as "not
revoked" (`token_blacklist.py:99-100`) — fail-open, we do not want
to lock everyone out on a Redis blip. Rate limiter falls back to
the in-process dict (`rate_limit.py:333`). The in-process fallback
only holds on the worker that saw the request, so under a
horizontally-scaled deployment during a Redis outage, revocations
and rate limits stop being cluster-consistent until Redis returns.
This is the deliberate fail-open policy — documented in the module
docstrings.

**Q. Why is the login row-locked?**
See `auth_service.py:113-117`. Without `SELECT ... FOR UPDATE`,
concurrent bad-password attempts all read the same
`failed_login_count` and write back the same incremented value,
so the counter never crosses the lockout threshold. The lock
serialises the increment.
