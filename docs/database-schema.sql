-- ================================================================
-- GrayFSM Database Schema - PostgreSQL Implementation
-- Version: 1.0
-- Date: November 2025
-- ================================================================

-- ================================================================
-- EXTENSIONS AND TYPES
-- ================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Custom ENUM types
CREATE TYPE fsm_type AS ENUM ('moore', 'mealy');
CREATE TYPE fsm_visibility AS ENUM ('private', 'public', 'unlisted', 'example');
CREATE TYPE algorithm_name AS ENUM (
    'greedy',
    'bfs_optimal',
    'global_sa',
    'global_ga',
    'hybrid',
    'ml_predicted',
    'custom'
);
CREATE TYPE export_format AS ENUM ('verilog', 'vhdl', 'json', 'csv', 'graphviz', 'testbench');
CREATE TYPE user_role AS ENUM ('guest', 'user', 'premium', 'educator', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE share_permission AS ENUM ('view', 'comment', 'edit', 'admin');
CREATE TYPE vote_type AS ENUM ('upvote', 'downvote', 'favorite', 'star');
CREATE TYPE activity_type AS ENUM (
    'fsm_created',
    'fsm_updated',
    'fsm_deleted',
    'fsm_optimized',
    'fsm_shared',
    'fsm_exported',
    'fsm_viewed',
    'comment_added',
    'vote_cast',
    'user_login',
    'user_logout'
);

-- ================================================================
-- UTILITY FUNCTIONS
-- ================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get current user ID (for row-level security)
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true)::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ================================================================
-- PHASE 1: CORE TABLES (MVP)
-- ================================================================

-- ----------------------------------------------------------------
-- Categories Table
-- ----------------------------------------------------------------
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Category Information
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),

    -- Hierarchy
    parent_category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 0 CHECK (level >= 0),
    full_path VARCHAR(500),

    -- Display
    display_order INTEGER DEFAULT 0,
    color VARCHAR(20),

    -- Statistics (denormalized for performance)
    fsm_count INTEGER DEFAULT 0 CHECK (fsm_count >= 0),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_parent ON categories(parent_category_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_level ON categories(level);
CREATE INDEX idx_categories_display_order ON categories(display_order);

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE categories IS 'Hierarchical categorization system for FSMs';

-- ----------------------------------------------------------------
-- Users Table (Phase 4, but create early for foreign keys)
-- ----------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Authentication
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,

    -- Profile
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    website VARCHAR(255),
    location VARCHAR(100),

    -- Role and Status
    role user_role DEFAULT 'user',
    status user_status DEFAULT 'active',

    -- Preferences (stored as JSON)
    preferences JSONB DEFAULT '{}',

    -- Statistics
    fsms_created INTEGER DEFAULT 0,
    fsms_shared INTEGER DEFAULT 0,
    total_optimizations INTEGER DEFAULT 0,

    -- API Access
    api_key VARCHAR(64) UNIQUE,
    api_key_created_at TIMESTAMP WITH TIME ZONE,
    api_rate_limit INTEGER DEFAULT 100 CHECK (api_rate_limit > 0),

    -- OAuth
    github_id VARCHAR(100) UNIQUE,
    google_id VARCHAR(100) UNIQUE,

    -- Security
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    failed_login_attempts INTEGER DEFAULT 0 CHECK (failed_login_attempts >= 0),
    locked_until TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
    CONSTRAINT valid_username CHECK (char_length(username) >= 3 AND char_length(username) <= 50)
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_api_key ON users(api_key);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_github_id ON users(github_id) WHERE github_id IS NOT NULL;
CREATE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'User accounts and authentication (Phase 4)';

-- ----------------------------------------------------------------
-- FSMs Table (Primary Entity)
-- ----------------------------------------------------------------
CREATE TABLE fsms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    fsm_type fsm_type NOT NULL,

    -- FSM Definition (complete structure as JSON)
    definition JSONB NOT NULL,

    -- Metadata
    state_count INTEGER NOT NULL CHECK (state_count > 0),
    transition_count INTEGER NOT NULL CHECK (transition_count >= 0),
    initial_state VARCHAR(100) NOT NULL,

    -- Encoding Information
    bit_width INTEGER NOT NULL CHECK (bit_width > 0),
    encoding_type VARCHAR(50) DEFAULT 'binary',

    -- Classification
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    tags TEXT[],

    -- Version Control
    version INTEGER DEFAULT 1 CHECK (version > 0),
    parent_fsm_id UUID REFERENCES fsms(id) ON DELETE SET NULL,

    -- Ownership
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    visibility fsm_visibility DEFAULT 'private',

    -- Optimization Status
    is_optimized BOOLEAN DEFAULT FALSE,
    optimization_algorithm VARCHAR(100),
    dummy_state_count INTEGER DEFAULT 0 CHECK (dummy_state_count >= 0),

    -- Performance Metrics
    avg_hamming_distance DECIMAL(5,2),
    max_hamming_distance INTEGER,
    optimization_improvement_pct DECIMAL(5,2),

    -- Usage Statistics
    view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),
    fork_count INTEGER DEFAULT 0 CHECK (fork_count >= 0),
    export_count INTEGER DEFAULT 0 CHECK (export_count >= 0),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Full-Text Search
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
    ) STORED,

    -- Constraints
    CONSTRAINT valid_definition CHECK (jsonb_typeof(definition) = 'object'),
    CONSTRAINT valid_optimization CHECK (
        (is_optimized = FALSE AND optimization_algorithm IS NULL) OR
        (is_optimized = TRUE AND optimization_algorithm IS NOT NULL)
    ),
    CONSTRAINT valid_hamming CHECK (
        avg_hamming_distance IS NULL OR
        (avg_hamming_distance >= 0 AND avg_hamming_distance <= bit_width)
    )
);

