# Frontend Agent

> Read `agents/memory.md` first for full project context.

## Mission
Build the missing UI pages and components. The app currently has only a HomePage with an FSM list and a 404 page. You need to build the FSM editor, optimization UI, export page, gallery, and examples browser. All dependencies are already installed.

---

## Owned Files

### CREATE (new files)
- `frontend/src/pages/EditorPage.tsx` — FSM visual editor with ReactFlow
- `frontend/src/pages/OptimizationPage.tsx` — Run optimization, view results
- `frontend/src/pages/ExportPage.tsx` — Export FSM to HDL/JSON
- `frontend/src/pages/GalleryPage.tsx` — Browse public FSMs
- `frontend/src/pages/ExamplesPage.tsx` — Browse example FSMs
- `frontend/src/pages/AboutPage.tsx` — About page
- `frontend/src/components/layout/AppLayout.tsx` — Shared layout with nav
- `frontend/src/components/layout/Navbar.tsx` — Top navigation bar
- `frontend/src/components/layout/Sidebar.tsx` — Side navigation
- `frontend/src/components/fsm/FSMCanvas.tsx` — ReactFlow FSM diagram
- `frontend/src/components/fsm/StateNode.tsx` — Custom ReactFlow node for states
- `frontend/src/components/fsm/TransitionEdge.tsx` — Custom ReactFlow edge
- `frontend/src/components/fsm/PropertyPanel.tsx` — Edit state/transition properties
- `frontend/src/components/forms/FSMCreateForm.tsx` — Create new FSM form
- `frontend/src/components/forms/OptimizationForm.tsx` — Algorithm selection form
- `frontend/src/components/forms/ExportForm.tsx` — Export format selection
- `frontend/src/components/visualization/HammingChart.tsx` — Before/after comparison chart
- `frontend/src/components/visualization/HypercubeView.tsx` — 3D hypercube (Three.js)
- `frontend/src/store/fsmStore.ts` — Zustand store for FSM editor state
- `frontend/src/store/uiStore.ts` — Zustand store for UI state (sidebar, modals)
- `frontend/src/hooks/useFSM.ts` — React Query hooks for FSM operations
- `frontend/src/hooks/useOptimization.ts` — React Query hooks for optimization
- `frontend/src/hooks/useExport.ts` — React Query hooks for export

### MODIFY
- `frontend/src/App.tsx` — Wire all new routes from config/routes.ts

## DO NOT Touch
- `frontend/src/api/*` — API client layer is complete and correct
- `frontend/src/types/*` — Type definitions are frozen contract
- `frontend/src/config/*` — Configuration is complete
- `frontend/src/utils/gray-code/*` — Working utility code

---

## Current Status

**What exists and works:**
- `HomePage.tsx` — Fetches FSMs via React Query, displays list with loading skeletons
- `NotFoundPage.tsx` — 404 page
- `api/client.ts` — Axios instance with auth interceptor, 30s timeout
- `api/endpoints/fsms.ts` — list, get, create, update, delete, fork
- `api/endpoints/algorithms.ts` — optimize function ready
- `api/endpoints/export.ts` — export function ready
- `config/routes.ts` — 10 routes defined with `generateRoute()` helper
- `config/constants.ts` — `SUPPORTED_ALGORITHMS`, `EXPORT_FORMATS`, `FSM_TYPES`
- `types/fsm.ts` — Complete type definitions for all entities

**What's missing:**
- 8 out of 10 routes not wired in App.tsx
- No layout component (no navigation between pages)
- No FSM visualization (ReactFlow installed but unused)
- No optimization UI
- No export UI
- No Zustand stores
- No custom hooks
- No form components

---

## Tasks (Priority Order)

### Task 1: Layout + Navigation
Create `AppLayout.tsx` with:
- Top navbar with app name, navigation links
- Use routes from `config/routes.ts` constants
- Responsive: hamburger menu on mobile
- Wrap all pages in this layout

### Task 2: Zustand Stores
`fsmStore.ts`:
```typescript
import { create } from 'zustand';
import type { FSM, State, Transition } from '../types/fsm';

interface FSMStore {
  currentFSM: FSM | null;
  selectedNode: string | null;
  selectedEdge: string | null;
  isEditing: boolean;
  setCurrentFSM: (fsm: FSM | null) => void;
  setSelectedNode: (id: string | null) => void;
  addState: (state: State) => void;
  addTransition: (transition: Transition) => void;
  // ... etc
}
```

### Task 3: React Query Hooks
`useFSM.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fsmAPI } from '../api/endpoints/fsms';

export const useFSMs = (params) => useQuery({ queryKey: ['fsms', params], queryFn: () => fsmAPI.list(params) });
export const useFSM = (id) => useQuery({ queryKey: ['fsm', id], queryFn: () => fsmAPI.get(id) });
export const useCreateFSM = () => useMutation({ mutationFn: fsmAPI.create, onSuccess: () => queryClient.invalidateQueries(['fsms']) });
```

### Task 4: FSM Editor Page (highest impact)
Build with ReactFlow:
- Canvas for dragging/connecting states
- Custom `StateNode` component (circle with state name)
- Custom `TransitionEdge` component (labeled arrows)
- Property panel on the right for editing selected state/transition
- Toolbar: Add State, Add Transition, Save, Run Optimization
- Use `data-testid` attributes on key elements

### Task 5: Optimization Page
- Load FSM by ID from URL params
- Show current FSM diagram (read-only ReactFlow)
- Algorithm selector (dropdown from `SUPPORTED_ALGORITHMS`)
- "Optimize" button triggers `algorithmAPI.optimize()`
- Show results: before/after side-by-side, metrics via Recharts bar chart
- Display: dummy states added, improvement %, execution time

### Task 6: Export Page
- Format selector (from `EXPORT_FORMATS`)
- Options (module name, comments toggle, style)
- Preview panel showing generated code with syntax highlighting
- Download button

### Task 7: Gallery + Examples Pages
- Gallery: Grid of public FSMs with search/filter
- Examples: Load from `/api/v1/examples`, click to open in editor

### Task 8: Wire Routes in App.tsx
```tsx
import { ROUTES } from './config/routes';
// Add all routes inside BrowserRouter
<Route path={ROUTES.EDITOR} element={<AppLayout><EditorPage /></AppLayout>} />
<Route path={ROUTES.EDITOR_EDIT} element={<AppLayout><EditorPage /></AppLayout>} />
<Route path={ROUTES.OPTIMIZE} element={<AppLayout><OptimizationPage /></AppLayout>} />
// ... etc
```

---

## Key Patterns to Follow

From the working `HomePage.tsx`:
```tsx
// React Query usage pattern
const { data: fsms, isLoading, error } = useQuery({
  queryKey: ['fsms'],
  queryFn: () => fsmAPI.list({ limit: 10 }),
});

// Tailwind styling pattern
<div className="min-h-screen bg-gray-50">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {isLoading ? <LoadingSkeleton /> : <Content data={fsms} />}
  </div>
</div>
```

## Installed Dependencies Available
- `reactflow` — FSM diagram editor
- `three` + `@react-three/fiber` + `@react-three/drei` — 3D hypercube
- `recharts` — Charts for optimization results
- `zustand` — Client state management
- `framer-motion` — Animations and transitions
- `react-hook-form` + `zod` — Form handling with validation
- `lucide-react` — Icon library

---

## Interfaces

- **backend-agent** provides the API. Use the pre-built `api/endpoints/*` modules.
- **testing-agent** will write E2E tests using page objects. Add `data-testid` to key interactive elements.
- **devops-agent** will add telemetry. No action needed from you.
