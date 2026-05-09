"""Redis cache connection and helpers"""

import json

import redis.asyncio as redis

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

_redis_client: redis.Redis | None = None


async def get_redis() -> redis.Redis | None:
    """Get Redis client, returns None if unavailable"""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
            await _redis_client.ping()
            logger.info("Redis connected")
        except Exception as e:
            logger.warning(f"Redis unavailable: {e}")
            _redis_client = None
    return _redis_client


async def cache_get(key: str) -> dict | None:
    """Get cached value, returns None on miss or error"""
    client = await get_redis()
    if not client:
        return None
    try:
        data = await client.get(key)
        return json.loads(data) if data else None
    except Exception:
        return None


async def cache_set(key: str, value: dict, ttl: int | None = None) -> bool:
    """Set cached value, returns False on error"""
    client = await get_redis()
    if not client:
        return False
    try:
        await client.set(
            key,
            json.dumps(value, default=str),
            ex=ttl or settings.redis_cache_ttl,
        )
        return True
    except Exception:
        return False


async def cache_delete(pattern: str) -> None:
    """Delete cached keys matching pattern"""
    client = await get_redis()
    if not client:
        return
    try:
        keys = await client.keys(pattern)
        if keys:
            await client.delete(*keys)
    except Exception:
        pass


async def close_redis() -> None:
    """Close Redis connection"""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
