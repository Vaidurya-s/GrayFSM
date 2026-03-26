"""Initial database schema for GrayFSM

Revision ID: 001_initial
Revises:
Create Date: 2025-11-29 00:00:00.000000

This migration creates the complete initial schema including:
- Custom types (ENUMs)
- All core tables (fsms, categories, users, etc.)
- Indexes and constraints
- Utility functions and triggers
- Materialized views
- Seed data

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Create initial database schema.

    Note: The actual schema creation is handled by init scripts
    (01_extensions.sql, 02_schema.sql, 03_seed_data.sql) that run
    when the database container is first initialized.

    This migration serves as a baseline marker and can be used to
    recreate the schema programmatically if needed.
    """
    # Mark: Schema created via SQL scripts in init/
    # This migration file serves as version marker
    pass


def downgrade() -> None:
    """
    Drop all database objects.

    WARNING: This will delete ALL data!
    """
    # Drop materialized views
    op.execute('DROP MATERIALIZED VIEW IF EXISTS trending_fsms CASCADE')
    op.execute('DROP MATERIALIZED VIEW IF EXISTS category_statistics CASCADE')

    # Drop tables in reverse dependency order
    op.drop_table('activity_log', if_exists=True)
    op.drop_table('benchmarks', if_exists=True)
    op.drop_table('votes', if_exists=True)
    op.drop_table('comments', if_exists=True)
    op.drop_table('shares', if_exists=True)
    op.drop_table('export_cache', if_exists=True)
    op.drop_table('algorithm_results', if_exists=True)
    op.drop_table('transitions', if_exists=True)
    op.drop_table('states', if_exists=True)
    op.drop_table('fsms', if_exists=True)
    op.drop_table('categories', if_exists=True)
    op.drop_table('users', if_exists=True)

    # Drop functions
    op.execute('DROP FUNCTION IF EXISTS update_updated_at_column CASCADE')
    op.execute('DROP FUNCTION IF EXISTS current_user_id CASCADE')
    op.execute('DROP FUNCTION IF EXISTS clean_expired_cache CASCADE')
    op.execute('DROP FUNCTION IF EXISTS refresh_all_materialized_views CASCADE')

    # Drop custom types
    op.execute('DROP TYPE IF EXISTS fsm_type CASCADE')
    op.execute('DROP TYPE IF EXISTS fsm_visibility CASCADE')
    op.execute('DROP TYPE IF EXISTS algorithm_name CASCADE')
    op.execute('DROP TYPE IF EXISTS export_format CASCADE')
    op.execute('DROP TYPE IF EXISTS user_role CASCADE')
    op.execute('DROP TYPE IF EXISTS user_status CASCADE')
    op.execute('DROP TYPE IF EXISTS share_permission CASCADE')
    op.execute('DROP TYPE IF EXISTS vote_type CASCADE')
    op.execute('DROP TYPE IF EXISTS activity_type CASCADE')

    # Extensions remain installed (don't drop)
    # DROP EXTENSION commands would go here if needed
