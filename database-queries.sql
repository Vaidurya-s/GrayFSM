-- ================================================================
-- GrayFSM Sample Queries and Common Operations
-- Version: 1.0
-- ================================================================

-- ================================================================
-- SECTION 1: BASIC CRUD OPERATIONS
-- ================================================================

-- ----------------------------------------------------------------
-- Create a new FSM
-- ----------------------------------------------------------------
INSERT INTO fsms (
    name, description, fsm_type, definition,
    state_count, transition_count, initial_state,
    bit_width, encoding_type, category_id,
    visibility, tags, created_by
) VALUES (
    'Vending Machine Controller',
    'FSM for coin-operated vending machine',
    'mealy',
    '{
        "type": "mealy",
        "states": [
            {"id": "S0", "label": "Idle", "encoding": "00"},
            {"id": "S1", "label": "5 cents", "encoding": "01"},
            {"id": "S2", "label": "10 cents", "encoding": "11"}
        ],
        "transitions": [
            {"id": "T0", "from": "S0", "to": "S1", "input": "nickel", "output": "dispense_nothing"},
            {"id": "T1", "from": "S1", "to": "S2", "input": "nickel", "output": "dispense_nothing"},
            {"id": "T2", "from": "S2", "to": "S0", "input": "nickel", "output": "dispense_item"}
        ],
        "initial_state": "S0"
    }'::jsonb,
    3, 3, 'S0',
    2, 'gray',
    '550e8400-e29b-41d4-a716-446655440001',
    'public',
    ARRAY['vending', 'machine', 'mealy'],
    NULL  -- Or specific user_id
)
RETURNING id, name, created_at;

-- ----------------------------------------------------------------
-- Read/Retrieve FSMs
-- ----------------------------------------------------------------

-- Get all public FSMs
SELECT id, name, description, fsm_type, state_count, created_at
FROM fsms
WHERE visibility = 'public'
ORDER BY created_at DESC
LIMIT 20;

-- Get FSM by ID with full details
SELECT *
FROM fsms
WHERE id = '550e8400-e29b-41d4-a716-446655440100';

-- Get FSM with category information
SELECT
    f.id, f.name, f.description, f.fsm_type,
    f.state_count, f.transition_count,
    c.name as category_name,
    c.slug as category_slug
FROM fsms f
LEFT JOIN categories c ON f.category_id = c.id
WHERE f.id = $1;

-- ----------------------------------------------------------------
-- Update FSM
-- ----------------------------------------------------------------

-- Update FSM metadata
UPDATE fsms
SET
    name = 'Updated Traffic Light Controller',
    description = 'Enhanced traffic light with pedestrian crossing',
    tags = ARRAY['traffic', 'controller', 'pedestrian'],
    updated_at = CURRENT_TIMESTAMP
WHERE id = $1
RETURNING id, name, updated_at;

-- Mark FSM as optimized
UPDATE fsms
SET
    is_optimized = TRUE,
    optimization_algorithm = 'greedy',
    dummy_state_count = 2,
    avg_hamming_distance = 1.0,
    optimization_improvement_pct = 33.5
WHERE id = $1;

-- Increment view count
UPDATE fsms
SET
    view_count = view_count + 1,
    last_accessed_at = CURRENT_TIMESTAMP
WHERE id = $1;

-- ----------------------------------------------------------------
-- Delete FSM
-- ----------------------------------------------------------------

-- Soft delete (if implementing soft deletes)
-- UPDATE fsms SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1;

-- Hard delete (cascades to related tables)
DELETE FROM fsms WHERE id = $1 RETURNING id;

-- ================================================================
-- SECTION 2: SEARCH AND FILTERING
-- ================================================================

-- ----------------------------------------------------------------
-- Full-Text Search
-- ----------------------------------------------------------------

-- Search FSMs by name and description
SELECT
    id, name, description, fsm_type, state_count,
    ts_rank(search_vector, query) AS rank
