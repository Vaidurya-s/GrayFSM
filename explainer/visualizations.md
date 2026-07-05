# Visualizations — the Optimization lab report

This document covers the optimization page and its three visualization
tabs — Comparison, Metrics, and Hypercube — plus the Gray-code
utilities that back the 3D view.

Files touched most often:
- `frontend/src/pages/OptimizationPage.tsx` (506 lines)
- `frontend/src/components/visualization/ComparisonView.tsx`
- `frontend/src/components/visualization/MetricsDashboard.tsx`
- `frontend/src/components/visualization/HammingChart.tsx`
- `frontend/src/components/visualization/Hypercube3D.tsx`
- `frontend/src/components/visualization/use-theme-colors.ts`
- `frontend/src/utils/gray-code/generator.ts`
- `frontend/src/utils/gray-code/hypercube.ts`

## 1. Page layout and tab state

`OptimizationPage` (`frontend/src/pages/OptimizationPage.tsx:47`) is a
two-column layout at `lg+`, single column below:

```
┌────────────────────────────────────────────┬───────────────────────┐
│  Canvas (before optimize)                  │  OptimizationForm     │
│  ─or─                                      │  (algorithm + params) │
│  Tabbed lab report:                        │                       │
│    [ Comparison ] [ Metrics ] [ Hypercube ]│                       │
│                                            │  Lab Report card      │
│  (Tab panel contents)                      │  (HammingChart,       │
│                                            │   summary tiles,      │
│                                            │   export links)       │
└────────────────────────────────────────────┴───────────────────────┘
```

On mobile the order is deliberately reversed with Tailwind's `order-*`
(`OptimizationPage.tsx:264, :379`) so the form surfaces above the
canvas — the user sees the controls first, hits Run, then scrolls
down to the results. Desktop lays them side-by-side and the visual
weight of the canvas dominates.

### Tabs and when data loads

The three tabs (`OptimizationPage.tsx:277`) are static `<button>`
elements switched by a `useState<ResultTab>('comparison')`. There is
no async load per tab — the entire `result` object is in memory once
the optimize call returns (or once the past-run restore has run — see
below). Switching tabs is a pure component swap:

- **Comparison** — needs both `originalFSM` and `optimizedFSM`; shows
  a two-column React Flow diff. If the optimized FSM fetch has
  failed, this tab renders the error and points at the metrics tab.
- **Metrics** — pure recharts + tables; renders from `result` alone.
- **Hypercube** — lazy-loaded on first activation (see §5).

### Past-run restore

The lab-report has to survive the user navigating away and coming
back. `OptimizationPage.tsx:87` handles this:

```
const { data: pastResultsResp } = useOptimizationResults(id);
useEffect(() => {
  if (result || !pastResultsResp) return;   // don't clobber a live run
  const list = pastResultsResp.data ?? [];
  const latest = list.find((r) => r.optimized_fsm_id) ?? list[0];
  if (!latest) return;
  setResult(normalizeAlgorithmResultToOptimizationResponse(latest));
  if (latest.optimized_fsm_id) {
    fsmAPI.get(latest.optimized_fsm_id).then((r) => setOptimizedFSM(r.data));
  }
}, [pastResultsResp, result]);
```

Two important details:

1. `list.find((r) => r.optimized_fsm_id) ?? list[0]` — prefer a row
   that has a derived FSM (so ComparisonView can render), fall back
   to the most recent row otherwise so the *metrics + charts* still
   come back even if the derived FSM was deleted.
2. The `if (result || !pastResultsResp) return` guard prevents the
   restore from clobbering a live-just-run result. Order of arrival:
   the user hits Optimize (`result` is set synchronously); the past-
   results query resolves seconds later; without the guard it would
   overwrite the just-ran result with the *previous* run.

The conversion `normalizeAlgorithmResultToOptimizationResponse` lives
at the normalization boundary (`frontend/src/api/normalize.ts:142`)
so the component stays focused on render concerns. Fields backfilled
with 0 (`max_hamming_*`, `encoding_map`) are display-only — they
degrade gracefully and only affect rows written before alembic
migration `e6a8c9d0b3f1`.

### Trigger of Optimize

`OptimizationPage.handleOptimize` (`OptimizationPage.tsx:123`):

