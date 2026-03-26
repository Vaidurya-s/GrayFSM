"""
Global error handling middleware
"""
import traceback
from starlette.requests import Request
from starlette.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.utils.exceptions import GrayFSMException
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def error_handler_middleware(request: Request, call_next):
    """
    Catch and handle all exceptions.
    
    Converts exceptions to standardized JSON error responses.
    """
    try:
        response = await call_next(request)
        return response
    except GrayFSMException as e:
        logger.error(
            f"Application error: {e.code}",
            extra={"error_code": e.code, "message": e.message}
        )
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": e.code,
                    "message": e.message,
                    "request_id": getattr(request.state, 'request_id', None)
                }
            }
        )
    except RequestValidationError as e:
        logger.error(f"Validation error: {str(e)}")
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": e.errors(),
                    "request_id": getattr(request.state, 'request_id', None)
                }
            }
        )
    except Exception as e:
        logger.error(
            f"Unexpected error: {str(e)}",
            extra={"traceback": traceback.format_exc()}
        )
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred",
                    "request_id": getattr(request.state, 'request_id', None)
                }
            }
        )
