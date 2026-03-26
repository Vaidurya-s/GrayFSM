# GrayFSM - Next Steps Guide

**Last Updated**: December 6, 2025
**Status**: Issues Found & Solutions Provided

---

## 🚨 Issues Encountered & Fixes

### Issue 1: docker-compose Not Found

**Error**:
```
Command 'docker-compose' not found
```

**Fix**:
```bash
# Install docker-compose
sudo apt install docker-compose

# OR use docker compose (v2 - newer syntax)
docker compose up -d
```

**Alternative**: Skip Docker and run manually (see Manual Setup below)

---

### Issue 2: grayfsm Module Not Found

**Error**:
```
ModuleNotFoundError: No module named 'grayfsm'
```

**Root Cause**: The package needs to be installed in development mode

**Fix**:
```bash
cd /home/arunupscee/Music/grayFSM/backend

# Activate virtual environment
source venv/bin/activate

# Install package in development mode
poetry install

# Verify installation
poetry run grayfsm --help
```

---

## ✅ Immediate Next Steps (Do These First!)

### Step 1: Install Docker Compose (Optional but Recommended)

```bash
sudo apt install docker-compose

# Verify installation
docker-compose --version
```

### Step 2: Install Backend Package

```bash
cd /home/arunupscee/Music/grayFSM/backend

# Make sure virtual environment is activated
source venv/bin/activate

# Install all dependencies and the grayfsm package
poetry install

# This should complete without errors
```

### Step 3: Test the CLI Tool

```bash
# Should now work!
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# Method 1: Using poetry run
poetry run grayfsm optimize \
  --input examples/traffic_light.json \
  --algorithm greedy \
  --output optimized.json

# Method 2: After poetry install, direct command
grayfsm optimize \
  --input examples/traffic_light.json \
  --algorithm greedy \
  --output optimized.json

# View results
cat optimized.json | python3 -m json.tool
```

### Step 4: Check Frontend Dependencies

```bash
cd /home/arunupscee/Music/grayFSM/frontend

# Check if npm install completed
ls node_modules/ | wc -l
# Should show a large number (500+)

# If not installed yet:
npm install
```

---

## 🎯 Short-term Goals (Next 1-2 Days)

### Priority 1: Get the System Running

#### A. Database Setup

```bash
# Install Docker if not already installed
sudo apt install docker.io

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (logout/login required after)
sudo usermod -aG docker $USER

# Start PostgreSQL
docker run -d \
  --name grayfsm-postgres \
  -e POSTGRES_USER=grayfsm \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=grayfsm \
  -p 5432:5432 \
  postgres:15-alpine

# Verify it's running
docker ps | grep postgres
```

#### B. Initialize Database

```bash
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# Create initial migration
poetry run alembic revision --autogenerate -m "Initial migration"

# Apply migration (create tables)
poetry run alembic upgrade head

# Verify tables were created
docker exec -it grayfsm-postgres psql -U grayfsm -d grayfsm -c "\dt"
```

#### C. Start Backend API

```bash
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# Create .env file if it doesn't exist
cat > .env << 'EOF'
ENVIRONMENT=development
DEBUG=True
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://grayfsm:password@localhost:5432/grayfsm
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
SECRET_KEY=dev-secret-key-change-in-production
EOF

# Start the API server
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Test it**:
- Open browser: http://localhost:8000/docs
- Try the health endpoint: http://localhost:8000/api/v1/health

#### D. Start Frontend

```bash
# New terminal
cd /home/arunupscee/Music/grayFSM/frontend

# Create .env.local if it doesn't exist
cat > .env.local << 'EOF'
VITE_API_BASE_URL=http://localhost:8000/api/v1
EOF

# Wait for npm install to complete if still running
# Check progress:
ps aux | grep "npm install"

# Once complete, start dev server
npm run dev
```

**Access it**: http://localhost:5173

---

## 🚀 Medium-term Goals (Next 1-2 Weeks)

### Priority 2: Implement Missing Backend Features

#### A. Implement Optimization Endpoint

**File to Edit**: `/home/arunupscee/Music/grayFSM/backend/app/api/v1/algorithm.py`

**Current Code** (lines 14-25):
```python
@router.post("/fsms/{fsm_id}/optimize")
async def optimize_fsm(fsm_id: UUID):
    raise HTTPException(
        status_code=501,
        detail="Optimization not yet implemented via API"
    )
