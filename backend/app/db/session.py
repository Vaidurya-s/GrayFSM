"""
Database session management

Optimized connection pool configuration based on:
- performance/database/03_connection_pool_config.py recommendations
- Medium traffic workload profile (50-200 concurrent users)
"""

from collections.abc import AsyncGenerator

from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.db.base import Base
from app.utils.logger import get_logger

logger = get_logger(__name__)

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
    """Create all database tables, then seed examples on an empty DB."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _seed_examples_if_empty()


async def _seed_examples_if_empty() -> None:
    """Insert example FSMs as public 'example' entries when the fsms table is empty.

    Idempotent: skips silently if any FSM already exists.
    """
    from app.models.fsm import FSM
    from app.services.example_service import ExampleService

    async with AsyncSessionLocal() as session:
        count = await session.scalar(select(sa_func.count()).select_from(FSM))
        if count and count > 0:
            return

        service = ExampleService()
        examples = await service.list_examples()
        if not examples:
            logger.warning("No example FSMs found on disk; skipping seed")
            return

        for example in examples:
            definition = {
                "states": example["states"],
                "transitions": example["transitions"],
                "outputs": example.get("outputs", {}),
            }
            fsm = FSM(
                name=example["name"],
                description=example.get("description"),
                fsm_type=example.get("fsm_type", "moore"),
                definition=definition,
                state_count=example["state_count"],
                transition_count=example["transition_count"],
                initial_state=example["initial_state"],
                bit_width=example["bit_width"],
                visibility="example",
                is_optimized=False,
                dummy_state_count=0,
            )
            session.add(fsm)

        await session.commit()
        logger.info("Seeded example FSMs", count=len(examples))
