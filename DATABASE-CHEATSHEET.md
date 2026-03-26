# GrayFSM Database Cheat Sheet

**Quick reference for common database operations**

---

## Connection Strings

```bash
# Local Development
postgresql://grayfsm_user:password@localhost:5432/grayfsm

# Docker
postgresql://grayfsm_user:password@grayfsm-postgres:5432/grayfsm

# Supabase
postgresql://postgres:password@db.PROJECT_ID.supabase.co:5432/postgres

# Railway
postgresql://postgres:password@containers.railway.app:PORT/railway

# AWS RDS
postgresql://admin:password@instance.region.rds.amazonaws.com:5432/grayfsm
```

---

## Quick Setup

### 1-Command Docker Setup
```bash
docker run --name grayfsm-postgres \
  -e POSTGRES_DB=grayfsm -e POSTGRES_USER=grayfsm_user \
  -e POSTGRES_PASSWORD=dev123 -p 5432:5432 \
  -v grayfsm-data:/var/lib/postgresql/data -d postgres:15 && \
  sleep 10 && \
  docker exec -i grayfsm-postgres psql -U grayfsm_user -d grayfsm < database-schema.sql
```

### Verify
```bash
psql postgresql://grayfsm_user:dev123@localhost/grayfsm \
  -c "SELECT COUNT(*) FROM categories;"
```

---

## Essential Queries

### FSMs

```sql
-- Create FSM
INSERT INTO fsms (name, fsm_type, definition, state_count,
                  transition_count, initial_state, bit_width, visibility)
VALUES ('My FSM', 'moore', '{"states":[]}'::jsonb, 4, 3, 'S0', 2, 'public')
RETURNING id;

-- Get Public FSMs
SELECT id, name, state_count, view_count
FROM fsms
WHERE visibility = 'public'
ORDER BY created_at DESC
LIMIT 20;

-- Search FSMs
SELECT id, name
FROM fsms
WHERE search_vector @@ to_tsquery('english', 'traffic & light')
  AND visibility = 'public';

-- Update FSM
UPDATE fsms
SET name = 'New Name', updated_at = NOW()
WHERE id = 'fsm-uuid';

-- Delete FSM (cascades to related data)
DELETE FROM fsms WHERE id = 'fsm-uuid';
```

### Algorithm Results

```sql
-- Save Optimization Result
INSERT INTO algorithm_results (
    original_fsm_id, algorithm, dummy_states_added,
    improvement_percentage, execution_time_ms, success
) VALUES (
    'fsm-uuid', 'greedy', 2, 35.5, 123, TRUE
);

-- Compare Algorithms
SELECT algorithm, AVG(improvement_percentage) as avg_improvement,
       AVG(execution_time_ms) as avg_time
FROM algorithm_results
WHERE success = TRUE
GROUP BY algorithm
ORDER BY avg_improvement DESC;
```

### Users (Phase 4)

```sql
-- Create User
INSERT INTO users (username, email, password_hash, display_name)
VALUES ('johndoe', 'john@example.com', '$2b$12$hash', 'John Doe')
RETURNING id;

-- Get User FSMs
SELECT f.id, f.name, f.state_count, f.view_count
FROM fsms f
WHERE f.created_by = 'user-uuid'
ORDER BY f.updated_at DESC;
```

### Categories

```sql
-- List All Categories
SELECT id, name, slug, fsm_count
FROM categories
ORDER BY display_order;

-- Get Category with FSMs
SELECT c.name, COUNT(f.id) as fsm_count
FROM categories c
LEFT JOIN fsms f ON c.id = f.category_id
WHERE f.visibility = 'public'
GROUP BY c.id, c.name;
```

---

## Common Patterns

### Full-Text Search
```sql
-- Basic search
SELECT * FROM fsms
WHERE search_vector @@ to_tsquery('english', 'traffic');

-- Ranked search
SELECT *, ts_rank(search_vector, query) AS rank
FROM fsms, to_tsquery('english', 'traffic & light') query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

### Tag Filtering
```sql
-- FSMs with tag
SELECT * FROM fsms WHERE 'traffic' = ANY(tags);