```

**What to Implement**:
1. Load FSM from database
2. Call the optimization algorithm (already exists in `app/core/algorithms/`)
3. Save optimized result
4. Return optimization statistics

**Reference**: The CLI tool shows how to use the algorithms:
- File: `/home/arunupscee/Music/grayFSM/backend/src/grayfsm/cli.py`
- Algorithms: `/home/arunupscee/Music/grayFSM/backend/src/grayfsm/core/algorithms/`

**Estimated Time**: 2-3 days

#### B. Implement Export Endpoints

**File to Edit**: `/home/arunupscee/Music/grayFSM/backend/app/api/v1/export.py`

**What to Implement**:
1. Verilog code generation
2. VHDL code generation
3. Template-based rendering

**Reference**:
- Exporters directory: `/home/arunupscee/Music/grayFSM/backend/src/grayfsm/core/exporters/`

**Estimated Time**: 5-7 days

#### C. Add User Authentication

**What to Implement**:
1. User model (database table)
2. JWT token generation
3. Protected endpoints
4. Login/register endpoints

**Configuration Already Exists**:
- File: `/home/arunupscee/Music/grayFSM/backend/app/config.py` (lines 43-47)
- SECRET_KEY, ALGORITHM, token expiry configured

**Estimated Time**: 3-5 days

#### D. Implement Rate Limiting

**File to Edit**: `/home/arunupscee/Music/grayFSM/backend/app/middleware/rate_limit.py`

**Current Code**: Stub implementation (pass-through)

**What to Implement**:
1. Redis-based rate limiting
2. Per-user quotas
3. Anonymous user limits

**Estimated Time**: 1-2 days

---

## 🎨 Frontend Enhancement Goals

### Priority 3: Expand Frontend Features

#### A. Create FSM Editor Page

**What to Build**:
1. Page component: `frontend/src/pages/EditorPage.tsx`
2. React Flow integration for visual editing
3. State creation (drag-and-drop)
4. Transition drawing
5. Properties panel

**Dependencies Already Installed**:
- reactflow (v11.10.1)
- framer-motion (for animations)

**Reference**:
- React Flow docs: https://reactflow.dev/
- Examples in `frontend/src/components/fsm/` (empty, needs implementation)

**Estimated Time**: 3-5 days

#### B. Add Visualization Components

**What to Build**:
1. FSM Graph Viewer (React Flow)
2. 3D Hypercube View (Three.js)
3. Metrics Dashboard (Recharts)
4. Before/After Comparison View

**Dependencies Already Installed**:
- three (v0.159.0)
- @react-three/fiber
- @react-three/drei
- recharts

**Location**: `frontend/src/components/visualization/`

**Estimated Time**: 4-6 days

#### C. Implement Zustand Stores

**What to Build**:
1. FSM Store (`frontend/src/store/fsmStore.ts`)
   - Current FSM state
   - CRUD operations
   - Optimized FSM results

2. Editor Store (`frontend/src/store/editorStore.ts`)
   - Selected nodes/edges
   - Editor mode (add state, add transition, etc.)
   - Undo/redo history

3. UI Store (`frontend/src/store/uiStore.ts`)
   - Theme (light/dark)
   - Toast notifications
   - Loading states

**Estimated Time**: 2-3 days

#### D. Create React Query Hooks

**What to Build**:
Files in `frontend/src/hooks/useAPI/`:
1. `useFSMs.ts` - List and filter FSMs
2. `useFSM.ts` - Get single FSM
3. `useCreateFSM.ts` - Create FSM mutation
4. `useOptimizeFSM.ts` - Optimize mutation
5. `useExportFSM.ts` - Export mutation

**Note**: API client already exists at `frontend/src/api/`

**Estimated Time**: 1-2 days

---

## 🧪 Testing Goals

### Priority 4: Improve Test Coverage

#### A. Backend Unit Tests

**Current Coverage**: ~5% (only Gray code module)

**What to Test**:
1. FSM model validation
2. Algorithm logic
3. Service layer methods
4. API endpoint logic

**Location**: `backend/tests/unit/` (create this directory)

**Estimated Time**: 5-7 days for 80%+ coverage

#### B. Frontend Unit Tests

**Current Coverage**: 0%

**What to Test**:
1. Component rendering
2. User interactions
3. API hooks
4. Utility functions

**Setup Needed**:
1. Create `frontend/vitest.config.ts` (I can provide this)
2. Add test files alongside components

**Estimated Time**: 5-7 days for 70%+ coverage

---

## 📚 Learning & Documentation

### Resources Available

1. **Quick Start Guide**: `QUICK_START_GUIDE.md`
2. **Examination Report**: `CODEBASE_EXAMINATION_REPORT.md`
3. **API Specification**: `openapi-spec.yaml`
4. **Backend Architecture**: `BACKEND-ARCHITECTURE.md`
5. **Frontend Architecture**: `FRONTEND-ARCHITECTURE.md`

### Example FSMs Available

Located in: `/home/arunupscee/Music/grayFSM/backend/examples/`

- `traffic_light.json` - Simple 3-state traffic light
- `vending_machine.json` - Coin-operated machine
- `sequence_detector.json` - Pattern detector
- `elevator.json` - Multi-floor elevator

**Use these to test the CLI and API!**

---

## 🔧 Troubleshooting Common Issues

### Database Connection Refused

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not running:
docker start grayfsm-postgres

# If container doesn't exist, create it (see Database Setup above)
```

### Port Already in Use

```bash
# Find process using port 8000
sudo lsof -i :8000

# Kill it
sudo kill -9 <PID>

# Or use a different port
poetry run uvicorn app.main:app --reload --port 8001
```

### Poetry Command Not Found

```bash
# Install poetry
curl -sSL https://install.python-poetry.org | python3 -

# Add to PATH (add to ~/.bashrc)
export PATH="$HOME/.local/bin:$PATH"

# Reload shell
source ~/.bashrc
```