-- Indexes for common queries
CREATE INDEX idx_fsms_type ON fsms(fsm_type);
CREATE INDEX idx_fsms_category ON fsms(category_id);
CREATE INDEX idx_fsms_created_by ON fsms(created_by);
CREATE INDEX idx_fsms_visibility ON fsms(visibility);
CREATE INDEX idx_fsms_is_optimized ON fsms(is_optimized);
CREATE INDEX idx_fsms_created_at ON fsms(created_at DESC);
CREATE INDEX idx_fsms_updated_at ON fsms(updated_at DESC);
CREATE INDEX idx_fsms_view_count ON fsms(view_count DESC);
CREATE INDEX idx_fsms_tags ON fsms USING GIN(tags);
CREATE INDEX idx_fsms_definition ON fsms USING GIN(definition);
CREATE INDEX idx_fsms_search ON fsms USING GIN(search_vector);

-- Partial indexes for specific queries
CREATE INDEX idx_fsms_public_optimized ON fsms(created_at DESC)
    WHERE visibility = 'public' AND is_optimized = TRUE;

CREATE INDEX idx_fsms_examples ON fsms(category_id, created_at DESC)
    WHERE visibility = 'example';

-- Composite index for user FSMs
CREATE INDEX idx_fsms_user_fsms ON fsms(created_by, updated_at DESC)
    WHERE created_by IS NOT NULL;

CREATE TRIGGER update_fsms_updated_at BEFORE UPDATE ON fsms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE fsms IS 'Primary table storing FSM definitions and metadata';
COMMENT ON COLUMN fsms.definition IS 'Complete FSM structure stored as JSONB';
COMMENT ON COLUMN fsms.search_vector IS 'Generated full-text search vector';

-- ----------------------------------------------------------------
-- States Table (Optional - Normalized storage)
-- ----------------------------------------------------------------
CREATE TABLE states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,

    -- State Identification
    state_id VARCHAR(100) NOT NULL,
    label VARCHAR(255),

    -- Encoding
    binary_encoding VARCHAR(20),
    gray_encoding VARCHAR(20),

    -- Moore Machine Output
    output_value VARCHAR(100),

    -- Dummy State Flag
    is_dummy BOOLEAN DEFAULT FALSE,
    inserted_for VARCHAR(255),

    -- Visual Properties
    position_x DECIMAL(10,2),
    position_y DECIMAL(10,2),
    color VARCHAR(20),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_state_per_fsm UNIQUE(fsm_id, state_id),
    CONSTRAINT valid_state_id CHECK (char_length(state_id) > 0)
);

CREATE INDEX idx_states_fsm_id ON states(fsm_id);
CREATE INDEX idx_states_is_dummy ON states(is_dummy);
CREATE INDEX idx_states_state_id ON states(state_id);

