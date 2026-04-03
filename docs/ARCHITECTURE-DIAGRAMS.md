# GrayFSM Backend Architecture Diagrams

**Version:** 1.0
**Date:** November 2025

---

## System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                         INTERNET / CLIENT LAYER                         │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │   Browser    │  │   Mobile     │  │   External   │                │
│  │  (React App) │  │     App      │  │     API      │                │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                │
│         │                 │                 │                          │
│         └─────────────────┴─────────────────┘                          │
│                           │                                             │
│                      HTTPS / WSS                                        │
└───────────────────────────┼─────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────────┐
│                     LOAD BALANCER / API GATEWAY                         │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │  Nginx / Traefik / AWS Application Load Balancer              │   │
│  │                                                                 │   │
│  │  Features:                                                      │   │
│  │  • TLS/SSL Termination                                         │   │
│  │  • Rate Limiting (IP-based)                                    │   │
│  │  • Request Routing                                             │   │
│  │  • Health Checks                                               │   │
│  │  • Load Distribution                                           │   │
│  └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
┌─────────────▼──────────┐   ┌───────────▼──────────┐
│   FastAPI Instance 1   │   │  FastAPI Instance 2  │
│   (Application Server) │   │ (Application Server) │
│                        │   │                      │
│  Port: 8000            │   │  Port: 8001          │
│  Workers: 4            │   │  Workers: 4          │
└─────────────┬──────────┘   └───────────┬──────────┘
              │                          │
              └───────────┬──────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────────────────┐
│                     APPLICATION LAYER                                   │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Application                          │   │
│  │                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │   │
│  │  │  REST API   │  │  WebSocket  │  │    Auth     │           │   │
│  │  │  Endpoints  │  │   Handler   │  │ Middleware  │           │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │   │
│  │         │                │                │                   │   │
│  │         └────────────────┴────────────────┘                   │   │
│  │                          │                                     │   │
│  │  ┌───────────────────────▼──────────────────────────┐        │   │
│  │  │       Dependency Injection Container             │        │   │
│  │  │  (Manages service instances and dependencies)    │        │   │
│  │  └───────────────────────┬──────────────────────────┘        │   │
│  └──────────────────────────┼───────────────────────────────────┘   │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────────────┐
│                       SERVICE LAYER                                     │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │     FSM      │  │  Algorithm   │  │   Export     │                │
│  │   Service    │  │   Service    │  │   Service    │                │
│  │              │  │              │  │              │                │
│  │ • create()   │  │ • optimize() │  │ • export()   │                │
│  │ • get()      │  │ • compare()  │  │ • cache()    │                │
│  │ • update()   │  │ • async()    │  │ • generate() │                │
│  │ • delete()   │  │ • results()  │  │              │                │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                │
│         │                 │                  │                         │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐                │
│  │    User      │  │  Category    │  │    Cache     │                │
│  │   Service    │  │   Service    │  │   Service    │                │
│  │ (Phase 4)    │  │              │  │              │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
└─────────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────────────┐
│                   CORE ALGORITHM LAYER                                  │
│                 (Framework-Independent Logic)                           │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  Gray Code   │  │  Hypercube   │  │     FSM      │                │
│  │  Generator   │  │    Graph     │  │    Model     │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │    Greedy    │  │     BFS      │  │    Global    │                │
│  │  Algorithm   │  │  Algorithm   │  │ Optimization │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │   Verilog    │  │     VHDL     │  │  Testbench   │                │
│  │  Exporter    │  │  Exporter    │  │  Generator   │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
└─────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
┌─────────────▼──────┐ ┌──────▼──────┐ ┌─────▼────────┐
│    PostgreSQL      │ │    Redis    │ │    Celery    │
│    Database        │ │    Cache    │ │ Task Queue   │
│                    │ │             │ │              │
│ • FSMs             │ │ • Sessions  │ │ • Workers    │
│ • Users            │ │ • Results   │ │ • Scheduler  │
│ • Results          │ │ • Counters  │ │ • Beat       │
│ • Categories       │ │             │ │              │
│                    │ │             │ │              │
│ Port: 5432         │ │ Port: 6379  │ │ Port: 6379   │
└────────────────────┘ └─────────────┘ └──────────────┘
```

---

## Request Flow Diagram

### Synchronous Request Flow (GET /api/v1/fsms/{id})

```
Client
  │
  │ HTTP GET /api/v1/fsms/123
  ▼
