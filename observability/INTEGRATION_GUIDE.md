# GrayFSM Observability Integration Guide

Step-by-step guide for integrating observability into your backend and frontend.

## Backend Integration

### Step 1: Add Dependencies

Add to `backend/requirements.txt`:

```
# OpenTelemetry Core
opentelemetry-api==1.21.0
opentelemetry-sdk==1.21.0

# Jaeger Exporter
opentelemetry-exporter-jaeger==1.21.0

# Instrumentation
opentelemetry-instrumentation-fastapi==0.42b0
opentelemetry-instrumentation-sqlalchemy==0.42b0
opentelemetry-instrumentation-redis==0.42b0
opentelemetry-instrumentation-requests==0.42b0

# Propagators
opentelemetry-propagators[jaeger]==0.42b0

# Structured Logging
structlog==23.2.0

# Prometheus Metrics
opentelemetry-exporter-prometheus==0.42b0
prometheus-client==0.18.0
```

### Step 2: Configure Settings

Update `backend/app/config.py`:

```python
from typing import Optional

class Settings(BaseSettings):
    # ... existing settings ...

    # Observability
    telemetry_enabled: bool = True
    jaeger_enabled: bool = True
    jaeger_host: str = "localhost"
    jaeger_port: int = 6831
    otlp_enabled: bool = False
    otlp_endpoint: str = "http://otel-collector:4317"
    prometheus_enabled: bool = True
    prometheus_port: int = 8001
    structured_logging: bool = True

    # SLO settings
    api_availability_target: float = 0.999
    api_latency_p95_ms: float = 500.0
    api_latency_p99_ms: float = 1000.0
    error_rate_target: float = 0.0005  # 0.05%
```

### Step 3: Initialize Telemetry in main.py

Update `backend/app/main.py`:

```python
import logging
import logging.config
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import observability modules
from observability.backend.telemetry import initialize_telemetry, TelemetryProvider
from observability.backend.logging_config import setup_structured_logging, get_logging_config
from observability.backend.metrics import initialize_metrics

from app.config import settings
from app.db.session import engine, create_db_and_tables
from app.middleware.error_handler import error_handler_middleware
from app.middleware.logging import logging_middleware
from app.utils.logger import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan with telemetry initialization"""

    # Initialize structured logging
    if settings.structured_logging:
        setup_structured_logging(settings.environment)

    # Initialize telemetry
    telemetry_provider: Optional[TelemetryProvider] = None
    if settings.telemetry_enabled:
        telemetry_provider = initialize_telemetry(settings)
        logger.info("Telemetry initialized", environment=settings.environment)

    # Initialize metrics
    metrics = initialize_metrics()
    logger.info("Metrics initialized")

    # Initialize database
    try:
        await create_db_and_tables()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error("Database initialization failed", error=str(e))
        raise

    yield

    # Shutdown telemetry
    if telemetry_provider:
        telemetry_provider.shutdown()
        logger.info("Telemetry shutdown complete")

    # Shutdown database
    await engine.dispose()
    logger.info("Database shutdown complete")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

app.middleware("http")(logging_middleware)
app.middleware("http")(error_handler_middleware)

# Include routers...
# (existing routers)
```

### Step 4: Add Prometheus Metrics Endpoint

Create `backend/app/middleware/metrics.py`:

```python
from prometheus_client import make_asgi_app

def create_metrics_app():
    """Create Prometheus metrics ASGI app"""
    return make_asgi_app()
```

Update `backend/app/main.py` to mount metrics:

```python
from starlette.routing import Mount
from app.middleware.metrics import create_metrics_app

# Mount metrics endpoint
if settings.prometheus_enabled:
    metrics_app = create_metrics_app()
    app.mount("/metrics", metrics_app)
```

### Step 5: Instrument Database Operations

Update `backend/app/db/session.py` to track query metrics:

```python
from observability.backend.metrics import get_metrics
import time

async def get_db():
    """Database session with metrics tracking"""
    metrics = get_metrics()
    session = SessionLocal()

    try:
        yield session
    finally:
        await session.close()

        # Track active connections
        metrics.decrement_active_connections()
```

### Step 6: Add Custom Metrics to Services

