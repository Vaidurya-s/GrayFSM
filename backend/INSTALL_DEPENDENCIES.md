# Backend Dependencies Installation Guide

## Quick Install (Choose One Method)

### Method 1: Using pip + requirements.txt (Recommended for you!)

```bash
cd /home/arunupscee/Music/grayFSM/backend

# Activate your virtual environment
source venv/bin/activate

# Install all dependencies
pip install -r requirements.txt

# Install the grayfsm package in development mode
pip install -e .
```

### Method 2: Using Poetry

```bash
cd /home/arunupscee/Music/grayFSM/backend

# Activate your virtual environment
source venv/bin/activate

# Install poetry
pip install poetry

# Install all dependencies
poetry install
```

---

## Verification Steps

After installation, verify everything works:

### 1. Check Imports
```bash
python3 << 'EOF'
import fastapi
import uvicorn
import sqlalchemy
import networkx
import pydantic
print("✅ All imports successful!")
EOF
```

### 2. Check CLI Tool
```bash
# This should show help message
python -m grayfsm.cli --help

# Or if installed via pip:
grayfsm --help
```

### 3. Test Optimization
```bash
cd /home/arunupscee/Music/grayFSM/backend

# Run optimization on example
python -m grayfsm.cli optimize \
  --input examples/traffic_light.json \
  --algorithm greedy \
  --output test_output.json

# Check the output
cat test_output.json | python3 -m json.tool
```

---

## Dependency Details

### Core Dependencies (Required)

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.104.1+ | Web framework |
| uvicorn[standard] | 0.24.0+ | ASGI server |
| pydantic | 2.5.0+ | Data validation |
| sqlalchemy | 2.0.23+ | ORM |
| alembic | 1.13.0+ | Database migrations |
| asyncpg | 0.29.0+ | Async PostgreSQL driver |
| psycopg2-binary | 2.9.9+ | Sync PostgreSQL driver |
| networkx | 3.2.1+ | Graph algorithms |
| python-dotenv | 1.0.0+ | Environment variables |

### Development Dependencies (Optional but Recommended)

| Package | Version | Purpose |
|---------|---------|---------|
| pytest | 7.4.3+ | Testing framework |
| pytest-cov | 4.1.0+ | Code coverage |
| pytest-asyncio | 0.21.1+ | Async testing |
| black | 23.11.0+ | Code formatting |
| ruff | 0.1.6+ | Linting |
| mypy | 1.7.1+ | Type checking |

---

## Troubleshooting

### Issue: "No module named 'grayfsm'"

**Solution**:
```bash
# Install package in development mode
cd /home/arunupscee/Music/grayFSM/backend
pip install -e .
```

### Issue: "pg_config executable not found"

This happens when trying to install psycopg2-binary.

**Solution**:
```bash
# On Ubuntu/Debian
sudo apt-get install libpq-dev python3-dev

# Then retry
pip install -r requirements.txt
```

### Issue: "ERROR: Could not find a version that satisfies the requirement"

**Solution**:
```bash
# Update pip
pip install --upgrade pip setuptools wheel

# Retry installation
pip install -r requirements.txt
```

### Issue: Virtual environment not activated

**Symptoms**: Packages install globally or permission errors

**Solution**:
```bash
# Deactivate any active venv
deactivate

# Activate the correct venv
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# You should see (venv) in your prompt
# Now install
pip install -r requirements.txt
```

---

## Alternative: Creating Fresh Virtual Environment

If you're having issues with your existing venv:

```bash
cd /home/arunupscee/Music/grayFSM/backend

# Remove old venv
rm -rf venv/

# Create new venv
python3 -m venv venv

# Activate
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Install grayfsm package
pip install -e .
```

---

## Post-Installation Setup

### 1. Create .env File

```bash
cd /home/arunupscee/Music/grayFSM/backend

cat > .env << 'EOF'
ENVIRONMENT=development
DEBUG=True
HOST=0.0.0.0
PORT=8000
DATABASE_URL=postgresql+asyncpg://grayfsm:password@localhost:5432/grayfsm
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
SECRET_KEY=dev-secret-key-change-in-production
EOF
```

### 2. Set Up Database

```bash
# Start PostgreSQL using Docker
docker run -d \
  --name grayfsm-postgres \
  -e POSTGRES_USER=grayfsm \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=grayfsm \
  -p 5432:5432 \
  postgres:15-alpine

# Wait a few seconds for it to start
sleep 5

# Create database tables
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

### 3. Start the Application

```bash
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# Start API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Visit:
- API: http://localhost:8000
- Documentation: http://localhost:8000/docs
- Health: http://localhost:8000/api/v1/health

---

## Quick Test Script

Run this to verify everything is working:

```bash
#!/bin/bash

cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

echo "Testing imports..."
python3 -c "import fastapi, uvicorn, sqlalchemy, networkx; print('✅ Imports OK')"

echo ""
echo "Testing CLI..."
python -m grayfsm.cli optimize \
  --input examples/traffic_light.json \
  --algorithm greedy \
  --output /tmp/test.json

if [ -f /tmp/test.json ]; then
    echo "✅ CLI optimization successful!"
    echo ""
    echo "Sample output:"
    head -20 /tmp/test.json
else
    echo "❌ CLI test failed"
fi
```

Save as `test_install.sh`, make executable with `chmod +x test_install.sh`, and run!

---

## Summary

**Recommended Installation Command**:
```bash
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate
pip install -r requirements.txt
pip install -e .
```

**Time Required**: 2-3 minutes

**Disk Space**: ~200-300 MB

After installation, you'll be able to:
- ✅ Run the CLI tool for FSM optimization
- ✅ Start the FastAPI backend server
- ✅ Run database migrations
- ✅ Execute tests

Good luck! 🚀
