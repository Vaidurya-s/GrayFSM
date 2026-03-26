"""
Health check and system status endpoints
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """System health check"""
    # Test database connection
    try:
        await db.execute("SELECT 1")
        db_status = "up"
    except Exception:
        db_status = "down"
    
    return {
        "status": "healthy" if db_status == "up" else "degraded",
        "version": settings.app_version,
        "environment": settings.environment,
        "services": {
            "database": db_status,
            "cache": "up",  # TODO: Test Redis
        }
    }


@router.get("/metrics")
async def get_metrics():
    """System metrics"""
    return {
        "request_count": 0,  # TODO: Implement metrics collection
        "avg_response_time_ms": 0,
        "optimization_count": 0,
        "cache_hit_rate": 0.0
    }
