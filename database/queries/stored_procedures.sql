-- ================================================================
-- GrayFSM Stored Procedures and Functions
-- Optimized database-level logic for common operations
-- ================================================================

-- ================================================================
-- UTILITY FUNCTIONS
-- ================================================================

-- ----------------------------------------------------------------
-- Function: Increment FSM View Count
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_fsm_view_count(
    p_fsm_id UUID
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE fsms
    SET view_count = view_count + 1,
        last_accessed_at = CURRENT_TIMESTAMP
    WHERE id = p_fsm_id;

    -- Log activity
    INSERT INTO activity_log (
        activity_type,
        entity_type,
        entity_id,
        description
    ) VALUES (
        'fsm_viewed',
        'fsm',
        p_fsm_id,
        'FSM viewed'
    );
END;
$$;

COMMENT ON FUNCTION increment_fsm_view_count IS 'Atomically increment FSM view count and log activity';

-- ----------------------------------------------------------------
-- Function: Create Share Link
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_share_link(
    p_fsm_id UUID,
    p_shared_by UUID,
    p_permission share_permission DEFAULT 'view',
    p_is_public BOOLEAN DEFAULT FALSE,
    p_expires_in_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    share_id UUID,
    share_token VARCHAR(64),
    share_url TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_share_id UUID;
    v_token VARCHAR(64);
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Generate unique token
    v_token := encode(gen_random_bytes(32), 'hex');

    -- Calculate expiration
    IF p_expires_in_days > 0 THEN
        v_expires_at := CURRENT_TIMESTAMP + (p_expires_in_days || ' days')::INTERVAL;
    END IF;

    -- Insert share record
    INSERT INTO shares (
        fsm_id,
        shared_by,
        share_token,
        permission,
        is_public,
        expires_at
    ) VALUES (
        p_fsm_id,
        p_shared_by,
        v_token,
        p_permission,
        p_is_public,
        v_expires_at
    ) RETURNING id INTO v_share_id;

    -- Return share information
    RETURN QUERY
    SELECT
        v_share_id,
        v_token,
        'https://grayfsm.com/share/' || v_token AS share_url;
END;
$$;

COMMENT ON FUNCTION create_share_link IS 'Create a shareable link for an FSM';

-- ----------------------------------------------------------------
-- Function: Get FSM with Full Details
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_fsm_details(p_fsm_id UUID)
RETURNS TABLE (
    fsm_id UUID,
    fsm_name VARCHAR(255),
    fsm_description TEXT,
    fsm_type fsm_type,
    fsm_definition JSONB,
    state_count INTEGER,
    transition_count INTEGER,
    is_optimized BOOLEAN,
    optimization_algorithm VARCHAR(100),
    dummy_state_count INTEGER,
    category_name VARCHAR(100),
    category_slug VARCHAR(100),
    author_name VARCHAR(100),
    view_count INTEGER,
    fork_count INTEGER,
    favorite_count BIGINT,
    avg_rating NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id,
        f.name,
        f.description,
        f.fsm_type,
        f.definition,
        f.state_count,
        f.transition_count,
        f.is_optimized,
        f.optimization_algorithm,
        f.dummy_state_count,
        c.name,
        c.slug,
        u.display_name,
        f.view_count,
        f.fork_count,
        (SELECT COUNT(*) FROM votes v WHERE v.fsm_id = f.id AND v.vote_type = 'favorite'),
        (SELECT AVG(value) FROM votes v WHERE v.fsm_id = f.id AND v.vote_type = 'star'),
        f.created_at,
        f.updated_at
    FROM fsms f
    LEFT JOIN categories c ON f.category_id = c.id
    LEFT JOIN users u ON f.created_by = u.id
    WHERE f.id = p_fsm_id;
END;
$$;

COMMENT ON FUNCTION get_fsm_details IS 'Get complete FSM details with category, author, and statistics';

-- ================================================================
-- FSM OPERATIONS
-- ================================================================

-- ----------------------------------------------------------------
-- Function: Fork FSM
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fork_fsm(
    p_source_fsm_id UUID,
    p_new_name VARCHAR(255),
    p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_fsm_id UUID;
    v_source_fsm RECORD;
BEGIN
    -- Get source FSM
    SELECT * INTO v_source_fsm
    FROM fsms
    WHERE id = p_source_fsm_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source FSM not found: %', p_source_fsm_id;
    END IF;

    -- Create forked FSM
    INSERT INTO fsms (
        name,
        description,
        fsm_type,
        definition,
        state_count,
        transition_count,
        initial_state,
        bit_width,
        encoding_type,
        category_id,
        tags,
        parent_fsm_id,
        created_by,
        visibility
    ) VALUES (
        p_new_name,
        'Forked from: ' || v_source_fsm.name || E'\n\n' || COALESCE(v_source_fsm.description, ''),
        v_source_fsm.fsm_type,
        v_source_fsm.definition,
        v_source_fsm.state_count,
        v_source_fsm.transition_count,
        v_source_fsm.initial_state,
        v_source_fsm.bit_width,
        v_source_fsm.encoding_type,
        v_source_fsm.category_id,
        v_source_fsm.tags,
        p_source_fsm_id,
        p_created_by,
        'private'
    ) RETURNING id INTO v_new_fsm_id;

    -- Increment fork count on source FSM
    UPDATE fsms
    SET fork_count = fork_count + 1
    WHERE id = p_source_fsm_id;

    -- Log activity
    INSERT INTO activity_log (
        user_id,
        activity_type,
        entity_type,
        entity_id,
        description,
        metadata
    ) VALUES (
        p_created_by,
        'fsm_created',
        'fsm',
        v_new_fsm_id,
        'FSM forked',
        jsonb_build_object('source_fsm_id', p_source_fsm_id)
    );

    RETURN v_new_fsm_id;
END;
$$;

COMMENT ON FUNCTION fork_fsm IS 'Create a copy (fork) of an existing FSM';

-- ----------------------------------------------------------------
-- Function: Record Algorithm Result
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_algorithm_result(
    p_original_fsm_id UUID,
    p_optimized_fsm_id UUID,
    p_algorithm algorithm_name,
    p_dummy_states_added INTEGER,
    p_avg_hamming_before DECIMAL(5,2),
    p_avg_hamming_after DECIMAL(5,2),
    p_execution_time_ms BIGINT,
    p_encoding_map JSONB,
    p_executed_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_result_id UUID;
    v_improvement_pct DECIMAL(5,2);
    v_total_states INTEGER;
BEGIN
    -- Calculate improvement percentage
    IF p_avg_hamming_before > 0 THEN
        v_improvement_pct := ((p_avg_hamming_before - p_avg_hamming_after) / p_avg_hamming_before) * 100;
    ELSE
        v_improvement_pct := 0;
    END IF;

    -- Get total states from optimized FSM
    SELECT state_count INTO v_total_states
    FROM fsms
    WHERE id = p_optimized_fsm_id;

    -- Insert algorithm result
    INSERT INTO algorithm_results (
        original_fsm_id,
        optimized_fsm_id,
        algorithm,
        dummy_states_added,
        total_states_final,
        avg_hamming_before,
        avg_hamming_after,
        improvement_percentage,
        execution_time_ms,
        encoding_map,
        success,
        executed_by
    ) VALUES (
        p_original_fsm_id,
        p_optimized_fsm_id,
        p_algorithm,
        p_dummy_states_added,
        v_total_states,
        p_avg_hamming_before,
        p_avg_hamming_after,
        v_improvement_pct,
        p_execution_time_ms,
        p_encoding_map,
        TRUE,
        p_executed_by
    ) RETURNING id INTO v_result_id;

    -- Update optimized FSM metadata
    UPDATE fsms
    SET
        optimization_improvement_pct = v_improvement_pct,
        avg_hamming_distance = p_avg_hamming_after
    WHERE id = p_optimized_fsm_id;

    -- Log activity
    INSERT INTO activity_log (
        user_id,
        activity_type,
        entity_type,
        entity_id,
        description,
        metadata
    ) VALUES (
        p_executed_by,
        'fsm_optimized',
        'fsm',
        p_optimized_fsm_id,
        'FSM optimized',
        jsonb_build_object(
            'algorithm', p_algorithm,
            'improvement', v_improvement_pct,
            'execution_time_ms', p_execution_time_ms
        )
    );

    RETURN v_result_id;
END;
$$;

COMMENT ON FUNCTION record_algorithm_result IS 'Record optimization algorithm result and update FSM metrics';

-- ================================================================
-- SEARCH AND DISCOVERY
-- ================================================================

-- ----------------------------------------------------------------
-- Function: Search FSMs
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_fsms(
    p_query TEXT,
    p_category_slug VARCHAR(100) DEFAULT NULL,
    p_fsm_type fsm_type DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    fsm_id UUID,
    fsm_name VARCHAR(255),
    fsm_description TEXT,
    fsm_type fsm_type,
    state_count INTEGER,
    view_count INTEGER,
    rank REAL,
    category_name VARCHAR(100)
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id,
        f.name,
        f.description,
        f.fsm_type,
        f.state_count,
        f.view_count,
        ts_rank(f.search_vector, to_tsquery('english', p_query)) AS rank,
        c.name
    FROM fsms f
    LEFT JOIN categories c ON f.category_id = c.id
    WHERE f.search_vector @@ to_tsquery('english', p_query)
        AND f.visibility IN ('public', 'example')
        AND (p_category_slug IS NULL OR c.slug = p_category_slug)
        AND (p_fsm_type IS NULL OR f.fsm_type = p_fsm_type)
    ORDER BY rank DESC, f.view_count DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_fsms IS 'Full-text search for FSMs with optional filters';

-- ----------------------------------------------------------------
-- Function: Get Similar FSMs
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_similar_fsms(
    p_fsm_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    similar_fsm_id UUID,
    similar_fsm_name VARCHAR(255),
    state_count INTEGER,
    transition_count INTEGER,
    similarity_score INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_source_fsm RECORD;
BEGIN
    -- Get source FSM characteristics
    SELECT
        fsm_type,
        state_count,
        transition_count,
        category_id
    INTO v_source_fsm
    FROM fsms
    WHERE id = p_fsm_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'FSM not found: %', p_fsm_id;
    END IF;

    -- Find similar FSMs
    RETURN QUERY
    SELECT
        f.id,
        f.name,
        f.state_count,
        f.transition_count,
        (
            10 - (ABS(f.state_count - v_source_fsm.state_count) +
                  ABS(f.transition_count - v_source_fsm.transition_count))
        )::INTEGER AS similarity_score
    FROM fsms f
    WHERE f.id != p_fsm_id
        AND f.visibility = 'public'
        AND f.fsm_type = v_source_fsm.fsm_type
        AND ABS(f.state_count - v_source_fsm.state_count) <= 3
        AND ABS(f.transition_count - v_source_fsm.transition_count) <= 5
    ORDER BY similarity_score DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_similar_fsms IS 'Find FSMs similar to a given FSM based on structure';

-- ================================================================
-- STATISTICS AND ANALYTICS
-- ================================================================

-- ----------------------------------------------------------------
-- Function: Get User Statistics
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_statistics(p_user_id UUID)
RETURNS TABLE (
    total_fsms_created BIGINT,
    total_views BIGINT,
    total_forks BIGINT,
    total_exports BIGINT,
    total_optimizations BIGINT,
    avg_views_per_fsm NUMERIC,
    most_viewed_fsm_id UUID,
    most_viewed_fsm_name VARCHAR(255),
    most_viewed_fsm_views INTEGER,
    recent_activity_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH user_fsms AS (
        SELECT * FROM fsms WHERE created_by = p_user_id
    ),
    most_viewed AS (
        SELECT id, name, view_count
        FROM user_fsms
        ORDER BY view_count DESC
        LIMIT 1
    )
    SELECT
        COUNT(*)::BIGINT AS total_fsms,
        COALESCE(SUM(view_count), 0)::BIGINT AS total_views,
        COALESCE(SUM(fork_count), 0)::BIGINT AS total_forks,
        COALESCE(SUM(export_count), 0)::BIGINT AS total_exports,
        (SELECT COUNT(*)::BIGINT FROM algorithm_results WHERE executed_by = p_user_id) AS total_optimizations,
        COALESCE(AVG(view_count), 0)::NUMERIC AS avg_views_per_fsm,
        mv.id AS most_viewed_fsm_id,
        mv.name AS most_viewed_fsm_name,
        mv.view_count AS most_viewed_fsm_views,
        (SELECT COUNT(*)::BIGINT FROM activity_log
         WHERE user_id = p_user_id
         AND created_at > CURRENT_TIMESTAMP - INTERVAL '7 days') AS recent_activity
    FROM user_fsms
    CROSS JOIN most_viewed mv;
END;
$$;

COMMENT ON FUNCTION get_user_statistics IS 'Get comprehensive statistics for a user';

-- ----------------------------------------------------------------
-- Function: Get Algorithm Comparison
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION compare_algorithms(
    p_original_fsm_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    algorithm algorithm_name,
    run_count BIGINT,
    success_rate NUMERIC,
    avg_dummy_states NUMERIC,
    avg_improvement NUMERIC,
    avg_execution_time_ms NUMERIC,
    median_execution_time_ms NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ar.algorithm,
        COUNT(*)::BIGINT AS run_count,
        (COUNT(*) FILTER (WHERE ar.success = TRUE)::NUMERIC /
         NULLIF(COUNT(*), 0) * 100) AS success_rate,
        AVG(ar.dummy_states_added) FILTER (WHERE ar.success = TRUE) AS avg_dummy_states,
        AVG(ar.improvement_percentage) FILTER (WHERE ar.success = TRUE) AS avg_improvement,
        AVG(ar.execution_time_ms) FILTER (WHERE ar.success = TRUE) AS avg_execution_time,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ar.execution_time_ms)
            FILTER (WHERE ar.success = TRUE) AS median_execution_time
    FROM algorithm_results ar
    WHERE (p_original_fsm_id IS NULL OR ar.original_fsm_id = p_original_fsm_id)
        AND ar.executed_at > CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
    GROUP BY ar.algorithm
    ORDER BY avg_improvement DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION compare_algorithms IS 'Compare optimization algorithm performance';

-- ================================================================
-- MAINTENANCE PROCEDURES
-- ================================================================

-- ----------------------------------------------------------------
-- Procedure: Update Category FSM Counts
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE update_category_counts()
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE categories c
    SET fsm_count = (
        SELECT COUNT(*)
        FROM fsms f
        WHERE f.category_id = c.id
        AND f.visibility IN ('public', 'example')
    );

    RAISE NOTICE 'Category counts updated successfully';
END;
$$;

COMMENT ON PROCEDURE update_category_counts IS 'Update denormalized FSM counts in categories table';

-- ----------------------------------------------------------------
-- Procedure: Clean Old Activity Logs
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE clean_old_activity_logs(p_retention_days INTEGER DEFAULT 90)
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM activity_log
    WHERE created_at < CURRENT_TIMESTAMP - (p_retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RAISE NOTICE 'Deleted % old activity log records', v_deleted_count;
END;
$$;

COMMENT ON PROCEDURE clean_old_activity_logs IS 'Remove activity logs older than retention period';

-- ================================================================
-- GRANTS (adjust for your roles)
-- ================================================================

-- Grant execute permissions to application role
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO grayfsm_app;
-- GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO grayfsm_app;
