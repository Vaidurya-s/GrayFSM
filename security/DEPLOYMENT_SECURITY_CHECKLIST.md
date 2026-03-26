# Production Deployment Security Checklist

## Pre-Deployment Checklist

### Environment Configuration
- [ ] `ENVIRONMENT=production` set in production environment
- [ ] `DEBUG=False` in production (never True!)
- [ ] `SECRET_KEY` generated with cryptographically secure random (32+ bytes)
- [ ] Unique secrets for production (different from dev/staging)
- [ ] Database credentials rotated from default values
- [ ] Redis password set and secured
- [ ] All secrets stored in secret manager (AWS Secrets Manager/Vault/K8s Secrets)
- [ ] No secrets in environment variables or docker-compose.yml
- [ ] .env files excluded from version control
- [ ] Git history scanned for leaked secrets

### Authentication & Authorization
- [ ] JWT secret key is strong and unique (256+ bits)
- [ ] Token expiration times configured appropriately (30 min access, 7 days refresh)
- [ ] Password hashing uses bcrypt with appropriate cost factor (12+)
- [ ] Authentication required on all protected endpoints
- [ ] Authorization checks implemented (RBAC)
- [ ] User ownership validation on resource operations
- [ ] Session timeout implemented
- [ ] Refresh token rotation enabled
- [ ] Account lockout after failed login attempts
- [ ] Password complexity requirements enforced

### API Security
- [ ] Rate limiting enabled and configured
- [ ] Rate limits appropriate for production traffic
- [ ] CORS origins restricted to production domains only
- [ ] CORS credentials enabled only if needed
- [ ] CORS methods restricted (no wildcard *)
- [ ] CORS headers restricted (no wildcard *)
- [ ] API versioning in place
- [ ] API documentation disabled in production (no /docs endpoint)
- [ ] Error messages sanitized (no stack traces in responses)

### Security Headers
- [ ] Content-Security-Policy (CSP) implemented
- [ ] CSP does not use 'unsafe-inline' or 'unsafe-eval'
- [ ] Strict-Transport-Security (HSTS) enabled (HTTPS only)
- [ ] X-Frame-Options set to DENY or SAMEORIGIN
- [ ] X-Content-Type-Options set to nosniff
- [ ] Referrer-Policy configured appropriately
- [ ] Permissions-Policy configured to disable unused features
- [ ] Server header removed or obfuscated

### HTTPS/TLS
- [ ] HTTPS enabled on all endpoints
- [ ] TLS 1.2+ only (TLS 1.0/1.1 disabled)
- [ ] Valid SSL certificate from trusted CA
- [ ] Certificate expiration monitoring in place
- [ ] HSTS header set with long max-age (1 year minimum)
- [ ] HTTP redirects to HTTPS (301 permanent)
- [ ] Strong cipher suites configured
- [ ] Forward secrecy enabled

### Input Validation
- [ ] All user inputs validated on server-side
- [ ] Pydantic schemas validate all request data
- [ ] SQL injection protection via parameterized queries
- [ ] State names validated against injection (HDL generation)
- [ ] File uploads validated (type, size, content)
- [ ] JSON depth and size limits enforced
- [ ] HTML/XSS sanitization on user content
- [ ] Command injection protection in code generation

### Database Security
- [ ] Database accessible only from backend (no public access)
- [ ] Database uses strong authentication
- [ ] Database connections use SSL/TLS
- [ ] Database user has minimal required privileges
- [ ] Database backups encrypted
- [ ] Database connection pool configured appropriately
- [ ] SQL injection testing completed
- [ ] Database audit logging enabled
- [ ] Sensitive data encrypted at rest

### CSRF Protection
- [ ] CSRF middleware enabled
- [ ] CSRF tokens required for state-changing operations
- [ ] SameSite cookie attribute set to 'strict' or 'lax'
- [ ] CSRF token validation on POST/PUT/DELETE/PATCH

### Cookie Security
- [ ] Authentication tokens in httpOnly cookies (not localStorage)
- [ ] Secure flag set on all cookies in production
- [ ] SameSite attribute set on all cookies
- [ ] Cookie domain and path configured appropriately
- [ ] Session cookies have appropriate expiration

