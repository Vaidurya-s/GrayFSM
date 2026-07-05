# Frontend — architecture, state, and build

This document is presenter-prep for a senior engineer. It covers the
frontend as a whole: routing, page inventory, state management, the API
client and normalization boundary, build/bundle behaviour, auth flow,
and the design-system token layer.

For the FSM editor (React Flow, undo/redo, clipboard, canvas, mobile
sheet, shortcuts) see `explainer/fsm-editor.md`. For the optimization
lab-report visualizations (ComparisonView / MetricsDashboard /
HammingChart / Hypercube3D) see `explainer/visualizations.md`.

---

## 1. Route topology

Routes are declared once in `frontend/src/config/routes.ts:1` and wired
in `frontend/src/App.tsx:36`. There is no router-level auth guard — the
app is intentionally permissive at the client edge and enforces auth at
the API. When the backend answers `401`, the axios response interceptor
in `frontend/src/api/client.ts:31` clears the token and redirects the
browser to `/login` (unless the user is already on a login/register
page).

| Route path                | Page                                 | Auth enforcement                                 |
| ------------------------- | ------------------------------------ | ------------------------------------------------ |
| `/`                       | `HomePage` (`§ 0 Catalog`)           | none — public catalog list                       |
| `/login`                  | `LoginPage`                          | anonymous                                        |
| `/register`               | `RegisterPage`                       | anonymous                                        |
| `/editor`                 | `EditorPage` (new / blank)           | none client-side; backend blocks create on 401   |
| `/editor/new`             | `EditorPage` (new / blank)           | same as `/editor`                                |
| `/editor/:id`             | `EditorPage` (edit existing)         | none client-side; `GET /fsms/:id` 401 → redirect |
| `/optimize/:id`           | `OptimizationPage` (lazy-loaded)     | reachable, but Optimize POST requires token      |
| `/export/:id`             | `ExportPage`                         | same                                             |
| `/gallery`                | `GalleryPage`                        | none                                             |
| `/examples`, `/examples/:id` | `ExamplesPage`                    | none                                             |
| `/learn`, `/learn/:tid`   | `<Navigate to="/examples" replace/>` | redirect only                                    |
| `/about`                  | `AboutPage`                          | none                                             |
| `/docs`                   | `<Navigate to="/about" replace/>`    | redirect only                                    |
| `*` (unmatched)           | `NotFoundPage`                       | rendered in place — path is preserved            |

`NotFoundPage` deliberately renders at the unmatched URL rather than
redirecting to `/404`. `App.tsx:180` comments the rationale:
`location.pathname` stays at the URL the user actually typed, so the
404 page can echo it back (`NotFoundPage.tsx:15`).

### Rationale for no route guards

Guards would duplicate logic that already lives at the backend edge
(FastAPI `Depends(current_user)`), and a client-side check based on
`useAuthStore.isAuthenticated` proves nothing — a token in localStorage
may already be expired or blacklisted. The single source of truth is the
API response. The interceptor at `client.ts:31` converts every 401 into
a login redirect, so an "authed-looking" navbar can never persist
against an actually-signed-out state for more than one request.

Trade-off: the user briefly sees the target page shell (skeletons /
spinners) before being bounced. Acceptable because the target pages
render loading state anyway, and the bounce fires immediately on the
first data query.

## 2. Page-by-page inventory

- **`HomePage`** (`frontend/src/pages/HomePage.tsx:63`): the datasheet-
  brutalism catalog view. Two queries — `GET /fsms?page=1&page_size=10`
  and `GET /health`. Uses `unwrapList` / `unwrap` helpers
  (`HomePage.tsx:34,47`) that tolerate the same bare-body/envelope split
  handled centrally in `normalize.ts` (see §5). Renders the Phase-2
  design primitives: `Kicktitle`, `DataBlock`, `RuledTable`,
  `CommandKey`, `SpecField`, `PullFigure`.

