"""
Security Headers Middleware
Fixes: V-05 (Missing Security Headers)

IMPLEMENTATION GUIDE:
1. Copy to: /backend/app/middleware/security_headers.py
2. Add to main.py middleware stack
3. Customize CSP based on your frontend assets
"""

from typing import Dict
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses

    Headers implemented:
    - Content-Security-Policy (CSP)
    - Strict-Transport-Security (HSTS)
    - X-Frame-Options
    - X-Content-Type-Options
    - X-XSS-Protection
    - Referrer-Policy
    - Permissions-Policy
    """

    def __init__(self, app, csp_config: Dict[str, str] = None):
        super().__init__(app)
        self.csp_config = csp_config or self._default_csp()

    def _default_csp(self) -> Dict[str, str]:
        """
        Default Content Security Policy

        Customize based on your requirements:
        - Add CDN domains to script-src/style-src
        - Add image hosting domains to img-src
        - Add analytics domains if needed
        """
        # Development CSP (more permissive)
        if not settings.is_production:
            return {
                "default-src": "'self'",
                "script-src": "'self' 'unsafe-inline' 'unsafe-eval'",  # React DevTools
                "style-src": "'self' 'unsafe-inline'",  # Inline styles in development
                "img-src": "'self' data: blob: https:",
                "font-src": "'self' data:",
                "connect-src": "'self' ws: wss:",  # WebSocket for hot reload
                "frame-src": "'none'",
                "object-src": "'none'",
                "base-uri": "'self'",
                "form-action": "'self'",
                "frame-ancestors": "'none'",
                "upgrade-insecure-requests": "",
            }

        # Production CSP (strict)
        return {
            "default-src": "'self'",
            "script-src": "'self'",  # No inline scripts
            "style-src": "'self'",   # No inline styles
            "img-src": "'self' data: blob:",
            "font-src": "'self'",
            "connect-src": "'self'",  # API calls only to same origin
            "frame-src": "'none'",
            "object-src": "'none'",
            "base-uri": "'self'",
            "form-action": "'self'",
            "frame-ancestors": "'none'",  # Prevent clickjacking
            "upgrade-insecure-requests": "",  # Upgrade HTTP to HTTPS
            "block-all-mixed-content": "",     # Block mixed content
        }

    def _build_csp_header(self) -> str:
        """Build CSP header string from config"""
        return "; ".join(
            f"{key} {value}" if value else key
            for key, value in self.csp_config.items()
        )

    async def dispatch(self, request: Request, call_next):
        """Add security headers to response"""
        response = await call_next(request)

        # Content Security Policy
        response.headers["Content-Security-Policy"] = self._build_csp_header()

        # Strict Transport Security (HSTS)
        # Only add in production with HTTPS
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # X-Frame-Options: Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # X-Content-Type-Options: Prevent MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # X-XSS-Protection: Enable browser XSS filter
        # Note: Modern browsers use CSP instead, but this is for legacy support
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer-Policy: Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions-Policy: Control browser features
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=(), "
            "magnetometer=(), "
            "gyroscope=(), "
            "accelerometer=()"
        )

        # X-Permitted-Cross-Domain-Policies: Control Flash/PDF cross-domain
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        # Remove server header to avoid information disclosure
        if "server" in response.headers:
            del response.headers["server"]

        # Custom security header for API versioning
        response.headers["X-API-Version"] = settings.app_version

        return response


# Add to main.py
"""
from app.middleware.security_headers import SecurityHeadersMiddleware

# Custom CSP for your application
custom_csp = {
    "default-src": "'self'",
    "script-src": "'self' 'sha256-YOUR_SCRIPT_HASH'",
    "style-src": "'self' 'sha256-YOUR_STYLE_HASH'",
    "img-src": "'self' data: https://cdn.example.com",
    "connect-src": "'self' https://api.grayfsm.com",
    "frame-ancestors": "'none'",
}

# Add after CORS middleware, before other custom middleware
app.add_middleware(SecurityHeadersMiddleware, csp_config=custom_csp)
"""

# Test CSP compliance
"""
# Use these tools to test CSP:
# 1. https://csp-evaluator.withgoogle.com/
# 2. Browser DevTools Console (CSP violations logged)
# 3. Report-URI service for monitoring

# To enable CSP reporting (production):
csp_with_reporting = {
    **custom_csp,
    "report-uri": "https://your-csp-reporting-endpoint.com/report",
    "report-to": "csp-endpoint",
}
"""
