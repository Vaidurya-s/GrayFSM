# GrayFSM Security Audit & Remediation

**Audit Date:** 2025-11-29
**Status:** 14 Critical/High vulnerabilities identified
**Priority:** IMMEDIATE ACTION REQUIRED

---

## Quick Start

### 1. Review Security Audit Report
```bash
cat security/reports/SECURITY_AUDIT_REPORT.md
```

**Key Findings:**
- No authentication/authorization (CRITICAL)
- Hardcoded secrets (HIGH)
- SQL/Command injection risks (HIGH)
- Missing security headers (HIGH)
- Rate limiting not implemented (MEDIUM)

### 2. Priority Fix Order

**IMMEDIATE (24-48 hours):**
1. Implement authentication - `security/fixes/01_authentication_middleware.py`
2. Remove hardcoded secrets - `security/configs/secrets_management.md`
3. Add security headers - `security/configs/security_headers.py`
4. Fix CORS configuration - `security/configs/cors_config.py`
5. Add input validation - `security/fixes/02_input_validation.py`

**HIGH PRIORITY (1 week):**
1. Implement rate limiting - `security/fixes/03_rate_limiting.py`
2. Add CSRF protection - `security/fixes/04_csrf_protection.py`
3. Secure cookie storage - `security/configs/secure_cookies.py`

---

## Directory Structure

```
security/
├── README.md                           # This file
├── DEPLOYMENT_SECURITY_CHECKLIST.md   # Pre-deployment checklist
├── reports/
│   └── SECURITY_AUDIT_REPORT.md       # Full OWASP Top 10 audit
├── fixes/
│   ├── 01_authentication_middleware.py # JWT authentication
│   ├── 02_input_validation.py         # Input sanitization
│   ├── 03_rate_limiting.py            # Redis rate limiter
│   └── 04_csrf_protection.py          # CSRF protection
├── configs/
│   ├── security_headers.py            # CSP, HSTS, etc.
│   ├── cors_config.py                 # Secure CORS
│   ├── secure_cookies.py              # Cookie-based auth
│   └── secrets_management.md          # Secrets best practices
└── tests/
    ├── security_test_suite.py         # Automated security tests
    └── run_security_tests.sh          # Test runner script
```

---

## Implementation Guide

### Step 1: Install Security Dependencies

```bash
# Backend security packages
cd backend
pip install \
  python-jose[cryptography] \
  passlib[bcrypt] \
  bleach \
  itsdangerous \
  redis \
  aioredis

# Update requirements.txt
pip freeze > requirements.txt
```

### Step 2: Implement Authentication

```bash
# 1. Copy authentication middleware
cp security/fixes/01_authentication_middleware.py backend/app/middleware/auth.py

# 2. Create auth router
# Create backend/app/api/v1/auth.py (see comments in auth.py)

# 3. Update protected routes
# Add: user: User = Depends(get_current_active_user)
# to all endpoints in backend/app/api/v1/fsm.py
```

**Example route update:**
```python
# Before
@router.post("", response_model=FSMResponse)
async def create_fsm(
    fsm_data: FSMCreate,
    db: AsyncSession = Depends(get_db)
):
    ...

# After
from app.middleware.auth import get_current_active_user, User

@router.post("", response_model=FSMResponse)
async def create_fsm(
    fsm_data: FSMCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    service = FSMService(db)
    fsm = await service.create_fsm(fsm_data, user_id=current_user.id)
    return fsm
```

### Step 3: Add Security Headers

```bash
# Copy security headers middleware
cp security/configs/security_headers.py backend/app/middleware/security_headers.py
```

**Update backend/app/main.py:**
```python
from app.middleware.security_headers import SecurityHeadersMiddleware

# Add after CORS middleware
app.add_middleware(SecurityHeadersMiddleware)
```

### Step 4: Fix CORS Configuration

**Update backend/app/config.py:**
```python
@property
def cors_origins(self) -> List[str]:
    if self.environment == "production":
        return [
            "https://grayfsm.com",
            "https://www.grayfsm.com",
        ]
    else:
        return [
            "http://localhost:3000",
            "http://localhost:5173",
        ]

@property
def cors_allow_methods(self) -> List[str]:
    return ["GET", "POST", "PUT", "DELETE", "PATCH"]  # NO WILDCARD

@property
def cors_allow_headers(self) -> List[str]:
    return ["Content-Type", "Authorization", "X-CSRF-Token"]  # NO WILDCARD
```

### Step 5: Implement Rate Limiting

```bash
# Copy rate limiting middleware
cp security/fixes/03_rate_limiting.py backend/app/middleware/rate_limit.py
```

**Update backend/app/main.py:**
```python
from app.middleware.rate_limit import rate_limiter

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await create_db_and_tables()
    if settings.rate_limit_enabled:
        await rate_limiter.connect()

    yield

    # Shutdown
    await engine.dispose()
    if settings.rate_limit_enabled:
        await rate_limiter.close()
```

### Step 6: Add Input Validation

