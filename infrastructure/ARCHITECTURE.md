# GrayFSM Infrastructure Architecture

Complete architecture diagrams and descriptions for the deployment infrastructure.

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Users / Clients                              │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Internet / DNS / CDN                              │
│              (grayfsm.example.com, api.grayfsm.com)                 │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Load Balancer / Ingress Controller                 │
│                        (NGINX Ingress)                               │
│                     TLS/HTTPS Termination                            │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
        ┌──────────────────────┐    ┌──────────────────────┐
        │   Frontend Service   │    │   Backend Service    │
        │  (React + Nginx)     │    │  (FastAPI)           │
        │  Port 80/443         │    │  Port 8000           │
        └──────────────────────┘    └──────────────────────┘
                    │                             │
        ┌───────────┴───────────┐      ┌─────────┴─────────┐
        ▼                       ▼      ▼                   ▼
    ┌────────┐         ┌────────────┐ ┌──────┐     ┌──────────┐
    │Frontend│         │Frontend    │ │Cache │     │Database  │
    │Pod 1   │         │Pod 2/3     │ │Redis │     │PostgreSQL│
    └────────┘         └────────────┘ └──────┘     └──────────┘
                                         │               │
                                         ▼               ▼
                                    ┌────────┐    ┌──────────┐
                                    │Redis   │    │Postgres  │
                                    │Storage │    │PVC       │
                                    └────────┘    └──────────┘
```

## Blue-Green Deployment Architecture

```
                        Kubernetes Service
                    (grayfsm-backend:8000)
                              │
                              ▼
                    ┌───────────────────┐
                    │ Service Selector  │
                    │   slot: "blue"    │
                    └───────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
        ┌─────────────────┐        ┌─────────────────┐
        │ Blue Deployment │        │Green Deployment │
        │ (Active Slot)   │        │ (Standby Slot)  │
        │ Replicas: 3     │        │ Replicas: 0/3   │
        └─────────────────┘        └─────────────────┘
        │   Pod 1         │        │   Pod 1 (new)   │
        │   Pod 2         │        │   Pod 2 (new)   │
        │   Pod 3         │        │   Pod 3 (new)   │
        └─────────────────┘        └─────────────────┘
            Receiving Traffic          No Traffic

Deployment Flow:
1. Update Green deployment with new image
2. Green pods start, health checks verify
3. Switch service selector from blue → green
4. Update Blue with next version
5. Switch back at next deployment
```

## CI/CD Pipeline Architecture

```
Developer Push
       │
       ▼
GitHub Repository
       │
       ├─► Push to Feature Branch
       │       │
       │       ▼
       │   Tests Skip (optional)
       │
       ├─► PR to develop
       │       │
       │       ▼
       │   ┌─────────────────────┐
       │   │ GitHub Actions      │
       │   │ CI/CD Pipeline      │
       │   └─────────────────────┘
       │       │
       │       ├─► Security Scan
       │       │   ├─ Trivy vulnerability scan
       │       │   ├─ Dependency check
       │       │   └─ SARIF upload
       │       │
       │       ├─► Backend Tests
       │       │   ├─ Lint (flake8)
       │       │   ├─ Type check (mypy)
       │       │   ├─ Unit tests (pytest)
       │       │   └─ Coverage report
       │       │
       │       ├─► Frontend Tests
       │       │   ├─ Lint (ESLint)
       │       │   ├─ Type check (TypeScript)
       │       │   ├─ Unit tests (Vitest)
       │       │   └─ Coverage report
       │       │
       │       ├─► Docker Build
       │       │   ├─ Backend image build
       │       │   └─ Frontend image build
       │       │
       │       └─► Push to Registry
       │           └─ ghcr.io
       │
       └─► Merge to main/develop
               │
               ▼
           ┌─────────────────┐
           │  Deployment     │
           │  ├─ Staging     │ (if develop)
           │  └─ Production  │ (if main)
           └─────────────────┘
