#!/bin/bash
# ================================================================
# GrayFSM Database Monitoring Script
# Collects and displays database health metrics
# ================================================================

set -euo pipefail

# ----------------------------------------------------------------
# CONFIGURATION
# ----------------------------------------------------------------

# Load environment variables
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Database configuration
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-grayfsm}"
POSTGRES_USER="${POSTGRES_USER:-grayfsm_user}"
PGPASSWORD="${POSTGRES_PASSWORD:-grayfsm_password}"
export PGPASSWORD

# Monitoring thresholds
MAX_CONNECTIONS_PCT=80
MAX_DISK_USAGE_PCT=80
SLOW_QUERY_THRESHOLD_MS=1000
MIN_CACHE_HIT_RATIO=0.95

# ----------------------------------------------------------------
# FUNCTIONS
# ----------------------------------------------------------------

header() {
    echo ""
    echo "================================================================"
    echo "$1"
    echo "================================================================"
}

metric() {
    printf "%-40s: %s\n" "$1" "$2"
}

alert() {
    echo "⚠️  ALERT: $1"
}

ok() {
    echo "✓ $1"
}

# Execute SQL query
query() {
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "$1" 2>/dev/null | xargs
}

# ----------------------------------------------------------------
# MONITORING CHECKS
# ----------------------------------------------------------------

header "GrayFSM Database Health Check"
metric "Timestamp" "$(date '+%Y-%m-%d %H:%M:%S')"
metric "Database" "$POSTGRES_DB"
metric "Host" "$POSTGRES_HOST:$POSTGRES_PORT"

# ----------------------------------------------------------------
# 1. DATABASE STATUS
# ----------------------------------------------------------------

header "Database Status"

# Check if database is accessible
if pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    ok "Database is accessible"
else
    alert "Cannot connect to database"
    exit 1
fi

# PostgreSQL version
PG_VERSION=$(query "SELECT version()")
metric "PostgreSQL Version" "${PG_VERSION:0:80}"

# Database size
DB_SIZE=$(query "SELECT pg_size_pretty(pg_database_size('$POSTGRES_DB'))")
metric "Database Size" "$DB_SIZE"

# Uptime
UPTIME=$(query "SELECT EXTRACT(EPOCH FROM (NOW() - pg_postmaster_start_time()))::INTEGER")
UPTIME_HOURS=$((UPTIME / 3600))
metric "Uptime" "${UPTIME_HOURS} hours"

# ----------------------------------------------------------------
# 2. CONNECTION STATUS
# ----------------------------------------------------------------

header "Connections"

MAX_CONN=$(query "SHOW max_connections")
ACTIVE_CONN=$(query "SELECT count(*) FROM pg_stat_activity WHERE state = 'active'")
IDLE_CONN=$(query "SELECT count(*) FROM pg_stat_activity WHERE state = 'idle'")
TOTAL_CONN=$(query "SELECT count(*) FROM pg_stat_activity")

metric "Max Connections" "$MAX_CONN"
metric "Active Connections" "$ACTIVE_CONN"
metric "Idle Connections" "$IDLE_CONN"
metric "Total Connections" "$TOTAL_CONN"

CONN_PCT=$((TOTAL_CONN * 100 / MAX_CONN))
metric "Connection Usage" "${CONN_PCT}%"

if [ "$CONN_PCT" -gt "$MAX_CONNECTIONS_PCT" ]; then
    alert "Connection usage is high (${CONN_PCT}%)"
fi

# ----------------------------------------------------------------
# 3. QUERY PERFORMANCE
# ----------------------------------------------------------------

header "Query Performance"

