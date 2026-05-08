# Contributing to grayFSM

Thanks for your interest in contributing. This document covers the local setup, code-style expectations, branching, and how to file bugs or security issues.

## Local setup

1. **Clone**, then **mandatory environment file**:

   ```bash
   cp backend/.env.example backend/.env
   ```

   This is required — the in-code defaults are placeholders that get rejected by the production-config validator and won't form valid SQLAlchemy URLs at runtime.

2. **Backend**:

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Frontend**:

   ```bash
   cd frontend
   npm install
   ```

4. **Database + Redis** (one-shot via Docker):

   ```bash
   docker run -d --name grayfsm-pg \
     -e POSTGRES_USER=grayfsm -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=grayfsm \
     -p 5432:5432 postgres:15-alpine
   docker run -d --name grayfsm-redis -p 6379:6379 redis:7-alpine
   ```

   (Update `backend/.env` to match: `DATABASE_URL=postgresql+asyncpg://grayfsm:devpass@localhost:5432/grayfsm`.)

5. **Apply migrations**:

   ```bash
   cd backend && alembic upgrade head
   ```

6. **Install pre-commit hooks** *(required before your first commit)*:

   ```bash
   pip install pre-commit
   pre-commit install
   ```

   This wires up gitleaks (secrets scan), ruff (Python lint + format), and prettier (frontend format). If you skip this step, CI will catch the same issues but you'll round-trip a few times.

## Running the app

| What | Command |
|---|---|
| Backend dev server | `cd backend && uvicorn app.main:app --reload` |
| Frontend dev server | `cd frontend && npm run dev` (proxies `/api` to backend) |
| Backend unit tests | `cd backend && pytest tests/test_core/` |
| Backend HDL round-trip | `cd backend && pytest tests/integration/test_hdl_roundtrip.py` (needs `iverilog` + `ghdl`) |
| Frontend unit tests | `cd frontend && npm test` |
| End-to-end integration | `pytest tests/integration/` (needs full stack running) |

## Code style

Both languages use a single canonical formatter; CI fails on any drift.

### Python (`backend/`)

- **Lint + format:** [ruff](https://docs.astral.sh/ruff/). Configuration in `backend/pyproject.toml`. Run on demand:

  ```bash
  cd backend
  ruff check --fix app   # lint + auto-fix
  ruff format app        # format
  ```

- **Type check:** mypy. CI runs `mypy backend/app --ignore-missing-imports` and **fails on any error**.

- **Tests:** pytest. Pre-existing suites live in `backend/tests/` (unit) and root `tests/` (integration) — see `backend/tests/README.md` for the rules on which tree gets a new test.

### TypeScript (`frontend/`)

- **Lint:** ESLint via `frontend/.eslintrc.cjs`. `any` and unused vars are **errors**. CI runs with `--max-warnings 3` (grandfathers three react-refresh stylistic warnings) — adding any new warning fails CI.

- **Format:** prettier via `frontend/.prettierrc` (100-col, single quotes, trailing comma).

  ```bash
  cd frontend
  npx eslint src --ext .ts,.tsx --fix
  npm run format
  ```

- **Type check:** `npx tsc --noEmit` runs in CI as a hard gate (separate from `npm run build`).

### General

- **100-column limit** for both languages.
- Avoid emoji unless explicitly relevant.
- Comments explain *why*, not *what*. Prefer well-named identifiers over inline comments.

## Branching & pull requests

- Branch from `main`. Naming conventions:

  | Prefix | Use for |
  |---|---|
  | `feat/` | new feature |
  | `fix/` | bug fix |
  | `chore/` | tooling, deps, formatting |
  | `docs/` | docs-only changes |
  | `test/` | test changes only |
  | `ci/` | workflow / pipeline changes |
  | `refactor/` | refactor without behaviour change |
  | `security/` | security fixes (consider private disclosure first — see below) |

- **One concern per PR.** A PR that bundles "fix CI + add a feature + bump deps" will be asked to split.
- CI must be green before merge: backend tests, frontend tests, contract tests, integration tests, gitleaks, kubeconform.
- **Squash-merge** is the default. Keep the squashed commit message informative — it becomes the changelog entry.
- For security-sensitive changes (auth, ownership, anything in `backend/app/middleware/auth.py` or `backend/app/api/v1/auth.py`), include "BREAKING:" in the commit body if behaviour changes for any caller.

## Test layout — which tree gets new tests?

There are **two test trees** with distinct scopes (this is on purpose; see `backend/tests/README.md`):

- **`backend/tests/`** — unit tests of `app/core/*` algorithms (no DB, no HTTP). Plus `integration/test_hdl_roundtrip.py` because that import-couples to `app.core.exporters`.
- **`tests/`** (repo root) — integration + contract tests that hit a running API via httpx, plus contract tests via Schemathesis/Dredd, plus Locust load tests.

If your test:
- Imports from `app.core.*` and only exercises pure functions → `backend/tests/test_core/`
- Spins up a server and POSTs to `/api/v1/...` → `tests/integration/`
- Validates against `openapi-spec.yaml` → `tests/contract/`

## Adding a dependency

### Backend

1. Edit `backend/requirements.txt` (and `backend/pyproject.toml` if it's a top-level dep).
2. **Add an upper bound** — see existing entries (`<next_major`). Unbounded `>=` is rejected on review because it lets prod silently inherit major-version breakage.
3. Resolve with `pip install -r backend/requirements.txt`.
4. Run `pip-audit -r backend/requirements.txt` (or check the next CI run) — if it adds CVEs, justify in the PR body.

### Frontend

1. `cd frontend && npm install <pkg>`.
2. Commit **both** `package.json` and `package-lock.json`.
3. Run `npm audit --omit=dev` — if it adds production-runtime vulns, justify in the PR body.

## Filing bugs

- Open a GitHub issue against `Vaidurya-s/GrayFSM` with reproduction steps, expected vs. actual behaviour, and the relevant log/error.
- Attach the FSM definition (export to JSON) if the bug involves a specific FSM.

## Security disclosure

Please do **not** open a public GitHub issue for a security vulnerability. Email the maintainer (see repo `git config user.email`) with details and we'll coordinate a fix.

A non-exhaustive list of "this is a security issue, treat it that way":

- Anything that lets one user read/modify another user's FSMs
- Anything that bypasses authentication on `/api/v1/auth/*`
- Anything that exposes server-side stack traces or DB schemas to clients
- Hardcoded credentials, leaked API keys, or `.env` files committed by accident

Thanks for following the protocol.