FROM fsms,
     to_tsquery('english', 'traffic & light') AS query
WHERE search_vector @@ query
    AND visibility = 'public'
ORDER BY rank DESC, view_count DESC
LIMIT 20;

-- Search with multiple terms (OR)
SELECT id, name, description
FROM fsms
WHERE search_vector @@ to_tsquery('english', 'traffic | vending | protocol')
    AND visibility = 'public'
ORDER BY view_count DESC
LIMIT 20;

-- ----------------------------------------------------------------
-- Filter by Category
-- ----------------------------------------------------------------

-- Get all FSMs in a specific category
SELECT f.id, f.name, f.state_count, f.created_at
FROM fsms f
JOIN categories c ON f.category_id = c.id
WHERE c.slug = 'controllers'
    AND f.visibility = 'public'
ORDER BY f.created_at DESC;

-- Get FSMs in category and subcategories
WITH RECURSIVE category_tree AS (
    SELECT id, name, parent_category_id
    FROM categories
    WHERE slug = 'controllers'

    UNION ALL

    SELECT c.id, c.name, c.parent_category_id
    FROM categories c
    INNER JOIN category_tree ct ON c.parent_category_id = ct.id
)
SELECT f.id, f.name, c.name as category
FROM fsms f
JOIN category_tree c ON f.category_id = c.id
WHERE f.visibility = 'public'
ORDER BY f.created_at DESC;

-- ----------------------------------------------------------------
-- Filter by Tags
-- ----------------------------------------------------------------

-- FSMs with specific tag
SELECT id, name, tags
FROM fsms
WHERE 'traffic' = ANY(tags)
    AND visibility = 'public';

-- FSMs with multiple tags (AND)
SELECT id, name, tags
FROM fsms
WHERE tags @> ARRAY['traffic', 'safety-critical']
    AND visibility = 'public';

-- FSMs with any of multiple tags (OR)
SELECT id, name, tags
FROM fsms
WHERE tags && ARRAY['traffic', 'vending', 'protocol']
    AND visibility = 'public';

-- ----------------------------------------------------------------
-- Advanced Filtering
-- ----------------------------------------------------------------

-- FSMs by state count range
SELECT id, name, state_count
FROM fsms
WHERE state_count BETWEEN 4 AND 10
    AND visibility = 'public'
ORDER BY state_count;

-- Optimized FSMs with high improvement
SELECT id, name, optimization_algorithm, optimization_improvement_pct
FROM fsms
WHERE is_optimized = TRUE
    AND optimization_improvement_pct > 25
    AND visibility = 'public'
ORDER BY optimization_improvement_pct DESC;

-- FSMs by type
SELECT id, name, fsm_type, state_count
FROM fsms
WHERE fsm_type = 'moore'
    AND visibility = 'public';

-- ================================================================
-- SECTION 3: AGGREGATIONS AND STATISTICS
-- ================================================================

-- ----------------------------------------------------------------
-- FSM Statistics
-- ----------------------------------------------------------------

-- Overall statistics
SELECT
    COUNT(*) as total_fsms,
    COUNT(*) FILTER (WHERE fsm_type = 'moore') as moore_count,
    COUNT(*) FILTER (WHERE fsm_type = 'mealy') as mealy_count,
    COUNT(*) FILTER (WHERE is_optimized = TRUE) as optimized_count,
    AVG(state_count) as avg_states,
    AVG(transition_count) as avg_transitions,
    AVG(dummy_state_count) FILTER (WHERE is_optimized = TRUE) as avg_dummy_states,
    SUM(view_count) as total_views
FROM fsms
WHERE visibility = 'public';

-- Statistics by category
SELECT
    c.name as category,
    COUNT(f.id) as fsm_count,
    AVG(f.state_count) as avg_states,
    AVG(f.view_count) as avg_views,
    MAX(f.created_at) as latest_fsm
FROM categories c
LEFT JOIN fsms f ON c.id = f.category_id AND f.visibility = 'public'
GROUP BY c.id, c.name
ORDER BY fsm_count DESC;

