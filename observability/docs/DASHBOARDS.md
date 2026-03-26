# GrayFSM Grafana Dashboards Guide

Complete guide for using and customizing Grafana dashboards.

## Dashboard Overview

### 1. Application Health Dashboard

**Purpose**: Monitor overall system health and availability

**Key Metrics**:
- API availability (uptime percentage)
- Error rates (4xx, 5xx)
- Active requests count
- Database connectivity status
- Cache hit ratio

**Panels**:
- Status indicator (green/yellow/red)
- Error rate gauge
- Request volume chart
- Service status table
- Recent alerts

**Alert Thresholds**:
- Availability < 99%: Warning
- Availability < 99.5%: Critical
- Error rate > 0.1%: Critical
- DB connections > 80%: Warning

### 2. Performance Dashboard

**Purpose**: Monitor application performance and latency

**Key Metrics**:
- Request latency (P50, P95, P99)
- Throughput (requests/sec)
- Response times by endpoint
- Database query duration
- Cache performance

**Panels**:
- Latency histogram
- Throughput chart
- Endpoint latency heatmap
- Database query performance
- Cache hit ratio over time

**Alert Thresholds**:
- P95 latency > 500ms: Warning
- P95 latency > 1s: Critical
- Query duration > 100ms: Warning
- Cache hit ratio < 70%: Info

### 3. Business Metrics Dashboard

**Purpose**: Monitor business operations and optimization performance

**Key Metrics**:
- FSMs created per day
- Optimization success rate
- Optimization duration distribution
- States reduced by algorithm
- Export success rate
- Top optimization algorithms

**Panels**:
- FSM creation trend
- Optimization completion rate
- Duration percentiles (P50, P95, P99)
- States reduced per FSM
- Export success rate
- Algorithm comparison

**Alert Thresholds**:
- Optimization success rate < 95%: Warning
- Export failure rate > 1%: Warning
- Average duration increasing: Info

### 4. Database Performance Dashboard

**Purpose**: Monitor database health and query performance

**Key Metrics**:
- Query duration (P50, P95, P99)
- Connection pool utilization
- Active connections
- Transaction duration
- Index usage statistics
- Slow query log

**Panels**:
- Query latency chart
- Connection pool gauge
- Active connections over time
- Slow query table
- Query count by type
- Index hit ratio

**Alert Thresholds**:
- Connection pool > 80%: Warning
- Query duration > 100ms: Warning
- Index hit ratio < 95%: Info

### 5. Infrastructure Dashboard

**Purpose**: Monitor Kubernetes and infrastructure resources

**Key Metrics**:
- Pod CPU and memory usage
- Node resources
- Storage utilization
- Network I/O
- Pod restart counts
- Node status

**Panels**:
- Pod resource gauge
- Node resource heatmap
- Storage usage by pod
- Network I/O graph
- Pod restart timeline
- Node status table

**Alert Thresholds**:
- Memory > 85%: Warning
- CPU > 80%: Warning
- Storage > 80%: Warning
- Pod restarts in 1h: Critical

## Creating Custom Dashboards

### Dashboard Template Structure

1. **Dashboard Settings**
   - Title and description
   - Tags (business, performance, infrastructure)
   - Refresh interval (15s for real-time, 1m for overview)
   - Time range (default 1h, adjustable)

2. **Row Organization**
   - Group related panels
   - Use collapsed rows for less critical data
   - Consistent ordering

3. **Panel Best Practices**
   - Clear titles and descriptions
   - Consistent color schemes
   - Readable scales and legends
   - Drill-down capability where possible

### Example: Creating a Custom Dashboard

1. **Open Grafana**
   - Navigate to http://localhost:3000
   - Login with credentials

2. **Create New Dashboard**
   - Click "+" in left sidebar
   - Select "New Dashboard"
   - Click "Add panel"

3. **Configure Panel**
   - Select data source (Prometheus)
   - Enter query:
     ```promql
     rate(grayfsm_fsm_created_total[5m])
     ```
   - Set visualization (Graph, Gauge, Table, etc.)
   - Configure legend and axes

4. **Save Dashboard**
   - Click "Save" button
   - Add title: "FSM Creation Rate"
   - Select folder
   - Save

5. **Share Dashboard**
   - Click "Share" in top menu
   - Copy link or embed code
   - Export as JSON for version control

## Useful PromQL Queries

### FSM Operations

```promql
# FSM creation rate
rate(grayfsm_fsm_created_total[5m])

# Optimization success rate
(rate(grayfsm_optimization_completed_total[5m]) /
 (rate(grayfsm_optimization_started_total[5m]) + 0.001))

# Average states reduced per FSM
rate(grayfsm_states_reduced_total[5m]) /
rate(grayfsm_optimization_completed_total[5m])
```

### API Metrics

```promql
# Request latency P95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Request latency P99
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# Throughput
sum(rate(http_requests_total[5m]))

# Requests by endpoint
sum by (endpoint) (rate(http_requests_total[5m]))
```

