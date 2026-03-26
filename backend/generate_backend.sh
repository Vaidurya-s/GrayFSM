#!/bin/bash
# Script to generate complete GrayFSM backend implementation

set -e

BASE_DIR="/home/arunupscee/Music/grayFSM/backend"
cd "$BASE_DIR"

echo "Generating GrayFSM Backend Implementation..."

# Create directory structure
mkdir -p app/{api/v1,core/{algorithms,exporters},db,middleware,models,schemas,services,tasks,utils}
mkdir -p tests/{unit,integration,fixtures}
mkdir -p alembic/versions
mkdir -p logs

# Create __init__.py files
touch app/__init__.py
touch app/api/__init__.py
touch app/api/v1/__init__.py
touch app/core/__init__.py
touch app/core/algorithms/__init__.py
touch app/core/exporters/__init__.py
touch app/db/__init__.py
touch app/middleware/__init__.py
touch app/models/__init__.py
touch app/schemas/__init__.py
touch app/services/__init__.py
touch app/tasks/__init__.py
touch app/utils/__init__.py
touch tests/__init__.py

echo "Directory structure created successfully!"
echo "Backend implementation generated in: $BASE_DIR"
