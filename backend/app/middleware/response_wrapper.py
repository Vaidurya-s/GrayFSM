"""
Response envelope middleware

Wraps all successful JSON API responses in a consistent envelope:
    {"success": true, "data": <original body>}

Skipped for:
- Non-API paths (/, /docs, /redoc, /openapi.json)
- Paths containing /health or /metrics (already excluded from wrapping)
- Non-2xx status codes (errors are already wrapped by error_handler_middleware)
- Non-JSON content types
- Bodies that already contain a "success" key (avoid double-wrapping)
"""

import json
from typing import Any

from starlette.requests import Request
from starlette.responses import JSONResponse, Response

# Paths that should never be wrapped
_SKIP_PATHS = frozenset({"/", "/docs", "/redoc", "/openapi.json"})


async def response_wrapper_middleware(request: Request, call_next: Any) -> Any:
    """
    Wrap successful JSON responses in {"success": true, "data": ...}.
    """
    # Skip non-API paths
    path = request.url.path
    if path in _SKIP_PATHS or "/health" in path or "/metrics" in path:
        return await call_next(request)

    response = await call_next(request)

    # Skip non-2xx responses — error_handler_middleware already wraps those
    if not (200 <= response.status_code < 300):
        return response

    # Skip non-JSON content types
    content_type = response.headers.get("content-type", "")
    if "application/json" not in content_type:
        return response

    # Consume the body iterator
    body = b""
    async for chunk in response.body_iterator:
        body += chunk

    # Try to parse as JSON
    try:
        data = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        # Not valid JSON — return as-is
        return Response(
            content=body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

    # Skip if already wrapped (has a "success" key)
    if isinstance(data, dict) and "success" in data:
        return Response(
            content=body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

    # Wrap the response
    wrapped = {"success": True, "data": data}
    return JSONResponse(content=wrapped, status_code=response.status_code)
