#!/bin/bash

echo "Starting GrayFSM System..."

# Kill any existing backends
pkill -f "uvicorn app.main:app" || true

# Start database if not running
if ! docker ps | grep -q grayfsm-postgres; then
    docker start grayfsm-postgres
    echo "Waiting for database..."
    sleep 5
fi

# Start backend
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 9000