- **`GalleryPage`** (`frontend/src/pages/GalleryPage.tsx:1`): search +
  filter grid over the catalog. Uses `useFSMs(params)` (React Query) with
  server-side pagination. Includes `SkeletonCard` shimmer while loading.

- **`ExamplesPage`** (`frontend/src/pages/ExamplesPage.tsx:1`): tabbed
  browse of the built-in example FSMs (Traffic Light, Sequence Detector,
  Vending Machine, Elevator, …) organized by difficulty. Reads
  `/examples` via `examplesAPI.list()`; falls back to a static in-code
  list if the API is unavailable — so the marketing/demo path never
  goes blank. **Known behaviour**: the fallback list has no `advanced`
  entries, which caused the "Complex tab empty" report — fixed by the
  bare-body tolerance added in `examples.ts` (see §5).

- **`EditorPage`** (`frontend/src/pages/EditorPage.tsx:21`): the FSM
  editor. Full detail in `explainer/fsm-editor.md`.

- **`OptimizationPage`** (`frontend/src/pages/OptimizationPage.tsx:47`):
  the lab-report page. Lazy-loaded (see §6). Full detail in
  `explainer/visualizations.md`.

- **`ExportPage`** (`frontend/src/pages/ExportPage.tsx:1`): the HDL
  export flow. Format tabs for Verilog / VHDL / JSON / CSV / Testbench,
  each backed by `/fsms/:id/export` (server-side codegen) with a cached
  read via `/fsms/:id/export/:format`. Ships module-name derivation
  (`defaultModuleName`) and options (comments, style).

- **`AboutPage`** (`frontend/src/pages/AboutPage.tsx:1`): a long-form
  serif essay on Gray-code encoding and the theory of operation. Single
  36rem column with `MarginalNote` sidenotes at `lg+`.

- **`LoginPage`** (`frontend/src/pages/LoginPage.tsx:1`): email/password
  form. Delegates to `useAuthStore.login`. On success navigates to `/`.

- **`RegisterPage`** (`frontend/src/pages/RegisterPage.tsx:1`): same
  shape as login; delegates to `useAuthStore.register`. Surfaces the
  backend's `detail` field on error so validation failures are legible
  ("password too short", etc.).

- **`NotFoundPage`** (`frontend/src/pages/NotFoundPage.tsx:13`): terminal-
  austere 404. Echoes the requested `location.pathname` back to the user.
  Referenced above — renders in place at the unmatched URL.

## 3. State management stack

Three coexisting layers, each with a distinct concern.

### 3.1 React Query — server state

`frontend/src/main.tsx:7` mounts the `QueryClient` with:

```
defaultOptions.queries = {
  refetchOnWindowFocus: false,
  retry: 1,
  staleTime: 5 * 60 * 1000, // 5 minutes
}
```

`staleTime: 5min` means catalog queries won't hammer the API on a
navigation ping-pong between `/gallery` and `/`, but a hard refresh
still refetches. Query keys are hierarchical, defined next to their
hooks:

```
// frontend/src/hooks/useFSM.ts:6
fsmKeys = {
  all:     ['fsms'],
  lists:   () => [...all, 'list'],
  list:    (params) => [...lists(), params],
  details: () => [...all, 'detail'],
  detail:  (id) => [...details(), id],
}
```

Invalidation cascades naturally: `useUpdateFSM.onSuccess`
(`useFSM.ts:44`) invalidates both `fsmKeys.detail(id)` (the detail
page) and `fsmKeys.lists()` (any catalog listing that might now be
stale). `useDeleteFSM` invalidates only lists (there is no detail to
refresh). `useOptimize.onSuccess` (`useOptimization.ts:23`) invalidates
optimization results *and* the source FSM detail — the FSM's
`is_optimized` flag flips after optimization.

Each `use*` hook is a thin wrapper over an `apiClient` call: readers
use `useQuery`; writers use `useMutation`. Nothing more clever than
that.

**Real hook walkthrough — `useFSM(id)`**:

