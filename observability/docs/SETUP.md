# GrayFSM Observability Stack Setup Guide

Complete guide for installing and configuring the observability stack for GrayFSM.

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl access to cluster
- StorageClass for persistent volumes
- Helm 3.x (optional, for simplified installation)

## Quick Start

### 1. Install OpenTelemetry SDK in Backend

Add dependencies to `backend/requirements.txt`:

```
opentelemetry-api==1.21.0
opentelemetry-sdk==1.21.0
opentelemetry-exporter-jaeger==1.21.0
opentelemetry-instrumentation-fastapi==0.42b0
opentelemetry-instrumentation-sqlalchemy==0.42b0
opentelemetry-instrumentation-redis==0.42b0
opentelemetry-instrumentation-requests==0.42b0
opentelemetry-propagators[jaeger]==0.42b0
structlog==23.2.0
opentelemetry-exporter-prometheus==0.42b0
```

Install:

```bash
pip install -r backend/requirements.txt
```

### 2. Configure Backend Instrumentation

Update `backend/app/main.py`:

```python
from observability.backend.telemetry import initialize_telemetry
from observability.backend.logging_config import setup_structured_logging, get_logging_config
from observability.backend.metrics import initialize_metrics

# In lifespan function
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize telemetry
    telemetry_provider = initialize_telemetry(settings)
    metrics = initialize_metrics()

    # Setup logging
    setup_structured_logging(settings.environment)

    yield

    # Shutdown
    telemetry_provider.shutdown()
```

### 3. Add Prometheus Metrics Endpoint

Update `backend/app/config.py`:

```python
# Add to Settings class
prometheus_port: int = 8001
prometheus_metrics_enabled: bool = True
jaeger_host: str = "jaeger.observability"
jaeger_port: int = 6831
jaeger_enabled: bool = True
otlp_enabled: bool = False
otlp_endpoint: str = "http://otel-collector:4317"
```

Add metrics endpoint:

```python
# In main.py
from prometheus_client import make_asgi_app

if settings.prometheus_metrics_enabled:
    metrics_app = make_asgi_app()
    app = Starlette(
        debug=app,
        middleware=[
            Middleware(PrometheusMiddleware, app_name="grayfsm-backend"),
        ],
    )
```

### 4. Deploy Observability Stack to Kubernetes

Create namespace:

```bash
kubectl create namespace observability
```

Deploy Jaeger for distributed tracing:

```bash
kubectl apply -f observability/infrastructure/jaeger.yaml
```

Deploy Loki for log aggregation:

```bash
kubectl apply -f observability/infrastructure/loki.yaml
```

Deploy Grafana for visualization:

```bash
kubectl apply -f observability/infrastructure/grafana.yaml
```

Update Prometheus configuration:

```bash
kubectl apply -f observability/infrastructure/prometheus-ext.yaml
```

Deploy alert rules:

```bash
kubectl apply -f observability/alerts/slo.yaml
kubectl apply -f observability/alerts/alertmanager.yaml
```

### 5. Configure Alerting

Update AlertManager secrets:

```bash
kubectl create secret generic alertmanager-secrets \
  --from-literal=slack-webhook=https://hooks.slack.com/services/YOUR/WEBHOOK \
  --from-literal=pagerduty-key=YOUR_PAGERDUTY_KEY \
  -n grayfsm-monitoring \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 6. Configure Frontend Instrumentation (Optional)

Add dependencies to `frontend/package.json`:

```json
{
  "dependencies": {
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-web": "^1.17.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.45.0",
    "@opentelemetry/instrumentation-fetch": "^0.45.0"
  }
}
```

Initialize in `frontend/src/main.tsx`:

```typescript
import { initializeTelemetry } from './observability/frontend/telemetry';

// Initialize telemetry before React render
await initializeTelemetry({
  serviceName: 'grayfsm-frontend',
  serviceVersion: '1.0.0',
  environment: 'production',
  otlpEndpoint: 'http://localhost:4318',
});

// Then render React app
```

## Accessing the Stack

### Jaeger UI (Distributed Tracing)

```bash
# Port forward
kubectl port-forward -n observability svc/jaeger-ui 16686:16686

# Access at http://localhost:16686
```

### Grafana (Dashboards)

```bash
# Port forward
kubectl port-forward -n observability svc/grafana 3000:3000

