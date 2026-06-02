# GrayFSM Security Reference Drops

This directory holds the original 2025-11-29 security audit and the
reference middleware / config snippets it shipped. **It is not the
authoritative description of the live security posture.** For that, see:

- `docs/RUNBOOK.md` — operational reference, including a "Security
  posture" section listing what's deployed in `main`.
- `docs/SECURITY-GAPS.md` — the small set of audit recommendations that
  are still outstanding (reconciled against `main`).

Most of the fixes catalogued here have already been integrated into
`backend/app/middleware/` and `backend/app/api/v1/auth.py`. The files
here are kept as the reference implementations the audit shipped, and
because `docs/SECURITY-GAPS.md` cites specific steps from this file by
number.

## Directory Structure

```
security/
├── README.md                          # This file
├── EXECUTIVE_SUMMARY.md               # Archived audit summary (see docs/archive/)
├── DEPLOYMENT_SECURITY_CHECKLIST.md   # Pre-deployment checklist
├── QUICK_IMPLEMENTATION_GUIDE.md      # Original step-by-step apply order
├── reports/
│   └── SECURITY_AUDIT_REPORT.md       # Full OWASP Top 10 audit (2025-11-29)
├── fixes/
│   ├── 01_authentication_middleware.py  # JWT authentication (now in backend/app/middleware/auth.py)
│   ├── 02_input_validation.py           # Input sanitization (see Step 6 below)
│   ├── 03_rate_limiting.py              # Redis rate limiter (now in backend/app/middleware/rate_limit.py)
│   └── 04_csrf_protection.py            # CSRF protection (see Step 8 below)
├── configs/
│   ├── security_headers.py            # CSP, HSTS, etc. (now in backend/app/middleware/security_headers.py)
│   ├── cors_config.py                 # Secure CORS (enforced in backend/app/main.py)
│   ├── secure_cookies.py              # Cookie-based auth
│   └── secrets_management.md          # Secrets best practices
└── tests/
    ├── security_test_suite.py         # Automated security tests
    └── run_security_tests.sh          # Test runner script
```

## Reference Step Numbers

The numbered steps below are referenced by name from
`docs/SECURITY-GAPS.md`. They describe the *original* apply order the
audit recommended. Most are now done; the gaps doc says which aren't.

- **Step 1.** Install security dependencies (`python-jose`, `passlib`, `bleach`, etc.).
- **Step 2.** Implement authentication — done (`backend/app/middleware/auth.py`).
- **Step 3.** Add security headers — done (`backend/app/middleware/security_headers.py`).
- **Step 4.** Fix CORS configuration — done (wildcard-with-credentials rejected at startup in `backend/app/main.py`).
- **Step 5.** Implement rate limiting — done (`backend/app/middleware/rate_limit.py`, Redis-backed).
- **Step 6.** Add input validation via `SecureValidator`. **Status:** not adopted as a single utility; equivalent validation is in `backend/app/schemas/` via Pydantic v2 `field_validator`. Tracked as G2 in `docs/SECURITY-GAPS.md`.
- **Step 7.** Generate and secure secrets — done (config validator rejects placeholder `SECRET_KEY` outside `dev`).
- **Step 8.** Implement CSRF protection. **Status:** not implemented. Tracked as G1 in `docs/SECURITY-GAPS.md`. Reference implementation: `security/fixes/04_csrf_protection.py`.

## Running the Security Test Suite

```bash
./security/tests/run_security_tests.sh development
```

The shell script and `security_test_suite.py` are still useful as a
post-deploy smoke test; they predate the CI security gates added in
PR #71.

## Historical Vulnerability Counts

The 2025-11-29 audit reported 14 findings (3 Critical / 7 High / 4
Medium). The disposition of each is in the "Closed" table at the bottom
of `docs/SECURITY-GAPS.md` — only G1 (CSRF) and G2 (`SecureValidator`)
remain open, both Medium/Low.
