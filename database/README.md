# GrayFSM Database

Reference snapshots, init SQL, optimized query examples, and ops helpers
for the Postgres layer. **The authoritative schema lives in
`backend/alembic/versions/`** — anything here is a snapshot or a tool, not
a source of truth.

- `init/` — bootstrap SQL (extensions, base schema, seed data) for fresh
  Postgres instances.
- `config/` — Postgres / Redis / pgAdmin configuration files.
- `queries/` — frequently-used SQL examples for ops and analytics.
- `scripts/` — admin scripts (backup, restore, etc.).
- `docs/` — admin guide and quick-reference.

## More

See [`docs/RUNBOOK.md`](../docs/RUNBOOK.md) for migration commands and
operational tasks. Use `alembic upgrade head` from `backend/` — not the
SQL files here — to apply schema changes.