### File Upload Security
- [ ] File type validation (whitelist, not blacklist)
- [ ] File size limits enforced (5MB default)
- [ ] File content validation (not just extension check)
- [ ] Uploaded files scanned for viruses (if applicable)
- [ ] Uploaded files stored outside web root
- [ ] Uploaded filenames sanitized (no path traversal)
- [ ] File download uses Content-Disposition header

### Logging & Monitoring
- [ ] Security events logged (failed logins, authorization failures)
- [ ] Logs do not contain sensitive data (passwords, tokens, PII)
- [ ] Centralized log management configured (ELK/CloudWatch)
- [ ] Log retention policy defined
- [ ] Alerting configured for security events
- [ ] Intrusion detection monitoring
- [ ] Uptime monitoring configured
- [ ] Error tracking configured (Sentry/equivalent)

### Dependency Security
- [ ] All dependencies updated to latest secure versions
- [ ] Dependency vulnerability scan completed (pip-audit/npm audit)
- [ ] No known critical vulnerabilities in dependencies
- [ ] Automated dependency scanning in CI/CD
- [ ] SBOM (Software Bill of Materials) generated
- [ ] License compliance verified

### Infrastructure Security
- [ ] Firewall rules configured (allow only necessary ports)
- [ ] SSH access restricted to authorized IPs
- [ ] SSH key-based authentication only (no passwords)
- [ ] Security groups/network ACLs configured
- [ ] Intrusion detection system (IDS) configured
- [ ] DDoS protection enabled
- [ ] Regular security patches applied
- [ ] Minimal attack surface (unnecessary services disabled)

### Docker/Container Security
- [ ] Base images from trusted sources
- [ ] Images scanned for vulnerabilities
- [ ] Containers run as non-root user
- [ ] Read-only file systems where possible
- [ ] Resource limits configured (CPU, memory)
- [ ] Secrets not in Dockerfile or image layers
- [ ] Multi-stage builds to reduce image size
- [ ] Image tags pinned (not 'latest')

### Kubernetes Security (if applicable)
- [ ] Pod Security Standards enforced
- [ ] Network policies configured
- [ ] RBAC configured with least privilege
- [ ] Secrets stored in Kubernetes Secrets
- [ ] Service mesh security configured (mTLS)
- [ ] Admission controllers enabled
- [ ] Container security contexts configured
- [ ] Image pull policies configured

### Backup & Recovery
- [ ] Database backups automated and tested
- [ ] Backup encryption enabled
- [ ] Backup restoration tested regularly
- [ ] Disaster recovery plan documented
- [ ] RTO (Recovery Time Objective) defined
- [ ] RPO (Recovery Point Objective) defined

### Compliance & Documentation
- [ ] Security policies documented
- [ ] Incident response plan documented
- [ ] Data privacy policy defined (GDPR compliance if applicable)
- [ ] Data retention policy defined
- [ ] Security training for team completed
- [ ] Third-party security audit completed (if required)
- [ ] Penetration testing completed
- [ ] Security architecture documented

---

## Post-Deployment Verification

### Immediate Verification (Within 1 hour)
- [ ] Application starts successfully
- [ ] Health check endpoint responding
- [ ] Authentication working correctly
- [ ] Database connection established
- [ ] Redis connection established
- [ ] HTTPS certificate valid
- [ ] Security headers present in responses
- [ ] Rate limiting functioning
- [ ] CORS configuration tested
- [ ] Logs flowing to monitoring system

### 24-Hour Verification
- [ ] No critical errors in logs
- [ ] Performance metrics acceptable
- [ ] Rate limiting not blocking legitimate traffic
- [ ] Authentication sessions persisting correctly
- [ ] Database performance acceptable
- [ ] Memory usage stable
- [ ] No security alerts triggered

### Weekly Verification
- [ ] Security scan completed
- [ ] Dependency vulnerabilities checked
- [ ] Log analysis for suspicious activity
- [ ] Backup restoration test
- [ ] SSL certificate expiration check
- [ ] Access logs reviewed
- [ ] Error rate within acceptable limits

---

## Security Testing Commands

