# GrayFSM Observability Stack - Complete Index

Complete reference guide for the observability implementation.

## Directory Structure

```
observability/
├── README.md                        # Overview and quick start
├── INDEX.md                         # This file
├── INTEGRATION_GUIDE.md            # Step-by-step integration
│
├── backend/                         # Backend instrumentation
│   ├── telemetry.py               # OpenTelemetry setup
│   ├── metrics.py                 # Custom business metrics
│   └── logging_config.py          # Structured logging
│
├── frontend/                        # Frontend instrumentation
│   └── telemetry.ts               # Browser tracing and monitoring
│
├── infrastructure/                  # Kubernetes deployments
│   ├── jaeger.yaml                # Distributed tracing
│   ├── loki.yaml                  # Log aggregation
│   ├── grafana.yaml               # Visualization
│   └── prometheus-ext.yaml        # Extended Prometheus config
│
├── alerts/                          # Alert configurations
│   ├── slo.yaml                   # SLI/SLO definitions
│   └── alertmanager.yaml          # Alert routing
│
├── dashboards/                      # Grafana dashboards
│   ├── health.json                # Health dashboard
│   ├── performance.json           # Performance dashboard
│   ├── business.json              # Business metrics
│   ├── database.json              # Database performance
│   └── infrastructure.json        # Infrastructure metrics
│
└── docs/                            # Documentation
    ├── SETUP.md                    # Installation guide
    ├── DASHBOARDS.md              # Dashboard usage
    └── RUNBOOKS.md                # Troubleshooting
```

## Quick Links

### Documentation
- [README.md](./README.md) - Overview and component description
- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Step-by-step integration
- [docs/SETUP.md](./docs/SETUP.md) - Installation and deployment
- [docs/DASHBOARDS.md](./docs/DASHBOARDS.md) - Dashboard usage guide
- [docs/RUNBOOKS.md](./docs/RUNBOOKS.md) - Troubleshooting guides

### Configuration Files

#### Backend Instrumentation
- [backend/telemetry.py](./backend/telemetry.py) - OpenTelemetry initialization and configuration
- [backend/metrics.py](./backend/metrics.py) - Custom business metrics definitions
- [backend/logging_config.py](./backend/logging_config.py) - Structured logging setup

#### Frontend Instrumentation
- [frontend/telemetry.ts](./frontend/telemetry.ts) - Browser tracing and performance monitoring

#### Kubernetes Infrastructure
- [infrastructure/jaeger.yaml](./infrastructure/jaeger.yaml) - Jaeger deployment for distributed tracing
- [infrastructure/loki.yaml](./infrastructure/loki.yaml) - Loki deployment for log aggregation
- [infrastructure/grafana.yaml](./infrastructure/grafana.yaml) - Grafana deployment for visualization
- [infrastructure/prometheus-ext.yaml](./infrastructure/prometheus-ext.yaml) - Extended Prometheus scrape and recording rules

#### Alerting
- [alerts/slo.yaml](./alerts/slo.yaml) - SLI/SLO definitions and recording rules
- [alerts/alertmanager.yaml](./alerts/alertmanager.yaml) - AlertManager configuration and alert routing

## Component Overview

### 1. Distributed Tracing (Jaeger)

**Purpose**: Track requests across services and identify performance bottlenecks

**Key Features**:
- Automatic span creation for FastAPI endpoints
- SQLAlchemy query tracing
- Redis operation tracing
- Trace context propagation (W3C, Jaeger, B3)
- Trace sampling configuration
- Span batching and export

**Files**:
- [backend/telemetry.py](./backend/telemetry.py) - Telemetry configuration
- [infrastructure/jaeger.yaml](./infrastructure/jaeger.yaml) - Jaeger deployment

**Access**: http://localhost:16686 (after port-forward)

### 2. Application Metrics (Prometheus)

**Purpose**: Collect quantitative measurements of system behavior

**Key Metrics**:
- FSM operations (created, deleted, updated, validated)
- Optimization metrics (duration, success rate, states reduced)
- API performance (request duration, throughput, errors)
- Database performance (query duration, connections, cache hits)
- Algorithm performance (execution time, iterations)
- Export operations (duration, size, success rate)

