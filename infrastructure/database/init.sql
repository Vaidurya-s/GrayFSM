-- GrayFSM Database Initialization Script
-- Run this script to initialize the PostgreSQL database for GrayFSM

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE grayfsm'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'grayfsm')\gexec

-- Connect to the grayfsm database
\c grayfsm

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schema for application
CREATE SCHEMA IF NOT EXISTS app;

-- Set search path
ALTER DATABASE grayfsm SET search_path TO app, public;

-- Create base tables (these will be managed by Alembic migrations)
-- This is just initialization; actual schema is in migrations

-- Create audit table
CREATE TABLE IF NOT EXISTS app.audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by VARCHAR(255),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create index on audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON app.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON app.audit_log(changed_at DESC);

-- Create deployment tracking table
CREATE TABLE IF NOT EXISTS app.deployment_info (
    id SERIAL PRIMARY KEY,
    deployment_id VARCHAR(255) UNIQUE NOT NULL,
    version VARCHAR(50) NOT NULL,
    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deployed_by VARCHAR(255),
    environment VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    metadata JSONB
);

-- Create health check history table
CREATE TABLE IF NOT EXISTS app.health_check_history (
    id BIGSERIAL PRIMARY KEY,
    check_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    service_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_health_check_timestamp ON app.health_check_history(check_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_check_service ON app.health_check_history(service_name, check_timestamp DESC);

-- Create function to update deployment info
CREATE OR REPLACE FUNCTION app.update_deployment_info(
    p_deployment_id VARCHAR,
    p_version VARCHAR,
    p_deployed_by VARCHAR,
    p_environment VARCHAR,
    p_status VARCHAR
)
RETURNS void AS $$
BEGIN
    INSERT INTO app.deployment_info (deployment_id, version, deployed_by, environment, status)
    VALUES (p_deployment_id, p_version, p_deployed_by, p_environment, p_status)
    ON CONFLICT (deployment_id) DO UPDATE SET
        status = EXCLUDED.status,
        deployed_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create function for audit logging
CREATE OR REPLACE FUNCTION app.audit_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO app.audit_log (table_name, record_id, action, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO app.audit_log (table_name, record_id, action, old_values, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO app.audit_log (table_name, record_id, action, old_values)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD));
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT CONNECT ON DATABASE grayfsm TO grayfsm;
GRANT USAGE ON SCHEMA app TO grayfsm;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app TO grayfsm;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO grayfsm;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app TO grayfsm;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL PRIVILEGES ON TABLES TO grayfsm;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL PRIVILEGES ON SEQUENCES TO grayfsm;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT ALL PRIVILEGES ON FUNCTIONS TO grayfsm;

-- Create read-only role for backups
CREATE ROLE grayfsm_readonly;
GRANT CONNECT ON DATABASE grayfsm TO grayfsm_readonly;
GRANT USAGE ON SCHEMA app TO grayfsm_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO grayfsm_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO grayfsm_readonly;

-- Create replication role for high availability
CREATE ROLE grayfsm_replication LOGIN REPLICATION;

-- Log initialization completion
SELECT now() as initialization_completed;
