# GrayFSM Backend

FastAPI service for FSM storage, Gray-code optimisation, and HDL export.

- `app/` — HTTP application (routes, schemas, services, middleware, ORM).
- `src/grayfsm/` — standalone CLI and library. Imports its algorithms from
  `app.core.*`; that module is the single source of truth.
- `alembic/` — migration history. The schema in `database/` is a reference
  snapshot only.
- `examples/` — built-in example FSMs served by `/api/v1/examples`.
- `tests/` — pytest unit + integration tests.

## Run

```bash
cp .env.example .env
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Swagger UI: <http://localhost:8000/docs>.

## More

See [`docs/RUNBOOK.md`](../docs/RUNBOOK.md) for the canonical runbook
(deployment, environment variables, operational tasks, subsystem map, and
recent feature shipping log).

For migration drift policy: [`alembic/DRIFT.md`](alembic/DRIFT.md).
For the mypy-strict rollout plan: [`MYPY-STRICT-PLAN.md`](MYPY-STRICT-PLAN.md).