-- Statistics by FSM type
SELECT
    fsm_type,
    COUNT(*) as count,
    AVG(state_count) as avg_states,
    AVG(transition_count) as avg_transitions,
    AVG(optimization_improvement_pct) FILTER (WHERE is_optimized = TRUE) as avg_improvement
FROM fsms
WHERE visibility = 'public'
GROUP BY fsm_type;

-- ----------------------------------------------------------------
-- User Statistics (Phase 4)
-- ----------------------------------------------------------------

-- User activity summary
SELECT
    u.username,
    u.display_name,
    COUNT(f.id) as fsms_created,
    SUM(f.view_count) as total_views,
    SUM(f.fork_count) as total_forks,
    AVG(f.view_count) as avg_views_per_fsm
FROM users u
LEFT JOIN fsms f ON u.id = f.created_by
GROUP BY u.id, u.username, u.display_name
HAVING COUNT(f.id) > 0
ORDER BY total_views DESC
LIMIT 20;

-- ================================================================
-- SECTION 4: ALGORITHM RESULTS
-- ================================================================

-- ----------------------------------------------------------------
-- Store Algorithm Result
-- ----------------------------------------------------------------

INSERT INTO algorithm_results (
    original_fsm_id,
    optimized_fsm_id,
    algorithm,
    algorithm_version,
    algorithm_parameters,
    dummy_states_added,
    total_states_final,
    avg_hamming_before,
    avg_hamming_after,
    improvement_percentage,
    execution_time_ms,
    encoding_map,
    success
) VALUES (
    '550e8400-e29b-41d4-a716-446655440100',  -- original FSM
    '550e8400-e29b-41d4-a716-446655440101',  -- optimized FSM
    'greedy',
    '1.0.0',
    '{"timeout_ms": 5000}'::jsonb,
    2,  -- dummy states added
    6,  -- total states after optimization
    2.5,  -- avg hamming before
    1.0,  -- avg hamming after
    60.0,  -- improvement %
    145,  -- execution time
    '{"S0": "000", "S1": "001", "S2": "011"}'::jsonb,
    TRUE
)
RETURNING id, algorithm, improvement_percentage;

-- ----------------------------------------------------------------
-- Query Algorithm Results
-- ----------------------------------------------------------------

-- Get all results for an FSM
SELECT
    ar.algorithm,
    ar.dummy_states_added,
    ar.improvement_percentage,
    ar.execution_time_ms,
    ar.executed_at
FROM algorithm_results ar
WHERE ar.original_fsm_id = $1
    AND ar.success = TRUE
ORDER BY ar.improvement_percentage DESC;

-- Compare algorithms
SELECT
    ar.algorithm,
    COUNT(*) as execution_count,
    AVG(ar.dummy_states_added) as avg_dummy_states,
    AVG(ar.improvement_percentage) as avg_improvement,
    AVG(ar.execution_time_ms) as avg_execution_time,
    STDDEV(ar.improvement_percentage) as improvement_stddev
FROM algorithm_results ar
WHERE ar.success = TRUE
    AND ar.executed_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY ar.algorithm
ORDER BY avg_improvement DESC;

-- Best optimization result for each algorithm
SELECT DISTINCT ON (algorithm)
    algorithm,
    original_fsm_id,
    improvement_percentage,
    execution_time_ms,
    executed_at
FROM algorithm_results
WHERE success = TRUE
ORDER BY algorithm, improvement_percentage DESC;

-- ================================================================
-- SECTION 5: EXPORT CACHE OPERATIONS
-- ================================================================

-- ----------------------------------------------------------------
-- Store Export
-- ----------------------------------------------------------------

