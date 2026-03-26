-- ================================================================
-- GrayFSM Database Schema Initialization
-- This script creates the complete database schema
-- Source: /home/arunupscee/Music/grayFSM/database-schema.sql
-- ================================================================

-- Import the main schema
\i /docker-entrypoint-initdb.d/../database-schema.sql

\echo 'Database schema created successfully!'