Update `backend/app/services/fsm_service.py`:

```python
from observability.backend.metrics import get_metrics
from observability.backend.logging_config import get_logger

logger = get_logger(__name__)
metrics = get_metrics()

class FSMService:
    async def create_fsm(self, fsm_data):
        """Create FSM with metrics tracking"""

        # Record creation
        metrics.record_fsm_created({
            "user_id": fsm_data.user_id,
            "state_count": len(fsm_data.states)
        })

        logger.info(
            "FSM created",
            fsm_id=fsm_data.id,
            state_count=len(fsm_data.states),
            user_id=fsm_data.user_id
        )

        return fsm_data

    async def optimize_fsm(self, fsm_id, algorithm):
        """Optimize FSM with metrics tracking"""

        # Use context manager to track optimization
        async with metrics.track_optimization(algorithm):
            logger.info("Starting optimization", fsm_id=fsm_id, algorithm=algorithm)

            # Optimization logic...
            result = await self._run_optimization(fsm_id, algorithm)

            # Record metrics
            metrics.record_states_reduced(
                result.original_states - result.optimized_states,
                {"algorithm": algorithm}
            )

            logger.info(
                "Optimization completed",
                fsm_id=fsm_id,
                states_reduced=result.states_reduced
            )

            return result
```

### Step 7: Add Custom Metrics to Endpoints

Update `backend/app/api/v1/fsm.py`:

```python
from fastapi import APIRouter, Depends
from observability.backend.metrics import get_metrics
from observability.backend.logging_config import get_logger

router = APIRouter()
metrics = get_metrics()
logger = get_logger(__name__)

@router.post("/", status_code=201)
async def create_fsm(fsm_data: FSMCreate) -> FSMResponse:
    """Create new FSM"""

    try:
        # Create FSM
        fsm = await fsm_service.create_fsm(fsm_data)

        # Record success
        metrics.record_fsm_created({"state_count": len(fsm.states)})

        logger.info("FSM created successfully", fsm_id=fsm.id)

        return FSMResponse.from_orm(fsm)

    except Exception as e:
        logger.error("Failed to create FSM", error=str(e), error_type=type(e).__name__)
        metrics.record_api_error({"error_type": "create_fsm_failed"})
        raise
```

## Frontend Integration

### Step 1: Add Dependencies

Add to `frontend/package.json`:

```json
{
  "dependencies": {
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-web": "^1.17.0",
    "@opentelemetry/sdk-trace-web": "^1.17.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.45.0",
    "@opentelemetry/instrumentation-fetch": "^0.45.0",
    "@opentelemetry/instrumentation-xml-http-request": "^0.45.0",
    "@opentelemetry/resources": "^1.17.0",
    "@opentelemetry/semantic-conventions": "^1.17.0"
  }
}
```

### Step 2: Initialize Telemetry in main.tsx

Create `frontend/src/telemetry.ts`:

```typescript
import { initializeTelemetry } from '../observability/frontend/telemetry';

export async function initializeObservability() {
  await initializeTelemetry({
    serviceName: 'grayfsm-frontend',
    serviceVersion: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    otlpEndpoint: process.env.VITE_OTLP_ENDPOINT || 'http://localhost:4318',
    enableAutoInstrumentation: true,
    enableErrorTracking: true,
    enablePerformanceMonitoring: true,
    tracesSampler: (context) => {
      // Sample 100% in development, 10% in production
      return process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
    },
  });
}
```

Update `frontend/src/main.tsx`:

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeObservability } from './telemetry'

// Initialize observability before rendering
initializeObservability()
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  })
  .catch((error) => {
    console.error('Failed to initialize observability:', error)
    // Still render app even if observability fails
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  })
```

### Step 3: Track User Interactions

Create `frontend/src/hooks/useObservability.ts`:

```typescript
import { getTracer, trackAsync } from '../observability/frontend/telemetry'