Load Balancer
  │
  │ Route to available instance
  ▼
FastAPI Instance
  │
  │ 1. Authentication Middleware
  │    └─→ Verify JWT token (if present)
  │
  │ 2. Rate Limiting Middleware
  │    └─→ Check rate limit counter in Redis
  │
  │ 3. Route Handler: get_fsm()
  ▼
Service Layer: FSMService.get_fsm(id)
  │
  │ 4. Check Cache
  │    ├─→ Redis.get("fsm:123")
  │    │   └─→ Cache HIT → Return cached data
  │    │
  │    └─→ Cache MISS → Continue
  │
  │ 5. Database Query
  │    └─→ SELECT * FROM fsms WHERE id = '123'
  │
  │ 6. Update Cache
  │    └─→ Redis.set("fsm:123", data, ttl=3600)
  │
  │ 7. Update View Count
  │    └─→ UPDATE fsms SET view_count = view_count + 1
  │
  ▼
Response Serialization (Pydantic)
  │
  │ Convert SQLAlchemy model to Pydantic schema
  │
  ▼
JSON Response
  │
  │ {
  │   "success": true,
  │   "data": { "id": "123", "name": "...", ... },
  │   "metadata": { "timestamp": "...", ... }
  │ }
  │
  ▼
Client receives response

Execution Time: ~50ms (cache hit) or ~100ms (cache miss)
```

---

### Asynchronous Request Flow (POST /api/v1/fsms/{id}/optimize)

```
Client
  │
  │ POST /api/v1/fsms/123/optimize
  │ { "algorithm": "global_sa", "async": true }
  ▼
FastAPI Instance
  │
  │ 1. Route Handler: optimize_fsm()
  ▼
AlgorithmService.optimize_async(id, algorithm)
  │
  │ 2. Create Background Task
  │    └─→ Celery.apply_async(optimize_task, args=[id, algorithm])
  │
  │ 3. Return Task ID immediately
  ▼
Client receives 202 Accepted
  │
  │ {
  │   "task_id": "abc-def-123",
  │   "status": "pending",
  │   "websocket_url": "ws://api.../ws/tasks/abc-def-123"
  │ }
  │
  ▼
Client connects to WebSocket
  │
  │ ws://api.grayfsm.com/ws/tasks/abc-def-123
  ▼
WebSocket Handler
  │
  │ Subscribe to task updates
  │
  ▼
Meanwhile, Celery Worker executes...
  │
  │ 4. Load FSM from database
  │ 5. Execute optimization algorithm
  │    ├─→ Progress: 10%  → Send via WebSocket
  │    ├─→ Progress: 25%  → Send via WebSocket
  │    ├─→ Progress: 50%  → Send via WebSocket
  │    ├─→ Progress: 75%  → Send via WebSocket
  │    └─→ Progress: 100% → Send via WebSocket
  │
  │ 6. Store optimized FSM in database
  │ 7. Store algorithm result
  │ 8. Update cache
  │
  ▼
Final result sent via WebSocket
  │
  │ {
  │   "status": "completed",
  │   "result": {
  │     "optimized_fsm_id": "456",
  │     "dummy_states_added": 3,
  │     "execution_time_ms": 15234
  │   }
  │ }
  │
  ▼
Client displays result

