# GrayFSM Database Quick Start Guide

## Overview

This guide helps you set up the GrayFSM database quickly for development and production environments.

---

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Cloud Database Setup](#cloud-database-setup)
3. [Running Migrations](#running-migrations)
4. [Testing the Database](#testing-the-database)
5. [Connection Examples](#connection-examples)
6. [Troubleshooting](#troubleshooting)

---

## Local Development Setup

### Option 1: PostgreSQL with Docker (Recommended)

**Prerequisites**: Docker installed on your system

```bash
# 1. Create a Docker network for GrayFSM
docker network create grayfsm-network

# 2. Run PostgreSQL container
docker run --name grayfsm-postgres \
  --network grayfsm-network \
  -e POSTGRES_DB=grayfsm \
  -e POSTGRES_USER=grayfsm_user \
  -e POSTGRES_PASSWORD=your_secure_password \
  -p 5432:5432 \
  -v grayfsm-data:/var/lib/postgresql/data \
  -d postgres:15

# 3. Wait for PostgreSQL to start (about 10 seconds)
sleep 10

# 4. Initialize the database schema
docker exec -i grayfsm-postgres psql -U grayfsm_user -d grayfsm < database-schema.sql

# 5. Verify installation
docker exec -it grayfsm-postgres psql -U grayfsm_user -d grayfsm -c "SELECT COUNT(*) FROM categories;"
```

**Connection String**:
```
postgresql://grayfsm_user:your_secure_password@localhost:5432/grayfsm
```

### Option 2: Native PostgreSQL Installation

**For Ubuntu/Debian**:
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE grayfsm;
CREATE USER grayfsm_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE grayfsm TO grayfsm_user;
EOF

# Initialize schema
psql -U grayfsm_user -d grayfsm -f database-schema.sql
```

**For macOS (Homebrew)**:
```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL
brew services start postgresql@15

# Create database
createdb grayfsm

# Initialize schema
psql grayfsm < database-schema.sql
```

**For Windows**:
1. Download PostgreSQL installer from https://www.postgresql.org/download/windows/
2. Run installer and follow wizard
3. Use pgAdmin to create database `grayfsm`
4. Execute `database-schema.sql` in pgAdmin query tool

---

## Cloud Database Setup

### Option 1: Supabase (Free Tier - Recommended for MVP)

1. **Sign up**: Go to https://supabase.com and create account
2. **Create project**:
   - Click "New Project"
   - Set name: `grayfsm`
   - Set strong password
   - Choose region closest to you
   - Wait ~2 minutes for provisioning

3. **Get connection string**:
   - Go to Project Settings > Database
   - Copy "Connection String" (URI format)
   - Replace `[YOUR-PASSWORD]` with your password

4. **Initialize schema**:
   ```bash
   # Using psql
   psql "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres" \
     -f database-schema.sql

   # OR using Supabase SQL Editor (in dashboard)
   # Copy-paste contents of database-schema.sql
   ```

**Connection String**:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres
```

**Pros**:
- Free tier includes 500MB database
- Built-in authentication
- Automatic backups
- Dashboard UI

**Cons**:
- Project pauses after 1 week inactivity (free tier)

---

### Option 2: Railway (Simple Deployment)

1. **Sign up**: Go to https://railway.app
2. **Create project**:
   - Click "New Project"
   - Select "Provision PostgreSQL"
   - Wait for deployment

3. **Get credentials**:
   - Click on PostgreSQL service
   - Go to "Connect" tab
   - Copy "Postgres Connection URL"

4. **Initialize schema**:
   ```bash
   psql [RAILWAY_CONNECTION_URL] -f database-schema.sql
   ```

**Pros**:
- Simple setup
- Auto-scaling
- No sleep on inactivity

**Cons**:
- Free tier limited to $5/month credit

---

### Option 3: AWS RDS (Production)

**For Production Deployments**:

1. **Create RDS Instance**:
   - Go to AWS Console > RDS
   - Click "Create database"
   - Engine: PostgreSQL 15
   - Template: Free tier (or Production for real use)
   - DB instance identifier: `grayfsm-db`
   - Master username: `grayfsm_admin`
   - Set strong master password
   - Storage: 20 GB (expand as needed)
   - Enable automated backups

2. **Configure Security**:
   - VPC security group: Allow PostgreSQL (5432) from your IP
   - Public accessibility: Yes (for development) or No (for production with VPN)

3. **Connect and initialize**:
   ```bash
   psql -h [RDS-ENDPOINT] -U grayfsm_admin -d postgres -f database-schema.sql
   ```

**Connection String**:
```
postgresql://grayfsm_admin:[PASSWORD]@[RDS-ENDPOINT]:5432/postgres
```

**Estimated Costs**:
- Free Tier: $0/month (first 12 months, 750 hours)
- db.t3.micro: ~$15/month
- db.t3.small: ~$30/month
- db.m5.large (production): ~$150/month

---

## Running Migrations

### Using Alembic (Python)

**Setup**:
```bash
# Install Alembic
pip install alembic psycopg2-binary

# Initialize Alembic
alembic init migrations

# Configure alembic.ini
# Set: sqlalchemy.url = postgresql://user:password@localhost/grayfsm
```

**Create migration from schema**:
```bash
# Generate initial migration
alembic revision -m "initial_schema"

# Edit migrations/versions/xxx_initial_schema.py
# Copy table creation logic from database-schema.sql

# Run migration
alembic upgrade head
```

### Using Prisma (TypeScript/Node.js)

**Setup**:
```bash
# Install Prisma
npm install -D prisma
npm install @prisma/client

# Initialize Prisma
npx prisma init

# Configure DATABASE_URL in .env
# DATABASE_URL="postgresql://user:password@localhost:5432/grayfsm"
```

**Generate Prisma schema** (prisma/schema.prisma):
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model FSM {
  id                       String    @id @default(uuid()) @db.Uuid
  name                     String    @db.VarChar(255)
  description              String?
  fsmType                  FSMType
  definition               Json      @db.JsonB
  stateCount               Int
  transitionCount          Int
  initialState             String    @db.VarChar(100)
  bitWidth                 Int
  encodingType             String?   @default("binary") @db.VarChar(50)
  categoryId               String?   @db.Uuid
  tags                     String[]
  version                  Int       @default(1)
  parentFsmId              String?   @db.Uuid
  createdBy                String?   @db.Uuid
  visibility               Visibility @default(PRIVATE)
  isOptimized              Boolean   @default(false)
  optimizationAlgorithm    String?   @db.VarChar(100)
  dummyStateCount          Int       @default(0)
  viewCount                Int       @default(0)
  forkCount                Int       @default(0)
  exportCount              Int       @default(0)
  createdAt                DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt                DateTime  @updatedAt @db.Timestamptz(6)
  lastAccessedAt           DateTime  @default(now()) @db.Timestamptz(6)

  category                 Category?  @relation(fields: [categoryId], references: [id])
  creator                  User?      @relation(fields: [createdBy], references: [id])

  @@index([visibility])
  @@index([categoryId])
  @@index([createdBy])
  @@map("fsms")
}

enum FSMType {
  moore
  mealy
}

enum Visibility {
  private
  public
  unlisted
  example

  @@map("fsm_visibility")
}

// Add other models...
```

**Run migration**:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## Testing the Database

### Quick Smoke Tests

```bash
# Connect to database
psql [YOUR_CONNECTION_STRING]

# Run tests
\i database-tests.sql
```

**Create database-tests.sql**:
```sql
-- Test 1: Verify tables exist
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public';
-- Expected: ~13 tables

-- Test 2: Verify seed data
SELECT COUNT(*) FROM categories;
-- Expected: 5 categories

SELECT COUNT(*) FROM fsms WHERE visibility = 'example';
-- Expected: 1+ example FSM

-- Test 3: Insert test FSM
INSERT INTO fsms (
    name, fsm_type, definition,
    state_count, transition_count, initial_state,
    bit_width, visibility
) VALUES (
    'Test FSM', 'moore', '{}'::jsonb,
    2, 1, 'S0', 1, 'private'
)
RETURNING id;

-- Test 4: Full-text search
SELECT COUNT(*) FROM fsms
WHERE search_vector @@ to_tsquery('english', 'traffic');
-- Expected: 1+ results

-- Test 5: Verify indexes
SELECT COUNT(*) FROM pg_indexes
WHERE schemaname = 'public';
-- Expected: 50+ indexes

\echo 'All tests passed!'
```

### Automated Testing with Python

**Create test_database.py**:
```python
import psycopg2
from psycopg2.extras import Json
import os

def test_database():
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()

    # Test 1: Table existence
    cur.execute("""
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_schema = 'public'
    """)
    table_count = cur.fetchone()[0]
    assert table_count >= 10, f"Expected 10+ tables, got {table_count}"
    print("✓ Tables exist")

    # Test 2: Insert FSM
    cur.execute("""
        INSERT INTO fsms (
            name, fsm_type, definition,
            state_count, transition_count, initial_state,
            bit_width, visibility
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s
        ) RETURNING id
    """, (
        'Test FSM', 'moore', Json({'test': True}),
        2, 1, 'S0', 1, 'private'
    ))
    fsm_id = cur.fetchone()[0]
    assert fsm_id is not None
    print(f"✓ FSM created: {fsm_id}")

    # Test 3: Query FSM
    cur.execute("SELECT name, state_count FROM fsms WHERE id = %s", (fsm_id,))
    result = cur.fetchone()
    assert result[0] == 'Test FSM'
    assert result[1] == 2
    print("✓ FSM queried successfully")

    # Cleanup
    cur.execute("DELETE FROM fsms WHERE id = %s", (fsm_id,))
    conn.commit()
    print("✓ Cleanup complete")

    conn.close()
    print("\n✅ All database tests passed!")

if __name__ == '__main__':
    test_database()
```

**Run tests**:
```bash
pip install psycopg2-binary
export DATABASE_URL="postgresql://user:password@localhost/grayfsm"
python test_database.py
```

---

## Connection Examples

### Python (psycopg2)

```python
import psycopg2
from psycopg2.extras import RealDictCursor, Json

# Connect
conn = psycopg2.connect(
    host="localhost",
    database="grayfsm",
    user="grayfsm_user",
    password="your_secure_password"
)

# Query with dict cursor
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT * FROM fsms WHERE visibility = 'public' LIMIT 10")
fsms = cur.fetchall()

for fsm in fsms:
    print(f"{fsm['name']}: {fsm['state_count']} states")

# Insert FSM
cur.execute("""
    INSERT INTO fsms (name, fsm_type, definition, state_count,
                      transition_count, initial_state, bit_width)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    RETURNING id
""", ('My FSM', 'moore', Json({'states': []}), 3, 2, 'S0', 2))

fsm_id = cur.fetchone()['id']
conn.commit()

conn.close()
```

### Python (SQLAlchemy)

```python
from sqlalchemy import create_engine, Column, String, Integer, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import UUID
import uuid

# Setup
engine = create_engine('postgresql://user:password@localhost/grayfsm')
Base = declarative_base()
Session = sessionmaker(bind=engine)

# Define model
class FSM(Base):
    __tablename__ = 'fsms'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    fsm_type = Column(String(10), nullable=False)
    definition = Column(JSON, nullable=False)
    state_count = Column(Integer, nullable=False)
    # ... other columns

# Query
session = Session()
fsms = session.query(FSM).filter(FSM.visibility == 'public').limit(10).all()

for fsm in fsms:
    print(f"{fsm.name}: {fsm.state_count} states")

# Insert
new_fsm = FSM(
    name='My FSM',
    fsm_type='moore',
    definition={'states': []},
    state_count=3,
    transition_count=2,
    initial_state='S0',
    bit_width=2
)
session.add(new_fsm)
session.commit()

session.close()
```

### Node.js (node-postgres)

```javascript
const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  host: 'localhost',
  database: 'grayfsm',
  user: 'grayfsm_user',
  password: 'your_secure_password',
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000
});

// Query
async function getFSMs() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM fsms WHERE visibility = $1 LIMIT $2',
      ['public', 10]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

// Insert
async function createFSM(fsm) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO fsms (name, fsm_type, definition, state_count,
                         transition_count, initial_state, bit_width)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [fsm.name, fsm.fsmType, fsm.definition, fsm.stateCount,
       fsm.transitionCount, fsm.initialState, fsm.bitWidth]
    );
    return result.rows[0].id;
  } finally {
    client.release();
  }
}