1. `optimizeMutation.mutateAsync({ fsmId, request })` → `POST /fsms/:id/optimize`
2. Unwrap once (interceptor already returned `.data`; the wrapped
   envelope is `{ success, data: OptimizationResponse }`).
3. `setResult(optimizationResult)`
4. Fetch optimized FSM: `fsmAPI.get(optimizationResult.optimized_fsm_id)`
5. `setOptimizedFSM(...)` OR `setOptimizedFSMError(...)` with the
   observed body shape appended for diagnosis (`OptimizationPage.tsx:162`).
6. Default to the Comparison tab, toast success.

The error branch on step 5 dumps the actual response body (capped at
240 chars) into the error message. That was a debugging aid during
the "empty response" incidents — the surface still ships because it
gives an operator enough context to see whether the body was `null`,
double-wrapped, or missing `id`, without opening devtools.

## 2. ComparisonView — side-by-side FSMs

`frontend/src/components/visualization/ComparisonView.tsx:142` renders
two React Flow instances side by side. Each is wrapped in its own
`<ReactFlowProvider>` (`ComparisonView.tsx:243`) — critical, because
React Flow's context is scoped per provider and mounting two
`<ReactFlow>`s under a shared provider makes them share state
(selections, viewport). Two providers → two independent viewports.

### `StaticCanvas` — the read-only variant

`ComparisonView.tsx:61` composes a shared header bar (label + badge)
over the React Flow instance. The RF instance is configured
read-only:

```
nodesDraggable={false}
nodesConnectable={false}
elementsSelectable={false}
```

Position fallback for FSMs without stored positions
(`ComparisonView.tsx:63`):

```
const states: State[] =
  fsm.definition?.states ||
  (fsm.states ?? []).map((name, i) => ({
    id: name,
    name,
    position: { x: 150 + (i % 4) * 200, y: 100 + Math.floor(i / 4) * 150 },
  }));
```

Same 4-column grid pattern as the editor's `loadFSMIntoDraft`
(`fsmStore.ts:286`). Optimized FSMs come back from the backend without
persisted positions — the greedy/BFS/SA/GA algorithms don't lay out.
The frontend fills in a synthetic grid so the diff renders.

### Stats bar

Three tiles at `ComparisonView.tsx:204`:

- Dummy states added (from `metrics.dummy_states_added`) — signed
  (`+N` / `-N`)
- Transitions changed (`optimizedFSM.transition_count - originalFSM.transition_count`)
- Improvement (`metrics.improvement_percentage.toFixed(1)%`)

### View mode toggle

`ComparisonView.tsx:147` has a `viewMode: 'side-by-side' | 'overlay'`
state. Side-by-side is the default and dominant view. "Overlay" mode
(`ComparisonView.tsx:258`) shows only the optimized FSM full-width
with a footer chip noting the state-count delta. It's not literally
overlaid on top of the original — it's more of a "full-frame optimized
view" with the original's state count for reference. That's a mild
naming lie; probably worth renaming to "Optimized only" in a future
pass.

### Mobile stack + min-height

`ComparisonView.tsx:242`:

```
<div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0 [&>*]:min-h-[280px]">
```

The `[&>*]:min-h-[280px]` selector applies `min-height: 280px` to
every direct child. Without it, stacked React Flow canvases on mobile
collapse to zero height (the parent has `min-h-0` from `flex-1`,
which propagates unless overridden). The 280 px number is the smallest
viewport height that still shows the whole label bar plus enough
graph to be legible on a phone.

## 3. MetricsDashboard

`frontend/src/components/visualization/MetricsDashboard.tsx` is the
"§ 2.2 Metrics" tab. Uses `recharts` for three chart primitives plus
two data-heavy tables.

### Layout

- **Summary tiles** row: total states, dummy states, improvement %,
  execution time. Rendered as a 4-cell grid with 1px `gap-px` on a
  `bg-rule` background — the "grid gap becomes a hairline" trick.
- **Hamming distance · before vs after** bar chart (`MetricsDashboard.tsx:250`)
- **Optimisation profile** radar chart (`MetricsDashboard.tsx:302`)
- **State composition** pie chart (`MetricsDashboard.tsx:347`)
- **State encoding map** table — plain `<table>` listing each state
  and its Gray code (`MetricsDashboard.tsx:386`)
