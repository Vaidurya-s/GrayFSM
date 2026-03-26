# GrayFSM Observability Stack - START HERE

Welcome\! This guide will help you get started with the observability stack for GrayFSM.

## What Is This?

A complete observability solution comprising:
- **Distributed Tracing** (Jaeger) - Track requests across services
- **Metrics** (Prometheus) - Monitor application behavior (55+ metrics)
- **Logging** (Loki) - Centralized structured logs
- **Visualization** (Grafana) - Beautiful dashboards
- **Alerting** (AlertManager) - Intelligent alerts with SLOs

## Quick Links

### Read First
1. **[README.md](./README.md)** - Overview (5 min read)
2. **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - What's included (5 min read)

### To Integrate
- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - Step-by-step for backend & frontend

### To Deploy
- **[docs/SETUP.md](./docs/SETUP.md)** - Kubernetes deployment guide
- **[QUICK_START.sh](./QUICK_START.sh)** - Automated deployment script

### To Use
- **[docs/DASHBOARDS.md](./docs/DASHBOARDS.md)** - How to use dashboards
- **[docs/RUNBOOKS.md](./docs/RUNBOOKS.md)** - Alert troubleshooting

### Reference
- **[INDEX.md](./INDEX.md)** - Complete navigation
- **[FILE_MANIFEST.md](./FILE_MANIFEST.md)** - All files created
- **[FINAL_SUMMARY.txt](./FINAL_SUMMARY.txt)** - Visual summary

## Getting Started in 5 Minutes

### 1. Understand What You're Getting (2 min)
```
Read: README.md
Key points:
- 55+ metrics tracking FSM, API, database, cache operations
- Distributed tracing across services
- Centralized logging with trace correlation
- 5 professional dashboards
- 20+ intelligent alert rules
```

### 2. See What's Included (2 min)
```
Files created:
✓ Backend instrumentation (telemetry.py, metrics.py, logging_config.py)
✓ Frontend tracing (telemetry.ts)
✓ Kubernetes deployments (Jaeger, Loki, Grafana configs)
✓ Alert definitions (20+ rules with SLI/SLOs)
✓ Complete documentation (8 guides with examples)

Location: /home/arunupscee/Music/grayFSM/observability/
```

### 3. Plan Your Integration (1 min)
```
Follow: INTEGRATION_GUIDE.md

Steps:
1. Add dependencies from REQUIREMENTS.txt
2. Update backend/app/main.py
3. Update backend/app/config.py
4. Add metrics to services
5. Deploy stack to Kubernetes
6. Test with sample traffic
```

## File Locations

All files are in: `/home/arunupscee/Music/grayFSM/observability/`

### Code Files (Ready to Use)
- `backend/telemetry.py` - OpenTelemetry setup
- `backend/metrics.py` - Custom metrics (55+)
- `backend/logging_config.py` - Structured logging
- `frontend/telemetry.ts` - Browser tracing

### Kubernetes Configs (Ready to Deploy)
- `infrastructure/jaeger.yaml` - Distributed tracing
- `infrastructure/loki.yaml` - Log aggregation
- `infrastructure/grafana.yaml` - Visualization
- `infrastructure/prometheus-ext.yaml` - Metrics config
- `alerts/slo.yaml` - Alert rules
- `alerts/alertmanager.yaml` - Alert routing

## Key Metrics

**55+ Metrics** covering:
- FSM operations (created, deleted, updated, validated)
- Optimization performance (duration, success rate, states reduced)
- API performance (latency, error rates, throughput)
- Database queries (latency, connections, cache hits)
- Algorithms (execution time, iterations)
- Export operations (success rate, size, duration)

## Key SLOs

**8 Service Level Objectives** defined:
1. API Availability: 99.9%
2. API Latency P95: < 500ms
3. API Latency P99: < 1s
4. Error Rate (4xx): < 1%
5. Error Rate (5xx): < 0.05%
6. Database Query P95: < 100ms
7. Optimization Success: > 95%
8. Cache Hit Ratio: > 70%

## Deployment Steps

### Automated (Recommended)
```bash
bash /home/arunupscee/Music/grayFSM/observability/QUICK_START.sh
```

### Manual
```bash
# Follow docs/SETUP.md step-by-step
```

## Access Services (After Deployment)