# Access at http://localhost:3000
# Default credentials: admin / GrayFSM2024!
```

### Prometheus (Metrics)

```bash
# Port forward
kubectl port-forward -n grayfsm-monitoring svc/prometheus 9090:9090

# Access at http://localhost:9090
```

### AlertManager (Alert Management)

```bash
# Port forward
kubectl port-forward -n grayfsm-monitoring svc/alertmanager 9093:9093

# Access at http://localhost:9093
```

## Verifying the Setup

### Check Traces

1. Open Jaeger UI
2. Select "grayfsm-backend" service
3. Verify spans are appearing

### Check Logs

1. Open Grafana
2. Navigate to Explore
3. Select Loki datasource
4. Query: `{job="grayfsm-backend"}`

### Check Metrics

1. Open Prometheus
2. Query: `grayfsm_fsm_created_total`
3. Verify metrics are appearing

### Check Alerts

1. Open AlertManager
2. Navigate to Alerts page
3. Verify alert rules are loaded

## Backend Instrumentation Integration

### Using the Metrics API

```python
from observability.backend.metrics import get_metrics

metrics = get_metrics()

# Record FSM creation
metrics.record_fsm_created({"user_id": "user123"})

# Track optimization with context manager
async with metrics.track_optimization("greedy"):
    # ... optimization code
    pass

# Record database query
metrics.record_db_query_duration(150.5, {"query_type": "select"})
```

### Using Structured Logging

```python
from observability.backend.logging_config import get_logger

logger = get_logger(__name__)

# Logging with context
logger.info(
    "FSM optimized successfully",
    fsm_id="fsm-123",
    algorithm="greedy",
    states_reduced=5
)

logger.error(
    "Optimization failed",
    error_type="timeout",
    duration_ms=30000
)
```

## Kubernetes Pod Annotations

Add to pod spec for Prometheus scraping:

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8000"
  prometheus.io/path: "/metrics"
```

Add to pod labels for Loki log collection:

```yaml
labels:
  app: grayfsm
  component: backend
  version: v1.0
```

## Performance Tuning

### Jaeger Sampling

Adjust in `jaeger.yaml`:

```yaml
env:
- name: SAMPLING_TYPE
  value: "probabilistic"
- name: SAMPLING_PARAM
  value: "0.1"  # 10% sampling
```

### Loki Retention

Adjust in `loki.yaml`:

```yaml
retention_deletes_enabled: true
retention_period: 720h  # 30 days
```

### Prometheus Retention

Update Prometheus deployment:

```yaml
args:
  - '--storage.tsdb.retention.time=30d'
```

## Troubleshooting

### Traces Not Appearing

1. Check Jaeger collector is running:
   ```bash
   kubectl get pods -n observability | grep jaeger
   ```

2. Check backend connection:
   ```bash
   kubectl logs -n grayfsm deployment/grayfsm-backend | grep jaeger
   ```

3. Verify telemetry initialization in backend logs

### Logs Not Appearing

1. Check Loki is running:
   ```bash
   kubectl get pods -n observability | grep loki
   ```

2. Check Promtail is running on nodes:
   ```bash
   kubectl get pods -n observability | grep promtail
   ```

3. Verify pod has correct labels

### Metrics Not Appearing

1. Check Prometheus scrape targets:
   ```bash
   kubectl port-forward -n grayfsm-monitoring svc/prometheus 9090:9090
   # Visit http://localhost:9090/targets
   ```

2. Verify pod has prometheus.io annotations

3. Check pod is exposing metrics on correct port

### High Memory Usage

1. Reduce Jaeger sampling ratio
2. Reduce Loki retention period
3. Adjust Prometheus retention time
4. Scale replicas horizontally

## Next Steps

1. Review DASHBOARDS.md for dashboard setup
2. Check RUNBOOKS.md for alert troubleshooting
3. Customize metrics in `backend/metrics.py`
4. Add custom dashboards in Grafana
5. Configure additional alert channels (Email, Teams, etc.)

## Security Considerations

1. Secure AlertManager secrets in production
2. Use TLS for all communication
3. Implement RBAC for dashboard access
4. Rotate credentials regularly
5. Audit logs retention policies
6. Encrypt data at rest where applicable