- **Hamming distance matrix** — colour-graded heatmap of pairwise
  distances between encoded states (`MetricsDashboard.tsx:426`)

### The chart-height pattern

Every recharts embed uses:

```
<div className="h-[180px] sm:h-[220px]">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart ... />
  </ResponsiveContainer>
</div>
```

The explicit-height parent (`h-[220px]`) is required. `ResponsiveContainer`
resolves to `height: 100%`, and 100% of nothing is nothing — if the
parent is a flex column with `flex-1` but no explicit min-height, the
chart collapses to 0 px. This is the recharts equivalent of the
`min-h-[280px]` fix in ComparisonView. Two heights on the parent
(`h-[180px] sm:h-[220px]`) give phones a smaller chart so the
containing card doesn't overflow the phone's viewport height.

### Theme awareness

Charts render to SVG which does *not* inherit CSS custom properties.
`useThemeColors()` (`frontend/src/components/visualization/use-theme-colors.ts`)
samples the computed CSS variables from `document.documentElement`
and returns a `ThemeColors` object with concrete hex strings. The
hook re-runs on theme toggle (it subscribes to the theme context) so
the chart palette flips automatically in dark mode. Every recharts
prop that takes a colour reads from `colors.*`:

```
<CartesianGrid stroke={colors.rule} />
<Bar dataKey="Before" fill={colors.warn} />
<Bar dataKey="After" fill={colors.accent} />
```

### Radar chart normalization

`MetricsDashboard.tsx:127` computes a `maxHamming` denominator:

```
const maxHamming = Math.max(
  innerMetrics.max_hamming_before,
  innerMetrics.max_hamming_after,
  1,
);
```

Each radar axis is then normalized against that: `avg / maxHamming`,
`max / maxHamming`, `improvement% / 100`, `dummy% = added / total`.
The `Math.max(..., 1)` guard prevents a divide-by-zero on FSMs with a
single state.

### Heatmap gradient

`heatColor(intensity)` at `MetricsDashboard.tsx:178` interpolates
between `--paper-shade` and `--warn` in RGB space. Diagonal cells get
`--paper-deep` (flat) to signal "same state, no distance". Cells with
`distance === 1` render the number in the `ok` colour with a
semibold weight — a single-bit transition is the ideal Gray-code
neighbour. The intent is a scannable heatmap where the eye is drawn
to non-1 distances (potential glitches).

## 4. HammingChart

`frontend/src/components/visualization/HammingChart.tsx` is the small
chart embedded in the right-column Lab Report card (not the Metrics
tab). Three sections:

- An improvement banner: the large accent number with `%` suffix
  (`HammingChart.tsx:68`)
- A horizontal-layout bar chart comparing avg Hamming before/after
- A vertical bar chart of state counts (Original / Dummy / Total)
- A 2x2 grid of metric tiles

Data source is the parent-passed props (which come from `result` on
the OptimizationPage) — this chart is a leaf, no data fetching. Same
recharts + `useThemeColors` pattern.

The `HammingChart.tsx:85` uses the same `h-[120px]` explicit-height
wrapper trick. The first chart is deliberately shorter (120 px) — it's
only two bars, doesn't need more.

## 5. Hypercube3D — the 3D visualization

`frontend/src/components/visualization/Hypercube3D.tsx:579` is the
"§ 2.3 Hypercube" tab. It's the technically heaviest component in the
app.

### Rendering stack

- `three@0.159` — WebGL rendering
- `@react-three/fiber@8.15` — React reconciler for three.js
- `@react-three/drei@9.92` — `OrbitControls`, `Text` primitives

Only two of these ship — no `@react-three/postprocessing`, no
shaders. The visualization is deliberately wireframe: unlit
`meshBasicMaterial` for vertex disks, `lineBasicMaterial` for edges.
Comment at `Hypercube3D.tsx:2`:

> Datasheet aesthetic. No shaded materials, no atmospheric fog, no
> point lights — only line segments and unlit dots.

`ambientLight intensity={1.0}` (`Hypercube3D.tsx:336`) is present but
unused for anything except making basic materials render at full
brightness — no diffuse shading anywhere.