**Files**:
- [backend/metrics.py](./backend/metrics.py) - Metric definitions
- [infrastructure/prometheus-ext.yaml](./infrastructure/prometheus-ext.yaml) - Scrape configs and recording rules

**Access**: http://localhost:9090 (after port-forward)

### 3. Centralized Logging (Loki)

**Purpose**: Aggregate and analyze logs with trace correlation

**Key Features**:
- Structured JSON logging in production
- Automatic log collection via Promtail
- Log correlation with trace IDs
- Full-text search capability
- Log retention policies

**Files**:
- [backend/logging_config.py](./backend/logging_config.py) - Logging setup
- [infrastructure/loki.yaml](./infrastructure/loki.yaml) - Loki and Promtail deployment

**Access**: http://localhost:3000 (Grafana) -> Explore -> Loki

### 4. Visualization (Grafana)

**Purpose**: Create dashboards for monitoring and alerting

**Dashboards**:
- Health Dashboard: System availability and error rates
- Performance Dashboard: Latency, throughput, resource usage
- Business Metrics Dashboard: FSM operations, optimization performance
- Database Dashboard: Query performance, connections, cache
- Infrastructure Dashboard: Kubernetes resources

**Files**:
- [infrastructure/grafana.yaml](./infrastructure/grafana.yaml) - Grafana deployment
- [dashboards/](./dashboards/) - Dashboard JSON definitions

**Access**: http://localhost:3000

**Default Credentials**: admin / GrayFSM2024!

### 5. Alerting (Prometheus + AlertManager)

**Purpose**: Detect issues and notify relevant teams

**Alert Types**:
- API availability and latency
- Error rates (4xx, 5xx)
- Database performance and connections
- Memory and CPU utilization
- Optimization failure rates
- Cache hit ratios

**Files**:
- [alerts/slo.yaml](./alerts/slo.yaml) - SLI/SLO definitions
- [alerts/alertmanager.yaml](./alerts/alertmanager.yaml) - Alert routing

**Access**: http://localhost:9093 (after port-forward)

## Key Metrics Reference

### FSM Operations
```
grayfsm_fsm_created_total          - Total FSMs created
grayfsm_fsm_deleted_total          - Total FSMs deleted
grayfsm_fsm_updated_total          - Total FSMs updated
grayfsm_fsm_validated_total        - Total FSMs validated
```

### Optimization
```
grayfsm_optimization_started_total      - Optimizations started
grayfsm_optimization_completed_total    - Optimizations completed
grayfsm_optimization_failed_total       - Optimizations failed
grayfsm_optimization_duration_seconds   - Optimization duration histogram
grayfsm_states_reduced_total           - Total states reduced
grayfsm_transitions_optimized_total    - Transitions optimized
```

### API Performance
```
http_request_duration_seconds      - Request latency histogram
http_requests_total                - Total requests by status
http_request_size_bytes            - Request size histogram
http_response_size_bytes           - Response size histogram
```

### Database
```
grayfsm_db_query_duration_seconds   - Query duration histogram
grayfsm_db_connections_active      - Active connections gauge
grayfsm_cache_hit_total            - Cache hits
grayfsm_cache_miss_total           - Cache misses
```

## SLOs and Alerts

### API Availability SLO
- **Objective**: 99.9% (43 minutes downtime/month)
- **Alert Threshold**: < 99.5% for 5 minutes
- **Critical if**: < 99% for 5 minutes

### API Latency SLO
- **P95**: < 500ms
- **P99**: < 1s
- **Alert Thresholds**:
  - Warning: P95 > 400ms for 10 minutes
  - Critical: P95 > 1s for 5 minutes

### Error Rate SLO
- **4xx**: < 1%
- **5xx**: < 0.05%
- **Alert Thresholds**:
  - Warning: 4xx > 0.5% for 10 minutes
  - Critical: 5xx > 0.1% for 5 minutes

### Database Query SLO
- **P95**: < 100ms
- **P99**: < 500ms
- **Alert Threshold**: P95 > 100ms for 10 minutes

### Optimization Success SLO
- **Objective**: > 95% success rate
- **Alert Threshold**: < 90% for 10 minutes

