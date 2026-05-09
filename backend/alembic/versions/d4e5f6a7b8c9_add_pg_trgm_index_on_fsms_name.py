"""add pg_trgm index on fsms.name

Revision ID: d4e5f6a7b8c9
Revises: f5125b99928d
Create Date: 2026-05-09 00:00:00.000000

The existing ``FSM.name.ilike('%query%')`` search in list_fsms performs a
sequential scan because a GIN tsvector index cannot serve prefix-anchored LIKE.
Adding a pg_trgm GIN index on ``fsms.name`` lets Postgres use an index scan for
ILIKE '%q%' queries automatically.
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "f5125b99928d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pg_trgm extension (idempotent; safe to run multiple times).
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # GIN trigram index on fsms.name — enables fast ILIKE '%q%' queries.
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fsms_name_trgm "
        "ON fsms USING gin (name gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_fsms_name_trgm")
    # Leave pg_trgm installed — other indexes may depend on it.
