"""align head with models

Revision ID: f5125b99928d
Revises: c3d4e5f6a7b8
Create Date: 2026-05-09 00:46:03.619343

Closes the model/migration drift documented in `backend/alembic/DRIFT.md`.
The auto-generated draft additionally proposed dropping ~17 Postgres-specific
indexes (GIN, full-text, partial, expression-based) that exist in the
performance-indexes migration but aren't expressible cleanly in SQLAlchemy
column declarations. Those indexes are real and useful, so this migration
KEEPS them — we instead added an ``include_object`` filter in
``alembic/env.py`` to tell ``alembic check`` to ignore them.

What this migration actually does:

  - Adds the FK fsms.created_by -> users.id (model declares it, original
    migration didn't include it)
  - Aligns users column types/nullability with the model:
      is_active   nullable: False -> True (matches model default)
      created_at  type:    TIMESTAMP -> DateTime(timezone=True)
                  nullable: False -> True
      updated_at  type:    TIMESTAMP -> DateTime(timezone=True)
  - Adds the two indexes the model declares via Column(..., index=True):
      idx_users_email
      idx_users_is_active
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f5125b99928d"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add fsms.created_by foreign key (model has it, migration didn't).
    # Pass name=None so Postgres auto-names it (`fsms_created_by_fkey`),
    # matching the anonymous ForeignKey on the model. No ondelete here
    # for the same reason — the model declares the bare ForeignKey, so
    # adding ondelete would make `alembic check` see a mismatch.
    op.create_foreign_key(
        None,
        "fsms",
        "users",
        ["created_by"],
        ["id"],
    )

    # Align users column types/nullability with the model.
    op.alter_column(
        "users",
        "is_active",
        existing_type=sa.BOOLEAN(),
        nullable=True,
        existing_server_default=sa.text("true"),
    )
    op.alter_column(
        "users",
        "created_at",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        nullable=True,
        existing_server_default=sa.text("now()"),
    )
    op.alter_column(
        "users",
        "updated_at",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=True,
    )

    # Add indexes declared by Column(..., index=True) on the User model.
    op.create_index("idx_users_email", "users", ["email"], unique=False)
    op.create_index("idx_users_is_active", "users", ["is_active"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_users_is_active", table_name="users")
    op.drop_index("idx_users_email", table_name="users")

    op.alter_column(
        "users",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=True,
    )
    op.alter_column(
        "users",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        nullable=False,
        existing_server_default=sa.text("now()"),
    )
    op.alter_column(
        "users",
        "is_active",
        existing_type=sa.BOOLEAN(),
        nullable=False,
        existing_server_default=sa.text("true"),
    )

    # Anonymous FK — drop by inspecting the table for the only foreignkey
    # constraint pointing at users.id. Hard-coding a name is brittle because
    # the auto-name varies by Postgres naming convention.
    bind = op.get_bind()
    fk_name = bind.exec_driver_sql(
        "SELECT conname FROM pg_constraint "
        "WHERE conrelid = 'fsms'::regclass AND contype = 'f' "
        "AND confrelid = 'users'::regclass"
    ).scalar()
    if fk_name:
        op.drop_constraint(fk_name, "fsms", type_="foreignkey")
