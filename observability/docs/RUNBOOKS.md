# GrayFSM Observability Runbooks

Troubleshooting guides for common alerts and issues.

## General Approach

When an alert fires:

1. **Acknowledge** the alert in AlertManager/PagerDuty
2. **Investigate** using the observability tools
3. **Identify** the root cause
4. **Mitigate** the immediate issue
5. **Resolve** the underlying problem
6. **Document** findings for prevention

## High Error Rate (5xx) - CRITICAL

**Alert**: BackendHighErrorRate / SLO_ErrorRate5xxMiss
**Threshold**: > 0.05% for 5 minutes

### Investigate

1. **Check current errors**:
   ```bash
   kubectl port-forward -n grayfsm-monitoring svc/prometheus 9090:9090
   ```

   Query: `rate(http_requests_total{status=~"5.."}[5m])`

2. **View error logs**:
   ```bash
   kubectl port-forward -n observability svc/grafana 3000:3000
   ```
   - Navigate to Explore
   - Select Loki datasource
   - Query: `{level="error"}`

3. **Check traces**:
   ```bash
   kubectl port-forward -n observability svc/jaeger-ui 16686:16686
   ```
   - Select grayfsm-backend service
   - Filter by error status

### Common Causes

1. **Insufficient database connections**
   - Query: `grayfsm_db_active_connections / 20`
   - Solution: Increase pool size or reduce query load

2. **Algorithm timeout**
   - Check logs for "timeout" or "TooLongError"
   - Solution: Optimize algorithm or increase timeout

3. **Memory pressure**
   - Query: `container_memory_working_set_bytes / container_spec_memory_limit_bytes`
   - Solution: Increase memory limits or optimize code

4. **External service failure**
   - Check dependencies (database, cache)
   - Query logs for connection errors

### Mitigation Steps

1. **Immediate**: Scale up replicas if CPU/memory is not bottleneck
   ```bash
   kubectl scale deployment grayfsm-backend --replicas=3 -n grayfsm
   ```

2. **Short-term**: Reduce optimization timeout
   ```bash
   kubectl set env deployment/grayfsm-backend \
     ALGORITHM_TIMEOUT_MS=15000 -n grayfsm
   ```

3. **Long-term**:
   - Optimize database queries
   - Implement circuit breaker pattern
   - Add comprehensive error handling

## High Latency (P95 > 500ms) - WARNING

**Alert**: BackendHighLatency / SLO_APILatencyP95Miss
**Threshold**: > 500ms for 10 minutes

### Investigate

1. **Check latency by endpoint**:
   ```promql
   histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) by (endpoint)
   ```

2. **Identify slow operations**:
   - View Grafana "Performance Dashboard"
   - Check database query performance
   - Check optimization duration

3. **View traces for slow requests**:
   - Open Jaeger UI
   - Select service: grayfsm-backend
   - Sort by duration
   - Analyze span waterfall

### Common Causes

1. **Slow database queries**
   - Check slow query logs:
     ```promql
     histogram_quantile(0.95, rate(grayfsm_db_query_duration_seconds_bucket[5m]))
     ```
   - Solution: Optimize queries, add indexes

2. **Optimization algorithm slow**
   - Query: `histogram_quantile(0.95, rate(grayfsm_optimization_duration_seconds_bucket[5m]))`
   - Solution: Use faster algorithm, reduce FSM complexity

3. **Cache misses**
   - Query: `rate(grayfsm_cache_miss_total[5m])`
   - Solution: Warm cache, increase TTL

4. **Resource contention**
   - Check CPU/memory usage
   - Check network I/O
   - Solution: Scale replicas

### Mitigation Steps

1. **Enable caching**:
   ```bash
   kubectl set env deployment/grayfsm-backend \
     EXPORT_CACHE_ENABLED=true -n grayfsm
   ```

2. **Optimize hot paths**:
   - Identify slow endpoints in Jaeger
   - Profile with sampling

3. **Scale horizontally**:
   ```bash
   kubectl scale deployment grayfsm-backend --replicas=3 -n grayfsm
   ```

## Database Connection Pool Exhausted - CRITICAL

