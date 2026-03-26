"""
CSRF Protection Implementation
Fixes: V-11 (No CSRF Protection)

IMPLEMENTATION GUIDE:
1. Install: pip install itsdangerous
2. Copy to: /backend/app/middleware/csrf.py
3. Update main.py to include middleware
4. Update frontend to include CSRF token
"""

import secrets
from typing import Optional

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class CSRFProtection:
    """
    CSRF token generation and validation

    Uses double-submit cookie pattern:
    1. Server sends CSRF token in cookie
    2. Client includes token in request header
    3. Server validates both match
    """

    def __init__(self, secret_key: str):
        self.serializer = URLSafeTimedSerializer(secret_key)
        self.token_name = "csrf_token"
        self.header_name = "X-CSRF-Token"
        self.cookie_name = "csrf_token"

    def generate_token(self) -> str:
        """Generate a new CSRF token"""
        random_data = secrets.token_urlsafe(32)
        token = self.serializer.dumps(random_data)
        return token

    def validate_token(
        self,
        token: str,
        max_age: int = 3600
    ) -> bool:
        """
        Validate CSRF token

        Args:
            token: Token to validate
            max_age: Maximum token age in seconds (default 1 hour)

        Returns:
            True if valid, False otherwise
        """
        try:
            self.serializer.loads(token, max_age=max_age)
            return True
        except (BadSignature, SignatureExpired):
            return False


csrf_protect = CSRFProtection(settings.secret_key)


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection middleware for FastAPI

    Protects state-changing operations (POST, PUT, DELETE, PATCH)
    """

    # Methods that require CSRF protection
    PROTECTED_METHODS = {"POST", "PUT", "DELETE", "PATCH"}

    # Paths exempt from CSRF (e.g., authentication endpoints)
    EXEMPT_PATHS = {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/health",
        "/docs",
        "/redoc",
        "/openapi.json"
    }

    async def dispatch(self, request: Request, call_next):
        """Process request through CSRF protection"""

        # Skip CSRF for safe methods (GET, HEAD, OPTIONS)
        if request.method not in self.PROTECTED_METHODS:
            response = await call_next(request)
            # Set CSRF token cookie for future requests
            self._set_csrf_cookie(response)
            return response

        # Skip CSRF for exempt paths
        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        # Validate CSRF token
        await self._validate_csrf(request)

        # Process request
        response = await call_next(request)

        # Refresh CSRF token
        self._set_csrf_cookie(response)

        return response

    async def _validate_csrf(self, request: Request) -> None:
        """
        Validate CSRF token from request

        Checks:
        1. Token exists in cookie
        2. Token exists in header
        3. Both tokens match
        4. Token is valid and not expired
        """
        # Get token from cookie
        cookie_token = request.cookies.get(csrf_protect.cookie_name)

        # Get token from header
        header_token = request.headers.get(csrf_protect.header_name)

        # Both must be present
        if not cookie_token or not header_token:
            logger.warning(
                "CSRF validation failed: missing token",
                extra={
                    "path": request.url.path,
                    "method": request.method,
                    "ip": request.client.host if request.client else "unknown"
                }
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token missing"
            )

        # Tokens must match (double-submit cookie pattern)
        if cookie_token != header_token:
            logger.warning(
                "CSRF validation failed: token mismatch",
                extra={
                    "path": request.url.path,
                    "method": request.method
                }
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token mismatch"
            )

        # Validate token signature and expiration
        if not csrf_protect.validate_token(cookie_token):
            logger.warning(
                "CSRF validation failed: invalid or expired token",
                extra={
                    "path": request.url.path,
                    "method": request.method
                }
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token invalid or expired"
            )

    def _set_csrf_cookie(self, response: Response) -> None:
        """Set CSRF token cookie in response"""
        token = csrf_protect.generate_token()

        response.set_cookie(
            key=csrf_protect.cookie_name,
            value=token,
            httponly=True,  # Prevent JavaScript access
            secure=settings.is_production,  # HTTPS only in production
            samesite="strict",  # CSRF protection
            max_age=3600,  # 1 hour
            path="/"
        )


# Dependency for routes that need CSRF token
async def get_csrf_token(request: Request) -> str:
    """
    Get CSRF token from request

    Usage:
        @router.post("/protected")
        async def protected_route(csrf_token: str = Depends(get_csrf_token)):
            # CSRF validated automatically
            ...
    """
    return request.cookies.get(csrf_protect.cookie_name, "")


# Add to main.py
"""
from app.middleware.csrf import CSRFMiddleware

# Add after CORS middleware
app.add_middleware(CSRFMiddleware)
"""

# Frontend integration (React/TypeScript)
"""
// frontend/src/utils/csrf.ts

// Get CSRF token from cookie
export function getCsrfToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf_token') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

// Add to axios client (frontend/src/api/client.ts)
import { getCsrfToken } from '@/utils/csrf';

apiClient.interceptors.request.use(
  (config) => {
    // Add CSRF token to headers for state-changing requests
    if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '')) {
      const csrfToken = getCsrfToken();
      if (csrfToken && config.headers) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);
"""