### What it shows

- **Vertices**: every possible `n`-bit Gray code as a tiny octahedron
  (`radius=0.075` regular, `radius=0.11` highlighted). Highlighted
  vertices get an accent-coloured hairline ring around them
  (`Hypercube3D.tsx:181`).
- **Edges**: every pair of vertices differing by exactly one bit —
  the hypercube's proper edges. Hairline lines in `--rule`; accent
  when the corresponding transition is present in the FSM.
- **Animated particles**: for each transition, a small accent sphere
  travels along its edge from source to target
  (`Hypercube3D.tsx:253`). Speed varies slightly by index
  (`0.4 + (i % 3) * 0.15`) so particles don't move in lockstep.
- **Grid helper**: faint horizontal grid at `y = -3` in `--rule` to
  give depth cues (`Hypercube3D.tsx:340`).
- **OrbitControls** with auto-rotate enabled when no transitions
  are present (`Hypercube3D.tsx:634`) — a "resting" mode that gently
  spins the cube.

### Vertex placement — the projection

`ndVertexTo3D(index, n)` (`Hypercube3D.tsx:64`) projects an n-bit
integer to R^3:

- `x`, `y` from bits 0 and 1: 0 → -1, 1 → +1, scaled by `scale=1.8`.
- `z` from bit 2 if `n >= 3` (else `z = 0`).
- Bits 3 and 4 don't add new axes — they perturb existing ones:
  ```
  if (n >= 4) { x += d3 * 0.38; y += d3 * 0.38; }
  if (n >= 5) { x += d4 * 0.18; z += d4 * 0.18; }
  ```
  The 4th and 5th dimensions "shift" the 3D projection along a
  diagonal. This is not a canonical hypercube projection (a proper
  4D → 3D Schlegel or Cayley graph embedding would look different),
  but it's a legible approximation that keeps vertices distinct up
  to 5D.

`buildVertices(numBits)` (`Hypercube3D.tsx:86`) generates all
`2^numBits` vertices, computing the Gray code as `i ^ (i >> 1)`.
`buildEdges` (`Hypercube3D.tsx:98`) connects pairs whose integer XOR
is a power of two — i.e. differ by exactly one bit — which is the
combinatorial definition of a hypercube edge. The fallback loop at
`Hypercube3D.tsx:120` is defensive; it should never actually execute
(the primary loop covers the same pairs).

### Bundle size and lazy loading

Bundle inspection: the `Hypercube3D` chunk is ~940 KB minified /
~266 KB gzipped, dominated by three.js. To keep this out of the
initial bundle, `OptimizationPage.tsx:18` uses `lazyWithRetry`:

```
const Hypercube3D = lazyWithRetry(() => import('../components/visualization/Hypercube3D'));
```

Combined with the deliberate omission from `vite.config.ts:66`
(`three` / `@react-three/*` are not in `manualChunks`), three.js only
downloads on first activation of the Hypercube tab. Users who only
run Comparison + Metrics never pay for it.

The Suspense fallback (`OptimizationPage.tsx:352`) shows a spinner
plus "Loading 3D visualization…" while the chunk streams in. The
`lazyWithRetry` wrapper additionally handles the stale-chunk-after-
deploy case (see `explainer/frontend.md` §6).

### Renders only when active

`OptimizationPage.tsx:349`:

```
{activeTab === 'hypercube' && (
  <div className="h-[60vh] sm:h-[560px] p-4">
    <ErrorBoundary>
      <Suspense fallback={...}>
        <Hypercube3D numBits={...} highlightedStates={...} transitions={...} />
      </Suspense>
    </ErrorBoundary>
  </div>
)}
```

The tab conditional means the component *unmounts* when the user
switches away. Three.js resources (WebGL context, buffers, geometries)
release on unmount via `@react-three/fiber`'s cleanup. Re-mounting on
tab return is cheap — the chunk is cached; only the scene graph
rebuild costs.

### Interactive controls

Overlay UI (`Hypercube3D.tsx:381`, `:524`):

- **Bit width slider** — 2 to 5 bits. Beyond 5 the 3D projection
  becomes unreadable (16 → 32 vertices already dense).
