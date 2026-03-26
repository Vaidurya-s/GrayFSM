# GrayFSM Deployment Guide

This comprehensive guide covers the complete deployment infrastructure for GrayFSM, including containerization, CI/CD, Kubernetes deployment, database migrations, monitoring, and rollback procedures.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Docker Setup](#docker-setup)
4. [GitHub Actions CI/CD](#github-actions-cicd)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Blue-Green Deployment](#blue-green-deployment)
7. [Database Migrations](#database-migrations)
8. [Monitoring & Logging](#monitoring--logging)
9. [Troubleshooting](#troubleshooting)
10. [Rollback Procedures](#rollback-procedures)

## Prerequisites

### Required Tools

- Docker & Docker Compose (v20.10+)
- kubectl (v1.24+)
- Helm (v3.0+)
- Python 3.11+
- Node.js 20+ (for frontend)
- PostgreSQL CLI tools

### Kubernetes Cluster Requirements

- Minimum 3 nodes with 2 CPUs and 4GB RAM each
- Storage class configured (for database persistence)
- Ingress controller installed (NGINX recommended)
- Cert-manager for TLS certificates

### Setup Environment

```bash
# Clone repository
git clone https://github.com/yourorg/grayfsm.git
cd grayfsm

# Create .env file
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Set up infrastructure directory (already present)
cd infrastructure
```

## Local Development

### Docker Compose Setup

Start the complete development stack with one command:

```bash
cd infrastructure/docker
docker-compose up -d
```

This starts:
- PostgreSQL database
- Redis cache
- FastAPI backend (port 8000)
- React frontend (port 3000)
- pgAdmin (port 5050) - optional
- Adminer (port 8080) - optional

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# With timestamps
docker-compose logs -f --timestamps
```

### Database Access

```bash
# Via CLI
psql -h localhost -U grayfsm -d grayfsm

# Via pgAdmin
# URL: http://localhost:5050
# Email: admin@example.com
# Password: admin

# Via Adminer
# URL: http://localhost:8080
```

### Testing APIs

```bash
# Backend API docs
open http://localhost:8000/docs

# Health check
curl http://localhost:8000/api/v1/health

# Frontend
open http://localhost:3000
```

### Cleanup

```bash
# Stop containers
docker-compose down

# Remove volumes (careful - deletes data)
docker-compose down -v

# Remove all containers and networks
docker-compose down --remove-orphans
```

## Docker Setup

### Building Images

#### Backend Image

```bash
# From project root
docker build -f infrastructure/docker/backend.Dockerfile -t grayfsm-backend:latest .

# With build args
docker build \
  --build-arg PYTHON_VERSION=3.11 \
  -f infrastructure/docker/backend.Dockerfile \
  -t grayfsm-backend:v1.0.0 .

# View image layers
docker history grayfsm-backend:latest
```

#### Frontend Image

```bash
# From project root
docker build -f infrastructure/docker/frontend.Dockerfile -t grayfsm-frontend:latest .

# Check image size
docker images | grep grayfsm-frontend
```

### Pushing to Registry

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag images
docker tag grayfsm-backend:latest ghcr.io/yourorg/grayfsm-backend:latest
docker tag grayfsm-frontend:latest ghcr.io/yourorg/grayfsm-frontend:latest

# Push
docker push ghcr.io/yourorg/grayfsm-backend:latest
docker push ghcr.io/yourorg/grayfsm-frontend:latest
```

### Image Security

```bash
# Scan for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image grayfsm-backend:latest

# Check non-root user
docker inspect grayfsm-backend:latest | grep -i "user"

# Verify security context
docker inspect grayfsm-frontend:latest | grep -A5 "SecurityOpt"
```

## GitHub Actions CI/CD

### Workflow Triggers

Workflows are triggered on:
- Push to main, develop, staging branches
- Pull requests to main, develop, staging
- Manual workflow dispatch

### Pipeline Stages

#### 1. Security Scan
- Trivy vulnerability scanning
- Dependency checking
- SARIF report upload

#### 2. Backend Testing
- Python linting (flake8)
- Type checking (mypy)
- Unit tests with coverage
- Coverage upload to Codecov

#### 3. Frontend Testing
- Linting (ESLint)
- Type checking (TypeScript)
- Unit tests with Vitest
- Coverage reporting

#### 4. Docker Build
- Backend image build and push
- Frontend image build and push
- Layer caching for faster builds

#### 5. Deployment
- Staging: automatic on develop push
- Production: automatic on main push with manual approval

### Configuring Secrets

Add secrets to GitHub repository settings:

```
SLACK_WEBHOOK              # For notifications
STAGING_DATABASE_URL       # Staging DB connection
PRODUCTION_DATABASE_URL    # Production DB connection
STAGING_REDIS_URL          # Staging Redis
PRODUCTION_REDIS_URL       # Production Redis
SENTRY_DSN                 # Error tracking
```

### Running Workflows Locally

```bash
# Install act
brew install act

# List workflows
act -l

# Run specific workflow
act push -j backend-test

# Run with secrets
act push -s SLACK_WEBHOOK=https://hooks.slack.com/...
```

## Kubernetes Deployment

### Cluster Setup

```bash
# Create namespace
kubectl create namespace grayfsm
kubectl create namespace grayfsm-monitoring

# Label nodes for workload placement
kubectl label nodes worker-1 workload=app
kubectl label nodes worker-2 workload=app
kubectl label nodes worker-3 workload=monitoring

# Verify cluster
kubectl cluster-info
kubectl get nodes
```

### Initial Deployment

```bash
# Apply namespace and RBAC
kubectl apply -f infrastructure/kubernetes/namespace.yaml

# Apply configurations
kubectl apply -f infrastructure/kubernetes/configmap.yaml
kubectl apply -f infrastructure/kubernetes/secrets.yaml

# Deploy database
kubectl apply -f infrastructure/kubernetes/database-job.yaml

# Deploy backend
kubectl apply -f infrastructure/kubernetes/backend-blue-green.yaml

# Deploy frontend
kubectl apply -f infrastructure/kubernetes/frontend-deployment.yaml

# Deploy ingress
kubectl apply -f infrastructure/kubernetes/ingress.yaml
```

### Verify Deployment

```bash
# Check pods
kubectl get pods -n grayfsm
kubectl get pods -n grayfsm -w  # Watch mode

# Check services
kubectl get svc -n grayfsm

# Check ingress
kubectl get ingress -n grayfsm

# Check replica sets
kubectl get rs -n grayfsm

# View events
kubectl get events -n grayfsm --sort-by='.lastTimestamp'
```

### Pod Troubleshooting

```bash
# View pod logs
kubectl logs -n grayfsm deployment/grayfsm-backend-blue

# Follow logs
kubectl logs -f -n grayfsm deployment/grayfsm-backend-blue

# Multiple containers
kubectl logs -n grayfsm pod/grayfsm-backend-blue-abc123 -c backend

# Previous pod (if crashed)
kubectl logs -n grayfsm pod/grayfsm-backend-blue-abc123 --previous

# Describe pod
kubectl describe pod -n grayfsm pod/grayfsm-backend-blue-abc123

# SSH into pod
kubectl exec -it -n grayfsm pod/grayfsm-backend-blue-abc123 -- /bin/bash

# Port forward for testing
kubectl port-forward -n grayfsm svc/grayfsm-backend 8000:8000
```

### Resource Management

```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n grayfsm

# View resource requests/limits
kubectl describe nodes

# Scale deployment
kubectl scale deployment grayfsm-backend-blue -n grayfsm --replicas=5

# Update resource limits
kubectl set resources deployment grayfsm-backend-blue \
  -n grayfsm \
  --limits=cpu=500m,memory=512Mi \
  --requests=cpu=100m,memory=256Mi
```

## Blue-Green Deployment

### Deployment Process

The blue-green deployment strategy ensures zero-downtime updates:

1. **Blue slot** - current production (receiving traffic)
2. **Green slot** - new version (no traffic initially)
3. Test green slot
4. Switch traffic from blue to green
5. Keep blue as rollback point

### Automated Blue-Green Deployment

```bash
# Deployed automatically via GitHub Actions
# On production deployment, the workflow executes:
./infrastructure/scripts/deploy-blue-green.sh \
  --namespace grayfsm \
  --image ghcr.io/yourorg/grayfsm-backend:v1.0.0
```

### Manual Blue-Green Deployment

```bash
# Make blue-green script executable
chmod +x infrastructure/scripts/deploy-blue-green.sh

# Run deployment
./infrastructure/scripts/deploy-blue-green.sh \
  --namespace grayfsm \
  --image ghcr.io/yourorg/grayfsm-backend:sha-abc123de

# Optional: Custom health check URL
./infrastructure/scripts/deploy-blue-green.sh \
  --namespace grayfsm \
  --image ghcr.io/yourorg/grayfsm-backend:latest \
  --health-check-url http://localhost:8000/health
```

### Monitoring During Deployment

```bash
# Watch deployment progress
kubectl get deployment -n grayfsm -w

# Check active slot
kubectl get svc grayfsm-backend -n grayfsm -o jsonpath='{.spec.selector.slot}'

# Test both slots directly
kubectl port-forward -n grayfsm svc/grayfsm-backend-blue 8000:8000
kubectl port-forward -n grayfsm svc/grayfsm-backend-green 8001:8000

# In another terminal
curl http://localhost:8000/api/v1/health
curl http://localhost:8001/api/v1/health
```

## Database Migrations

### Setting Up Alembic

```bash
# Initialize Alembic (one time)
chmod +x infrastructure/database/alembic-init.sh
./infrastructure/database/alembic-init.sh

# This creates:
# - backend/alembic/ directory
# - alembic.ini configuration
# - Initial migration file
```

### Creating Migrations

```bash
cd backend

# Auto-generate migration (recommended)
alembic revision --autogenerate -m "Add new table"

# Manual migration
alembic revision -m "Custom migration"

# View migration file and edit as needed
cat alembic/versions/001_add_new_table.py
```

### Running Migrations

```bash
cd backend

# Upgrade to latest
alembic upgrade head

# Upgrade to specific revision
alembic upgrade abc123de

# Downgrade one step
alembic downgrade -1

# Downgrade to specific revision
alembic downgrade abc123de

# Check current version
alembic current

# View migration history
alembic history
```

### Database Migration in Kubernetes

Migrations run automatically before each deployment via a Kubernetes Job:

```yaml
# Manually run migration job
kubectl apply -f infrastructure/kubernetes/database-job.yaml

# View migration logs
kubectl logs -n grayfsm job/grayfsm-db-migration-xxxxx

# Check job status
kubectl get jobs -n grayfsm
```

### Migration Rollback

```bash
# If deployment fails
./infrastructure/scripts/rollback.sh --deployment database

# Or manually
cd backend
alembic downgrade -1
```

### Best Practices

1. **Test migrations locally first**
   ```bash
   docker-compose down -v
   docker-compose up -d postgres
   cd backend
   alembic upgrade head
   ```

2. **Always write data migration scripts**
   - Handle data type changes
   - Provide transformation logic
   - Include rollback steps

3. **Use zero-downtime migration patterns**
   - Add columns as nullable first
   - Add constraints after code deployed
   - Use feature flags for schema changes

## Monitoring & Logging

### Accessing Monitoring Stack

```bash
# Deploy monitoring stack
kubectl apply -f infrastructure/monitoring/prometheus-config.yaml
kubectl apply -f infrastructure/monitoring/logging-stack.yaml

# Access Prometheus
kubectl port-forward -n grayfsm-monitoring svc/prometheus 9090:9090
open http://localhost:9090

# Access Grafana
kubectl port-forward -n grayfsm-monitoring svc/grafana 3000:3000
open http://localhost:3000
# Default: admin/admin123

# Access Loki logs
# Available in Grafana as Loki data source
```

### Creating Alerts

Edit `prometheus-config.yaml` to add custom alert rules:

```yaml
- alert: MyCustomAlert
  expr: up{job="grayfsm-backend"} == 0
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Backend is down"
    description: "Backend has been down for 5 minutes"
```

### Viewing Metrics

**Key Metrics:**

- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `db_query_duration_seconds` - Database query performance
- `container_memory_usage_bytes` - Memory usage
- `container_cpu_usage_seconds_total` - CPU usage

**Prometheus Queries:**

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# P95 latency
histogram_quantile(0.95, http_request_duration_seconds_bucket)

# Memory usage
container_memory_working_set_bytes / 1024 / 1024

# CPU usage
rate(container_cpu_usage_seconds_total[5m]) * 100
```

### Collecting Application Metrics

FastAPI backend exports metrics via Prometheus client:

```python
from prometheus_client import Counter, Histogram

request_count = Counter('http_requests_total', 'Total requests')
request_latency = Histogram('http_request_duration_seconds', 'Request latency')

# Use in endpoint
@app.get("/api/v1/fsms")
async def list_fsms():
    request_count.inc()
    # Your logic here
```

## Troubleshooting

### Common Issues

#### Pods not starting

```bash
# Check pod events
kubectl describe pod -n grayfsm <pod-name>

# Check logs
kubectl logs -n grayfsm <pod-name>

# Check resource availability
kubectl top nodes
kubectl top pods -n grayfsm

# Check image pull issues
kubectl get events -n grayfsm --sort-by='.lastTimestamp'
```

#### High latency

```bash
# Check database connections
kubectl exec -n grayfsm <backend-pod> -- \
  psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check memory usage
kubectl top pods -n grayfsm --containers

# Check slow queries
kubectl logs -n grayfsm <backend-pod> | grep "slow"
```

#### Deployment stuck

```bash
# Check replica set status
kubectl get rs -n grayfsm

# Check pod conditions
kubectl get pods -n grayfsm -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.conditions[*]}{"\n"}{end}'

# Force pod deletion (last resort)
kubectl delete pod -n grayfsm <pod-name> --grace-period=0 --force
```

#### Database issues

```bash
# Connect to pod
kubectl exec -it -n grayfsm <backend-pod> -- bash

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# View database logs
kubectl logs -n grayfsm <postgres-pod>

# Check storage
kubectl get pvc -n grayfsm
```

## Rollback Procedures

### Automatic Rollback (Recommended)

```bash
# Make rollback script executable
chmod +x infrastructure/scripts/rollback.sh

# Rollback backend deployment
./infrastructure/scripts/rollback.sh \
  --namespace grayfsm \
  --deployment backend

# Rollback all components
./infrastructure/scripts/rollback.sh \
  --namespace grayfsm \
  --deployment all
```

### Manual Rollback

#### Backend Rollback

```bash
# View deployment history
kubectl rollout history deployment/grayfsm-backend-blue -n grayfsm

# Rollback to previous revision
kubectl rollout undo deployment/grayfsm-backend-blue -n grayfsm

# Rollback to specific revision
kubectl rollout undo deployment/grayfsm-backend-blue -n grayfsm --to-revision=5

# Check rollout status
kubectl rollout status deployment/grayfsm-backend-blue -n grayfsm
```

#### Frontend Rollback

```bash
# View history
kubectl rollout history deployment/grayfsm-frontend -n grayfsm

# Rollback
kubectl rollout undo deployment/grayfsm-frontend -n grayfsm

# Verify
kubectl rollout status deployment/grayfsm-frontend -n grayfsm
```

#### Database Rollback

```bash
# Downgrade database schema
cd backend
alembic downgrade -1

# Or use rollback script
./infrastructure/scripts/rollback.sh \
  --namespace grayfsm \
  --deployment database
```

### Emergency Recovery

```bash
# If cluster is in bad state:

# 1. Cordon nodes (prevent new pods)
kubectl cordon <node-name>

# 2. Drain nodes (move existing pods)
kubectl drain <node-name> --ignore-daemonsets

# 3. Check cluster state
kubectl get all -n grayfsm
kubectl get pvc -n grayfsm

# 4. Delete problematic resources
kubectl delete pod -n grayfsm <pod-name>

# 5. Reapply manifests
kubectl apply -f infrastructure/kubernetes/backend-blue-green.yaml

# 6. Uncordon node
kubectl uncordon <node-name>
```

## Production Checklist

Before deploying to production:

- [ ] All tests passing in CI/CD
- [ ] Security scanning completed
- [ ] Performance benchmarks reviewed
- [ ] Database backup created
- [ ] Monitoring and alerting configured
- [ ] Runbooks reviewed and accessible
- [ ] Team notified of deployment
- [ ] Rollback plan verified
- [ ] SSL/TLS certificates valid
- [ ] Environment variables configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Logging aggregation working
- [ ] Health checks passing
- [ ] Load testing completed

## Support

For issues or questions:

1. Check logs: `kubectl logs -n grayfsm <pod>`
2. Review events: `kubectl get events -n grayfsm`
3. Check Prometheus metrics
4. Review Grafana dashboards
5. Consult troubleshooting guide above
6. Open GitHub issue with details
