"""
Rate-limiting middleware for GrayFSM.

Uses an in-memory sliding-window counter keyed by client IP.
Redis is attempted on startup if available; if it is not reachable the
middleware falls back to the in-memory store and **never crashes**.

Configuration (from ``app.config.settings``):
    rate_limit_enabled      -- master on/off switch (default True)
    rate_limit_anonymous    -- max requests per window (default 100)
    rate_limit_window       -- window size in seconds  (default 3600)

Adapted from security/fixes/03_rate_limiting.py
"""

import time
from typing import Dict, Optional, Tuple

from starlette.requests import Request
from starlette.responses import JSONResponse
from fastapi import status

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# In-memory sliding-window store
# ---------------------------------------------------------------------------

class InMemoryRateLimitStore:
    """
    Simple sliding-window rate limiter backed by a Python ``dict``.

    Each key maps to a list of Unix timestamps representing individual
    requests.  Expired entries are pruned on every lookup.
    """

    def __init__(self) -> None:
        # key -> list of request timestamps (floats)
        self._store: Dict[str, list] = {}

    def is_allowed(
        self,
        key: str,
        limit: int,
        window: int,
    ) -> Tuple[bool, Dict]:
        """Return ``(allowed, info_dict)``."""
        now = time.time()
        window_start = now - window

        # Prune expired entries
        timestamps = self._store.get(key, [])
        timestamps = [t for t in timestamps if t > window_start]

        if len(timestamps) < limit:
            timestamps.append(now)
            self._store[key] = timestamps
            remaining = limit - len(timestamps)
            return True, {
                "limit": limit,
                "remaining": remaining,
                "reset": int(now) + window,
            }

        # Exceeded
        self._store[key] = timestamps
        reset_time = int(timestamps[0]) + window if timestamps else int(now) + window
        return False, {
            "limit": limit,
            "remaining": 0,
            "reset": reset_time,
        }

    def cleanup(self, window: int) -> None:
        """Remove keys whose entries are all expired.  Called periodically."""
        now = time.time()
        window_start = now - window
        expired_keys = [
            k for k, ts in self._store.items()
            if all(t <= window_start for t in ts)
        ]
        for k in expired_keys:
            del self._store[k]


# ---------------------------------------------------------------------------
# Optional Redis store (best-effort)
# ---------------------------------------------------------------------------

class RedisRateLimitStore:
    """
    Sliding-window rate limiter backed by Redis sorted sets.

    Falls back to ``None`` (which signals the middleware to use the
    in-memory store) if Redis is unreachable.
    """

    def __init__(self, redis_url: str) -> None:
        self._redis_url = redis_url
        self._redis = None  # type: ignore[assignment]

    async def connect(self) -> bool:
        """Try to connect to Redis.  Return ``True`` on success."""
        try:
            import redis.asyncio as aioredis  # noqa: WPS433
            self._redis = await aioredis.from_url(
                self._redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            # Ping to verify connectivity
            await self._redis.ping()
            logger.info("Rate limiter connected to Redis")
            return True
        except Exception as exc:
            logger.warning(
                "Redis unavailable for rate limiting, using in-memory fallback",
                extra={"error": str(exc)},
            )
            self._redis = None
            return False

    @property
    def available(self) -> bool:
        return self._redis is not None

    async def is_allowed(
        self,
        key: str,
        limit: int,
        window: int,
    ) -> Tuple[bool, Dict]:
        """Return ``(allowed, info_dict)`` using Redis sorted sets."""
        if not self._redis:
            raise RuntimeError("Redis not connected")

        now = int(time.time())
        window_start = now - window

        pipe = self._redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {str(now): now})
        pipe.expire(key, window)
        results = await pipe.execute()

        request_count = results[1]  # zcard result

        if request_count < limit:
            remaining = limit - request_count - 1
            return True, {
                "limit": limit,
                "remaining": max(remaining, 0),
                "reset": now + window,
            }

        # Exceeded — undo the zadd we just did
        try:
            await self._redis.zrem(key, str(now))
        except Exception:
            pass

        return False, {
            "limit": limit,
            "remaining": 0,
            "reset": now + window,
        }

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()
            self._redis = None


# ---------------------------------------------------------------------------
# Module-level stores (initialised lazily)
# ---------------------------------------------------------------------------

_memory_store = InMemoryRateLimitStore()
_redis_store: Optional[RedisRateLimitStore] = None
_redis_attempted = False