- **Show labels** — toggles the Gray code strings above each vertex.
- **Animate transitions** — toggles the particle motion.
- **Stats overlay** — vertices, edges, highlighted count, transitions.

`onPointerDown={(e) => e.stopPropagation()}` on the controls panel
(`Hypercube3D.tsx:399`) prevents OrbitControls from consuming the
drag and starting to rotate the cube when the user drags the slider.

## 6. Gray code utilities

`frontend/src/utils/gray-code/generator.ts` — pure functions, no
React, no dependencies. All operations on binary strings.

- `intToGray(n, bitWidth)` — computes `n ^ (n >> 1)`, pads to width.
  This is the standard reflected-Gray-code formula: successive integers
  differ by exactly one bit in their Gray-code representation.
- `grayToInt(gray)` — inverse: XOR-shift accumulate.
- `generateGrayCodes(bitWidth)` — full sequence for a width.
- `hammingDistance(a, b)` — counts differing characters; throws on
  length mismatch (defensive; the FSM optimizer never mixes widths).
- `isSafeTransition(from, to)` — Hamming distance of exactly 1.
- `getDifferingBit(a, b)` — returns the bit position that differs, or
  `-1` if multiple do.

`frontend/src/utils/gray-code/hypercube.ts` — 2D positioning for the
generic hypercube graph. Note: this file is *not* what Hypercube3D
uses. The 3D component has its own `ndVertexTo3D` in
`Hypercube3D.tsx:64` because three.js needs `THREE.Vector3` positions,
not `{x, y}` objects.

- `generateHypercubeVertices(bitWidth)` — vertices with 2D positions.
  Square layout at 2 bits, cube-with-perspective at 3, circular at 4+.
- `generateHypercubeEdges(bitWidth)` — same "XOR is a power of two"
  test as Hypercube3D.
- `findShortestPath(from, to, bitWidth)` — BFS in the hypercube.
  Guaranteed minimum path length (BFS invariant). Currently unused
  in the shipping UI; kept for the not-yet-shipped 2D hypercube view.

Duplication note: the vertex-generation logic exists in *both*
`hypercube.ts` (2D, unused) and `Hypercube3D.tsx` (3D, live).
Consolidating them would need a shared `generateHypercube(bitWidth)`
that returns bit-position pairs and a per-consumer position mapper.
Not currently a priority.

## 7. Data flow — full lab report round-trip

```
[User clicks Run Optimization]
    │
    ▼
OptimizationForm submits { algorithm, options }
    │
    ▼
useOptimize.mutateAsync({ fsmId, request })
    │
    ▼
algorithmAPI.optimize(fsmId, request)
    │  POST /fsms/:id/optimize
    │  → axios interceptor: response = response.data
    │  → algorithms.ts:29 bare-body tolerance
    │  → normalizeOptimizationResponse(res.data)
    ▼
OptimizationResponse arrives in handleOptimize
    │
    ▼
setResult(optimizationResult)
setOptimizedFSM(null); setOptimizedFSMError(null)
    │
    ▼
fsmAPI.get(optimizationResult.optimized_fsm_id)
    │  GET /fsms/:id
    │  → interceptor + fsms.ts:19 bare-body tolerance
    │  → normalizeFSM(res.data)
    ▼
setOptimizedFSM(optFSM)                       ┃ or setOptimizedFSMError('...')
    │                                          ▼
    ▼                                     Comparison tab renders Alert
setActiveTab('comparison')
    │
    ▼
────── Tab panel renders ───────────────────────────────────────
    Comparison  → <ComparisonView originalFSM optimizedFSM metrics=result />
                    ├── StaticCanvas (original)  — React Flow, read-only
                    └── StaticCanvas (optimized) — React Flow, read-only

    Metrics     → <MetricsDashboard metrics=result />
                    Reads metrics.avg_hamming_before/after, .max_*, etc.
                    Reads encoding_map for the state-encoding table +
                      pairwise Hamming heatmap.

    Hypercube   → <Hypercube3D
                    numBits={computeNumBits(result.total_states)}
                    highlightedStates={Object.values(result.encoding_map)}
                    transitions={originalFSM.transitions}
                  />
                    - Lazy-loaded via lazyWithRetry
                    - Vertex placement from ndVertexTo3D (own function)
                    - Highlights union of encoding_map values

    Lab Report card (right column)
                → <HammingChart avgBefore={metrics.avg_hamming_before} ... />
                → Export link → /export/:id?optimized=true
```