COMMENT ON TABLE states IS 'Normalized storage of individual states (optional)';

-- ----------------------------------------------------------------
-- Transitions Table (Optional - Normalized storage)
-- ----------------------------------------------------------------
CREATE TABLE transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,

    -- Transition Definition
    from_state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
    to_state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,

    -- Logical Transition Info
    input_value VARCHAR(100),
    output_value VARCHAR(100),
    label VARCHAR(255),

    -- Analysis
    hamming_distance INTEGER CHECK (hamming_distance >= 0),
    requires_dummy BOOLEAN DEFAULT FALSE,

    -- Priority/Weight
    weight DECIMAL(10,2) DEFAULT 1.0 CHECK (weight > 0),
    priority INTEGER DEFAULT 0,

    -- Path Through Dummy States
    path_state_ids UUID[],

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT no_self_loop_without_input CHECK (
        from_state_id != to_state_id OR input_value IS NOT NULL
    )
);

CREATE INDEX idx_transitions_fsm_id ON transitions(fsm_id);
CREATE INDEX idx_transitions_from_state ON transitions(from_state_id);
CREATE INDEX idx_transitions_to_state ON transitions(to_state_id);
CREATE INDEX idx_transitions_requires_dummy ON transitions(requires_dummy);
CREATE INDEX idx_transitions_hamming ON transitions(hamming_distance);

COMMENT ON TABLE transitions IS 'Normalized storage of transitions between states';

-- ----------------------------------------------------------------
-- Algorithm Results Table
-- ----------------------------------------------------------------
CREATE TABLE algorithm_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to Original FSM
    original_fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,
    optimized_fsm_id UUID REFERENCES fsms(id) ON DELETE SET NULL,

    -- Algorithm Information
    algorithm algorithm_name NOT NULL,
    algorithm_version VARCHAR(50),
    algorithm_parameters JSONB,

    -- Results
    dummy_states_added INTEGER NOT NULL DEFAULT 0 CHECK (dummy_states_added >= 0),
    total_states_final INTEGER NOT NULL CHECK (total_states_final > 0),
    transitions_modified INTEGER DEFAULT 0 CHECK (transitions_modified >= 0),

    -- Quality Metrics
    avg_hamming_before DECIMAL(5,2),
    avg_hamming_after DECIMAL(5,2),
    max_hamming_before INTEGER,
    max_hamming_after INTEGER,
    improvement_percentage DECIMAL(5,2),

    -- Performance Metrics
    execution_time_ms BIGINT NOT NULL CHECK (execution_time_ms >= 0),
    memory_used_mb DECIMAL(10,2),
    cpu_utilization_pct DECIMAL(5,2),

    -- Encoding Information
    encoding_strategy VARCHAR(100),
    encoding_map JSONB,

    -- Success/Error
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,

    -- Metadata
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_by UUID REFERENCES users(id) ON DELETE SET NULL,

    CONSTRAINT valid_improvement CHECK (
        improvement_percentage >= -100 AND improvement_percentage <= 100
    ),
    CONSTRAINT valid_hamming_improvement CHECK (
        avg_hamming_after IS NULL OR avg_hamming_before IS NULL OR
        avg_hamming_after <= avg_hamming_before
    )
);

CREATE INDEX idx_algorithm_results_original_fsm ON algorithm_results(original_fsm_id);
CREATE INDEX idx_algorithm_results_optimized_fsm ON algorithm_results(optimized_fsm_id);
CREATE INDEX idx_algorithm_results_algorithm ON algorithm_results(algorithm);
CREATE INDEX idx_algorithm_results_success ON algorithm_results(success);
CREATE INDEX idx_algorithm_results_improvement ON algorithm_results(improvement_percentage DESC);
CREATE INDEX idx_algorithm_results_execution_time ON algorithm_results(execution_time_ms);
CREATE INDEX idx_algorithm_results_executed_at ON algorithm_results(executed_at DESC);

-- Composite index for comparison queries
CREATE INDEX idx_algorithm_results_comparison
    ON algorithm_results(original_fsm_id, algorithm, improvement_percentage DESC)
    WHERE success = TRUE;

COMMENT ON TABLE algorithm_results IS 'Optimization results and algorithm performance metrics';

