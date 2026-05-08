# Mypy strict-mode follow-up plan

The `mypy backend/app --ignore-missing-imports` step in CI currently uses `|| true` because flipping it to fail-on-error surfaces 53 pre-existing type errors. This document is the plan for closing them out.

## Why it's deferred

Most of the 53 errors fall into three buckets that share a single root cause: the SQLAlchemy ORM models use the **1.x `Column(...)` declarative style**, which mypy can't introspect to know that `instance.column_name` reads as `T` rather than `Column[T]`.

Tally (run on f4aec8c, 2026-05-09):

```
22  [arg-type]      Column[X] passed where X is expected
17  [assignment]    incompatible assignment (Sequence vs dict, etc.)
10  [var-annotated] missing type annotations
9   [int]           Column[int] vs int
7   [str]           Column[str] vs str
3   [datetime]      Column[datetime] vs datetime
2   [return-value]  function returns wrong type
1   [type-var]      generic type bound mismatch
1   [bool]          Column[bool] vs bool
1   [attr-defined]  attribute access on Column
```

A targeted `# type: ignore[arg-type]` per error works but ratchets up tech debt and doesn't surface future regressions of the same kind.

## Recommended fix

Migrate **all four SQLAlchemy models** (`User`, `Category`, `FSM`, `AlgorithmResult`) from the 1.x `Column(...)` style to the **2.0 `Mapped[X]` style**. The Mapped annotation tells mypy the runtime type of `instance.column_name` directly, so the bulk of `[arg-type]` and `[var-annotated]` errors disappear without any type-ignores.

### Before (1.x — current)

```python
class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
```

### After (2.0)

```python
from sqlalchemy.orm import Mapped, mapped_column

class User(Base):
    __tablename__ = "users"
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
```

The migration is mostly mechanical (one column at a time) but touches every file that constructs or destructures these models. Roughly:

- `backend/app/models/user.py` (~30 lines, ~5 columns)
- `backend/app/models/fsm.py` (~150 lines, ~25 columns across 3 classes)

Plus updates to a handful of consumer call sites where the old code did `cast(int, fsm.bit_width)` or similar workarounds — those casts can be removed.

## Estimated effort

- Model migration: 1.5–2 hours
- Verifying all callers + remaining type fixes: 1 hour
- Running mypy iteratively, fixing residuals: 30 min

Total: **3–3.5 hours of focused work**, ideally as a single PR.

## Smaller intermediate steps (optional)

If the full Mapped[] migration isn't justified yet, two smaller wins:

1. **Add the SQLAlchemy mypy plugin**

   ```toml
   [tool.mypy]
   plugins = ["sqlalchemy.ext.mypy.plugin"]
   ```

   Verified locally that this plugin (with `sqlalchemy>=2.0`) reduces some `[arg-type]` errors but does NOT eliminate them — many still require explicit `Mapped[]` annotations. Net win is modest, plugin is mostly a stepping stone.

2. **Loosen `disallow_untyped_defs = true` for `app.utils.*` and `app.observability.*`**

   These modules intentionally pass loose `dict` / `Any` shapes through to logging and metrics backends. `disallow_incomplete_defs = true` (which still requires return-type annotations on multi-statement functions) covers the value of the strict check without forcing every helper to declare `-> None`.

## CI activation

When the Mapped[] migration lands and `mypy backend/app` exits 0 with no errors, change the CI step:

```yaml
- name: Run type checking (mypy)
  # NOTE: `|| true` kept for now — making mypy strict surfaces ~50
  # pre-existing type issues. Tracked for a dedicated mypy-cleanup PR.
  run: mypy backend/app --ignore-missing-imports || true
```

to:

```yaml
- name: Run type checking (mypy)
  run: mypy backend/app --ignore-missing-imports
```

## Why ship this doc rather than the fix

Time-budgeted autonomous work session (5–6 hours) was scoped across mypy + ruff UP + B904 + migration drift + frontend perf + tests. The mypy strict cleanup alone consumes most of that budget without leaving room for the rest. Shipping this plan preserves the institutional knowledge — what's broken, why, what the fix looks like, and the time estimate — so the next session can drop straight into implementation.
