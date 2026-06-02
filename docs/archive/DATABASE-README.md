# GrayFSM Database Documentation

## Overview

This directory contains comprehensive database design documentation for the GrayFSM project - a web-based tool for optimizing finite state machines using Gray code encoding.

---

## Documentation Files

### 📘 [database-design.md](./database-design.md)
**Comprehensive Database Design Document** (67 pages)

The main database design document covering:
- Design philosophy and technology recommendations
- Detailed entity relationship models
- Complete PostgreSQL schema definitions with all tables
- MongoDB alternative design
- Indexing strategy and query optimization
- Data access patterns and sample queries
- Migration strategies
- Security, backup, and recovery considerations
- Performance optimization techniques

**Target Audience**: Backend developers, database administrators, architects

**When to Use**:
- Understanding the complete database architecture
- Planning implementation strategy
- Making technology choices (PostgreSQL vs MongoDB)
- Designing new features that require database changes

---

### 💾 [database-schema.sql](./database-schema.sql)
**Complete PostgreSQL Schema Implementation** (1,100+ lines)

Production-ready SQL file containing:
- All table definitions with constraints
- ENUM types and custom domains
- Indexes (B-tree, GIN, partial, composite)
- Triggers and stored functions
- Row-level security policies (commented for Phase 4)
- Materialized views for performance
- Seed data for categories and example FSMs
- Maintenance functions

**Target Audience**: Database administrators, DevOps, backend developers

**When to Use**:
- Initializing a new database instance
- Setting up development environment
- Deploying to production
- Understanding exact schema structure

**Usage**:
```bash
psql -U username -d grayfsm -f database-schema.sql
```

---

### 🔍 [database-queries.sql](./database-queries.sql)
**Sample Queries and Common Operations** (500+ lines)

Practical SQL examples covering:
- **CRUD Operations**: Create, Read, Update, Delete FSMs
- **Search & Filtering**: Full-text search, category filters, tag-based queries
- **Aggregations**: Statistics, user activity, performance metrics
- **Algorithm Results**: Store and compare optimization results
- **Export Cache**: Manage cached HDL exports
- **Community Features**: Shares, comments, votes, benchmarks
- **Complex Queries**: Trending FSMs, similar FSMs, user dashboards
- **Maintenance**: Cleanup, performance analysis, view refresh
- **Analytics**: FSM creation trends, user leaderboards

**Target Audience**: Backend developers, data analysts

**When to Use**:
- Implementing API endpoints
- Building analytics dashboards
- Troubleshooting database issues
- Learning query patterns
- Performance testing

**Usage**:
```bash
# Run specific query
psql -U username -d grayfsm -c "SELECT * FROM fsms LIMIT 10;"

# Or use interactive mode
psql -U username -d grayfsm
\i database-queries.sql
```

---

### 🚀 [DATABASE-QUICKSTART.md](./DATABASE-QUICKSTART.md)
**Quick Start Setup Guide** (20 pages)

Step-by-step instructions for:
- **Local Development**: Docker setup, native PostgreSQL installation
- **Cloud Deployment**: Supabase, Railway, AWS RDS setup
- **Migration Tools**: Alembic (Python), Prisma (Node.js)
- **Testing**: Smoke tests, automated testing scripts
- **Connection Examples**: Python (psycopg2, SQLAlchemy), Node.js (pg, Prisma)
- **Troubleshooting**: Common issues and solutions

**Target Audience**: All developers, especially those new to the project

**When to Use**:
- First time setting up the project
- Deploying to a new environment
- Helping new team members get started
- Choosing between different database hosting options

---

### 📊 [database-erd.txt](./database-erd.txt)
**Entity Relationship Diagram (ASCII/Text Format)** (25 pages)

Visual representation including:
- Complete table structures with field types
- Primary keys, foreign keys, indexes
- Relationship diagrams (ASCII art)
- Data volume estimates
- Index summary and recommendations
- Security considerations
- Backup strategy

**Target Audience**: Architects, developers, visual learners

**When to Use**:
- Understanding table relationships quickly
- Presenting architecture to stakeholders
- Planning database modifications
- Estimating storage requirements

---

## Quick Reference

### Database Statistics

| Metric | Phase 1 (MVP) | Phase 4 (Full) | Year 1 Estimate |
|--------|---------------|----------------|-----------------|
| **Tables** | 7 | 13 | 13 |
| **Indexes** | ~30 | ~60 | ~60 |
| **FSMs** | 100-1,000 | 10,000+ | 10,000 |
| **Users** | N/A | 1,000+ | 1,000 |
| **Storage** | 50-200 MB | 2-4 GB | 3 GB |

