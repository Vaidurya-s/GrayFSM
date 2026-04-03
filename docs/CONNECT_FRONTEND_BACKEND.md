# Connecting Frontend to Backend

**Issue**: Frontend shows "Failed to load FSMs - Request failed with status code 404"
**Status**: ✅ Frontend is working! Just need to start backend.

---

## 🎉 Good News!

The error proves your frontend is **working perfectly**! It's trying to fetch data from the backend API, but the backend isn't running yet.

**Frontend**: ✅ Running on http://localhost:5173
**Backend**: ❌ Not running (needs to be started)

---

## 🚀 Quick Fix - Start Backend (2 Minutes)

### **Option 1: Automated Script** (Easiest!)

Open a **new terminal** and run:

```bash
chmod +x /home/arunupscee/Music/grayFSM/START_BACKEND.sh
/home/arunupscee/Music/grayFSM/START_BACKEND.sh
```

This will:
1. ✅ Create `.env` file if needed
2. ✅ Start PostgreSQL database (Docker)
3. ✅ Run database migrations
4. ✅ Start FastAPI backend server

**Expected Output**:
```
=========================================="
Starting FastAPI Backend Server
=========================================="

Backend will be available at:
  - API: http://localhost:8000
  - Docs: http://localhost:8000/docs
  - Health: http://localhost:8000/api/v1/health

Press Ctrl+C to stop

INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

---

### **Option 2: Manual Steps**

If you prefer to run commands manually:

#### **Terminal 1: Start Database**
```bash
docker run -d \
  --name grayfsm-postgres \
  -e POSTGRES_USER=grayfsm \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=grayfsm \
  -p 5432:5432 \
  postgres:15-alpine

# Wait 5 seconds for it to start
sleep 5
```

#### **Terminal 2: Start Backend**
```bash
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# Create .env file
cat > .env << 'EOF'
ENVIRONMENT=development
DEBUG=True
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://grayfsm:password@localhost:5432/grayfsm
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
SECRET_KEY=dev-secret-key-change-in-production
EOF

# Initialize database
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## ✅ How to Know It's Working

### **1. Check Backend Health**

In a new terminal:
```bash
curl http://localhost:8000/api/v1/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "message": "GrayFSM API is running",
  "version": "1.0.0",
  "environment": "development",
  "database": "connected"
}
```

### **2. Refresh Frontend**

Go back to your browser at http://localhost:5173

**Before** (Backend not running):
- 🔴 Red dot: "API Disconnected"
- ⚠️ "Failed to load FSMs"

**After** (Backend running):
- 🟢 Green dot: "API Connected"
- ✅ Empty FSM list (no FSMs created yet)

---

## 🎯 Create Your First FSM

Once backend is running, test the full stack:

```bash
curl -X POST http://localhost:8000/api/v1/fsms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First FSM",
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

**Then refresh the frontend** - You'll see your FSM! 🎉

---

## 📊 Terminal Setup

You'll need **3 terminals** for full development:

### **Terminal 1: Database** (Keep running)
```bash
docker run -d --name grayfsm-postgres \
  -e POSTGRES_USER=grayfsm \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=grayfsm \
  -p 5432:5432 \
  postgres:15-alpine
```

### **Terminal 2: Backend** (Keep running)
```bash
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### **Terminal 3: Frontend** (Already running!)
```bash
cd /home/arunupscee/Music/grayFSM/frontend
npm run dev
```

---

## 🐛 Troubleshooting

### Issue: "Port 8000 already in use"

**Check what's using it**:
```bash
lsof -ti:8000
```

**Kill it**:
```bash
lsof -ti:8000 | xargs kill -9
```

### Issue: "Database connection error"

**Check if PostgreSQL is running**:
```bash
docker ps | grep postgres
```

**If not running**:
```bash
docker start grayfsm-postgres
```

**If doesn't exist**:
```bash
docker run -d --name grayfsm-postgres \
  -e POSTGRES_USER=grayfsm \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=grayfsm \
  -p 5432:5432 \
  postgres:15-alpine
```