```

## Kubernetes Cluster Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                  Kubernetes Cluster                             │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Control Plane (managed by provider)              │  │
│  │  - API Server                                            │  │
│  │  - etcd                                                  │  │
│  │  - Controller Manager                                   │  │
│  │  - Scheduler                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Worker Node 1 (App)                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │ Backend  │  │Frontend  │  │  Redis   │              │  │
│  │  │ Pod 1    │  │ Pod 1    │  │ Pod      │              │  │
│  │  └──────────┘  └──────────┘  └──────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Worker Node 2 (App)                         │  │
│  │  ┌──────────┐  ┌──────────┐                             │  │
│  │  │ Backend  │  │Frontend  │                             │  │
│  │  │ Pod 2    │  │ Pod 2    │                             │  │
│  │  └──────────┘  └──────────┘                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Worker Node 3 (Data/Monitor)               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐      │  │
│  │  │ Backend  │  │Frontend  │  │  PostgreSQL      │      │  │
│  │  │ Pod 3    │  │ Pod 3    │  │  StatefulSet     │      │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘      │  │
│  │                               ┌──────────────────┐      │  │
│  │                               │ Prometheus       │      │  │
│  │                               │ Grafana          │      │  │
│  │                               │ Loki             │      │  │
│  │                               └──────────────────┘      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Persistent Volumes                           │  │
│  │  ┌──────────────┐  ┌──────────────┐                      │  │
│  │  │ PostgreSQL   │  │ Redis        │                      │  │
│  │  │ Data (10Gi)  │  │ Data (5Gi)   │                      │  │
│  │  └──────────────┘  └──────────────┘                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Kubernetes Services                          │  │
│  │  - grayfsm-backend    (ClusterIP:8000)                   │  │
│  │  - grayfsm-frontend   (ClusterIP:80)                     │  │
│  │  - grayfsm-postgres   (ClusterIP:5432)                   │  │
│  │  - grayfsm-redis      (ClusterIP:6379)                   │  │
│  │  - prometheus         (ClusterIP:9090)                   │  │
│  │  - grafana            (ClusterIP:3000)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Namespaces                                   │  │
│  │  - grayfsm              (application)                     │  │
│  │  - grayfsm-monitoring   (observability)                   │  │
│  │  - kube-system          (system pods)                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Data Flow Architecture

### Request Flow (Frontend to Backend)

```
User Request
    │
    ▼
Browser
    │
    ▼
HTTPS (TLS)
    │
    ▼