-- FSMs with all tags (AND)
SELECT * FROM fsms WHERE tags @> ARRAY['traffic', 'safety'];

-- FSMs with any tag (OR)
SELECT * FROM fsms WHERE tags && ARRAY['traffic', 'vending'];
```

### Aggregations
```sql
-- FSM statistics
SELECT
    fsm_type,
    COUNT(*) as count,
    AVG(state_count) as avg_states,
    AVG(view_count) as avg_views
FROM fsms
WHERE visibility = 'public'
GROUP BY fsm_type;

-- Top viewed FSMs
SELECT id, name, view_count
FROM fsms
WHERE visibility = 'public'
ORDER BY view_count DESC
LIMIT 10;
```

### Trending FSMs
```sql
-- Use materialized view
SELECT * FROM trending_fsms LIMIT 10;

-- Or compute manually
WITH recent_views AS (
    SELECT entity_id, COUNT(*) as recent_count
    FROM activity_log
    WHERE activity_type = 'fsm_viewed'
      AND created_at > NOW() - INTERVAL '7 days'
    GROUP BY entity_id
)
SELECT f.id, f.name, f.view_count,
       COALESCE(rv.recent_count, 0) as recent_views
FROM fsms f
LEFT JOIN recent_views rv ON f.id = rv.entity_id
WHERE f.visibility = 'public'
ORDER BY recent_views DESC, f.view_count DESC
LIMIT 10;
```

---

## Maintenance

### Daily
```bash
# Backup
pg_dump grayfsm > backup_$(date +%Y%m%d).sql

# Clean cache
psql -d grayfsm -c "DELETE FROM export_cache WHERE expires_at < NOW();"

# Refresh views
psql -d grayfsm -c "REFRESH MATERIALIZED VIEW CONCURRENTLY trending_fsms;"
```

### Weekly
```bash
# Update statistics
psql -d grayfsm -c "ANALYZE;"

# Check slow queries
psql -d grayfsm -c "
SELECT query, calls, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
"
```

### Monthly
```bash
# Vacuum
psql -d grayfsm -c "VACUUM ANALYZE;"

# Check unused indexes
psql -d grayfsm -c "
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND schemaname = 'public';
"
```

---

## Performance

### EXPLAIN Query
```sql
EXPLAIN ANALYZE
SELECT * FROM fsms WHERE visibility = 'public' LIMIT 20;
-- Look for: Seq Scan (bad), Index Scan (good), execution time
```

### Create Index
```sql
-- Standard B-tree index
CREATE INDEX idx_name ON table_name(column_name);

-- Partial index (for subset)
CREATE INDEX idx_name ON table_name(column)
WHERE condition = true;

-- Composite index
CREATE INDEX idx_name ON table_name(col1, col2);

-- GIN index (for JSONB, arrays, full-text)
CREATE INDEX idx_name ON table_name USING GIN(column);
```

### Drop Unused Index
```sql
DROP INDEX IF EXISTS idx_name;
```

---

## Debugging

### Connection Issues
```bash
# Check PostgreSQL running
sudo systemctl status postgresql
# or
ps aux | grep postgres

# Test connection
psql postgresql://user:pass@host:5432/db -c "SELECT 1;"
```

### Query Issues
```sql
-- Current running queries
SELECT pid, query, state, query_start
FROM pg_stat_activity
WHERE state != 'idle';

-- Kill long-running query
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid = 12345;
```

### Table Info
```sql
-- Table size
SELECT pg_size_pretty(pg_total_relation_size('fsms'));

-- Row count
SELECT COUNT(*) FROM fsms;

-- Schema info
\d fsms
```

---

## Security

### Reset Password
```sql
ALTER USER grayfsm_user WITH PASSWORD 'new_secure_password';
```

### Grant Privileges
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grayfsm_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO grayfsm_user;
```

### Revoke Privileges
```sql
REVOKE DELETE ON fsms FROM grayfsm_user;
```

---

## Python Examples