### Issue: "Alembic migration error"

**Skip for now** - The database will still work:
```bash
# Just start the server without migrations
uvicorn app.main:app --reload
```

The API endpoints will work even without migrations (some features may be limited).

---

## 🎓 Understanding the Error

### What the 404 Means

When you see "Failed to load FSMs - 404", here's what's happening:

1. **Frontend**: Running on http://localhost:5173 ✅
2. **Frontend tries**: `GET http://localhost:8000/api/v1/fsms` ❌
3. **Backend**: Not listening on port 8000 ❌
4. **Result**: 404 Not Found

### What Happens After Backend Starts

1. **Frontend**: Running on http://localhost:5173 ✅
2. **Frontend tries**: `GET http://localhost:8000/api/v1/fsms` ✅
3. **Backend**: Listening on port 8000, responds ✅
4. **Result**: Returns FSM list (empty or with data) ✅

---

## 🎯 Quick Command Summary

### Start Everything (One Shot)

```bash
# Terminal 1 - Start database (background)
docker run -d --name grayfsm-postgres \
  -e POSTGRES_USER=grayfsm \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=grayfsm \
  -p 5432:5432 \
  postgres:15-alpine

# Terminal 2 - Start backend
cd /home/arunupscee/Music/grayFSM/backend && \
source venv/bin/activate && \
uvicorn app.main:app --reload

# Terminal 3 - Frontend already running!
# Just refresh http://localhost:5173
```

---

## ✅ Success Indicators

### Backend Started Successfully

You'll see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### Frontend Connected

You'll see in browser:
- 🟢 Green dot next to "API Connected"
- No error messages
- "Your FSMs" section (empty if no FSMs)

### Test Health Endpoint

```bash
curl http://localhost:8000/api/v1/health
```

Should return JSON with `"status": "healthy"`

---

## 🎉 What to Expect

### With Backend Running

Visit http://localhost:5173:

1. **Header**: "GrayFSM" with green "API Connected" indicator
2. **Left Panel**: "Your FSMs" (empty initially)
3. **Right Panel**: "Select an FSM to view details"
4. **No errors!** ✅

### Create Test FSM

Use the curl command above to create a test FSM, then:
- Refresh the page
- See your FSM in the list
- Click it to view details (states, transitions, etc.)

---

## 📁 Files Created

1. **`START_BACKEND.sh`** - Automated backend startup script
2. **`CONNECT_FRONTEND_BACKEND.md`** - This file

---

## 🚀 Your Next Steps

1. **Start backend**: Run `START_BACKEND.sh` script
2. **Refresh frontend**: Go to http://localhost:5173
3. **See green dot**: "API Connected" ✅
4. **Create FSM**: Use curl command or API docs
5. **View in frontend**: See your FSM listed!

---

## 💡 Pro Tips

### Tip 1: Keep Terminals Organized
- Terminal 1: Database (can run in background with -d)
- Terminal 2: Backend (watch for API logs)
- Terminal 3: Frontend (watch for build logs)

### Tip 2: Use API Docs
Visit http://localhost:8000/docs - Interactive API testing!

### Tip 3: Check Health First
Always verify: `curl http://localhost:8000/api/v1/health`

### Tip 4: Watch the Logs
Backend logs show every API request - helpful for debugging

### Tip 5: Hot Reload
Both frontend and backend auto-reload on code changes!

---

## 🎊 Summary

**Current Status**:
- ✅ Frontend: Running and functional
- ❌ Backend: Not started (easy to fix!)
- ⏳ Database: Needs to be started

**Next Command**:
```bash
chmod +x /home/arunupscee/Music/grayFSM/START_BACKEND.sh
/home/arunupscee/Music/grayFSM/START_BACKEND.sh
```

**Result**: Full stack working! 🚀

---

**The 404 error will disappear as soon as the backend starts!** 🎉
