"""
Redis-based Rate Limiting Implementation
Fixes: V-06 (Rate Limiting Not Implemented)

IMPLEMENTATION GUIDE:
1. Install: pip install redis aioredis
2. Replace: /backend/app/middleware/rate_limit.py
3. Configure Redis connection in config.py
4. Enable in main.py
"""

import time
from typing import Optional, Callable
from functools import wraps

import redis.asyncio as aioredis
from fastapi import Request, HTTPException, status
from starlette.responses import JSONResponse

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


class RateLimiter:
    """
    Redis-based rate limiter using sliding window algorithm

    Features:
    - Per-IP rate limiting
    - Per-user rate limiting
    - Multiple time windows
    - Distributed (works across multiple servers)
    """

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None

    async def connect(self):
        """Initialize Redis connection"""
        try:
            self.redis = await aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=settings.redis_max_connections
            )
            logger.info("Rate limiter connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise

    async def close(self):
        """Close Redis connection"""
        if self.redis:
            await self.redis.close()
            logger.info("Rate limiter disconnected from Redis")

    async def is_allowed(
        self,
        key: str,
        limit: int,
        window: int
    ) -> tuple[bool, dict]:
        """
        Check if request is allowed using sliding window

        Args:
            key: Unique identifier (e.g., IP address, user_id)
            limit: Maximum requests allowed in window
            window: Time window in seconds

        Returns:
            (is_allowed, rate_limit_info)
        """
        if not self.redis:
            # Fail open if Redis unavailable
            logger.warning("Redis not available, allowing request")
            return True, {}

        try:
            current_time = int(time.time())
            window_start = current_time - window

            # Remove old entries outside window
            await self.redis.zremrangebyscore(key, 0, window_start)

            # Count requests in current window
            request_count = await self.redis.zcard(key)

            if request_count < limit:
                # Add current request
                await self.redis.zadd(key, {str(current_time): current_time})
                await self.redis.expire(key, window)

                remaining = limit - request_count - 1
                reset_time = current_time + window

                return True, {
                    "limit": limit,
                    "remaining": remaining,
                    "reset": reset_time
                }
            else:
                # Rate limit exceeded
                oldest_entry = await self.redis.zrange(key, 0, 0, withscores=True)
                if oldest_entry:
                    reset_time = int(oldest_entry[0][1]) + window
                else:
                    reset_time = current_time + window

                return False, {
                    "limit": limit,
                    "remaining": 0,
                    "reset": reset_time
                }

        except Exception as e:
            logger.error(f"Rate limiter error: {e}")
            # Fail open on error
            return True, {}

    def get_identifier(self, request: Request, user_id: Optional[str] = None) -> str:
        """
        Get unique identifier for rate limiting

        Priority: user_id > API key > IP address
        """
        if user_id:
            return f"user:{user_id}"

        # Check for API key
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return f"apikey:{api_key[:16]}"  # Use first 16 chars

        # Fall back to IP address
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown"

        return f"ip:{ip}"


# Global rate limiter instance
rate_limiter = RateLimiter(settings.redis_url)


async def rate_limit_middleware(request: Request, call_next):
    """
    Rate limiting middleware for FastAPI

    Applies different limits based on authentication:
    - Anonymous users: 100 requests/hour
    - Authenticated users: 1000 requests/hour
    """
    if not settings.rate_limit_enabled:
        return await call_next(request)

    # Skip rate limiting for health checks
    if request.url.path in ["/health", "/api/v1/health"]:
        return await call_next(request)

    # Determine user authentication
    user_id = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        # Extract user_id from token (simplified)
        try:
            from app.middleware.auth import verify_token
            token = auth_header.replace("Bearer ", "")
            token_data = await verify_token(token)
            user_id = str(token_data.user_id)
        except Exception:
            pass  # Treat as anonymous

    # Get rate limit config
    if user_id:
        limit = settings.rate_limit_authenticated
    else:
        limit = settings.rate_limit_anonymous

    window = settings.rate_limit_window

    # Check rate limit
    identifier = rate_limiter.get_identifier(request, user_id)
    is_allowed, rate_info = await rate_limiter.is_allowed(
        key=f"rate_limit:{identifier}",
        limit=limit,
        window=window
    )

    if not is_allowed:
        logger.warning(
            f"Rate limit exceeded for {identifier}",
            extra={
                "identifier": identifier,
                "path": request.url.path,
                "limit": limit,
                "window": window
            }
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
                        "reset": rate_info.get("reset")
                    }
                }
            },
            headers={
                "X-RateLimit-Limit": str(rate_info.get("limit", limit)),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(rate_info.get("reset", "")),
                "Retry-After": str(window)
            }
        )

    # Add rate limit headers to response
    response = await call_next(request)

    if rate_info:
        response.headers["X-RateLimit-Limit"] = str(rate_info.get("limit", limit))
        response.headers["X-RateLimit-Remaining"] = str(rate_info.get("remaining", 0))
        response.headers["X-RateLimit-Reset"] = str(rate_info.get("reset", ""))

    return response


def rate_limit(limit: int, window: int = 60):
    """
    Decorator for route-specific rate limiting

    Usage:
        @router.post("/expensive-operation")
        @rate_limit(limit=10, window=60)  # 10 requests per minute
        async def expensive_operation():
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            identifier = rate_limiter.get_identifier(request)
            key = f"rate_limit:endpoint:{request.url.path}:{identifier}"

            is_allowed, rate_info = await rate_limiter.is_allowed(
                key=key,
                limit=limit,
                window=window
            )

            if not is_allowed:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Maximum {limit} requests per {window} seconds.",
                    headers={"Retry-After": str(window)}
                )

            return await func(request, *args, **kwargs)

        return wrapper
    return decorator


# Startup/Shutdown events for main.py
"""
# Add to main.py

from app.middleware.rate_limit import rate_limiter

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    # Startup
    logger.info("Starting GrayFSM Backend API")

    # Initialize database
    await create_db_and_tables()

    # Initialize rate limiter
    if settings.rate_limit_enabled:
        await rate_limiter.connect()

    yield

    # Shutdown
    logger.info("Shutting down GrayFSM Backend API")

    # Close connections
    await engine.dispose()
    if settings.rate_limit_enabled:
        await rate_limiter.close()
"""

# Example: Route-specific rate limiting
"""
from app.middleware.rate_limit import rate_limit

@router.post("/fsms/{fsm_id}/optimize")
@rate_limit(limit=5, window=3600)  # 5 optimization requests per hour
async def optimize_fsm(
    fsm_id: UUID,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Expensive operation protected by stricter rate limit
    ...
"""