Load Balancer / Ingress
    │
    ├─► Static Assets → Frontend Service (Nginx)
    │       │
    │       ▼
    │   Nginx Returns (index.html, JS, CSS)
    │
    └─► API Requests (/api/*) → Backend Service (FastAPI)
            │
            ▼
        Backend Pod
            │
            ├─► Check Cache (Redis)
            │   ├─ Hit: Return cached response
            │   └─ Miss: Continue
            │
            ├─► Query Database (PostgreSQL)
            │   │
            │   ▼
            │   Database Returns Results
            │
            ├─► Cache Results (Redis)
            │
            └─► Return Response (JSON)
                    │
                    ▼
                Browser
                    │
                    ▼
                Update UI
                    │
                    ▼
                Display to User
```

### Monitoring Data Flow

```
Application Pods
    │
    ├─► Prometheus Metrics Endpoint (/metrics)
    │   │
    │   ▼
    │   Prometheus (9090)
    │   - Scrape metrics every 15s
    │   - Store time-series data
    │   - Evaluate alert rules
    │
    └─► Application Logs
        │
        ▼
        Promtail (log collector)
        │
        ▼
        Loki (log aggregator)
        │
        ▼
        Storage (filesystem)

Prometheus + Loki
    │
    ▼
Grafana (3000)
    - Visualize metrics
    - Display logs
    - Show dashboards
    │
    ▼
User Dashboards & Alerts

Alerts
    │
    ▼
AlertManager
    │
    ├─► Slack Webhook
    ├─► Email
    └─► PagerDuty
```

## Networking Architecture

```
┌─────────────────────────────────────────┐
│  Internet / External Network            │
└─────────────────────────────────────────┘
            │
            ▼
    ┌───────────────────┐
    │ DNS (53)          │
    │ grayfsm.example   │
    └───────────────────┘
            │
            ▼
    ┌───────────────────────────────────┐
    │ Load Balancer / Public IP         │
    │ (Cloud Provider)                  │
    └───────────────────────────────────┘
            │
            ▼
    ┌───────────────────────────────────┐
    │ NGINX Ingress Controller          │
    │ Port 80 (HTTP) → HTTPS            │
    │ Port 443 (HTTPS)                  │
    └───────────────────────────────────┘
            │
    ┌───────┴────────────────────┐
    ▼                            ▼
┌─────────────────┐     ┌──────────────────┐
│ Frontend        │     │ Backend          │
│ Route: /        │     │ Route: /api/*    │
│ Service:80      │     │ Service:8000     │
└─────────────────┘     └──────────────────┘
    │                        │
    ▼                        ▼
┌─────────────────┐     ┌──────────────────┐
│ Frontend Pods   │     │ Backend Pods     │
│ Nginx:80        │     │ FastAPI:8000     │
└─────────────────┘     └──────────────────┘

Internal Services (ClusterIP - no external access)
    │
    ├─► PostgreSQL:5432
    ├─► Redis:6379
    ├─► Prometheus:9090
    ├─► Grafana:3000
    └─► Loki:3100

Network Policies
    - Default DENY ingress
    - ALLOW DNS egress
    - Specific policies per service
```

## Storage Architecture

```
┌──────────────────────────────────────┐
│  Kubernetes Persistent Volumes       │
└──────────────────────────────────────┘
    │
    ├─► PostgreSQL Storage
    │   ├─ Type: PersistentVolumeClaim
    │   ├─ Size: 10Gi
    │   ├─ Access Mode: ReadWriteOnce
    │   ├─ Storage Class: standard
    │   └─ Mount Path: /var/lib/postgresql/data
    │
    └─► Redis Storage (optional)
        ├─ Type: PersistentVolumeClaim
        ├─ Size: 5Gi
        ├─ Access Mode: ReadWriteOnce
        ├─ Storage Class: standard
        └─ Mount Path: /data

Local Storage (non-persistent)
    ├─► /tmp - Temporary files
    ├─► /var/cache/nginx - Nginx cache
    └─► emptyDir volumes - Pod-scoped storage
```

## Security Architecture

```
┌────────────────────────────────────────────────────────┐
│               Security Layers                          │
└────────────────────────────────────────────────────────┘

External Security
    │
    ├─► TLS/HTTPS (Cert-Manager, Let's Encrypt)
    │   └─ Encrypt data in transit
    │
    └─► DNS (DNSSEC optional)
        └─ Prevent DNS spoofing

Network Security
    │
    ├─► Network Policies
    │   ├─ Default DENY ingress
    │   ├─ ALLOW from ingress controller
    │   └─ Service-to-service communication
    │
    └─► Service Mesh (Istio optional)
        ├─ mTLS between pods
        ├─ Traffic policies
        └─ Authorization policies

Application Security
    │
    ├─► Non-root containers
    │   └─ runAsNonRoot: true
    │
    ├─► Read-only filesystem
    │   └─ readOnlyRootFilesystem: true
    │
    ├─► Resource limits
    │   ├─ CPU limits prevent DoS
    │   └─ Memory limits prevent OOM
    │
    └─► Security context
        ├─ allowPrivilegeEscalation: false
        ├─ Dropped capabilities
        └─ seccomp/AppArmor policies

Secret Management
    │
    ├─► Kubernetes Secrets
    │   └─ Basic encryption (etcd)
    │
    ├─► Sealed Secrets
    │   └─ Asymmetric encryption in Git
    │
    ├─► External Secrets Operator
    │   └─ AWS/Azure/GCP integration
    │
    └─► Vault
        └─ Enterprise secret management

RBAC (Role-Based Access Control)
    │
    ├─► ServiceAccounts
    │   ├─ One per component
    │   └─ Limited permissions
    │
    ├─► Roles/ClusterRoles
    │   └─ Define permissions
    │
    └─► RoleBindings/ClusterRoleBindings
        └─ Assign roles to accounts
```

## Database Architecture

```
┌─────────────────────────────────────────┐
│  PostgreSQL StatefulSet                 │
│  (High Availability)                    │
└─────────────────────────────────────────┘
    │
    ├─ Primary (Leader)
    │   ├─ Read/Write Operations
    │   ├─ WAL (Write-Ahead Logging)
    │   └─ Replication Stream
    │
    ├─ Read Replica 1 (Optional)
    │   └─ Read-only Operations
    │
    └─ Read Replica 2 (Optional)
        └─ Read-only Operations

Backup Strategy
    │
    ├─► Full Backup (Weekly)
    │   └─ Complete database snapshot
    │
    ├─► Incremental Backup (Daily)
    │   └─ WAL files
    │
    └─► Point-in-Time Recovery (PITR)
        └─ Restore to any point in time

Monitoring
    │
    ├─ Query Performance
    ├─ Connection Pool
    ├─ Disk Space
    └─ Replication Lag
```

## Performance Optimization Architecture

```
┌────────────────────────────────────────┐
│  Performance Optimization Layers        │
└────────────────────────────────────────┘
    │
    ├─► Frontend Optimization
    │   ├─ Code splitting (Vite)
    │   ├─ Lazy loading
    │   ├─ Image optimization
    │   ├─ CSS minification
    │   ├─ Gzip compression
    │   └─ Browser caching
    │
    ├─► Backend Optimization
    │   ├─ Connection pooling (20-50 connections)
    │   ├─ Query optimization
    │   ├─ Database indexing
    │   ├─ Async operations (FastAPI)
    │   └─ Uvicorn workers (4-16)
    │
    ├─► Cache Layer (Redis)
    │   ├─ Cache API responses
    │   ├─ Session storage
    │   ├─ Rate limiting
    │   └─ Task queue (optional)
    │
    └─► Infrastructure Optimization
        ├─ Resource requests/limits
        ├─ Pod autoscaling
        ├─ Network optimization
        └─ Storage optimization
```

## Disaster Recovery Architecture

```
Primary Datacenter
    │
    ├─► Active Cluster (Production)
    │   └─ All traffic
    │
    ├─► Database Backups
    │   ├─ Hourly snapshots
    │   ├─ Daily full backups
    │   └─ WAL archiving
    │
    └─► Monitoring & Alerting
        └─ Real-time alerts

Secondary Datacenter (Standby)
    │
    ├─► Backup Cluster (Ready)
    │   └─ No traffic
    │
    ├─► Database Replica
    │   └─ Streaming replication
    │
    └─► Documentation
        └─ Recovery procedures

Failover Process:
1. Detect primary datacenter failure (monitoring alerts)
2. Verify secondary readiness
3. Promote secondary to primary
4. Update DNS/load balancer
5. Verify application health
6. Notify team
7. Investigate root cause
8. Update documentation
```

---

## Architecture Principles

1. **High Availability**
   - Multiple replicas of each service
   - Pod anti-affinity for distribution
   - Health checks and auto-restart

2. **Security**
   - Defense in depth
   - Network policies
   - RBAC and service accounts
   - Secret management

3. **Scalability**
   - Horizontal scaling (add pods)
   - Vertical scaling (increase limits)
   - Resource optimization
   - Autoscaling capabilities

4. **Observability**
   - Comprehensive metrics
   - Structured logging
   - Distributed tracing
   - Alerting

5. **Resilience**
   - Graceful degradation
   - Automated recovery
   - Blue-green deployments
   - Rollback procedures

---

**Last Updated**: 2025-11-29
**Architecture Version**: 1.0.0
