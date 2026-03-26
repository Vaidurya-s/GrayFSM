#!/bin/bash
# ================================================================
# GrayFSM Database Initial Setup Script
# Initializes database, runs migrations, and loads seed data
# ================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ----------------------------------------------------------------
# FUNCTIONS
# ----------------------------------------------------------------

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $*"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $*" >&2
}

# ----------------------------------------------------------------
# MAIN SETUP
# ----------------------------------------------------------------

log "========================================"
log "GrayFSM Database Setup"
log "========================================"

# Check if .env exists
if [ ! -f ".env" ]; then
    warn ".env file not found, creating from .env.example"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log "Created .env file. Please update with your credentials."
    else
        error ".env.example not found"
        exit 1
    fi
fi

# Make scripts executable
log "Making scripts executable..."
chmod +x scripts/*.sh

# Start Docker containers
log "Starting Docker containers..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
log "Waiting for PostgreSQL to be ready..."
sleep 5

MAX_RETRIES=30
RETRY_COUNT=0

while ! docker-compose exec -T postgres pg_isready -U grayfsm_user -d grayfsm >/dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        error "PostgreSQL failed to start after $MAX_RETRIES attempts"
        exit 1
    fi
    echo -n "."
    sleep 1
done

log "PostgreSQL is ready!"

# Run initialization scripts
log "Running initialization scripts..."

# Extensions
log "Installing PostgreSQL extensions..."
docker-compose exec -T postgres psql -U grayfsm_user -d grayfsm < init/01_extensions.sql

# Schema (copy schema file to container first)
log "Creating database schema..."
docker cp /home/arunupscee/Music/grayFSM/database-schema.sql grayfsm_postgres:/tmp/database-schema.sql
docker-compose exec -T postgres psql -U grayfsm_user -d grayfsm -f /tmp/database-schema.sql

# Seed data
log "Loading seed data..."
docker-compose exec -T postgres psql -U grayfsm_user -d grayfsm < init/03_seed_data.sql

# Stored procedures
log "Creating stored procedures and functions..."
docker-compose exec -T postgres psql -U grayfsm_user -d grayfsm < queries/stored_procedures.sql

# Verify installation
log "Verifying installation..."

TABLE_COUNT=$(docker-compose exec -T postgres psql -U grayfsm_user -d grayfsm -t -c "
SELECT COUNT(*)
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
" | xargs)

log "Tables created: $TABLE_COUNT"

FSM_COUNT=$(docker-compose exec -T postgres psql -U grayfsm_user -d grayfsm -t -c "
SELECT COUNT(*) FROM fsms
" | xargs)

log "Example FSMs loaded: $FSM_COUNT"

# Create initial backup
log "Creating initial backup..."
./scripts/backup.sh

log "========================================"
log "Setup Complete!"
log "========================================"
log ""
log "Database is ready for use:"
log "  - PostgreSQL running on port 5432"
log "  - Database: grayfsm"
log "  - User: grayfsm_user"
log ""
log "Optional services (start with --profile):"
log "  - pgAdmin: docker-compose --profile tools up -d pgadmin"
log "  - Redis:   docker-compose --profile cache up -d redis"
log ""
log "Management commands:"
log "  - Backup:  ./scripts/backup.sh"
log "  - Restore: ./scripts/restore.sh <backup_file>"
log "  - Monitor: ./scripts/monitor.sh"
log ""
log "pgAdmin Access (if started):"
log "  - URL: http://localhost:5050"
log "  - Email: admin@grayfsm.com"
log "  - Password: admin"
log "========================================"

exit 0
