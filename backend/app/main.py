"""
GrayFSM Backend - Main Application Entry Point

This module initializes the FastAPI application with all middleware,
routers, and dependencies. It serves as the main entry point for the backend.
"""

import logging
import logging.config
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import fsm, algorithm, export, category, example, health, auth
from app.config import settings, LOGGING_CONFIG
from app.db.session import engine, create_db_and_tables
from app.middleware.error_handler import error_handler_middleware
from app.middleware.logging import logging_middleware
from app.middleware.rate_limit import rate_limit_middleware
from app.middleware.response_wrapper import response_wrapper_middleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.utils.logger import get_logger

# Configure logging
logging.config.dictConfig(LOGGING_CONFIG)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """
    Lifespan context manager for FastAPI application.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("Starting GrayFSM Backend API", extra={"version": settings.app_version})

    # Initialize database
    try:
        await create_db_and_tables()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
        raise

    # Initialize observability (telemetry + metrics)
    try:
        from app.observability.telemetry import setup_telemetry
        from app.observability.metrics import setup_metrics
        setup_telemetry(app)
        setup_metrics(app)
        logger.info("Observability initialized")
    except Exception as e:
        logger.warning(f"Observability init skipped: {e}")

    yield

    # Shutdown
    logger.info("Shutting down GrayFSM Backend API")

    # Shutdown telemetry gracefully
    try:
        from app.observability.telemetry import shutdown_telemetry
        shutdown_telemetry()
    except Exception:
        pass

    # Close Redis connection
    try:
        from app.cache import close_redis
        await close_redis()
    except Exception:
        pass

    await engine.dispose()


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description="""
    RESTful API for GrayFSM - Automated Finite State Machine Optimization using Gray Code Encoding.

    ## Features
    - FSM creation, management, and validation
    - Multiple optimization algorithms (Greedy, BFS, Global Optimization)
    - HDL export (Verilog, VHDL, testbenches)
    - Real-time optimization progress via WebSocket

    ## Documentation
    - Interactive API docs: /docs
    - Alternative docs: /redoc
    - OpenAPI spec: /openapi.json
    """,
    version=settings.app_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# -----------------------------------------------------------------------
# Middleware stack
#
# Starlette processes ``add_middleware`` calls in reverse registration
# order (last added = outermost).  ``app.middleware("http")`` decorators
# are similarly stacked (last registered = outermost).
#
# Desired execution order (outermost -> innermost):
#   1. SecurityHeadersMiddleware   (add_middleware — added last)
#   2. CORSMiddleware              (add_middleware)
#   3. GZipMiddleware              (add_middleware — added first)
#   4. logging_middleware           (http decorator — registered last)
#   5. error_handler_middleware     (http decorator)
#   6. rate_limit_middleware        (http decorator)
#   7. response_wrapper_middleware  (http decorator — registered first / innermost)
# -----------------------------------------------------------------------

# --- Class-based middleware (add_middleware: first = innermost) ----------

# GZip Compression (innermost of the class-based group)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# Security Headers (outermost — every response gets security headers)
app.add_middleware(SecurityHeadersMiddleware)

# --- Function-based middleware (http decorator: first = innermost) ------

app.middleware("http")(response_wrapper_middleware)  # innermost — wraps successful JSON
if settings.rate_limit_enabled:
    app.middleware("http")(rate_limit_middleware)
app.middleware("http")(error_handler_middleware)
app.middleware("http")(logging_middleware)

# Include API routers
API_PREFIX = "/api/v1"

app.include_router(
    health.router,
    prefix=API_PREFIX,
    tags=["Health"]
)

app.include_router(
    fsm.router,
    prefix=f"{API_PREFIX}/fsms",
    tags=["FSMs"]
)

app.include_router(
    algorithm.router,
    prefix=f"{API_PREFIX}/fsms",
    tags=["Algorithms"]
)

app.include_router(
    export.router,
    prefix=f"{API_PREFIX}/fsms",
    tags=["Export"]
)

app.include_router(
    category.router,
    prefix=f"{API_PREFIX}/categories",
    tags=["Categories"]
)

app.include_router(
    example.router,
    prefix=f"{API_PREFIX}/examples",
    tags=["Examples"]
)

app.include_router(
    auth.router,
    prefix=f"{API_PREFIX}/auth",
    tags=["Authentication"]
)


@app.get("/")
async def root() -> JSONResponse:
    """Root endpoint - API information"""
    return JSONResponse({
        "success": True,
        "data": {
            "name": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment,
            "docs_url": "/docs" if settings.debug else "Documentation disabled in production",
        },
        "metadata": {
            "timestamp": "2025-11-29T12:00:00Z",
            "api_version": "v1",
        }
    })


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        workers=settings.workers if not settings.reload else 1,
        log_level=settings.log_level.lower(),
    )