-- ----------------------------------------------------------------
-- Export Cache Table
-- ----------------------------------------------------------------
CREATE TABLE export_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,

    -- Export Information
    format export_format NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,

    -- Generation Info
    template_version VARCHAR(50),
    generation_options JSONB,

    -- Cache Management
    file_size_bytes INTEGER CHECK (file_size_bytes > 0),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0 CHECK (access_count >= 0),

    -- TTL
    expires_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT unique_export_cache UNIQUE(fsm_id, format, content_hash),
    CONSTRAINT valid_expiry CHECK (
        expires_at IS NULL OR expires_at > generated_at
    )
);

CREATE INDEX idx_export_cache_fsm_id ON export_cache(fsm_id);
CREATE INDEX idx_export_cache_format ON export_cache(format);
CREATE INDEX idx_export_cache_expires ON export_cache(expires_at);
CREATE INDEX idx_export_cache_hash ON export_cache(content_hash);

COMMENT ON TABLE export_cache IS 'Cached HDL exports for performance optimization';

-- ================================================================
-- PHASE 4: COMMUNITY TABLES
-- ================================================================

-- ----------------------------------------------------------------
-- Shares Table
-- ----------------------------------------------------------------
CREATE TABLE shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Access Control
    share_token VARCHAR(64) NOT NULL UNIQUE,
    permission share_permission DEFAULT 'view',

    -- Visibility
    is_public BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255),

    -- Restrictions
    max_views INTEGER,
    view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_expiry CHECK (
        expires_at IS NULL OR expires_at > created_at
    ),
    CONSTRAINT valid_view_limit CHECK (
        max_views IS NULL OR max_views > 0
    ),
    CONSTRAINT view_limit_not_exceeded CHECK (
        max_views IS NULL OR view_count <= max_views
    )
);

CREATE INDEX idx_shares_fsm_id ON shares(fsm_id);
CREATE INDEX idx_shares_shared_by ON shares(shared_by);
CREATE INDEX idx_shares_token ON shares(share_token);
CREATE INDEX idx_shares_is_public ON shares(is_public);
CREATE INDEX idx_shares_expires_at ON shares(expires_at);

COMMENT ON TABLE shares IS 'Shared FSMs with access control (Phase 4)';

-- ----------------------------------------------------------------
-- Comments Table
-- ----------------------------------------------------------------
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Comment Content
    content TEXT NOT NULL,
    content_html TEXT,

    -- Threading
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    thread_depth INTEGER DEFAULT 0 CHECK (thread_depth >= 0),

    -- Moderation
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_reason TEXT,

    -- Engagement
    upvote_count INTEGER DEFAULT 0 CHECK (upvote_count >= 0),
    downvote_count INTEGER DEFAULT 0 CHECK (downvote_count >= 0),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_content CHECK (
        char_length(content) > 0 AND char_length(content) <= 10000
    ),
    CONSTRAINT deleted_consistency CHECK (
        (is_deleted = FALSE AND deleted_at IS NULL) OR
        (is_deleted = TRUE AND deleted_at IS NOT NULL)
    )
);

CREATE INDEX idx_comments_fsm_id ON comments(fsm_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_is_deleted ON comments(is_deleted);

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE comments IS 'User comments and discussions on FSMs (Phase 4)';

-- ----------------------------------------------------------------
-- Votes Table
-- ----------------------------------------------------------------
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Vote Information
    vote_type vote_type NOT NULL,
    value INTEGER DEFAULT 1,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_vote_per_user UNIQUE(fsm_id, user_id, vote_type),
    CONSTRAINT valid_star_value CHECK (
        (vote_type != 'star') OR (value >= 1 AND value <= 5)
    )
);

