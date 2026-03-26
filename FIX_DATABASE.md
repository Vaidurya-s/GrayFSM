# Fix Database Port Already in Use

**Error**: `bind: address already in use` on port 5432
**Meaning**: PostgreSQL is already running on your system!

---

## 🔍 Quick Diagnosis

Run this command to see what's using port 5432:

```bash
sudo lsof -i :5432
```

You'll see one of these scenarios:

---

## 📊 Scenario 1: Native PostgreSQL Running (Most Common)

**If you see**: `postgres` command (not Docker)

```
COMMAND   PID     USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
postgres  1234    postgres    5u  IPv4  12345      0t0  TCP *:postgresql (LISTEN)
```

### ✅ Solution: Use the Existing PostgreSQL

**Step 1**: Check if database exists
```bash
sudo -u postgres psql -l | grep grayfsm
```

**Step 2A**: If `grayfsm` database exists, you're good!
```bash
# Just skip database creation and continue
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# Update .env to use local PostgreSQL
cat > .env << 'EOF'
ENVIRONMENT=development
DEBUG=True
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/grayfsm
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
SECRET_KEY=dev-secret-key-change-in-production
EOF

# Run migrations
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head

# Start backend
uvicorn app.main:app --reload
```

**Step 2B**: If database doesn't exist, create it
```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE grayfsm;"

# Create user (optional, if using different credentials)
sudo -u postgres psql -c "CREATE USER grayfsm WITH PASSWORD 'password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE grayfsm TO grayfsm;"

# Then run Step 2A above
```

---

## 📊 Scenario 2: Docker Container Already Running

**If you see**: `docker-proxy` or container name

### ✅ Solution: Use Existing Container

```bash
# Check if it's our container
docker ps | grep postgres

# If you see grayfsm-postgres, just use it!
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# .env is already correct
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head

# Start backend
uvicorn app.main:app --reload
```

---

## 📊 Scenario 3: Stop Existing PostgreSQL

If you want to stop the existing PostgreSQL and use Docker instead:

### For Native PostgreSQL:
```bash
# Stop PostgreSQL service
sudo systemctl stop postgresql

# Disable auto-start (optional)
sudo systemctl disable postgresql

# Then run the START_BACKEND.sh script again
```

### For Docker Container:
```bash
# Find the container
docker ps | grep postgres

# Stop it
docker stop <container_name>

# Then run the START_BACKEND.sh script again
```

---

## ⚡ Quick Fix - Start Backend Without Docker

**Easiest solution**: Use the existing PostgreSQL and skip Docker!

```bash
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# Create/update .env for local PostgreSQL
cat > .env << 'EOF'
ENVIRONMENT=development
DEBUG=True
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres@localhost:5432/grayfsm
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
SECRET_KEY=dev-secret-key-change-in-production
EOF

# Create database if needed
sudo -u postgres psql -c "CREATE DATABASE grayfsm;" || echo "Database may already exist"

# Initialize database
alembic revision --autogenerate -m "Initial migration" || echo "Migration exists"
alembic upgrade head || echo "Using existing schema"

# Start backend server
echo ""
echo "=========================================="
echo "Starting Backend Server"
echo "=========================================="
echo "Visit: http://localhost:8000/docs"
echo ""
uvicorn app.main:app --reload
```

---

## 🎯 Recommended Approach

**Use your existing PostgreSQL installation!** No need for Docker.

### Complete Setup (Copy & Run):

```bash
# Navigate to backend
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# Configure for local PostgreSQL
cat > .env << 'EOF'
ENVIRONMENT=development
DEBUG=True
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres@localhost:5432/grayfsm
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
SECRET_KEY=dev-secret-key-change-in-production
EOF

# Create database (will show error if exists, that's OK)
sudo -u postgres psql -c "CREATE DATABASE grayfsm;" 2>/dev/null || echo "Database exists"

# Initialize schema
alembic revision --autogenerate -m "Initial migration" 2>/dev/null || echo "Migration exists"
alembic upgrade head

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## ✅ Verify It's Working

### Test 1: Check Backend Health
```bash
curl http://localhost:8000/api/v1/health
```

**Expected**:
```json
{
  "status": "healthy",
  "message": "GrayFSM API is running",
  "database": "connected"
}
```

### Test 2: Refresh Frontend
Visit: http://localhost:5173

**Expected**: 🟢 Green dot "API Connected"

---

## 🐛 Troubleshooting

### Error: "connection refused"

**Check PostgreSQL is running**:
```bash
sudo systemctl status postgresql
```

**If not running**:
```bash
sudo systemctl start postgresql
```

### Error: "authentication failed"

**Option 1**: Use trust authentication (development only!)
```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Change this line:
# local   all             all                                     peer
# To:
local   all             all                                     trust

# Restart PostgreSQL
sudo systemctl restart postgresql
```

**Option 2**: Set postgres user password
```bash
sudo -u postgres psql
ALTER USER postgres PASSWORD 'password';
\q
```

Then update .env:
```
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/grayfsm
```

### Error: "database does not exist"

```bash
sudo -u postgres psql -c "CREATE DATABASE grayfsm;"
```

### Error: "migrations fail"

**Skip migrations for now**:
```bash
# Just start the server - it will work without migrations
uvicorn app.main:app --reload
```

---

## 🎯 Summary

### The Issue
Port 5432 is already in use by PostgreSQL.

### The Solution
Use your existing PostgreSQL instead of Docker!

### Quick Command
```bash
cd /home/arunupscee/Music/grayFSM/backend && \
source venv/bin/activate && \
cat > .env << 'EOF'
ENVIRONMENT=development
DEBUG=True
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://postgres@localhost:5432/grayfsm
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
SECRET_KEY=dev-secret-key-change-in-production
EOF
sudo -u postgres psql -c "CREATE DATABASE grayfsm;" 2>/dev/null
alembic upgrade head 2>/dev/null
uvicorn app.main:app --reload
```

---

## 💡 Pro Tip

You don't need Docker for development! Using your system's PostgreSQL is actually simpler and faster.

**Benefits**:
- ✅ No port conflicts
- ✅ Easier to manage
- ✅ Better performance
- ✅ Standard PostgreSQL tools work

---

**Next**: Copy the "Quick Command" above and run it. Your backend will start! 🚀
