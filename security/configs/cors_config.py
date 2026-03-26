"""
Secure CORS Configuration
Fixes: V-07 (Overly Permissive CORS)

IMPLEMENTATION GUIDE:
1. Update /backend/app/config.py with these settings
2. Replace CORS middleware in main.py
"""

from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings


class SecureCORSSettings(BaseSettings):
    """
    Secure CORS configuration

    IMPORTANT: Never use wildcard (*) in production!
    """

    # Environment-specific origins
    cors_origins: List[str]

    # Credentials support (required for cookies/auth)
    cors_allow_credentials: bool = True

    # Allowed HTTP methods (be specific, avoid wildcard)
    cors_allow_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "PATCH"]

    # Allowed headers (be specific, avoid wildcard)
    cors_allow_headers: List[str] = [
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
        "X-Request-ID",
    ]

    # Exposed headers (visible to frontend)
    cors_expose_headers: List[str] = [
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "X-Total-Count",
        "X-API-Version",
    ]

    # Preflight cache duration (seconds)
    cors_max_age: int = 3600  # 1 hour

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, v: List[str]) -> List[str]:
        """
        Validate CORS origins

        Security checks:
        - No wildcard in production
        - Must be HTTPS in production
        - No localhost in production
        """
        import os

        is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"

        for origin in v:
            # Check for wildcard
            if "*" in origin:
                if is_production:
                    raise ValueError("Wildcard CORS origins not allowed in production")

            # Check for HTTP in production
            if is_production and origin.startswith("http://"):
                raise ValueError("HTTP origins not allowed in production (use HTTPS)")

            # Check for localhost in production
            if is_production and ("localhost" in origin or "127.0.0.1" in origin):
                raise ValueError("Localhost origins not allowed in production")

        return v

    @field_validator("cors_allow_methods")
    @classmethod
    def validate_methods(cls, v: List[str]) -> List[str]:
        """Ensure no wildcard in methods"""
        if "*" in v:
            raise ValueError("Wildcard not allowed in CORS methods")

        allowed = {"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"}
        for method in v:
            if method.upper() not in allowed:
                raise ValueError(f"Invalid HTTP method: {method}")

        return [m.upper() for m in v]

    @field_validator("cors_allow_headers")
    @classmethod
    def validate_headers(cls, v: List[str]) -> List[str]:
        """Ensure no wildcard in headers"""
        if "*" in v:
            raise ValueError("Wildcard not allowed in CORS headers")
        return v


# Environment-specific CORS configurations

# Development
CORS_DEVELOPMENT = {
    "cors_origins": [
        "http://localhost:3000",     # React dev server
        "http://localhost:5173",     # Vite dev server
        "http://localhost:8080",     # Alternative port
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    "cors_allow_credentials": True,
    "cors_allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    "cors_allow_headers": [
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
        "X-Request-ID",
    ],
}

# Staging
CORS_STAGING = {
    "cors_origins": [
        "https://staging.grayfsm.com",
        "https://staging-app.grayfsm.com",
    ],
    "cors_allow_credentials": True,
    "cors_allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH"],
    "cors_allow_headers": [
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
        "X-Request-ID",
    ],
}

# Production
CORS_PRODUCTION = {
    "cors_origins": [
        "https://grayfsm.com",
        "https://www.grayfsm.com",
        "https://app.grayfsm.com",
    ],
    "cors_allow_credentials": True,
    "cors_allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH"],
    "cors_allow_headers": [
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
    ],
}


# Updated config.py
"""
# /backend/app/config.py

from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # ... other settings ...

    # CORS - Environment-specific
    @property
    def cors_origins(self) -> List[str]:
        '''Get CORS origins based on environment'''
        if self.environment == "production":
            return [
                "https://grayfsm.com",
                "https://www.grayfsm.com",
                "https://app.grayfsm.com",
            ]
        elif self.environment == "staging":
            return [
                "https://staging.grayfsm.com",
                "https://staging-app.grayfsm.com",
            ]
        else:  # development
            return [
                "http://localhost:3000",
                "http://localhost:5173",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173",
            ]

    cors_allow_credentials: bool = True

    @property
    def cors_allow_methods(self) -> List[str]:
        '''Allowed HTTP methods - NO WILDCARD'''
        return ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]

    @property
    def cors_allow_headers(self) -> List[str]:
        '''Allowed headers - NO WILDCARD'''
        base_headers = [
            "Content-Type",
            "Authorization",
            "X-CSRF-Token",
            "X-Request-ID",
        ]

        # Add development-only headers
        if not self.is_production:
            base_headers.extend([
                "X-Debug-Token",
                "X-Test-Mode",
            ])

        return base_headers

    @property
    def cors_expose_headers(self) -> List[str]:
        '''Headers exposed to frontend'''
        return [
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "X-Total-Count",
            "X-API-Version",
        ]

    cors_max_age: int = 3600  # 1 hour
"""

# Updated main.py CORS middleware
"""
from fastapi.middleware.cors import CORSMiddleware

# SECURE CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # Specific origins only
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,  # No wildcard
    allow_headers=settings.cors_allow_headers,  # No wildcard
    expose_headers=settings.cors_expose_headers,
    max_age=settings.cors_max_age,
)
"""

# Dynamic CORS for multi-tenant applications
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class DynamicCORSMiddleware(BaseHTTPMiddleware):
    '''
    Dynamic CORS validation against database

    Use when origins are stored in database (multi-tenant)
    '''

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("Origin")

        # Validate origin against database
        if origin:
            # TODO: Query database for allowed origins
            # is_allowed = await db.query(AllowedOrigin).filter_by(origin=origin).first()
            is_allowed = origin in settings.cors_origins

            if is_allowed:
                response = await call_next(request)
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Credentials"] = "true"
                return response

        # Origin not allowed or not present
        if request.method == "OPTIONS":
            # Reject preflight
            return JSONResponse(
                status_code=403,
                content={"error": "Origin not allowed"}
            )

        response = await call_next(request)
        return response
"""