INSERT INTO export_cache (
    fsm_id,
    format,
    content,
    content_hash,
    template_version,
    file_size_bytes,
    expires_at
) VALUES (
    $1,  -- fsm_id
    'verilog',
    $2,  -- generated Verilog code
    encode(sha256($2::bytea), 'hex'),  -- SHA-256 hash
    '1.0.0',
    length($2),
    CURRENT_TIMESTAMP + INTERVAL '7 days'
)
ON CONFLICT (fsm_id, format, content_hash)
DO UPDATE SET
    last_accessed_at = CURRENT_TIMESTAMP,
    access_count = export_cache.access_count + 1
RETURNING id;

-- ----------------------------------------------------------------
-- Retrieve Export
-- ----------------------------------------------------------------

-- Get cached export
SELECT content, generated_at
FROM export_cache
WHERE fsm_id = $1
    AND format = 'verilog'
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
ORDER BY generated_at DESC
LIMIT 1;

-- Update access statistics
UPDATE export_cache
SET
    last_accessed_at = CURRENT_TIMESTAMP,
    access_count = access_count + 1
WHERE id = $1;

-- ----------------------------------------------------------------
-- Cache Maintenance
-- ----------------------------------------------------------------

-- Clean expired cache entries
DELETE FROM export_cache
WHERE expires_at < CURRENT_TIMESTAMP;

-- Get cache statistics
SELECT
    format,
    COUNT(*) as cached_items,
    SUM(file_size_bytes) as total_size_bytes,
    AVG(access_count) as avg_accesses,
    MIN(generated_at) as oldest_entry,
    MAX(last_accessed_at) as latest_access
FROM export_cache
WHERE expires_at > CURRENT_TIMESTAMP OR expires_at IS NULL
GROUP BY format;

-- ================================================================
-- SECTION 6: COMMUNITY FEATURES (Phase 4)
-- ================================================================

-- ----------------------------------------------------------------
-- Shares
-- ----------------------------------------------------------------

-- Create a share
INSERT INTO shares (
    fsm_id,
    shared_by,
    share_token,
    permission,
    is_public,
    max_views,
    expires_at,
    description
) VALUES (
    $1,  -- fsm_id
    $2,  -- user_id
    encode(gen_random_bytes(32), 'hex'),  -- random token
    'view',
    FALSE,
    100,  -- max 100 views
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    'Sharing with my team for review'
)
RETURNING id, share_token;

-- Get share by token
SELECT
    s.id,
    s.fsm_id,
    s.permission,
    s.view_count,
    s.max_views,
    s.expires_at,
    f.name as fsm_name,
    u.display_name as shared_by_name
FROM shares s
JOIN fsms f ON s.fsm_id = f.id
JOIN users u ON s.shared_by = u.id
WHERE s.share_token = $1
    AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
    AND (s.max_views IS NULL OR s.view_count < s.max_views);

-- Record share view
UPDATE shares
SET
    view_count = view_count + 1,
    last_accessed_at = CURRENT_TIMESTAMP
WHERE share_token = $1;

-- ----------------------------------------------------------------
-- Comments
-- ----------------------------------------------------------------

-- Add comment
INSERT INTO comments (
    fsm_id,
    user_id,
    content,
    content_html,
    parent_comment_id,
    thread_depth
) VALUES (
    $1,  -- fsm_id
    $2,  -- user_id
    'Great FSM! Very efficient encoding.',
    '<p>Great FSM! Very efficient encoding.</p>',
    NULL,  -- top-level comment
    0
)
RETURNING id, created_at;

-- Get comments for FSM (with user info)
SELECT
    c.id,
    c.content,
    c.created_at,
    c.upvote_count,
    c.downvote_count,
    c.parent_comment_id,
    u.username,
    u.display_name,
    u.avatar_url
FROM comments c
JOIN users u ON c.user_id = u.id
WHERE c.fsm_id = $1
    AND c.is_deleted = FALSE
ORDER BY c.created_at DESC;

