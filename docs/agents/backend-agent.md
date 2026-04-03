# Backend Agent

> Read `agents/memory.md` first for full project context.

## Mission
Implement the stubbed API endpoints: optimization, export, categories, and examples. Wire the working core algorithms into usable services.

---

## Owned Files

### CREATE (new files)
- `backend/app/services/optimization_service.py` — Orchestrates FSM optimization
- `backend/app/services/export_service.py` — Generates HDL/JSON exports
- `backend/app/services/category_service.py` — Category CRUD
- `backend/app/services/example_service.py` — Loads example FSMs from JSON files
- `backend/app/core/algorithms/__init__.py` — Algorithm registry (map name -> class)
- `backend/app/core/exporters/verilog.py` — Verilog HDL code generator
- `backend/app/core/exporters/vhdl.py` — VHDL code generator
- `backend/app/core/exporters/json_exporter.py` — Clean JSON export
- `backend/app/core/exporters/__init__.py` — Exporter registry

### REWRITE (replace stubs)
- `backend/app/api/v1/algorithm.py` — Wire to OptimizationService
- `backend/app/api/v1/export.py` — Wire to ExportService
- `backend/app/api/v1/category.py` — Wire to CategoryService
- `backend/app/api/v1/example.py` — Wire to ExampleService

### EXTEND (add methods)
- `backend/app/services/fsm_service.py` — Add `get_fsm_with_definition()` for optimization input

## DO NOT Touch
- `backend/app/main.py` — Owned by devops-agent + security-agent
- `backend/app/middleware/*` — Owned by security-agent
- `backend/app/db/*` — Owned by database-agent
- `backend/app/core/gray_code.py` — Working, read-only
- `backend/app/core/hypercube.py` — Working, read-only
- `backend/app/core/fsm_model.py` — Working, read-only
- `backend/app/core/algorithms/greedy.py` — Working, read-only (import and USE it)
- `backend/app/core/algorithms/bfs_optimal.py` — Working, read-only (import and USE it)
- `backend/app/models/*` — Working, read-only
- `backend/app/schemas/*` — Working, read-only (frozen contract)

---

## Current Status

| Endpoint | Status | What's There Now |
|----------|--------|-----------------|
| `POST /fsms/{id}/optimize` | 501 | `raise HTTPException(status_code=501, detail="Not implemented")` |
| `POST /fsms/{id}/export` | stub | Returns `{"message": "Export not yet implemented"}` |
| `GET /categories` | empty | Returns `{"data": []}` |
| `GET /examples` | empty | Returns `{"data": []}` |

The core algorithms **work**. `GreedyOptimizer` and `BFSOptimizer` accept FSM data and return optimized results. The gap is the service layer connecting endpoints to algorithms.

---

## Tasks (Priority Order)

### Task 1: OptimizationService + Wire Endpoint
Create `backend/app/services/optimization_service.py`:
```python
# Pattern to follow:
# 1. Load FSM from DB (get definition JSONB field)
# 2. Parse definition into algorithm input format
# 3. Instantiate GreedyOptimizer or BFSOptimizer based on request.algorithm
# 4. Run optimizer.optimize()
# 5. Create new FSM record with optimized definition (is_optimized=True)
# 6. Create AlgorithmResult record with metrics
# 7. Return OptimizationResponse
```

Key imports you'll need:
```python
from app.core.algorithms.greedy import GreedyOptimizer
from app.core.algorithms.bfs_optimal import BFSOptimizer
from app.core.gray_code import generate_gray_codes, hamming_distance
from app.core.hypercube import HypercubeGraph
from app.models.fsm import FSM, AlgorithmResult
from app.schemas.fsm import OptimizationRequest, OptimizationResponse
```

### Task 2: Algorithm Registry
Create `backend/app/core/algorithms/__init__.py`:
```python
ALGORITHM_REGISTRY = {
    "greedy": GreedyOptimizer,
    "bfs_optimal": BFSOptimizer,
}

def get_algorithm(name: str):
    if name not in ALGORITHM_REGISTRY:
        raise AlgorithmException(f"Unknown algorithm: {name}")
    return ALGORITHM_REGISTRY[name]
```

### Task 3: Export Service + Verilog/VHDL Generators
Create exporters that generate synthesizable HDL from optimized FSMs:
- Verilog: Standard `always @(posedge clk)` state machine template
- VHDL: Standard `process(clk)` state machine template
- JSON: Clean export of FSM definition

### Task 4: Category & Example Services
- `CategoryService`: Query categories table, return list
- `ExampleService`: Load JSON files from `backend/examples/`, return as FSMResponse list

---

## Service Pattern to Follow

From the working `fsm_service.py`:
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.fsm import FSM
from app.utils.logger import get_logger

logger = get_logger(__name__)

class FSMService:
    @staticmethod
    async def create_fsm(db: AsyncSession, fsm_data: FSMCreate) -> FSM:
        fsm = FSM(
            name=fsm_data.name,
            # ... map fields
        )
        db.add(fsm)
        await db.commit()
        await db.refresh(fsm)
        return fsm
```

## Endpoint Pattern to Follow

From the working `fsm.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db

router = APIRouter()

@router.post("/{fsm_id}/optimize")
async def optimize_fsm(
    fsm_id: UUID,
    request: OptimizationRequest,
    db: AsyncSession = Depends(get_db)
):
    # Call service, return response
```

---

## Interfaces

- **testing-agent** will write tests against your endpoints. Follow the existing schema contracts exactly.
- **frontend-agent** consumes your API. The `OptimizationResponse` and `ExportResponse` schemas are the contract.
- **database-agent** seeds categories and examples. Your CategoryService/ExampleService should query the DB, not hardcode data.