**Alert**: DatabaseConnectionPoolExhausted
**Threshold**: > 80% utilization

### Investigate

1. **Check pool status**:
   ```promql
   grayfsm_db_active_connections / 20
   ```

2. **Identify connection leaks**:
   - Check logs for unclosed connections
   - Monitor active connections over time
   - Query: `rate(grayfsm_db_connections_active[1m])`

3. **Review query patterns**:
   - Long-running transactions
   - Inefficient queries holding connections

### Common Causes

1. **Connection leak**
   - Check SQLAlchemy session handling
   - Verify context managers are used
   - Review connection pooling config

2. **Slow queries holding connections**
   - Identify slow queries in logs
   - Check query execution plans
   - Add indexes if needed

3. **High concurrency spike**
   - Temporary burst in requests
   - Scale replicas temporarily

### Mitigation Steps

1. **Immediate**: Kill long-running queries (if safe)
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE duration > interval '5 minutes';
   ```

2. **Short-term**: Increase pool size
   ```bash
   kubectl set env deployment/grayfsm-backend \
     DATABASE_POOL_SIZE=30 -n grayfsm
   ```

3. **Long-term**:
   - Review and optimize queries
   - Implement connection pooling proxy (PgBouncer)
   - Add query timeout constraints

## Slow Database Queries

**Alert**: DatabaseSlowQueries
**Threshold**: Average query time > 1s

### Investigate

1. **Find slow queries**:
   ```sql
   SELECT query, mean_exec_time FROM pg_stat_statements
   ORDER BY mean_exec_time DESC LIMIT 10;
   ```

2. **Check query plan**:
   ```sql
   EXPLAIN ANALYZE SELECT ...;
   ```

3. **Review indexes**:
   ```sql
   SELECT tablename, indexname FROM pg_indexes
   WHERE tablename IN ('fsm', 'optimization_result', 'export');
   ```

### Common Causes

1. **Missing indexes**
   - Solution: Add indexes on frequently filtered columns

2. **N+1 queries**
   - Check logs for repeated queries
   - Solution: Use JOIN or batch queries

3. **Poor query design**
   - Analyze execution plan
   - Solution: Rewrite query, add indexes

### Mitigation Steps

1. **Create missing index**:
   ```sql
   CREATE INDEX idx_fsm_user_id ON fsm(user_id);
   ```

2. **Optimize query**:
   - Add WHERE clauses
   - Use LIMIT
   - Join eagerly

3. **Monitor with Prometheus**:
   ```promql
   histogram_quantile(0.95, rate(grayfsm_db_query_duration_seconds_bucket[5m]))
   ```

## High Memory Usage

**Alert**: BackendHighMemoryUsage / SLO_MemoryUtilizationHigh
**Threshold**: > 85% of limit

### Investigate

1. **Check memory usage**:
   ```promql
   container_memory_working_set_bytes{pod=~"grayfsm-backend.*"} / 1e9
   ```

2. **Identify memory leak**:
   - Monitor over time
   - Check if growing constantly

3. **Check memory by component**:
   - Python process profiling
   - Jaeger memory usage
   - Loki memory usage

### Common Causes

1. **Memory leak in application**
   - Use memory profiler: `memory_profiler`
   - Check for unbounded caches
   - Review trace sampling

2. **Increased data volume**
   - Larger FSMs being processed
   - Solution: Paginate or batch processing

3. **Loki/Jaeger memory growth**
   - Reduce retention policies
   - Adjust chunk sizes
   - Scale horizontally

### Mitigation Steps

1. **Immediate**: Restart pod to clear memory
   ```bash
   kubectl rollout restart deployment/grayfsm-backend -n grayfsm
   ```

2. **Short-term**: Increase memory limits
   ```yaml
   resources:
     limits:
       memory: 1Gi
   ```

3. **Long-term**:
   - Profile and optimize code
   - Implement memory pooling
   - Regular garbage collection

## High CPU Usage

**Alert**: BackendHighCPUUsage / SLO_CPUUtilizationHigh
**Threshold**: > 80% for 5-10 minutes

### Investigate

1. **Check CPU usage**:
   ```promql
   rate(container_cpu_usage_seconds_total{pod=~"grayfsm-backend.*"}[5m]) * 100
   ```

2. **Identify CPU-intensive operations**:
   - Check which algorithms are running
   - Monitor by request type
   - Use cProfile for Python code

3. **Check system load**:
   ```bash
   kubectl top nodes
   kubectl top pods -n grayfsm
   ```

### Common Causes

1. **Expensive algorithm**
   - Optimization time increasing
   - Large FSM complexity
   - Solution: Switch to faster algorithm

2. **Inefficient code**
   - Hot loops
   - Unnecessary processing
   - Solution: Profile and optimize

3. **Concurrency spike**
   - Many parallel requests
   - Solution: Rate limiting, circuit breaker

### Mitigation Steps

1. **Scale replicas**:
   ```bash
   kubectl scale deployment grayfsm-backend --replicas=4 -n grayfsm
   ```

2. **Reduce algorithm complexity**:
   ```bash
   kubectl set env deployment/grayfsm-backend \
     DEFAULT_ALGORITHM=greedy -n grayfsm
   ```

3. **Optimize code**:
   - Profile with cProfile
   - Optimize hot paths
   - Use compiled extensions (Cython)

## Low Cache Hit Ratio

**Alert**: LowCacheHitRatio
**Threshold**: < 50% for 15 minutes

### Investigate

1. **Check hit ratio**:
   ```promql
   rate(grayfsm_cache_hit_total[5m]) /
   (rate(grayfsm_cache_hit_total[5m]) + rate(grayfsm_cache_miss_total[5m]))
   ```

2. **Identify cache misses**:
   - Check what's being missed
   - Check cache size limits
   - Check TTL settings

### Common Causes

1. **Cache too small**
   - Many unique requests
   - Solution: Increase cache size

2. **TTL too short**
   - Entries expiring too quickly
   - Solution: Increase TTL

3. **Working set larger than cache**
   - Too many unique FSMs/exports
   - Solution: Increase cache or implement tiering

### Mitigation Steps

1. **Increase Redis memory**:
   ```bash
   kubectl set env deployment/grayfsm-backend \
     REDIS_MAX_CONNECTIONS=100 -n grayfsm
   ```

2. **Increase TTL**:
   ```bash
   kubectl set env deployment/grayfsm-backend \
     REDIS_CACHE_TTL=7200 -n grayfsm
   ```

3. **Warm cache**:
   - Pre-load common exports
   - Use background job to warm cache

## Pod Crashing

**Alert**: BackendPodCrashing
**Threshold**: Immediate

### Investigate

1. **Check pod status**:
   ```bash
   kubectl describe pod <pod-name> -n grayfsm
   kubectl logs <pod-name> -n grayfsm --tail=100
   ```

2. **Check recent events**:
   ```bash
   kubectl get events -n grayfsm --sort-by='.lastTimestamp'
   ```

3. **Check crash logs**:
   ```bash
   kubectl logs <pod-name> -n grayfsm --previous
   ```

### Common Causes

1. **OOMKilled (Out of Memory)**
   - Increase memory limit
   - Check for memory leaks

2. **CrashLoopBackOff**
   - Application error on startup
   - Check environment variables
   - Verify database connectivity

3. **Liveness probe failure**
   - Health check endpoint failing
   - Check endpoint responding
   - Review probe timeout settings

### Mitigation Steps

1. **Increase memory limit**:
   ```yaml
   resources:
     limits:
       memory: 1Gi
   ```

2. **Check database connectivity**:
   ```bash
   kubectl exec <pod-name> -n grayfsm -- nc -zv postgres.database 5432
   ```

3. **Review startup logs**:
   ```bash
   kubectl logs <pod-name> -n grayfsm --all-containers=true --previous=true
   ```

## Optimization Failure Rate Increasing

**Alert**: HighOptimizationFailureRate
**Threshold**: > 10%

### Investigate

1. **Check failure rate**:
   ```promql
   rate(grayfsm_optimization_failed_total[5m]) /
   (rate(grayfsm_optimization_started_total[5m]) + 0.001)
   ```

2. **Identify failure patterns**:
   - Which algorithms are failing
   - Which FSM types
   - Check error logs

3. **View failed traces**:
   - Jaeger UI -> Error status
   - Review exception details

### Common Causes

1. **Algorithm timeout**
   - FSMs too complex for timeout
   - Solution: Increase timeout or use faster algorithm

2. **Invalid FSM**
   - Validation failing
   - Solution: Check FSM creation logic

3. **Resource exhaustion**
   - Memory or CPU limits hit
   - Solution: Scale up resources

### Mitigation Steps

1. **Increase timeout**:
   ```bash
   kubectl set env deployment/grayfsm-backend \
     ALGORITHM_TIMEOUT_MS=45000 -n grayfsm
   ```

2. **Switch algorithm**:
   ```bash
   kubectl set env deployment/grayfsm-backend \
     DEFAULT_ALGORITHM=bfs -n grayfsm
   ```

3. **Scale resources**:
   ```bash
   kubectl scale deployment grayfsm-backend --replicas=4 -n grayfsm
   ```

## Observability Stack Issues

### Jaeger Not Receiving Traces

1. **Check Jaeger is running**:
   ```bash
   kubectl get pods -n observability | grep jaeger
   ```

2. **Check connectivity**:
   ```bash
   kubectl exec deployment/grayfsm-backend -n grayfsm -- \
     nc -zv jaeger-collector.observability 14268
   ```

3. **Check telemetry initialization**:
   ```bash
   kubectl logs deployment/grayfsm-backend -n grayfsm | grep -i jaeger
   ```

### Loki Not Receiving Logs

1. **Check Promtail is running**:
   ```bash
   kubectl get pods -n observability | grep promtail
   ```

2. **Check pod logs**:
   ```bash
   kubectl logs <pod-name> -n observability --tail=50
   ```

3. **Verify pod has labels**:
   ```bash
   kubectl get pod <pod-name> -n grayfsm --show-labels
   ```

### Prometheus Scrape Targets Down

1. **Check targets in Prometheus UI**:
   ```bash
   kubectl port-forward -n grayfsm-monitoring svc/prometheus 9090:9090
   # Visit http://localhost:9090/targets
   ```

2. **Check pod has annotations**:
   ```bash
   kubectl get pod <pod-name> -n grayfsm -o yaml | grep prometheus
   ```

3. **Check metrics endpoint**:
   ```bash
   kubectl port-forward pod/<pod-name> 8000:8000 -n grayfsm
   curl http://localhost:8000/metrics
   ```

## Quick Reference

### Useful Commands

```bash
# View real-time logs
kubectl logs -f deployment/grayfsm-backend -n grayfsm

