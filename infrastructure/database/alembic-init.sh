#!/bin/bash
# Alembic initialization script for GrayFSM
# This script initializes Alembic migration system if not already done

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "Initializing Alembic for GrayFSM Backend"
echo "Project Root: $PROJECT_ROOT"
echo "Backend Directory: $BACKEND_DIR"

# Check if alembic.ini exists
if [ ! -f "$BACKEND_DIR/alembic.ini" ]; then
    echo "Initializing Alembic in $BACKEND_DIR..."
    cd "$BACKEND_DIR"
    alembic init alembic
    echo "Alembic initialized successfully"
else
    echo "Alembic already initialized"
fi

# Check if env.py has database URL setup
if grep -q "sqlalchemy.url" "$BACKEND_DIR/alembic.ini"; then
    echo "alembic.ini already has database configuration"
else
    echo "Updating alembic.ini with database URL template"
    sed -i.bak 's/sqlalchemy.url = driver:\/\/user:pass@localhost\/dbname/sqlalchemy.url = postgresql:\/\/user:password@localhost\/grayfsm/' "$BACKEND_DIR/alembic.ini"
fi

# Create initial migration if none exist
MIGRATION_COUNT=$(find "$BACKEND_DIR/alembic/versions" -name "*.py" -type f 2>/dev/null | wc -l)
if [ "$MIGRATION_COUNT" -eq 0 ]; then
    echo "Creating initial migration..."
    cd "$BACKEND_DIR"
    alembic revision --autogenerate -m "Initial migration"
    echo "Initial migration created"
else
    echo "Migrations already exist ($MIGRATION_COUNT found)"
fi

echo "Alembic initialization complete"