### SQLAlchemy
```python
from sqlalchemy import create_engine, text

engine = create_engine('postgresql://user:pass@localhost/grayfsm')

with engine.connect() as conn:
    # Query
    result = conn.execute(text("SELECT * FROM fsms LIMIT 10"))
    for row in result:
        print(row)

    # Insert
    conn.execute(text("""
        INSERT INTO fsms (name, fsm_type, definition, state_count,
                          transition_count, initial_state, bit_width)
        VALUES (:name, :type, :def, :states, :trans, :init, :bits)
    """), {
        "name": "My FSM",
        "type": "moore",
        "def": '{"states": []}',
        "states": 4,
        "trans": 3,
        "init": "S0",
        "bits": 2
    })
    conn.commit()
```

### psycopg2
```python
import psycopg2
from psycopg2.extras import RealDictCursor, Json

conn = psycopg2.connect("postgresql://user:pass@localhost/grayfsm")
cur = conn.cursor(cursor_factory=RealDictCursor)

# Query
cur.execute("SELECT * FROM fsms WHERE visibility = %s LIMIT 10", ('public',))
fsms = cur.fetchall()

# Insert with JSONB
cur.execute("""
    INSERT INTO fsms (name, fsm_type, definition, state_count,
                      transition_count, initial_state, bit_width)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
""", ('My FSM', 'moore', Json({'states': []}), 4, 3, 'S0', 2))

conn.commit()
conn.close()
```

---

## Node.js Examples

### pg (node-postgres)
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://user:pass@localhost/grayfsm'
});

// Query
const { rows } = await pool.query(
  'SELECT * FROM fsms WHERE visibility = $1 LIMIT 10',
  ['public']
);

// Insert
await pool.query(
  `INSERT INTO fsms (name, fsm_type, definition, state_count,
                     transition_count, initial_state, bit_width)
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  ['My FSM', 'moore', {states: []}, 4, 3, 'S0', 2]
);
```

### Prisma
```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Query
const fsms = await prisma.fSM.findMany({
  where: { visibility: 'PUBLIC' },
  take: 10
});

// Insert
const fsm = await prisma.fSM.create({
  data: {
    name: 'My FSM',
    fsmType: 'MOORE',
    definition: { states: [] },
    stateCount: 4,
    transitionCount: 3,
    initialState: 'S0',
    bitWidth: 2
  }
});
```

---

## Keyboard Shortcuts (psql)

```
\l              List databases
\c dbname       Connect to database
\dt             List tables
\d tablename    Describe table
\di             List indexes
\df             List functions
\dv             List views
\du             List users
\q              Quit
\?              Help
\timing         Toggle query timing
\x              Toggle expanded display
```

---

## Environment Variables

```bash
# Set for session
export DATABASE_URL="postgresql://user:pass@localhost/grayfsm"
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=grayfsm
export PGUSER=grayfsm_user
export PGPASSWORD=password

# Then connect simply
psql
```

---

## Docker Commands

```bash
# Start container
docker start grayfsm-postgres

# Stop container
docker stop grayfsm-postgres

# Execute SQL
docker exec -i grayfsm-postgres psql -U grayfsm_user -d grayfsm < file.sql

# Interactive shell
docker exec -it grayfsm-postgres psql -U grayfsm_user -d grayfsm

# Logs
docker logs grayfsm-postgres

# Remove container (data persists in volume)
docker rm grayfsm-postgres

# Remove volume (DELETES ALL DATA)
docker volume rm grayfsm-data
```

---

## File References

| File | Purpose | Lines |
|------|---------|-------|
| `database-design.md` | Complete design doc | ~2,500 |
| `database-schema.sql` | SQL schema | ~1,100 |
| `database-queries.sql` | Sample queries | ~500 |
| `DATABASE-QUICKSTART.md` | Setup guide | ~800 |
| `database-erd.txt` | ERD diagram | ~900 |
| `DATABASE-README.md` | Documentation index | ~500 |

---

**Pro Tips**:
- Always use parameterized queries (prevent SQL injection)
- Use connection pooling in production
- Index foreign keys and frequently filtered columns
- EXPLAIN ANALYZE slow queries before optimizing
- Backup before schema changes
- Test migrations on staging first

---

**Last Updated**: 2025-11-29