Total Time: 15-30 seconds for complex optimization
Immediate Response Time: <100ms
```

---

## Database Schema Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CORE TABLES                              │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────┐
│       categories       │
├────────────────────────┤
│ id (UUID) PK           │
│ name (VARCHAR)         │
│ slug (VARCHAR) UNIQUE  │
│ description (TEXT)     │
│ parent_category_id FK  │──┐
│ level (INT)            │  │
│ fsm_count (INT)        │  │ Self-referencing
│ created_at (TIMESTAMP) │  │ foreign key
│ updated_at (TIMESTAMP) │  │
└────────────────────────┘  │
             ▲              │
             │              │
             └──────────────┘
             │
             │
┌────────────┴───────────┐
│         fsms           │
├────────────────────────┤
│ id (UUID) PK           │
│ name (VARCHAR)         │
│ description (TEXT)     │
│ fsm_type (ENUM)        │
│ definition (JSONB)     │◄─── Stores complete FSM structure
│ state_count (INT)      │
│ transition_count (INT) │
│ initial_state (VARCHAR)│
│ bit_width (INT)        │
│ encoding_type (VARCHAR)│
│ category_id (UUID) FK  │────► References categories
│ tags (TEXT[])          │
│ parent_fsm_id FK       │──┐
│ created_by (UUID) FK   │  │ Self-referencing
│ visibility (ENUM)      │  │ (for forks)
│ is_optimized (BOOL)    │  │
│ optimization_algorithm │  │
│ dummy_state_count (INT)│  │
│ view_count (INT)       │  │
│ fork_count (INT)       │  │
│ export_count (INT)     │  │
│ created_at (TIMESTAMP) │  │
│ updated_at (TIMESTAMP) │  │
└────────────────────────┘  │
             ▲              │
             │              │
             └──────────────┘
             │
             │
     ┌───────┴────────┬─────────────┬──────────────┐
     │                │             │              │
     ▼                ▼             ▼              ▼
┌─────────────┐  ┌─────────────┐ ┌────────────┐ ┌─────────────┐
│algorithm_   │  │export_cache │ │   shares   │ │   comments  │
│results      │  │             │ │ (Phase 4)  │ │  (Phase 4)  │
├─────────────┤  ├─────────────┤ ├────────────┤ ├─────────────┤
│ id PK       │  │ id PK       │ │ id PK      │ │ id PK       │
│ original_   │  │ fsm_id FK   │ │ fsm_id FK  │ │ fsm_id FK   │
│   fsm_id FK │  │ format(ENUM)│ │ shared_by  │ │ user_id FK  │
│ optimized_  │  │ content     │ │ share_token│ │ content     │
│   fsm_id FK │  │ content_hash│ │ permission │ │ created_at  │
│ algorithm   │  │ file_size   │ │ expires_at │ └─────────────┘
│ dummy_states│  │ generated_at│ └────────────┘
│ total_states│  │ expires_at  │
│ improvement%│  └─────────────┘
│ exec_time_ms│
│ success     │
│ executed_at │
└─────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       PHASE 4 TABLES                             │
└─────────────────────────────────────────────────────────────────┘

┌────────────────────────┐
│         users          │
├────────────────────────┤
│ id (UUID) PK           │
│ username (VARCHAR)     │
│ email (VARCHAR)        │
│ password_hash (VARCHAR)│
│ display_name (VARCHAR) │
│ bio (TEXT)             │
│ avatar_url (VARCHAR)   │
│ role (ENUM)            │
│ status (ENUM)          │
│ api_key (VARCHAR)      │
│ preferences (JSONB)    │
│ fsms_created (INT)     │
│ total_optimizations    │
│ last_login_at          │
│ created_at (TIMESTAMP) │
│ updated_at (TIMESTAMP) │
└────────────────────────┘
             │
             │ Created FSMs, Shares, Comments, etc.
             │
             └───────────► Referenced by other tables
```

---

## Caching Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT REQUEST                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │   API GATEWAY        │
                  │  (Rate Limiting)     │
                  └──────────┬───────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                   APPLICATION CACHE LAYER                       │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                  Redis Cache                            │   │
│  │                                                          │   │
│  │  Cache Keys:                                            │   │
│  │  • fsm:{id}                      TTL: 1 hour           │   │
│  │  • optimization:{id}:{algo}      TTL: 24 hours         │   │
│  │  • export:{id}:{format}          TTL: 7 days           │   │
│  │  • rate:{user}:{endpoint}        TTL: 1 minute         │   │
│  │                                                          │   │
│  │  Cache Strategies:                                      │   │
│  │  • Write-Through: Update cache on write                │   │
│  │  • Cache-Aside: Check cache, query DB if miss          │   │
│  │  • Time-Based: Expire after TTL                        │   │
│  │                                                          │   │
│  │  Stats:                                                 │   │
│  │  • Hit Rate Target: 80%+                               │   │
│  │  • Max Memory: 2GB                                      │   │
│  │  • Eviction: LRU (Least Recently Used)                 │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                             │
                      Cache Miss │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                   DATABASE CACHE LAYER                          │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL (export_cache table)            │   │