-- Get comment thread
WITH RECURSIVE comment_tree AS (
    SELECT id, content, parent_comment_id, thread_depth, user_id, created_at
    FROM comments
    WHERE id = $1  -- root comment

    UNION ALL

    SELECT c.id, c.content, c.parent_comment_id, c.thread_depth, c.user_id, c.created_at
    FROM comments c
    INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
)
SELECT
    ct.*,
    u.username,
    u.display_name
FROM comment_tree ct
JOIN users u ON ct.user_id = u.id
ORDER BY ct.thread_depth, ct.created_at;

-- ----------------------------------------------------------------
-- Votes/Ratings
-- ----------------------------------------------------------------

-- Add vote
INSERT INTO votes (fsm_id, user_id, vote_type, value)
VALUES ($1, $2, 'favorite', 1)
ON CONFLICT (fsm_id, user_id, vote_type)
DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP
RETURNING id;

-- Add star rating
INSERT INTO votes (fsm_id, user_id, vote_type, value)
VALUES ($1, $2, 'star', 4)  -- 4 stars
ON CONFLICT (fsm_id, user_id, vote_type)
DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP;

-- Get aggregated ratings
SELECT
    fsm_id,
    COUNT(*) FILTER (WHERE vote_type = 'favorite') as favorites,
    COUNT(*) FILTER (WHERE vote_type = 'upvote') as upvotes,
    COUNT(*) FILTER (WHERE vote_type = 'downvote') as downvotes,
    AVG(value) FILTER (WHERE vote_type = 'star') as avg_rating,
    COUNT(*) FILTER (WHERE vote_type = 'star') as rating_count
FROM votes
WHERE fsm_id = $1
GROUP BY fsm_id;

-- ================================================================
-- SECTION 7: COMPLEX QUERIES
-- ================================================================

-- ----------------------------------------------------------------
-- Trending FSMs
-- ----------------------------------------------------------------

-- Most popular FSMs (last 7 days)
WITH recent_activity AS (
    SELECT
        entity_id as fsm_id,
        COUNT(*) as recent_views
    FROM activity_log
    WHERE activity_type = 'fsm_viewed'
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
    GROUP BY entity_id
),
favorites AS (
    SELECT
        fsm_id,
        COUNT(*) as favorite_count
    FROM votes
    WHERE vote_type = 'favorite'
    GROUP BY fsm_id
)
SELECT
    f.id,
    f.name,
    f.description,
    f.state_count,
    f.view_count as total_views,
    COALESCE(ra.recent_views, 0) as recent_views,
    COALESCE(fav.favorite_count, 0) as favorites,
    (
        COALESCE(ra.recent_views, 0) * 2 +
        f.view_count * 0.5 +
        COALESCE(fav.favorite_count, 0) * 5
    ) as trending_score
FROM fsms f
LEFT JOIN recent_activity ra ON f.id = ra.fsm_id
LEFT JOIN favorites fav ON f.id = fav.fsm_id
WHERE f.visibility = 'public'
ORDER BY trending_score DESC
LIMIT 10;

-- ----------------------------------------------------------------
-- Similar FSMs
-- ----------------------------------------------------------------

-- Find FSMs with similar characteristics
SELECT
    f2.id,
    f2.name,
    f2.state_count,
    f2.transition_count,
    ABS(f2.state_count - f1.state_count) +
    ABS(f2.transition_count - f1.transition_count) as similarity_distance
FROM fsms f1
CROSS JOIN fsms f2
WHERE f1.id = $1
    AND f2.id != f1.id
    AND f2.visibility = 'public'
    AND f2.fsm_type = f1.fsm_type
    AND ABS(f2.state_count - f1.state_count) <= 3
    AND ABS(f2.transition_count - f1.transition_count) <= 5
ORDER BY similarity_distance ASC
LIMIT 10;

-- ----------------------------------------------------------------
-- User Dashboard
-- ----------------------------------------------------------------

