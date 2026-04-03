# Security Agent

> Read `agents/memory.md` first for full project context.

## Mission
Integrate the pre-written security fixes from `security/fixes/` and `security/configs/` into the main backend application. The fixes already exist as standalone files — your job is to adapt and wire them into the FastAPI app.

---

## Owned Files

### CREATE (new files in backend)
- `backend/app/middleware/security_headers.py` — Adapted from `security/configs/security_headers.py`
- `backend/app/middleware/auth.py` — Adapted from `security/fixes/01_authentication_middleware.py`
- `backend/app/middleware/csrf.py` — Adapted from `security/fixes/04_csrf_protection.py`
- `backend/app/utils/validators.py` — Adapted from `security/fixes/02_input_validation.py`

### REWRITE
- `backend/app/middleware/rate_limit.py` — Replace no-op with Redis-based rate limiter from `security/fixes/03_rate_limiting.py`

### MODIFY
- `backend/app/main.py` — Add new middleware to the app (CAREFUL: devops-agent also modifies this)
- `backend/app/config.py` — Add any new config fields for security settings

## DO NOT Touch
- `backend/app/api/v1/*` — Owned by backend-agent
- `backend/app/services/*` — Owned by backend-agent
- `backend/app/db/*` — Owned by database-agent
- `backend/app/core/*` — Working algorithms, read-only
- `security/fixes/*` — Reference files, read-only (adapt, don't modify originals)
- `security/configs/*` — Reference files, read-only

---

## Current Status

### What exists in backend:
- `middleware/error_handler.py` — WORKING, catches exceptions
- `middleware/logging.py` — WORKING, logs requests
- `middleware/rate_limit.py` — NO-OP passthrough (does nothing)
- NO auth middleware
- NO security headers
- NO CSRF protection
- NO input sanitization beyond Pydantic

### Pre-written fixes available (READ THESE FIRST):
- `security/fixes/01_authentication_middleware.py` — JWT auth with optional/required modes
- `security/fixes/02_input_validation.py` — Input sanitization, XSS prevention
- `security/fixes/03_rate_limiting.py` — Redis-based rate limiting with sliding window
- `security/fixes/04_csrf_protection.py` — Double-submit cookie CSRF protection
- `security/configs/security_headers.py` — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- `security/configs/cors_config.py` — Tightened CORS settings
- `security/configs/secure_cookies.py` — Secure cookie configuration

### Security audit findings (from security/reports/):
- 3 Critical: No auth (CVSS 9.8), hardcoded secrets (7.5), SQL injection risk (8.2)
- 7 High: Missing headers (7.8), no rate limiting (6.5), permissive CORS (7.2), XSS (7.3)
- 4 Medium: Various

---

## Tasks (Priority Order)

### Task 1: Security Headers Middleware (LOW RISK, HIGH VALUE)
Adapt `security/configs/security_headers.py` into `backend/app/middleware/security_headers.py`:
```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
```

### Task 2: Rate Limiting (Replace no-op)
Adapt `security/fixes/03_rate_limiting.py`:
- Use Redis if available, graceful fallback to in-memory dict if Redis is down
- Key by IP address
- Respect `settings.rate_limit_anonymous` (100/hour) and `settings.rate_limit_authenticated` (1000/hour)
- Return 429 with `Retry-After` header when exceeded

### Task 3: Input Validation Utilities
Adapt `security/fixes/02_input_validation.py`:
- HTML entity encoding for user inputs
- SQL injection pattern detection
- Max length enforcement
- Create `sanitize_string()`, `validate_fsm_name()`, `validate_tags()` functions

### Task 4: Authentication Middleware (OPTIONAL MODE)
Adapt `security/fixes/01_authentication_middleware.py`:
- Create `get_optional_current_user` dependency (returns user or None)
- Create `get_required_current_user` dependency (returns user or 401)
- Use JWT tokens from `Authorization: Bearer <token>` header
- **CRITICAL**: Wire as OPTIONAL — all endpoints must still work without auth tokens
- Use `settings.secret_key` and `settings.algorithm` from config

### Task 5: Wire Everything into main.py
Add to `backend/app/main.py` (after existing middleware):
```python
from app.middleware.security_headers import SecurityHeadersMiddleware

# Add BEFORE CORS middleware (order matters)
app.add_middleware(SecurityHeadersMiddleware)
```

Middleware order (top = outermost):
1. SecurityHeaders
2. CORS
3. GZip
4. Rate Limiting
5. Logging
6. Error Handler

---

## CRITICAL RULES

1. **Do NOT break existing endpoints.** All FSM CRUD operations must continue working without any authentication.
2. **Auth is OPTIONAL.** Use `get_optional_current_user` as the default dependency. Never require auth on existing endpoints.
3. **Rate limiting must be graceful.** If Redis is unavailable, fall back to in-memory — never crash the app.
4. **Config changes must have defaults.** Any new config fields must have sensible defaults so the app starts without new env vars.

---

## Interfaces

- **devops-agent** also modifies `main.py` (for observability). You both work in separate worktrees, so no conflict during implementation. When merging: security middleware goes first, then observability.
- **backend-agent** writes endpoints. Your auth middleware wraps their routes. Keep it optional.
- **database-agent** may add a users table later. For now, auth is token-only (no DB lookup).