export function useObservability() {
  const tracer = getTracer()

  const trackAPICall = async (
    endpoint: string,
    method: string,
    fn: () => Promise<any>
  ) => {
    return trackAsync(
      `api.${method}.${endpoint.replace(/\//g, '.')}`,
      fn,
      { 'http.method': method, 'http.url': endpoint }
    )
  }

  const trackUserAction = async (
    actionName: string,
    fn: () => Promise<any>
  ) => {
    return trackAsync(`user.${actionName}`, fn)
  }

  return {
    tracer,
    trackAPICall,
    trackUserAction,
  }
}
```

### Step 4: Integrate with API Calls

Update `frontend/src/api/client.ts`:

```typescript
import axios from 'axios'
import { useObservability } from '../hooks/useObservability'

const { trackAPICall } = useObservability()

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

// Track API calls
apiClient.interceptors.request.use((config) => {
  // Trace context will be automatically added by instrumentation
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Errors are automatically tracked
    throw error
  }
)

// Usage
export async function createFSM(fsmData: any) {
  return trackAPICall('/api/v1/fsms', 'POST', () =>
    apiClient.post('/api/v1/fsms', fsmData)
  )
}

export async function optimizeFSM(fsmId: string, algorithm: string) {
  return trackAPICall(`/api/v1/fsms/${fsmId}/optimize`, 'POST', () =>
    apiClient.post(`/api/v1/fsms/${fsmId}/optimize`, { algorithm })
  )
}
```

## Docker Configuration

Update `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy observability module
COPY observability /app/observability

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/app /app/app

# Expose metrics port
EXPOSE 8000 8001

# Run with metrics
CMD ["python", "-m", "uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000"]
```

## Kubernetes Pod Annotations

Update pod specification in `infrastructure/kubernetes/backend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grayfsm-backend
  namespace: grayfsm
spec:
  template:
    metadata:
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8001"
        prometheus.io/path: "/metrics"
      labels:
        app: grayfsm
        component: backend
        version: v1.0
    spec:
      containers:
      - name: backend
        image: grayfsm-backend:latest
        ports:
        - containerPort: 8000
          name: http
        - containerPort: 8001
          name: metrics
        env:
        - name: JAEGER_HOST
          value: "jaeger-collector.observability"
        - name: JAEGER_PORT
          value: "14268"
        - name: STRUCTURED_LOGGING
          value: "true"
```

## Environment Variables

Set in `.env` or deployment configuration:

```bash
# Observability
TELEMETRY_ENABLED=true
JAEGER_ENABLED=true
JAEGER_HOST=jaeger-collector.observability
JAEGER_PORT=14268
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=8001
STRUCTURED_LOGGING=true

# Frontend
VITE_OTLP_ENDPOINT=http://otel-collector:4318
VITE_API_URL=http://localhost:8000
```

## Verification

### Backend

1. Check metrics endpoint:
   ```bash
   curl http://localhost:8001/metrics
   ```

2. Check telemetry logs:
   ```bash
   kubectl logs deployment/grayfsm-backend -n grayfsm | grep -i telemetry
   ```

3. Verify Jaeger traces:
   - Open Jaeger UI: http://localhost:16686
   - Select "grayfsm-backend" service
   - Should see traces

### Frontend

1. Open browser DevTools Console
2. Check for errors related to telemetry
3. Make API calls and verify traces in Jaeger

## Troubleshooting

### Backend not sending traces

1. Check Jaeger connectivity:
   ```bash
   kubectl exec -it deployment/grayfsm-backend -n grayfsm -- \
     nc -zv jaeger-collector.observability 14268
   ```

2. Check telemetry initialization:
   ```bash
   kubectl logs deployment/grayfsm-backend -n grayfsm | grep -i "telemetry"
   ```

### Frontend not sending traces

1. Check browser DevTools Network tab
2. Look for requests to OTLP endpoint
3. Check console for errors
4. Verify OTLP endpoint is accessible

### Metrics not appearing

1. Check pod has prometheus.io annotations
2. Verify metrics port is exposed
3. Check Prometheus scrape targets
4. Verify metrics endpoint responds with data

## Next Steps

1. Follow docs/SETUP.md for complete stack deployment
2. Review docs/DASHBOARDS.md for dashboard creation
3. Check docs/RUNBOOKS.md for troubleshooting
4. Customize metrics in backend/metrics.py
5. Add custom dashboards in Grafana
