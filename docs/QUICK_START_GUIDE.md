# GrayFSM - Quick Start Guide

## 📋 Table of Contents
1. [System Status](#system-status)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Running the Application](#running-the-application)
5. [Using the CLI Tool](#using-the-cli-tool)
6. [API Documentation](#api-documentation)
7. [Troubleshooting](#troubleshooting)
8. [Development Workflow](#development-workflow)

---

## 🎯 System Status

### ✅ Functional Components
- Backend API (FastAPI) - Partially working
- Database models (PostgreSQL + SQLAlchemy)
- Core algorithms (Gray code, hypercube)
- CLI tool for FSM optimization
- Testing infrastructure (E2E, Integration, Contract tests)
- Infrastructure (Docker, Kubernetes, CI/CD)
- Frontend foundation (React + TypeScript) - **NEW!**

### ⚠️ Known Limitations
- Optimization endpoint returns 501 (not yet implemented in API)
- Export endpoints stubbed (Verilog/VHDL generation incomplete)
- No user authentication system
- Rate limiting not implemented
- Frontend is minimal MVP (basic FSM listing only)

---

## 📦 Prerequisites

### Required Software
```bash
# Check your versions:
node --version    # Need v18.0.0 or higher
npm --version     # Need v9.0.0 or higher
python --version  # Need 3.10 or higher
docker --version  # Need 20.0 or higher
```

### System Requirements
- **OS**: Linux, macOS, or Windows with WSL2
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk**: 2GB free space

---

## 🔧 Environment Setup

### 1. Backend Environment

```bash
# Navigate to backend directory
cd /home/arunupscee/Music/grayFSM/backend

# Create .env file
cat > .env << 'EOF'
# Application
ENVIRONMENT=development
DEBUG=True
HOST=0.0.0.0
PORT=8000

# Database
DATABASE_URL=postgresql+asyncpg://grayfsm:password@localhost:5432/grayfsm

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# CORS
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]

# Security (⚠️ CHANGE IN PRODUCTION!)
SECRET_KEY=dev-secret-key-change-in-production-abc123

# Algorithms
DEFAULT_ALGORITHM=greedy
MAX_FSM_STATES=256
EOF
```

### 2. Frontend Environment

```bash
# Navigate to frontend directory
cd /home/arunupscee/Music/grayFSM/frontend

# Create .env.local file
cat > .env.local << 'EOF'
VITE_API_BASE_URL=http://localhost:8000/api/v1
EOF
```

---

## 🚀 Running the Application

### Option 1: Docker Compose (Recommended)

**Easiest way to run everything:**

```bash
# Navigate to infrastructure directory
cd /home/arunupscee/Music/grayFSM/infrastructure/docker

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

**Access Points:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Database Admin (Adminer): http://localhost:8080
- Database Admin (pgAdmin): http://localhost:5050

**Default Credentials:**
- PostgreSQL: `grayfsm` / `password`
- Redis: `changeme`
- pgAdmin: `admin@example.com` / `admin`

---

### Option 2: Manual Development Setup

#### Step 1: Start Database

```bash
# Start PostgreSQL using Docker
docker run -d \
  --name grayfsm-postgres \
  -e POSTGRES_USER=grayfsm \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=grayfsm \
  -p 5432:5432 \
  postgres:15-alpine

# (Optional) Start Redis
docker run -d \
  --name grayfsm-redis \
  -p 6379:6379 \
  redis:7-alpine
```

#### Step 2: Start Backend

```bash
# Navigate to backend
cd /home/arunupscee/Music/grayFSM/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# OR
venv\Scripts\activate  # Windows

# Install dependencies
pip install poetry
poetry install

# Run database migrations (create tables)
# First time only:
poetry run alembic revision --autogenerate -m "Initial migration"
poetry run alembic upgrade head

# Start backend server
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Backend will be available at:**
- API: http://localhost:8000
- Interactive Docs: http://localhost:8000/docs
- OpenAPI JSON: http://localhost:8000/openapi.json
- Health Check: http://localhost:8000/api/v1/health

#### Step 3: Start Frontend

```bash
# Open new terminal
cd /home/arunupscee/Music/grayFSM/frontend

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

**Frontend will be available at:**
- Application: http://localhost:5173
- Hot reload enabled

---

## 🛠️ Using the CLI Tool

The CLI tool works independently and is the **most functional** part of the system right now.

### Basic Usage

```bash
cd /home/arunupscee/Music/grayFSM/backend

# Activate virtual environment
source venv/bin/activate

# Run optimization on example FSM
python -m grayfsm.cli optimize \
  --input examples/traffic_light.json \
  --algorithm greedy \
  --output optimized_fsm.json

# View results
cat optimized_fsm.json | python -m json.tool
```

### Available Example FSMs

```bash
ls backend/examples/
# - traffic_light.json      (Simple traffic light controller)
# - vending_machine.json    (Coin-operated vending machine)
# - sequence_detector.json  (Pattern detection FSM)
# - elevator.json           (Multi-floor elevator controller)
```

### CLI Options

```bash
python -m grayfsm.cli --help

# Options:
# --input FILE        Input FSM JSON file (required)
# --algorithm NAME    Algorithm to use (greedy, bfs_optimal) [default: greedy]
# --output FILE       Output file for optimized FSM
# --verbose          Show detailed optimization steps
```

### Example FSM JSON Format

```json
{
  "name": "Traffic Light",
  "type": "moore",
  "states": [
    {"name": "Red", "output": "00"},
    {"name": "Yellow", "output": "01"},
    {"name": "Green", "output": "10"}
  ],
  "transitions": [
    {"from": "Red", "to": "Green", "input": "timer"},
    {"from": "Green", "to": "Yellow", "input": "timer"},
    {"from": "Yellow", "to": "Red", "input": "timer"}
  ],
  "initial_state": "Red"
}
```

---

## 📚 API Documentation

### Health Check

```bash
curl http://localhost:8000/api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "message": "GrayFSM API is running",
  "version": "1.0.0",
  "environment": "development",
  "database": "connected"
}
```

### Create FSM

```bash
curl -X POST http://localhost:8000/api/v1/fsms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Simple FSM",
    "fsm_type": "moore",
    "states": ["S0", "S1", "S2"],
    "transitions": [
      {"from_state": "S0", "to_state": "S1", "input": "a"},
      {"from_state": "S1", "to_state": "S2", "input": "b"},
      {"from_state": "S2", "to_state": "S0", "input": "c"}
    ],
    "initial_state": "S0"
  }'
```

### List FSMs

```bash
curl http://localhost:8000/api/v1/fsms?skip=0&limit=10
```

### Get FSM by ID

```bash
curl http://localhost:8000/api/v1/fsms/{fsm_id}
```

### Delete FSM

```bash
curl -X DELETE http://localhost:8000/api/v1/fsms/{fsm_id}
```

### Optimize FSM (⚠️ Not Implemented Yet)

```bash
curl -X POST http://localhost:8000/api/v1/fsms/{fsm_id}/optimize \
  -H "Content-Type: application/json" \
  -d '{"algorithm": "greedy"}'

# Currently returns: 501 Not Implemented
```

---

## 🔍 Troubleshooting

### Frontend Issues

#### Problem: "Cannot GET /"
```bash
# Solution: Check if npm install completed
cd /home/arunupscee/Music/grayFSM/frontend
npm install

# Then restart dev server
npm run dev
```

#### Problem: "Failed to fetch FSMs"
```bash
# Check if backend is running
curl http://localhost:8000/api/v1/health

# Check CORS settings in backend/.env
# Ensure frontend URL is in CORS_ORIGINS
```

### Backend Issues

#### Problem: "ModuleNotFoundError: No module named 'sqlalchemy'"
```bash
# Install dependencies
cd /home/arunupscee/Music/grayFSM/backend
poetry install
```

#### Problem: "Connection refused" to database
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not running:
docker start grayfsm-postgres

# Or create new container (see database setup above)
```

#### Problem: "relation 'fsms' does not exist"
```bash
# Run migrations to create tables
cd /home/arunupscee/Music/grayFSM/backend
poetry run alembic revision --autogenerate -m "Initial migration"
poetry run alembic upgrade head
```

### Docker Issues

#### Problem: "Cannot connect to Docker daemon"
```bash
# Start Docker service
sudo systemctl start docker

# Or on macOS/Windows
# Start Docker Desktop application
```

#### Problem: "Port already in use"
```bash
# Find and kill process using port
sudo lsof -i :8000  # For backend
sudo lsof -i :3000  # For frontend
sudo lsof -i :5432  # For PostgreSQL

# Kill process
sudo kill -9 <PID>
```

---

## 💻 Development Workflow

### Running Tests

```bash
# Backend unit tests
cd /home/arunupscee/Music/grayFSM/backend
poetry run pytest tests/ -v

# Integration tests
cd /home/arunupscee/Music/grayFSM
pytest tests/integration/ -v

# Contract tests
pytest tests/contract/ -v

# E2E tests
cd /home/arunupscee/Music/grayFSM/e2e
npm install
npx playwright install --with-deps
npm test
```

### Code Quality

```bash
# Backend linting
cd backend
poetry run black app/
poetry run ruff app/
poetry run mypy app/

# Frontend linting
cd frontend
npm run lint
npm run format
```

### Database Migrations

```bash
cd backend

# Create new migration
poetry run alembic revision --autogenerate -m "Description of changes"

# Apply migrations
poetry run alembic upgrade head

# Rollback
poetry run alembic downgrade -1

# View migration history
poetry run alembic history
```

---

## 📊 Project Structure

```
grayFSM/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/         # API routes
│   │   ├── core/        # Core algorithms
│   │   ├── models/      # Database models
│   │   ├── services/    # Business logic
│   │   └── main.py      # Application entry
│   ├── alembic/         # Database migrations
│   ├── examples/        # Example FSM files
│   └── tests/           # Backend tests
├── frontend/            # React frontend
│   ├── src/
│   │   ├── api/        # API client
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── types/      # TypeScript types
│   │   └── main.tsx    # Entry point
│   └── package.json
├── database/           # Database scripts
├── infrastructure/     # Docker, K8s configs
├── e2e/               # E2E tests
└── tests/             # Integration tests
```

---

## 🎯 Next Steps

### For Users
1. ✅ Set up environment variables
2. ✅ Start backend and frontend
3. ✅ Test health endpoint
4. ✅ Try CLI tool with example FSMs
5. ⏳ Wait for optimization API to be implemented
6. ⏳ Wait for export functionality

### For Developers
1. ✅ Fix User model references
2. ✅ Initialize Alembic migrations
3. ⏳ Implement optimization endpoint
4. ⏳ Implement export service (Verilog/VHDL)
5. ⏳ Add authentication system
6. ⏳ Implement rate limiting
7. ⏳ Expand frontend features (FSM editor, visualization)

---

## 📞 Support

- **Documentation**: Check the `docs/` directory
- **Issues**: File issues on GitHub
- **API Docs**: http://localhost:8000/docs
- **Health Status**: http://localhost:8000/api/v1/health

---

## ⚠️ Security Notice

**IMPORTANT**: The default credentials and secret keys are for **DEVELOPMENT ONLY**.

Before deploying to production:
1. Change SECRET_KEY to a strong random value
2. Use strong database passwords
3. Enable HTTPS/TLS
4. Configure proper authentication
5. Enable rate limiting
6. Review security audit report in `security/`

---

**Last Updated**: 2025-12-06
**Version**: 1.0.0
**Status**: MVP Development
