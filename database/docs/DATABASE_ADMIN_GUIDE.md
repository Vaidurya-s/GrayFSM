# GrayFSM Database Administration Guide

Complete guide for managing and maintaining the GrayFSM PostgreSQL database.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Daily Operations](#daily-operations)
3. [Backup and Recovery](#backup-and-recovery)
4. [Performance Tuning](#performance-tuning)
5. [Monitoring](#monitoring)
6. [Troubleshooting](#troubleshooting)
7. [Security](#security)
8. [Maintenance Tasks](#maintenance-tasks)

## Quick Start

### Initial Setup

```bash
# Navigate to database directory
cd /home/arunupscee/Music/grayFSM/database

# Run setup script (first time only)
./scripts/setup.sh

# Verify installation
docker-compose ps
./scripts/monitor.sh
```

### Daily Connection

```bash
# Connect to database
docker-compose exec postgres psql -U grayfsm_user -d grayfsm

# Or use psql directly
psql postgresql://grayfsm_user:grayfsm_password@localhost:5432/grayfsm
```

## Daily Operations

### Starting/Stopping Database

```bash
# Start database
docker-compose up -d postgres

# Stop database
docker-compose stop postgres

# Restart database
docker-compose restart postgres

# View logs
docker-compose logs -f postgres

# Stop all services
docker-compose down
```

### Checking Database Status

```bash
# Quick health check
docker-compose exec postgres pg_isready -U grayfsm_user -d grayfsm

# Detailed monitoring
./scripts/monitor.sh

# View active connections
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
SELECT pid, usename, application_name, client_addr, state, query
FROM pg_stat_activity
WHERE datname = 'grayfsm'
ORDER BY state, query_start
"
```

## Backup and Recovery

### Automated Backups

Backups are created daily at 2 AM by default. To configure:

```bash
# Edit .env file
BACKUP_SCHEDULE="0 2 * * *"  # Cron format
BACKUP_RETENTION_DAYS=30

# Start backup service
docker-compose --profile backup up -d backup
```

### Manual Backup

```bash
# Create backup
./scripts/backup.sh

# List backups
ls -lh backups/

# Verify backup
gunzip -c backups/grayfsm_backup_20251129_120000.sql.gz | head -n 20
```

### Restore from Backup

```bash
# Restore latest backup (with confirmation)
./scripts/restore.sh backups/$(ls -t backups/*.sql.gz | head -1)

# Restore specific backup (force, no confirmation)
./scripts/restore.sh backups/grayfsm_backup_20251129.sql.gz --force

# Restore and recreate database
./scripts/restore.sh backups/grayfsm_backup_20251129.sql.gz --create-db
```

### Point-in-Time Recovery

If WAL archiving is enabled:

```bash
# Enable WAL archiving in postgresql.conf
archive_mode = on
archive_command = 'test ! -f /backups/wal/%f && cp %p /backups/wal/%f'

# Restore to specific point in time
pg_restore -h localhost -U grayfsm_user -d grayfsm \
  --clean --if-exists \
  -t "YYYY-MM-DD HH:MM:SS" \
  backups/grayfsm_backup_20251129.sql.gz
```

## Performance Tuning

### Query Performance Analysis

```bash
# Enable pg_stat_statements (if not enabled)
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
"

# View slowest queries
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
SELECT
    LEFT(query, 60) as query,
    calls,
    ROUND(mean_exec_time::numeric, 2) as avg_time_ms,
    ROUND(total_exec_time::numeric, 2) as total_time_ms
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"

# Explain specific query
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
EXPLAIN ANALYZE
SELECT * FROM fsms WHERE visibility = 'public' LIMIT 20;
"
```

### Index Optimization

```bash
# Check index usage
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan;
"

# Find missing indexes
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    most_common_vals
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct > 100
ORDER BY n_distinct DESC;
"

# Create index
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
CREATE INDEX CONCURRENTLY idx_fsms_custom
ON fsms(column_name)
WHERE condition;
"
```

### Connection Pool Configuration

For production, configure connection pooling in your application:

```python
# SQLAlchemy example
engine = create_engine(
    'postgresql://user:pass@host/db',
    pool_size=20,          # Permanent connections
    max_overflow=10,       # Additional connections
    pool_timeout=30,       # Wait timeout
    pool_recycle=3600,     # Recycle every hour
    pool_pre_ping=True     # Verify connections
)
```

### Vacuum and Analyze

```bash
# Manual vacuum (reclaim space)
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "VACUUM VERBOSE;"

# Vacuum with analyze
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "VACUUM ANALYZE;"

# Vacuum specific table
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "VACUUM VERBOSE ANALYZE fsms;"

# Full vacuum (more thorough but locks table)
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "VACUUM FULL fsms;"
```

## Monitoring

### Real-Time Monitoring

```bash
# Run monitoring script
./scripts/monitor.sh

# Continuous monitoring (every 60 seconds)
watch -n 60 ./scripts/monitor.sh

# Monitor specific metrics
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
SELECT
    datname,
    numbackends as connections,
    xact_commit as commits,
    xact_rollback as rollbacks,
    blks_read,
    blks_hit,
    ROUND(blks_hit::numeric / NULLIF(blks_hit + blks_read, 0), 4) as cache_hit_ratio
FROM pg_stat_database
WHERE datname = 'grayfsm';
"
```

### Log Monitoring

```bash
# View PostgreSQL logs
docker-compose exec postgres tail -f /var/lib/postgresql/data/pgdata/log/postgresql-*.log

# Search for errors
docker-compose logs postgres 2>&1 | grep ERROR

# Search for slow queries
docker-compose logs postgres 2>&1 | grep "duration:"
```

### Set Up Alerts

Create monitoring cron job:

```bash
# Add to crontab
crontab -e

# Run monitoring every 5 minutes and send alerts
*/5 * * * * /path/to/database/scripts/monitor.sh || echo "Database health check failed" | mail -s "GrayFSM Database Alert" admin@example.com
```

## Troubleshooting

### Common Issues

#### Issue: Cannot Connect to Database

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Verify network connectivity
docker-compose exec postgres pg_isready

# Restart database
docker-compose restart postgres
```

#### Issue: Slow Queries

```bash
# Identify slow queries
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;
"

# Analyze specific query
EXPLAIN ANALYZE <your_query>;

# Check for missing indexes
# (see Index Optimization section)
```

#### Issue: Out of Disk Space

```bash
# Check disk usage
df -h

# Check database size
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
SELECT pg_size_pretty(pg_database_size('grayfsm'));
"

# Check table sizes
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
"

# Vacuum to reclaim space
VACUUM FULL;

# Remove old backups
find backups/ -name "*.sql.gz" -mtime +30 -delete
```

#### Issue: High CPU Usage

```bash
# Check active queries
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
SELECT
    pid,
    query_start,
    state,
    LEFT(query, 100) as query
FROM pg_stat_activity
WHERE state = 'active'
AND pid <> pg_backend_pid()
ORDER BY query_start;
"

# Kill long-running query
SELECT pg_terminate_backend(pid);

# Adjust PostgreSQL configuration
# (see config/postgresql.conf)
```

### Recovery Scenarios

#### Corrupted Database

```bash
# Restore from latest backup
./scripts/restore.sh backups/$(ls -t backups/*.sql.gz | head -1) --force

# If backup is also corrupted, restore from older backup
./scripts/restore.sh backups/grayfsm_backup_<older_date>.sql.gz
```

#### Lost Data

```bash
# Check if data exists in backup
gunzip -c backups/grayfsm_backup_20251129.sql.gz | grep "INSERT INTO fsms"

# Selective restore (restore specific table)
gunzip -c backups/grayfsm_backup_20251129.sql.gz | \
  grep -A 100 "INSERT INTO fsms" | \
  docker-compose exec -T postgres psql -U grayfsm_user -d grayfsm
```

## Security

### Access Control

```bash
# Create read-only user
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
CREATE ROLE readonly_user WITH LOGIN PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE grayfsm TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
"

# Revoke permissions
REVOKE ALL ON DATABASE grayfsm FROM readonly_user;
```

### Password Management

```bash
# Change database password
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
ALTER USER grayfsm_user WITH PASSWORD 'new_secure_password';
"

# Update .env file with new password
nano .env
```

### SSL/TLS Configuration

For production, enable SSL in `config/postgresql.conf`:

```conf
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
ssl_ca_file = '/path/to/root.crt'
```

## Maintenance Tasks

### Daily Tasks

- [ ] Check monitoring dashboard
- [ ] Review slow query log
- [ ] Verify backup completion
- [ ] Check disk space

### Weekly Tasks

- [ ] Review index usage
- [ ] Analyze query patterns
- [ ] Check for long-running transactions
- [ ] Update statistics (ANALYZE)
- [ ] Review error logs

### Monthly Tasks

- [ ] Test backup restoration
- [ ] Review and optimize queries
- [ ] Check for unused indexes
- [ ] Update PostgreSQL configuration
- [ ] Review access logs
- [ ] Clean up old backups

### Quarterly Tasks

- [ ] Capacity planning review
- [ ] Security audit
- [ ] Performance benchmarking
- [ ] Disaster recovery test
- [ ] PostgreSQL version upgrade planning

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/15/)
- [Database Design Document](/home/arunupscee/Music/grayFSM/database-design.md)
- [Performance Tuning Guide](PERFORMANCE_TUNING.md)
- [Backup and Recovery Guide](BACKUP_RECOVERY.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)

## Support

For issues or questions:
1. Check logs: `docker-compose logs postgres`
2. Run monitoring: `./scripts/monitor.sh`
3. Review troubleshooting section above
4. Contact database team or open GitHub issue
