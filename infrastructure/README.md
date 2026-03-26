# GrayFSM Infrastructure

Complete production-ready deployment infrastructure for the GrayFSM application (React frontend, FastAPI backend, PostgreSQL database).

## Overview

This infrastructure provides:

- **Multi-stage Docker builds** for optimized images
- **GitHub Actions CI/CD** with comprehensive testing and security scanning
- **Blue-Green deployments** for zero-downtime updates
- **Kubernetes orchestration** with proper health checks and resource management
- **Database migrations** with Alembic
- **Monitoring & Logging** with Prometheus, Grafana, and Loki
- **Security hardening** with network policies and RBAC
- **Automated rollback** capabilities
- **Production-ready documentation** and runbooks

## Directory Structure

```
infrastructure/
├── docker/                          # Container definitions
│   ├── backend.Dockerfile          # Multi-stage FastAPI build
│   ├── frontend.Dockerfile         # Multi-stage React/Nginx build
│   ├── nginx.conf                  # Nginx configuration
│   ├── default.conf                # Nginx virtual host config
│   ├── docker-compose.yml          # Local development stack
│   └── .dockerignore               # Build exclusions
├── kubernetes/                      # Kubernetes manifests
│   ├── namespace.yaml              # Namespaces and network policies
│   ├── configmap.yaml              # Environment configurations
│   ├── secrets.yaml                # Secret templates
│   ├── backend-blue-green.yaml     # Backend blue-green deployment
│   ├── frontend-deployment.yaml    # Frontend rolling deployment
│   ├── database-job.yaml           # Database setup and migration
│   └── ingress.yaml                # Ingress and TLS setup
├── github-workflows/               # CI/CD automation
│   ├── ci-cd.yml                   # Main pipeline
│   └── database-migration.yml      # Database migration workflow
├── database/                        # Database setup
│   ├── init.sql                    # Database initialization
│   └── alembic-init.sh             # Alembic setup script
├── scripts/                         # Deployment scripts
│   ├── deploy-blue-green.sh        # Blue-green deployment automation
│   └── rollback.sh                 # Emergency rollback procedures
├── monitoring/                      # Observability stack
│   ├── prometheus-config.yaml      # Metrics and alerting
│   └── logging-stack.yaml          # Loki, Promtail, Grafana
├── DEPLOYMENT-GUIDE.md             # Comprehensive deployment guide
├── RUNBOOK.md                      # Quick reference for operators
├── CONFIG.md                       # Configuration reference
└── README.md                       # This file
```

## Quick Start

### Local Development

```bash
cd docker
docker-compose up -d

# Services available at:
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
# Adminer: http://localhost:8080
# pgAdmin: http://localhost:5050
```

### Deploy to Kubernetes

```bash
# 1. Create infrastructure
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml

# 2. Deploy database
kubectl apply -f kubernetes/database-job.yaml

# 3. Deploy applications
kubectl apply -f kubernetes/backend-blue-green.yaml
kubectl apply -f kubernetes/frontend-deployment.yaml

# 4. Setup ingress
kubectl apply -f kubernetes/ingress.yaml

# 5. Deploy monitoring
kubectl apply -f monitoring/prometheus-config.yaml
kubectl apply -f monitoring/logging-stack.yaml
```

### Automated CI/CD Deployment

```bash
# 1. Copy GitHub Actions workflows
mkdir -p .github/workflows
cp github-workflows/*.yml .github/workflows/

# 2. Configure secrets in GitHub repository settings
# Required secrets:
# - SLACK_WEBHOOK
# - STAGING_DATABASE_URL
# - PRODUCTION_DATABASE_URL
# - SENTRY_DSN
# - JWT secrets, API keys, etc.

# 3. Push to repository
git add .github/workflows/
git commit -m "Add CI/CD workflows"
git push

# 4. Monitor in GitHub Actions tab
```

## Key Features

### Zero-Downtime Deployments

Uses blue-green deployment strategy:

1. **Blue slot** - current production version
2. **Green slot** - new version deployed without traffic
3. **Health checks** - verify green slot ready
4. **Traffic switch** - route traffic to green slot
5. **Rollback** - keep blue slot for instant rollback

```bash
./scripts/deploy-blue-green.sh \
  --namespace grayfsm \
  --image ghcr.io/yourorg/grayfsm-backend:v1.0.0
```

### Automated Testing Gates

All changes pass through:

1. **Security scanning** - Trivy, dependency checks
2. **Code quality** - linting, type checking
3. **Unit tests** - pytest with coverage
4. **Integration tests** - API and database tests
5. **Docker build** - verify images build successfully

Only after all tests pass do images get pushed and deployed.

### Database Migration Automation

Migrations run automatically before deployment:

```bash
# 1. Create migration
cd backend
alembic revision --autogenerate -m "Add new table"

# 2. Test locally
docker-compose up -d postgres
alembic upgrade head
alembic downgrade -1
alembic upgrade head

# 3. Commit and push
# 4. Automatic execution in deployment job
```

### Monitoring & Alerting

Complete observability stack:

- **Prometheus** - metrics collection and alerting
- **Grafana** - dashboards and visualization
- **Loki** - log aggregation
- **Promtail** - log collection from nodes

Monitor:
- Application metrics (requests, latency, errors)
- Infrastructure (CPU, memory, disk, network)
- Database (connections, query performance)
- Deployment health (pod status, replicas)

### Automatic Rollback

Rollback to previous version instantly:

