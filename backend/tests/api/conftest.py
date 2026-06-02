"""
Pytest fixtures for the auth/ownership integration tests in this directory.

These tests run the real FastAPI app against an in-memory SQLite database
so that the integration coverage exercises the actual route handlers,
auth middleware, services, and SQLAlchemy session — only the database
backend is swapped out. JSONB is downgraded to plain JSON because SQLite
does not implement the Postgres JSONB type. UUIDs are coerced to strings
in the underlying storage because SQLite has no native UUID column.

The conftest is intentionally local to backend/tests/api/ so it does not
leak into the existing test_core (pure-function) or integration (HDL
round-trip) directories which run with no DB at all.
"""
from __future__ import annotations

import os
import sys
import uuid
from collections.abc import AsyncGenerator
from datetime import timedelta
from typing import Any

# Force test env BEFORE app imports so config.py skips the placeholder-URL
# check. Mirrors the top of backend/tests/conftest.py.
os.environ.setdefault("ENVIRONMENT", "test")
# Set a real secret so create_access_token can mint JWTs the auth
# middleware will accept.
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-integration-tests-only")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import ARRAY  # noqa: E402
from sqlalchemy.dialects.postgresql import JSONB, UUID  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402

# ---------------------------------------------------------------------------
# Cross-dialect type adapters (Postgres-only types -> SQLite-friendly types)
# ---------------------------------------------------------------------------
#
# The FSM model uses sqlalchemy.dialects.postgresql.JSONB and UUID. Neither
# is supported natively on SQLite. We register sqlite-side compilers so the
# DDL generated for create_all uses JSON and CHAR(36) respectively. The
# model itself is left untouched.


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):  # type: ignore[no-redef]
    return "JSON"


@compiles(UUID, "sqlite")
def _compile_uuid_sqlite(type_, compiler, **kw):  # type: ignore[no-redef]
    return "CHAR(36)"


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):  # type: ignore[no-redef]
    # ARRAY(String) -> JSON on SQLite. Tags is the only ARRAY column in
    # the model and is used as a free-form list; JSON round-trips lists
    # correctly under SQLite without needing a TypeDecorator.
    return "JSON"


# ---------------------------------------------------------------------------
# In-memory DB engine + session
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def db_engine():
    """Fresh in-memory SQLite engine per test. Cheap; isolates rows."""
    from app.db.base import Base
    # Importing models populates Base.metadata with FSM, User, etc.
    import app.models.fsm  # noqa: F401
    import app.models.user  # noqa: F401

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def db_session_factory(db_engine):
    return async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session(db_session_factory) -> AsyncGenerator[AsyncSession, None]:
    async with db_session_factory() as session:
        yield session


# ---------------------------------------------------------------------------
# HTTP client wired to the test DB
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def api_client(db_session_factory) -> AsyncGenerator[AsyncClient, None]:
    """ASGI test client with the FastAPI app and the in-memory DB wired in.

    Overrides `get_db` to yield sessions from the per-test SQLite engine
    so route handlers, services, and middleware see exactly one DB.
    """
    from app.main import app
    from app.db.session import get_db

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with db_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://testserver",
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# Auth helpers — mint JWTs without needing the /auth/register flow
# ---------------------------------------------------------------------------


@pytest.fixture
def user_a_id() -> uuid.UUID:
    return uuid.UUID("11111111-1111-1111-1111-111111111111")


@pytest.fixture
def user_b_id() -> uuid.UUID:
    return uuid.UUID("22222222-2222-2222-2222-222222222222")


def _make_token(user_id: uuid.UUID, email: str = "test@example.com") -> str:
    from app.middleware.auth import create_access_token

    return create_access_token(
        {"sub": str(user_id), "email": email},
        expires_delta=timedelta(minutes=30),
    )


@pytest.fixture
def auth_headers_a(user_a_id) -> dict[str, str]:
    return {"Authorization": f"Bearer {_make_token(user_a_id, 'a@example.com')}"}


@pytest.fixture
def auth_headers_b(user_b_id) -> dict[str, str]:
    return {"Authorization": f"Bearer {_make_token(user_b_id, 'b@example.com')}"}


# ---------------------------------------------------------------------------
# FSM-insertion helper (bypasses the /api/v1/fsms POST so we can pin
# created_by=NULL or specific visibility values without route-side
# defaulting)
# ---------------------------------------------------------------------------


async def insert_fsm(
    session: AsyncSession,
    *,
    visibility: str = "private",
    created_by: uuid.UUID | None = None,
    is_optimized: bool = False,
    name: str = "Test FSM",
    fsm_type: str = "moore",
    definition: dict[str, Any] | None = None,
) -> Any:
    """Insert an FSM directly so tests can pin visibility/created_by exactly."""
    import math

    from app.models.fsm import FSM

    if definition is None:
        definition = {
            "states": ["s0", "s1"],
            "initial_state": "s0",
            "transitions": [{"from_state": "s0", "to_state": "s1", "input": "go"}],
            "outputs": {"s0": "0", "s1": "1"},
        }
    state_count = len(definition["states"])
    # Match the bit_width formula used in FSMService.create_fsm so a
    # round-trip optimize call assigns Gray codes of consistent length.
    bit_width = max(math.ceil(math.log2(max(state_count, 2))), 1)
    fsm = FSM(
        name=name,
        description="for-test",
        fsm_type=fsm_type,
        definition=definition,
        state_count=state_count,
        transition_count=len(definition["transitions"]),
        initial_state=definition["initial_state"],
        bit_width=bit_width,
        visibility=visibility,
        created_by=created_by,
        is_optimized=is_optimized,
        dummy_state_count=0,
    )
    session.add(fsm)
    await session.commit()
    await session.refresh(fsm)
    return fsm
