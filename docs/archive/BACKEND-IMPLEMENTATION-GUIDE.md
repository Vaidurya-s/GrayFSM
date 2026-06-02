# GrayFSM Backend Implementation Guide

**Version:** 1.0
**Date:** November 2025

---

## Quick Start

### 1. Project Setup

```bash
cd /home/arunupscee/Music/grayFSM/backend

# Create virtual environment
python3.10 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Setup database
alembic upgrade head

# Run development server
uvicorn grayfsm.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Dependencies (requirements.txt)

```txt
# Core Framework
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6

# Database
sqlalchemy[asyncio]==2.0.23
asyncpg==0.29.0
alembic==1.12.1
psycopg2-binary==2.9.9

# Data Validation
pydantic==2.5.0
pydantic-settings==2.1.0
email-validator==2.1.0

# Authentication & Security
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6

# Caching
redis==5.0.1
hiredis==2.2.3

# Background Tasks
celery==5.3.4
flower==2.0.1

# Graph Operations (Core Algorithms)
networkx==3.2.1
numpy==1.26.2
scipy==1.11.4

# Testing
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
httpx==0.25.2

# Code Quality
black==23.11.0
ruff==0.1.6
mypy==1.7.1

# Monitoring & Logging
structlog==23.2.0
sentry-sdk==1.38.0

# Documentation
mkdocs==1.5.3
mkdocs-material==9.4.14

# Development
python-dotenv==1.0.0
```

---

## FastAPI Application Structure

### Main Application (`main.py`)

```python
"""
GrayFSM FastAPI Application.
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time

from .config import settings
from .api.v1 import api_router
from .db.session import init_db
from .services.cache_service import CacheService
from .utils.logger import get_logger, setup_logging
from .utils.exceptions import GrayFSMException

# Setup logging
setup_logging()
logger = get_logger(__name__)

# Global cache service
cache_service = CacheService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.

    Handles startup and shutdown events.
    """
    # Startup
    logger.info("Starting GrayFSM API...")

    # Initialize database
    await init_db()

    # Connect to Redis
    await cache_service.connect()

    logger.info("GrayFSM API started successfully")

    yield

    # Shutdown
    logger.info("Shutting down GrayFSM API...")

    # Disconnect from Redis
    await cache_service.disconnect()

    logger.info("GrayFSM API shut down successfully")