```bash
# Copy validators
cp security/fixes/02_input_validation.py backend/app/utils/validators.py
```

**Update backend/app/schemas/fsm.py:**
```python
from app.utils.validators import SecureValidator

class FSMCreate(BaseModel):
    name: str

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return SecureValidator.validate_fsm_name(v)

    @field_validator('states')
    @classmethod
    def validate_states(cls, v: List[str]) -> List[str]:
        return [SecureValidator.validate_state_name(s) for s in v]
```

### Step 7: Generate and Secure Secrets

```bash
# Generate new secret key
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"

# Generate database password
python3 -c "import secrets; print('DB_PASSWORD=' + secrets.token_urlsafe(24))"

# Update backend/.env (NEVER COMMIT THIS FILE!)
# Add to backend/.gitignore if not already there
```

**.env file:**
```bash
ENVIRONMENT=production
DEBUG=False
SECRET_KEY=<generated-key-from-above>
DATABASE_URL=postgresql+asyncpg://grayfsm:<db-password>@localhost:5432/grayfsm
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=https://grayfsm.com
RATE_LIMIT_ENABLED=True
```

### Step 8: Implement CSRF Protection

```bash
cp security/fixes/04_csrf_protection.py backend/app/middleware/csrf.py
```

**Update backend/app/main.py:**
```python
from app.middleware.csrf import CSRFMiddleware

# Add after CORS
app.add_middleware(CSRFMiddleware)
```

**Update frontend/src/api/client.ts:**
```typescript
import { getCsrfToken } from '@/utils/csrf';

apiClient.interceptors.request.use((config) => {
  // Add CSRF token for state-changing requests
  if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '')) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});
```

---

## Testing Security Fixes

### Automated Testing

```bash
# Run full security test suite
./security/tests/run_security_tests.sh development

# Run specific test categories
pytest security/tests/security_test_suite.py::TestSecurityHeaders -v
pytest security/tests/security_test_suite.py::TestAuthentication -v
pytest security/tests/security_test_suite.py::TestCORS -v
```

### Manual Testing

**Test Security Headers:**
```bash
curl -I https://api.grayfsm.com | grep -E "Content-Security-Policy|X-Frame-Options"
```

**Test CORS:**
```bash
curl -H "Origin: https://evil.com" -X OPTIONS https://api.grayfsm.com/api/v1/fsms
# Should NOT return Access-Control-Allow-Origin
```

**Test Rate Limiting:**
```bash
for i in {1..150}; do curl https://api.grayfsm.com/api/v1/health; done
# Should return 429 Too Many Requests
```

**Test Authentication:**
```bash
curl https://api.grayfsm.com/api/v1/fsms
# Should return 401 Unauthorized
```

---

## Deployment Checklist

Before deploying to production, review:

1. [ ] **Complete** `DEPLOYMENT_SECURITY_CHECKLIST.md`
2. [ ] **Run** automated security tests
3. [ ] **Verify** all secrets rotated from defaults
4. [ ] **Confirm** DEBUG=False in production
5. [ ] **Test** HTTPS redirect working
6. [ ] **Check** security headers present
7. [ ] **Validate** CORS allows only production domains
8. [ ] **Test** authentication on all protected endpoints

```bash
# Quick verification
cd security
./tests/run_security_tests.sh production
```

---

## Vulnerability Summary

| Priority | Count | Status |
|----------|-------|--------|
| Critical | 3 | 🔴 Open |
| High | 7 | 🔴 Open |
| Medium | 4 | 🟡 Open |
| Total | 14 | Action Required |

### Critical Vulnerabilities
1. **V-01:** No authentication/authorization
2. **V-07:** No identification/authentication failures
3. **V-03:** SQL injection risk

### High Vulnerabilities
1. **V-02:** Hardcoded secret keys
2. **V-04:** Command injection (HDL generation)
3. **V-05:** Missing security headers
4. **V-07:** Overly permissive CORS
5. **V-09:** File upload not validated
6. **V-10:** XSS in user content

See full report: `security/reports/SECURITY_AUDIT_REPORT.md`

---

## Continuous Security

### Automated Scanning

Add to `.github/workflows/security.yml`:
```yaml
name: Security Scan
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run security tests
        run: ./security/tests/run_security_tests.sh development
```

### Dependency Scanning

```bash
# Weekly dependency scan
pip-audit -r backend/requirements.txt
npm audit --prefix frontend
```

### Secret Rotation

- **SECRET_KEY:** Every 90 days
- **Database passwords:** Every 30 days
- **API keys:** Every 60 days

---

## Support & Resources

### Documentation
- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

### Tools
- [OWASP ZAP](https://www.zaproxy.org/) - Security scanner
- [Burp Suite](https://portswigger.net/burp) - Penetration testing
- [SSL Labs](https://www.ssllabs.com/ssltest/) - SSL/TLS testing

### Questions?
Review the detailed implementations in `security/fixes/` directory.

---

**Last Updated:** 2025-11-29
**Next Review:** Weekly until all critical issues resolved
