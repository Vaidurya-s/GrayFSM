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
# Token blacklist — Redis-backed, with in-memory fallback
# ---------------------------------------------------------------------------
#
# Blacklist entries live in Redis under the key `jwt:bl:<sha256-prefix>` with
# TTL equal to the token's remaining lifetime, so expired revocations clean
# themselves up. If Redis is unavailable we degrade to an in-process set so
# single-worker dev setups and tests still work.

import hashlib

_token_blacklist: set = set()
_sync_redis_client = None
_redis_probe_done = False


def _get_sync_redis():
    """Return a lazily-connected sync Redis client, or None if unavailable."""
    global _sync_redis_client, _redis_probe_done
    if _redis_probe_done:
        return _sync_redis_client
    _redis_probe_done = True
    try:
        import redis  # noqa: WPS433  (lazy)
        client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
        client.ping()
        _sync_redis_client = client
        logger.info("JWT blacklist: connected to Redis")
    except Exception as exc:
        logger.warning(
            "JWT blacklist: Redis unavailable, falling back to in-memory set",
            extra={"error": str(exc)},
        )
        _sync_redis_client = None
    return _sync_redis_client


def _blacklist_key(token: str) -> str:
    """Hash the token so keys stay short and don't leak the raw token."""
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return f"jwt:bl:{digest[:32]}"


def _remaining_ttl_seconds(token: str) -> int:
    """Read the `exp` claim without verification and return seconds-until-exp.

    Falls back to the configured access-token lifetime if the claim is missing
    or unparseable. Never negative.
    """
    try:
        from jose import jwt  # noqa: WPS433
        payload = jwt.get_unverified_claims(token)
        exp = int(payload.get("exp", 0))
        if exp:
            remaining = exp - int(datetime.utcnow().timestamp())
            if remaining > 0:
                return remaining
    except Exception:
        pass
    return settings.access_token_expire_minutes * 60


def blacklist_token(token: str) -> None:
    """Add a token to the blacklist (e.g., on logout)."""
    client = _get_sync_redis()
    if client is not None:
        try:
            client.setex(_blacklist_key(token), _remaining_ttl_seconds(token), "1")
            return
        except Exception as exc:
            logger.warning(
                "JWT blacklist: Redis write failed, adding to in-memory set",
                extra={"error": str(exc)},
            )
    _token_blacklist.add(token)


def is_token_blacklisted(token: str) -> bool:
    """Return True if the token has been revoked."""
    if token in _token_blacklist:
        return True
    client = _get_sync_redis()
    if client is None:
        return False
    try:
        return bool(client.exists(_blacklist_key(token)))
    except Exception:
        return False


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
