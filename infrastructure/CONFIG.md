# Configuration Guide

This document describes all environment variables and configuration options for GrayFSM deployment.

## Table of Contents

- [Development Configuration](#development-configuration)
- [Staging Configuration](#staging-configuration)
- [Production Configuration](#production-configuration)
- [Security Credentials](#security-credentials)
- [Feature Flags](#feature-flags)
- [Performance Tuning](#performance-tuning)

## Development Configuration

### Backend `.env`

```bash
# Application
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG
API_TITLE=GrayFSM API - Development
API_VERSION=1.0.0

# Server
HOST=0.0.0.0
PORT=8000
RELOAD=true
WORKERS=1

# Database
DATABASE_URL=postgresql+asyncpg://grayfsm:devpass@localhost:5432/grayfsm
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_PASSWORD=changeme
REDIS_TTL=3600

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,OPTIONS,PATCH
CORS_ALLOW_HEADERS=*

# Security
JWT_SECRET_KEY=dev-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
API_KEY=dev-api-key

# Rate Limiting
RATE_LIMIT_ENABLED=false
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_PERIOD=60

# Monitoring
SENTRY_ENABLED=false
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0

# Feature Flags
FEATURE_FLAGS_ENABLED=false
UNLEASH_URL=http://localhost:8080
UNLEASH_API_KEY=default:development.unleash-insecure-frontend-api-token
```

### Frontend `.env`

```bash
VITE_API_URL=http://localhost:8000/api
VITE_API_TIMEOUT=30000
VITE_ENVIRONMENT=development
VITE_DEBUG=true
VITE_LOG_LEVEL=debug
```

### Docker Compose Override

Create `docker-compose.override.yml`:

```yaml
version: '3.9'

services:
  backend:
    environment:
      DEBUG: 'true'
      LOG_LEVEL: 'DEBUG'
    ports:
      - "8001:8000"

  frontend:
    environment:
      VITE_API_URL: 'http://localhost:8000/api'
    ports:
      - "3001:80"
```

## Staging Configuration

### Backend `.env.staging`

```bash
ENVIRONMENT=staging
DEBUG=false
LOG_LEVEL=INFO
API_TITLE=GrayFSM API - Staging

HOST=0.0.0.0
PORT=8000
RELOAD=false
WORKERS=4

DATABASE_URL=postgresql+asyncpg://grayfsm:${STAGING_DB_PASSWORD}@db.staging.internal:5432/grayfsm
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10

REDIS_URL=redis://:${STAGING_REDIS_PASSWORD}@redis.staging.internal:6379/0
REDIS_TTL=86400

CORS_ORIGINS=https://staging.grayfsm.example.com,https://staging-api.grayfsm.example.com
CORS_ALLOW_CREDENTIALS=true

JWT_SECRET_KEY=${STAGING_JWT_SECRET}
API_KEY=${STAGING_API_KEY}

RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_PERIOD=60

SENTRY_ENABLED=true
SENTRY_DSN=${STAGING_SENTRY_DSN}

FEATURE_FLAGS_ENABLED=true
UNLEASH_URL=https://unleash.staging.internal
UNLEASH_API_KEY=${STAGING_UNLEASH_API_KEY}

SLACK_WEBHOOK=${STAGING_SLACK_WEBHOOK}
```

### Kubernetes ConfigMap

Already defined in `kubernetes/configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grayfsm-config-staging
  namespace: grayfsm
data:
  ENVIRONMENT: "staging"
  DEBUG: "false"
  LOG_LEVEL: "INFO"
  # ... more values
```

## Production Configuration

### Backend `.env.prod`

```bash
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=WARNING
API_TITLE=GrayFSM API

HOST=0.0.0.0
PORT=8000
RELOAD=false
WORKERS=8

DATABASE_URL=postgresql+asyncpg://grayfsm:${PROD_DB_PASSWORD}@db.prod.internal:5432/grayfsm
DB_POOL_SIZE=50
DB_MAX_OVERFLOW=20
DB_ECHO=false

REDIS_URL=redis://:${PROD_REDIS_PASSWORD}@redis.prod.internal:6379/0
REDIS_TTL=604800

CORS_ORIGINS=https://grayfsm.example.com

CORS_ALLOW_CREDENTIALS=true
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,OPTIONS,PATCH
CORS_ALLOW_HEADERS=Authorization,Content-Type

# Security - use Vault or AWS Secrets Manager
JWT_SECRET_KEY=${PROD_JWT_SECRET_FROM_VAULT}
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

API_KEY=${PROD_API_KEY_FROM_VAULT}

RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_PERIOD=60

SENTRY_ENABLED=true
SENTRY_DSN=${PROD_SENTRY_DSN}
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

FEATURE_FLAGS_ENABLED=true
UNLEASH_URL=https://unleash.prod.internal
UNLEASH_API_KEY=${PROD_UNLEASH_API_KEY}

# Monitoring
PROMETHEUS_METRICS_ENABLED=true
JAEGER_ENABLED=true
JAEGER_AGENT_HOST=jaeger-agent.monitoring.svc.cluster.local
JAEGER_AGENT_PORT=6831

# Slack notifications
SLACK_WEBHOOK=${PROD_SLACK_WEBHOOK}

# Email notifications
SMTP_SERVER=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=${SENDGRID_API_KEY}
ALERT_EMAIL_FROM=alerts@grayfsm.example.com
ALERT_EMAIL_TO=devops@grayfsm.example.com
```

## Security Credentials

### GitHub Secrets

Store these in GitHub repository settings:

```
SLACK_WEBHOOK              # Slack notifications
STAGING_DATABASE_URL       # Staging PostgreSQL connection
PRODUCTION_DATABASE_URL    # Production PostgreSQL connection
STAGING_REDIS_URL          # Staging Redis
PRODUCTION_REDIS_URL       # Production Redis
SENTRY_DSN                 # Error tracking
STAGING_JWT_SECRET         # Staging JWT key
PRODUCTION_JWT_SECRET      # Production JWT key
STAGING_API_KEY            # Staging API key
PRODUCTION_API_KEY         # Production API key
```

### Kubernetes Secrets

Create secrets from command line:

```bash
# Generic secret
kubectl create secret generic grayfsm-secrets-prod \
  --from-literal=DATABASE_URL="postgresql://user:pass@host/db" \
  --from-literal=REDIS_URL="redis://pass@host:6379" \
  -n grayfsm

# From file
kubectl create secret generic db-backup \
  --from-file=backup.sql \
  -n grayfsm

# Docker registry credentials
kubectl create secret docker-registry ghcr-credentials \
  --docker-server=ghcr.io \
  --docker-username=username \
  --docker-password=token \
  -n grayfsm
```

### Sealed Secrets (Recommended for Production)

```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.18.0/controller.yaml

# Create sealed secret
echo -n mypassword | kubectl create secret generic mysecret \
  --dry-run=client \
  --from-file=password=/dev/stdin \
  -o yaml | \
  kubeseal -o yaml > mysealedsecret.yaml

# Apply sealed secret
kubectl apply -f mysealedsecret.yaml
```

### External Secrets Operator (Alternative)

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets
  namespace: grayfsm
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa

---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: grayfsm-secrets
  namespace: grayfsm
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets
    kind: SecretStore
  target:
    name: grayfsm-secrets-prod
    creationPolicy: Owner
  data:
  - secretKey: DATABASE_URL
    remoteRef:
      key: grayfsm/database-url
  - secretKey: REDIS_URL
    remoteRef:
      key: grayfsm/redis-url
  - secretKey: JWT_SECRET_KEY
    remoteRef:
      key: grayfsm/jwt-secret
```

## Feature Flags

### Using Unleash

Environment variables:

```bash
FEATURE_FLAGS_ENABLED=true
UNLEASH_URL=https://unleash.example.com
UNLEASH_API_KEY=your-api-key
```

In code:

```python
from app.services.feature_flags import get_feature_flag

# Check flag
if await get_feature_flag("new-optimization-algorithm"):
    # Use new algorithm
    pass
else:
    # Use old algorithm
    pass
```

### Common Feature Flags

```yaml
# Blue-green deployment
feature-blue-green-deployment:
  enabled: true

# Experimental algorithms
feature-experimental-algorithms:
  enabled: false

# GraphQL endpoint (future)
feature-graphql-endpoint:
  enabled: false

# WebSocket support
feature-websocket-support:
  enabled: false

# Advanced analytics
feature-advanced-analytics:
  enabled: false
  environments:
    production:
      enabled: false
    staging:
      enabled: true
```

## Performance Tuning

### Database Connection Pool

```bash
# Development
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10

# Staging
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10

# Production
DB_POOL_SIZE=50
DB_MAX_OVERFLOW=20
```

### Uvicorn Workers

```bash
# Development (reload mode)
WORKERS=1

# Staging
WORKERS=4

# Production (2-4 × CPU cores)
# For 8-core server:
WORKERS=16
```

### Kubernetes Resource Requests

```yaml
resources:
  requests:
    memory: "256Mi"  # Minimum needed
    cpu: "100m"      # Minimum cores
  limits:
    memory: "512Mi"  # Maximum allowed
    cpu: "500m"      # Maximum cores
```

Calculation:
- `requests.memory = base + (concurrent_users * memory_per_user)`
- `limits.memory = requests.memory * 1.5-2x`
- `requests.cpu = base + (load * cpu_per_request)`
- `limits.cpu = requests.cpu * 2-4x`

### Cache TTL

```bash
# Development (short-lived)
REDIS_TTL=3600  # 1 hour

# Staging
REDIS_TTL=86400  # 1 day

# Production
REDIS_TTL=604800  # 1 week
```

### Logging Configuration

```bash
# Development (verbose)
LOG_LEVEL=DEBUG

# Staging (informational)
LOG_LEVEL=INFO

# Production (warnings only)
LOG_LEVEL=WARNING
```

## Environment-Specific Values Reference

| Setting | Dev | Staging | Production |
|---------|-----|---------|------------|
| DEBUG | true | false | false |
| LOG_LEVEL | DEBUG | INFO | WARNING |
| DB_POOL_SIZE | 5 | 20 | 50 |
| WORKERS | 1 | 4 | 16 |
| RATE_LIMIT | false | true | true |
| RATE_LIMIT_REQUESTS | 100 | 100 | 1000 |
| REDIS_TTL | 3600 | 86400 | 604800 |
| REPLICAS | 1 | 3 | 5 |
| CPU_REQUEST | 50m | 100m | 100m |
| MEMORY_REQUEST | 128Mi | 256Mi | 256Mi |
| CPU_LIMIT | 200m | 500m | 500m |
| MEMORY_LIMIT | 256Mi | 512Mi | 512Mi |

## Validation

Before deployment, validate configuration:

```bash
# Python validation
python -c "
from pydantic_settings import BaseSettings
from app.config import Settings
settings = Settings()
print('Configuration valid')
print(f'Environment: {settings.environment}')
print(f'Debug: {settings.debug}')
"

# Kubernetes validation
kubectl apply -f infrastructure/kubernetes/configmap.yaml --dry-run=client

# Docker validation
docker-compose config > /dev/null
```