# Create FastAPI application
app = FastAPI(
    title="GrayFSM API",
    description="Automated FSM Optimization using Gray Code Encoding",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip Compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time header to all responses."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Global exception handler
@app.exception_handler(GrayFSMException)
async def grayfsm_exception_handler(request: Request, exc: GrayFSMException):
    """Handle custom GrayFSM exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details
            }
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "details": str(exc) if settings.DEBUG else None
            }
        }
    )


# Include API router
app.include_router(api_router, prefix="/api/v1")


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Check API health status."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT
    }


# Root endpoint
@app.get("/", include_in_schema=False)
async def root():
    """Root endpoint redirect to docs."""
    return {
        "message": "GrayFSM API",
        "docs": "/docs",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "grayfsm.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
```

---

## Configuration Management

### Configuration (`config.py`)

```python
"""
Application configuration.
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings."""

    # Application
    APP_NAME: str = "GrayFSM"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost:5432/grayfsm"
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # Security
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000

    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_UPLOAD_EXTENSIONS: List[str] = [".json", ".csv"]

    # Optimization
    DEFAULT_ALGORITHM: str = "greedy"
    MAX_FSM_STATES: int = 256
    OPTIMIZATION_TIMEOUT_MS: int = 30000

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"

    # Monitoring
    SENTRY_DSN: Optional[str] = None
    ENABLE_METRICS: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
```

### Environment File (`.env`)

```bash
# Application
APP_NAME=GrayFSM
ENVIRONMENT=development
DEBUG=true

# Database
DATABASE_URL=postgresql+asyncpg://grayfsm:password@localhost:5432/grayfsm

# Redis
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# Security
JWT_SECRET_KEY=super-secret-key-change-me-in-production

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000

# Logging
LOG_LEVEL=INFO

# Monitoring (Optional)
# SENTRY_DSN=https://your-sentry-dsn
```

---

## Database Configuration

### Database Session (`db/session.py`)

```python
"""
Database session management.
"""

from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker
)
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator

from ..config import settings
from ..utils.logger import get_logger

logger = get_logger(__name__)

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting database session.

    Yields:
        Database session

    Example:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database (create tables if needed)."""
    async with engine.begin() as conn:
        # Import all models to register them
        from ..models import fsm, user, algorithm_result, export_cache

        # Create tables (for development only)
        if settings.ENVIRONMENT == "development":
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created")
```

### Base Model (`db/base.py`)

```python
"""
Base database model with common fields.
"""

from sqlalchemy import Column, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declared_attr
import uuid


class BaseModel:
    """Base model with common fields."""

    @declared_attr
    def __tablename__(cls):
        """Generate table name from class name."""
        return cls.__name__.lower()

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
```

---

## API Router Configuration

### API Router (`api/v1/__init__.py`)

```python
"""
API v1 router configuration.
"""

from fastapi import APIRouter

from .fsm import router as fsm_router
from .algorithm import router as algorithm_router
from .export import router as export_router
from .category import router as category_router
from .example import router as example_router
from .health import router as health_router

api_router = APIRouter()

# Include all routers
api_router.include_router(
    fsm_router,
    prefix="/fsms",
    tags=["FSMs"]
)

api_router.include_router(
    algorithm_router,
    prefix="/fsms",
    tags=["Algorithms"]
)

api_router.include_router(
    export_router,
    prefix="/fsms",
    tags=["Export"]
)

api_router.include_router(
    category_router,
    prefix="/categories",
    tags=["Categories"]
)

api_router.include_router(
    example_router,
    prefix="/examples",
    tags=["Examples"]
)

api_router.include_router(
    health_router,
    prefix="",
    tags=["Health"]
)
```

### FSM Endpoints (`api/v1/fsm.py`)

```python
"""
FSM API endpoints.
"""

from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from ...db.session import get_db
from ...services.fsm_service import FSMService
from ...schemas.fsm import (
    FSMCreate,
    FSMUpdate,
    FSMResponse,
    FSMListResponse,
    FSMFilters
)
from ...schemas.common import PaginationParams
from ...utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post(
    "/",
    response_model=FSMResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_fsm(
    fsm_data: FSMCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new FSM.

    - **name**: FSM name (required)
    - **fsm_type**: "moore" or "mealy" (required)
    - **states**: List of state names (required)
    - **transitions**: List of transitions (required)
    - **outputs**: State outputs for Moore machines
    """
    service = FSMService(db)
    fsm = await service.create_fsm(fsm_data)

    return FSMResponse(
        success=True,
        data=fsm
    )


@router.get("/{fsm_id}", response_model=FSMResponse)
async def get_fsm(
    fsm_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get FSM by ID.

    Returns complete FSM definition including states, transitions, and metadata.
    """
    service = FSMService(db)
    fsm = await service.get_fsm(fsm_id)

    return FSMResponse(
        success=True,
        data=fsm
    )


@router.get("/", response_model=FSMListResponse)
async def list_fsms(
    visibility: Optional[str] = Query(None),
    fsm_type: Optional[str] = Query(None),
    category_id: Optional[UUID] = Query(None),
    is_optimized: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """
    List FSMs with filtering and pagination.

    Supports:
    - Filtering by visibility, type, category, optimization status
    - Full-text search
    - Tag filtering
    - Sorting and pagination
    """
    # Parse tags
    tag_list = tags.split(",") if tags else None

    # Create filters
    filters = FSMFilters(
        visibility=visibility,
        fsm_type=fsm_type,
        category_id=category_id,
        is_optimized=is_optimized,
        search=search,
        tags=tag_list,
        sort_by=sort_by,
        sort_order=sort_order
    )

    service = FSMService(db)
    fsms, total = await service.list_fsms(filters, page, page_size)

    # Calculate pagination metadata
    total_pages = (total + page_size - 1) // page_size

    return FSMListResponse(
        success=True,
        data=fsms,
        pagination={
            "page": page,
            "page_size": page_size,
            "total_items": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    )


@router.put("/{fsm_id}", response_model=FSMResponse)
async def update_fsm(
    fsm_id: UUID,
    fsm_data: FSMUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update FSM metadata.

    Only updates metadata fields (name, description, tags, etc.).
    FSM definition cannot be updated directly.
    """
    service = FSMService(db)
    fsm = await service.update_fsm(fsm_id, fsm_data)

    return FSMResponse(
        success=True,
        data=fsm
    )


@router.delete("/{fsm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fsm(
    fsm_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete FSM.

    Permanently deletes the FSM and all associated data.
    """
    service = FSMService(db)
    await service.delete_fsm(fsm_id)


@router.post("/{fsm_id}/fork", response_model=FSMResponse)
async def fork_fsm(
    fsm_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a copy (fork) of an existing FSM.

    Creates an independent copy that can be modified separately.
    """
    # TODO: Get user_id from auth context
    user_id = None

    service = FSMService(db)
    forked_fsm = await service.fork_fsm(fsm_id, user_id)

    return FSMResponse(
        success=True,
        data=forked_fsm
    )
```

---

*Continued with more implementation details...*

## Testing Strategy

### Unit Test Example

```python
"""
Test FSM service.
"""

import pytest
from uuid import uuid4
from grayfsm.services.fsm_service import FSMService
from grayfsm.schemas.fsm import FSMCreate
from grayfsm.core.fsm_model import FSMType


@pytest.mark.asyncio
async def test_create_fsm(db_session):
    """Test FSM creation."""
    service = FSMService(db_session)

    fsm_data = FSMCreate(
        name="Test FSM",
        fsm_type=FSMType.MOORE,
        states=["S0", "S1"],
        initial_state="S0",
        transitions=[
            {"from_state": "S0", "to_state": "S1", "input": "1"}
        ],
        outputs={"S0": "0", "S1": "1"}
    )

    fsm = await service.create_fsm(fsm_data)

    assert fsm.name == "Test FSM"
    assert fsm.state_count == 2
    assert fsm.transition_count == 1


@pytest.mark.asyncio
async def test_get_fsm(db_session, sample_fsm):
    """Test FSM retrieval."""
    service = FSMService(db_session)

    fsm = await service.get_fsm(sample_fsm.id)

    assert fsm.id == sample_fsm.id
    assert fsm.name == sample_fsm.name


@pytest.mark.asyncio
async def test_get_nonexistent_fsm(db_session):
    """Test getting non-existent FSM."""
    service = FSMService(db_session)

    with pytest.raises(FSMNotFoundError):
        await service.get_fsm(uuid4())
```

---

This implementation guide provides the foundation for building the GrayFSM backend. The development team can use these patterns and examples to implement the complete system.
