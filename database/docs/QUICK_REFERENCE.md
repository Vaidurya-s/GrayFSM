# GrayFSM Database Quick Reference

One-page reference for common database operations.

## Quick Start

```bash
# Start database
docker-compose up -d postgres

# Connect to database
docker-compose exec postgres psql -U grayfsm_user -d grayfsm

# Check status
./scripts/monitor.sh
```

## Common Commands

### Database Operations

```bash
# Backup
./scripts/backup.sh

# Restore
./scripts/restore.sh backups/latest.sql.gz

# Monitor
./scripts/monitor.sh
```

### Docker Commands

```bash
# Start services
docker-compose up -d postgres
docker-compose --profile tools up -d pgadmin
docker-compose --profile cache up -d redis

# Stop services
docker-compose stop
docker-compose down

# View logs
docker-compose logs -f postgres

# Execute command
docker-compose exec postgres psql -U grayfsm_user -d grayfsm
```

### SQL Queries

```sql
-- List all FSMs
SELECT id, name, fsm_type, state_count, created_at
FROM fsms
ORDER BY created_at DESC
LIMIT 20;

-- Search FSMs
SELECT * FROM search_fsms('traffic');

-- Get FSM details
SELECT * FROM get_fsm_details('fsm-id-here');

-- Algorithm comparison
SELECT * FROM compare_algorithms();

-- User statistics
SELECT * FROM get_user_statistics('user-id-here');
```

### Maintenance

```sql
-- Vacuum and analyze
VACUUM ANALYZE;

-- Refresh materialized views
REFRESH MATERIALIZED VIEW CONCURRENTLY trending_fsms;
REFRESH MATERIALIZED VIEW CONCURRENTLY category_statistics;

-- Check table sizes
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Alembic Migrations

```bash
# Create migration
alembic revision -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1

# Check current version
alembic current

# Show history
alembic history
```

## Connection Strings

```bash
# PostgreSQL
postgresql://grayfsm_user:grayfsm_password@localhost:5432/grayfsm

# SQLAlchemy Async
postgresql+asyncpg://grayfsm_user:grayfsm_password@localhost:5432/grayfsm

# Redis
redis://:redis_password@localhost:6379/0
```

## Access URLs

```
PostgreSQL:  localhost:5432
pgAdmin:     http://localhost:5050 (admin@grayfsm.com / admin)
Redis:       localhost:6379
```

## Performance Tuning

```sql
-- Slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Cache hit ratio
SELECT ROUND(
    sum(blks_hit) / NULLIF(sum(blks_hit + blks_read), 0),
    4
) as cache_hit_ratio
FROM pg_stat_database
WHERE datname = 'grayfsm';

-- Index usage
SELECT tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan;
```

## Stored Procedures

```sql
-- Increment view count
SELECT increment_fsm_view_count('fsm-id');

-- Create share link
SELECT * FROM create_share_link('fsm-id', 'user-id', 'view', true, 30);

-- Fork FSM
SELECT fork_fsm('source-fsm-id', 'New FSM Name', 'user-id');

-- Record algorithm result
SELECT record_algorithm_result(
    'original-fsm-id',
    'optimized-fsm-id',
    'greedy',
    2,  -- dummy states added
    2.5, -- avg hamming before
    1.0, -- avg hamming after
    145, -- execution time ms
    '{"S0": "000"}'::jsonb,
    'user-id'
);
```

## Troubleshooting

```bash
# Database not starting
docker-compose logs postgres
docker-compose restart postgres

# Connection refused
docker-compose ps
docker-compose exec postgres pg_isready

# Slow performance
./scripts/monitor.sh
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "VACUUM ANALYZE;"

# Out of space
df -h
find backups/ -mtime +30 -delete
```

## Emergency Procedures

```bash
# Create emergency backup
./scripts/backup.sh

# Kill all connections
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'grayfsm'
AND pid <> pg_backend_pid();
"

# Restore from backup
./scripts/restore.sh backups/grayfsm_backup_latest.sql.gz --force
```

## Configuration Files

```
docker-compose.yml          - Docker services
.env                        - Environment variables
config/postgresql.conf      - PostgreSQL config (general)
config/postgresql.dev.conf  - Development config
config/postgresql.prod.conf - Production config
alembic.ini                - Alembic configuration
```

## Directory Structure

```
database/
├── README.md                   # Main documentation
├── docker-compose.yml          # Docker setup
├── .env                        # Configuration
├── alembic/                    # Migrations
├── init/                       # Initialization scripts
├── config/                     # PostgreSQL config
├── queries/                    # SQL queries
├── scripts/                    # Management scripts
├── backups/                    # Backup storage
├── tests/                      # Database tests
└── docs/                       # Documentation
```

## Support

- **Documentation**: /home/arunupscee/Music/grayFSM/database/README.md
- **Admin Guide**: /home/arunupscee/Music/grayFSM/database/docs/DATABASE_ADMIN_GUIDE.md
- **GitHub Issues**: [Report Issue]
- **Database Team**: database@grayfsm.com
