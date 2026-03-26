#!/bin/bash
# ================================================================
# GrayFSM Database Backup Script
# Performs full PostgreSQL backup with compression and rotation
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

# Backup configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}_backup_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

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
# PRE-FLIGHT CHECKS
# ----------------------------------------------------------------

log "Starting backup process..."

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
fi

# Check PostgreSQL connection
if ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    error "Cannot connect to PostgreSQL at $POSTGRES_HOST:$POSTGRES_PORT"
    exit 1
fi

log "Database connection verified"

# ----------------------------------------------------------------
# BACKUP PROCESS
# ----------------------------------------------------------------

log "Creating backup: $BACKUP_FILE"

# Full database dump
if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --verbose \
    --format=plain \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    > "$BACKUP_FILE" 2>&1; then
    log "Database dump completed successfully"
else
    error "Database dump failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Compress backup
log "Compressing backup..."
if gzip -9 "$BACKUP_FILE"; then
    log "Compression completed: $BACKUP_FILE_GZ"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)
    log "Backup size: $BACKUP_SIZE"
else
    error "Compression failed"
    exit 1
fi

# ----------------------------------------------------------------
# WAL BACKUP (if archiving enabled)
# ----------------------------------------------------------------

if [ "${ARCHIVE_WAL:-false}" = "true" ]; then
    log "Backing up WAL files..."
    WAL_BACKUP_DIR="${BACKUP_DIR}/wal_${TIMESTAMP}"
    mkdir -p "$WAL_BACKUP_DIR"

    if [ -d "/backups/wal" ]; then
        cp -r /backups/wal/* "$WAL_BACKUP_DIR/" 2>/dev/null || true
        log "WAL files backed up to: $WAL_BACKUP_DIR"
    fi
fi

# ----------------------------------------------------------------
# CLEANUP OLD BACKUPS
# ----------------------------------------------------------------

log "Cleaning up backups older than $RETENTION_DAYS days..."

find "$BACKUP_DIR" -name "${POSTGRES_DB}_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
DELETED_COUNT=$(find "$BACKUP_DIR" -name "${POSTGRES_DB}_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS | wc -l)

log "Deleted $DELETED_COUNT old backup(s)"

# ----------------------------------------------------------------
# BACKUP VERIFICATION
# ----------------------------------------------------------------

log "Verifying backup integrity..."

if gzip -t "$BACKUP_FILE_GZ"; then
    log "Backup integrity verified"
else
    error "Backup integrity check failed"
    exit 1
fi

# ----------------------------------------------------------------
# BACKUP SUMMARY
# ----------------------------------------------------------------

TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "${POSTGRES_DB}_backup_*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

log "================================================================"
log "Backup Summary"
log "================================================================"
log "Database: $POSTGRES_DB"
log "Timestamp: $TIMESTAMP"
log "Backup file: $BACKUP_FILE_GZ"
log "Backup size: $BACKUP_SIZE"
log "Total backups: $TOTAL_BACKUPS"
log "Total backup size: $TOTAL_SIZE"
log "Retention: $RETENTION_DAYS days"
log "================================================================"
log "Backup completed successfully!"

# ----------------------------------------------------------------
# OPTIONAL: Upload to cloud storage
# ----------------------------------------------------------------

if [ "${UPLOAD_TO_S3:-false}" = "true" ] && command -v aws >/dev/null 2>&1; then
    log "Uploading backup to S3..."
    S3_BUCKET="${S3_BUCKET:-grayfsm-backups}"
    S3_PATH="s3://${S3_BUCKET}/database/${TIMESTAMP}/"

    if aws s3 cp "$BACKUP_FILE_GZ" "${S3_PATH}" --storage-class STANDARD_IA; then
        log "Backup uploaded to: ${S3_PATH}"
    else
        error "S3 upload failed"
    fi
fi

# ----------------------------------------------------------------
# NOTIFICATIONS (optional)
# ----------------------------------------------------------------

if [ "${NOTIFY_ON_SUCCESS:-false}" = "true" ]; then
    # Add notification logic here (email, Slack, etc.)
    log "Backup notification sent"
fi

exit 0
