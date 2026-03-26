#!/bin/bash

# GrayFSM - Complete Installation Script
# Run this script to install all dependencies for both backend and frontend

set -e  # Exit on error

echo "=========================================="
echo "GrayFSM Installation Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check network connectivity
echo "Checking network connectivity..."
if ! ping -c 1 google.com &> /dev/null; then
    echo -e "${RED}❌ Network connectivity issue detected!${NC}"
    echo "Please check your internet connection and try again."
    exit 1
fi
echo -e "${GREEN}✅ Network OK${NC}"
echo ""

# Backend Installation
echo "=========================================="
echo "Installing Backend Dependencies"
echo "=========================================="

cd /home/arunupscee/Music/grayFSM/backend

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip setuptools wheel

# Install dependencies
echo "Installing dependencies from requirements.txt..."
pip install -r requirements.txt

# Install grayfsm package in development mode
echo "Installing grayfsm package..."
pip install -e .

echo -e "${GREEN}✅ Backend dependencies installed!${NC}"
echo ""

# Test backend
echo "Testing backend installation..."
if python -c "import fastapi, uvicorn, sqlalchemy, networkx" 2>/dev/null; then
    echo -e "${GREEN}✅ Backend imports successful!${NC}"
else
    echo -e "${RED}❌ Backend imports failed!${NC}"
    exit 1
fi
echo ""

# Frontend Installation
echo "=========================================="
echo "Installing Frontend Dependencies"
echo "=========================================="

cd /home/arunupscee/Music/grayFSM/frontend

echo "Installing npm packages (this may take a few minutes)..."
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend dependencies installed!${NC}"
else
    echo -e "${RED}❌ Frontend installation failed!${NC}"
    exit 1
fi
echo ""

# Summary
echo "=========================================="
echo "Installation Complete! 🎉"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Start PostgreSQL database:"
echo "   docker run -d --name grayfsm-postgres \\"
echo "     -e POSTGRES_USER=grayfsm \\"
echo "     -e POSTGRES_PASSWORD=password \\"
echo "     -e POSTGRES_DB=grayfsm \\"
echo "     -p 5432:5432 postgres:15-alpine"
echo ""
echo "2. Initialize database:"
echo "   cd /home/arunupscee/Music/grayFSM/backend"
echo "   source venv/bin/activate"
echo "   alembic revision --autogenerate -m \"Initial migration\""
echo "   alembic upgrade head"
echo ""
echo "3. Start backend:"
echo "   uvicorn app.main:app --reload"
echo ""
echo "4. Start frontend (in new terminal):"
echo "   cd /home/arunupscee/Music/grayFSM/frontend"
echo "   npm run dev"
echo ""
echo "5. Test CLI tool:"
echo "   cd /home/arunupscee/Music/grayFSM/backend"
echo "   source venv/bin/activate"
echo "   grayfsm optimize --input examples/traffic_light.json --output result.json"
echo ""
echo "Access points:"
echo "  - Frontend: http://localhost:5173"
echo "  - Backend API: http://localhost:8000"
echo "  - API Docs: http://localhost:8000/docs"
echo ""