### Database Metrics

```promql
# Query latency P95
histogram_quantile(0.95, rate(grayfsm_db_query_duration_seconds_bucket[5m]))

# Connection pool utilization
grayfsm_db_active_connections / 20

# Slow query count
sum(rate(grayfsm_db_query_duration_seconds_count{le="+Inf"}[5m])) -
sum(rate(grayfsm_db_query_duration_seconds_count{le="0.1"}[5m]))

# Cache hit ratio
(rate(grayfsm_cache_hit_total[5m]) /
 (rate(grayfsm_cache_hit_total[5m]) + rate(grayfsm_cache_miss_total[5m])))
```

### Resource Metrics

```promql
# Memory usage
sum(container_memory_working_set_bytes{pod=~"grayfsm-.*"}) / 1e9

# CPU usage
sum(rate(container_cpu_usage_seconds_total{pod=~"grayfsm-.*"}[5m])) * 100

# Disk usage
kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes

# Network I/O
sum(rate(container_network_transmit_bytes_total[5m]))
```

## Dashboard Export and Import

### Export Dashboard as JSON

1. Open dashboard
2. Click "Share" button
3. Click "Export" tab
4. Click "Save to file"
5. Save JSON file for version control

### Import Dashboard from JSON

1. In Grafana, click "+" in left sidebar
2. Select "Import"
3. Upload JSON file or paste JSON
4. Select data source mappings
5. Click "Import"

### Version Control

1. Store dashboard JSON in Git:
   ```bash
   observability/dashboards/
   ├── health.json
   ├── performance.json
   ├── business.json
   ├── database.json
   └── infrastructure.json
   ```

2. Use Git hooks to sync dashboards automatically

3. Include dashboard documentation in code

## Sharing and Collaboration

### Create Shareable Panels

1. Open panel in edit mode
2. Click "Share" button
3. Copy embed link or snapshot link

### Add Annotations

1. Create dashboard annotation:
   - Click "Edit" -> "Annotations"
   - Add data source query
   - Configure alert rules to generate annotations

2. Common annotations:
   - Deployments
   - Critical alerts
   - On-call handoffs
   - Maintenance windows

### Use Variables for Dynamic Dashboards

**Template Variables**:

```yaml
- name: environment
  type: query
  datasource: Prometheus
  query: label_values(up, environment)

- name: pod
  type: query
  datasource: Prometheus
  query: label_values(grayfsm_fsm_created_total, pod)
```

**Usage in Queries**:

```promql
rate(http_requests_total{pod="$pod", environment="$environment"}[5m])
```

## Alert Integration

### Linking Dashboards to Alerts

1. In alert configuration, add dashboard link:
   ```yaml
   dashboard: 'Performance Dashboard'
   panel: 'Latency Chart'
   ```

2. Clicking alert notification takes you to relevant panel

### Create Alert Overlay

1. Add alert state as annotation on dashboard
2. Visual indication of when alerts fired
3. Correlate with metric changes

## Performance Optimization

### Dashboard Performance

1. **Reduce query complexity**:
   - Use recording rules instead of complex queries
   - Pre-aggregate metrics
   - Limit data retention

2. **Optimize refresh intervals**:
   - Real-time: 5s-15s (production alerts only)
   - Default: 1m (overview dashboards)
   - History: 5m+ (trend analysis)

3. **Use appropriate visualizations**:
   - Tables: < 100 rows
   - Graphs: < 30 series
   - Heatmaps: aggregated data

### Resource Usage

1. Monitor Grafana performance:
   ```promql
   histogram_quantile(0.95, rate(grafana_http_request_duration_seconds_bucket[5m]))
   ```

2. Cache Prometheus queries
3. Use Grafana enterprise for caching

## Troubleshooting

### Metrics Not Showing

1. Verify data source connection
2. Check Prometheus targets
3. Validate PromQL query syntax
4. Check metric cardinality

### Dashboard Loading Slowly

1. Reduce time range
2. Increase refresh interval
3. Simplify queries
4. Check Grafana logs

### Missing Data Points

1. Verify scrape interval alignment
2. Check metric staleness timeout
3. Confirm retention policies
4. Verify labels consistency

## Best Practices

1. **Naming Conventions**
   - Use consistent naming for metrics
   - Group related dashboards by function
   - Use clear, descriptive titles

2. **Dashboard Organization**
   - Create folders by team/service
   - One "overview" dashboard per service
   - Detailed dashboards for troubleshooting

3. **Documentation**
   - Add descriptions to dashboards
   - Document metrics and thresholds
   - Include runbook links

4. **Alerting**
   - Link dashboards from alert notifications
   - Create focused panels for common issues
   - Ensure dashboard URL in alert annotations

5. **Regular Maintenance**
   - Review unused dashboards
   - Update thresholds based on SLOs
   - Version control dashboard changes
   - Test dashboard imports regularly
