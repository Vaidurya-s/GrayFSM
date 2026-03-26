"""
Rate limiting middleware
"""
from starlette.requests import Request

from app.utils.logger import get_logger

logger = get_logger(__name__)


async def rate_limit_middleware(request: Request, call_next):
    """
    Rate limiting middleware.
    
    TODO: Implement Redis-based rate limiting
    """
    # For now, just pass through
    response = await call_next(request)
    return response
