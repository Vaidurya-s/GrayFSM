# GrayFSM Backend Service Architecture

**Version:** 1.0
**Date:** November 2025
**Status:** Design Document
**Technology Stack:** FastAPI (Python 3.10+), PostgreSQL, Redis, NetworkX

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Service Boundaries](#service-boundaries)
4. [API Design](#api-design)
5. [Authentication & Authorization](#authentication--authorization)
6. [Core Algorithm Services](#core-algorithm-services)
7. [Export Services](#export-services)
8. [Caching Strategy](#caching-strategy)
9. [WebSocket Support](#websocket-support)
10. [Error Handling](#error-handling)
11. [Performance Optimization](#performance-optimization)
12. [Deployment Architecture](#deployment-architecture)

---

## Executive Summary

This document defines the complete backend service architecture for GrayFSM, a web-based tool for optimizing finite state machines using Gray code encoding. The architecture is designed to be:

- **Modular**: Clear separation of concerns with distinct service layers
- **Scalable**: Horizontal scaling support via stateless services
- **Resilient**: Circuit breakers, retries, and graceful degradation
- **Performant**: Caching strategies for expensive operations
- **Secure**: JWT-based auth, rate limiting, input validation
- **Observable**: Comprehensive logging and monitoring

### Key Technologies

- **API Framework**: FastAPI 0.104+ (async/await support)
- **Database**: PostgreSQL 15+ with JSONB support
- **Cache**: Redis 7+ for sessions and algorithm results
- **Graph Operations**: NetworkX 3.0+ for hypercube algorithms
- **Task Queue**: Celery + Redis for background jobs
- **WebSockets**: FastAPI WebSocket support for real-time updates

### Architecture Principles

1. **Separation of Concerns**: Core algorithms independent of API layer
2. **Dependency Injection**: Service dependencies injected at runtime
3. **Async-First**: Leverage Python async/await for I/O operations
4. **API-First**: OpenAPI specification drives development
5. **Test-Driven**: Unit and integration tests for all services
6. **Observability**: Structured logging, metrics, and tracing

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   React     │  │   cURL/     │  │  WebSocket  │             │
│  │   Frontend  │  │   Postman   │  │   Client    │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          │ HTTPS/WSS      │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Nginx / Traefik / AWS ALB                                │  │
│  │  - TLS Termination                                        │  │
│  │  - Rate Limiting                                          │  │
│  │  - Request Routing                                        │  │
│  │  - Load Balancing                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              FastAPI Application                           │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │   API    │  │ WebSocket│  │  Auth    │  │  Health  │  │ │
│  │  │  Routes  │  │ Handlers │  │Middleware│  │  Checks  │  │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────────┘  │ │
│  │       │             │             │                       │ │
│  │       └─────────────┴─────────────┘                       │ │
│  │                     │                                      │ │
│  │                     ▼                                      │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │           Dependency Injection Container           │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │     FSM      │  │  Algorithm   │  │   Export     │         │
│  │   Service    │  │   Service    │  │   Service    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                  │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐         │
│  │    User      │  │  Category    │  │    Share     │         │
│  │   Service    │  │   Service    │  │   Service    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CORE ALGORITHM LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Gray Code   │  │  Hypercube   │  │  FSM Model   │         │
│  │  Generator   │  │    Graph     │  │  Validator   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Greedy     │  │     BFS      │  │   Global     │         │
│  │  Algorithm   │  │  Algorithm   │  │ Optimization │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Verilog    │  │     VHDL     │  │  Testbench   │         │
│  │  Generator   │  │  Generator   │  │  Generator   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  PostgreSQL  │  │     Redis    │  │    Celery    │         │
│  │   Database   │  │     Cache    │  │  Task Queue  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   SQLAlchemy │  │   Redis-py   │  │    S3/       │         │
│  │      ORM     │  │    Client    │  │ File Storage │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow (Synchronous)

```
Client Request
     │
     ▼
API Gateway (Rate Limiting, Auth)
     │
     ▼
FastAPI Route Handler
     │
     ▼
Request Validation (Pydantic)
     │
     ▼
Service Layer (Business Logic)
     │
     ├─→ Check Cache (Redis)
     │   ├─ Hit → Return cached result
     │   └─ Miss → Continue
     │
     ├─→ Core Algorithm Execution
     │   └─→ NetworkX / NumPy operations
     │
     ├─→ Database Operations (PostgreSQL)
     │   └─→ SQLAlchemy ORM
     │
     └─→ Update Cache
     │
     ▼
Response Serialization (Pydantic)
     │
     ▼
Client Response (JSON)
```

### Request Flow (Async/WebSocket)

```
Client WebSocket Connection
     │
     ▼
WebSocket Handler (FastAPI)
     │
     ▼
Authentication & Authorization
     │
     ▼
Create Background Task (Celery)
     │
     ├─→ Task ID returned immediately
     │
     ├─→ Task executes in background
     │   ├─→ Progress updates via WebSocket
     │   ├─→ Algorithm execution
     │   └─→ Result storage
     │
     └─→ Completion notification
     │
     ▼
Client receives final result
```

---

## Service Boundaries

### Service Organization

The backend is organized into distinct service layers, each with specific responsibilities:

```
grayfsm/
├── api/                    # API Layer (FastAPI routes)
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── fsm.py         # FSM CRUD endpoints
│   │   ├── algorithm.py   # Optimization endpoints
│   │   ├── export.py      # Export endpoints
│   │   ├── user.py        # User management (Phase 4)
│   │   ├── auth.py        # Authentication endpoints
│   │   └── websocket.py   # WebSocket handlers
│   └── deps.py            # Dependency injection
│
├── services/              # Business Logic Layer
│   ├── __init__.py
│   ├── fsm_service.py     # FSM operations
│   ├── algorithm_service.py
│   ├── export_service.py
│   ├── user_service.py
│   ├── cache_service.py
│   └── notification_service.py
│
├── core/                  # Core Algorithms (Framework-independent)
│   ├── algorithms/
│   │   ├── base.py
│   │   ├── greedy.py
│   │   ├── bfs_optimal.py
│   │   ├── global_sa.py
│   │   └── global_ga.py
│   ├── exporters/
│   │   ├── verilog.py
│   │   ├── vhdl.py
│   │   ├── json_exporter.py
│   │   └── testbench.py
│   ├── gray_code.py
│   ├── hypercube.py
│   └── fsm_model.py
│
├── models/                # Database Models (SQLAlchemy)
│   ├── __init__.py
│   ├── fsm.py
│   ├── user.py
│   ├── algorithm_result.py
│   ├── export_cache.py
│   └── category.py
│
├── schemas/               # API Schemas (Pydantic)
│   ├── __init__.py
│   ├── fsm.py
│   ├── algorithm.py
│   ├── export.py
│   ├── user.py
│   └── common.py
│
├── db/                    # Database Configuration
│   ├── __init__.py
│   ├── session.py         # SQLAlchemy session
│   ├── base.py            # Base model
│   └── migrations/        # Alembic migrations
│
├── middleware/            # Custom Middleware
│   ├── __init__.py
│   ├── auth.py
│   ├── logging.py
│   ├── rate_limit.py
│   └── error_handler.py
│
├── utils/                 # Utilities
│   ├── __init__.py
│   ├── security.py        # Password hashing, JWT
│   ├── validators.py
│   ├── exceptions.py
│   └── logger.py
│
├── tasks/                 # Background Tasks (Celery)
│   ├── __init__.py
│   ├── optimization.py
│   └── export.py
│
├── config.py              # Configuration management
├── main.py                # FastAPI application
└── celery_app.py          # Celery configuration
```

### Service Responsibilities

#### 1. FSM Service

**Purpose**: Manage FSM CRUD operations, validation, and persistence

**Responsibilities**:
- Create, read, update, delete FSMs
- Validate FSM structure (states, transitions, outputs)
- Store FSM definitions in database
- Retrieve FSMs with filtering and pagination
- Version management and forking

**Key Methods**:
```python
class FSMService:
    async def create_fsm(self, fsm_data: FSMCreate, user_id: Optional[UUID]) -> FSM
    async def get_fsm(self, fsm_id: UUID) -> FSM
    async def update_fsm(self, fsm_id: UUID, fsm_data: FSMUpdate) -> FSM
    async def delete_fsm(self, fsm_id: UUID) -> None
    async def list_fsms(self, filters: FSMFilters, pagination: Pagination) -> List[FSM]
    async def validate_fsm(self, fsm: FSM) -> ValidationResult
    async def fork_fsm(self, fsm_id: UUID, user_id: UUID) -> FSM
```

#### 2. Algorithm Service

**Purpose**: Execute FSM optimization algorithms and manage results

**Responsibilities**:
- Execute optimization algorithms (greedy, BFS, global)
- Track algorithm execution metrics
- Store optimization results
- Compare algorithm performance
- Handle long-running optimizations via background tasks

**Key Methods**:
```python
class AlgorithmService:
    async def optimize_fsm(
        self,
        fsm_id: UUID,
        algorithm: AlgorithmType,
        options: AlgorithmOptions
    ) -> OptimizationResult

    async def optimize_async(
        self,
        fsm_id: UUID,
        algorithm: AlgorithmType,
        callback_url: Optional[str]
    ) -> str  # Task ID

    async def compare_algorithms(
        self,
        fsm_id: UUID,
        algorithms: List[AlgorithmType]
    ) -> List[AlgorithmResult]

    async def get_optimization_result(self, task_id: str) -> OptimizationResult
```

#### 3. Export Service

**Purpose**: Generate HDL exports and manage export cache

**Responsibilities**:
- Generate Verilog/VHDL code from optimized FSMs
- Generate testbenches
- Cache generated exports
- Manage export templates
- Support custom export parameters

**Key Methods**:
```python
class ExportService:
    async def export_fsm(
        self,
        fsm_id: UUID,
        format: ExportFormat,
        options: ExportOptions
    ) -> str  # Generated code

    async def generate_testbench(
        self,
        fsm_id: UUID,
        language: HDLLanguage
    ) -> str

    async def get_cached_export(
        self,
        fsm_id: UUID,
        format: ExportFormat,
        cache_key: str
    ) -> Optional[str]
```

#### 4. User Service (Phase 4)

**Purpose**: Manage user accounts, authentication, and profiles

**Responsibilities**:
- User registration and authentication
- Profile management
- API key generation and management
- User preferences and settings

**Key Methods**:
```python
class UserService:
    async def create_user(self, user_data: UserCreate) -> User
    async def authenticate_user(self, email: str, password: str) -> User
    async def get_user(self, user_id: UUID) -> User
    async def update_user(self, user_id: UUID, user_data: UserUpdate) -> User
    async def generate_api_key(self, user_id: UUID) -> str
```

#### 5. Cache Service

**Purpose**: Manage Redis caching for performance optimization

**Responsibilities**:
- Cache optimization results
- Cache export artifacts
- Session management
- Rate limiting counters

**Key Methods**:
```python
class CacheService:
    async def get(self, key: str) -> Optional[str]
    async def set(self, key: str, value: str, ttl: int) -> None
    async def delete(self, key: str) -> None
    async def increment(self, key: str, amount: int = 1) -> int
```

---

## API Design

### API Versioning Strategy

**Approach**: URL path versioning (`/api/v1/...`)

**Rationale**:
- Clear and explicit version identification
- Easy to maintain multiple versions simultaneously
- Standard practice in REST APIs

**Example**:
```
/api/v1/fsms          # Version 1
/api/v2/fsms          # Version 2 (future)
```

**Version Lifecycle**:
- v1: Phase 1-3 (current)
- v2: Phase 4+ (community features)
- Deprecation notice: 6 months before removal
- Maintain 2 major versions simultaneously

### RESTful Endpoint Design

All endpoints follow RESTful conventions:

```
Resource: FSMs
GET    /api/v1/fsms              # List all FSMs
POST   /api/v1/fsms              # Create new FSM
GET    /api/v1/fsms/{id}         # Get specific FSM
PUT    /api/v1/fsms/{id}         # Update FSM
PATCH  /api/v1/fsms/{id}         # Partial update
DELETE /api/v1/fsms/{id}         # Delete FSM

Nested Resources:
GET    /api/v1/fsms/{id}/states             # Get FSM states
GET    /api/v1/fsms/{id}/transitions        # Get FSM transitions
POST   /api/v1/fsms/{id}/optimize           # Optimize FSM
GET    /api/v1/fsms/{id}/results            # Get optimization results
POST   /api/v1/fsms/{id}/export             # Export FSM
GET    /api/v1/fsms/{id}/export/{format}    # Get cached export
```

### Standard Response Format

All API responses follow a consistent structure:

**Success Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "Traffic Light",
    ...
  },
  "metadata": {
    "timestamp": "2025-11-29T12:00:00Z",
    "version": "1.0",
    "request_id": "req-uuid"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "FSM_NOT_FOUND",
    "message": "FSM with ID 'xyz' not found",
    "details": {
      "fsm_id": "xyz",
      "timestamp": "2025-11-29T12:00:00Z"
    },
    "request_id": "req-uuid"
  }
}
```

**Pagination Response**:
```json
{
  "success": true,
  "data": [
    {"id": "1", ...},
    {"id": "2", ...}
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_items": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  },
  "metadata": {
    "timestamp": "2025-11-29T12:00:00Z"
  }
}
```

### HTTP Status Codes

Standard HTTP status codes used throughout the API:

```
200 OK                    # Successful GET/PUT/PATCH
201 Created               # Successful POST
202 Accepted              # Async operation started
204 No Content            # Successful DELETE
400 Bad Request           # Invalid input
401 Unauthorized          # Missing/invalid authentication
403 Forbidden             # Insufficient permissions
404 Not Found             # Resource doesn't exist
409 Conflict              # Resource conflict (duplicate)
422 Unprocessable Entity  # Validation error
429 Too Many Requests     # Rate limit exceeded
500 Internal Server Error # Server error
503 Service Unavailable   # Temporary unavailability
```

---

*Continued in next section...*