## Implementation Checklist

- [ ] Read README.md for overview
- [ ] Follow INTEGRATION_GUIDE.md for backend integration
- [ ] Add OpenTelemetry dependencies to backend
- [ ] Configure telemetry in backend/app/main.py
- [ ] Add custom metrics to services
- [ ] Add structured logging to endpoints
- [ ] (Optional) Integrate frontend telemetry
- [ ] Deploy Jaeger to Kubernetes
- [ ] Deploy Loki to Kubernetes
- [ ] Deploy Grafana to Kubernetes
- [ ] Configure Prometheus scrape targets
- [ ] Import dashboards into Grafana
- [ ] Configure AlertManager webhooks
- [ ] Test end-to-end with sample requests
- [ ] Review DASHBOARDS.md for dashboard usage
- [ ] Review RUNBOOKS.md for alert handling
- [ ] Set up on-call rotation
- [ ] Document custom metrics and alerts

## Common Tasks

### Access Observability Stack

```bash
# Jaeger UI
kubectl port-forward -n observability svc/jaeger-ui 16686:16686
# http://localhost:16686

# Grafana
kubectl port-forward -n observability svc/grafana 3000:3000
# http://localhost:3000

# Prometheus
kubectl port-forward -n grayfsm-monitoring svc/prometheus 9090:9090
# http://localhost:9090

# AlertManager
kubectl port-forward -n grayfsm-monitoring svc/alertmanager 9093:9093
# http://localhost:9093
```

### View Application Logs

```bash
# Stream logs
kubectl logs -f deployment/grayfsm-backend -n grayfsm

# View with timestamps
kubectl logs deployment/grayfsm-backend -n grayfsm --timestamps=true

# Last 100 lines
kubectl logs deployment/grayfsm-backend -n grayfsm --tail=100
```

### Query Metrics

```promql
# FSM creation rate
rate(grayfsm_fsm_created_total[5m])

# API latency P95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

### Trigger Alert

1. Execute high-load test
2. Monitor Prometheus targets
3. Check AlertManager notifications
4. Review Grafana dashboards

## Troubleshooting

### Traces Not Appearing
- Check Jaeger connectivity from backend
- Verify telemetry initialization in logs
- Check sampling configuration

### Logs Not Appearing
- Verify Loki is running
- Check Promtail on nodes
- Ensure pod labels match scrape config

### Metrics Not Appearing
- Verify Prometheus scrape targets
- Check pod has prometheus.io annotations
- Verify metrics endpoint responds

See [docs/RUNBOOKS.md](./docs/RUNBOOKS.md) for detailed troubleshooting.

## Support and Maintenance

### Regular Tasks
- Review and optimize dashboards (weekly)
- Update alert thresholds based on SLOs (monthly)
- Clean up old logs and traces (weekly)
- Rotate AlertManager secrets (quarterly)

### Documentation Updates
- Update dashboards when adding new metrics
- Document custom alerts in runbooks
- Keep SLOs aligned with business requirements

## Related Files

### Backend Integration
- `backend/requirements.txt` - Add observability dependencies
- `backend/app/main.py` - Initialize telemetry
- `backend/app/config.py` - Add observability settings
- `backend/app/services/` - Add custom metrics
- `backend/app/api/v1/` - Track API operations

### Kubernetes Deployment
- `infrastructure/kubernetes/backend-deployment.yaml` - Add pod annotations
- `infrastructure/kubernetes/configmap.yaml` - Environment variables
- `infrastructure/docker/Dockerfile` - Expose metrics port

### CI/CD Integration
- `.github/workflows/deploy.yml` - Deploy observability stack

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/)
- [Jaeger Documentation](https://www.jaegertracing.io/)
- [Prometheus Documentation](https://prometheus.io/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/loki/)

## Version History

- **v1.0.0** (Nov 29, 2024)
  - Initial observability stack implementation
  - Jaeger for distributed tracing
  - Prometheus metrics and recording rules
  - Loki for centralized logging
  - Grafana dashboards and visualization
  - AlertManager integration
  - SLI/SLO definitions
  - Complete documentation and runbooks
