"""Add performance indexes

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-27 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ================================================================
    # 1. COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
    # ================================================================

    # Partial composite index for public FSM listings with category filter
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fsms_visibility_category_created "
        "ON fsms (visibility, category_id, created_at DESC) "
        "WHERE visibility IN ('public', 'example')"
    )

    # Partial composite index for user FSM dashboard queries
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fsms_created_by_visibility_created "
        "ON fsms (created_by, visibility, created_at DESC) "
        "WHERE created_by IS NOT NULL"
    )

    # Partial composite index for optimized FSM lookup
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fsms_is_optimized_algorithm_created "
        "ON fsms (is_optimized, optimization_algorithm, created_at DESC) "
        "WHERE is_optimized = true"
    )

    # ================================================================
    # 2. CREATED_AT DESCENDING INDEX
    # ================================================================

    op.create_index(
        'idx_fsms_created_at_desc',
        'fsms',
        [sa.text('created_at DESC')],
    )

    # ================================================================
    # 3. FULL-TEXT SEARCH INDEX
    # ================================================================

    # Full-text search index — create an IMMUTABLE wrapper function first
    op.execute("""
        CREATE OR REPLACE FUNCTION fsm_search_vector(name text, description text)
        RETURNS tsvector LANGUAGE sql IMMUTABLE AS $$
            SELECT to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''));
        $$;
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fsms_search_text "
        "ON fsms USING gin(fsm_search_vector(name, description))"
    )

    # ================================================================
    # 4. JSONB INDEXES FOR DEFINITION QUERIES
    # ================================================================

    # GIN index on full definition JSONB column
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fsms_definition_gin "
        "ON fsms USING gin(definition)"
    )

    # Path-specific GIN indexes for frequently accessed fields
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fsms_definition_states "
        "ON fsms USING gin((definition -> 'states'))"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fsms_definition_transitions "
        "ON fsms USING gin((definition -> 'transitions'))"
    )

    # ================================================================
    # 5. ARRAY INDEX FOR TAG SEARCHES
    # ================================================================

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fsms_tags_gin "
        "ON fsms USING gin(tags)"
    )

    # ================================================================
    # 6. PARTIAL INDEXES FOR COMMON FILTERS
    # ================================================================

    # Popular FSMs (high view counts)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fsms_popular "
        "ON fsms (view_count DESC, created_at DESC) "
        "WHERE visibility IN ('public', 'example') AND view_count > 100"
    )

    # Recently updated FSMs
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fsms_recently_updated "
        "ON fsms (updated_at DESC) "
        "WHERE visibility IN ('public', 'example') "
        "AND updated_at > (CURRENT_TIMESTAMP - INTERVAL '30 days')"
    )

    # ================================================================
    # 7. ALGORITHM RESULTS INDEXES
    # ================================================================

    # Composite index for algorithm result lookups
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_algorithm_results_fsm_algorithm_time "
        "ON algorithm_results (original_fsm_id, algorithm, executed_at DESC)"
    )

    # Successful optimizations ranked by improvement
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_algorithm_results_success_improvement "
        "ON algorithm_results (success, improvement_percentage DESC NULLS LAST) "
        "WHERE success = true AND improvement_percentage IS NOT NULL"
    )

    # Algorithm performance comparison
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_algorithm_results_algorithm_performance "
        "ON algorithm_results (algorithm, execution_time_ms, memory_used_mb) "
        "WHERE success = true"
    )

    # ================================================================
    # 8. CATEGORY HIERARCHY INDEXES
    # ================================================================

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_categories_parent_level_order "
        "ON categories (parent_category_id NULLS FIRST, level, display_order)"
    )

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_categories_fsm_count "
        "ON categories (fsm_count DESC NULLS LAST, name)"
    )

    # ================================================================
    # 9. COVERING INDEX (INDEX-ONLY SCANS)
    # ================================================================

    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_fsms_list_covering "
        "ON fsms (visibility, category_id, created_at DESC) "
        "INCLUDE (id, name, fsm_type, state_count, is_optimized, view_count) "
        "WHERE visibility IN ('public', 'example')"
    )

    # ================================================================
    # 10. ANALYZE TABLES
    # ================================================================

    op.execute("ANALYZE fsms")
    op.execute("ANALYZE algorithm_results")
    op.execute("ANALYZE categories")


def downgrade() -> None:
    # Drop all indexes created in this migration (reverse order)

    # Covering index
    op.execute("DROP INDEX IF EXISTS idx_fsms_list_covering")

    # Category indexes
    op.execute("DROP INDEX IF EXISTS idx_categories_fsm_count")
    op.execute("DROP INDEX IF EXISTS idx_categories_parent_level_order")

    # Algorithm results indexes
    op.execute("DROP INDEX IF EXISTS idx_algorithm_results_algorithm_performance")
    op.execute("DROP INDEX IF EXISTS idx_algorithm_results_success_improvement")
    op.execute("DROP INDEX IF EXISTS idx_algorithm_results_fsm_algorithm_time")

    # Partial indexes
    op.execute("DROP INDEX IF EXISTS idx_fsms_recently_updated")
    op.execute("DROP INDEX IF EXISTS idx_fsms_popular")

    # Array / JSONB / FTS indexes
    op.execute("DROP INDEX IF EXISTS idx_fsms_tags_gin")
    op.execute("DROP INDEX IF EXISTS idx_fsms_definition_transitions")
    op.execute("DROP INDEX IF EXISTS idx_fsms_definition_states")
    op.execute("DROP INDEX IF EXISTS idx_fsms_definition_gin")
    op.execute("DROP INDEX IF EXISTS idx_fsms_search_text")
    op.execute("DROP FUNCTION IF EXISTS fsm_search_vector(text, text)")

    # Created_at descending
    op.execute("DROP INDEX IF EXISTS idx_fsms_created_at_desc")

    # Composite indexes
    op.execute("DROP INDEX IF EXISTS idx_fsms_is_optimized_algorithm_created")
    op.execute("DROP INDEX IF EXISTS idx_fsms_created_by_visibility_created")
    op.execute("DROP INDEX IF EXISTS idx_fsms_visibility_category_created")
