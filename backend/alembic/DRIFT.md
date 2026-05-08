# Migration drift follow-up

`alembic check` is currently **disabled** in `.github/workflows/database-migration.yml` because the head migration has drifted from the SQLAlchemy models. This document captures what `alembic check` reported on 2026-05-08 so a follow-up PR can fix the drift and re-enable the check.

## What `alembic check` flagged

Captured from CI log (run 25569335655, job 75060769824), categorized:

### A. Indexes in migrations but not in models (~17 entries)

These were added in `b2c3d4e5f6a7_performance_indexes.py` — they're PostgreSQL-specific performance indexes (GIN, full-text, expression-based) that aren't easy to express in vanilla SQLAlchemy `Column(index=True)`:

- `idx_algorithm_results_algorithm_performance`, `idx_algorithm_results_fsm_algorithm_time`, `idx_algorithm_results_success_improvement`
- `idx_categories_fsm_count`, `idx_categories_parent_level_order`
- `idx_fsms_created_at_desc`, `idx_fsms_created_by_visibility_created`, `idx_fsms_definition_gin`, `idx_fsms_definition_states`, `idx_fsms_definition_transitions`, `idx_fsms_is_optimized_algorithm_created`, `idx_fsms_list_covering`, `idx_fsms_popular`, `idx_fsms_recently_updated`, `idx_fsms_search_text`, `idx_fsms_tags_gin`, `idx_fsms_visibility_category_created`

**Recommended fix:** add an `include_object` callback in `alembic/env.py` to ignore these specific indexes (they're real and useful, they just can't be modeled in SQLAlchemy). Example:

```python
PG_ONLY_INDEXES = {
    "idx_fsms_definition_gin",
    "idx_fsms_search_text",
    # ...
}

def include_object(object, name, type_, reflected, compare_to):
    if type_ == "index" and name in PG_ONLY_INDEXES:
        return False
    return True

context.configure(..., include_object=include_object)
```

### B. Foreign key in model but not in migration

- `fsms.created_by` has `ForeignKey('users.id')` declared in the model, but the migration that added the `created_by` column didn't include a foreign-key constraint.

**Fix:** new migration that adds the FK:
```python
op.create_foreign_key(
    "fk_fsms_created_by_users",
    "fsms", "users", ["created_by"], ["id"],
    ondelete="SET NULL",
)
```

### C. users table column drift

- `users.is_active`: model says `nullable=False`, migration left it nullable
- `users.created_at`: model has `DateTime(timezone=True)`, migration has `TIMESTAMP` (timezone-naive)
- `users.updated_at`: same — migration `TIMESTAMP`, model `DateTime(timezone=True)`

**Fix:** new migration with three `op.alter_column` calls to bring each into line.

### D. Indexes in model but not in migration

- `idx_users_email` (from `Column('email', String(255), index=True)`)
- `idx_users_is_active` (from `Column('is_active', Boolean, index=True)`)

**Fix:** add `op.create_index` for both in the same follow-up migration as B/C.

## Running this locally

The fix needs a live Postgres because `alembic check` runs in online mode (the codebase uses `async_engine_from_config`).

```bash
# 1. Bring up Postgres + Redis
cd infrastructure/docker && docker compose -f docker-compose.dev.yml up -d postgres redis

# 2. Apply current migrations
cd backend
DATABASE_URL=postgresql+asyncpg://grayfsm:devpass@localhost:5432/grayfsm \
  alembic upgrade head

# 3. Generate the drift migration
DATABASE_URL=postgresql+asyncpg://grayfsm:devpass@localhost:5432/grayfsm \
  alembic revision --autogenerate -m "align head migration with models"

# 4. Review the generated file in alembic/versions/. Manually:
#    - Remove the `op.drop_index(...)` calls for the PG-only indexes (those
#      should stay; instead implement the env.py `include_object` filter).
#    - Keep the FK creation, column type/nullable changes, and new indexes.

# 5. Apply forward and back to verify round-trip
alembic upgrade head
alembic downgrade -1
alembic upgrade head

# 6. Confirm clean
alembic check
```

## Re-enabling `alembic check` in CI

Once the drift migration is committed, restore the `alembic check` step in `.github/workflows/database-migration.yml`:

```yaml
- name: Validate migration sync
  env:
    DATABASE_URL: postgresql+asyncpg://grayfsm:testpass@localhost:5432/grayfsm_migration_test
  run: |
    cd backend
    alembic check
```

Place it AFTER the upgrade-head step (the check needs a populated DB).
