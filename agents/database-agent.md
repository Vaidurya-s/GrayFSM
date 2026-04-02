# Database Agent

> Read `agents/memory.md` first for full project context.

## Mission
Ensure the database has proper seed data (categories and example FSMs), apply performance indexes, and optimize the connection pool. The schema already exists — you're filling it with data and tuning it.

---

## Owned Files

### CREATE (new files)
- `backend/alembic/versions/XXXX_seed_categories_and_examples.py` — Alembic migration to insert seed data
- `database/init/04_performance_indexes.sql` — Consolidated performance indexes

### MODIFY
- `backend/app/db/session.py` — Apply connection pool optimizations
- `database/init/03_seed_data.sql` — Update with correct seed data

### REFERENCE (read-only, apply from)
- `performance/database/01_performance_indexes.sql` — Index definitions to apply
- `performance/database/02_query_optimization.sql` — Query optimizations
- `performance/database/03_connection_pool_config.py` — Pool settings
- `backend/examples/elevator.json` — Example FSM data
- `backend/examples/sequence_detector.json` — Example FSM data
- `backend/examples/traffic_light.json` — Example FSM data
- `backend/examples/vending_machine.json` — Example FSM data

## DO NOT Touch
- `backend/app/api/*` — Owned by backend-agent
- `backend/app/services/*` — Owned by backend-agent
- `backend/app/main.py` — Owned by devops-agent + security-agent
- `backend/app/middleware/*` — Owned by security-agent
- `frontend/*` — Owned by frontend-agent
- `backend/app/models/fsm.py` — Schema is frozen; if you need changes, document in memory.md

---

## Current Status

### Database:
- PostgreSQL 15 running in Docker on port 5434
- Connection: `postgresql+asyncpg://grayfsm:password@localhost:5434/grayfsm`
- Schema has 3 tables: `categories`, `fsms`, `algorithm_results`
- One migration exists: `5c754bee004e_initial_migration.py`
- **No seed data** — categories table is empty, no example FSMs loaded

### Performance:
- `performance/database/01_performance_indexes.sql` — Defines indexes for common queries (NOT APPLIED)
- `performance/database/02_query_optimization.sql` — Query optimization patterns
- `performance/database/03_connection_pool_config.py` — Pool size recommendations

### Connection Pool (current in session.py):
- pool_size=20, max_overflow=10
- May need tuning based on performance/database/03_connection_pool_config.py

---

## Tasks (Priority Order)

### Task 1: Read Example FSM Files
Read all 4 JSON files in `backend/examples/` to understand the data structure:
- `backend/examples/elevator.json`
- `backend/examples/sequence_detector.json`
- `backend/examples/traffic_light.json`
- `backend/examples/vending_machine.json`

### Task 2: Create Seed Data Migration
Create a new Alembic migration that inserts:

**Categories:**
| name                    | slug                    | description                                      |
|-------------------------|-------------------------|--------------------------------------------------|
| Digital Logic           | digital-logic           | Basic digital logic FSM designs                   |
| Communication Protocols | communication-protocols | Protocol state machines (UART, SPI, I2C, etc.)    |
| Control Systems         | control-systems         | Real-world control system FSMs                    |
| Sequence Detectors      | sequence-detectors      | Pattern recognition and sequence detection FSMs   |
| Game Logic              | game-logic              | Game and entertainment state machines             |

**Example FSMs** (loaded from JSON files):
| File                     | Category            | visibility |
|--------------------------|---------------------|------------|
| elevator.json            | Control Systems     | public     |
| sequence_detector.json   | Sequence Detectors  | public     |
| traffic_light.json       | Control Systems     | public     |
| vending_machine.json     | Digital Logic       | public     |

For each example FSM, you need to:
1. Read the JSON file structure
2. Map it to the `fsms` table columns
3. Calculate `state_count`, `transition_count`, `bit_width` (ceil(log2(state_count)))
4. Set `visibility='public'`, `is_optimized=False`
5. Store the full JSON as the `definition` JSONB field

Migration pattern:
```python
"""Seed categories and example FSMs"""
from alembic import op
import sqlalchemy as sa
from uuid import uuid4
from datetime import datetime

revision = 'xxxx_seed_data'
down_revision = '5c754bee004e'

def upgrade():
    # Insert categories
    categories_table = sa.table('categories',
        sa.column('id', sa.UUID),
        sa.column('name', sa.String),
        sa.column('slug', sa.String),
        sa.column('description', sa.Text),
        sa.column('level', sa.Integer),
        sa.column('display_order', sa.Integer),
        sa.column('fsm_count', sa.Integer),
    )

    cat_ids = {name: uuid4() for name in ['digital-logic', 'control-systems', ...]}

    op.bulk_insert(categories_table, [
        {'id': cat_ids['digital-logic'], 'name': 'Digital Logic', 'slug': 'digital-logic', ...},
        ...
    ])

    # Insert example FSMs
    # Read from JSON and map to table columns

def downgrade():
    # Delete seeded data by known IDs
    op.execute("DELETE FROM fsms WHERE visibility = 'public'")
    op.execute("DELETE FROM categories")
```

### Task 3: Apply Performance Indexes
Read `performance/database/01_performance_indexes.sql` and create a migration or init script that applies:
- Index on `fsms.fsm_type`
- Index on `fsms.category_id`
- Index on `fsms.visibility`
- Index on `fsms.is_optimized`
- Index on `fsms.created_at`
- Composite indexes for common query patterns
- GIN index on `fsms.tags` for array queries
- GIN index on `fsms.definition` for JSONB queries

### Task 4: Optimize Connection Pool
Read `performance/database/03_connection_pool_config.py` and apply recommended settings to `backend/app/db/session.py`:
- Pool pre-ping for connection health checks
- Pool recycle time
- Statement cache size
- Connection timeout

### Task 5: Update database/init/03_seed_data.sql
Update this file to match the Alembic migration seed data so Docker init and Alembic stay in sync.

---

## Interfaces

- **backend-agent** will implement `CategoryService` and `ExampleService` that query the data you seed. Categories need: `id`, `name`, `slug`, `description`. FSMs need: all columns populated correctly.
- **devops-agent** owns Docker Compose. Your DB connection settings must match: `postgresql://grayfsm:password@localhost:5434/grayfsm`
- **testing-agent** may use seeded data in integration tests.
