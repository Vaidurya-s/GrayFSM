# GrayFSM Project Memory (Shared Agent Context)

> Every agent MUST read this file first. It contains the ground truth about the project.

---

## Project Overview

**GrayFSM** is a full-stack web application for optimizing Finite State Machines (FSMs) using Gray code encoding. It minimizes glitches and race conditions in hardware FSM implementations by ensuring adjacent state transitions differ by only one bit, inserting dummy states along hypercube shortest paths where needed.

**Repository**: https://github.com/Vaidurya-s/GrayFSM.git
**Branch**: main

---

## Architecture

```
                 +-----------+       +----------------+       +-----------+
  Browser  --->  |  React    | ----> |  FastAPI       | ----> | PostgreSQL|
  :5173          |  Frontend |  API  |  Backend :9000 |  ORM  |  DB :5434 |
                 +-----------+       +----------------+       +-----------+
                                            |
                                     +------+------+
                                     | Core Engine |
                                     | gray_code   |
                                     | hypercube   |
                                     | algorithms  |
                                     +-------------+
```

| Layer      | Tech                                        | Port  |
|------------|---------------------------------------------|-------|
| Frontend   | React 18 + TypeScript 5.3 + Vite 5         | 5173  |
| Backend    | FastAPI + Python 3.10+ + async SQLAlchemy   | 9000  |
| Database   | PostgreSQL 15 (Docker) + Alembic migrations | 5434  |
| Cache      | Redis 7 (planned, not wired)                | 6379  |
| Task Queue | Celery (planned, not wired)                 | -     |

---

## Directory Structure

```
/home/arunupscee/Music/grayFSM/
├── agents/                  # Agent context files (THIS DIRECTORY)
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py          # App entry point, middleware, routers
│   │   ├── config.py        # Pydantic Settings (env vars)
│   │   ├── api/v1/          # REST endpoints
│   │   │   ├── fsm.py       # FSM CRUD (WORKING)
│   │   │   ├── algorithm.py # Optimize endpoint (501 STUB)
│   │   │   ├── export.py    # Export endpoint (STUB)
│   │   │   ├── category.py  # Categories (RETURNS EMPTY)
│   │   │   ├── example.py   # Examples (RETURNS EMPTY)
│   │   │   └── health.py    # Health check (WORKING)
│   │   ├── core/            # Framework-agnostic algorithms
│   │   │   ├── gray_code.py     # Gray code utilities (WORKING)
│   │   │   ├── hypercube.py     # N-dim hypercube graph (WORKING)
│   │   │   ├── fsm_model.py     # FSM validation (WORKING)
│   │   │   └── algorithms/
│   │   │       ├── greedy.py       # Greedy optimizer (WORKING)
│   │   │       └── bfs_optimal.py  # BFS optimizer (WORKING)
│   │   ├── models/fsm.py   # SQLAlchemy ORM: Category, FSM, AlgorithmResult
│   │   ├── schemas/fsm.py  # Pydantic: FSMCreate, FSMResponse, OptimizationRequest/Response
│   │   ├── services/fsm_service.py  # FSM CRUD service (WORKING)
│   │   ├── middleware/      # error_handler, logging, rate_limit (rate_limit is NO-OP)
│   │   ├── db/session.py   # Async SQLAlchemy engine + session factory
│   │   └── utils/           # logger, exceptions
│   ├── examples/            # Example FSM JSON files
│   │   ├── elevator.json
│   │   ├── sequence_detector.json
│   │   ├── traffic_light.json
│   │   └── vending_machine.json
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Router (only 2 routes wired: / and *)
│   │   ├── main.tsx         # Entry point with QueryClientProvider
│   │   ├── pages/           # HomePage (WORKING), NotFoundPage
│   │   ├── api/             # Axios client + endpoint modules (COMPLETE)
│   │   │   ├── client.ts    # Axios instance, interceptors
│   │   │   └── endpoints/   # fsms.ts, algorithms.ts, export.ts, examples.ts
│   │   ├── types/           # TypeScript types (COMPLETE)
│   │   │   ├── fsm.ts       # FSM, Transition, OptimizationRequest/Response, ExportFormat
│   │   │   └── api.ts       # APIResponse, PaginatedResponse
│   │   ├── config/
│   │   │   ├── constants.ts # API_BASE_URL, SUPPORTED_ALGORITHMS, EXPORT_FORMATS
│   │   │   └── routes.ts    # 10 routes defined (only 2 wired)
│   │   ├── components/      # MOSTLY EMPTY - forms/, fsm/, visualization/ dirs exist but empty
│   │   ├── store/           # EMPTY - Zustand stores not created
│   │   ├── hooks/           # EMPTY - Custom hooks not created
│   │   ├── utils/
│   │   │   ├── gray-code/   # Client-side gray code utils
│   │   │   └── cn.ts        # Tailwind class utility
│   │   └── styles/globals.css
│   ├── package.json
│   └── vite.config.ts
├── database/                # PostgreSQL Docker setup + Alembic
├── tests/                   # Integration + contract + load tests (STUBS)
├── e2e/                     # Playwright E2E tests (STUBS)
├── security/                # Security audit + pre-written fixes
│   ├── fixes/               # 01_auth, 02_validation, 03_rate_limit, 04_csrf
│   └── configs/             # security_headers, cors_config, secure_cookies
├── observability/           # Prometheus/Grafana/Jaeger/Loki configs
│   └── backend/             # telemetry.py, metrics.py, logging_config.py (NOT IMPORTED)
├── performance/             # Optimization guides + SQL scripts
│   └── database/            # performance_indexes.sql, query_optimization.sql
├── infrastructure/          # Docker, K8s, CI/CD configs
└── [38 markdown docs]       # Comprehensive documentation
```