│  │                                                          │   │
│  │  Cached Data:                                           │   │
│  │  • Generated HDL exports         TTL: 7 days           │   │
│  │  • Testbench code               TTL: 7 days           │   │
│  │  • Large computation results    TTL: 30 days          │   │
│  │                                                          │   │
│  │  Cleanup Strategy:                                      │   │
│  │  • Cron job runs daily                                 │   │
│  │  • DELETE WHERE expires_at < NOW()                     │   │
│  │                                                          │   │
│  │  Stats:                                                 │   │
│  │  • Storage: ~500MB                                      │   │
│  │  • Access Count Tracking                                │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                             │
                      No Cache │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                   PRIMARY DATA LAYER                            │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL (main tables)                   │   │
│  │                                                          │   │
│  │  Data:                                                  │   │
│  │  • FSM definitions                                      │   │
│  │  • User data                                            │   │
│  │  • Algorithm results                                    │   │
│  │  • All master data                                      │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │   Update Cache           │
              │   (Write-Through)        │
              │                          │
              │   1. Update Database     │
              │   2. Invalidate Cache    │
              │   3. Warm Cache (optional)│
              └──────────────────────────┘
```

---

## WebSocket Architecture Diagram

```
Client                    FastAPI Server             Celery Worker
  │                             │                          │
  │ 1. HTTP POST                │                          │
  │ /fsms/123/optimize          │                          │
  │ { "async": true }           │                          │
  ├────────────────────────────►│                          │
  │                             │                          │
  │                             │ 2. Create Celery Task    │
  │                             ├─────────────────────────►│
  │                             │                          │
  │                             │                          │
  │ 3. HTTP 202 Accepted        │                          │
  │ { "task_id": "abc-123",     │                          │
  │   "websocket_url": "..." }  │                          │
  │◄────────────────────────────┤                          │
  │                             │                          │
  │                             │                          │
  │ 4. WebSocket Connection     │                          │
  │ ws://.../tasks/abc-123      │                          │
  ├────────────────────────────►│                          │
  │                             │                          │
  │                             │ 5. Subscribe to updates  │
  │                             ├────────┐                 │
  │                             │        │                 │
  │                             │ ┌──────▼──────┐          │
  │                             │ │   Redis     │          │
  │                             │ │   Pub/Sub   │          │
  │                             │ └──────▲──────┘          │
  │                             │        │                 │
  │                             │        │ 6. Publish      │
  │                             │        │ progress updates│
  │                             │        │                 │
  │                             │        │                 │
  │                             │        │         ┌───────┴──────┐
  │                             │        │         │ Optimization │
  │                             │        │         │  Algorithm   │
  │                             │        │         │   Running    │
  │ 7. Progress: 10%            │        │         └───────┬──────┘
  │◄────────────────────────────┤◄───────┤                 │
  │                             │        │                 │
  │ 8. Progress: 25%            │        │                 │
  │◄────────────────────────────┤◄───────┤                 │
  │                             │        │                 │
  │ 9. Progress: 50%            │        │                 │
  │◄────────────────────────────┤◄───────┤                 │
  │                             │        │                 │
  │ 10. Progress: 75%           │        │                 │
  │◄────────────────────────────┤◄───────┤                 │
  │                             │        │                 │
  │ 11. Progress: 100%          │        │                 │
  │     Result: {...}           │        │                 │
  │◄────────────────────────────┤◄───────┤◄────────────────┤
  │                             │        │                 │
  │                             │        │                 │
  │ 12. Close WebSocket         │        │                 │
  ├────────────────────────────►│        │                 │
  │                             │        │                 │
  │                             │        │                 │
  ▼                             ▼        ▼                 ▼
Done                          Done     Done              Done

Timeline:
- Steps 1-3: < 100ms (immediate response)
- Steps 4-6: < 500ms (WebSocket setup)
- Steps 7-11: 15-30 seconds (algorithm execution)
- Step 12: Instant (cleanup)