```
export function useFSM(id: string | undefined) {
  return useQuery({
    queryKey: fsmKeys.detail(id!),   // stable key by id
    queryFn: () => fsmAPI.get(id!),  // apiClient returns normalized shape
    enabled: !!id,                   // skips the query when id is undefined
  });
}
```

The `enabled: !!id` gate matters on `EditorPage` for the "new FSM" flow
(no `:id` route param), which would otherwise fire a `GET /fsms/undefined`.

### 3.2 Zustand — client-only state

Three stores; each has one job.

#### `useFSMStore` (`frontend/src/store/fsmStore.ts:102`) — the editor draft

This is by far the biggest store. It holds the *unsaved* editor draft —
`draftStates`, `draftTransitions`, `draftName`, `draftDescription`,
`draftFsmType`, `draftInitialState`, `draftEncoding` — plus editor UI
state (`selectedNode`, `selectedEdge`, `isEditing`, `clipboard`) and
mirrored undo/redo flags (`canUndo`, `canRedo`).

Why zustand not React Query? A draft that has never been saved has no
server representation; there's nothing to fetch or invalidate. React
Query is optimized for server-owned data with well-defined keys. Local
draft state doesn't fit that model.

Selectors are used in a granular pattern at consumer sites — see
`EditorPage.tsx:38` where each field is subscribed via its own hook
call. Rationale: unrelated store writes (per-keystroke `draftName`
edits, undo-stack pushes) don't re-render the whole `EditorPage`
subtree. Each `useFSMStore((s) => s.draftStates)` subscribes only to
the slice the component needs.

Mutators (`addState`, `updateState`, `removeState`, `addTransition`,
`updateTransition`, `removeTransition`, `pasteClipboard`) all call
`get().pushSnapshot()` at the end. Per-keystroke setters like
`setDraftName` deliberately do NOT push — a keystroke-per-snapshot
undo stack blows past the 50-entry cap in seconds. See
`explainer/fsm-editor.md` for the full undo/redo story.

`addState` (`fsmStore.ts:155`) computes id, name, and position
*inside* the `set` callback so two rapid double-clicks batched against
the same snapshot can't produce duplicate IDs. The 4-column
`{160,130}` grid keeps new nodes inside the default React Flow
viewport — replacing an older circular layout that pushed nodes to
±640 px and hid them until the user hit Fit View.

`updateState` (`fsmStore.ts:191`) implements the rename cascade: on a
rename it edits (a) the state's `id` + `name`, (b) every `from_state`
/ `to_state` on transitions referencing the old name, (c)
`draftInitialState` if it pointed at the renamed state, and (d)
`selectedNode`. Rename is aborted on collision — the input silently
re-renders the old name; the property panel shows a red validation
message.

#### `useAuthStore` (`frontend/src/store/authStore.ts:45`) — token + user cache

Holds `token`, `user`, `isAuthenticated`, `loading`. Persists two
things to `localStorage`:

- `auth_token` (constant `TOKEN_KEY` at `authStore.ts:4`)
- `auth_user` (constant `USER_KEY` at `authStore.ts:10`) — the JSON-
  serialized `AuthUser`.

The user cache is *the* partial-logout fix. Before it existed, `init()`
called `/auth/me` on reload; if the backend hiccuped (502/503/timeout)
the code cleared `user` while leaving the token intact, so the navbar
displayed a broken half-signed-in state: `isAuthenticated: true` but
`user: null` — no email, LOGOUT button visible, but no user identity.

The new logic (`authStore.ts:82`):

```
init() {
  // …
  try {
    const me = await authAPI.me();
    writeCachedUser(me.data);            // fresh cache
    set({ token, user: me.data, isAuthenticated: true });
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      // real "you're signed out" — drop everything
      localStorage.removeItem(TOKEN_KEY);
      writeCachedUser(null);
      set({ token: null, user: null, isAuthenticated: false });
    } else {
      // transient — keep cached user, keep token
      set({ token, user: readCachedUser(), isAuthenticated: true });
    }
  }
}
```