---

## Database Schema

### Table: `categories`
| Column             | Type      | Notes                    |
|--------------------|-----------|--------------------------|
| id                 | UUID (PK) | Default gen_random_uuid  |
| name               | VARCHAR   | NOT NULL, UNIQUE         |
| slug               | VARCHAR   | NOT NULL, UNIQUE         |
| description        | TEXT      |                          |
| parent_category_id | UUID (FK) | Self-referential         |
| level              | INT       | Default 0                |
| display_order      | INT       | Default 0                |
| fsm_count          | INT       | Default 0                |
| created_at         | TIMESTAMP | Auto                     |
| updated_at         | TIMESTAMP | Auto                     |

### Table: `fsms`
| Column                 | Type         | Notes                             |
|------------------------|--------------|-----------------------------------|
| id                     | UUID (PK)    |                                   |
| name                   | VARCHAR(255) | NOT NULL                          |
| description            | TEXT         |                                   |
| fsm_type               | VARCHAR(10)  | 'moore' or 'mealy'                |
| definition             | JSONB        | Full FSM structure                |
| state_count            | INT          |                                   |
| transition_count       | INT          |                                   |
| initial_state          | VARCHAR      |                                   |
| bit_width              | INT          | Calculated via ceil(log2(states)) |
| encoding_type          | VARCHAR      | Default 'gray'                    |
| category_id            | UUID (FK)    | -> categories.id                  |
| tags                   | TEXT[]       |                                   |
| created_by             | UUID         | Nullable (no user model yet)      |
| visibility             | VARCHAR      | private/public/unlisted           |
| is_optimized           | BOOL         | Default false                     |
| optimization_algorithm | VARCHAR      |                                   |
| dummy_state_count      | INT          | Default 0                         |
| avg_hamming_distance   | FLOAT        |                                   |
| view_count             | INT          | Default 0                         |
| fork_count             | INT          | Default 0                         |
| export_count           | INT          | Default 0                         |
| created_at / updated_at| TIMESTAMP    |                                   |

