"""
Security headers middleware for GrayFSM.

Adds standard security headers to all HTTP responses:
- X-Content-Type-Options: Prevent MIME sniffing
- X-Frame-Options: Prevent clickjacking
- Strict-Transport-Security: Enforce HTTPS
- Content-Security-Policy: Control resource loading
- Referrer-Policy: Control referrer information
- X-XSS-Protection: Legacy XSS filter
- Permissions-Policy: Restrict browser features

Adapted from security/configs/security_headers.py
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses.

    Headers are configurable via the ``csp_config`` constructor argument,
    but ship with secure defaults that differ between development and
    production (keyed off ``settings.is_production``).
    """

    def __init__(self, app, csp_config: dict[str, str] | None = None):
        super().__init__(app)
        self.csp_config = csp_config or self._default_csp()
        logger.info(
            "SecurityHeadersMiddleware initialised",
            extra={"production": settings.is_production},
        )

    # ------------------------------------------------------------------
    # CSP helpers
    # ------------------------------------------------------------------

    def _default_csp(self) -> dict[str, str]:
        """Return a default Content-Security-Policy directive map."""

        if not settings.is_production:
            # Development: more permissive so React DevTools / HMR work
            return {
                "default-src": "'self'",
                "script-src": "'self' 'unsafe-inline' 'unsafe-eval'",
                "style-src": "'self' 'unsafe-inline'",
                "img-src": "'self' data: blob: https:",
                "font-src": "'self' data:",
                "connect-src": "'self' ws: wss: http://localhost:* http://127.0.0.1:*",
                "frame-src": "'none'",
                "object-src": "'none'",
                "base-uri": "'self'",
                "form-action": "'self'",
                "frame-ancestors": "'none'",
            }

        # Production policy. Kept aligned with infrastructure/docker/default.conf
        # so deployments behind nginx (which serves the SPA) and direct
        # FastAPI deployments (which serve their own HTML) get the same
        # browser-side enforcement. style-src must allow 'unsafe-inline'
        # because the bundled SPA (three.js, recharts, react-flow) injects
        # runtime <style> blocks for dynamic theming — verified by inspecting
        # the production build output. script-src stays strict ('self' only)
        # since the bundle is loaded via external <script src="..."> tags.
        return {
            "default-src": "'self'",
            "script-src": "'self'",
            "style-src": "'self' 'unsafe-inline'",
            "img-src": "'self' data: blob: https:",
            "font-src": "'self' data:",
            "connect-src": "'self'",
            "frame-src": "'none'",
            "object-src": "'none'",
            "base-uri": "'self'",
            "form-action": "'self'",
            "frame-ancestors": "'none'",
            "upgrade-insecure-requests": "",
        }

    def _build_csp_header(self) -> str:
        """Serialise the CSP directive map into a header value string."""
        return "; ".join(
            f"{key} {value}" if value else key for key, value in self.csp_config.items()
        )

    # ------------------------------------------------------------------
    # Middleware dispatch
    # ------------------------------------------------------------------

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Content-Security-Policy
        response.headers["Content-Security-Policy"] = self._build_csp_header()

        # Strict-Transport-Security (only meaningful over HTTPS / in prod)
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Legacy XSS filter (modern browsers rely on CSP instead)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions policy -- disable features we never use
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
        )

        # Remove server header to reduce information leakage
        if "server" in response.headers:
            del response.headers["server"]

        return response
