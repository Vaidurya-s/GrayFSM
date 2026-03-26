# GrayFSM Deployment Runbook

Quick reference guide for common deployment operations and emergency procedures.

## Quick Navigation

- [Starting Deployment](#starting-deployment)
- [Monitoring Deployment](#monitoring-deployment)
- [Verifying Health](#verifying-health)
- [Emergency Procedures](#emergency-procedures)
- [Common Commands](#common-commands)

## Starting Deployment

### Deploy to Staging

```bash
# Push to develop branch - triggers automatic staging deployment
git add .
git commit -m "Feature: add new capability"
git push origin feature-branch
git push origin feature-branch:develop

# Monitor in GitHub Actions
# URL: https://github.com/yourorg/grayfsm/actions
```

### Deploy to Production

```bash
# Create pull request to main
# Requires approval before merge

# Merge to main - triggers automatic production deployment
git push origin main

# Monitor deployment
./infrastructure/scripts/deploy-blue-green.sh \
  --namespace grayfsm \
  --image ghcr.io/yourorg/grayfsm-backend:v1.0.0
```

### Manual Kubernetes Deployment

```bash
# Apply all manifests
kubectl apply -f infrastructure/kubernetes/

# Check status
kubectl get all -n grayfsm

# Wait for rollout
kubectl rollout status deployment/grayfsm-backend-blue -n grayfsm
kubectl rollout status deployment/grayfsm-frontend -n grayfsm
```

## Monitoring Deployment

### Watch Progress

```bash
# Real-time pod status
kubectl get pods -n grayfsm -w

# Check deployment progress
kubectl get deployment -n grayfsm
kubectl describe deployment grayfsm-backend-blue -n grayfsm

# Monitor events
kubectl get events -n grayfsm --sort-by='.lastTimestamp' | tail -20
```

### Check Resource Usage

```bash
# CPU and memory
kubectl top nodes
kubectl top pods -n grayfsm

# By deployment
kubectl top pods -n grayfsm -l component=backend
kubectl top pods -n grayfsm -l component=frontend
```

### Real-time Logs

```bash
# Backend logs
kubectl logs -f -n grayfsm deployment/grayfsm-backend-blue

# Frontend logs
kubectl logs -f -n grayfsm deployment/grayfsm-frontend

# Database migration logs
kubectl logs -f -n grayfsm job/grayfsm-db-migration-*
```

## Verifying Health

### Health Check Endpoints

```bash
# Backend health
curl http://localhost:8000/api/v1/health

# Frontend (via Kubernetes)
kubectl port-forward -n grayfsm svc/grayfsm-frontend 3000:80
curl http://localhost:3000/health
```

### Check Pod Health

```bash
# All pods
kubectl get pods -n grayfsm -o wide

# Specific pod details
kubectl describe pod -n grayfsm <pod-name>

# Check readiness
kubectl get pods -n grayfsm -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.conditions[?(@.type=="Ready")].status}{"\n"}{end}'
```

### Verify Database

```bash
# Check database pod
kubectl get pods -n grayfsm -l component=database

# Test connection
kubectl exec -it -n grayfsm <postgres-pod> -- \
  psql -U grayfsm -d grayfsm -c "SELECT 1;"

# Check migrations
kubectl exec -it -n grayfsm <backend-pod> -- \
  alembic current
```

### Test APIs

```bash
# Port forward
kubectl port-forward -n grayfsm svc/grayfsm-backend 8000:8000

# Health check
curl http://localhost:8000/api/v1/health

# API docs
open http://localhost:8000/docs

# Sample API call
curl -X GET http://localhost:8000/api/v1/fsms
```

## Emergency Procedures

### High Memory Usage

```bash
# Identify pod
kubectl top pods -n grayfsm | sort -k3 -rn

# Check limits
kubectl get pod -n grayfsm <pod-name> -o yaml | grep -A10 "resources:"

# Increase limits
kubectl set resources deployment grayfsm-backend-blue \
  -n grayfsm \
  --limits=memory=1Gi

# Monitor improvement
kubectl top pods -n grayfsm -w
```

### High Latency

```bash
# Check database connections
kubectl exec -n grayfsm <backend-pod> -- \
  psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# View slow queries
kubectl logs -n grayfsm <backend-pod> | grep "duration:" | tail -10

# Check network
kubectl exec -n grayfsm <backend-pod> -- netstat -an | grep ESTABLISHED

# Restart pods (last resort)
kubectl rollout restart deployment/grayfsm-backend-blue -n grayfsm
```

### Pod Crashing

```bash
# Check logs
kubectl logs -n grayfsm <pod-name> --previous

# Check events
kubectl describe pod -n grayfsm <pod-name>

# Check resource availability
kubectl describe nodes

# Force restart
kubectl delete pod -n grayfsm <pod-name>

# If persistent, rollback
./infrastructure/scripts/rollback.sh --deployment backend
```

### Database Connectivity Issues

```bash
# Check database pod
kubectl get pod -n grayfsm -l component=database

# View logs
kubectl logs -n grayfsm <postgres-pod>

# Check PVC
kubectl get pvc -n grayfsm

# Test from pod
kubectl exec -it -n grayfsm <backend-pod> -- \
  psql $DATABASE_URL -c "SELECT version();"

# If database won't start, check storage
kubectl describe pvc -n grayfsm postgres-data-grayfsm-postgres-0
```

### Complete Outage Recovery

```bash
# 1. Assess damage
kubectl get all -n grayfsm
kubectl get events -n grayfsm --sort-by='.lastTimestamp'

# 2. Cordon affected nodes
kubectl cordon <node-name>

# 3. Check backups
kubectl get backups -n grayfsm

# 4. Restore database (if needed)
# Contact DBA or follow backup recovery procedure

# 5. Restart affected deployments
kubectl delete pod -n grayfsm -l component=backend
kubectl delete pod -n grayfsm -l component=frontend

# 6. Monitor recovery
kubectl get pods -n grayfsm -w

# 7. Uncordon nodes once stable
kubectl uncordon <node-name>
```

## Rolling Back to Previous Version

### Automatic Rollback

```bash
# Quick rollback script
./infrastructure/scripts/rollback.sh \
  --namespace grayfsm \
  --deployment backend

# Monitor rollback
kubectl rollout status deployment/grayfsm-backend-blue -n grayfsm -w
```

### Manual Backend Rollback

```bash
# View history
kubectl rollout history deployment/grayfsm-backend-blue -n grayfsm

# Rollback one revision
kubectl rollout undo deployment/grayfsm-backend-blue -n grayfsm

# Rollback to specific revision
kubectl rollout undo deployment/grayfsm-backend-blue -n grayfsm --to-revision=5

# Monitor
kubectl rollout status deployment/grayfsm-backend-blue -n grayfsm
```

### Manual Frontend Rollback

```bash
# Same commands for frontend
kubectl rollout undo deployment/grayfsm-frontend -n grayfsm
kubectl rollout status deployment/grayfsm-frontend -n grayfsm
```

### Database Rollback

```bash
# Downgrade one migration
cd backend
alembic downgrade -1

# Or downgrade to specific version
alembic downgrade abc123de

# Verify
alembic current
```

## Common Commands

### Cluster Information

```bash
# Cluster status
kubectl cluster-info
kubectl get nodes
kubectl get nodes -o wide

# Node details
kubectl describe node <node-name>

# Node resources
kubectl top nodes

# Node capacity
kubectl get nodes -o json | jq '.items[] | {name: .metadata.name, capacity: .status.capacity}'
```

### Pod Management

```bash
# List all pods
kubectl get pods -A

# Pods in grayfsm namespace
kubectl get pods -n grayfsm

# Pod details
kubectl describe pod -n grayfsm <pod-name>

# Pod YAML
kubectl get pod -n grayfsm <pod-name> -o yaml

# Pod logs
kubectl logs -n grayfsm <pod-name>
kubectl logs -f -n grayfsm <pod-name>
kubectl logs -n grayfsm <pod-name> --tail=100

# Execute command in pod
kubectl exec -it -n grayfsm <pod-name> -- /bin/bash
kubectl exec -n grayfsm <pod-name> -- ls -la

# Delete pod
kubectl delete pod -n grayfsm <pod-name>
```

### Deployment Management

```bash
# List deployments
kubectl get deployments -n grayfsm

# Deployment status
kubectl describe deployment -n grayfsm <deployment-name>

# Rollout status
kubectl rollout status deployment/<deployment-name> -n grayfsm

# Rollout history
kubectl rollout history deployment/<deployment-name> -n grayfsm

# Scale deployment
kubectl scale deployment/<deployment-name> --replicas=5 -n grayfsm

# Update deployment
kubectl set image deployment/<deployment-name> \
  container=image:newtag -n grayfsm --record
```

### Service Management

```bash
# List services
kubectl get svc -n grayfsm

# Service details
kubectl describe svc -n grayfsm <service-name>

# Port forward
kubectl port-forward -n grayfsm svc/<service-name> 8000:8000

# Service endpoints
kubectl get endpoints -n grayfsm <service-name>
```

### Debugging Commands

```bash
# Describe object
kubectl describe <resource> <name> -n grayfsm

# View events
kubectl get events -n grayfsm

# Recent events
kubectl get events -n grayfsm --sort-by='.lastTimestamp' | tail -20

# Logs (grep)
kubectl logs -n grayfsm <pod> | grep "error"

# Pod exec
kubectl exec -it -n grayfsm <pod> -- <command>

# Debug pod
kubectl debug node/<node-name>
kubectl debug pod/<pod-name> -n grayfsm -it --image=busybox
```

### Configuration Management

```bash
# List ConfigMaps
kubectl get configmaps -n grayfsm

# View ConfigMap
kubectl get configmap -n grayfsm <name> -o yaml

# Update ConfigMap
kubectl create configmap <name> --from-file=config.yaml --dry-run=client -o yaml | kubectl apply -f -

# List Secrets
kubectl get secrets -n grayfsm

# View Secret (base64 encoded)
kubectl get secret -n grayfsm <name> -o yaml
```

## Contact & Escalation

For issues:

1. Check this runbook
2. Review monitoring dashboards (Grafana)
3. Check logs (Loki)
4. Review Prometheus metrics
5. Escalate to DevOps team

**On-call rotation**: Check Slack #oncall channel
**Incident channel**: #incidents
**Escalation contact**: @devops-lead
