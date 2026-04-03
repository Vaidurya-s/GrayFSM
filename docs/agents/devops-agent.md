# DevOps Agent

> Read `agents/memory.md` first for full project context.

## Mission
Wire the existing observability stack into the backend application, fix Docker configs, and ensure the infrastructure is ready for deployment. The observability code already exists in `observability/backend/` — it just needs to be imported and initialized.

---

## Owned Files

### MODIFY
- `backend/app/main.py` — Add observability initialization in lifespan (CAREFUL: security-agent also modifies this)
- `infrastructure/docker/docker-compose.yml` — Fix volume mount typo, add observability services

### CREATE (new files)
- `infrastructure/docker/docker-compose.dev.yml` — Development override with hot-reload
- `backend/app/middleware/metrics.py` — Prometheus metrics endpoint adapter

### FIX
- `infrastructure/docker/backend.Dockerfile` — Verify build works with current codebase
- `infrastructure/docker/frontend.Dockerfile` — Verify build works with current codebase

## DO NOT Touch
- `backend/app/api/v1/*` — Owned by backend-agent
- `backend/app/services/*` — Owned by backend-agent
- `backend/app/middleware/rate_limit.py` — Owned by security-agent
- `frontend/src/*` — Owned by frontend-agent
- `observability/backend/*` — Reference files, read-only (import, don't modify)
- `security/*` — Owned by security-agent

---

## Current Status

### Observability (EXISTS but NOT WIRED):
- `observability/backend/telemetry.py` — OpenTelemetry setup with Jaeger exporter
- `observability/backend/metrics.py` — Custom Prometheus metrics (FSM operations, optimization, API latency)
- `observability/backend/logging_config.py` — Structured JSON logging with trace ID correlation
- `observability/infrastructure/` — K8s manifests for Prometheus, Grafana, Jaeger, Loki
- `observability/alerts/` — AlertManager and SLO configs

### Docker (EXISTS with ISSUES):
- `infrastructure/docker/docker-compose.yml` — Has services for PostgreSQL, Redis, pgAdmin, backend, frontend
  - **BUG**: Line ~67 has volume mount typo `../..backend:/app/backend` should be `../../backend:/app/backend`
- `infrastructure/docker/backend.Dockerfile` — Multi-stage FastAPI build
- `infrastructure/docker/frontend.Dockerfile` — React + Nginx build
- `infrastructure/docker/nginx.conf` + `default.conf` — Reverse proxy config

### CI/CD:
- `infrastructure/github-workflows/ci-cd.yml` — Full pipeline (lint, test, build, deploy)
- `.github/workflows/` is in `.gitignore` (OAuth token lacks workflow scope)

---

## Tasks (Priority Order)

### Task 1: Fix Docker Compose Volume Mount
Read and fix the typo in `infrastructure/docker/docker-compose.yml`.

### Task 2: Wire Observability into Backend

Read these files first:
- `observability/backend/telemetry.py`
- `observability/backend/metrics.py`
- `observability/backend/logging_config.py`

Then modify `backend/app/main.py` lifespan to initialize telemetry:
```python
# In the lifespan function, after database init:
# Import and initialize OpenTelemetry
try:
    # Adapt the import path — the observability code is outside backend/
    # You may need to copy or symlink, OR add the module to sys.path
    from observability.backend.telemetry import setup_telemetry
    from observability.backend.metrics import setup_metrics
    setup_telemetry(app)
    setup_metrics(app)
    logger.info("Observability initialized")
except ImportError:
    logger.warning("Observability modules not available, skipping")
except Exception as e:
    logger.warning(f"Failed to initialize observability: {e}")
```

**NOTE**: The observability code lives OUTSIDE the backend package. You have options:
1. Copy the relevant files into `backend/app/observability/` (preferred)
2. Add `observability/` to Python path
3. Create a minimal inline version

Choose option 1 — copy and adapt `telemetry.py`, `metrics.py`, `logging_config.py` into `backend/app/observability/`.

### Task 3: Create Prometheus Metrics Endpoint
Create `backend/app/middleware/metrics.py` or a route that exposes `/metrics` for Prometheus scraping.

### Task 4: Add Observability Services to Docker Compose
Add to `infrastructure/docker/docker-compose.yml`:
```yaml
  prometheus:
    image: prom/prometheus:v2.48.0
    ports:
      - "9090:9090"
    volumes:
      - ../monitoring/prometheus-config.yaml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:10.2.2
    ports:
      - "3001:3000"
    depends_on:
      - prometheus

  jaeger:
    image: jaegertracing/all-in-one:1.52
    ports:
      - "16686:16686"  # UI
      - "4317:4317"    # OTLP gRPC
```

### Task 5: Create docker-compose.dev.yml
Development overrides:
- Hot-reload for backend (mount source, uvicorn --reload)
- Hot-reload for frontend (mount source, npm run dev)
- Exposed debug ports
- Relaxed resource limits

### Task 6: Verify Dockerfiles
Build and test both Dockerfiles against current codebase. Fix any issues.

### Task 7: Health Check Improvements
Enhance the health endpoint to check all infrastructure:
- Database connection
- Redis connection (if available)
- Observability pipeline status

---

## Key Integration Point: main.py

Current state of `backend/app/main.py` (relevant sections):
```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    # Startup
    logger.info("Starting GrayFSM Backend API")
    await create_db_and_tables()
    yield
    # Shutdown
    await engine.dispose()

# Middleware order (current):
# 1. CORS
# 2. GZip
# 3. logging_middleware (custom)
# 4. error_handler_middleware (custom)
# 5. rate_limit_middleware (no-op, custom)
```

Your changes go in the `lifespan` function (observability init) and potentially a new `/metrics` route.

---

## Interfaces

- **security-agent** also modifies `main.py` (for middleware). Both work in separate worktrees. When merging, security goes first.
- **database-agent** owns Docker Compose DB settings — your Docker Compose changes must keep `postgres` service config compatible.
- **backend-agent** endpoints will emit the metrics you wire. No conflict — you add the instrumentation layer, they add the business logic.
