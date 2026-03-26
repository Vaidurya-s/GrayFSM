#!/bin/bash
# ================================================================
# GrayFSM Database Restore Script
# Restores PostgreSQL database from backup file
# ================================================================

set -euo pipefail

# ----------------------------------------------------------------
# CONFIGURATION
# ----------------------------------------------------------------

# Load environment variables
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Database configuration
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-grayfsm}"
POSTGRES_USER="${POSTGRES_USER:-grayfsm_user}"
PGPASSWORD="${POSTGRES_PASSWORD:-grayfsm_password}"
export PGPASSWORD

# ----------------------------------------------------------------
# LOGGING
# ----------------------------------------------------------------

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# ----------------------------------------------------------------
# USAGE
# ----------------------------------------------------------------

usage() {
    cat <<EOF
Usage: $0 <backup_file> [options]

Restore PostgreSQL database from backup file.

Arguments:
    backup_file     Path to backup file (.sql or .sql.gz)

Options:
    --force         Skip confirmation prompt
    --create-db     Create database if it doesn't exist
    -h, --help      Show this help message

Examples:
    $0 backups/grayfsm_backup_20251129.sql.gz
    $0 backups/latest.sql --force
    $0 backups/grayfsm_backup_20251129.sql.gz --create-db

EOF
    exit 1
}

# ----------------------------------------------------------------
# ARGUMENT PARSING
# ----------------------------------------------------------------

BACKUP_FILE=""
FORCE=false
CREATE_DB=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --create-db)
            CREATE_DB=true
            shift
            ;;
        *)
            if [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$1"
            else
                error "Unknown argument: $1"
                usage
            fi
            shift
            ;;
    esac
done

# Check if backup file provided
if [ -z "$BACKUP_FILE" ]; then
    error "No backup file specified"
    usage
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# ----------------------------------------------------------------
# CONFIRMATION
# ----------------------------------------------------------------

log "================================================================"
log "GrayFSM Database Restore"
log "================================================================"
log "Database: $POSTGRES_DB"
log "Host: $POSTGRES_HOST:$POSTGRES_PORT"
log "Backup file: $BACKUP_FILE"
log "================================================================"

if [ "$FORCE" = false ]; then
    echo ""
    echo "WARNING: This will DROP and recreate the database!"
    echo "All existing data will be lost!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM

    if [ "$CONFIRM" != "yes" ]; then
        log "Restore cancelled by user"
        exit 0
    fi
fi

# ----------------------------------------------------------------
# PRE-RESTORE BACKUP
# ----------------------------------------------------------------

log "Creating pre-restore backup..."
PRE_RESTORE_BACKUP="./backups/pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"

if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$PRE_RESTORE_BACKUP" 2>/dev/null; then
    log "Pre-restore backup created: $PRE_RESTORE_BACKUP"
else
    log "Warning: Could not create pre-restore backup (database may not exist)"
fi

# ----------------------------------------------------------------
# DATABASE RECREATION
# ----------------------------------------------------------------

if [ "$CREATE_DB" = true ]; then
    log "Creating database: $POSTGRES_DB"

    # Connect to postgres database to create new database
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres <<EOF
DROP DATABASE IF EXISTS $POSTGRES_DB;
CREATE DATABASE $POSTGRES_DB OWNER $POSTGRES_USER;
EOF

    log "Database created"
fi

# ----------------------------------------------------------------
# RESTORE PROCESS
# ----------------------------------------------------------------

log "Starting restore process..."

# Decompress if needed and pipe to psql
if [[ "$BACKUP_FILE" == *.gz ]]; then
    log "Decompressing and restoring backup..."
    if gunzip -c "$BACKUP_FILE" | psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" 2>&1 | tee restore.log; then
        log "Restore completed successfully"
    else
        error "Restore failed. Check restore.log for details"
        exit 1
    fi
else
    log "Restoring backup..."
    if psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$BACKUP_FILE" 2>&1 | tee restore.log; then
        log "Restore completed successfully"
    else
        error "Restore failed. Check restore.log for details"
        exit 1
    fi
fi

# ----------------------------------------------------------------
# POST-RESTORE VERIFICATION
# ----------------------------------------------------------------

log "Verifying restore..."

# Check table count
TABLE_COUNT=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
SELECT COUNT(*)
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
")

log "Restored tables: $TABLE_COUNT"

if [ "$TABLE_COUNT" -eq 0 ]; then
    error "No tables found after restore"
    exit 1
fi

# Check sample data
FSM_COUNT=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
SELECT COUNT(*) FROM fsms
" 2>/dev/null || echo "0")

log "FSM records: $FSM_COUNT"

# ----------------------------------------------------------------
# POST-RESTORE MAINTENANCE
# ----------------------------------------------------------------

log "Running post-restore maintenance..."

psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<EOF
-- Analyze tables for query planner
ANALYZE;

-- Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY trending_fsms;
REFRESH MATERIALIZED VIEW CONCURRENTLY category_statistics;

-- Vacuum to reclaim space
VACUUM ANALYZE;
EOF

log "Post-restore maintenance completed"

# ----------------------------------------------------------------
# RESTORE SUMMARY
# ----------------------------------------------------------------

log "================================================================"
log "Restore Summary"
log "================================================================"
log "Database: $POSTGRES_DB"
log "Backup file: $BACKUP_FILE"
log "Tables restored: $TABLE_COUNT"
log "FSM records: $FSM_COUNT"
log "Pre-restore backup: $PRE_RESTORE_BACKUP"
log "================================================================"
log "Restore completed successfully!"
log "================================================================"

exit 0