Total user experience: Real-time progress updates throughout optimization
```

---

## Deployment Architecture Diagram

### Production Deployment

```
                        ┌──────────────────────┐
                        │   Route 53 / DNS     │
                        │  api.grayfsm.com     │
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │   CloudFlare CDN     │
                        │  • DDoS Protection   │
                        │  • SSL/TLS           │
                        │  • Caching           │
                        └──────────┬───────────┘
                                   │
┌──────────────────────────────────▼────────────────────────────────────┐
│                    AWS / GCP / Azure Cloud                             │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │              Application Load Balancer                          │  │
│  │  • Health Checks                                               │  │
│  │  • SSL Termination                                             │  │
│  │  • Request Distribution                                        │  │
│  └────────────┬───────────────────────────┬───────────────────────┘  │
│               │                           │                           │
│  ┌────────────▼──────────┐   ┌───────────▼──────────┐               │
│  │  Auto Scaling Group   │   │  Auto Scaling Group  │               │
│  │   (FastAPI Servers)   │   │  (Celery Workers)    │               │
│  │                       │   │                      │               │
│  │  ┌─────────────────┐ │   │  ┌─────────────────┐ │               │
│  │  │  Container 1    │ │   │  │   Worker 1      │ │               │
│  │  │  FastAPI + uv   │ │   │  │   Celery        │ │               │
│  │  └─────────────────┘ │   │  └─────────────────┘ │               │
│  │  ┌─────────────────┐ │   │  ┌─────────────────┐ │               │
│  │  │  Container 2    │ │   │  │   Worker 2      │ │               │
│  │  │  FastAPI + uv   │ │   │  │   Celery        │ │               │
│  │  └─────────────────┘ │   │  └─────────────────┘ │               │
│  │  ┌─────────────────┐ │   │  ┌─────────────────┐ │               │
│  │  │  Container 3    │ │   │  │   Worker 3      │ │               │
│  │  │  FastAPI + uv   │ │   │  │   Celery        │ │               │
│  │  └─────────────────┘ │   │  └─────────────────┘ │               │
│  │                       │   │                      │               │
│  │  Min: 2, Max: 10     │   │  Min: 1, Max: 5     │               │
│  └───────────────────────┘   └──────────────────────┘               │
│               │                           │                           │
│               └───────────┬───────────────┘                           │
│                           │                                           │
│  ┌────────────────────────▼────────────────────────────────────┐    │
│  │                    VPC (Virtual Private Cloud)               │    │
│  │                                                               │    │
│  │  ┌──────────────────┐  ┌──────────────────┐                 │    │
│  │  │  RDS PostgreSQL  │  │  ElastiCache     │                 │    │
│  │  │  (Primary)       │  │  Redis Cluster   │                 │    │
│  │  │                  │  │                  │                 │    │
│  │  │  • Multi-AZ      │  │  • Cluster Mode  │                 │    │
│  │  │  • Auto Backup   │  │  • 3 Nodes       │                 │    │
│  │  │  • 100GB Storage │  │  • 4GB Memory    │                 │    │
│  │  └────────┬─────────┘  └──────────────────┘                 │    │
│  │           │                                                   │    │
│  │  ┌────────▼─────────┐                                        │    │
│  │  │  RDS PostgreSQL  │                                        │    │
│  │  │  (Read Replica)  │                                        │    │
│  │  │                  │                                        │    │
│  │  │  • Async Repl.   │                                        │    │
│  │  │  • Read Scaling  │                                        │    │
│  │  └──────────────────┘                                        │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  Monitoring & Logging                           │  │
│  │                                                                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │  │
│  │  │  CloudWatch │  │   Sentry    │  │  Datadog    │           │  │
│  │  │   Metrics   │  │   Errors    │  │   APM       │           │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │  │
│  └────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘

Cost Estimate (Monthly):
- EC2 Instances (API): $100-200
- EC2 Instances (Workers): $50-100
- RDS PostgreSQL: $150-300
- ElastiCache Redis: $50-100
- Load Balancer: $20-30
- Data Transfer: $50-100
- Monitoring: $50-100
─────────────────────────
Total: $470-930/month

For 100-1000 concurrent users
```

---

These diagrams provide a comprehensive visual representation of the GrayFSM backend architecture. Use them for:
- Team onboarding
- Architecture reviews
- Deployment planning
- Documentation
- Presentations