async def _get_redis_store() -> Optional[RedisRateLimitStore]:
    """Lazily attempt a Redis connection once."""
    global _redis_store, _redis_attempted

    if _redis_attempted:
        return _redis_store

    _redis_attempted = True
    try:
        store = RedisRateLimitStore(settings.redis_url)
        ok = await store.connect()
        if ok:
            _redis_store = store
    except Exception as exc:
        logger.warning(
            "Could not initialise Redis rate-limit store",
            extra={"error": str(exc)},
        )
    return _redis_store


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client_ip(request: Request) -> str:
    """Extract the real client IP, respecting ``X-Forwarded-For``."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


# Path-specific rate limits for sensitive auth endpoints. Built lazily
# (via the function below) so changes to `settings.rate_limit_*` at
# import time pick up the latest config — the middleware caches the
# returned dict per request, not per process.
def _auth_rate_limits() -> dict[str, tuple[int, int]]:
    return {
        "/api/v1/auth/login": (settings.rate_limit_login, settings.rate_limit_login_window),
        "/api/v1/auth/register": (
            settings.rate_limit_register,
            settings.rate_limit_register_window,
        ),
    }


# Paths that should never be rate-limited
_EXEMPT_PATHS = frozenset({
    "/health",
    "/api/v1/health",
    "/docs",
    "/redoc",
    "/openapi.json",
})


# ---------------------------------------------------------------------------
# Middleware function
# ---------------------------------------------------------------------------

async def rate_limit_middleware(request: Request, call_next):
    """
    Per-IP sliding-window rate limiter.

    Behaviour:
    - Disabled entirely when ``settings.rate_limit_enabled`` is ``False``.
    - Health / docs endpoints are always exempt.
    - Uses Redis if available, otherwise an in-memory dict.
    - On any internal error the request is **allowed through** (fail-open).
    - Returns HTTP 429 with ``Retry-After`` header when limit is exceeded.
    """
    # Master switch
    if not settings.rate_limit_enabled:
        return await call_next(request)

    # Exempt paths
    if request.url.path in _EXEMPT_PATHS:
        return await call_next(request)

    # Determine limits
    limit = settings.rate_limit_anonymous
    window = settings.rate_limit_window

    # Build the rate-limit key
    client_ip = _get_client_ip(request)
    path = request.url.path

    # Check for path-specific (auth) rate limits — stricter than the global limit
    auth_limits = _auth_rate_limits()
    if path in auth_limits:
        auth_limit, auth_window = auth_limits[path]
        auth_key = f"rl:auth:{client_ip}:{path}"

        auth_allowed = True
        auth_rate_info: Dict = {}

        try:
            redis = await _get_redis_store()
            if redis and redis.available:
                auth_allowed, auth_rate_info = await redis.is_allowed(auth_key, auth_limit, auth_window)
            else:
                auth_allowed, auth_rate_info = _memory_store.is_allowed(auth_key, auth_limit, auth_window)
        except Exception as exc:
            logger.error(
                "Auth rate limiter error, allowing request through",
                extra={"error": str(exc), "client_ip": client_ip, "path": path},
            )
            auth_allowed = True
            auth_rate_info = {}

        if not auth_allowed:
            logger.warning(
                "Auth rate limit exceeded",
                extra={
                    "client_ip": client_ip,
                    "path": path,
                    "limit": auth_limit,
                    "window": auth_window,
                },
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "success": False,
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": "Too many requests. Please try again later.",
                        "details": {
                            "limit": auth_rate_info.get("limit"),
                            "reset": auth_rate_info.get("reset"),
                        },
                    },
                },
                headers={
                    "Retry-After": str(auth_window),
                    "X-RateLimit-Limit": str(auth_rate_info.get("limit", auth_limit)),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(auth_rate_info.get("reset", "")),
                },
            )

    key = f"rl:ip:{client_ip}"

    # Try Redis first, fall back to in-memory
    allowed = True
    rate_info: Dict = {}

    try:
        redis = await _get_redis_store()
        if redis and redis.available:
            allowed, rate_info = await redis.is_allowed(key, limit, window)
        else:
            allowed, rate_info = _memory_store.is_allowed(key, limit, window)
    except Exception as exc:
        # Fail open — never block a request because of a rate-limiter bug
        logger.error(
            "Rate limiter error, allowing request through",
            extra={"error": str(exc), "client_ip": client_ip},
        )
        allowed = True
        rate_info = {}

    if not allowed:
        logger.warning(
            "Rate limit exceeded",
            extra={
                "client_ip": client_ip,
                "path": request.url.path,
                "limit": limit,
                "window": window,
            },
        )
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "success": False,
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Too many requests. Please try again later.",
                    "details": {
                        "limit": rate_info.get("limit"),
                        "reset": rate_info.get("reset"),
                    },
                },
            },
            headers={
                "Retry-After": str(window),
                "X-RateLimit-Limit": str(rate_info.get("limit", limit)),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(rate_info.get("reset", "")),
            },
        )

    # Request allowed — forward and annotate the response
    response = await call_next(request)

    if rate_info:
        response.headers["X-RateLimit-Limit"] = str(rate_info.get("limit", limit))
        response.headers["X-RateLimit-Remaining"] = str(
            rate_info.get("remaining", 0)
        )
        response.headers["X-RateLimit-Reset"] = str(rate_info.get("reset", ""))

    return response