### Technology Stack

**Recommended for Production**:
- **Database**: PostgreSQL 15+
- **ORM** (Python): SQLAlchemy 2.0+
- **ORM** (Node.js): Prisma 5.0+
- **Migration**: Alembic (Python) or Prisma Migrate
- **Hosting**: AWS RDS, Supabase, Railway, Google Cloud SQL

**Alternative (Simpler Deployment)**:
- **Database**: MongoDB 6+
- **ODM**: Mongoose (Node.js), Motor (Python)
- **Hosting**: MongoDB Atlas

### Key Tables

**Phase 1 (MVP)**:
1. `fsms` - Primary FSM storage
2. `categories` - FSM categorization
3. `algorithm_results` - Optimization results
4. `export_cache` - Cached HDL exports
5. `states` (optional) - Normalized state storage
6. `transitions` (optional) - Normalized transition storage

**Phase 4 (Community)**:
7. `users` - User accounts
8. `shares` - FSM sharing
9. `comments` - User feedback
10. `votes` - Ratings and favorites
11. `benchmarks` - Hardware metrics
12. `activity_log` - Audit trail

### Most Important Indexes

```sql
-- Full-text search (critical for user experience)
CREATE INDEX idx_fsms_search ON fsms USING GIN(search_vector);

-- Browse public FSMs (most common query)
CREATE INDEX idx_fsms_public_optimized
    ON fsms(created_at DESC)
    WHERE visibility = 'public' AND is_optimized = TRUE;

-- Algorithm comparison (research features)
CREATE INDEX idx_algorithm_results_comparison
    ON algorithm_results(original_fsm_id, algorithm, improvement_percentage DESC)
    WHERE success = TRUE;

-- JSONB queries (flexible FSM structure)
CREATE INDEX idx_fsms_definition ON fsms USING GIN(definition);
```

---

## Getting Started

### 1. Choose Your Setup Method

**For Local Development**:
```bash
# Quick start with Docker (recommended)
cd /home/arunupscee/Music/grayFSM
docker run --name grayfsm-postgres \
  -e POSTGRES_DB=grayfsm \
  -e POSTGRES_USER=grayfsm_user \
  -e POSTGRES_PASSWORD=dev_password \
  -p 5432:5432 \
  -v grayfsm-data:/var/lib/postgresql/data \
  -d postgres:15

# Wait for startup
sleep 10

# Initialize schema
docker exec -i grayfsm-postgres psql -U grayfsm_user -d grayfsm < database-schema.sql
```

**For Cloud Deployment**:
See [DATABASE-QUICKSTART.md](./DATABASE-QUICKSTART.md) for detailed instructions on Supabase, Railway, or AWS RDS.

### 2. Verify Installation

```bash
# Connect to database
psql postgresql://grayfsm_user:dev_password@localhost:5432/grayfsm

# Check tables
\dt

# Verify seed data
SELECT COUNT(*) FROM categories;  -- Should return 5
SELECT COUNT(*) FROM fsms WHERE visibility = 'example';  -- Should return 1+

# Test full-text search
SELECT name FROM fsms
WHERE search_vector @@ to_tsquery('english', 'traffic');
```

### 3. Connect from Application

**Python**:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine('postgresql://grayfsm_user:dev_password@localhost/grayfsm')
Session = sessionmaker(bind=engine)
session = Session()

# Query FSMs
fsms = session.query(FSM).filter_by(visibility='public').limit(10).all()
for fsm in fsms:
    print(f"{fsm.name}: {fsm.state_count} states")
```

**Node.js**:
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://grayfsm_user:dev_password@localhost/grayfsm'
});

const { rows } = await pool.query(
  'SELECT * FROM fsms WHERE visibility = $1 LIMIT 10',
  ['public']
);
console.log(rows);
```

---

## Common Tasks

### Add a New FSM
```sql
INSERT INTO fsms (
    name, fsm_type, definition,
    state_count, transition_count, initial_state,
    bit_width, visibility
) VALUES (
    'My FSM', 'moore', '{"states": [], "transitions": []}'::jsonb,
    4, 3, 'S0', 2, 'public'
) RETURNING id;
```

### Search FSMs
```sql
SELECT id, name, description
FROM fsms
WHERE search_vector @@ to_tsquery('english', 'traffic & light')
    AND visibility = 'public'
ORDER BY ts_rank(search_vector, to_tsquery('english', 'traffic & light')) DESC;
```