CREATE INDEX idx_votes_fsm_id ON votes(fsm_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_votes_type ON votes(vote_type);
CREATE INDEX idx_votes_created_at ON votes(created_at DESC);

CREATE TRIGGER update_votes_updated_at BEFORE UPDATE ON votes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE votes IS 'User ratings and favorites (Phase 4)';

-- ----------------------------------------------------------------
-- Benchmarks Table
-- ----------------------------------------------------------------
CREATE TABLE benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,
    algorithm_result_id UUID REFERENCES algorithm_results(id) ON DELETE CASCADE,

    -- Benchmark Suite Info
    suite_name VARCHAR(100),
    benchmark_name VARCHAR(100),

    -- Hardware Metrics
    logic_elements INTEGER CHECK (logic_elements >= 0),
    registers INTEGER CHECK (registers >= 0),
    luts INTEGER CHECK (luts >= 0),
    max_frequency_mhz DECIMAL(10,2) CHECK (max_frequency_mhz > 0),
    power_consumption_mw DECIMAL(10,3) CHECK (power_consumption_mw >= 0),

    -- Synthesis Tool Info
    synthesis_tool VARCHAR(100),
    target_device VARCHAR(100),

    -- Timing Analysis
    setup_time_ns DECIMAL(10,3),
    hold_time_ns DECIMAL(10,3),
    clock_to_q_ns DECIMAL(10,3),

    -- Comparison
    improvement_vs_binary_pct DECIMAL(5,2),
    improvement_vs_naive_gray_pct DECIMAL(5,2),

    -- Metadata
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE,
    verification_notes TEXT
);

CREATE INDEX idx_benchmarks_fsm_id ON benchmarks(fsm_id);
CREATE INDEX idx_benchmarks_suite ON benchmarks(suite_name);
CREATE INDEX idx_benchmarks_algorithm_result ON benchmarks(algorithm_result_id);
CREATE INDEX idx_benchmarks_verified ON benchmarks(verified);
CREATE INDEX idx_benchmarks_submitted_at ON benchmarks(submitted_at DESC);

COMMENT ON TABLE benchmarks IS 'Hardware synthesis benchmarks for research (Phase 4)';

-- ----------------------------------------------------------------
-- Activity Log Table
-- ----------------------------------------------------------------
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Actor
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,

    -- Action
    activity_type activity_type NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,

    -- Details
    description TEXT,
    metadata JSONB,

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_type ON activity_log(activity_type);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

COMMENT ON TABLE activity_log IS 'Audit trail for user actions (Phase 4)';

-- ================================================================
-- MATERIALIZED VIEWS
-- ================================================================

