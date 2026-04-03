# GrayFSM Database Design Document

**Version:** 1.0
**Date:** November 2025
**Author:** Database Architecture Team
**Status:** Design Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design Philosophy](#design-philosophy)
3. [Technology Recommendations](#technology-recommendations)
4. [Entity Relationship Model](#entity-relationship-model)
5. [Detailed Schema Definitions](#detailed-schema-definitions)
6. [Indexing Strategy](#indexing-strategy)
7. [Data Access Patterns](#data-access-patterns)
8. [NoSQL Alternative Design](#nosql-alternative-design)
9. [Migration Strategy](#migration-strategy)
10. [Security Considerations](#security-considerations)
11. [Backup and Recovery](#backup-and-recovery)
12. [Performance Optimization](#performance-optimization)
13. [Sample Queries](#sample-queries)
14. [Appendix](#appendix)

---

## Executive Summary

This document presents a comprehensive database design for the GrayFSM project, a web-based tool for optimizing finite state machines using Gray code encoding. The design supports:

- **Core Features**: FSM storage, optimization results, algorithm metrics
- **User Management**: User accounts, authentication, preferences
- **Community Features**: Sharing, collaboration, example library
- **Performance**: Fast queries, efficient indexing, scalability
- **Flexibility**: Support for both PostgreSQL (primary) and MongoDB (alternative)

**Key Design Decisions:**

- **Primary Database**: PostgreSQL for ACID compliance and complex queries
- **Alternative**: MongoDB for simpler deployment and JSON-native storage
- **Hybrid Approach**: Use PostgreSQL for relational data + JSONB for FSM definitions
- **Phased Implementation**: Start simple (Phase 1), add community features later (Phase 4)

---

## Design Philosophy

### Core Principles

1. **Start Simple, Scale Later**: Phase 1 focuses on essential tables; community features added in Phase 4
2. **Data Integrity**: Use foreign keys, constraints, and validation to ensure consistency
3. **Performance First**: Index heavily-queried columns; optimize for read-heavy workloads
4. **JSON Flexibility**: Store FSM definitions as JSON/JSONB for flexibility while maintaining relational structure for metadata
5. **Audit Trail**: Track creation, modification, and user actions for debugging and analytics
6. **Open Source Ready**: Design supports both cloud deployment and self-hosting

### Design Constraints

- **Scalability**: Support 100,000+ FSMs, 10,000+ users
- **Performance**: Query response time <100ms for 95th percentile
- **Storage**: Efficient storage of large FSM definitions (up to 1MB per FSM)
- **Concurrency**: Handle 100+ concurrent users
- **Backup**: Daily automated backups with point-in-time recovery

---

## Technology Recommendations

### Primary Recommendation: PostgreSQL 15+

**Rationale:**
- **JSONB Support**: Native JSON storage with indexing and query capabilities
- **ACID Compliance**: Critical for user data and transactions
- **Rich Indexing**: GIN indexes for JSONB, B-tree for standard columns
- **Full-Text Search**: Built-in support for searching FSM names and descriptions
- **Mature Ecosystem**: Excellent ORMs (SQLAlchemy, Prisma), migration tools (Alembic)
- **Performance**: Battle-tested for read-heavy workloads
- **Open Source**: No licensing costs

**Deployment Options:**
- **Development**: Local PostgreSQL or Docker container
- **Production**: Managed services (AWS RDS, Google Cloud SQL, Supabase, Railway)
- **Self-Hosted**: PostgreSQL on VPS (DigitalOcean, Linode)

### Alternative: MongoDB 6+

**Rationale:**
- **JSON-Native**: FSM definitions naturally stored as documents
- **Schema Flexibility**: Easier to evolve schema during development
- **Horizontal Scaling**: Built-in sharding for future growth
- **Simpler Deployment**: Less operational complexity than PostgreSQL

**Use When:**
- Project prioritizes rapid prototyping over strict data integrity
- Deployment simplicity is critical (e.g., student projects)
- Expecting massive scale requiring sharding

### Hybrid Approach (Advanced)

For very high-scale deployments:
- **PostgreSQL**: User management, metadata, relationships
- **MongoDB**: FSM definitions, large JSON documents
- **Redis**: Caching, session management, real-time features

---

## Entity Relationship Model

### High-Level Entities

```
┌─────────────────────────────────────────────────────────────────┐
│                     CORE ENTITIES (Phase 1)                     │
└─────────────────────────────────────────────────────────────────┘

                           ┌──────────────┐
                           │    Users     │
                           │  (Phase 4)   │
                           └──────┬───────┘
                                  │
                                  │ created_by
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
                 ▼                                 ▼
        ┌─────────────────┐              ┌─────────────────┐
        │      FSMs       │              │   Categories    │
        │   (Primary)     │◄────────────►│   (Taxonomy)    │
        └────────┬────────┘              └─────────────────┘
                 │
                 │ fsm_id
                 │
      ┌──────────┼──────────┬─────────────┬──────────────┐
      │          │          │             │              │
      ▼          ▼          ▼             ▼              ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
│ States  │ │Transitions│ │ Dummy  │ │Algorithm │ │  Export  │
│         │ │         │ │ States  │ │ Results  │ │  Cache   │
└─────────┘ └─────────┘ └─────────┘ └──────────┘ └──────────┘


┌─────────────────────────────────────────────────────────────────┐
│                   COMMUNITY ENTITIES (Phase 4)                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐         ┌──────────┐         ┌──────────┐
│  Users   │◄───────►│  Shares  │◄───────►│   FSMs   │
└────┬─────┘         └──────────┘         └──────────┘
     │                                            ▲
     │                                            │
     │                                            │ fsm_id
     │                                            │
     ▼                                            │
┌──────────┐         ┌──────────┐                │
│Comments/ │◄───────►│  Votes   │────────────────┘
│ Reviews  │         │/Ratings  │
└──────────┘         └──────────┘
```

### Entity Descriptions

**Phase 1 (MVP):**

1. **FSMs**: Core entity storing FSM definitions and metadata
2. **States**: Individual states within an FSM
3. **Transitions**: Connections between states
4. **Dummy_States**: Inserted states for optimization
5. **Algorithm_Results**: Optimization results and metrics
6. **Categories**: Classification system for FSMs (traffic control, processors, etc.)
7. **Export_Cache**: Cached HDL exports for performance

**Phase 4 (Community):**

8. **Users**: User accounts and authentication
9. **Shares**: Shared FSM instances with permissions
10. **Comments**: User feedback on shared FSMs
11. **Votes**: Community ratings and favorites
12. **Benchmarks**: Performance comparison data

---

## Detailed Schema Definitions

### PostgreSQL Schema

#### Phase 1: Core Tables

##### Table: `fsms`

Primary table storing FSM metadata and definitions.

```sql
CREATE TYPE fsm_type AS ENUM ('moore', 'mealy');
CREATE TYPE fsm_visibility AS ENUM ('private', 'public', 'unlisted', 'example');

CREATE TABLE fsms (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic Information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    fsm_type fsm_type NOT NULL,

    -- FSM Definition (JSON/JSONB)
    -- Stores complete FSM structure as JSON for flexibility
    definition JSONB NOT NULL,

    -- Metadata
    state_count INTEGER NOT NULL CHECK (state_count > 0),
    transition_count INTEGER NOT NULL CHECK (transition_count >= 0),
    initial_state VARCHAR(100) NOT NULL,

    -- Encoding Information
    bit_width INTEGER NOT NULL CHECK (bit_width > 0),
    encoding_type VARCHAR(50) DEFAULT 'binary', -- 'binary', 'gray', 'custom'

    -- Classification
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    tags TEXT[], -- Array of tags for searching

    -- Version Control
    version INTEGER DEFAULT 1,
    parent_fsm_id UUID REFERENCES fsms(id) ON DELETE SET NULL, -- For forked FSMs

    -- Ownership (Phase 4)
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    visibility fsm_visibility DEFAULT 'private',

    -- Optimization Status
    is_optimized BOOLEAN DEFAULT FALSE,
    optimization_algorithm VARCHAR(100), -- 'greedy', 'bfs', 'global_sa', etc.
    dummy_state_count INTEGER DEFAULT 0,

    -- Performance Metrics
    avg_hamming_distance DECIMAL(5,2),
    max_hamming_distance INTEGER,
    optimization_improvement_pct DECIMAL(5,2), -- % improvement over original

    -- Usage Statistics
    view_count INTEGER DEFAULT 0,
    fork_count INTEGER DEFAULT 0,
    export_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Search
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
    ) STORED,

    -- Constraints
    CONSTRAINT valid_definition CHECK (jsonb_typeof(definition) = 'object'),
    CONSTRAINT valid_optimization CHECK (
        (is_optimized = FALSE AND optimization_algorithm IS NULL) OR
        (is_optimized = TRUE AND optimization_algorithm IS NOT NULL)
    )
);

-- Sample FSM definition structure (stored in JSONB):
/*
{
  "type": "moore",
  "states": [
    {
      "id": "S0",
      "label": "Idle",
      "output": "00",
      "encoding": "000",
      "position": {"x": 100, "y": 100}
    },
    {
      "id": "S1",
      "label": "Active",
      "output": "01",
      "encoding": "001",
      "position": {"x": 200, "y": 100}
    }
  ],
  "transitions": [
    {
      "id": "T0",
      "from": "S0",
      "to": "S1",
      "input": "1",
      "output": null,
      "label": "Start"
    }
  ],
  "initial_state": "S0",
  "metadata": {
    "author": "John Doe",
    "date_created": "2025-11-29",
    "tool_version": "1.0.0"
  }
}
*/

CREATE INDEX idx_fsms_type ON fsms(fsm_type);
CREATE INDEX idx_fsms_category ON fsms(category_id);
CREATE INDEX idx_fsms_created_by ON fsms(created_by);
CREATE INDEX idx_fsms_visibility ON fsms(visibility);
CREATE INDEX idx_fsms_is_optimized ON fsms(is_optimized);
CREATE INDEX idx_fsms_created_at ON fsms(created_at DESC);
CREATE INDEX idx_fsms_view_count ON fsms(view_count DESC);
CREATE INDEX idx_fsms_tags ON fsms USING GIN(tags);
CREATE INDEX idx_fsms_definition ON fsms USING GIN(definition);
CREATE INDEX idx_fsms_search ON fsms USING GIN(search_vector);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fsms_updated_at BEFORE UPDATE ON fsms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

##### Table: `states`

Normalized storage of individual states (optional, can use JSONB in fsms table instead).

```sql
CREATE TABLE states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,

    -- State Identification
    state_id VARCHAR(100) NOT NULL, -- Logical ID like "S0", "S1"
    label VARCHAR(255), -- Human-readable name

    -- Encoding
    binary_encoding VARCHAR(20), -- e.g., "000", "001"
    gray_encoding VARCHAR(20),   -- e.g., "000", "001"

    -- Moore Machine Output
    output_value VARCHAR(100), -- Output for Moore machines

    -- Dummy State Flag
    is_dummy BOOLEAN DEFAULT FALSE,
    inserted_for VARCHAR(255), -- Description of why dummy was inserted

    -- Visual Properties (for UI)
    position_x DECIMAL(10,2),
    position_y DECIMAL(10,2),
    color VARCHAR(20),

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unique_state_per_fsm UNIQUE(fsm_id, state_id)
);

CREATE INDEX idx_states_fsm_id ON states(fsm_id);
CREATE INDEX idx_states_is_dummy ON states(is_dummy);
```

##### Table: `transitions`

Normalized storage of transitions between states.

```sql
CREATE TABLE transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,

    -- Transition Definition
    from_state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
    to_state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,

    -- Logical Transition Info
    input_value VARCHAR(100), -- Input condition
    output_value VARCHAR(100), -- Output for Mealy machines
    label VARCHAR(255), -- Human-readable label

    -- Analysis
    hamming_distance INTEGER, -- Computed Hamming distance
    requires_dummy BOOLEAN DEFAULT FALSE,

    -- Priority/Weight (for optimization algorithms)
    weight DECIMAL(10,2) DEFAULT 1.0,
    priority INTEGER DEFAULT 0,

    -- Path Through Dummy States
    path_state_ids UUID[], -- Array of intermediate dummy state IDs

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
```

##### Table: `algorithm_results`

Stores optimization results for comparison and benchmarking.

```sql
CREATE TYPE algorithm_name AS ENUM (
    'greedy',
    'bfs_optimal',
    'global_sa',      -- Simulated Annealing
    'global_ga',      -- Genetic Algorithm
    'hybrid',
    'ml_predicted',
    'custom'
);

CREATE TABLE algorithm_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to Original FSM
    original_fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,

    -- Optimized FSM (can be same table or separate)
    optimized_fsm_id UUID REFERENCES fsms(id) ON DELETE SET NULL,

    -- Algorithm Information
    algorithm algorithm_name NOT NULL,
    algorithm_version VARCHAR(50),
    algorithm_parameters JSONB, -- Stores algorithm-specific config

    -- Results
    dummy_states_added INTEGER NOT NULL DEFAULT 0,
    total_states_final INTEGER NOT NULL,
    transitions_modified INTEGER DEFAULT 0,

    -- Quality Metrics
    avg_hamming_before DECIMAL(5,2),
    avg_hamming_after DECIMAL(5,2),
    max_hamming_before INTEGER,
    max_hamming_after INTEGER,
    improvement_percentage DECIMAL(5,2),

    -- Performance Metrics
    execution_time_ms BIGINT NOT NULL, -- Milliseconds
    memory_used_mb DECIMAL(10,2),
    cpu_utilization_pct DECIMAL(5,2),

    -- Encoding Information
    encoding_strategy VARCHAR(100), -- Description of state assignment
    encoding_map JSONB, -- Maps original state IDs to Gray codes

    -- Success/Error
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,

    -- Metadata
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_by UUID REFERENCES users(id) ON DELETE SET NULL,

    CONSTRAINT valid_improvement CHECK (
        improvement_percentage >= -100 AND improvement_percentage <= 100
    )
);

CREATE INDEX idx_algorithm_results_original_fsm ON algorithm_results(original_fsm_id);
CREATE INDEX idx_algorithm_results_optimized_fsm ON algorithm_results(optimized_fsm_id);
CREATE INDEX idx_algorithm_results_algorithm ON algorithm_results(algorithm);
CREATE INDEX idx_algorithm_results_success ON algorithm_results(success);
CREATE INDEX idx_algorithm_results_improvement ON algorithm_results(improvement_percentage DESC);
CREATE INDEX idx_algorithm_results_execution_time ON algorithm_results(execution_time_ms);
CREATE INDEX idx_algorithm_results_executed_at ON algorithm_results(executed_at DESC);
```

##### Table: `categories`

Hierarchical categorization system for FSMs.

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Category Information
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE, -- URL-friendly name
    description TEXT,
    icon VARCHAR(50), -- Icon name or emoji

    -- Hierarchy
    parent_category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 0, -- Depth in hierarchy
    full_path VARCHAR(500), -- e.g., "Digital Design/Controllers/Traffic Lights"

    -- Display
    display_order INTEGER DEFAULT 0,
    color VARCHAR(20),

    -- Statistics
    fsm_count INTEGER DEFAULT 0, -- Cached count

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_parent ON categories(parent_category_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_level ON categories(level);

-- Sample categories:
/*
INSERT INTO categories (name, slug, description, level) VALUES
('Digital Design', 'digital-design', 'General digital circuit FSMs', 0),
('Controllers', 'controllers', 'Control logic FSMs', 0),
('Processors', 'processors', 'CPU and microcontroller FSMs', 0),
('Protocols', 'protocols', 'Communication protocol FSMs', 0),
('Academic Examples', 'academic', 'Educational and textbook examples', 0);
*/
```

##### Table: `export_cache`

Caches generated HDL exports for performance.

```sql
CREATE TYPE export_format AS ENUM ('verilog', 'vhdl', 'json', 'csv', 'graphviz', 'testbench');

CREATE TABLE export_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,

    -- Export Information
    format export_format NOT NULL,
    content TEXT NOT NULL, -- The generated code
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for cache validation

    -- Generation Info
    template_version VARCHAR(50),
    generation_options JSONB, -- Parameters used for generation

    -- Cache Management
    file_size_bytes INTEGER,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0,

    -- TTL (Time To Live)
    expires_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT unique_export_cache UNIQUE(fsm_id, format, content_hash)
);

CREATE INDEX idx_export_cache_fsm_id ON export_cache(fsm_id);
CREATE INDEX idx_export_cache_format ON export_cache(format);
CREATE INDEX idx_export_cache_expires ON export_cache(expires_at);
CREATE INDEX idx_export_cache_hash ON export_cache(content_hash);

-- Cleanup expired cache entries (run periodically)
-- DELETE FROM export_cache WHERE expires_at < CURRENT_TIMESTAMP;
```

---

#### Phase 4: Community Tables

##### Table: `users`

User accounts and authentication.

```sql
CREATE TYPE user_role AS ENUM ('guest', 'user', 'premium', 'educator', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Authentication
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt hash
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

    -- Preferences
    preferences JSONB DEFAULT '{}', -- UI settings, notifications, etc.

    -- Statistics
    fsms_created INTEGER DEFAULT 0,
    fsms_shared INTEGER DEFAULT 0,
    total_optimizations INTEGER DEFAULT 0,

    -- API Access (Phase 4)
    api_key VARCHAR(64) UNIQUE,
    api_key_created_at TIMESTAMP WITH TIME ZONE,
    api_rate_limit INTEGER DEFAULT 100, -- Requests per hour

    -- OAuth (optional)
    github_id VARCHAR(100) UNIQUE,
    google_id VARCHAR(100) UNIQUE,

    -- Security
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete

    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_api_key ON users(api_key);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

##### Table: `shares`

Shared FSMs with access control.

```sql
CREATE TYPE share_permission AS ENUM ('view', 'comment', 'edit', 'admin');

CREATE TABLE shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Access Control
    share_token VARCHAR(64) NOT NULL UNIQUE, -- URL token for sharing
    permission share_permission DEFAULT 'view',

    -- Visibility
    is_public BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255), -- Optional password protection

    -- Restrictions
    max_views INTEGER, -- Null = unlimited
    view_count INTEGER DEFAULT 0,
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
    )
);

CREATE INDEX idx_shares_fsm_id ON shares(fsm_id);
CREATE INDEX idx_shares_shared_by ON shares(shared_by);
CREATE INDEX idx_shares_token ON shares(share_token);
CREATE INDEX idx_shares_is_public ON shares(is_public);
CREATE INDEX idx_shares_expires_at ON shares(expires_at);
```

##### Table: `comments`

User comments and discussions on FSMs.

```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Comment Content
    content TEXT NOT NULL,
    content_html TEXT, -- Rendered markdown

    -- Threading
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    thread_depth INTEGER DEFAULT 0,

    -- Moderation
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_reason TEXT,

    -- Engagement
    upvote_count INTEGER DEFAULT 0,
    downvote_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_content CHECK (char_length(content) > 0 AND char_length(content) <= 10000)
);

CREATE INDEX idx_comments_fsm_id ON comments(fsm_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_is_deleted ON comments(is_deleted);

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

##### Table: `votes`

User ratings and favorites.

```sql
CREATE TYPE vote_type AS ENUM ('upvote', 'downvote', 'favorite', 'star');

CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Vote Information
    vote_type vote_type NOT NULL,
    value INTEGER DEFAULT 1, -- For star ratings (1-5)

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
```

##### Table: `benchmarks`

Performance benchmarking data for research.

```sql
CREATE TABLE benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference
    fsm_id UUID NOT NULL REFERENCES fsms(id) ON DELETE CASCADE,
    algorithm_result_id UUID REFERENCES algorithm_results(id) ON DELETE CASCADE,

    -- Benchmark Suite Info
    suite_name VARCHAR(100), -- e.g., "MCNC91", "LGSynth93"
    benchmark_name VARCHAR(100), -- Specific benchmark within suite

    -- Hardware Metrics (if synthesized)
    logic_elements INTEGER,
    registers INTEGER,
    luts INTEGER, -- Look-Up Tables
    max_frequency_mhz DECIMAL(10,2),
    power_consumption_mw DECIMAL(10,3),

    -- Synthesis Tool Info
    synthesis_tool VARCHAR(100), -- e.g., "Vivado 2023.1", "Quartus Prime"
    target_device VARCHAR(100), -- e.g., "Xilinx Artix-7", "Intel Cyclone V"

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
```

##### Table: `activity_log`

Audit trail for user actions.

```sql
CREATE TYPE activity_type AS ENUM (
    'fsm_created',
    'fsm_updated',
    'fsm_deleted',
    'fsm_optimized',
    'fsm_shared',
    'fsm_exported',
    'comment_added',
    'vote_cast',
    'user_login',
    'user_logout'
);

CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Actor
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,

    -- Action
    activity_type activity_type NOT NULL,
    entity_type VARCHAR(50), -- 'fsm', 'comment', 'user', etc.
    entity_id UUID,

    -- Details
    description TEXT,
    metadata JSONB, -- Additional context

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_type ON activity_log(activity_type);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- Partition by month for performance (optional)
-- CREATE TABLE activity_log_2025_11 PARTITION OF activity_log
--     FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
```

---

## Indexing Strategy

### Primary Indexes

**Purpose**: Enforce uniqueness and primary key constraints.

- All `id` columns (UUID primary keys)
- Unique constraints on usernames, emails, share tokens
- Composite unique constraints (e.g., `fsm_id + state_id`)

### Query Optimization Indexes

**High-Priority (Phase 1):**

1. **FSM Lookups**:
   - `idx_fsms_visibility` - Filter by public/private
   - `idx_fsms_is_optimized` - Find optimized FSMs
   - `idx_fsms_category` - Browse by category
   - `idx_fsms_created_at` - Sort by newest

2. **Full-Text Search**:
   - `idx_fsms_search` (GIN) - Search FSM names and descriptions
   - `idx_fsms_tags` (GIN) - Tag-based filtering

3. **JSONB Queries**:
   - `idx_fsms_definition` (GIN) - Query FSM structure
   - `idx_algorithm_results_parameters` (GIN) - Search algorithm configs

4. **Algorithm Results**:
   - `idx_algorithm_results_improvement` - Find best optimizations
   - `idx_algorithm_results_execution_time` - Performance analysis

**Medium-Priority (Phase 2-3):**

5. **Relationships**:
   - `idx_transitions_from_state`, `idx_transitions_to_state` - Graph traversal
   - `idx_states_fsm_id` - Fetch all states for an FSM

6. **Analytics**:
   - `idx_fsms_view_count` - Popular FSMs
   - `idx_export_cache_expires` - Cache cleanup

**Low-Priority (Phase 4 - Community):**

7. **User Features**:
   - `idx_users_email`, `idx_users_username` - Authentication
   - `idx_comments_fsm_id` - Fetch comments for FSM
   - `idx_votes_fsm_id` - Aggregate ratings

8. **Audit Trail**:
   - `idx_activity_log_created_at` - Recent activity
   - `idx_activity_log_user_id` - User history

### Composite Indexes

For complex queries involving multiple conditions:

```sql
-- Find recent public optimized FSMs in a category
CREATE INDEX idx_fsms_public_optimized_recent
    ON fsms(visibility, is_optimized, created_at DESC)
    WHERE visibility = 'public' AND is_optimized = TRUE;

-- User's FSMs sorted by update time
CREATE INDEX idx_fsms_user_updated
    ON fsms(created_by, updated_at DESC);

-- Algorithm comparison queries
CREATE INDEX idx_algorithm_results_comparison
    ON algorithm_results(original_fsm_id, algorithm, improvement_percentage DESC);
```

### Partial Indexes

For queries on subsets of data:

```sql
-- Only index non-dummy states
CREATE INDEX idx_states_real ON states(fsm_id, state_id)
    WHERE is_dummy = FALSE;

-- Only index active users
CREATE INDEX idx_users_active ON users(username)
    WHERE status = 'active';

-- Only index successful optimizations
CREATE INDEX idx_algorithm_results_successful
    ON algorithm_results(original_fsm_id, improvement_percentage DESC)
    WHERE success = TRUE;
```

### Index Maintenance

```sql
-- Analyze table statistics (run weekly)
ANALYZE fsms;
ANALYZE algorithm_results;
ANALYZE users;

-- Rebuild indexes if fragmented (run monthly)
REINDEX TABLE fsms;

-- Identify unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY schemaname, tablename;
```

---

## Data Access Patterns

### Pattern 1: Browse FSMs

**Use Case**: User browses public FSMs by category.

**Query**:
```sql
SELECT
    f.id, f.name, f.description, f.fsm_type,
    f.state_count, f.transition_count,
    f.is_optimized, f.dummy_state_count,
    f.view_count, f.created_at,
    c.name as category_name,
    u.display_name as author_name
FROM fsms f
LEFT JOIN categories c ON f.category_id = c.id
LEFT JOIN users u ON f.created_by = u.id
WHERE f.visibility = 'public'
    AND (f.category_id = $1 OR $1 IS NULL)
ORDER BY f.created_at DESC
LIMIT 20 OFFSET $2;
```

**Indexes Used**: `idx_fsms_visibility`, `idx_fsms_category`, `idx_fsms_created_at`

**Expected Performance**: <50ms for 10,000+ FSMs

---

### Pattern 2: Optimize FSM

**Use Case**: User optimizes an FSM using an algorithm.

**Transaction Flow**:
```sql
BEGIN;

-- 1. Fetch original FSM
SELECT definition, fsm_type, state_count
FROM fsms
WHERE id = $1;

-- 2. Run optimization (in application code)
-- ...algorithm executes...

-- 3. Insert optimized FSM
INSERT INTO fsms (
    name, description, fsm_type, definition,
    state_count, transition_count, initial_state,
    bit_width, encoding_type, parent_fsm_id,
    created_by, is_optimized, optimization_algorithm,
    dummy_state_count, avg_hamming_distance
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12, $13, $14
)
RETURNING id;

-- 4. Record algorithm result
INSERT INTO algorithm_results (
    original_fsm_id, optimized_fsm_id, algorithm,
    algorithm_parameters, dummy_states_added,
    total_states_final, avg_hamming_before,
    avg_hamming_after, improvement_percentage,
    execution_time_ms, encoding_map
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
);

COMMIT;
```

**Expected Performance**: <200ms (excluding algorithm execution)

---

### Pattern 3: Search FSMs

**Use Case**: User searches for FSMs by keywords.

**Query**:
```sql
SELECT
    f.id, f.name, f.description, f.fsm_type,
    f.state_count, f.view_count,
    ts_rank(f.search_vector, query) AS rank
FROM fsms f,
     to_tsquery('english', $1) query
WHERE f.search_vector @@ query
    AND f.visibility = 'public'
ORDER BY rank DESC, f.view_count DESC
LIMIT 20;
```

**Indexes Used**: `idx_fsms_search`, `idx_fsms_visibility`

**Example Search**: `'traffic & (light | signal)'` finds traffic light FSMs

**Expected Performance**: <100ms for 100,000+ FSMs

---

### Pattern 4: Compare Algorithms

**Use Case**: Researcher compares multiple algorithms on the same FSM.

**Query**:
```sql
SELECT
    ar.algorithm,
    ar.dummy_states_added,
    ar.improvement_percentage,
    ar.execution_time_ms,
    f.name as optimized_fsm_name
FROM algorithm_results ar
LEFT JOIN fsms f ON ar.optimized_fsm_id = f.id
WHERE ar.original_fsm_id = $1
ORDER BY ar.improvement_percentage DESC;
```

**Indexes Used**: `idx_algorithm_results_original_fsm`, `idx_algorithm_results_improvement`

**Expected Performance**: <20ms

---

### Pattern 5: Export FSM

**Use Case**: User exports FSM to Verilog with caching.

**Query Flow**:
```sql
-- 1. Check cache
SELECT content, generated_at
FROM export_cache
WHERE fsm_id = $1
    AND format = 'verilog'
    AND expires_at > CURRENT_TIMESTAMP
ORDER BY generated_at DESC
LIMIT 1;

-- 2. If cache miss, generate and store
INSERT INTO export_cache (
    fsm_id, format, content, content_hash,
    template_version, generation_options,
    file_size_bytes, expires_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP + INTERVAL '7 days'
)
ON CONFLICT (fsm_id, format, content_hash)
DO UPDATE SET
    last_accessed_at = CURRENT_TIMESTAMP,
    access_count = export_cache.access_count + 1;

-- 3. Update FSM export count
UPDATE fsms
SET export_count = export_count + 1,
    last_accessed_at = CURRENT_TIMESTAMP
WHERE id = $1;
```

**Expected Performance**:
- Cache hit: <10ms
- Cache miss: <500ms (including generation)

---

### Pattern 6: User Dashboard

**Use Case**: User views their FSMs and statistics.

**Query**:
```sql
SELECT
    f.id, f.name, f.fsm_type, f.state_count,
    f.is_optimized, f.view_count, f.fork_count,
    f.created_at, f.updated_at,
    (SELECT COUNT(*) FROM comments WHERE fsm_id = f.id) as comment_count,
    (SELECT COUNT(*) FROM votes WHERE fsm_id = f.id AND vote_type = 'favorite') as favorite_count
FROM fsms f
WHERE f.created_by = $1
ORDER BY f.updated_at DESC
LIMIT 50;
```

**Indexes Used**: `idx_fsms_created_by`, `idx_fsms_updated_at`

**Expected Performance**: <50ms

---

### Pattern 7: Popular FSMs (Trending)

**Use Case**: Homepage displays trending/popular FSMs.

**Query**:
```sql
WITH recent_views AS (
    SELECT entity_id as fsm_id, COUNT(*) as recent_view_count
    FROM activity_log
    WHERE activity_type = 'fsm_viewed'
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
    GROUP BY entity_id
)
SELECT
    f.id, f.name, f.description, f.state_count,
    f.view_count, rv.recent_view_count,
    (SELECT COUNT(*) FROM votes v WHERE v.fsm_id = f.id AND v.vote_type = 'favorite') as favorites,
    ((rv.recent_view_count * 2) + f.view_count + favorites * 5) as trending_score
FROM fsms f
LEFT JOIN recent_views rv ON f.id = rv.fsm_id
WHERE f.visibility = 'public'
ORDER BY trending_score DESC
LIMIT 10;
```

**Materialized View** (for performance):
```sql
CREATE MATERIALIZED VIEW trending_fsms AS
    -- [same query as above]
    WITH DATA;

CREATE INDEX idx_trending_fsms_score ON trending_fsms(trending_score DESC);

-- Refresh every hour
REFRESH MATERIALIZED VIEW CONCURRENTLY trending_fsms;
```

---

## NoSQL Alternative Design

### MongoDB Schema

For projects preferring document databases, here's a MongoDB equivalent.

#### Collection: `fsms`

```javascript
{
  _id: ObjectId("..."),

  // Basic Information
  name: "Traffic Light Controller",
  description: "4-state traffic light FSM",
  fsmType: "moore", // or "mealy"

  // FSM Definition (embedded document)
  definition: {
    states: [
      {
        id: "S0",
        label: "Red",
        encoding: {
          binary: "00",
          gray: "00"
        },
        output: "100", // Red light on
        position: { x: 100, y: 100 },
        isDummy: false
      },
      // ... more states
    ],
    transitions: [
      {
        id: "T0",
        from: "S0",
        to: "S1",
        input: "timer_expire",
        output: null, // For Moore machines
        label: "Timer expired",
        hammingDistance: 1,
        requiresDummy: false
      },
      // ... more transitions
    ],
    initialState: "S0"
  },

  // Metadata
  stateCount: 4,
  transitionCount: 4,
  bitWidth: 2,
  encodingType: "gray",

  // Classification
  category: {
    id: ObjectId("..."),
    name: "Controllers",
    slug: "controllers"
  },
  tags: ["traffic", "controller", "safety-critical"],

  // Optimization
  isOptimized: true,
  optimizationAlgorithm: "greedy",
  dummyStateCount: 1,

  // Optimization Results (embedded)
  algorithmResults: [
    {
      algorithm: "greedy",
      executionTimeMs: 45,
      dummyStatesAdded: 1,
      improvementPercentage: 25.0,
      encoding: {
        "S0": "00",
        "S1": "01",
        "S2": "11",
        "S3": "10"
      },
      executedAt: ISODate("2025-11-29T12:00:00Z")
    }
  ],

  // Ownership
  createdBy: {
    userId: ObjectId("..."),
    username: "john_doe",
    displayName: "John Doe"
  },
  visibility: "public",

  // Versioning
  version: 1,
  parentFsmId: null,

  // Statistics
  viewCount: 152,
  forkCount: 8,
  exportCount: 23,

  // Community Features (denormalized)
  votes: {
    upvotes: 15,
    downvotes: 2,
    favorites: 8,
    averageRating: 4.2
  },

  // Export Cache (embedded)
  exports: {
    verilog: {
      content: "module traffic_light(...)",
      contentHash: "sha256hash...",
      generatedAt: ISODate("2025-11-29T10:00:00Z"),
      expiresAt: ISODate("2025-12-06T10:00:00Z")
    }
  },

  // Timestamps
  createdAt: ISODate("2025-11-15T09:00:00Z"),
  updatedAt: ISODate("2025-11-29T12:00:00Z"),
  lastAccessedAt: ISODate("2025-11-29T14:30:00Z")
}
```

#### Indexes for MongoDB

```javascript
// Primary indexes
db.fsms.createIndex({ _id: 1 });

// Query optimization
db.fsms.createIndex({ visibility: 1, isOptimized: 1, createdAt: -1 });
db.fsms.createIndex({ "createdBy.userId": 1, updatedAt: -1 });
db.fsms.createIndex({ "category.id": 1 });
db.fsms.createIndex({ tags: 1 });

// Text search
db.fsms.createIndex({
  name: "text",
  description: "text",
  tags: "text"
}, {
  weights: { name: 10, description: 5, tags: 2 }
});

// Sorting and filtering
db.fsms.createIndex({ viewCount: -1 });
db.fsms.createIndex({ "votes.favorites": -1 });
db.fsms.createIndex({ createdAt: -1 });

// Compound indexes for common queries
db.fsms.createIndex({
  visibility: 1,
  "category.id": 1,
  createdAt: -1
});
```

#### Collection: `users`

```javascript
{
  _id: ObjectId("..."),
  username: "john_doe",
  email: "john@example.com",
  passwordHash: "bcrypt_hash",
  emailVerified: true,

  profile: {
    displayName: "John Doe",
    bio: "Digital design enthusiast",
    avatarUrl: "https://...",
    website: "https://johndoe.com",
    location: "San Francisco, CA"
  },

  role: "user",
  status: "active",

  preferences: {
    theme: "dark",
    notifications: {
      email: true,
      comments: true,
      forks: false
    },
    defaultAlgorithm: "greedy"
  },

  statistics: {
    fsmsCreated: 15,
    fsmsShared: 8,
    totalOptimizations: 143,
    totalExports: 52
  },

  apiAccess: {
    apiKey: "generated_key",
    apiKeyCreatedAt: ISODate("2025-10-01T00:00:00Z"),
    rateLimit: 100
  },

  security: {
    lastLoginAt: ISODate("2025-11-29T08:00:00Z"),
    lastLoginIp: "192.168.1.1",
    failedLoginAttempts: 0
  },

  createdAt: ISODate("2025-08-15T10:00:00Z"),
  updatedAt: ISODate("2025-11-29T08:00:00Z")
}
```

#### Collection: `comments`

```javascript
{
  _id: ObjectId("..."),
  fsmId: ObjectId("..."),

  author: {
    userId: ObjectId("..."),
    username: "jane_smith",
    displayName: "Jane Smith",
    avatarUrl: "https://..."
  },

  content: "Great FSM! Have you considered...",
  contentHtml: "<p>Great FSM! Have you considered...</p>",

  // Threading
  parentCommentId: null,
  threadDepth: 0,

  // Engagement
  votes: {
    upvotes: 5,
    downvotes: 0
  },

  isEdited: false,
  isDeleted: false,

  createdAt: ISODate("2025-11-28T15:00:00Z"),
  updatedAt: ISODate("2025-11-28T15:00:00Z")
}
```

### MongoDB Access Patterns

```javascript
// Pattern 1: Browse public FSMs by category
db.fsms.find({
  visibility: "public",
  "category.slug": "controllers"
})
.sort({ createdAt: -1 })
.limit(20)
.skip(0);

// Pattern 2: Search FSMs
db.fsms.find({
  $text: { $search: "traffic light" },
  visibility: "public"
})
.sort({ score: { $meta: "textScore" } })
.limit(20);

// Pattern 3: User's FSMs with statistics
db.fsms.aggregate([
  { $match: { "createdBy.userId": ObjectId("...") } },
  {
    $lookup: {
      from: "comments",
      localField: "_id",
      foreignField: "fsmId",
      as: "comments"
    }
  },
  {
    $project: {
      name: 1,
      fsmType: 1,
      stateCount: 1,
      viewCount: 1,
      createdAt: 1,
      commentCount: { $size: "$comments" }
    }
  },
  { $sort: { updatedAt: -1 } },
  { $limit: 50 }
]);

// Pattern 4: Trending FSMs
db.fsms.find({ visibility: "public" })
.sort({
  "votes.favorites": -1,
  viewCount: -1
})
.limit(10);
```

---

## Migration Strategy

### Phase 1 to Phase 2: Adding Community Features

When transitioning from MVP to community features:

**Step 1: Add New Tables** (without breaking existing functionality)

```sql
-- Add users table
CREATE TABLE users (...);

-- Add nullable foreign key to existing fsms table
ALTER TABLE fsms
ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add other community tables
CREATE TABLE shares (...);
CREATE TABLE comments (...);
CREATE TABLE votes (...);
```

**Step 2: Data Migration** (if needed)

```sql
-- Create default "system" user for existing FSMs
INSERT INTO users (id, username, email, display_name, role)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'system',
    'system@grayfsm.com',
    'System',
    'admin'
);

-- Assign existing FSMs to system user
UPDATE fsms
SET created_by = '00000000-0000-0000-0000-000000000000'
WHERE created_by IS NULL;
```

**Step 3: Add Constraints** (after data migration)

```sql
-- Make created_by required for new FSMs
ALTER TABLE fsms
ALTER COLUMN created_by SET NOT NULL;
```

### Schema Evolution Best Practices

1. **Backward Compatible Changes**:
   - Add columns as nullable first
   - Populate data
   - Add constraints later

2. **Use Migration Tools**:
   - **PostgreSQL**: Alembic (Python), Knex.js (Node), Prisma Migrate
   - **MongoDB**: Custom migration scripts, migrate-mongo

3. **Version Control**:
   - Store all migrations in Git
   - Number migrations sequentially
   - Never modify existing migrations

4. **Testing**:
   - Test migrations on staging database
   - Verify data integrity after migration
   - Have rollback plan ready

### Sample Migration (Alembic)

```python
# migrations/versions/001_add_users_table.py
"""Add users table

Revision ID: 001
Revises:
Create Date: 2025-11-29
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create user_role enum
    user_role = postgresql.ENUM('guest', 'user', 'premium', 'educator', 'admin',
                                  name='user_role')
    user_role.create(op.get_bind())

    # Create users table
    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('username', sa.String(50), nullable=False, unique=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        # ... other columns
    )

    # Add indexes
    op.create_index('idx_users_username', 'users', ['username'])
    op.create_index('idx_users_email', 'users', ['email'])

def downgrade():
    op.drop_table('users')
    op.execute('DROP TYPE user_role')
```

---

## Security Considerations

### Authentication and Authorization

1. **Password Security**:
   - Store bcrypt hashes (never plaintext)
   - Minimum 12 rounds for bcrypt
   - Implement password strength requirements

2. **Session Management**:
   - Use HTTP-only cookies for session tokens
   - Implement CSRF protection
   - Session timeout after 24 hours

3. **API Security**:
   - Rate limiting per user/IP
   - API key rotation every 90 days
   - Scope-based permissions

### Data Protection

1. **SQL Injection Prevention**:
   - Use parameterized queries (ALWAYS)
   - Never concatenate user input into SQL
   - Validate and sanitize all inputs

```python
# GOOD: Parameterized query
cursor.execute("SELECT * FROM fsms WHERE id = %s", (fsm_id,))

# BAD: Concatenation (NEVER DO THIS)
cursor.execute(f"SELECT * FROM fsms WHERE id = '{fsm_id}'")
```

2. **Access Control**:
   - Row-level security for multi-tenant data
   - Enforce visibility checks in all queries

```sql
-- Example row-level security policy
CREATE POLICY fsm_visibility_policy ON fsms
    FOR SELECT
    USING (
        visibility = 'public'
        OR created_by = current_user_id()
        OR EXISTS (
            SELECT 1 FROM shares
            WHERE fsm_id = fsms.id
            AND shared_with = current_user_id()
        )
    );
```

3. **Data Encryption**:
   - Encrypt database connections (SSL/TLS)
   - Consider encrypting sensitive JSONB fields at application level
   - Regular security audits

### Input Validation

1. **FSM Definition Validation**:
   - Validate JSON schema before storage
   - Limit FSM size (max 10,000 states)
   - Check for cyclic references

2. **User Input Sanitization**:
   - Sanitize HTML in comments
   - Validate email format
   - Escape special characters

---

## Backup and Recovery

### Backup Strategy

1. **PostgreSQL Automated Backups**:

```bash
# Daily full backup
pg_dump -U postgres grayfsm > backup_$(date +%Y%m%d).sql

# Continuous archiving (WAL)
# In postgresql.conf:
# archive_mode = on
# archive_command = 'cp %p /backup/wal/%f'
```

2. **Point-in-Time Recovery (PITR)**:
   - Enable WAL archiving
   - Retain backups for 30 days
   - Test restoration monthly

3. **MongoDB Backups**:

```bash
# Daily snapshot
mongodump --db grayfsm --out /backup/$(date +%Y%m%d)

# Continuous backup (MongoDB Atlas auto-backup)
```

### Disaster Recovery Plan

1. **RTO (Recovery Time Objective)**: 4 hours
2. **RPO (Recovery Point Objective)**: 1 hour
3. **Backup Locations**:
   - Primary: Same region as production
   - Secondary: Different geographic region
   - Tertiary: Offline/cold storage

---

## Performance Optimization

### Query Optimization Techniques

1. **EXPLAIN ANALYZE**:

```sql
EXPLAIN ANALYZE
SELECT * FROM fsms
WHERE visibility = 'public'
    AND is_optimized = TRUE
ORDER BY created_at DESC
LIMIT 20;

-- Look for:
-- - Sequential scans (should use indexes)
-- - High planning/execution time
-- - Expensive sorts
```

2. **Materialized Views** for expensive aggregations:

```sql
CREATE MATERIALIZED VIEW fsm_statistics AS
SELECT
    category_id,
    COUNT(*) as fsm_count,
    AVG(state_count) as avg_state_count,
    AVG(dummy_state_count) as avg_dummy_states
FROM fsms
WHERE visibility = 'public'
GROUP BY category_id;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY fsm_statistics;
```

3. **Partitioning** for large tables:

```sql
-- Partition activity_log by month
CREATE TABLE activity_log_2025_11 PARTITION OF activity_log
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE activity_log_2025_12 PARTITION OF activity_log
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
```

### Connection Pooling

```python
# SQLAlchemy example
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    'postgresql://user:pass@localhost/grayfsm',
    poolclass=QueuePool,
    pool_size=20,  # Number of permanent connections
    max_overflow=10,  # Additional connections when pool is full
    pool_timeout=30,  # Timeout for getting connection
    pool_recycle=3600  # Recycle connections after 1 hour
)
```

### Caching Strategy

1. **Application-Level Cache** (Redis):
   - Cache popular FSMs (TTL: 1 hour)
   - Cache user sessions (TTL: 24 hours)
   - Cache algorithm results (TTL: 7 days)

2. **Database Query Cache**:
   - PostgreSQL: Use prepared statements
   - MongoDB: Query result caching

3. **CDN Caching**:
   - Cache exported HDL files
   - Cache static FSM visualizations

---

## Sample Queries

### Complex Query Examples

#### 1. Find Similar FSMs

```sql
-- Find FSMs with similar structure (state count, transition count)
SELECT
    f2.id, f2.name, f2.state_count, f2.transition_count,
    ABS(f2.state_count - f1.state_count) +
    ABS(f2.transition_count - f1.transition_count) as similarity_score
FROM fsms f1
CROSS JOIN fsms f2
WHERE f1.id = $1  -- Target FSM
    AND f2.id != f1.id
    AND f2.visibility = 'public'
    AND f2.fsm_type = f1.fsm_type
    AND ABS(f2.state_count - f1.state_count) <= 2
    AND ABS(f2.transition_count - f1.transition_count) <= 3
ORDER BY similarity_score ASC
LIMIT 10;
```

#### 2. Algorithm Performance Comparison

```sql
-- Compare average performance of different algorithms
SELECT
    algorithm,
    COUNT(*) as execution_count,
    AVG(dummy_states_added) as avg_dummy_states,
    AVG(improvement_percentage) as avg_improvement,
    AVG(execution_time_ms) as avg_execution_time,
    STDDEV(improvement_percentage) as improvement_stddev,
    MIN(improvement_percentage) as min_improvement,
    MAX(improvement_percentage) as max_improvement
FROM algorithm_results
WHERE success = TRUE
    AND executed_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY algorithm
ORDER BY avg_improvement DESC;
```

#### 3. User Leaderboard

```sql
-- Top contributors by FSM quality and engagement
WITH user_stats AS (
    SELECT
        u.id, u.username, u.display_name,
        COUNT(DISTINCT f.id) as fsms_created,
        SUM(f.view_count) as total_views,
        SUM(f.fork_count) as total_forks,
        AVG(
            (SELECT AVG(value) FROM votes v
             WHERE v.fsm_id = f.id AND v.vote_type = 'star')
        ) as avg_rating,
        SUM(
            (SELECT COUNT(*) FROM votes v
             WHERE v.fsm_id = f.id AND v.vote_type = 'favorite')
        ) as total_favorites
    FROM users u
    LEFT JOIN fsms f ON u.id = f.created_by AND f.visibility = 'public'
    GROUP BY u.id, u.username, u.display_name
)
SELECT
    username, display_name,
    fsms_created, total_views, total_forks,
    ROUND(avg_rating, 2) as avg_rating,
    total_favorites,
    (fsms_created * 10 + total_views + total_forks * 5 +
     total_favorites * 3 + avg_rating * 20) as score
FROM user_stats
WHERE fsms_created > 0
ORDER BY score DESC
LIMIT 50;
```

#### 4. Category Popularity Over Time

```sql
-- Track FSM creation trends by category
SELECT
    c.name as category,
    DATE_TRUNC('month', f.created_at) as month,
    COUNT(*) as fsms_created,
    AVG(f.state_count) as avg_complexity
FROM fsms f
JOIN categories c ON f.category_id = c.id
WHERE f.created_at > CURRENT_TIMESTAMP - INTERVAL '12 months'
GROUP BY c.name, DATE_TRUNC('month', f.created_at)
ORDER BY month DESC, fsms_created DESC;
```

---

## Appendix

### A. Sample Data Seed Script

```sql
-- Seed categories
INSERT INTO categories (id, name, slug, description, level) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Controllers', 'controllers',
 'Control logic FSMs', 0),
('550e8400-e29b-41d4-a716-446655440002', 'Processors', 'processors',
 'CPU and microcontroller FSMs', 0),
('550e8400-e29b-41d4-a716-446655440003', 'Protocols', 'protocols',
 'Communication protocol FSMs', 0),
('550e8400-e29b-41d4-a716-446655440004', 'Academic', 'academic',
 'Educational examples', 0);

-- Seed example FSM
INSERT INTO fsms (
    id, name, description, fsm_type, definition,
    state_count, transition_count, initial_state,
    bit_width, encoding_type, category_id,
    visibility, is_optimized, tags
) VALUES (
    '550e8400-e29b-41d4-a716-446655440100',
    'Traffic Light Controller',
    'Simple 4-state traffic light FSM',
    'moore',
    '{
        "type": "moore",
        "states": [
            {"id": "S0", "label": "Red", "output": "100", "encoding": "00"},
            {"id": "S1", "label": "RedYellow", "output": "110", "encoding": "01"},
            {"id": "S2", "label": "Green", "output": "001", "encoding": "11"},
            {"id": "S3", "label": "Yellow", "output": "010", "encoding": "10"}
        ],
        "transitions": [
            {"from": "S0", "to": "S1", "input": "timer"},
            {"from": "S1", "to": "S2", "input": "timer"},
            {"from": "S2", "to": "S3", "input": "timer"},
            {"from": "S3", "to": "S0", "input": "timer"}
        ],
        "initial_state": "S0"
    }'::jsonb,
    4, 4, 'S0',
    2, 'gray',
    '550e8400-e29b-41d4-a716-446655440001',
    'example', FALSE,
    ARRAY['traffic', 'controller', 'safety']
);
```

### B. Schema Comparison: PostgreSQL vs MongoDB

| Feature | PostgreSQL | MongoDB |
|---------|-----------|---------|
| **Data Model** | Relational (tables, rows) | Document (collections, documents) |
| **Schema** | Strict (defined schema) | Flexible (schema-less) |
| **Transactions** | Full ACID | ACID (multi-document since 4.0) |
| **Joins** | Native SQL joins | $lookup (aggregation) |
| **Indexing** | B-tree, GIN, GiST | B-tree, Text, Geospatial |
| **JSON Support** | JSONB (indexed) | Native |
| **Full-Text Search** | Built-in | Text indexes |
| **Scalability** | Vertical (replica for horizontal) | Horizontal (sharding) |
| **Query Language** | SQL | MQL (MongoDB Query Language) |
| **Use Case** | Complex queries, data integrity | Flexible schema, rapid iteration |

**Recommendation for GrayFSM**:
- **Start with PostgreSQL** for data integrity and rich querying
- **Consider MongoDB** if deploying as simple static site without backend complexity

### C. Connection Strings

**PostgreSQL**:
```
postgresql://username:password@localhost:5432/grayfsm
postgresql://username:password@host.railway.app:5432/railway
```

**MongoDB**:
```
mongodb://username:password@localhost:27017/grayfsm
mongodb+srv://username:password@cluster.mongodb.net/grayfsm
```

### D. Database Size Estimations

**Per FSM Record** (average):
- FSM metadata: ~500 bytes
- FSM definition (JSONB): ~5-50 KB (depends on complexity)
- States (normalized): ~200 bytes × state_count
- Transitions (normalized): ~300 bytes × transition_count
- **Total**: ~10-100 KB per FSM

**Scalability Projections**:
- 10,000 FSMs: ~500 MB - 1 GB
- 100,000 FSMs: ~5-10 GB
- 1,000,000 FSMs: ~50-100 GB

**With Community Features** (Phase 4):
- Add 20-30% for user data, comments, votes
- Activity logs grow significantly (partition by date)

### E. Tools and Libraries

**PostgreSQL Tools**:
- **pgAdmin**: GUI administration
- **psql**: Command-line client
- **Postico** (Mac): Modern PostgreSQL client
- **DBeaver**: Universal database tool

**Migration Tools**:
- **Alembic** (Python): Database migrations
- **Prisma Migrate** (Node.js): Schema migrations
- **Flyway** (Java): Version control for databases

**ORMs**:
- **SQLAlchemy** (Python): Powerful, flexible ORM
- **Prisma** (Node.js/TypeScript): Modern ORM with type safety
- **Django ORM** (Python): Simple, integrated with Django

**MongoDB Tools**:
- **MongoDB Compass**: GUI client
- **mongo shell**: Command-line interface
- **Studio 3T**: Advanced MongoDB GUI

---

## Summary and Recommendations

### For Phase 1 (MVP - Weeks 1-8)

**Minimal Schema**:
1. Start with `fsms` table only (embed everything in JSONB)
2. Add `algorithm_results` table for benchmarking
3. Add `categories` table for organization
4. Skip user management (use anonymous creation)

**Technology**:
- **PostgreSQL** on free tier (Supabase, Railway, ElephantSQL)
- OR **MongoDB Atlas** free tier
- OR **LocalStorage/IndexedDB** for pure frontend MVP

### For Phase 2-3 (Enhanced Product - Weeks 9-24)

**Add Tables**:
1. Normalize `states` and `transitions` (optional)
2. Add `export_cache` for performance
3. Add `benchmarks` for research features

**Technology**:
- Scale up PostgreSQL instance
- Implement connection pooling
- Add Redis for caching

### For Phase 4 (Community Platform - Weeks 25+)

**Full Schema**:
1. Add all community tables (`users`, `shares`, `comments`, `votes`)
2. Implement row-level security
3. Add activity logging and analytics

**Technology**:
- Managed PostgreSQL (RDS, Cloud SQL)
- Redis for sessions and caching
- CDN for static exports

### Final Recommendation

**Start with PostgreSQL + JSONB hybrid approach**:
- Leverage relational model for metadata and relationships
- Use JSONB for flexible FSM definitions
- Easy migration path to full normalized schema if needed
- Best of both worlds: structure + flexibility

**Deployment Path**:
1. **Week 1-8**: Local PostgreSQL or Supabase free tier
2. **Week 9-16**: Railway/Render managed PostgreSQL
3. **Week 17+**: AWS RDS or Google Cloud SQL for production scale

---

**Document Version**: 1.0
**Last Updated**: November 29, 2025
**Next Review**: Phase 1 Completion (Week 8)

For questions or suggestions, please contact the database team or open an issue on the project repository.
