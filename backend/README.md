# GrayFSM Backend Service

FastAPI-based backend for GrayFSM - Automated Finite State Machine Optimization using Gray Code Encoding.

## Features

- **FSM Management**: Create, read, update, delete finite state machines
- **Optimization Algorithms**: 
  - Greedy dummy state insertion
  - BFS-optimized algorithm
  - Global optimization: Simulated Annealing (`global_sa`) and Genetic Algorithm (`global_ga`)
- **HDL Export**: Verilog, VHDL, JSON, CSV, and testbench generation

## Technology Stack

- **Framework**: FastAPI 0.104+
- **Database**: PostgreSQL 15+ with async support (SQLAlchemy)
- **Cache**: Redis 7+
- **Graph Operations**: NetworkX 3.0+
- **Task Queue**: Celery + Redis

## Quick Start

### Prerequisites

- Python 3.10+
- PostgreSQL 15+
- Redis 7+

### Installation

1. **Clone the repository**
```bash
cd <repo-root>/backend
```

2. **Create virtual environment**
```bash
python3 -m venv venv
source venv/bin/activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Set up environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Initialize database**
```bash
# Create database
createdb grayfsm

# Apply Alembic migrations (canonical setup)
alembic upgrade head

# Optional: docs/database-schema.sql is a reference snapshot only;
# Alembic migrations are the authoritative source of truth.
```

6. **Start Redis**
```bash
redis-server
```

7. **Run the application**
```bash
uvicorn app.main:app --reload --port 8000
```

8. **Access API documentation**
```
http://localhost:8000/docs
```

## Project Structure

```
backend/
├── app/
│   ├── api/v1/          # API endpoints
│   ├── core/            # Core algorithms
│   │   ├── algorithms/  # Optimization algorithms
│   │   ├── exporters/   # HDL exporters
│   │   ├── gray_code.py # Gray code utilities
│   │   ├── hypercube.py # Hypercube graph operations
│   │   └── fsm_model.py # FSM validation
│   ├── db/              # Database configuration
│   ├── middleware/      # Custom middleware
│   ├── models/          # SQLAlchemy ORM models
│   ├── schemas/         # Pydantic schemas
│   ├── services/        # Business logic layer
│   ├── tasks/           # Background tasks (Celery)
│   ├── utils/           # Utilities
│   ├── config.py        # Configuration
│   └── main.py          # Application entry point
├── tests/               # Test suite
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## API Endpoints

### Health Check
- `GET /api/v1/health` - System health status
- `GET /metrics` - Prometheus scrape endpoint (registered at root by observability setup)

### FSM Management
- `GET /api/v1/fsms` - List all FSMs
- `POST /api/v1/fsms` - Create new FSM
- `GET /api/v1/fsms/{id}` - Get FSM details
- `PUT /api/v1/fsms/{id}` - Update FSM
- `DELETE /api/v1/fsms/{id}` - Delete FSM

### Optimization
- `POST /api/v1/fsms/{id}/optimize` - Optimize FSM
- `GET /api/v1/fsms/{id}/results` - Get optimization results

### Export
- `POST /api/v1/fsms/{id}/export` - Export FSM to HDL

### Categories & Examples
- `GET /api/v1/categories` - List categories
- `GET /api/v1/examples` - List example FSMs

## Development

### Running Tests
```bash
pytest tests/ -v --cov=app
```

### Code Formatting
```bash
# Lint and auto-fix (ruff replaces black + isort)
ruff check --fix app
ruff format app
```

### Type Checking
```bash
mypy app/
```

## Configuration

Key environment variables (see `.env.example`):

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `SECRET_KEY`: JWT secret key (Phase 4)
- `CORS_ORIGINS`: Allowed CORS origins
- `RATE_LIMIT_ANONYMOUS`: Rate limit for anonymous users

## Implementation Status

### ✓ Completed (Phase 1 - MVP)
- Project structure and configuration
- FastAPI application setup
- Database models and migrations
- Core algorithms (Gray code, hypercube, FSM validation)
- FSM CRUD endpoints
- Basic optimization algorithms (Greedy, BFS)
- Middleware (logging, error handling)
- API documentation

### 🚧 In Progress
- Comprehensive test suite expansion

### 📋 Planned
- Community features (sharing, comments, ratings)
- ML-based encoding prediction

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: https://github.com/grayfsm/issues
- Documentation: http://localhost:8000/docs
- Email: support@grayfsm.com