-- Trending FSMs (computed hourly)
CREATE MATERIALIZED VIEW trending_fsms AS
WITH recent_views AS (
    SELECT
        entity_id as fsm_id,
        COUNT(*) as recent_view_count
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
    f.fsm_type,
    f.state_count,
    f.view_count,
    COALESCE(rv.recent_view_count, 0) as recent_view_count,
    COALESCE(fav.favorite_count, 0) as favorite_count,
    (
        COALESCE(rv.recent_view_count, 0) * 2 +
        f.view_count +
        COALESCE(fav.favorite_count, 0) * 5
    ) as trending_score
FROM fsms f
LEFT JOIN recent_views rv ON f.id = rv.fsm_id
LEFT JOIN favorites fav ON f.id = fav.fsm_id
WHERE f.visibility = 'public'
ORDER BY trending_score DESC;

CREATE UNIQUE INDEX idx_trending_fsms_id ON trending_fsms(id);
CREATE INDEX idx_trending_fsms_score ON trending_fsms(trending_score DESC);

COMMENT ON MATERIALIZED VIEW trending_fsms IS 'Precomputed trending FSMs, refresh hourly';

-- FSM Statistics by Category
CREATE MATERIALIZED VIEW category_statistics AS
SELECT
    c.id as category_id,
    c.name as category_name,
    c.slug as category_slug,
    COUNT(f.id) as fsm_count,
    AVG(f.state_count) as avg_state_count,
    AVG(f.dummy_state_count) as avg_dummy_states,
    AVG(f.view_count) as avg_view_count,
    MAX(f.created_at) as latest_fsm_at
FROM categories c
LEFT JOIN fsms f ON c.id = f.category_id AND f.visibility = 'public'
GROUP BY c.id, c.name, c.slug;

CREATE UNIQUE INDEX idx_category_stats_id ON category_statistics(category_id);

COMMENT ON MATERIALIZED VIEW category_statistics IS 'Aggregated statistics by category';

-- ================================================================
-- ROW-LEVEL SECURITY (Optional - Phase 4)
-- ================================================================

-- Enable RLS on fsms table
-- ALTER TABLE fsms ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own FSMs and public FSMs
-- CREATE POLICY fsm_select_policy ON fsms
--     FOR SELECT
--     USING (
--         visibility IN ('public', 'example')
--         OR created_by = current_user_id()
--         OR EXISTS (
--             SELECT 1 FROM shares
--             WHERE fsm_id = fsms.id
--             AND (
--                 is_public = TRUE
--                 OR shared_by = current_user_id()
--             )
--         )
--     );

-- Policy: Users can insert their own FSMs
-- CREATE POLICY fsm_insert_policy ON fsms
--     FOR INSERT
--     WITH CHECK (created_by = current_user_id());

-- Policy: Users can update their own FSMs
-- CREATE POLICY fsm_update_policy ON fsms
--     FOR UPDATE
--     USING (created_by = current_user_id());

-- Policy: Users can delete their own FSMs
-- CREATE POLICY fsm_delete_policy ON fsms
--     FOR DELETE
--     USING (created_by = current_user_id());

-- ================================================================
-- SEED DATA
-- ================================================================

-- Insert default categories
INSERT INTO categories (id, name, slug, description, level, display_order) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Controllers', 'controllers', 'Control logic FSMs for digital systems', 0, 1),
('550e8400-e29b-41d4-a716-446655440002', 'Processors', 'processors', 'CPU and microcontroller state machines', 0, 2),
('550e8400-e29b-41d4-a716-446655440003', 'Protocols', 'protocols', 'Communication protocol implementations', 0, 3),
('550e8400-e29b-41d4-a716-446655440004', 'Academic', 'academic', 'Educational and textbook examples', 0, 4),
('550e8400-e29b-41d4-a716-446655440005', 'Safety-Critical', 'safety-critical', 'Safety-critical system FSMs', 0, 5);

-- Insert system user (for anonymous FSMs)
INSERT INTO users (id, username, email, password_hash, display_name, role, email_verified) VALUES
('00000000-0000-0000-0000-000000000000', 'system', 'system@grayfsm.com', '$2b$12$dummyhash', 'GrayFSM System', 'admin', TRUE);

-- Insert example FSM: Traffic Light
INSERT INTO fsms (
    id, name, description, fsm_type, definition,
    state_count, transition_count, initial_state,
    bit_width, encoding_type, category_id,
    visibility, is_optimized, tags, created_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440100',
    'Traffic Light Controller',
    'Simple 4-state traffic light FSM with timer-based transitions',
    'moore',
    '{
        "type": "moore",
        "states": [
            {"id": "S0", "label": "Red", "output": "100", "encoding": "00", "position": {"x": 100, "y": 100}},
            {"id": "S1", "label": "Red+Yellow", "output": "110", "encoding": "01", "position": {"x": 250, "y": 100}},
            {"id": "S2", "label": "Green", "output": "001", "encoding": "11", "position": {"x": 400, "y": 100}},
            {"id": "S3", "label": "Yellow", "output": "010", "encoding": "10", "position": {"x": 250, "y": 250}}
        ],
        "transitions": [
            {"id": "T0", "from": "S0", "to": "S1", "input": "timer", "label": "30s elapsed"},
            {"id": "T1", "from": "S1", "to": "S2", "input": "timer", "label": "3s elapsed"},
            {"id": "T2", "from": "S2", "to": "S3", "input": "timer", "label": "25s elapsed"},
            {"id": "T3", "from": "S3", "to": "S0", "input": "timer", "label": "5s elapsed"}
        ],
        "initial_state": "S0"
    }'::jsonb,
    4, 4, 'S0',
    2, 'gray',
    '550e8400-e29b-41d4-a716-446655440001',
    'example', FALSE,
    ARRAY['traffic', 'controller', 'safety-critical'],
    '00000000-0000-0000-0000-000000000000'
);

-- ================================================================
-- MAINTENANCE FUNCTIONS
-- ================================================================

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM export_cache
    WHERE expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION clean_expired_cache IS 'Delete expired export cache entries';

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY trending_fsms;
    REFRESH MATERIALIZED VIEW CONCURRENTLY category_statistics;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_all_materialized_views IS 'Refresh all materialized views';

-- ================================================================
-- GRANTS (Adjust based on your setup)
-- ================================================================

-- Create application role
-- CREATE ROLE grayfsm_app WITH LOGIN PASSWORD 'your_secure_password';

-- Grant necessary permissions
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grayfsm_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grayfsm_app;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO grayfsm_app;

-- ================================================================
-- END OF SCHEMA
-- ================================================================

-- Display schema version
SELECT 'GrayFSM Database Schema v1.0 - Installation Complete!' as message;