```bash
# Automatic rollback
./scripts/rollback.sh \
  --namespace grayfsm \
  --deployment backend

# Manual rollback
kubectl rollout undo deployment/grayfsm-backend-blue -n grayfsm
```

## Configuration

### Environment Variables

See `CONFIG.md` for comprehensive configuration reference.

Key configurations:

**Development**
- Debug mode enabled
- Local database connections
- Verbose logging

**Staging**
- Production-like setup
- External database
- Rate limiting enabled
- Sentry error tracking

**Production**
- Debug disabled
- External managed database
- All security features enabled
- Comprehensive monitoring

### Secrets Management

Multiple options supported:

1. **GitHub Secrets** - for CI/CD
2. **Kubernetes Secrets** - basic option
3. **Sealed Secrets** - encrypted in Git
4. **External Secrets Operator** - AWS/Azure/GCP integration
5. **Vault** - enterprise secret management

### Feature Flags

Use Unleash for feature flag management:

```bash
FEATURE_FLAGS_ENABLED=true
UNLEASH_URL=https://unleash.example.com
UNLEASH_API_KEY=api-key
```

## Deployment Strategies

### Continuous Deployment (Automatic)

```
Push to main → Tests pass → Deploy to production
```

### Continuous Delivery (Manual Approval)

```
Push to main → Tests pass → Wait for approval → Deploy
```

### Canary Deployment

Deploy to subset of users first, gradually increase traffic.

### Rolling Deployment

Gradually replace old pods with new version (default for frontend).

## Security

### Built-in Security Features

- **Network policies** - namespace isolation
- **RBAC** - role-based access control
- **Pod security** - non-root users, read-only filesystem
- **Resource limits** - prevent resource exhaustion
- **Secret encryption** - at-rest encryption options
- **Image scanning** - vulnerability detection
- **TLS/HTTPS** - encrypted communication
- **CORS configuration** - prevent unauthorized access

### Security Checklist

- [ ] Secrets stored securely (not in Git)
- [ ] Database backups configured
- [ ] TLS certificates valid
- [ ] Network policies deployed
- [ ] RBAC properly configured
- [ ] Pod security policies enforced
- [ ] Image scanning enabled
- [ ] Monitoring and logging operational
- [ ] Incident response plan documented

## Troubleshooting

### Common Issues

**Pods not starting**

```bash
kubectl describe pod -n grayfsm <pod-name>
kubectl logs -n grayfsm <pod-name>
```

**High latency**

```bash
kubectl top pods -n grayfsm
kubectl logs -n grayfsm <pod-name> | grep "slow"
```

**Database connection issues**

```bash
kubectl exec -n grayfsm <pod> -- psql $DATABASE_URL -c "SELECT 1;"
```

**Deployment stuck**

```bash
kubectl get events -n grayfsm --sort-by='.lastTimestamp'
kubectl rollout status deployment/<name> -n grayfsm
```

See `DEPLOYMENT-GUIDE.md` troubleshooting section for detailed procedures.

## Documentation

- **DEPLOYMENT-GUIDE.md** - Comprehensive deployment guide with all commands
- **RUNBOOK.md** - Quick reference for common operations
- **CONFIG.md** - Configuration options and environment variables
- **README.md** - This file

## Support & Maintenance

### Regular Tasks

- **Daily**: Monitor dashboards, check alerts
- **Weekly**: Review logs, update dependencies
- **Monthly**: Performance review, capacity planning
- **Quarterly**: Security audit, disaster recovery test

### Incident Response

1. Identify issue using monitoring/logs
2. Follow runbook for specific issue
3. Execute rollback if needed
4. Post-incident review and documentation

### Backup & Disaster Recovery

```bash
# Database backup
kubectl exec -n grayfsm <postgres-pod> -- \
  pg_dump -U grayfsm grayfsm > backup.sql

# Restore from backup
kubectl cp backup.sql -n grayfsm <pod>:/tmp/
kubectl exec -n grayfsm <pod> -- \
  psql -U grayfsm grayfsm < /tmp/backup.sql
```

## Performance Optimization

### Metrics to Monitor

- **Request latency** - p50, p95, p99
- **Error rate** - 4xx, 5xx responses
- **Database performance** - query times, connection pool
- **Pod resource usage** - CPU, memory
- **Deployment frequency** - changes per day
- **Lead time** - time from commit to production
- **Change failure rate** - failed deployments
- **MTTR** - time to recover from failure

### Optimization Techniques

1. **Connection pooling** - reduce database connections
2. **Caching** - Redis for frequently accessed data
3. **Database indexing** - optimize query performance
4. **Resource tuning** - CPU/memory requests and limits
5. **Autoscaling** - scale based on metrics

## Production Readiness

Before going live:

- [ ] All tests passing with high coverage
- [ ] Security scanning completed
- [ ] Performance benchmarks met
- [ ] Database backups configured
- [ ] Monitoring and alerting operational
- [ ] Incident response procedures documented
- [ ] Team trained on operations
- [ ] SLOs/SLIs defined
- [ ] Disaster recovery tested
- [ ] Load testing completed

## Contributing

To update infrastructure:

1. Test changes locally
2. Create PR with changes
3. Get infrastructure review
4. Merge and push to main
5. GitHub Actions automatically deploys

## License

Same as main project

## Contact

For questions or issues:

1. Check documentation
2. Review monitoring
3. Open GitHub issue
4. Contact DevOps team

---

**Last Updated**: 2025-11-29
**Infrastructure Version**: 1.0.0
**Kubernetes Version**: 1.24+
**Docker Version**: 20.10+
