# GrayFSM

**Automated Finite State Machine Optimization using Gray Code Encoding**

![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776ab?logo=python&logoColor=white)
![React 18](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?logo=fastapi&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169e1?logo=postgresql&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

GrayFSM is a full-stack web application that optimizes hardware Finite State Machines by applying Gray code encoding. It finds and inserts minimum-cost dummy states along hypercube shortest paths, ensuring every state transition changes only a single bit — eliminating glitches and race conditions in digital circuits.

---

## Screenshots

<p align="center">
  <img src="docs/screenshots/home.png" alt="Home Page" width="800" />
</p>
<p align="center"><em>Home page with hero section and FSM dashboard</em></p>

<p align="center">
  <img src="docs/screenshots/editor.png" alt="FSM Editor" width="800" />
</p>
<p align="center"><em>Interactive FSM editor with drag-and-drop canvas</em></p>

<p align="center">
  <img src="docs/screenshots/about.png" alt="About Page" width="800" />
</p>
<p align="center"><em>Algorithm documentation and technology overview</em></p>

---

## Features

- **Visual FSM Editor** — Drag-and-drop state machine designer built on ReactFlow with real-time transition wiring
- **Gray Code Optimization** — Greedy and BFS algorithms that assign optimal Gray code encodings to minimize Hamming distance
- **Hypercube Pathfinding** — Automatic dummy state insertion along n-dimensional hypercube shortest paths (NetworkX)
- **HDL Export** — Generate synthesizable Verilog, VHDL, testbenches, JSON, and CSV output
- **Example Library** — Pre-built FSMs: Traffic Light, Elevator Controller, Sequence Detector, Vending Machine
- **Optimization Metrics** — Hamming distance analysis, improvement percentages, execution time tracking
- **Background Execution** — FastAPI background tasks with in-memory status polling for long-running optimizations
- **Full Observability** — Prometheus metrics, Grafana dashboards, Jaeger distributed tracing

---

## How It Works

GrayFSM solves a fundamental hardware design problem: when an FSM transitions between states whose binary encodings differ by more than one bit, intermediate values can cause **glitches** — momentary incorrect outputs that propagate through combinational logic.

### The Algorithm

```
1. ENCODE    Assign Gray codes to FSM states
             (adjacent codes differ by exactly 1 bit)

2. ANALYZE   Build an n-dimensional hypercube graph
             where edges connect encodings differing by 1 bit

3. OPTIMIZE  For each transition with Hamming distance > 1:
             → Find shortest path through the hypercube
             → Insert dummy states at each intermediate encoding
             → Result: every transition flips exactly 1 bit
```

**Example:** A transition from state `000` to `111` (Hamming distance = 3) gets broken into:
```
000 → 001 → 011 → 111
      ^^^   ^^^
      dummy states inserted
```

### Algorithms Available

| Algorithm | Complexity | Best For |
|-----------|-----------|----------|
| **Greedy** | O(T log N) | Fast results, large FSMs |
| **BFS-Optimal** | O(T N) | Minimum dummy states, encoding reuse |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    Frontend                      │
│  React 18 · TypeScript · Tailwind · ReactFlow   │
│  Zustand · React Query · Recharts · Three.js    │
└──────────────────────┬──────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────┐
│                   Backend                        │
│  FastAPI · SQLAlchemy (async) · NetworkX         │
│  Pydantic · Alembic · BackgroundTasks            │
├──────────────────────┬──────────────────────────┤
│      PostgreSQL      │           Redis           │
│       (storage)      │          (cache)          │
└──────────────────────┴──────────────────────────┘
```

---

## Quick Start

### Option 1: Docker Compose (recommended)

```bash
cd infrastructure/docker
docker compose up -d
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 |

### Option 2: Manual Development Setup

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL + Redis (via Docker)
docker run -d --name grayfsm-pg -e POSTGRES_USER=grayfsm -e POSTGRES_PASSWORD=password -e POSTGRES_DB=grayfsm -p 5432:5432 postgres:15-alpine
docker run -d --name grayfsm-redis -p 6379:6379 redis:7-alpine

# Configure environment (REQUIRED — config defaults are runtime-rejected placeholders)
cp .env.example .env

# Run server
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev    # → http://localhost:3000
```

---

## Project Structure

```
grayFSM/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/v1/          # REST endpoints (FSM, optimize, export, health)
│   │   ├── core/            # Gray code, hypercube, optimization algorithms
│   │   ├── models/          # SQLAlchemy ORM (FSM, Category, AlgorithmResult)
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── services/        # Business logic layer
│   │   ├── middleware/      # Logging, rate limiting, error handling
│   │   └── main.py          # Application entry point
│   ├── examples/            # Example FSM JSON files
│   └── tests/               # Unit + integration tests
├── frontend/                # React application
│   ├── src/
│   │   ├── pages/           # Home, Editor, Optimization, Export, Gallery, About
│   │   ├── components/      # FSM canvas, forms, visualization, UI kit
│   │   ├── store/           # Zustand state management
│   │   ├── hooks/           # Custom React hooks
│   │   └── api/             # Axios API client
│   └── package.json
├── database/                # Schema, migrations, seed queries
├── infrastructure/          # Docker Compose, Kubernetes, monitoring
├── e2e/                     # Playwright end-to-end tests
├── tests/                   # Integration, contract, and load tests
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript 5, Tailwind CSS 3, ReactFlow, Zustand, React Query, Recharts, Three.js, Framer Motion |
| **Backend** | FastAPI, Python 3.10+, SQLAlchemy (async), NetworkX, Pydantic |
| **Database** | PostgreSQL 15, Redis 7 |
| **Infrastructure** | Docker Compose, Kubernetes, GitHub Actions CI/CD |
| **Observability** | Prometheus, Grafana, Jaeger |
| **Testing** | Pytest, Vitest, React Testing Library, Playwright |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/fsms` | Create a new FSM |
| `GET` | `/api/v1/fsms` | List FSMs (paginated, filterable) |
| `GET` | `/api/v1/fsms/:id` | Get FSM by ID |
| `DELETE` | `/api/v1/fsms/:id` | Delete FSM |
| `POST` | `/api/v1/fsms/:id/optimize` | Run optimization algorithm |
| `POST` | `/api/v1/fsms/:id/export` | Export to Verilog/VHDL/JSON/CSV |
| `GET` | `/api/v1/algorithms` | List available algorithms |
| `GET` | `/api/v1/examples` | List example FSMs |
| `GET` | `/api/v1/categories` | List FSM categories |
| `GET` | `/api/v1/health` | Health check |

Full interactive docs available at `/docs` when running the backend.

---

## Core Algorithm Files

| File | Purpose |
|------|---------|
| `backend/app/core/gray_code.py` | Gray code encoding/decoding, Hamming distance |
| `backend/app/core/hypercube.py` | N-dimensional hypercube graph, shortest paths |
| `backend/app/core/algorithms/greedy.py` | Greedy optimizer — fast local optimization |
| `backend/app/core/algorithms/bfs_optimal.py` | BFS optimizer — global minimum with encoding reuse |
| `backend/app/core/fsm_model.py` | FSM validation, reachability analysis |
| `backend/app/core/exporters/` | Verilog, VHDL, JSON export formatters |

---

## Running Tests

```bash
# Backend unit tests
cd backend && source venv/bin/activate
pytest tests/ -v

# Frontend tests
cd frontend
npm test

# E2E tests (requires running app)
cd e2e
npx playwright install --with-deps
npm test
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide: local setup, code style, branching conventions, test layout, and security disclosure.

Quick start for an experienced contributor:

1. Fork → branch (`feat/`, `fix/`, `chore/`, etc.) → `cp backend/.env.example backend/.env`.
2. `pip install pre-commit && pre-commit install` *(mandatory — sets up gitleaks + ruff + prettier hooks).*
3. Make your changes, add tests, ensure `ruff check`, `mypy`, `tsc --noEmit`, and the relevant pytest/vitest suite all pass.
4. Submit one PR per concern; squash-merge is default.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
