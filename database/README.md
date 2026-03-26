# GrayFSM Database Implementation

Comprehensive database layer implementation for the GrayFSM project with PostgreSQL 15, optimized queries, monitoring, and administration tools.

## Directory Structure

```
database/
├── README.md                          # This file
├── docker-compose.yml                 # Docker Compose configuration
├── .env.example                       # Environment variables template
├── alembic.ini                        # Alembic configuration
├── alembic/                           # Database migrations
│   ├── env.py                         # Alembic environment
│   ├── README                         # Migration instructions
│   ├── script.py.mako                 # Migration template
│   └── versions/                      # Migration versions
│       └── 001_initial_schema.py      # Initial schema migration
├── init/                              # Initialization scripts
│   ├── 01_extensions.sql              # PostgreSQL extensions
│   ├── 02_schema.sql                  # Database schema
│   └── 03_seed_data.sql               # Seed data
├── config/                            # Configuration files
│   ├── postgresql.conf                # PostgreSQL configuration
│   ├── postgresql.dev.conf            # Development settings
│   ├── postgresql.prod.conf           # Production settings
│   ├── pgadmin_servers.json           # pgAdmin server configuration
│   └── redis.conf                     # Redis configuration
├── queries/                           # Optimized queries
│   ├── common_queries.sql             # Frequently used queries
│   ├── stored_procedures.sql          # Stored procedures & functions
│   ├── materialized_views.sql         # Materialized views
│   └── performance_queries.sql        # Performance analysis queries
├── scripts/                           # Maintenance scripts
│   ├── backup.sh                      # Backup script
│   ├── restore.sh                     # Restore script
│   ├── vacuum.sh                      # Vacuum and analyze
│   ├── monitor.sh                     # Monitoring script
│   └── setup.sh                       # Initial setup script
├── backups/                           # Backup storage
│   └── .gitkeep
├── tests/                             # Database tests
│   ├── test_schema.py                 # Schema validation tests
│   ├── test_queries.py                # Query performance tests
│   └── fixtures/                      # Test data fixtures
└── docs/                              # Documentation
    ├── DATABASE_ADMIN_GUIDE.md        # Admin guide
    ├── PERFORMANCE_TUNING.md          # Performance tuning guide
    ├── BACKUP_RECOVERY.md             # Backup & recovery procedures
    └── TROUBLESHOOTING.md             # Troubleshooting guide
```

## Quick Start

### 1. Initial Setup

```bash
# Clone repository and navigate to database directory
cd /home/arunupscee/Music/grayFSM/database

# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env

# Make scripts executable
chmod +x scripts/*.sh
```

### 2. Start Database (Development)

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Check status
docker-compose ps

# View logs
docker-compose logs -f postgres

# Verify connection
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "SELECT version();"
```

### 3. Run Migrations

```bash
# Initialize Alembic (first time only)
alembic init alembic

# Apply migrations
alembic upgrade head

# Check current version
alembic current
```

### 4. Load Seed Data

```bash
# Load initial categories and example FSMs
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -f /docker-entrypoint-initdb.d/03_seed_data.sql
```

### 5. Start Optional Services

```bash
# Start pgAdmin (database management UI)
docker-compose --profile tools up -d pgadmin

# Access pgAdmin at http://localhost:5050
# Email: admin@grayfsm.com
# Password: admin

# Start Redis (caching)
docker-compose --profile cache up -d redis
```

## Database Management

### Connection Information

- **Host**: localhost
- **Port**: 5432
- **Database**: grayfsm
- **User**: grayfsm_user
- **Password**: (from .env)

**Connection String**:
```
postgresql://grayfsm_user:grayfsm_password@localhost:5432/grayfsm
```

**SQLAlchemy Async Connection**:
```
postgresql+asyncpg://grayfsm_user:grayfsm_password@localhost:5432/grayfsm
```

### Common Commands

```bash
# Connect to database
docker-compose exec postgres psql -U grayfsm_user -d grayfsm

# Execute SQL file
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -f /path/to/file.sql

# Dump database
docker-compose exec postgres pg_dump -U grayfsm_user grayfsm > backup.sql

# Restore database
docker-compose exec -T postgres psql -U grayfsm_user -d grayfsm < backup.sql

# Create new migration
alembic revision -m "description of changes"

# Upgrade to specific version
alembic upgrade <revision_id>

# Downgrade one version
alembic downgrade -1

# Show migration history
alembic history
```

## Backup and Recovery

### Automated Backups

Automated backups run daily at 2 AM (configurable in `.env`):

```bash
# Start backup service
docker-compose --profile backup up -d backup

# Manual backup
./scripts/backup.sh

# List backups
ls -lh backups/
```

### Restore from Backup

```bash
# Restore specific backup
./scripts/restore.sh backups/grayfsm_backup_20251129.sql

# Restore latest backup
./scripts/restore.sh backups/$(ls -t backups/ | head -1)
```

See `docs/BACKUP_RECOVERY.md` for detailed procedures.

## Performance Monitoring

### Monitor Database Performance

```bash
# Run monitoring script
./scripts/monitor.sh

# Check slow queries
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;"

# Check table sizes
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -f /scripts/table_sizes.sql

# Check index usage
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -f /scripts/index_usage.sql
```

### Performance Tuning

```bash
# Analyze tables
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "ANALYZE;"

# Vacuum database
./scripts/vacuum.sh