# Port forward services
kubectl port-forward -n grayfsm-monitoring svc/prometheus 9090:9090
kubectl port-forward -n observability svc/jaeger-ui 16686:16686
kubectl port-forward -n observability svc/grafana 3000:3000
kubectl port-forward -n grayfsm-monitoring svc/alertmanager 9093:9093

# Scale replicas
kubectl scale deployment grayfsm-backend --replicas=3 -n grayfsm

# Set environment variable
kubectl set env deployment/grayfsm-backend KEY=value -n grayfsm

# View pod metrics
kubectl top pods -n grayfsm
kubectl top nodes

# Execute command in pod
kubectl exec -it <pod-name> -n grayfsm -- bash
```

### Dashboard Quick Links

- Health: http://grafana:3000/d/health
- Performance: http://grafana:3000/d/performance
- Business Metrics: http://grafana:3000/d/business
- Database: http://grafana:3000/d/database
- Infrastructure: http://grafana:3000/d/infrastructure

### Alert Escalation

1. **Info/Warning**: Slack #alerts-warnings, check runbook
2. **Critical**: Slack #alerts-critical + PagerDuty, immediate investigation
3. **SEV-1**: Page on-call engineer, activate incident response

### Contacts

- On-Call: See PagerDuty schedule
- Team Slack: #grayfsm-team
- Engineering: #grayfsm-engineering
