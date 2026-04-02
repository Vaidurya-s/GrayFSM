-- ================================================================
-- GrayFSM Database - Performance Indexes
-- Applied during Docker init to match Alembic migration b2c3d4e5f6a7
-- ================================================================

\echo 'Applying performance indexes...'

-- ================================================================
-- 1. COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ================================================================

-- Public FSM listings with category filter and ordering
CREATE INDEX IF NOT EXISTS idx_fsms_visibility_category_created
ON fsms (visibility, category_id, created_at DESC)
WHERE visibility IN ('public', 'example');

-- User FSM dashboard queries
CREATE INDEX IF NOT EXISTS idx_fsms_created_by_visibility_created
ON fsms (created_by, visibility, created_at DESC)
WHERE created_by IS NOT NULL;

-- Optimized FSM search
CREATE INDEX IF NOT EXISTS idx_fsms_is_optimized_algorithm_created
ON fsms (is_optimized, optimization_algorithm, created_at DESC)
WHERE is_optimized = true;

-- ================================================================
-- 2. CREATED_AT DESCENDING INDEX
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_fsms_created_at_desc
ON fsms (created_at DESC);

-- ================================================================
-- 3. FULL-TEXT SEARCH INDEX
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_fsms_search_text
ON fsms USING gin(to_tsvector('english',
    coalesce(name, '') || ' ' || coalesce(description, '')));

-- ================================================================
-- 4. JSONB INDEXES FOR DEFINITION QUERIES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_fsms_definition_gin
ON fsms USING gin(definition);

CREATE INDEX IF NOT EXISTS idx_fsms_definition_states
ON fsms USING gin((definition -> 'states'));

CREATE INDEX IF NOT EXISTS idx_fsms_definition_transitions
ON fsms USING gin((definition -> 'transitions'));

-- ================================================================
-- 5. ARRAY INDEX FOR TAG SEARCHES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_fsms_tags_gin
ON fsms USING gin(tags);

-- ================================================================
-- 6. PARTIAL INDEXES FOR COMMON FILTERS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_fsms_popular
ON fsms (view_count DESC, created_at DESC)
WHERE visibility IN ('public', 'example') AND view_count > 100;

CREATE INDEX IF NOT EXISTS idx_fsms_recently_updated
ON fsms (updated_at DESC)
WHERE visibility IN ('public', 'example')
AND updated_at > (CURRENT_TIMESTAMP - INTERVAL '30 days');

-- ================================================================
-- 7. ALGORITHM RESULTS INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_algorithm_results_fsm_algorithm_time
ON algorithm_results (original_fsm_id, algorithm, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_algorithm_results_success_improvement
ON algorithm_results (success, improvement_percentage DESC NULLS LAST)
WHERE success = true AND improvement_percentage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_algorithm_results_algorithm_performance
ON algorithm_results (algorithm, execution_time_ms, memory_used_mb)
WHERE success = true;

-- ================================================================
-- 8. CATEGORY HIERARCHY INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_categories_parent_level_order
ON categories (parent_category_id NULLS FIRST, level, display_order);

CREATE INDEX IF NOT EXISTS idx_categories_fsm_count
ON categories (fsm_count DESC NULLS LAST, name);

-- ================================================================
-- 9. COVERING INDEX (INDEX-ONLY SCANS)
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_fsms_list_covering
ON fsms (visibility, category_id, created_at DESC)
INCLUDE (id, name, fsm_type, state_count, is_optimized, view_count)
WHERE visibility IN ('public', 'example');

-- ================================================================
-- 10. ANALYZE TABLES
-- ================================================================

ANALYZE fsms;
ANALYZE algorithm_results;
ANALYZE categories;

\echo 'Performance indexes applied successfully!'