### Table: `algorithm_results`
| Column                | Type      | Notes                 |
|-----------------------|-----------|-----------------------|
| id                    | UUID (PK) |                       |
| original_fsm_id       | UUID (FK) | -> fsms.id            |
| optimized_fsm_id      | UUID (FK) | -> fsms.id (nullable) |
| algorithm             | VARCHAR   | greedy/bfs_optimal/.. |
| algorithm_version     | VARCHAR   |                       |
| algorithm_parameters  | JSONB     |                       |
| dummy_states_added    | INT       |                       |
| total_states_final    | INT       |                       |
| avg_hamming_before    | FLOAT     |                       |
| avg_hamming_after     | FLOAT     |                       |
| improvement_percentage| FLOAT     |                       |
| execution_time_ms     | INT       |                       |
| memory_used_mb        | FLOAT     |                       |
| success               | BOOL      |                       |
| error_message         | TEXT      |                       |
| executed_at           | TIMESTAMP |                       |

---

## API Contracts

### Endpoints

| Method | Path                          | Status      | Request Body          | Response Body          |
|--------|-------------------------------|-------------|-----------------------|------------------------|
| GET    | /api/v1/health                | WORKING     | -                     | { status, db, version }|
| POST   | /api/v1/fsms                  | WORKING     | FSMCreate             | FSMResponse            |
| GET    | /api/v1/fsms                  | WORKING     | ?skip=0&limit=10      | FSMResponse[]          |
| GET    | /api/v1/fsms/{id}             | WORKING     | -                     | FSMResponse            |
| DELETE | /api/v1/fsms/{id}             | WORKING     | -                     | { success: true }      |
| POST   | /api/v1/fsms/{id}/optimize    | **501 STUB**| OptimizationRequest   | OptimizationResponse   |
| POST   | /api/v1/fsms/{id}/export      | **STUB**    | ExportRequest         | ExportResponse         |
| GET    | /api/v1/categories            | **EMPTY**   | -                     | Category[]             |
| GET    | /api/v1/examples              | **EMPTY**   | -                     | FSMResponse[]          |

### Pydantic Schemas (backend/app/schemas/fsm.py)

```python
class FSMCreate(BaseModel):
    name: str                          # min_length=1, max_length=255
    description: Optional[str]
    fsm_type: str                      # "moore" | "mealy"
    states: List[str]                  # min_length=1
    initial_state: str                 # Must be in states
    transitions: List[Dict[str, Any]]
    outputs: Optional[Dict[str, str]]
    category_id: Optional[UUID]
    tags: Optional[List[str]]
    visibility: str = "private"        # "private" | "public" | "unlisted"

class OptimizationRequest(BaseModel):
    algorithm: str          # "greedy" | "bfs_optimal" | "global_sa" | "global_ga"
    options: Optional[Dict[str, Any]] = {}
    async_mode: bool = False

class OptimizationResponse(BaseModel):
    optimized_fsm_id: UUID
    algorithm: str
    execution_time_ms: int
    dummy_states_added: int
    total_states: int
    improvement_percentage: float
```

### TypeScript Types (frontend/src/types/fsm.ts)

```typescript
interface OptimizationRequest {
  algorithm: 'greedy' | 'bfs' | 'global' | 'simulated_annealing';
  options?: { timeout_ms?: number; iterations?: number; temperature?: number; cooling_rate?: number; };
}

interface OptimizationResponse {
  original_fsm: FSM;
  optimized_fsm: OptimizedFSM;
  algorithm_result: AlgorithmResult;
  dummy_states_added: number;
  optimization_steps?: any[];
}

interface ExportFormat {
  format: 'verilog' | 'vhdl' | 'json' | 'csv' | 'testbench';
  options?: { module_name?: string; include_comments?: boolean; style?: 'standard' | 'compact' | 'verbose'; };
}

interface ExportResponse {
  format: string;
  content: string;
  file_name: string;
}
```

---

## Coding Conventions

### Backend (Python)
- **Async everywhere**: All DB operations use `async/await`
- **Dependency injection**: `Depends(get_db)` for database sessions
- **Logging**: `from app.utils.logger import get_logger; logger = get_logger(__name__)`
- **Exceptions**: Use custom exceptions from `app.utils.exceptions`
- **Imports**: Absolute (`app.xxx`), never relative
- **Service pattern**: Endpoints call services, services call DB/core
- **Response format**: `{"success": True, "data": {...}, "metadata": {...}}`

