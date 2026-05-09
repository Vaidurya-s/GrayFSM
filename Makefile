# GrayFSM – repo-root Makefile
# Run `make help` to see all targets.
#
# Assumes:
#   - backend/venv/ exists (pip install -r backend/requirements.txt)
#   - frontend/node_modules/ exists (npm install in frontend/)

PYTHON  := backend/venv/bin/python
MYPY    := backend/venv/bin/mypy
RUFF    := backend/venv/bin/ruff
PYTEST  := backend/venv/bin/pytest
NPX     := cd frontend && npx

.DEFAULT_GOAL := help

# ─── help ─────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  check    Run all linters + tests (ruff, mypy, pytest, tsc, vitest)"
	@echo "  lint     Run ruff and ESLint only"
	@echo "  format   Auto-format backend (ruff) and frontend (prettier)"
	@echo "  test     Run pytest and vitest"
	@echo "  dev      Start backend + frontend dev servers in parallel"

# ─── lint ─────────────────────────────────────────────────────────────────────
.PHONY: lint
lint:
	@echo "==> ruff check (backend)"
	$(RUFF) check backend/app
	@echo "==> mypy (backend)"
	$(MYPY) backend/app --ignore-missing-imports
	@echo "==> ESLint (frontend)"
	$(NPX) eslint src --ext .ts,.tsx --max-warnings 3

# ─── format ───────────────────────────────────────────────────────────────────
.PHONY: format
format:
	@echo "==> ruff format (backend)"
	$(RUFF) check --fix backend/app
	$(RUFF) format backend/app
	@echo "==> prettier (frontend)"
	$(NPX) prettier --write "src/**/*.{ts,tsx,css}"

# ─── test ─────────────────────────────────────────────────────────────────────
.PHONY: test
test:
	@echo "==> pytest (backend)"
	$(PYTEST) backend/tests/ -q --no-header
	@echo "==> vitest (frontend)"
	$(NPX) vitest run

# ─── check ────────────────────────────────────────────────────────────────────
.PHONY: check
check:
	@echo "==> ruff check (backend)"
	$(RUFF) check backend/app
	@echo "==> mypy (backend)"
	$(MYPY) backend/app --ignore-missing-imports
	@echo "==> pytest (backend)"
	$(PYTEST) backend/tests/ -q --no-header
	@echo "==> tsc (frontend)"
	$(NPX) tsc --noEmit
	@echo "==> vitest (frontend)"
	$(NPX) vitest run
	@echo "==> All checks passed."

# ─── dev ──────────────────────────────────────────────────────────────────────
.PHONY: dev
dev:
	@echo "==> Starting backend (port 8000) and frontend (port 3000) …"
	$(PYTHON) -m uvicorn app.main:app --reload --port 8000 --app-dir backend &
	cd frontend && npm run dev