-- Complete user dashboard data
SELECT
    f.id,
    f.name,
    f.fsm_type,
    f.state_count,
    f.is_optimized,
    f.view_count,
    f.fork_count,
    f.created_at,
    f.updated_at,
    (SELECT COUNT(*) FROM comments WHERE fsm_id = f.id) as comment_count,
    (SELECT COUNT(*) FROM votes WHERE fsm_id = f.id AND vote_type = 'favorite') as favorite_count,
    (SELECT AVG(value) FROM votes WHERE fsm_id = f.id AND vote_type = 'star') as avg_rating
FROM fsms f
WHERE f.created_by = $1
ORDER BY f.updated_at DESC
LIMIT 50;

-- ----------------------------------------------------------------
-- Algorithm Performance Benchmark
-- ----------------------------------------------------------------

-- Comprehensive algorithm comparison
SELECT
    ar.algorithm,
    COUNT(*) as total_runs,
    COUNT(*) FILTER (WHERE ar.success = TRUE) as successful_runs,
    AVG(ar.dummy_states_added) FILTER (WHERE ar.success = TRUE) as avg_dummy_states,
    STDDEV(ar.dummy_states_added) FILTER (WHERE ar.success = TRUE) as stddev_dummy_states,
    AVG(ar.improvement_percentage) FILTER (WHERE ar.success = TRUE) as avg_improvement,
    MIN(ar.improvement_percentage) FILTER (WHERE ar.success = TRUE) as min_improvement,
    MAX(ar.improvement_percentage) FILTER (WHERE ar.success = TRUE) as max_improvement,
    AVG(ar.execution_time_ms) FILTER (WHERE ar.success = TRUE) as avg_execution_time,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ar.execution_time_ms) FILTER (WHERE ar.success = TRUE) as median_execution_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ar.execution_time_ms) FILTER (WHERE ar.success = TRUE) as p95_execution_time
FROM algorithm_results ar
WHERE ar.executed_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY ar.algorithm
ORDER BY avg_improvement DESC;

-- ================================================================
-- SECTION 8: MAINTENANCE QUERIES
-- ================================================================

-- ----------------------------------------------------------------
-- Database Cleanup
-- ----------------------------------------------------------------

-- Remove orphaned exports
DELETE FROM export_cache
WHERE fsm_id NOT IN (SELECT id FROM fsms);

-- Remove old activity logs (keep last 90 days)
DELETE FROM activity_log
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';

-- ----------------------------------------------------------------
-- Performance Analysis
-- ----------------------------------------------------------------

-- Find slow queries (requires pg_stat_statements extension)
-- SELECT query, calls, total_time, mean_time
-- FROM pg_stat_statements
-- ORDER BY mean_time DESC
-- LIMIT 10;

-- Table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage statistics
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ----------------------------------------------------------------
-- Refresh Materialized Views
-- ----------------------------------------------------------------

-- Refresh trending FSMs
REFRESH MATERIALIZED VIEW CONCURRENTLY trending_fsms;

-- Refresh category statistics
REFRESH MATERIALIZED VIEW CONCURRENTLY category_statistics;

-- ================================================================
-- SECTION 9: ANALYTICS QUERIES
-- ================================================================

-- FSM creation over time
SELECT
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as fsms_created
FROM fsms
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND visibility = 'public'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date;

-- Most active users
SELECT
    u.username,
    u.display_name,
    COUNT(DISTINCT f.id) as fsms_created,
    COUNT(DISTINCT c.id) as comments_made,
    COUNT(DISTINCT v.id) as votes_cast
FROM users u
LEFT JOIN fsms f ON u.id = f.created_by
LEFT JOIN comments c ON u.id = c.user_id
LEFT JOIN votes v ON u.id = v.user_id
WHERE u.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY u.id, u.username, u.display_name
ORDER BY fsms_created DESC
LIMIT 20;

-- Algorithm adoption rates
SELECT
    optimization_algorithm,
    COUNT(*) as usage_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM fsms
WHERE is_optimized = TRUE
GROUP BY optimization_algorithm
ORDER BY usage_count DESC;

-- ================================================================
-- END OF QUERIES
-- ================================================================
