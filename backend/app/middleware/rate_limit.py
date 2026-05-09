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
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from fastapi import status
from starlette.requests import Request
from starlette.responses import JSONResponse

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
        self._store: dict[str, list] = {}

    def is_allowed(
        self,
        key: str,
        limit: int,
        window: int,
    ) -> tuple[bool, dict]:
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
        expired_keys = [k for k, ts in self._store.items() if all(t <= window_start for t in ts)]
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
            assert self._redis is not None
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
    ) -> tuple[bool, dict]:
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
_redis_store: RedisRateLimitStore | None = None
_redis_attempted = False


async def _get_redis_store() -> RedisRateLimitStore | None:
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


# Paths that should never be rate-limited
_EXEMPT_PATHS = frozenset(
    {
        "/health",
        "/api/v1/health",
        "/docs",
        "/redoc",
        "/openapi.json",
    }
)


# ---------------------------------------------------------------------------
# Rate-limit rule abstraction
# ---------------------------------------------------------------------------
#
# The middleware previously had two near-identical 50-line blocks: one
# for auth-path-specific limits, one for the global per-IP limit. Each
# ran its own Redis-or-memory fallback and built its own 429 response.
# Adding a new tier (e.g. per-user premium) meant a third copy.
#
# The strategy below collapses those into a single dispatch loop. A
# `RateLimitRule` describes "for requests matching this predicate,
# enforce N hits per W seconds, keyed by F(request)". The middleware
# evaluates rules in order; first match wins.


@dataclass(frozen=True)
class RateLimitRule:
    """One rate-limit policy.

    matches:    predicate against the Request — first match wins
    key_for:    derives the bucket key (per-IP, per-user, etc.)
    limit/window: late-bound via factories so settings reloads are picked up
    name:       short label for logs / X-RateLimit-* response headers
    """

    name: str
    matches: Callable[[Request], bool]
    key_for: Callable[[Request], str]
    limit_factory: Callable[[], int]
    window_factory: Callable[[], int]

    @property
    def limit(self) -> int:
        return self.limit_factory()

    @property
    def window(self) -> int:
        return self.window_factory()


def _path_matches(*paths: str) -> Callable[[Request], bool]:
    target = frozenset(paths)
    return lambda req: req.url.path in target


def _bucket(prefix: str) -> Callable[[Request], str]:
    return lambda req: f"{prefix}:{_get_client_ip(req)}:{req.url.path}"


def _build_rules() -> list[RateLimitRule]:
    """Construct the active rule list. Order matters — auth-specific rules
    must come BEFORE the catch-all so the stricter limits take precedence."""
    return [
        RateLimitRule(
            name="auth_login",
            matches=_path_matches("/api/v1/auth/login"),
            key_for=_bucket("rl:auth"),
            limit_factory=lambda: settings.rate_limit_login,
            window_factory=lambda: settings.rate_limit_login_window,
        ),
        RateLimitRule(
            name="auth_register",
            matches=_path_matches("/api/v1/auth/register"),
            key_for=_bucket("rl:auth"),
            limit_factory=lambda: settings.rate_limit_register,
            window_factory=lambda: settings.rate_limit_register_window,
        ),
        RateLimitRule(
            name="anonymous_global",
            matches=lambda req: True,  # catch-all
            key_for=lambda req: f"rl:ip:{_get_client_ip(req)}",
            limit_factory=lambda: settings.rate_limit_anonymous,
            window_factory=lambda: settings.rate_limit_window,
        ),
    ]


async def _check(rule: RateLimitRule, request: Request) -> tuple[bool, dict]:
    """Apply a single rule. Returns (allowed, info-dict).

    Centralises the Redis-then-memory fallback that was duplicated
    across the two original blocks. Always returns (True, {}) on
    internal error so a misconfigured rate limiter never blocks
    legitimate traffic — fail-open is the deliberate policy.
    """
    try:
        redis = await _get_redis_store()
        if redis and redis.available:
            return await redis.is_allowed(rule.key_for(request), rule.limit, rule.window)
        return _memory_store.is_allowed(rule.key_for(request), rule.limit, rule.window)
    except Exception as exc:
        logger.error(
            "Rate limiter error, allowing request through",
            extra={
                "error": str(exc),
                "rule": rule.name,
                "client_ip": _get_client_ip(request),
            },
        )
        return True, {}


def _too_many(rule: RateLimitRule, info: dict) -> JSONResponse:
    """Build the 429 response. Single source of truth for the envelope."""
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "success": False,
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. Please try again later.",
                "details": {
                    "limit": info.get("limit"),
                    "reset": info.get("reset"),
                },
            },
        },
        headers={
            "Retry-After": str(rule.window),
            "X-RateLimit-Limit": str(info.get("limit", rule.limit)),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": str(info.get("reset", "")),
        },
    )


# ---------------------------------------------------------------------------
# Middleware function
# ---------------------------------------------------------------------------


async def rate_limit_middleware(request: Request, call_next: Any) -> Any:
    """Per-IP sliding-window rate limiter.

    - Disabled entirely when ``settings.rate_limit_enabled`` is ``False``.
    - Health / docs endpoints are always exempt.
    - Evaluates rules from ``_build_rules()`` in order; first match wins.
    - Uses Redis if available, otherwise an in-memory dict.
    - On any internal error the request is **allowed through** (fail-open).
    - Returns HTTP 429 with ``Retry-After`` header when limit is exceeded.
    """
    if not settings.rate_limit_enabled:
        return await call_next(request)

    if request.url.path in _EXEMPT_PATHS:
        return await call_next(request)

    rule = next((r for r in _build_rules() if r.matches(request)), None)
    if rule is None:
        # Shouldn't happen given the catch-all in _build_rules, but be defensive.
        return await call_next(request)

    allowed, info = await _check(rule, request)
    if not allowed:
        logger.warning(
            "Rate limit exceeded",
            extra={
                "rule": rule.name,
                "client_ip": _get_client_ip(request),
                "path": request.url.path,
                "limit": rule.limit,
                "window": rule.window,
            },
        )
        return _too_many(rule, info)

    response = await call_next(request)
    if info:
        response.headers["X-RateLimit-Limit"] = str(info.get("limit", rule.limit))
        response.headers["X-RateLimit-Remaining"] = str(info.get("remaining", 0))
        response.headers["X-RateLimit-Reset"] = str(info.get("reset", ""))
    return response
