"""
Health check and system status endpoints
"""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db

router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)) -> Any:
    """System health check"""
    # Test database connection
    try:
        await db.execute(text("SELECT 1"))
        db_status = "up"
    except Exception:
        db_status = "down"

    # Test Redis connection
    try:
        from app.cache import get_redis

        redis_client = await get_redis()
        cache_status = "up" if redis_client else "down"
    except Exception:
        cache_status = "down"

    return {
        "status": "healthy" if db_status == "up" else "degraded",
        "version": settings.app_version,
        "environment": settings.environment,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "services": {
            "database": db_status,
            "cache": cache_status,
        },
    }


# Note: Prometheus-format metrics are served at the root path ``/metrics`` by
# ``app.observability.metrics.setup_metrics`` (wired in ``main.py`` lifespan).
# The previous ``/api/v1/health/metrics`` placeholder returned hardcoded zeros
# and has been removed to avoid shipping misleading data alongside the real
# scrape endpoint.