// Usage
(async () => {
  const fsms = await getFSMs();
  console.log(`Found ${fsms.length} FSMs`);

  const newId = await createFSM({
    name: 'My FSM',
    fsmType: 'moore',
    definition: { states: [] },
    stateCount: 3,
    transitionCount: 2,
    initialState: 'S0',
    bitWidth: 2
  });
  console.log(`Created FSM with ID: ${newId}`);

  await pool.end();
})();
```

### Node.js (Prisma)

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Query
  const fsms = await prisma.fSM.findMany({
    where: { visibility: 'PUBLIC' },
    take: 10,
    include: {
      category: true,
      creator: true
    }
  });

  console.log(`Found ${fsms.length} FSMs`);

  // Insert
  const newFsm = await prisma.fSM.create({
    data: {
      name: 'My FSM',
      fsmType: 'MOORE',
      definition: { states: [] },
      stateCount: 3,
      transitionCount: 2,
      initialState: 'S0',
      bitWidth: 2,
      visibility: 'PRIVATE'
    }
  });

  console.log(`Created FSM: ${newFsm.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Troubleshooting

### Issue: "Connection refused"

**Cause**: PostgreSQL not running or wrong host/port

**Solution**:
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list  # macOS

# Start PostgreSQL
sudo systemctl start postgresql  # Linux
brew services start postgresql  # macOS

# Check port
sudo netstat -tlnp | grep 5432  # Linux
lsof -i :5432  # macOS
```

### Issue: "Authentication failed"

**Cause**: Wrong username/password

**Solution**:
```bash
# Reset password (as postgres user)
sudo -u postgres psql
ALTER USER grayfsm_user WITH PASSWORD 'new_password';
\q
```

### Issue: "Database does not exist"

**Cause**: Database not created

**Solution**:
```bash
# Create database
createdb grayfsm

# Or via psql
sudo -u postgres psql
CREATE DATABASE grayfsm;
\q
```

### Issue: "Permission denied for schema public"

**Cause**: User lacks privileges

**Solution**:
```sql
-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE grayfsm TO grayfsm_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO grayfsm_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO grayfsm_user;
```

### Issue: "Out of memory" during large imports

**Cause**: Large FSM definitions

**Solution**:
```bash
# Increase PostgreSQL memory settings in postgresql.conf
shared_buffers = 256MB
work_mem = 16MB

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Issue: Slow queries

**Cause**: Missing indexes or outdated statistics

**Solution**:
```sql
-- Analyze tables
ANALYZE fsms;
ANALYZE algorithm_results;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public' AND tablename = 'fsms';

-- Create custom index if needed
CREATE INDEX idx_custom ON fsms(column_name);
```

---

## Next Steps

1. **Initialize the database** using one of the setup methods above
2. **Test the connection** using connection examples
3. **Run smoke tests** to verify everything works
4. **Set up backups** (see database-design.md for backup strategies)
5. **Configure your application** to use the database
6. **Monitor performance** as you add data

---

## Additional Resources

- **Full Database Design**: See `database-design.md`
- **SQL Schema**: See `database-schema.sql`
- **Sample Queries**: See `database-queries.sql`
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Supabase Docs**: https://supabase.com/docs
- **Railway Docs**: https://docs.railway.app/

---

**Need Help?**

- Check the troubleshooting section above
- Review PostgreSQL logs: `/var/log/postgresql/` (Linux) or `~/Library/Application Support/Postgres/` (macOS)
- Open an issue on the project repository

---

**Happy Building! 🚀**