Logout (`authStore.ts:71`) calls `/auth/logout` best-effort (the server
blacklists the token) but clears local storage unconditionally — a
network failure on logout still logs the user out locally.

#### `useUIStore` (`frontend/src/store/uiStore.ts:17`) — sidebar / mobile menu

Small store: `sidebarOpen`, `mobileMenuOpen`, `activeModal`. The
initial `sidebarOpen` value is viewport-aware:

```
sidebarOpen:
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 1024px)').matches
    : true,
```

On desktop (`≥ 1024px`) the editor sidebar starts open. On mobile it
starts closed — otherwise the bottom-sheet modal covers the canvas
before the user has done anything, which reads as broken. The `true`
fallback is for SSR / non-browser environments (unused today but keeps
tests safe).

### 3.3 React Context — theme

`ThemeProvider` (`frontend/src/components/providers/ThemeProvider.tsx:32`)
holds `{ theme: 'light' | 'dark' | 'system', setTheme, isDark }`.
Persisted to `localStorage` under `grayfsm-theme`. Applied by toggling
`.dark` and `.light` classes on `<html>` (`ThemeProvider.tsx:26`).

Why Context and not zustand? Context is fine when the value is small,
changes infrequently, and needs to be readable by any descendant
(charts sample `getComputedStyle(document.documentElement)` for CSS
variable values — see `use-theme-colors.ts`). A zustand store would
also work; Context wins on ecosystem familiarity and the fact that
`.dark` on `<html>` is what Tailwind reads at CSS-computation time
anyway. The three-state model (`light` / `dark` / `system`) needs the
`.light` class specifically so
`@media (prefers-color-scheme: dark) :root:not(.light)` in
`globals.css` can't override an explicit light choice.

## 4. API client

`frontend/src/api/client.ts:4` creates the shared axios instance:

```
baseURL: API_BASE_URL,     // '/api/v1' in prod, VITE_API_BASE_URL override
timeout: 30000,
withCredentials: false,
headers: { 'Content-Type': 'application/json' }
```

### Interceptors

**Request** (`client.ts:14`): pulls `auth_token` from `localStorage` and
sets `Authorization: Bearer <token>`. Reads storage on *every* request,
which means a logout in tab A takes effect in tab B on the next call
without needing a storage-event listener.

**Response — success** (`client.ts:28`): returns `response.data`
directly. This is the critical detail that makes every hook look like
`res.data.data` in the types but `res.data` at runtime. Every call site
had to be written aware of this and it caused the double-unwrap bug in
`OptimizationPage.tsx` (`response.data.data` → `undefined`) fixed at
`OptimizationPage.tsx:69` and `:135`.

**Response — 401** (`client.ts:31`): clears the token, then redirects
to `/login` unless the current path is already `/login` or `/register`.
Uses `window.location.href` (hard redirect) rather than a React Router
`navigate` because the interceptor doesn't have router context and the
hard redirect ensures every store rehydrates from empty storage — no
stale in-memory `user` object surviving into the login flow.

Missing bit worth calling out: the interceptor does not currently
attach a `?redirect=` query param — after login the user always lands
on `/`, not the page they were kicked out of. If this becomes a UX
issue, it's a small change at `client.ts:37`.

### Bare-body tolerance in endpoint wrappers

The backend has a `response_wrapper` middleware that is supposed to
envelope every response as `{ success, data, metadata }`. It has been
observed skipping the envelope on some responses (notably
`GET /fsms/{id}` for freshly created optimized FSMs). Rather than
change every consumer to handle both shapes, the endpoint wrappers do:

```
// frontend/src/api/endpoints/fsms.ts:19
function normalizeFSMResponse<R extends { data: FSM }>(res: R): R {
  const raw = res as unknown as Record<string, unknown>;
  if (raw && typeof raw === 'object' && 'id' in raw && !('data' in raw)) {
    return { success: true, data: normalizeFSM(raw) } as unknown as R;
  }
  return { ...res, data: normalizeFSM(res.data) };
}
```