### Test Security Headers
```bash
# Test with curl
curl -I https://api.grayfsm.com

# Should include:
# - Content-Security-Policy
# - Strict-Transport-Security
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
```

### Test CORS
```bash
# Test CORS from unauthorized origin
curl -H "Origin: https://malicious.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://api.grayfsm.com/api/v1/fsms

# Should NOT include Access-Control-Allow-Origin header
```

### Test Rate Limiting
```bash
# Send multiple requests quickly
for i in {1..150}; do
  curl https://api.grayfsm.com/api/v1/health
done

# Should return 429 Too Many Requests after limit
```

### Test Authentication
```bash
# Test without token
curl https://api.grayfsm.com/api/v1/fsms

# Should return 401 Unauthorized
```

### Test HTTPS Redirect
```bash
# Test HTTP to HTTPS redirect
curl -I http://api.grayfsm.com

# Should return 301 or 308 redirect to https://
```

### SSL/TLS Testing
```bash
# Test SSL configuration
nmap --script ssl-enum-ciphers -p 443 api.grayfsm.com

# Or use online tools:
# https://www.ssllabs.com/ssltest/
# Target: A+ rating
```

### Dependency Scanning
```bash
# Python dependencies
cd /backend
pip-audit

# Node.js dependencies
cd /frontend
npm audit

# Should show no critical or high vulnerabilities
```

---

## Automated Security Testing

### GitHub Actions Workflow

Create `.github/workflows/security-scan.yml`:

```yaml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'

      - name: Install pip-audit
        run: pip install pip-audit

      - name: Scan Python dependencies
        run: |
          cd backend
          pip-audit -r requirements.txt

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Scan Node dependencies
        run: |
          cd frontend
          npm audit --audit-level=high

  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: TruffleHog Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD

  security-headers-test:
    runs-on: ubuntu-latest
    needs: [dependency-scan]
    steps:
      - uses: actions/checkout@v3

      - name: Start application
        run: docker-compose up -d

      - name: Wait for application
        run: sleep 30

      - name: Test security headers
        run: |
          response=$(curl -I http://localhost:8000)
          echo "$response" | grep -q "X-Frame-Options: DENY" || exit 1
          echo "$response" | grep -q "X-Content-Type-Options: nosniff" || exit 1
          echo "$response" | grep -q "Content-Security-Policy" || exit 1

      - name: Cleanup
        run: docker-compose down
```

---

## Incident Response Plan

### Security Incident Detected

1. **Immediate Actions (0-1 hour)**
   - [ ] Isolate affected systems
   - [ ] Preserve evidence (logs, snapshots)
   - [ ] Notify security team
   - [ ] Assess scope of incident

2. **Containment (1-4 hours)**
   - [ ] Block attack vector
   - [ ] Rotate compromised credentials
   - [ ] Apply emergency patches
   - [ ] Scale up monitoring

3. **Investigation (4-24 hours)**
   - [ ] Analyze logs for attack pattern
   - [ ] Identify affected data
   - [ ] Determine root cause
   - [ ] Document timeline

4. **Recovery (24-48 hours)**
   - [ ] Restore from clean backups
   - [ ] Apply permanent fixes
   - [ ] Verify system integrity
   - [ ] Resume normal operations

5. **Post-Incident (1 week)**
   - [ ] Conduct post-mortem
   - [ ] Update security controls
   - [ ] Train team on lessons learned
   - [ ] Notify affected users (if applicable)

---

## Security Contacts

- **Security Team Lead:** [Contact Info]
- **DevOps On-Call:** [Contact Info]
- **Incident Response:** [Contact Info]
- **External Security Firm:** [Contact Info]

---

## Compliance Verification

### GDPR Compliance (if applicable)
- [ ] Data processing documented
- [ ] Privacy policy published
- [ ] User consent mechanisms
- [ ] Data export functionality
- [ ] Data deletion functionality
- [ ] Breach notification process

### SOC 2 Compliance (if applicable)
- [ ] Access controls documented
- [ ] Change management process
- [ ] Incident response plan
- [ ] Security monitoring
- [ ] Encryption documented
- [ ] Vendor management

---

**Last Updated:** 2025-11-29
**Next Review:** Quarterly