### Record Optimization Result
```sql
INSERT INTO algorithm_results (
    original_fsm_id, algorithm,
    dummy_states_added, improvement_percentage,
    execution_time_ms, success
) VALUES (
    $1, 'greedy', 2, 35.5, 123, TRUE
);
```

### Get Trending FSMs
```sql
SELECT * FROM trending_fsms LIMIT 10;

-- Or manually compute
-- (see database-queries.sql for full query)
```

---

## Maintenance

### Daily Tasks (Automated)
```bash
# Backup database
pg_dump grayfsm > backup_$(date +%Y%m%d).sql

# Clean expired cache
psql -d grayfsm -c "DELETE FROM export_cache WHERE expires_at < NOW();"

# Refresh materialized views
psql -d grayfsm -c "REFRESH MATERIALIZED VIEW CONCURRENTLY trending_fsms;"
```

### Weekly Tasks
```bash
# Update table statistics
psql -d grayfsm -c "ANALYZE;"

# Check for slow queries
psql -d grayfsm -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
"
```

### Monthly Tasks
```bash
# Check index usage
psql -d grayfsm -c "
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND schemaname = 'public';
"

# Vacuum and analyze
psql -d grayfsm -c "VACUUM ANALYZE;"

# Test backup restoration (on separate instance)
```

---

## Migration Path

### Phase 1 → Phase 2 (Adding Community Features)

1. **Add users table** (if not exists)
```sql
-- Already defined in schema, just ensure it exists
SELECT COUNT(*) FROM users;
```

2. **Add foreign key to existing FSMs**
```sql
ALTER TABLE fsms
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
```

3. **Migrate existing data**
```sql
-- Assign existing FSMs to system user
UPDATE fsms
SET created_by = '00000000-0000-0000-0000-000000000000'
WHERE created_by IS NULL;
```

4. **Add community tables**
```sql
-- shares, comments, votes, benchmarks, activity_log
-- All defined in database-schema.sql
```

See [database-design.md](./database-design.md) for detailed migration strategy.

---

## Performance Tuning

### Monitor Query Performance
```sql
-- Enable pg_stat_statements (one time)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Find slow queries
SELECT
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

### Optimize Slow Queries
```sql
-- Explain query plan
EXPLAIN ANALYZE
SELECT * FROM fsms WHERE visibility = 'public' ORDER BY created_at DESC LIMIT 20;

-- Look for sequential scans, add indexes if needed
CREATE INDEX idx_custom ON table_name(column_name);
```

### Connection Pooling
Always use connection pooling in production:
- **Python**: SQLAlchemy pool (default: 5-20 connections)
- **Node.js**: pg.Pool (default: 10-20 connections)
- **External**: PgBouncer for very high traffic

---

## Security Checklist

- [ ] Use strong passwords (min 16 characters, random)
- [ ] Enable SSL/TLS for database connections
- [ ] Restrict database access by IP (firewall rules)
- [ ] Use row-level security policies (Phase 4)
- [ ] Never expose `password_hash`, `api_key` in queries
- [ ] Implement rate limiting at application layer
- [ ] Regular security audits (quarterly)
- [ ] Keep PostgreSQL updated (patch releases)
- [ ] Backup encryption (at rest and in transit)
- [ ] Monitor for SQL injection attempts

---

## Support & Resources

### Documentation
- [PostgreSQL Official Docs](https://www.postgresql.org/docs/)
- [SQLAlchemy Docs](https://docs.sqlalchemy.org/)
- [Prisma Docs](https://www.prisma.io/docs)

### Troubleshooting
- See [DATABASE-QUICKSTART.md](./DATABASE-QUICKSTART.md#troubleshooting)
- Check PostgreSQL logs: `/var/log/postgresql/`
- Use `EXPLAIN ANALYZE` for query debugging

### Community
- PostgreSQL Mailing Lists
- Stack Overflow: `[postgresql]` tag
- Project GitHub Issues

---

## License

This database design is part of the GrayFSM project. See main project LICENSE for details.

---

## Changelog

**v1.0 (2025-11-29)**:
- Initial database design
- PostgreSQL schema implementation
- MongoDB alternative design
- Comprehensive documentation

**Planned for v1.1**:
- Time-series partitioning for activity_log
- Additional materialized views for analytics
- Advanced full-text search configurations
- Read replica setup documentation

---

**Last Updated**: November 29, 2025
**Next Review**: After Phase 1 MVP completion (Week 8)
