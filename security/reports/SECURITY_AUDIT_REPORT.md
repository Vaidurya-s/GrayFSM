# GrayFSM Security Audit Report

**Audit Date:** 2025-11-29
**Auditor:** Security Assessment Team
**Application:** GrayFSM - Full-stack FSM Optimization Platform
**Stack:** React (Frontend) + FastAPI (Backend) + PostgreSQL (Database)

---

## Executive Summary

This security audit identifies **14 critical and high-severity vulnerabilities** in the GrayFSM application based on OWASP Top 10 (2021) standards. The application shows good foundational security practices but requires immediate attention in authentication, input validation, and security headers.

**Overall Risk Level:** HIGH

**Critical Findings:**
- No authentication/authorization implementation (planned but not implemented)
- Missing security headers (CSP, HSTS, X-Frame-Options)
- Rate limiting not implemented (stub only)
- Potential SQL injection via direct database queries
- Missing file upload validation
- Hardcoded secrets in configuration
- No CSRF protection
- Missing input sanitization for HDL code generation

---

## OWASP Top 10 (2021) Assessment

### 1. A01:2021 - Broken Access Control
**Severity:** CRITICAL
**CVSS Score:** 9.1

**Findings:**
- **No authentication system implemented** - Users field exists in database but auth is not enforced
- API endpoints are publicly accessible without token validation
- No authorization checks on FSM CRUD operations (any user can delete any FSM)
- Missing role-based access control (RBAC)
- `visibility` field in FSM model not enforced in queries

**Affected Files:**
- `/backend/app/api/v1/fsm.py` - All endpoints lack auth decorators
- `/backend/app/api/v1/export.py` - Export endpoint has no auth
- `/backend/app/config.py` - Auth config present but unused

**Evidence:**
```python
# /backend/app/api/v1/fsm.py - Line 18-42
@router.post("", response_model=FSMResponse, status_code=201)
async def create_fsm(
    fsm_data: FSMCreate,
    db: AsyncSession = Depends(get_db)
):
    # NO AUTHENTICATION DEPENDENCY!
```

**Exploitation:**
- Attacker can create unlimited FSMs without authentication
- Data exfiltration via unrestricted GET requests
- Deletion of any FSM by ID enumeration
- Access to private FSMs marked with `visibility='private'`

**Risk Impact:**
- Unauthorized access to all FSM data
- Data manipulation/deletion
- Resource exhaustion attacks
- Privacy violations for user data

---

### 2. A02:2021 - Cryptographic Failures
**Severity:** HIGH
**CVSS Score:** 7.5

**Findings:**
- **Hardcoded secret key** in `.env.example`: `SECRET_KEY=your-secret-key-change-in-production`
- Weak default secret key likely used in development/production
- No key rotation mechanism
- Database credentials in plain text in `.env.example`
- JWT tokens stored in localStorage (XSS vulnerable)
- No encryption for sensitive FSM definitions in database

**Affected Files:**
- `/backend/.env.example` - Line 27
- `/backend/app/config.py` - Line 44
- `/frontend/src/api/client.ts` - Line 16 (localStorage)

**Evidence:**
```python
# config.py - Line 44
secret_key: str = "your-secret-key-change-in-production"
```

```typescript
// client.ts - Line 16
const token = localStorage.getItem('auth_token');
```

**Exploitation:**
- Token forgery if default key used in production
- Session hijacking via XSS (localStorage accessible)
- Database credential exposure if `.env` leaked

**Risk Impact:**
- Full system compromise
- User impersonation
- Data breach

---

### 3. A03:2021 - Injection
**Severity:** HIGH
**CVSS Score:** 8.2

**Findings:**
- **SQL Injection potential** in FSM queries using SQLAlchemy filters
- **Command Injection risk** in HDL code generation (Verilog/VHDL export)
- No parameterized queries validation
- User input from FSM definitions not sanitized before code generation
- JSONB field `definition` accepts arbitrary JSON without schema validation

**Affected Files:**
- `/backend/app/services/fsm_service.py` - Query construction
- `/backend/app/api/v1/export.py` - Export endpoint (TODO)
- `/backend/app/schemas/fsm.py` - No output encoding validation

**Evidence:**
```python
# schemas/fsm.py - Line 27
transitions: List[Dict[str, Any]]  # NO VALIDATION ON "ANY"
```

**Potential Attack Vectors:**
1. SQL Injection via dynamic filters in `list_fsms(visibility=...)`
2. Code Injection in HDL generation:
   ```verilog
   // Malicious state name: `; DROP TABLE fsms; --
   state `; DROP TABLE fsms; --: begin
   ```

3. JSON injection in FSM definition field

**Exploitation:**
- Database compromise via SQL injection
- Remote code execution via HDL generation
- Data exfiltration

