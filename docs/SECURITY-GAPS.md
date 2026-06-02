# Security Gaps

This file tracks defensive controls that the historical security audit
(`security/reports/SECURITY_AUDIT_REPORT.md`, dated 2025-11-29) recommends
and that are **not** currently implemented in `main`. It exists so the
reader doesn't have to cross-reference an audit against live code to know
what's still outstanding.

Last reconciled: 2026-06-02.

## Gaps

### G1. No CSRF middleware

- **Recommended by:** `security/README.md` Step 8 ("Implement CSRF
  Protection"), `security/QUICK_IMPLEMENTATION_GUIDE.md`.
- **Reference implementation:** `security/fixes/04_csrf_protection.py`
  (not copied into `backend/app/middleware/`).
- **Status in `main`:** `grep -r csrf backend/app/` returns nothing.
- **Severity:** Medium. JWTs are sent via `Authorization` header *or*
  httpOnly cookie. The cookie path is the one CSRF would protect — the
  header path is not CSRF-attackable. The auth router does set an
  httpOnly cookie on login, so the gap is real for the cookie flow.
- **Mitigation today:** strict CORS (no wildcard with credentials enforced
  at startup), SameSite cookie attribute, and the same-origin policy.

### G2. No project-specific `SecureValidator` utility

- **Recommended by:** `security/README.md` Step 6, citing
  `security/fixes/02_input_validation.py` with methods like
  `validate_fsm_name`, `validate_state_name`.
- **Status in `main`:** `app.utils.validators` does not exist.
- **Severity:** Low. The Pydantic v2 schemas in `backend/app/schemas/`
  use `field_validator` and constrained types, which cover the input
  surface the audit was concerned about (length limits, character
  whitelists for state names, allowed visibility values). The named
  utility was never adopted; the equivalent validation is in the schemas.
- **Action:** none required unless we want a single import surface for
  reuse outside the request layer (e.g. CLI import paths).

## Closed (audit findings that are now implemented)

The following audit findings from `security/reports/SECURITY_AUDIT_REPORT.md`
are resolved in current `main` — listing them here so they aren't
re-raised:

| Finding | Resolved by |
|---|---|
| V-01 No authentication | `backend/app/middleware/auth.py` + `app/api/v1/auth.py` (JWT + refresh + cookie) |
| V-01 No FSM ownership check | `app/services/fsm_service.py::_check_ownership` + visibility rule |
| V-02 Hardcoded secret | Config validator rejects placeholder `SECRET_KEY` in non-dev environments |
| V-05 Missing security headers | `app/middleware/security_headers.py` (CSP, HSTS, X-Frame-Options, etc.) |
| V-07 Overly permissive CORS | Wildcard-with-credentials rejected at startup in `app/main.py` |
| Rate limiting "stub only" | `app/middleware/rate_limit.py` — Redis-backed, per-IP and per-user, with auth-route throttles |
| No identification failures lockout | `MAX_FAILED_LOGINS` + `ACCOUNT_LOCKOUT_MINUTES` enforced in the auth path |
| JWT revocation | `app/middleware/token_blacklist.py` blacklists logged-out tokens in Redis |
| `visibility` not enforced in queries | List, get, and fork paths all filter on `visibility in ("public","example")` for anonymous readers |

If you re-open the historical audit and find a claim that contradicts
this table, that claim is the stale one — open a PR against this file or
the relevant code.
