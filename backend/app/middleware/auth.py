"""
Optional JWT authentication middleware for GrayFSM.

Provides two FastAPI dependencies:
    ``get_optional_current_user``
        Returns a ``UserToken`` dict (or ``None``) based on the
        ``Authorization: Bearer <token>`` header.  **Never raises 401.**
        Use this on all existing endpoints so they continue to work
        without authentication.

    ``get_required_current_user``
        Returns a ``UserToken`` dict or raises HTTP 401.
        Use this only on endpoints that explicitly require login.

Token format is a standard JWT signed with ``settings.secret_key`` /
``settings.algorithm``.

Adapted from security/fixes/01_authentication_middleware.py
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

# A lightweight dict representing the decoded token payload.
# Keeping this as a plain dict avoids pulling in heavy ORM/DB deps.
UserToken = Dict[str, Any]


# ---------------------------------------------------------------------------
# Token blacklist
# ---------------------------------------------------------------------------
#
# Moved to its own module — see ``app.middleware.token_blacklist``. Re-export
# the legacy helpers here so existing call-sites in ``api/v1/auth.py``
# continue to work without changes.

from app.middleware.token_blacklist import (  # noqa: E402, F401 — re-export
    blacklist_token,
    is_token_blacklisted,
)


# ---------------------------------------------------------------------------
# Bearer scheme (auto_error=False so missing header => None, not 403)
# ---------------------------------------------------------------------------

_bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def _decode_token(token: str) -> Optional[UserToken]:
    """
    Decode and validate a JWT token.

    Returns the payload dict on success, ``None`` on any failure.
    Checks audience claim and token blacklist.
    """
    # Check if token is blacklisted (e.g., after logout)
    if is_token_blacklisted(token):
        logger.debug("Token has been blacklisted")
        return None

    try:
        from jose import JWTError, jwt  # noqa: WPS433  (lazy import)
    except ImportError:
        logger.warning(
            "python-jose not installed; JWT authentication is unavailable. "
            "Install with: pip install python-jose[cryptography]"
        )
        return None

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
            audience=settings.jwt_audience,
        )
    except JWTError as exc:
        logger.debug("JWT decode failed", extra={"error": str(exc)})
        return None

    # Validate expected claims
    token_type = payload.get("type")
    if token_type is not None and token_type != "access":
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    return {
        "user_id": user_id,
        "email": payload.get("email"),
        "roles": payload.get("roles", []),
    }


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token.

    ``data`` must contain at least ``{"sub": "<user_id>"}``.
    Includes audience claim for additional security validation.
    """
    try:
        from jose import jwt  # noqa: WPS433
    except ImportError as exc:
        raise RuntimeError(
            "python-jose is required to create tokens. "
            "Install with: pip install python-jose[cryptography]"
        ) from exc

    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta
        or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access",
        "aud": settings.jwt_audience,
    })

    return jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.algorithm,
    )


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

async def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Optional[UserToken]:
    """
    FastAPI dependency: returns the current user or ``None``.

    **Never raises 401.**  Endpoints using this dependency will work
    identically whether or not the client sends a token.
    Checks Authorization header first, then falls back to httpOnly cookie.
    """
    token: Optional[str] = None

    if credentials is not None:
        token = credentials.credentials
    else:
        token = request.cookies.get("access_token")

    if token is None:
        return None

    user = _decode_token(token)
    if user is None:
        # Token was present but invalid — still return None rather
        # than blocking the request.  Log for observability.
        logger.debug("Invalid bearer token supplied, treating as anonymous")
        return None

    return user


async def get_required_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> UserToken:
    """
    FastAPI dependency: returns the current user **or raises 401**.

    Use this only on endpoints that explicitly need authentication.
    Checks Authorization header first, then falls back to httpOnly cookie.
    """
    token: Optional[str] = None

    if credentials is not None:
        token = credentials.credentials
    else:
        token = request.cookies.get("access_token")

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = _decode_token(token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