### Frontend (TypeScript/React)
- **Functional components** only, no class components
- **React Query** for server state (`useQuery`, `useMutation`)
- **Zustand** for client state (planned)
- **Tailwind CSS** for all styling, use `cn()` utility for conditional classes
- **API calls**: Use pre-built endpoint modules in `src/api/endpoints/`
- **Routing**: Use `ROUTES` constants from `config/routes.ts`
- **Types**: Import from `src/types/` — never use `any` where a type exists

### Naming
- Python: `snake_case` (functions, variables, files)
- TypeScript: `camelCase` (variables, functions), `PascalCase` (components, types, interfaces)
- Files: `snake_case.py` (Python), `PascalCase.tsx` (components), `camelCase.ts` (utilities)

### Error Handling
- Backend: Raise `GrayFSMException` subclasses, caught by `error_handler_middleware`
- Frontend: React Query `onError` callbacks, error boundaries for pages

---

## Installed But Unused Dependencies

### Backend
- `networkx` — used by hypercube.py but NOT by any service/endpoint
- `celery`, `redis` — imported nowhere
- `opentelemetry-*` — in requirements but not initialized

### Frontend
- `reactflow` 11.10 — installed, not imported in any component
- `three`, `@react-three/fiber`, `@react-three/drei` — installed, empty visualization dir
- `recharts` 2.10 — installed, not imported
- `zustand` 4.4 — installed, empty store dir
- `framer-motion` 10.16 — installed, not imported
- `react-hook-form` + `zod` — installed, no form components

---

## Configuration Reference

### Backend Config (backend/app/config.py)
```
app_name = "GrayFSM API"
port = 8000 (default, overridden to 9000 by .env)
database_url = postgresql+asyncpg://grayfsm:password@localhost:5434/grayfsm
redis_url = redis://localhost:6379/0
cors_origins = ["*"]
rate_limit_enabled = True
default_algorithm = "greedy"
algorithm_timeout_ms = 30000
max_fsm_states = 256
```

### Frontend Config (frontend/src/config/constants.ts)
```
API_BASE_URL = VITE_API_BASE_URL || "http://localhost:9000/api/v1"
SUPPORTED_ALGORITHMS = ['greedy', 'bfs', 'simulated_annealing', 'global']
EXPORT_FORMATS = ['verilog', 'vhdl', 'json', 'csv', 'testbench']
```

### Frontend Routes (frontend/src/config/routes.ts)
```
HOME: '/'                    # WIRED
EDITOR: '/editor'            # NOT WIRED
EDITOR_NEW: '/editor/new'    # NOT WIRED
EDITOR_EDIT: '/editor/:id'   # NOT WIRED
OPTIMIZE: '/optimize/:id'    # NOT WIRED
GALLERY: '/gallery'          # NOT WIRED
EXAMPLES: '/examples'        # NOT WIRED
LEARN: '/learn'              # NOT WIRED
ABOUT: '/about'              # NOT WIRED
NOT_FOUND: '*'               # WIRED
```

---

## Example FSM Data (backend/examples/)

Four example FSMs available for seeding:
- `elevator.json` — Elevator controller (Control Systems)
- `sequence_detector.json` — 101 sequence detector (Sequence Detectors)
- `traffic_light.json` — Traffic light controller (Control Systems)
- `vending_machine.json` — Vending machine (Digital Logic)

---

## Agent Coordination Rules

1. **File ownership**: Each agent has declared file ownership in its MD file. Do NOT modify files owned by another agent.
2. **Shared conflict zone**: `backend/app/main.py` is touched by security-agent (middleware) and devops-agent (observability). Each works in its own worktree.
3. **API contracts are frozen**: Do not change the Pydantic schemas or TypeScript types unless you document the change in this file.
4. **Database schema is frozen**: Do not alter ORM models without documenting here. Add new tables via Alembic migrations only.
5. **Test against working endpoints**: FSM CRUD and health endpoints are the integration test baseline.
