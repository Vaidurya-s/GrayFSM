# Quick Implementation Guide - Security Fixes

## Priority 1: Critical Fixes (Implement TODAY)

### 1. Generate Secure Secrets (5 minutes)

```bash
# Generate SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Create backend/.env (copy from .env.example)
cp backend/.env.example backend/.env

# Edit backend/.env and replace:
# SECRET_KEY=<paste generated key here>
# DATABASE_URL=postgresql+asyncpg://grayfsm:<new-password>@localhost:5432/grayfsm

# Verify .env is in .gitignore
grep -q "^\.env$" .gitignore || echo ".env" >> .gitignore
```

### 2. Add Security Headers (10 minutes)

```bash
# Copy middleware
cp security/configs/security_headers.py backend/app/middleware/security_headers.py
```

**Edit backend/app/main.py** - Add after line 89 (after CORS):
```python
from app.middleware.security_headers import SecurityHeadersMiddleware

app.add_middleware(SecurityHeadersMiddleware)
```

**Test:**
```bash
# Start server
cd backend && uvicorn app.main:app --reload

# In another terminal
curl -I http://localhost:8000 | grep -E "X-Frame-Options|Content-Security-Policy"
```

### 3. Fix CORS Configuration (15 minutes)

**Edit backend/app/config.py** - Replace lines 50-53:

```python
# BEFORE (INSECURE):
cors_allow_methods: List[str] = ["*"]
cors_allow_headers: List[str] = ["*"]

# AFTER (SECURE):
@property
def cors_allow_methods(self) -> List[str]:
    return ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]

@property
def cors_allow_headers(self) -> List[str]:
    return ["Content-Type", "Authorization", "X-CSRF-Token", "X-Request-ID"]

@property
def cors_origins(self) -> List[str]:
    if self.environment == "production":
        return ["https://grayfsm.com", "https://www.grayfsm.com"]
    else:
        return ["http://localhost:3000", "http://localhost:5173"]
```

**Edit backend/app/main.py** - Replace lines 80-86:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)
```

**Test:**
```bash
# Should REJECT unauthorized origin
curl -H "Origin: https://evil.com" -X OPTIONS http://localhost:8000/api/v1/fsms
# No Access-Control-Allow-Origin header = SUCCESS

# Should ACCEPT authorized origin
curl -H "Origin: http://localhost:3000" -X OPTIONS http://localhost:8000/api/v1/fsms
# Access-Control-Allow-Origin: http://localhost:3000 = SUCCESS
```

---

## Priority 2: High Priority Fixes (This Week)

### 4. Implement Authentication (2-3 hours)

**Install dependencies:**
```bash
cd backend
pip install python-jose[cryptography] passlib[bcrypt]
```

**Copy authentication middleware:**
```bash
cp security/fixes/01_authentication_middleware.py backend/app/middleware/auth.py
```

**Create auth router:** `backend/app/api/v1/auth.py`
```python
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.middleware.auth import (
    create_access_token,
    create_refresh_token,
    verify_password,
    get_password_hash
)

router = APIRouter()

@router.post("/register")
async def register(email: str, password: str, db: AsyncSession = Depends(get_db)):
    # TODO: Implement user creation
    pass

@router.post("/login")
async def login(email: str, password: str, response: Response):
    # TODO: Validate credentials
    # TODO: Create tokens
    # TODO: Set secure cookies
    pass
```

**Update protected endpoints:** `backend/app/api/v1/fsm.py`
```python
from app.middleware.auth import get_current_active_user, User

@router.post("", response_model=FSMResponse, status_code=201)
async def create_fsm(
    fsm_data: FSMCreate,
    current_user: User = Depends(get_current_active_user),  # ADD THIS
    db: AsyncSession = Depends(get_db)
):
    service = FSMService(db)
    fsm = await service.create_fsm(fsm_data, user_id=current_user.id)
    return fsm
```

### 5. Add Input Validation (1 hour)

**Install dependencies:**
```bash
pip install bleach
```

**Copy validators:**
```bash
cp security/fixes/02_input_validation.py backend/app/utils/validators.py
```

**Update schemas:** `backend/app/schemas/fsm.py`
```python
from app.utils.validators import SecureValidator

