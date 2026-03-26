"""
Alembic Environment Configuration for GrayFSM

This module configures Alembic for database migrations.
It supports both online and offline migration modes.
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# ================================================================
# CONFIGURATION
# ================================================================

# Alembic Config object
config = context.config

# Setup logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ================================================================
# METADATA SETUP
# ================================================================

# Import your models' MetaData object here for 'autogenerate' support
# If you have SQLAlchemy models defined, import them like this:
# from myapp.models import Base
# target_metadata = Base.metadata

# For now, we'll use None since schema is managed via SQL files
# In future, import from backend/app/models when they're created
target_metadata = None

# ================================================================
# CONFIGURATION OVERRIDES
# ================================================================

def get_url():
    """
    Get database URL from environment variable or config file.
    Environment variable takes precedence.
    """
    return os.environ.get(
        "DATABASE_URL",
        config.get_main_option("sqlalchemy.url")
    )


def include_object(object, name, type_, reflected, compare_to):
    """
    Filter objects to include in autogenerate comparisons.

    Exclude:
    - Internal PostgreSQL schemas (pg_*, information_schema)
    - Temporary tables
    - Materialized views (handled separately)
    """
    if type_ == "table":
        # Exclude system tables and temp tables
        if name.startswith("pg_") or name.startswith("_"):
            return False
        # Exclude Alembic version table
        if name == "alembic_version":
            return False

    return True


def run_migrations_offline():
    """
    Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """
    Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    # Override sqlalchemy.url with environment variable if set
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = get_url()

    # Create engine with connection pooling
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # Use NullPool for migrations
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            compare_type=True,
            compare_server_default=True,
            # Transaction per migration (safer)
            transaction_per_migration=True,
        )

        with context.begin_transaction():
            context.run_migrations()


# ================================================================
# MAIN EXECUTION
# ================================================================

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
