#!/bin/bash
set -e

echo "🚀 Starting GrayFSM System..."
echo ""

# Check database
echo "📊 Checking PostgreSQL..."
if ! docker ps | grep -q grayfsm-postgres; then
    echo "   Starting Docker container..."
    docker start grayfsm-postgres || docker run -d --name grayfsm-postgres \
      -e POSTGRES_USER=grayfsm \
      -e POSTGRES_PASSWORD=password \
      -e POSTGRES_DB=grayfsm \
      -p 5434:5432 \
      postgres:15-alpine
    sleep 3
else
    echo "   ✅ Database already running"
fi

# Start backend
echo ""
echo "🔧 Starting Backend on port 9000..."
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 9000 &
BACKEND_PID=$!

echo "   ✅ Backend started (PID: $BACKEND_PID)"
echo ""
echo "✨ System started successfully!"
echo ""
echo "📍 Backend: http://localhost:9000"
echo "📍 API Docs: http://localhost:9000/docs"
echo "📍 Frontend: Start with 'cd frontend && npm run dev'"
echo ""
echo "To stop: kill $BACKEND_PID"
