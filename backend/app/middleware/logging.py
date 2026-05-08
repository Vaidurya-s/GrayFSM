"""
Request/Response logging middleware
"""

import time
import uuid

from starlette.requests import Request

from app.utils.logger import get_logger

logger = get_logger(__name__)


async def logging_middleware(request: Request, call_next):
    """
    Log all requests and responses.

    Adds request_id to all log entries for tracing.
    """
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id

    start_time = time.time()

    # Log request
    logger.info(
        "Request started",
        extra={
            "request_id": request_id,
            "method": request.method,
            "url": str(request.url),
            "client": request.client.host if request.client else None,
        },
    )

    # Process request
    response = await call_next(request)

    # Calculate duration
    duration_ms = (time.time() - start_time) * 1000

    # Log response
    logger.info(
        "Request completed",
        extra={
            "request_id": request_id,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
        },
    )

    # Add request ID to response headers
    response.headers["X-Request-ID"] = request_id

    return response