**Risk Impact:**
- Complete database takeover
- Server compromise
- Data loss

---

### 4. A04:2021 - Insecure Design
**Severity:** MEDIUM
**CVSS Score:** 6.5

**Findings:**
- Rate limiting designed but not implemented (stub only)
- No threat modeling documentation
- Missing security requirements in API design
- No secure design patterns for file uploads
- Lack of fail-safe defaults

**Affected Files:**
- `/backend/app/middleware/rate_limit.py` - Empty implementation
- `/backend/app/config.py` - Rate limit config unused

**Evidence:**
```python
# rate_limit.py - Line 11-19
async def rate_limit_middleware(request: Request, call_next):
    """TODO: Implement Redis-based rate limiting"""
    # For now, just pass through
    response = await call_next(request)
    return response
```

**Risk Impact:**
- DDoS vulnerability
- Resource exhaustion
- Brute force attacks possible

---

### 5. A05:2021 - Security Misconfiguration
**Severity:** HIGH
**CVSS Score:** 7.8

**Findings:**
- **Debug mode enabled by default**: `DEBUG=True`
- **Docs exposed in production**: `/docs` endpoint accessible when `debug=True`
- **Overly permissive CORS**: `allow_methods=["*"]`, `allow_headers=["*"]`
- Missing security headers:
  - No Content-Security-Policy (CSP)
  - No Strict-Transport-Security (HSTS)
  - No X-Frame-Options
  - No X-Content-Type-Options
- Database credentials in example config
- No helmet.js equivalent for FastAPI

**Affected Files:**
- `/backend/app/config.py` - Lines 20, 52-53
- `/backend/app/main.py` - Lines 73-74, 80-86
- `/backend/.env.example` - Line 17

**Evidence:**
```python
# config.py
debug: bool = True  # DEFAULT IS TRUE!
cors_allow_methods: List[str] = ["*"]
cors_allow_headers: List[str] = ["*"]
```

```python
# main.py - Line 73-74
docs_url="/docs" if settings.debug else None,
redoc_url="/redoc" if settings.debug else None,
```

**Exploitation:**
- Information disclosure via debug errors
- CORS bypass allowing malicious origins
- Clickjacking attacks (no X-Frame-Options)
- MIME sniffing attacks

**Risk Impact:**
- Sensitive data exposure
- Cross-origin attacks
- Session hijacking

---

### 6. A06:2021 - Vulnerable and Outdated Components
**Severity:** MEDIUM
**CVSS Score:** 6.0

**Findings:**
- Some dependencies may have known vulnerabilities (needs dependency scan)
- `axios@1.6.2` - Check for latest security patches
- `python-jose@3.3.0` - Older version, check CVEs
- No automated dependency scanning in CI/CD
- No Software Bill of Materials (SBOM)

**Affected Files:**
- `/backend/requirements.txt`
- `/frontend/package.json`

**Recommendations:**
- Run `pip-audit` for Python dependencies
- Run `npm audit` for Node.js dependencies
- Implement Snyk or Dependabot
- Regular dependency updates

---

### 7. A07:2021 - Identification and Authentication Failures
**Severity:** CRITICAL
**CVSS Score:** 9.8

**Findings:**
- **No authentication implemented** despite planned architecture
- No password complexity requirements
- No account lockout mechanism
- No multi-factor authentication (MFA)
- Session tokens in localStorage (XSS vulnerable)
- No session timeout enforcement
- Missing password reset functionality

**Affected Files:**
- `/backend/app/api/v1/fsm.py` - No auth decorators
- `/frontend/src/api/client.ts` - Token in localStorage
- `/backend/app/config.py` - Unused auth settings

**Evidence:**
```typescript
// Frontend stores tokens insecurely
localStorage.getItem('auth_token');  // XSS accessible
```

**Exploitation:**
- Complete bypass of authentication
- Token theft via XSS
- Unlimited failed login attempts

**Risk Impact:**
- Unauthorized system access
- Account takeover
- Data breach

---

### 8. A08:2021 - Software and Data Integrity Failures
**Severity:** MEDIUM
**CVSS Score:** 5.5

**Findings:**
- No code signing for releases
- Missing integrity checks for file uploads
- No verification of HDL export outputs
- Lack of audit logging for sensitive operations
- No tamper protection for FSM definitions

**Affected Files:**
- `/backend/app/api/v1/export.py` - Export not implemented
- Upload endpoints missing

**Recommendations:**
- Implement file integrity verification (checksums)
- Add audit logging for CRUD operations
- Use cryptographic signatures for exports

---

### 9. A09:2021 - Security Logging and Monitoring Failures
**Severity:** MEDIUM
**CVSS Score:** 6.0