# Check if pg_stat_statements is enabled
if query "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'" | grep -q 1; then
    # Slowest queries
    SLOW_QUERIES=$(query "
        SELECT count(*)
        FROM pg_stat_statements
        WHERE mean_exec_time > $SLOW_QUERY_THRESHOLD_MS
    ")

    metric "Slow Queries (>${SLOW_QUERY_THRESHOLD_MS}ms)" "$SLOW_QUERIES"

    if [ "$SLOW_QUERIES" -gt 0 ]; then
        echo ""
        echo "Top 5 Slowest Queries:"
        psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
            SELECT
                LEFT(query, 60) as query,
                calls,
                ROUND(mean_exec_time::numeric, 2) as avg_time_ms
            FROM pg_stat_statements
            ORDER BY mean_exec_time DESC
            LIMIT 5
        "
    fi

    # Total queries
    TOTAL_QUERIES=$(query "SELECT sum(calls) FROM pg_stat_statements")
    metric "Total Queries Executed" "$TOTAL_QUERIES"
else
    metric "pg_stat_statements" "Not enabled"
fi

# ----------------------------------------------------------------
# 4. CACHE HIT RATIO
# ----------------------------------------------------------------

header "Cache Performance"

CACHE_HIT_RATIO=$(query "
    SELECT ROUND(
        sum(blks_hit) / NULLIF(sum(blks_hit + blks_read), 0),
        4
    )
    FROM pg_stat_database
    WHERE datname = '$POSTGRES_DB'
")

metric "Cache Hit Ratio" "${CACHE_HIT_RATIO}"

if (( $(echo "$CACHE_HIT_RATIO < $MIN_CACHE_HIT_RATIO" | bc -l) )); then
    alert "Cache hit ratio is low (${CACHE_HIT_RATIO})"
fi

# ----------------------------------------------------------------
# 5. TABLE STATISTICS
# ----------------------------------------------------------------

header "Table Statistics"

TABLE_COUNT=$(query "
    SELECT count(*)
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
")

metric "Total Tables" "$TABLE_COUNT"

# Largest tables
echo ""
echo "Top 5 Largest Tables:"
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 5
"

# ----------------------------------------------------------------
# 6. APPLICATION METRICS
# ----------------------------------------------------------------

header "Application Metrics"

FSM_COUNT=$(query "SELECT count(*) FROM fsms")
PUBLIC_FSM_COUNT=$(query "SELECT count(*) FROM fsms WHERE visibility = 'public'")
USER_COUNT=$(query "SELECT count(*) FROM users" 2>/dev/null || echo "0")
ALGO_RESULT_COUNT=$(query "SELECT count(*) FROM algorithm_results")

metric "Total FSMs" "$FSM_COUNT"
metric "Public FSMs" "$PUBLIC_FSM_COUNT"
metric "Total Users" "$USER_COUNT"
metric "Algorithm Results" "$ALGO_RESULT_COUNT"

# Recent activity (last 24 hours)
RECENT_FSMS=$(query "
    SELECT count(*)
    FROM fsms
    WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
")

metric "FSMs Created (24h)" "$RECENT_FSMS"

# ----------------------------------------------------------------
# 7. LOCKS AND BLOCKING
# ----------------------------------------------------------------

header "Locks"

BLOCKING_QUERIES=$(query "
    SELECT count(*)
    FROM pg_stat_activity
    WHERE wait_event_type = 'Lock'
")

metric "Blocking Queries" "$BLOCKING_QUERIES"

if [ "$BLOCKING_QUERIES" -gt 0 ]; then
    alert "Found $BLOCKING_QUERIES blocking queries"
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
        SELECT
            pid,
            usename,
            LEFT(query, 50) as query,
            wait_event_type,
            wait_event
        FROM pg_stat_activity
        WHERE wait_event_type = 'Lock'
    "
fi

# ----------------------------------------------------------------
# 8. AUTOVACUUM STATUS
# ----------------------------------------------------------------

header "Autovacuum Status"

LAST_VACUUM=$(query "
    SELECT MAX(last_autovacuum)
    FROM pg_stat_user_tables
    WHERE last_autovacuum IS NOT NULL
")

LAST_ANALYZE=$(query "
    SELECT MAX(last_autoanalyze)
    FROM pg_stat_user_tables
    WHERE last_autoanalyze IS NOT NULL
")

metric "Last Autovacuum" "${LAST_VACUUM:-Never}"
metric "Last Autoanalyze" "${LAST_ANALYZE:-Never}"

# Tables needing vacuum
TABLES_NEED_VACUUM=$(query "
    SELECT count(*)
    FROM pg_stat_user_tables
    WHERE n_dead_tup > 1000
")

metric "Tables Needing Vacuum" "$TABLES_NEED_VACUUM"

if [ "$TABLES_NEED_VACUUM" -gt 5 ]; then
    alert "$TABLES_NEED_VACUUM tables have significant dead tuples"
fi

# ----------------------------------------------------------------
# 9. REPLICATION STATUS (if applicable)
# ----------------------------------------------------------------

header "Replication Status"

REPLICATION_SLOTS=$(query "SELECT count(*) FROM pg_replication_slots" 2>/dev/null || echo "0")
metric "Replication Slots" "$REPLICATION_SLOTS"

if [ "$REPLICATION_SLOTS" -gt 0 ]; then
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
        SELECT
            slot_name,
            slot_type,
            active
        FROM pg_replication_slots
    "
fi

# ----------------------------------------------------------------
# 10. BACKUPS
# ----------------------------------------------------------------

header "Backup Status"

BACKUP_DIR="${BACKUP_DIR:-./backups}"

if [ -d "$BACKUP_DIR" ]; then
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/${POSTGRES_DB}_backup_*.sql.gz 2>/dev/null | head -1)

    if [ -n "$LATEST_BACKUP" ]; then
        BACKUP_AGE=$(find "$LATEST_BACKUP" -mtime +1 | wc -l)
        BACKUP_TIME=$(stat -c %y "$LATEST_BACKUP" | cut -d' ' -f1-2)
        BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)

        metric "Latest Backup" "$(basename $LATEST_BACKUP)"
        metric "Backup Time" "$BACKUP_TIME"
        metric "Backup Size" "$BACKUP_SIZE"

        if [ "$BACKUP_AGE" -gt 0 ]; then
            alert "Latest backup is older than 24 hours"
        else
            ok "Backup is recent"
        fi
    else
        alert "No backups found in $BACKUP_DIR"
    fi
else
    alert "Backup directory not found: $BACKUP_DIR"
fi

# ----------------------------------------------------------------
# SUMMARY
# ----------------------------------------------------------------

header "Health Summary"

ISSUES=0

# Check all critical metrics
if [ "$CONN_PCT" -gt "$MAX_CONNECTIONS_PCT" ]; then
    ((ISSUES++))
fi

if (( $(echo "$CACHE_HIT_RATIO < $MIN_CACHE_HIT_RATIO" | bc -l) )); then
    ((ISSUES++))
fi

if [ "$BLOCKING_QUERIES" -gt 0 ]; then
    ((ISSUES++))
fi

if [ "$TABLES_NEED_VACUUM" -gt 5 ]; then
    ((ISSUES++))
fi

if [ "$ISSUES" -eq 0 ]; then
    ok "All health checks passed!"
else
    alert "Found $ISSUES issue(s) that need attention"
fi

header "End of Health Check"

exit $ISSUES