# Reindex specific table
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "REINDEX TABLE fsms;"
```

## Testing

### Run Database Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio sqlalchemy[asyncpg]

# Run tests
cd tests
pytest test_schema.py -v
pytest test_queries.py -v

# Run with coverage
pytest --cov=../alembic --cov-report=html
```

## Optimization Features

### 1. **Indexes**
- Primary key indexes on all ID columns
- Foreign key indexes for relationships
- GIN indexes for JSONB and full-text search
- Partial indexes for frequently filtered queries
- Composite indexes for common query patterns

### 2. **Caching**
- Export cache table for generated HDL code
- Materialized views for expensive aggregations
- Redis integration for session/API caching

### 3. **Connection Pooling**
- Configurable pool size (default: 20 connections)
- Max overflow: 10 additional connections
- Connection recycling: 1 hour
- Automatic retry on connection failures

### 4. **Query Optimization**
- Prepared statements for common queries
- Query result pagination
- Efficient JOIN strategies
- EXPLAIN ANALYZE examples in `queries/performance_queries.sql`

### 5. **Data Integrity**
- Foreign key constraints
- Check constraints for validation
- Triggers for auto-updating timestamps
- Row-level security policies (Phase 4)

## Migration Strategy

### Creating Migrations

```bash
# Auto-generate migration from model changes
alembic revision --autogenerate -m "Add new field to fsms table"

# Create empty migration
alembic revision -m "Custom migration"

# Edit generated migration
nano alembic/versions/<revision>_description.py
```

### Migration Best Practices

1. **Always review auto-generated migrations**
2. **Test migrations on copy of production data**
3. **Include rollback logic in downgrade()**
4. **Never modify existing migrations after deployment**
5. **Use transactions for safety**
6. **Document breaking changes**

### Production Migration Workflow

```bash
# 1. Backup database
./scripts/backup.sh

# 2. Test migration in staging
alembic upgrade head --sql > migration.sql
# Review migration.sql

# 3. Apply migration
alembic upgrade head

# 4. Verify migration
alembic current

# 5. Rollback if needed
alembic downgrade -1
```

## Environment-Specific Configuration

### Development

```bash
# Use development config
docker-compose --env-file .env.dev up -d

# Enable query logging
# In .env.dev: LOG_QUERIES=true
```

### Staging

```bash
# Use staging config
docker-compose --env-file .env.staging up -d

# Performance monitoring enabled
# Backups retained for 30 days
```

### Production

```bash
# Use production config with optimized settings
docker-compose --env-file .env.prod up -d

# Features:
# - Optimized PostgreSQL configuration
# - Automated backups
# - Monitoring enabled
# - Row-level security
# - Connection pooling
```

## Troubleshooting

### Common Issues

**1. Connection Refused**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart service
docker-compose restart postgres
```

**2. Slow Queries**
```bash
# Enable pg_stat_statements
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

# Find slow queries
cat queries/performance_queries.sql | docker-compose exec -T postgres psql -U grayfsm_user -d grayfsm
```

**3. Disk Space Issues**
```bash
# Check database size
docker-compose exec postgres psql -U grayfsm_user -d grayfsm -c "
SELECT pg_size_pretty(pg_database_size('grayfsm'));"

# Vacuum to reclaim space
./scripts/vacuum.sh
```

**4. Migration Conflicts**
```bash
# Show migration history
alembic history

# Stamp current version
alembic stamp head

# Resolve conflicts
alembic branches
```

See `docs/TROUBLESHOOTING.md` for comprehensive troubleshooting guide.

## Security Considerations

### 1. **Password Security**
- Use strong passwords (min 16 characters)
- Never commit `.env` to version control
- Rotate passwords regularly
- Use environment-specific credentials

### 2. **Network Security**
- Use Docker networks for service isolation
- Expose only necessary ports
- Use SSL/TLS for production connections
- Implement IP whitelisting

### 3. **Access Control**
- Create read-only database users for reporting
- Use separate users for application and admin
- Implement row-level security (Phase 4)
- Audit user activities

### 4. **Data Protection**
- Encrypt sensitive data at rest
- Use SSL for database connections
- Regular security audits
- Automated vulnerability scanning

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Performance**
   - Query response time (p50, p95, p99)
   - Connection pool usage
   - Cache hit ratio
   - Index usage

2. **Health**
   - Database uptime
   - Replication lag (if applicable)
   - Disk space usage
   - Lock contention

3. **Usage**
   - Active connections
   - Transactions per second
   - Row operations (INSERT/UPDATE/DELETE)
   - Table sizes

### Set Up Alerts

```bash
# Monitor script runs every 5 minutes
*/5 * * * * /path/to/database/scripts/monitor.sh >> /var/log/grayfsm_monitor.log 2>&1

# Alert on slow queries (>1s)
# Alert on disk usage >80%
# Alert on connection pool >90% full
# Alert on backup failures
```

## Resources

- **PostgreSQL Documentation**: https://www.postgresql.org/docs/15/
- **Alembic Documentation**: https://alembic.sqlalchemy.org/
- **SQLAlchemy Documentation**: https://docs.sqlalchemy.org/
- **Docker Compose Documentation**: https://docs.docker.com/compose/

## Support

For issues or questions:
1. Check `docs/TROUBLESHOOTING.md`
2. Review database logs: `docker-compose logs postgres`
3. Open issue on GitHub
4. Contact database team

## License

Same as GrayFSM project license.