### Where the data comes out of the response

- `result.metrics.avg_hamming_before / avg_hamming_after` → HammingChart,
  MetricsDashboard bar chart
- `result.metrics.max_hamming_before / max_hamming_after` → radar,
  MetricsDashboard bar chart
- `result.encoding_map: Record<stateName, grayCode>` → MetricsDashboard
  encoding table, Hypercube highlight set, pairwise distance heatmap
- `result.dummy_states_added` / `result.total_states` → summary tiles,
  pie chart
- `result.improvement_percentage` → improvement banner, radar
- `result.execution_time_ms` → summary tile

## 8. Common cross-questions

**Q: Why not render the hypercube as SVG instead of Three.js?**
A 2D SVG projection of an n-cube requires either an isometric-style
fixed projection (which collapses same-position vertices for `n >= 4`)
or a force-directed layout (which loses the combinatorial structure
of "edge = single-bit change"). Three.js + OrbitControls lets the user
rotate through the 3D projection and disambiguate visually. The cost
is real — 940 KB / 266 KB gzip — but it's paid only when the user
opens the tab. The 2D SVG code path *does* exist
(`utils/gray-code/hypercube.ts`) but isn't wired up; if bundle size
ever becomes critical it's a reasonable fallback for 2- and 3-bit
cubes.

**Q: How does the hypercube handle FSMs with more than 5 dimensions?**
The bit-width slider caps at 5 (`Hypercube3D.tsx:417`). Beyond 5 bits,
the 3D projection at `ndVertexTo3D` becomes visually indistinct — 32
vertices already push the vertex-disk radius (0.075) close to overlap
at typical camera distance. The initial `numBits` prop is clamped by
`computeNumBits(totalStates)` at `OptimizationPage.tsx:42`, which
returns `min(5, max(2, ceil(log2(totalStates))))`. So a 100-state FSM
renders a 5-bit hypercube of 32 vertices — highlighting only the 100
Gray codes that map to real states. This is the compromise; a truly
faithful visualization would need a different geometry entirely.

**Q: What happens if `encoding_map` is missing from an old AlgorithmResult row?**
The normalizer defaults it to `{}` (`normalize.ts:127`). Downstream
consumers see:
- MetricsDashboard: the encoding-table and distance-heatmap sections
  are wrapped in `encodingRows.length > 0` / `encodingEntries.length > 1`
  guards (`MetricsDashboard.tsx:387`, `:427`) — they simply don't render.
- Hypercube3D: `highlightedStates` becomes `Object.values({})` = `[]`,
  so `highlightedSet` is empty. `OptimizationPage.tsx:363` explicitly
  falls back to `originalFSM.states` in that case, so at least the
  original states are highlighted by name — which won't match the
  hypercube's Gray codes but still gives a non-empty visual.
- ComparisonView is unaffected — it doesn't consume `encoding_map`.

**Q: Why do the ComparisonView canvases not stay in sync when the user pans one?**
By design. Each `<StaticCanvas>` is wrapped in its own
`<ReactFlowProvider>` (`ComparisonView.tsx:243`), which gives it an
independent viewport. Sharing a provider would sync selections *and*
pan/zoom, but React Flow's coordinate system is per-graph — the two
FSMs have different node counts and different fit-view rectangles.
Forcing shared pan would leave one graph clipped. If we wanted linked
pan we'd need to compute the intersection of both fit-view rects
first, or use an overlay-mode with a single provider.

**Q: How do you tell if a chart is 'live' vs 'restored from past run'?**
Currently, you can't from the UI. The Lab Report card header shows
"just now" as a hardcoded string (`OptimizationPage.tsx:412`) —
that's a lie for restored runs. `AlgorithmResult.executed_at` is
carried through in the response (`types/fsm.ts:109`) but the page
doesn't yet render it. A small addition would be to swap "just now"
for a `date-fns` formatted `executed_at` when the result came from
the past-results restore path (i.e. when the `pastResultsResp` effect
was the one that called `setResult`). That's a known follow-up.
