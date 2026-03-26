-- ================================================================
-- GrayFSM Database Initialization - Extensions
-- This script installs required PostgreSQL extensions
-- ================================================================

-- UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation functions';

-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
COMMENT ON EXTENSION "pgcrypto" IS 'Cryptographic functions for password hashing';

-- Trigram similarity for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
COMMENT ON EXTENSION "pg_trgm" IS 'Trigram similarity for text search';

-- Query statistics tracking
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
COMMENT ON EXTENSION "pg_stat_statements" IS 'Track execution statistics of SQL statements';

-- Table bloat monitoring
CREATE EXTENSION IF NOT EXISTS "pgstattuple";
COMMENT ON EXTENSION "pgstattuple" IS 'Get tuple-level statistics for tables';

-- B-tree index debugging
CREATE EXTENSION IF NOT EXISTS "pageinspect";
COMMENT ON EXTENSION "pageinspect" IS 'Inspect the contents of database pages';

-- Display installed extensions
SELECT extname, extversion, extnamespace::regnamespace AS schema
FROM pg_extension
ORDER BY extname;

\echo 'PostgreSQL extensions installed successfully!'