class FSMCreate(BaseModel):
    name: str
    states: List[str]

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return SecureValidator.validate_fsm_name(v)

    @field_validator('states')
    @classmethod
    def validate_states(cls, v: List[str]) -> List[str]:
        validated = []
        for state in v:
            validated.append(SecureValidator.validate_state_name(state))
        return validated
```

**Test:**
```bash
# Should reject XSS payload
curl -X POST http://localhost:8000/api/v1/fsms \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>","fsm_type":"moore","states":["s0"],"initial_state":"s0","transitions":[]}'

# Should reject SQL injection
curl -X POST http://localhost:8000/api/v1/fsms \
  -H "Content-Type: application/json" \
  -d '{"name":"test","fsm_type":"moore","states":["s0; DROP TABLE fsms;"],"initial_state":"s0","transitions":[]}'
```

### 6. Implement Rate Limiting (1 hour)

**Install dependencies:**
```bash
pip install redis aioredis
```

**Ensure Redis is running:**
```bash
# Install Redis
sudo apt-get install redis-server  # Ubuntu/Debian
brew install redis  # macOS

# Start Redis
redis-server
```

**Copy rate limiter:**
```bash
cp security/fixes/03_rate_limiting.py backend/app/middleware/rate_limit.py
```

**Update main.py lifespan:**
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

**Test:**
```bash
# Send 150 requests quickly
for i in {1..150}; do curl http://localhost:8000/api/v1/health; done

# Should see 429 Too Many Requests
```

---

## Testing Your Implementation

### Run Automated Tests

```bash
# Install test dependencies
pip install pytest httpx pytest-html

# Run security test suite
./security/tests/run_security_tests.sh development
```

### Manual Verification Checklist

```bash
# 1. Security Headers
curl -I http://localhost:8000 | grep "X-Frame-Options"
# Expected: X-Frame-Options: DENY

# 2. CORS
curl -H "Origin: https://evil.com" -X OPTIONS http://localhost:8000/api/v1/fsms
# Expected: No Access-Control-Allow-Origin header

# 3. Authentication
curl http://localhost:8000/api/v1/fsms
# Expected: 401 Unauthorized (when auth implemented)

# 4. Rate Limiting
for i in {1..150}; do curl -s http://localhost:8000/api/v1/health; done | grep -c "429"
# Expected: At least 1 occurrence of 429

# 5. Secrets
grep -r "your-secret-key-change-in-production" backend/
# Expected: No results (should only be in .env.example)
```

---

## Common Issues & Solutions

### Issue: CORS still allows all origins

**Problem:** Old settings cached
**Solution:**
```bash
# Restart server
# Clear browser cache
# Check settings.cors_origins returns correct values
```

### Issue: Rate limiting not working

**Problem:** Redis not running
**Solution:**
```bash
# Check Redis status
redis-cli ping
# Should return PONG

# If not running
redis-server

# Check connection in logs
tail -f backend/logs/app.log | grep "rate limiter"
```

### Issue: Authentication failing

**Problem:** JWT secret key not loaded
**Solution:**
```bash
# Check .env file exists
ls -la backend/.env

# Check SECRET_KEY is loaded
cd backend
python3 -c "from app.config import settings; print(settings.secret_key[:10])"
# Should NOT print "your-secre..."
```

---

## Production Deployment

Before deploying to production:

```bash
# 1. Set environment
export ENVIRONMENT=production

# 2. Update .env
DEBUG=False
ENVIRONMENT=production
CORS_ORIGINS=https://grayfsm.com,https://www.grayfsm.com

# 3. Run security tests
./security/tests/run_security_tests.sh production

# 4. Complete checklist
cat security/DEPLOYMENT_SECURITY_CHECKLIST.md
```

---

## Next Steps After Implementation

1. **Monitor logs** for security events
2. **Set up alerts** for failed auth attempts
3. **Schedule secret rotation** (every 90 days)
4. **Run penetration testing**
5. **Enable HTTPS** and test SSL configuration
6. **Implement audit logging**
7. **Set up SIEM** for security monitoring

---

## Getting Help

- **Full audit report:** `security/reports/SECURITY_AUDIT_REPORT.md`
- **Detailed fixes:** `security/fixes/` directory
- **Configuration examples:** `security/configs/` directory
- **Testing guide:** `security/tests/README.md`

---

**Estimated Total Implementation Time:** 6-8 hours
**Priority:** CRITICAL - Implement before production deployment
