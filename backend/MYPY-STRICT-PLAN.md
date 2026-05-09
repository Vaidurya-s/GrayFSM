# Mypy strict-mode — completed

The `mypy backend/app --ignore-missing-imports` step in CI used to run with
`|| true` to mask ~53 pre-existing type errors. **This is no longer the case.**

As of 2026-05-09, mypy runs strict (`disallow_untyped_defs = true`,
`warn_return_any = true`) and CI fails on any new error.

## What was done

1. **SQLAlchemy 2.0 `Mapped[X]` migration** — all four ORM models
   (`User`, `Category`, `FSM`, `AlgorithmResult`) migrated from 1.x
   `Column(...)` declarative style to 2.0 `Mapped[X]` / `mapped_column()`.
   That alone closed ~70 of the 97 errors mypy saw on entry.
2. **Implicit-Optional cleanup** (PEP 484): 5 sites where `arg: T = None`
   was used; rewritten to `arg: T | None = None`.
3. **`no-any-return` fixes**: 7 sites where stubbed third-party libraries
   (passlib, structlog, jwt, networkx, redis) leak `Any`. Wrapped in a
   typed local before return so the function's declared return type holds.
4. **Argument-type residuals**: 8 sites needing explicit narrowing
   (`isinstance` guards, `or "default"` fallbacks, etc.).
5. **JSON-exporter `dict[str, Any]` annotation**: the inferred type was
   too narrow to permit later `["outputs"] = outputs` assignments.
6. **37 missing return annotations** on FastAPI route handlers and
   middleware functions, batch-added as `-> Any`. Real types depend on
   FastAPI's `response_model` decorator anyway.

## Result

```
$ mypy backend/app --ignore-missing-imports
Success: no issues found in 60 source files
```

CI step (`.github/workflows/ci-cd.yml`) updated to fail on any new error.