The heuristic — "has `id` but no `data`" — assumes the bare body will
always carry an `id` (true for every FSM read) and that the enveloped
form will always have `data` (true for every envelope). It's a
defensive shim, deliberately narrow.

Same pattern is repeated for `list` (`fsms.ts:26`), `examples.ts:22`,
and `algorithms.ts:29` (which checks for `optimized_fsm_id` because
`OptimizationResponse` doesn't have `id`).

This is not a fix for the backend inconsistency — it's a shim that
lets the frontend ship while the backend gets straightened out. If we
land the backend fix (make `response_wrapper` idempotent so the
envelope is always present), these wrappers can be simplified.

## 5. Normalization boundary — `frontend/src/api/normalize.ts`

The design principle at `normalize.ts:5` is stated clearly:

> - Default safe, optional, display-only fields (arrays, metric
>   numbers, optional metadata, encoding maps).
> - Pass identity / core-domain fields through (id, name, fsm_type,
>   algorithm, optimized_fsm_id, ownership). Fabricating these would
>   mask backend bugs.

Concrete example — `normalizeFSM` (`normalize.ts:50`) defaults `states`,
`transitions`, `tags`, `outputs`, `encoding`, `definition` to safe
empties. It does *not* default `id`, `name`, `fsm_type`,
`initial_state`, `state_count`, `transition_count`, `visibility` — if
one of those is missing, that's a real defect somewhere upstream and
we want a runtime error, not a silent `""`.

`normalizeExample` (`normalize.ts:71`) handles a subtler case: the
backend surfaces examples with top-level `states` / `transitions` /
`initial_state` rather than nesting them under `fsm_data`. The
normalizer spreads the raw payload first, then explicitly re-writes
the strict-`Example` fields on top, then sets `fsm_data` to either
`r.fsm_data` OR the raw payload itself. That way the "Try it" flow on
`EditorPage.tsx:115` (which calls `loadFSMIntoDraft` on the normalized
example directly) reads top-level `states` and the canvas comes up
populated. Previously, `fsm_data` was empty and the canvas rendered
blank.

`normalizeOptimizationResponse` (`normalize.ts:100`) merges `metrics`
on top of `DEFAULT_METRICS = { avg_hamming_before: 0, ... }` so a
missing metric renders as 0 in charts instead of crashing.

`normalizeAlgorithmResultToOptimizationResponse` (`normalize.ts:142`)
is the single canonical conversion from the persistence-model
`AlgorithmResult` row to the runtime `OptimizationResponse`. Used by
the "restore last run" path on `OptimizationPage.tsx:88` — see
`explainer/visualizations.md`. It backfills `max_hamming_*` and
`encoding_map` with 0/`{}` for rows written before the alembic
migration `e6a8c9d0b3f1` that added those columns.

## 6. Build and bundling

### `vite.config.ts`

- **Vite 5** + `@vitejs/plugin-react`, TypeScript strict mode.
- **`resolveBuildHash()`** (`vite.config.ts:12`): tries `VITE_BUILD_HASH`
  env, then CI vars (`GITHUB_SHA`, `VERCEL_GIT_COMMIT_SHA`,
  `CI_COMMIT_SHA`), then `git rev-parse --short=7 HEAD`, then `"dev"`.
  Baked into the bundle via `define`. Read by `Navbar.tsx:40` as
  `import.meta.env.VITE_BUILD_HASH` to render the build stamp.
- **Path alias** `@` → `./src` (`vite.config.ts:41`).
- **Dev server** on `:3000` with proxy `/api → http://localhost:8000`.
- **Sourcemaps**: on for non-prod builds, off for prod (`vite.config.ts:59`).
- **Manual chunks** (`vite.config.ts:66`):
  - `react-vendor`: react, react-dom, react-router-dom
  - `react-flow`: reactflow
  - `charts`: recharts
  - `forms`: react-hook-form, zod
  - `three.js` / `@react-three/*` are deliberately **NOT** in
    `manualChunks`. Comment at `vite.config.ts:69` explains: listing
    them would force them into the initial bundle even though only the
    Hypercube tab uses them.

### Lazy chunks — `lazyWithRetry`

`frontend/src/utils/lazyWithRetry.ts:34` wraps `React.lazy` with a
stale-chunk recovery. After a deploy, tabs holding the previous
`index.html` will `import()` chunks by the *old* content hash and get
"Failed to fetch dynamically imported module". On the first such
failure per session, the wrapper calls `window.location.reload()`
(guarded by a `sessionStorage` flag so a real network failure doesn't
cause a reload loop). This is used for:

- `OptimizationPage` (`App.tsx:24`) — recharts pulls in ~180 KB gz.
- `Hypercube3D` (`OptimizationPage.tsx:18`) — three.js + `@react-three/*`
  chunk is ~940 KB minified / ~266 KB gzipped. The comment at
  `OptimizationPage.tsx:14` documents the cost and rationale.

### Build-time env vars

`API_BASE_URL` (`config/constants.ts:4`) reads
`import.meta.env.VITE_API_BASE_URL` at *build* time, falling back to
`/api/v1` for the same-origin case. Same for `OPENAPI_URL`
(`constants.ts:8`). Vite inlines `VITE_*` at build; these are not
runtime-configurable. If deploy topology changes and someone wants a
runtime override, they have to rebuild — or introduce a `window.__env`
shim served by nginx.

## 7. Auth flow — end-to-end walkthrough

Login (`LoginPage.tsx` → `useAuthStore.login` → `authAPI.login`):

```
1. User submits (email, password) on LoginPage
2. useAuthStore.login()
     → POST /auth/login
     → res.data.access_token
     → localStorage.setItem('auth_token', token)
     → set({ token, isAuthenticated: true })
     → GET /auth/me
     → writeCachedUser(me.data)
     → set({ user: me.data })
3. navigate('/')  → Navbar re-renders with user.email + Logout button
```

Session restore on reload (`App.tsx:38`):

```
1. App mounts, useEffect fires useAuthStore.init()
2. init():
     token = localStorage.getItem('auth_token')
     if !token → return   (never signed in)
     set({ loading: true })
     try:
       me = await authAPI.me()
       writeCachedUser(me.data)
       set({ token, user: me.data, isAuthenticated: true })
     catch:
       if 401/403: full sign-out (clear both token + user)
       else: KEEP token, restore user from cache
     finally: set({ loading: false })
```

Logout (`authStore.ts:71`):

```
1. Best-effort: await authAPI.logout()   (server blacklists JWT)
2. Regardless of that call's outcome:
     localStorage.removeItem('auth_token')
     writeCachedUser(null)  // clears 'auth_user'
     set({ token: null, user: null, isAuthenticated: false })
3. Navbar navigates to '/'
```

Interceptor-driven expiry (`client.ts:31`): any request that comes
back 401 triggers the same local-clear + login-redirect. The user
doesn't have to click Logout — an expired token silently ejects them
on their next action.

## 8. Component tree — top-level

```
<React.StrictMode>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppWithCommandPalette>       // wraps CommandPalette overlay
            <ErrorBoundary>
              <Routes>
                <Route path=… element={<AppLayout>… <PageComponent/> …</AppLayout>} />
                ...
```

`AppLayout` (`components/layout/AppLayout.tsx:8`) is a very thin shell:
skip link, `<Navbar/>`, `<main>` with the routed page, `<footer>`.
All heavy layout is per-page.

## 9. Design system tokens

Semantic tokens are CSS custom properties in `styles/globals.css`
(dark-mode overrides live there too), surfaced as Tailwind utilities in
`tailwind.config.js:15`:

```
paper       → var(--paper)          // page background
paper-shade → var(--paper-shade)    // subtle background block
paper-deep  → var(--paper-deep)     // deeper block (e.g. dividers)
ink         → var(--ink)            // primary text
ink-soft    → var(--ink-soft)       // secondary text
ink-faint   → var(--ink-faint)      // metadata / tick labels
rule        → var(--rule)           // hairline dividers
rule-strong → var(--rule-strong)    // 1px card borders
accent      → var(--accent)         // electric blue
accent-tint → var(--accent-tint)    // active tab bg, table cell highlight
ok / warn / err                     // semantic status
```

Dark mode is implemented as class-based (`darkMode: 'class'`,
`tailwind.config.js:17`). The token vars flip inside a `:root.dark`
block in `globals.css`. Because charts (recharts, three.js) render to
SVG/WebGL which does *not* inherit CSS variables, they read the
computed values through `useThemeColors` — see
`explainer/visualizations.md`.

The `font-tabular` utility is a custom plugin (`tailwind.config.js:134`)
that emits `font-feature-settings: "tnum" 1, "lnum" 1;`. Numeric
columns and metrics use it so digits line up vertically ("S0" over "S10",
"1.4 ms" over "12.7 ms", etc.).

Legacy color scales (`primary`, `gray`, `success`, `warning`, `error`)
remain in place because not every page has been migrated to the
semantic tokens yet. `primary` was re-pointed to the new electric blue
so `primary-*` utilities on legacy pages shift toward the redesign
palette without breaking layout.

## 10. UI primitives — brief inventory

Under `frontend/src/components/ui/`:

- **`Alert`**, **`Badge`**, **`Button`**, **`Card`** (+ `CardHeader`,
  `CardBody`, `CardFooter`), **`Input`**, **`Spinner`**, **`Tooltip`**
  — classical primitives. `Card` supports `variant='bordered' | 'flat'`.
- **`Modal`** (`Modal.tsx`) — `size='sm'|'md'|'lg'`,
  `position='center'|'bottom-sheet'|'side-sheet'`. Uses
  `createPortal`, focus trap, escape-close, ref-counted body scroll
  lock (`Modal.tsx:41`) so nested modals compose without prematurely
  releasing the lock. The `bottom-sheet` variant is what the editor's
  mobile property drawer uses.
- **`Tabs`** / **`TabPanel`** — controlled tabs with `aria-selected`
  and roving-tabindex keyboard nav.
- **`Toast`** + `useToast` — `success` / `error` / `info` transient
  notifications. Rendered in a portal from `ToastProvider`.
- **`ErrorBoundary`** — class component; wraps `<Routes>` at the app
  root and each optimization tab panel. Renders a friendly reset UI.
- **`CommandPalette`** + `useCommandPalette` — `⌘K`-style palette;
  keyed by `command.id`.
- **Datasheet primitives** (Phase 2): `Kicktitle` (numbered kicker
  line above a heading), `TypedSection` (numbered section wrapper),
  `MarginalNote` (sidenote at `lg+`), `DataBlock` (labeled key/value
  grid), `RuledTable` (rule-only bordered table), `SpecField`
  (spec-sheet field tile), `PullFigure` (pull-quote-style figure),
  `CommandKey` + `CommandKeyRow` (`⌘K`-style action buttons or links).

## 11. Data flow — a save-then-optimize round-trip

Numbered arrows show what talks to what:

```
[User types in editor]
    │
    ▼
useFSMStore.updateState(id, patch)
    │  synchronous → subscribers with matching selectors re-render
    ▼
FSMCanvas re-derives nodes (useMemo)
    │
[User clicks Save]
    │
    ▼
EditorPage.handleSave()   (frontend/src/pages/EditorPage.tsx:152)
    │
    ▼
useUpdateFSM.mutateAsync({ id, data })
    │
    ▼
apiClient.put('/fsms/:id', data)
    │  Authorization header attached by request interceptor
    │  Response envelope unwrapped by response interceptor
    ▼
onSuccess: invalidate fsmKeys.detail(id) + fsmKeys.lists()
    │
    ▼
Any subscribing hook (useFSM(id), useFSMs(...)) refetches
    │
[User clicks Optimize → OptimizationPage]
    │
    ▼
useOptimize.mutateAsync({ fsmId, request })
    │
    ▼
apiClient.post('/fsms/:id/optimize', request)
    │
    ▼
setResult(...); setOptimizedFSM(await fsmAPI.get(optimized_fsm_id))
    │
    ▼
<ComparisonView/> + <MetricsDashboard/> render from `result` + fetched FSMs
```

## 12. Common cross-questions

**Q: Why zustand *and* react-query instead of one library?**
Because they optimize for orthogonal shapes. React Query owns *server*
state — cache invalidation by hierarchical key, background refetching,
deduplication of in-flight requests. Zustand owns *client* state — the
unsaved editor draft, sidebar toggles, undo stack cursor. Trying to
model the editor draft as a "query" would either fake a
`queryKey: ['draft']` with `queryFn: () => sync draft` (which contorts
the API) or use `queryClient.setQueryData` as a plain store (which
loses invalidation semantics). Two libraries, two concerns.

**Q: Why doesn't the app have route guards?**
Because guards would duplicate an enforcement that already exists at
the API. A client-side check on `useAuthStore.isAuthenticated` is a
readout of localStorage — the token might be expired or blacklisted,
and only the server knows. Every `401` from the API triggers a hard
redirect to `/login` via the interceptor at
`frontend/src/api/client.ts:31`. Cost: a brief flash of a page shell
before the redirect. Benefit: a single source of truth.

**Q: How does the frontend handle a slow backend?**
React Query timeouts default to whatever axios has — `client.ts:6` sets
`timeout: 30000` (30 s). Below that, each page has its own loading UX:
`EditorPage.tsx:314` shows a centered spinner; `OptimizationPage.tsx:200`
same; catalog pages use `SkeletonCard` (`GalleryPage.tsx:54`). Mutations
render an in-button "Creating…"/"Optimizing…" (`FSMCreateForm.tsx:184`,
`OptimizationForm.tsx:149`). Timeouts throw an axios error which each
mutation handler surfaces as a toast (`toastError('...')`).

**Q: What's the strategy for API version drift?**
Two things. First, the normalization boundary (`normalize.ts`) defaults
optional fields to safe empties so a payload missing a new column
renders instead of crashing. Second, the endpoint wrappers tolerate
both enveloped and bare bodies (`fsms.ts:19`) because we've seen the
backend's `response_wrapper` middleware go inconsistent under some
conditions. Neither of these is a version-negotiation strategy — the
frontend and backend share a monorepo and deploy together — they're
belt-and-braces defense against real bugs we've observed.

**Q: How do you prevent iOS from auto-zooming input fields?**
iOS Safari zooms any input whose computed `font-size` is < 16 px. All
form inputs that mobile users hit use responsive text sizes: `text-base
sm:text-sm` — 16 px on mobile, 14 px on `sm+`. See `LoginPage.tsx:29`,
`PropertyPanel.tsx:86`. This is the "no zoom on focus" trick and it
avoids the ugly meta-viewport hack (`user-scalable=no`) that breaks
accessibility.

**Q: How does theme persistence work across reloads?**
`ThemeProvider.tsx:33` reads `localStorage.getItem('grayfsm-theme')` at
mount and hydrates React state from it. Any `setTheme(next)` call
writes back to storage. The applied class (`.dark` / `.light` on
`<html>`) is set imperatively by `applyTheme` (`ThemeProvider.tsx:26`)
in a `useEffect` so the DOM class always matches state. Note there is
a brief "flash of unstyled theme" (FOUT) risk if the stored preference
disagrees with the OS default, because React hydrates on JS boot — a
production hardening would inline a tiny bootstrap `<script>` in
`index.html` that reads localStorage synchronously before first paint.
Not currently shipped.
