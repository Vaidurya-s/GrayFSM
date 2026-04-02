"""
Database session management

Optimized connection pool configuration based on:
- performance/database/03_connection_pool_config.py recommendations
- Medium traffic workload profile (50-200 concurrent users)
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import event
from app.config import settings
from app.db.base import Base

# Create async engine with optimized pool settings
engine = create_async_engine(
    settings.database_url,
    echo=settings.database_echo,
    # Pool sizing
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    # Connection health: test connections before checkout to avoid stale connections
    pool_pre_ping=True,
    # Recycle connections after 1 hour to prevent stale/leaked connections
    pool_recycle=3600,
    # Timeout waiting for a connection from the pool (seconds)
    pool_timeout=30,
    # asyncpg connection arguments for performance tuning
    connect_args={
        "command_timeout": 60.0,
        "server_settings": {
            "application_name": "grayfsm_api",
            "jit": "on",
        },
    },
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting async database session.
    
    Usage:
        @app.get("/items")
        async def read_items(db: AsyncSession = Depends(get_db)):
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


async def create_db_and_tables() -> None:
    """Create all database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
