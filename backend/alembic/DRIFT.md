# Migration drift — RESOLVED

Status: **fixed by `f5125b99928d_align_head_with_models.py`** (and the `include_object` filter added to `alembic/env.py`).

`alembic check` now runs in CI as part of the Database Migration workflow and passes cleanly.

## What the fix did

1. **`f5125b99928d_align_head_with_models.py`** (this migration) adds:
   - The `fsms.created_by -> users.id` foreign key the model declared but the original migration didn't include
   - `users.is_active` -> nullable (matches model default)
   - `users.created_at` / `updated_at` -> `DateTime(timezone=True)` (matches model)
   - `idx_users_email`, `idx_users_is_active` indexes the model declares via `Column(..., index=True)`

2. **`alembic/env.py`** gained an `include_object` filter listing the 17 Postgres-specific indexes that exist in `b2c3d4e5f6a7_performance_indexes.py` but aren't expressible in SQLAlchemy column declarations (GIN, FTS, partial WHERE, expression-based, INCLUDE columns). The filter tells autogenerate to ignore them when comparing DB → models, so they remain in the database without showing up as "drift".

If you add new performance indexes via raw SQL migrations, append their names to `PG_ONLY_INDEXES` in `env.py`.

## Local verification

```bash
docker run -d --name grayfsm-pg-drift \
  -e POSTGRES_USER=grayfsm -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=grayfsm \
  -p 5435:5432 postgres:15-alpine

cd backend
DATABASE_URL=postgresql+asyncpg://grayfsm:devpass@localhost:5435/grayfsm \
SECRET_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))') \
REDIS_URL=redis://localhost:6379/0 \
alembic upgrade head && alembic check && alembic downgrade -1 && alembic upgrade head && alembic check
```

Both `alembic check` invocations should print "No new upgrade operations detected."
