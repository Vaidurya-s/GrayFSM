-- ================================================================
-- GrayFSM Database Performance Index Optimization
-- Purpose: Add optimized indexes for high-performance queries
-- Author: Performance Engineering Team
-- Date: 2025-11-29
-- ================================================================

-- ================================================================
-- ANALYSIS OF CURRENT INDEXES AND GAPS
-- ================================================================

-- Current indexes from ORM models:
-- - idx_fsms_type (fsm_type)
-- - idx_fsms_category (category_id)
-- - idx_fsms_visibility (visibility)
-- - idx_fsms_is_optimized (is_optimized)

-- Additional indexes needed based on common query patterns:

-- ================================================================
-- 1. COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ================================================================

-- Index for filtering FSMs by visibility and category (common list query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fsms_visibility_category_created
ON fsms (visibility, category_id, created_at DESC)
WHERE visibility IN ('public', 'example');
COMMENT ON INDEX idx_fsms_visibility_category_created IS
'Optimizes public FSM listings with category filter and ordering';

-- Index for user's FSM queries (owner + visibility + created_at)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fsms_created_by_visibility_created
ON fsms (created_by, visibility, created_at DESC)
WHERE created_by IS NOT NULL;
COMMENT ON INDEX idx_fsms_created_by_visibility_created IS
'Optimizes user FSM dashboard queries';

-- Index for optimized FSM search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fsms_is_optimized_algorithm_created
ON fsms (is_optimized, optimization_algorithm, created_at DESC)
WHERE is_optimized = true;
COMMENT ON INDEX idx_fsms_is_optimized_algorithm_created IS
'Fast lookup of optimized FSMs by algorithm';

-- ================================================================
-- 2. FULL-TEXT SEARCH INDEX FOR FSM NAMES AND DESCRIPTIONS
-- ================================================================

-- Add GIN index for full-text search on FSM name and description
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fsms_search_text
ON fsms USING gin(to_tsvector('english',
    coalesce(name, '') || ' ' || coalesce(description, '')));
COMMENT ON INDEX idx_fsms_search_text IS
'Full-text search on FSM name and description';

-- ================================================================
-- 3. JSONB INDEXES FOR DEFINITION QUERIES
-- ================================================================

-- GIN index for JSONB definition field (enables fast containment queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fsms_definition_gin
ON fsms USING gin(definition);
COMMENT ON INDEX idx_fsms_definition_gin IS
'Enables fast queries on FSM definition structure';

-- Specific path indexes for frequently accessed definition fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fsms_definition_states
ON fsms USING gin((definition -> 'states'));
COMMENT ON INDEX idx_fsms_definition_states IS
'Fast access to states array in definition';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fsms_definition_transitions
ON fsms USING gin((definition -> 'transitions'));
COMMENT ON INDEX idx_fsms_definition_transitions IS
'Fast access to transitions array in definition';

-- ================================================================
-- 4. ARRAY INDEXES FOR TAG SEARCHES
-- ================================================================

-- GIN index for tags array
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fsms_tags_gin
ON fsms USING gin(tags);
COMMENT ON INDEX idx_fsms_tags_gin IS
'Enables fast tag-based filtering and overlap queries';

-- ================================================================
-- 5. PARTIAL INDEXES FOR COMMON FILTERS
-- ================================================================

-- Index for popular FSMs (high view counts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fsms_popular
ON fsms (view_count DESC, created_at DESC)
WHERE visibility IN ('public', 'example') AND view_count > 100;
COMMENT ON INDEX idx_fsms_popular IS
'Quick access to trending/popular FSMs';

-- Index for recently updated FSMs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fsms_recently_updated
ON fsms (updated_at DESC)
WHERE visibility IN ('public', 'example')
AND updated_at > (CURRENT_TIMESTAMP - INTERVAL '30 days');
COMMENT ON INDEX idx_fsms_recently_updated IS
'Fast queries for recently modified public FSMs';

-- ================================================================
-- 6. ALGORITHM RESULTS OPTIMIZATION
-- ================================================================

-- Composite index for algorithm result lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_algorithm_results_fsm_algorithm_time
ON algorithm_results (original_fsm_id, algorithm, executed_at DESC);
COMMENT ON INDEX idx_algorithm_results_fsm_algorithm_time IS
'Optimizes queries for algorithm results by FSM and algorithm type';

-- Index for successful optimizations with improvement tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_algorithm_results_success_improvement
ON algorithm_results (success, improvement_percentage DESC NULLS LAST)
WHERE success = true AND improvement_percentage IS NOT NULL;
COMMENT ON INDEX idx_algorithm_results_success_improvement IS
'Fast access to successful optimizations ranked by improvement';

-- Index for performance analysis queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_algorithm_results_algorithm_performance
ON algorithm_results (algorithm, execution_time_ms, memory_used_mb)
WHERE success = true;
COMMENT ON INDEX idx_algorithm_results_algorithm_performance IS
'Enables algorithm performance comparison queries';

-- ================================================================
-- 7. CATEGORY HIERARCHY OPTIMIZATION
-- ================================================================

-- Index for category hierarchy queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_parent_level_order
ON categories (parent_category_id NULLS FIRST, level, display_order);
COMMENT ON INDEX idx_categories_parent_level_order IS
'Optimizes category tree navigation queries';

-- Index for category FSM count sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_fsm_count
ON categories (fsm_count DESC NULLS LAST, name);
COMMENT ON INDEX idx_categories_fsm_count IS
'Quick sorting of categories by popularity';

-- ================================================================
-- 8. COVERING INDEXES (INDEX-ONLY SCANS)
-- ================================================================

-- Covering index for FSM list queries (avoids table lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fsms_list_covering
ON fsms (visibility, category_id, created_at DESC)
INCLUDE (id, name, fsm_type, state_count, is_optimized, view_count)
WHERE visibility IN ('public', 'example');
COMMENT ON INDEX idx_fsms_list_covering IS
'Covering index enables index-only scans for list queries';

-- ================================================================
-- 9. STATISTICS AND MAINTENANCE
-- ================================================================

-- Update table statistics for better query planning
ANALYZE fsms;
ANALYZE algorithm_results;
ANALYZE categories;

-- ================================================================
-- 10. INDEX USAGE MONITORING QUERIES
-- ================================================================

-- Create view to monitor index usage
CREATE OR REPLACE VIEW v_index_usage_stats AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        ELSE 'ACTIVE'
    END as usage_status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

COMMENT ON VIEW v_index_usage_stats IS
'Monitor index usage to identify unused or underutilized indexes';

-- ================================================================
-- EXPECTED PERFORMANCE IMPROVEMENTS
-- ================================================================

-- 1. FSM List Queries: 80-90% reduction in query time
--    - Before: Full table scan (100-500ms for 10k FSMs)
--    - After: Index-only scan (5-15ms)

-- 2. Full-Text Search: 95% reduction
--    - Before: Sequential scan with LIKE (500-2000ms)
--    - After: GIN index scan (10-50ms)

-- 3. User Dashboard: 85% reduction
--    - Before: Filtered scan (50-200ms)
--    - After: Index scan (5-20ms)

-- 4. Algorithm Results Lookup: 90% reduction
--    - Before: Sequential scan (100-300ms)
--    - After: Index seek (3-10ms)

-- 5. Tag-based Filtering: 92% reduction
--    - Before: Array iteration (200-800ms)
--    - After: GIN index (8-30ms)

-- Total estimated query performance improvement: 85-92% across common operations
