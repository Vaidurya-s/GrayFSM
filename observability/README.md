# GrayFSM Observability Stack

Comprehensive observability solution for the GrayFSM project including distributed tracing, metrics, logging, dashboards, and alerting.

## Components

### 1. Distributed Tracing (OpenTelemetry + Jaeger)
- Backend instrumentation with automatic span creation
- Frontend browser tracing
- Trace context propagation across services
- Trace visualization in Jaeger UI

### 2. Application Metrics (Prometheus)
- Custom FSM operation metrics
- Performance metrics (latency, throughput)
- Error rates and status codes
- Database query performance
- Resource utilization metrics

### 3. Centralized Logging (Loki)
- Structured JSON logging in backend
- Frontend error logging
- Log correlation with trace IDs
- Log querying and analysis in Grafana

### 4. Dashboards (Grafana)
- Application health dashboard
- Performance dashboard
- Business metrics dashboard
- Database performance dashboard
- Infrastructure dashboard

### 5. Alerting (Prometheus + AlertManager)
- SLI/SLO definitions
- Critical issue detection
- Multi-channel routing (Slack, Email, PagerDuty)
- Runbooks for troubleshooting

## Directory Structure

```
observability/
├── backend/                 # Backend instrumentation
│   ├── telemetry.py        # OpenTelemetry setup
│   ├── metrics.py          # Custom metrics
│   └── logging_config.py   # Structured logging
├── frontend/               # Frontend instrumentation
│   ├── telemetry.ts        # Browser tracing
│   └── metrics.ts          # Client-side metrics
├── infrastructure/         # K8s/Docker configs
│   ├── jaeger.yaml         # Jaeger deployment
│   ├── loki.yaml           # Loki deployment
│   ├── grafana.yaml        # Grafana deployment
│   └── prometheus-ext.yaml # Extended Prometheus config
├── dashboards/             # Grafana dashboards
│   ├── health.json         # Health dashboard
│   ├── performance.json    # Performance dashboard
│   └── business.json       # Business metrics
├── alerts/                 # Alert rules
│   ├── slo.yaml            # SLI/SLO definitions
│   ├── app-alerts.yaml     # Application alerts
│   └── infra-alerts.yaml   # Infrastructure alerts
└── docs/                   # Documentation
    ├── SETUP.md            # Installation guide
    ├── DASHBOARDS.md       # Dashboard usage
    └── RUNBOOKS.md         # Troubleshooting
```

## Quick Start

### 1. Backend Instrumentation

Add to `backend/requirements.txt`:
```
opentelemetry-api==1.21.0
opentelemetry-sdk==1.21.0
opentelemetry-exporter-jaeger==1.21.0
opentelemetry-instrumentation-fastapi==0.42b0
opentelemetry-instrumentation-sqlalchemy==0.42b0
opentelemetry-instrumentation-redis==0.42b0
opentelemetry-instrumentation-requests==0.42b0
```

### 2. Frontend Instrumentation

Add to `frontend/package.json`:
```json
{
  "dependencies": {
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-web": "^1.17.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.45.0",
    "@opentelemetry/instrumentation-fetch": "^0.45.0",
    "@opentelemetry/instrumentation-xml-http-request": "^0.45.0"
  }
}
```

### 3. Deploy Stack

```bash
# Deploy Jaeger
kubectl apply -f observability/infrastructure/jaeger.yaml

# Deploy Loki
kubectl apply -f observability/infrastructure/loki.yaml

# Deploy Grafana with dashboards
kubectl apply -f observability/infrastructure/grafana.yaml

# Update Prometheus config
kubectl apply -f observability/infrastructure/prometheus-ext.yaml

# Deploy alert rules
kubectl apply -f observability/alerts/
```

## Key Metrics

### FSM Operations
- `grayfsm_fsm_created_total` - Total FSMs created
- `grayfsm_fsm_optimized_total` - Total FSMs optimized
- `grayfsm_optimization_duration_seconds` - Optimization duration
- `grayfsm_states_reduced_total` - Total states reduced

### API Performance
- `http_request_duration_seconds` - Request latency histogram
- `http_requests_total` - Total requests by status/endpoint
- `http_request_size_bytes` - Request size histogram
- `http_response_size_bytes` - Response size histogram

### Database
- `pg_queries_duration_seconds` - Query duration
- `pg_connections_active` - Active connections
- `pg_cache_hit_ratio` - Cache hit ratio

## Key Alerts

- **BackendHighErrorRate**: Error rate > 5%
- **BackendHighLatency**: P95 latency > 1s
- **DatabaseConnectionPoolExhausted**: Connections > 80%
- **DatabaseSlowQueries**: Query time > 1s
- **BackendHighMemoryUsage**: Memory > 85%
- **BackendHighCPUUsage**: CPU > 80%

## SLOs

- **API Availability**: 99.9% (allow 43 minutes downtime/month)
- **API Latency**: P95 < 500ms, P99 < 1s
- **Error Rate**: < 0.1% 4xx, < 0.05% 5xx
- **Database Queries**: P95 < 100ms

## Dashboards

See `dashboards/` for pre-built JSON dashboard definitions:
- **Health Dashboard**: Service availability, error rates
- **Performance Dashboard**: Latency, throughput, resource usage
- **Business Dashboard**: FSM operations, optimization metrics
- **Database Dashboard**: Query performance, connections
- **Infrastructure Dashboard**: K8s resources, node metrics

## Integration

### Slack Alerts
Configure in AlertManager:
```yaml
receivers:
- name: slack
  slack_configs:
  - api_url: YOUR_SLACK_WEBHOOK
    channel: '#alerts'
    title: '{{ .GroupLabels.alertname }}'
```

### PagerDuty Integration
```yaml
receivers:
- name: pagerduty
  pagerduty_configs:
  - service_key: YOUR_SERVICE_KEY
    severity: '{{ .GroupLabels.severity }}'
```

## Next Steps

1. Follow SETUP.md for detailed installation
2. Review DASHBOARDS.md for dashboard usage
3. Check RUNBOOKS.md for troubleshooting common issues
4. Customize alerts in `alerts/` directory
5. Add custom metrics as needed

## Support

For issues or questions:
- Check runbooks in `docs/RUNBOOKS.md`
- Review Prometheus targets at `http://prometheus:9090/targets`
- Check Jaeger traces at `http://jaeger-ui:16686`
- View Grafana dashboards at `http://grafana:3000`
