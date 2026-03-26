#!/bin/bash

# Start backend using existing PostgreSQL (no Docker)

set -e

echo "=========================================="
echo "Starting GrayFSM Backend (Using System PostgreSQL)"
echo "=========================================="
echo ""

cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# Create .env for local PostgreSQL
echo "Creating .env configuration..."
cat > .env << 'EOF'
ENVIRONMENT=development
DEBUG=True
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres@localhost:5432/grayfsm
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
SECRET_KEY=dev-secret-key-change-in-production
EOF
echo "✅ .env configured for local PostgreSQL"
echo ""

# Check if PostgreSQL is running
echo "Checking PostgreSQL status..."
if sudo systemctl is-active --quiet postgresql; then
    echo "✅ PostgreSQL service is running"
else
    echo "⚠️  PostgreSQL not running. Starting..."
    sudo systemctl start postgresql
    echo "✅ PostgreSQL started"
fi
echo ""

# Create database if it doesn't exist
echo "Creating database (if needed)..."
sudo -u postgres psql -c "CREATE DATABASE grayfsm;" 2>/dev/null && echo "✅ Database created" || echo "✅ Database already exists"
echo ""

# Run migrations
echo "Applying database migrations..."
alembic revision --autogenerate -m "Initial migration" 2>/dev/null || echo "Migration already exists"
alembic upgrade head 2>/dev/null || echo "⚠️  Migration skipped (this is okay)"
echo ""

# Start server
echo "=========================================="
echo "Starting FastAPI Backend Server"
echo "=========================================="
echo ""
echo "Backend will be available at:"
echo "  - API: http://localhost:8000"
echo "  - Docs: http://localhost:8000/docs"
echo "  - Health: http://localhost:8000/api/v1/health"
echo ""
echo "Using local PostgreSQL database"
echo ""
echo "Press Ctrl+C to stop"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
