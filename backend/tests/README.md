# Backend tests

The repo has two test trees and they cover **different things** — don't add tests in the wrong one.

## `backend/tests/`

Backend-only tests that don't need a running HTTP server or database.

- **`test_core/`** — Unit tests for `app/core/*` algorithms (Gray code, hypercube, optimizers, exporters). Pure-function tests; no DB. CI invokes them via `cd backend && pytest tests/test_core/` (`ci-cd.yml: Backend Tests & Quality Checks`).
- **`integration/test_hdl_roundtrip.py`** — Imports the exporters directly and runs `iverilog`/`ghdl` against their output. Lives here (not the root tests/) because it imports from `app.core.exporters` and would have to fight an import path otherwise. CI invokes it via `pytest tests/integration/test_hdl_roundtrip.py`.

## `tests/` (repo root)

End-to-end + integration tests that hit the running API via httpx.

- **`integration/`** — POSTs to `/api/v1/...` and asserts on responses. CI runs the whole directory.
- **`contract/`** — Schemathesis + Dredd against the OpenAPI spec.
- **`load/`** — Locust load tests (run on schedule, not per-PR).

## Why two trees?

Pre-existing convention. The duplicate integration suites that were once in `backend/tests/integration/` (export, fsm, optimization, health) have been removed — those exact tests live in the root `tests/integration/` and are what CI runs.