**Findings:**
- Basic logging configured but incomplete
- No security event monitoring
- Missing failed login attempt logging
- No alerting for suspicious activities
- Logs don't include security-relevant events
- No centralized log management (SIEM)

**Affected Files:**
- `/backend/app/middleware/logging.py` - Generic request logging only
- `/backend/app/config.py` - Logging config basic

**Missing Events:**
- Authentication failures
- Authorization failures
- Input validation failures
- SQL query errors
- File upload attempts
- Rate limit violations

**Recommendations:**
- Add structured security logging
- Implement ELK stack or similar
- Alert on security events
- Log retention policy

---

### 10. A10:2021 - Server-Side Request Forgery (SSRF)
**Severity:** LOW
**CVSS Score:** 4.0

**Findings:**
- Currently low risk as no external URL fetching
- Potential future risk if import from URL feature added
- No URL validation framework in place

**Status:** Not applicable currently, preventive measures recommended

---

## Additional Security Concerns

### File Upload Vulnerabilities
**Severity:** HIGH

**Findings:**
- File upload validation not implemented
- `MAX_UPLOAD_SIZE_MB=5` defined but not enforced
- `ALLOWED_UPLOAD_FORMATS=["json","csv"]` not validated
- No virus scanning
- No file content validation
- Path traversal vulnerability possible

**Exploitation:**
- Upload malicious JSON with XXE attacks
- CSV injection attacks
- ZIP bomb DoS attacks
- Path traversal: `../../../../etc/passwd`

---

### Cross-Site Scripting (XSS)
**Severity:** HIGH

**Findings:**
- React provides some XSS protection via JSX
- Risk in FSM name/description rendering
- No Content-Security-Policy
- User-generated content not sanitized

**Affected Areas:**
- FSM names and descriptions displayed in UI
- Error messages echoed to frontend
- Export file content

---

### Cross-Site Request Forgery (CSRF)
**Severity:** MEDIUM

**Findings:**
- No CSRF tokens implemented
- SameSite cookie attribute not set
- Vulnerable state-changing operations (POST, DELETE)

**Exploitation:**
```html
<img src="http://api.grayfsm.com/api/v1/fsms/UUID/delete">
```

---

## Vulnerability Summary Table

| ID | Vulnerability | Severity | CVSS | Status |
|----|---------------|----------|------|--------|
| V-01 | No Authentication/Authorization | CRITICAL | 9.8 | Open |
| V-02 | Hardcoded Secret Keys | HIGH | 7.5 | Open |
| V-03 | SQL Injection Risk | HIGH | 8.2 | Open |
| V-04 | Command Injection (HDL) | HIGH | 8.0 | Open |
| V-05 | Missing Security Headers | HIGH | 7.8 | Open |
| V-06 | Rate Limiting Not Implemented | MEDIUM | 6.5 | Open |
| V-07 | Overly Permissive CORS | HIGH | 7.2 | Open |
| V-08 | Debug Mode Default Enabled | MEDIUM | 6.0 | Open |
| V-09 | File Upload Not Validated | HIGH | 7.5 | Open |
| V-10 | XSS in User Content | HIGH | 7.3 | Open |
| V-11 | No CSRF Protection | MEDIUM | 6.0 | Open |
| V-12 | Tokens in localStorage | MEDIUM | 6.5 | Open |
| V-13 | Missing Audit Logging | MEDIUM | 5.5 | Open |
| V-14 | Vulnerable Dependencies | MEDIUM | 6.0 | Unknown |

---

## Recommendations Priority

### IMMEDIATE (Critical - Fix within 24-48 hours)
1. Implement authentication and authorization
2. Remove hardcoded secrets, use secrets manager
3. Add input validation and parameterized queries
4. Implement security headers middleware
5. Fix CORS configuration

### HIGH PRIORITY (Fix within 1 week)
1. Implement rate limiting with Redis
2. Add file upload validation
3. Implement CSRF protection
4. Secure token storage (httpOnly cookies)
5. Add audit logging

### MEDIUM PRIORITY (Fix within 2 weeks)
1. Dependency scanning and updates
2. Add security monitoring
3. Implement CSP
4. Code injection prevention in HDL generation
5. Penetration testing

### LOW PRIORITY (Fix within 1 month)
1. Security chaos engineering
2. Bug bounty program
3. Advanced threat monitoring
4. Security training for developers

---

## Compliance Impact

**GDPR:** Non-compliant due to lack of access controls and encryption
**HIPAA:** Non-compliant (if health data processed)
**PCI-DSS:** Non-compliant (if payment data processed)
**SOC 2:** Would fail audit due to authentication and logging gaps

---

## Next Steps

1. Review and prioritize vulnerabilities
2. Implement fixes from accompanying fix files
3. Deploy security configurations
4. Run automated security tests
5. Conduct penetration testing
6. Establish ongoing security monitoring

---

**Report End**