### Virtual Environment Issues

```bash
cd /home/arunupscee/Music/grayFSM/backend

# Deactivate current venv if any
deactivate

# Remove old venv
rm -rf venv/

# Create new venv
python3 -m venv venv

# Activate
source venv/bin/activate

# Install poetry
pip install poetry

# Install dependencies
poetry install
```

---

## 📊 Progress Tracking

### Completed ✅

- [x] Project structure and architecture
- [x] Core algorithms (Gray code, hypercube)
- [x] CLI tool implementation
- [x] Database models and schema
- [x] Testing infrastructure (E2E, integration, contract)
- [x] Infrastructure (Docker, Kubernetes, CI/CD)
- [x] Observability stack configuration
- [x] API client and type definitions
- [x] Frontend foundation (entry points, basic pages)
- [x] Documentation and guides
- [x] Alembic migration setup
- [x] Fixed User model foreign key issue

### In Progress ⏳

- [ ] Frontend dependencies installation (npm install running)
- [ ] Backend package installation (poetry install needed)

### Not Started ❌

- [ ] Optimization API endpoint implementation
- [ ] Export service implementation (Verilog/VHDL)
- [ ] User authentication system
- [ ] Rate limiting middleware
- [ ] FSM editor page
- [ ] Visualization components
- [ ] Zustand stores
- [ ] React Query hooks
- [ ] Frontend unit tests
- [ ] Backend unit test expansion

---

## 🎯 Recommended Order of Implementation

### Phase 1: Get Running (This Week)
1. ✅ Install docker-compose: `sudo apt install docker-compose`
2. ✅ Install backend: `cd backend && poetry install`
3. ✅ Start database: `docker run -d ... postgres`
4. ✅ Run migrations: `poetry run alembic upgrade head`
5. ✅ Start backend: `poetry run uvicorn app.main:app --reload`
6. ✅ Wait for npm install to complete
7. ✅ Start frontend: `npm run dev`
8. ✅ Test CLI: `poetry run grayfsm optimize ...`

### Phase 2: Core Features (Week 2-3)
1. Implement optimization API endpoint
2. Create FSM editor page (basic)
3. Add Zustand stores
4. Create React Query hooks
5. Test end-to-end workflow

### Phase 3: Polish (Week 4-5)
1. Implement export service
2. Add visualizations (React Flow, Three.js)
3. Improve UI/UX
4. Add unit tests
5. Documentation updates

### Phase 4: Production Ready (Week 6+)
1. Add user authentication
2. Implement rate limiting
3. Security hardening
4. Performance optimization
5. Deployment preparation

---

## 💡 Quick Wins (Do These for Fast Results!)

### 1. Test CLI Tool (5 minutes)

Once `poetry install` completes:

```bash
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate
poetry run grayfsm optimize \
  --input examples/traffic_light.json \
  --algorithm greedy \
  --output result.json

cat result.json | python3 -m json.tool
```

✅ **This proves the core algorithms work!**

### 2. Browse API Docs (2 minutes)

Once backend is running:

Visit: http://localhost:8000/docs

✅ **Interactive API documentation**

### 3. Create Your First FSM via API (5 minutes)

```bash
curl -X POST http://localhost:8000/api/v1/fsms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First FSM",
    "fsm_type": "moore",
    "states": ["S0", "S1"],
    "transitions": [
      {"from_state": "S0", "to_state": "S1", "input": "a"}
    ],
    "initial_state": "S0"
  }'
```

✅ **Creates FSM in database, visible in frontend!**

### 4. View FSM in Frontend (1 minute)

Once frontend is running:

Visit: http://localhost:5173

✅ **See your FSMs listed with stats**

---

## 📞 Getting Help

### Documentation Files
- `QUICK_START_GUIDE.md` - Setup instructions
- `CODEBASE_EXAMINATION_REPORT.md` - Detailed analysis
- `README.md` files in each directory
- API docs at http://localhost:8000/docs

### Useful Commands

```bash
# Backend status
cd backend && poetry run uvicorn app.main:app --reload

# Frontend status
cd frontend && npm run dev

# Database status
docker ps | grep postgres

# Check logs
docker logs grayfsm-postgres

# Run tests
cd backend && poetry run pytest
cd ../e2e && npm test
```

---

## 🎓 Summary

Your project is **65% complete** with excellent foundation. Here's what to focus on:

**Immediate** (Today):
1. Install docker-compose
2. Run `poetry install` in backend
3. Test CLI tool
4. Start database and run migrations

**This Week**:
1. Get full stack running (database + backend + frontend)
2. Create FSMs via API
3. View them in frontend
4. Test with example FSMs

**Next 2 Weeks**:
1. Implement optimization API endpoint
2. Build FSM editor
3. Add visualizations

**Month 1**:
1. Complete all core features
2. Add authentication
3. Improve testing
4. Prepare for production

---

**The most important thing**: Get the CLI tool working first. It proves the core algorithms are solid, and you can use it immediately while building out the web interface!

Good luck! 🚀
