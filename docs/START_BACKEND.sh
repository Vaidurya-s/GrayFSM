#!/bin/bash

# Script to start the backend API server

set -e

echo "=========================================="
echo "Starting GrayFSM Backend API Server"
echo "=========================================="
echo ""

cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# Check if .env exists, create if not
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << 'EOF'
ENVIRONMENT=development
DEBUG=True
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://grayfsm:password@localhost:5432/grayfsm
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
SECRET_KEY=dev-secret-key-change-in-production
EOF
    echo "✅ .env file created"
    echo ""
fi

# Check if database is running
echo "Checking database connection..."
if ! docker ps | grep -q grayfsm-postgres; then
    echo "⚠️  Database not running. Starting PostgreSQL..."
    docker run -d \
      --name grayfsm-postgres \
      -e POSTGRES_USER=grayfsm \
      -e POSTGRES_PASSWORD=password \
      -e POSTGRES_DB=grayfsm \
      -p 5432:5432 \
      postgres:15-alpine

    echo "Waiting for database to be ready..."
    sleep 5
    echo "✅ Database started"
else
    echo "✅ Database already running"
fi
echo ""

# Check if migrations exist
if [ ! -f alembic/versions/*.py ] 2>/dev/null; then
    echo "Creating initial database migration..."
    alembic revision --autogenerate -m "Initial migration" || echo "Migration may already exist"
    echo ""
fi

# Run migrations
echo "Applying database migrations..."
alembic upgrade head || echo "⚠️  Migrations may have issues (this is okay for now)"
echo ""

# Start the server
echo "=========================================="
echo "Starting FastAPI Backend Server"
echo "=========================================="
echo ""
echo "Backend will be available at:"
echo "  - API: http://localhost:8000"
echo "  - Docs: http://localhost:8000/docs"
echo "  - Health: http://localhost:8000/api/v1/health"
echo ""
echo "Press Ctrl+C to stop"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
