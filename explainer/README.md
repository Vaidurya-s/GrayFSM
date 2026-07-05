# GrayFSM Explainer

Comprehensive technical documentation of the GrayFSM project — written so a presenter can answer deep and cross-questions on any subsystem.

Each file targets a specific area at senior-engineer depth: real code references (`file:line`), actual complexity analysis (with derivations, not just Big-O labels), math for the algorithms, request-flow traces, deployment topology.

## Reading order

| # | File | What it covers |
|---|---|---|
| 00 | [`overview.md`](overview.md) | Problem statement, why Gray codes eliminate glitches, high-level flow |
| 01 | [`tech-stack.md`](tech-stack.md) | Every runtime + framework with justification for the choice |
| 02 | [`architecture.md`](architecture.md) | Component diagram, request flow, deployment topology |
| 03 | [`algorithms.md`](algorithms.md) | The 4 optimizers with math, complexity derivation, worked examples |
| 04 | [`backend.md`](backend.md) | FastAPI structure, middleware chain, service layer |
| 05 | [`database.md`](database.md) | Schema, JSONB shape, migrations, indexes, isolation |
| 06 | [`api-endpoints.md`](api-endpoints.md) | Every endpoint with request/response shape + auth rules |
| 07 | [`frontend.md`](frontend.md) | React tree, state (zustand + react-query), routing |
| 08 | [`fsm-editor.md`](fsm-editor.md) | React Flow canvas, PropertyPanel, undo/redo history |
| 09 | [`visualizations.md`](visualizations.md) | Hypercube, ComparisonView, MetricsDashboard, HammingChart |
| 10 | [`auth-security.md`](auth-security.md) | JWT flow, ownership rules, rate limits, security headers |
| 11 | [`deployment.md`](deployment.md) | Railway topology, migrations, env vars, Docker layout |
| 12 | [`testing.md`](testing.md) | Test tiers (unit / integration / contract / load) |
| 13 | [`qa.md`](qa.md) | Anticipated cross-questions with answers |

## What's *not* in here

- Sales pitch language
- Marketing screenshots (those live in `Assets/Screenshots/` for the README)
- Historical delivery reports (those live in `docs/archive/`)
