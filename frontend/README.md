# GrayFSM Frontend

React 18 + TypeScript + Vite single-page app. Talks to the backend over
REST (`/api/v1/*`).

- `src/pages/` — Catalog, Editor, Optimisation, Export, Gallery, About, Lab Report.
- `src/components/` — UI primitives, FSM canvas (React Flow), visualisations (Recharts, Three.js).
- `src/store/` — Zustand stores (`fsmStore`, `editorStore`, `uiStore`).
- `src/api/` — Axios client + typed endpoint wrappers.
- `src/styles/globals.css` — design tokens (light + dark themes).

## Run

```bash
cp .env.example .env.local
npm install
npm run dev
```

App: <http://localhost:3000>. Requires the backend running at the URL set
by `VITE_API_BASE_URL` (defaults to `http://localhost:8000/api/v1`).

## More

See [`docs/RUNBOOK.md`](../docs/RUNBOOK.md) for the canonical runbook —
environment variables, deployment, tests, and the recent feature shipping
log.