```bash
# Jaeger (Distributed Tracing) - http://localhost:16686
kubectl port-forward -n observability svc/jaeger-ui 16686:16686

# Grafana (Dashboards) - http://localhost:3000
kubectl port-forward -n observability svc/grafana 3000:3000
# Default login: admin / GrayFSM2024\!

# Prometheus (Metrics) - http://localhost:9090
kubectl port-forward -n grayfsm-monitoring svc/prometheus 9090:9090

# AlertManager - http://localhost:9093
kubectl port-forward -n grayfsm-monitoring svc/alertmanager 9093:9093
```

## Integration Checklist

### Backend (1-2 hours)
- [ ] Add dependencies to requirements.txt
- [ ] Update app/main.py with telemetry
- [ ] Update app/config.py
- [ ] Add metrics to services
- [ ] Test with sample traffic

### Frontend (30 min, optional)
- [ ] Add dependencies to package.json
- [ ] Initialize telemetry in main.tsx
- [ ] Test browser tracing

### Kubernetes (30 min)
- [ ] Run QUICK_START.sh or deploy manually
- [ ] Update pod annotations
- [ ] Configure AlertManager webhooks
- [ ] Test alerts

## Metrics Examples

### FSM Operations
```promql
rate(grayfsm_fsm_created_total[5m])
rate(grayfsm_optimization_completed_total[5m])
```

### API Performance
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
rate(http_requests_total{status=~"5.."}[5m])
```

### Database
```promql
histogram_quantile(0.95, rate(grayfsm_db_query_duration_seconds_bucket[5m]))
grayfsm_db_active_connections / 20
```

See [docs/DASHBOARDS.md](./docs/DASHBOARDS.md) for more examples.

## Common Tasks

### View Traces
1. Open Jaeger UI (http://localhost:16686)
2. Select service: grayfsm-backend
3. View traces for your requests

### Check Metrics
1. Open Prometheus (http://localhost:9090)
2. Enter metric name (e.g., `grayfsm_fsm_created_total`)
3. View graphs

### View Logs
1. Open Grafana (http://localhost:3000)
2. Go to Explore
3. Select Loki datasource
4. Query: `{job="grayfsm-backend"}`

### Check Alerts
1. Open AlertManager (http://localhost:9093)
2. View active alerts
3. Click alert for details

## Troubleshooting

### Issue: Traces not appearing
**Solution**: See [docs/SETUP.md](./docs/SETUP.md) -> Troubleshooting

### Issue: Metrics not showing
**Solution**: Check pod annotations and Prometheus targets

### Issue: Logs not appearing
**Solution**: Verify Promtail is running on nodes

### Issue: Alert not firing
**Solution**: Check Prometheus rules and alert thresholds

See [docs/RUNBOOKS.md](./docs/RUNBOOKS.md) for detailed troubleshooting.

## Documentation Structure

```
observability/
├── START_HERE.md (You are here)
├── README.md (Overview)
├── INTEGRATION_GUIDE.md (How to integrate)
├── docs/
│   ├── SETUP.md (How to deploy)
│   ├── DASHBOARDS.md (How to use dashboards)
│   └── RUNBOOKS.md (How to respond to alerts)
└── INDEX.md (Complete reference)
```

## Next Steps

1. **Read** [README.md](./README.md) (5 min)
2. **Review** [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) (15 min)
3. **Plan** your integration (30 min)
4. **Integrate** with backend (1-2 hours)
5. **Deploy** stack (QUICK_START.sh - 10 min)
6. **Test** with sample traffic (30 min)
7. **Monitor** and optimize (ongoing)

## Questions?

- **Integration help**: See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
- **Setup issues**: See [docs/SETUP.md](./docs/SETUP.md)
- **How to use**: See [docs/DASHBOARDS.md](./docs/DASHBOARDS.md)
- **Alert response**: See [docs/RUNBOOKS.md](./docs/RUNBOOKS.md)
- **General reference**: See [INDEX.md](./INDEX.md)

## Key Features

✓ Automatic instrumentation (minimal code changes)
✓ 55+ custom business metrics
✓ Distributed tracing (Jaeger)
✓ Centralized logging (Loki)
✓ Professional dashboards (Grafana)
✓ Intelligent alerting (AlertManager)
✓ 8 SLI/SLOs defined
✓ 11 detailed runbooks
✓ Complete documentation
✓ Production-ready
✓ High availability
✓ Easy to integrate

---

**Ready to get started?** Read [README.md](./README.md) next\!
