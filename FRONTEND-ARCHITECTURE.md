# GrayFSM Frontend Architecture

## Executive Summary

This document defines the complete frontend architecture for GrayFSM, an interactive web-based tool for optimizing finite state machines using Gray code encoding. The frontend is built with React 18+, TypeScript, and modern tooling to provide an educational, accessible, and performant user experience.

**Key Technologies:**
- React 18+ with TypeScript
- React Flow for FSM visualization
- Three.js with React Three Fiber for 3D hypercube
- TanStack Query (React Query) for data fetching
- Zustand for state management
- React Router v6 for routing
- Tailwind CSS with custom design system
- Framer Motion for animations
- React Hook Form + Zod for form validation
- Storybook for component documentation

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Hierarchy](#component-hierarchy)
3. [State Management](#state-management)
4. [Routing Structure](#routing-structure)
5. [Data Fetching Strategy](#data-fetching-strategy)
6. [Component Specifications](#component-specifications)
7. [FSM Editor Design](#fsm-editor-design)
8. [Visualization Components](#visualization-components)
9. [Design System](#design-system)
10. [Accessibility](#accessibility)
11. [Performance Optimization](#performance-optimization)
12. [Error Handling](#error-handling)
13. [Testing Strategy](#testing-strategy)
14. [Deployment & Build](#deployment--build)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Presentation Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Pages     │  │   Layouts    │  │  Components  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  State Mgmt  │  │    Hooks     │  │   Context    │          │
│  │  (Zustand)   │  │              │  │   Providers  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ React Query  │  │  API Client  │  │    Types     │          │
│  │              │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│                    FastAPI Backend                               │
│                   (openapi-spec.yaml)                            │
└─────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
frontend/
├── public/
│   ├── index.html
│   ├── favicon.ico
│   └── assets/
│       ├── examples/           # Example FSM JSON files
│       └── tutorials/          # Tutorial content
├── src/
│   ├── api/                    # API client and endpoints
│   │   ├── client.ts
│   │   ├── endpoints/
│   │   │   ├── fsms.ts
│   │   │   ├── algorithms.ts
│   │   │   ├── export.ts
│   │   │   └── examples.ts
│   │   └── types/              # API response types
│   ├── components/             # Reusable components
│   │   ├── ui/                 # Base UI components
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Card/
│   │   │   ├── Modal/
│   │   │   └── ...
│   │   ├── fsm/                # FSM-specific components
│   │   │   ├── FSMNode/
│   │   │   ├── FSMEdge/
│   │   │   ├── StateProperties/
│   │   │   └── TransitionEditor/
│   │   ├── visualization/      # Visualization components
│   │   │   ├── FSMGraph/
│   │   │   ├── HypercubeView/
│   │   │   ├── Hypercube3D/
│   │   │   └── MetricsChart/
│   │   ├── forms/              # Form components
│   │   │   ├── FSMCreateForm/
│   │   │   ├── ImportForm/
│   │   │   └── ExportForm/
│   │   └── layout/             # Layout components
│   │       ├── Header/
│   │       ├── Sidebar/
│   │       ├── Footer/
│   │       └── Navigation/
│   ├── pages/                  # Page components
│   │   ├── Home/
│   │   ├── Editor/
│   │   ├── Optimize/
│   │   ├── Gallery/
│   │   ├── Examples/
│   │   ├── Learn/
│   │   └── NotFound/
│   ├── layouts/                # Layout wrappers
│   │   ├── MainLayout.tsx
│   │   ├── EditorLayout.tsx
│   │   └── AuthLayout.tsx
│   ├── hooks/                  # Custom hooks
│   │   ├── useAPI/
│   │   ├── useFSM/
│   │   ├── useOptimization/
│   │   ├── useExport/
│   │   └── useWebSocket/
│   ├── store/                  # Zustand stores
│   │   ├── fsmStore.ts
│   │   ├── editorStore.ts
│   │   ├── uiStore.ts
│   │   └── authStore.ts
│   ├── utils/                  # Utility functions
│   │   ├── fsm/
│   │   │   ├── validation.ts
│   │   │   ├── transform.ts
│   │   │   └── export.ts
│   │   ├── gray-code/
│   │   │   ├── generator.ts
│   │   │   └── hypercube.ts
│   │   └── format/
│   │       ├── json.ts
│   │       └── csv.ts
│   ├── types/                  # TypeScript type definitions
│   │   ├── fsm.ts
│   │   ├── algorithm.ts
│   │   └── api.ts
│   ├── styles/                 # Global styles
│   │   ├── globals.css
│   │   ├── tailwind.css
│   │   └── theme/
│   │       ├── colors.ts
│   │       ├── typography.ts
│   │       └── spacing.ts
│   ├── config/                 # Configuration
│   │   ├── constants.ts
│   │   ├── routes.ts
│   │   └── api.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── .storybook/                 # Storybook configuration
│   ├── main.ts
│   ├── preview.ts
│   └── theme.ts
├── tests/                      # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

---

## Component Hierarchy

### ASCII Component Tree

```
App
├── Router
│   ├── MainLayout
│   │   ├── Header
│   │   │   ├── Logo
│   │   │   ├── Navigation
│   │   │   └── UserMenu (Phase 4)
│   │   ├── Sidebar (conditional)
│   │   ├── main (Outlet)
│   │   │   └── [Page Components]
│   │   └── Footer
│   │       ├── Links
│   │       └── Copyright
│   │
│   ├── EditorLayout
│   │   ├── EditorHeader
│   │   │   ├── ProjectName
│   │   │   ├── SaveStatus
│   │   │   └── ActionButtons
│   │   ├── EditorToolbar
│   │   │   ├── NodeTools
│   │   │   ├── EdgeTools
│   │   │   └── ViewControls
│   │   ├── EditorWorkspace
│   │   │   ├── ReactFlowCanvas
│   │   │   │   ├── FSMNode (custom)
│   │   │   │   ├── FSMEdge (custom)
│   │   │   │   └── Controls
│   │   │   └── PropertiesPanel
│   │   │       ├── StateProperties
│   │   │       └── TransitionProperties
│   │   └── EditorSidebar
│   │       ├── ComponentPalette
│   │       ├── FSMOutline
│   │       └── LayerPanel
│   │
│   └── Pages
│       ├── HomePage
│       │   ├── Hero
│       │   ├── FeatureGrid
│       │   ├── ExampleGallery
│       │   └── CallToAction
│       │
│       ├── EditorPage
│       │   └── FSMEditor
│       │       ├── Canvas
│       │       ├── Toolbar
│       │       └── PropertiesPanel
│       │
│       ├── OptimizePage
│       │   ├── SourceFSMPanel
│       │   │   └── FSMViewer
│       │   ├── OptimizationControls
│       │   │   ├── AlgorithmSelector
│       │   │   ├── OptionsForm
│       │   │   └── OptimizeButton
│       │   ├── ResultsPanel
│       │   │   ├── OptimizedFSMViewer
│       │   │   ├── ComparisonView
│       │   │   └── MetricsDashboard
│       │   └── VisualizationPanel
│       │       ├── HypercubeView
│       │       └── TransitionAnimation
│       │
│       ├── GalleryPage
│       │   ├── FilterBar
│       │   ├── FSMGrid
│       │   │   └── FSMCard[]
│       │   └── Pagination
│       │
│       ├── ExamplesPage
│       │   ├── CategoryNav
│       │   ├── ExampleList
│       │   │   └── ExampleCard[]
│       │   └── ExampleViewer
│       │       ├── FSMVisualization
│       │       ├── Description
│       │       └── TryItButton
│       │
│       └── LearnPage
│           ├── TutorialNav
│           ├── TutorialContent
│           │   ├── StepIndicator
│           │   ├── ContentSection
│           │   └── InteractiveDemo
│           └── QuizSection
│
├── Global Providers
│   ├── QueryClientProvider (React Query)
│   ├── ThemeProvider
│   ├── ToastProvider (notifications)
│   └── ErrorBoundary
│
└── Global Components
    ├── Toast/Notification
    ├── LoadingSpinner
    ├── ProgressBar
    └── ConfirmDialog
```

### Key Component Categories

#### 1. Layout Components
- **MainLayout**: Primary app layout with header, footer, sidebar
- **EditorLayout**: Specialized layout for FSM editor
- **AuthLayout**: Authentication pages (Phase 4)

#### 2. Page Components
- **HomePage**: Landing page with features and examples
- **EditorPage**: FSM creation and editing
- **OptimizePage**: Optimization interface
- **GalleryPage**: Browse user-created FSMs
- **ExamplesPage**: Curated example library
- **LearnPage**: Interactive tutorials

#### 3. UI Components (Design System)
- Button, Input, Select, Checkbox, Radio
- Card, Modal, Dialog, Drawer
- Tabs, Accordion, Dropdown
- Badge, Chip, Tag
- Alert, Toast, Banner
- Table, List, Grid
- Skeleton, Spinner, ProgressBar

#### 4. Domain Components
- **FSM Components**: Nodes, edges, graph viewer
- **Visualization Components**: Hypercube, metrics charts
- **Form Components**: FSM creation, import, export
- **Algorithm Components**: Algorithm selector, comparison

---

## State Management

### State Architecture

We use **Zustand** for global state and **React Query** for server state. This separation provides:
- Simple, minimal boilerplate (Zustand)
- Automatic caching, revalidation, and synchronization (React Query)
- Type-safe state management
- DevTools support

### Zustand Stores

#### 1. FSM Store (`fsmStore.ts`)

```typescript
// src/store/fsmStore.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { FSM, State, Transition } from '@/types/fsm';

interface FSMState {
  // Current FSM being edited
  currentFSM: FSM | null;

  // History for undo/redo
  history: FSM[];
  historyIndex: number;

  // Selection state
  selectedStates: string[];
  selectedTransitions: string[];

  // Actions
  setCurrentFSM: (fsm: FSM | null) => void;
  updateFSM: (updates: Partial<FSM>) => void;

  addState: (state: State) => void;
  updateState: (stateId: string, updates: Partial<State>) => void;
  deleteState: (stateId: string) => void;

  addTransition: (transition: Transition) => void;
  updateTransition: (transitionId: string, updates: Partial<Transition>) => void;
  deleteTransition: (transitionId: string) => void;

  selectStates: (stateIds: string[]) => void;
  selectTransitions: (transitionIds: string[]) => void;
  clearSelection: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  reset: () => void;
}

export const useFSMStore = create<FSMState>()(
  devtools(
    persist(
      (set, get) => ({
        currentFSM: null,
        history: [],
        historyIndex: -1,
        selectedStates: [],
        selectedTransitions: [],

        setCurrentFSM: (fsm) => {
          set({ currentFSM: fsm });
          // Add to history
          const { history, historyIndex } = get();
          const newHistory = history.slice(0, historyIndex + 1);
          if (fsm) {
            newHistory.push(fsm);
          }
          set({
            history: newHistory,
            historyIndex: newHistory.length - 1
          });
        },

        updateFSM: (updates) => {
          const { currentFSM } = get();
          if (!currentFSM) return;

          const updatedFSM = { ...currentFSM, ...updates };
          get().setCurrentFSM(updatedFSM);
        },

        addState: (state) => {
          const { currentFSM } = get();
          if (!currentFSM) return;

          const updatedFSM = {
            ...currentFSM,
            states: [...currentFSM.states, state.name],
            definition: {
              ...currentFSM.definition,
              states: [...(currentFSM.definition.states || []), state]
            }
          };
          get().setCurrentFSM(updatedFSM);
        },

        updateState: (stateId, updates) => {
          const { currentFSM } = get();
          if (!currentFSM) return;

          const definition = currentFSM.definition;
          const updatedStates = definition.states?.map((s: State) =>
            s.id === stateId ? { ...s, ...updates } : s
          );

          get().updateFSM({
            definition: { ...definition, states: updatedStates }
          });
        },

        deleteState: (stateId) => {
          const { currentFSM } = get();
          if (!currentFSM) return;

          const definition = currentFSM.definition;
          const updatedStates = definition.states?.filter(
            (s: State) => s.id !== stateId
          );
          const updatedTransitions = definition.transitions?.filter(
            (t: Transition) => t.from_state !== stateId && t.to_state !== stateId
          );

          get().updateFSM({
            definition: {
              ...definition,
              states: updatedStates,
              transitions: updatedTransitions
            }
          });
        },

        addTransition: (transition) => {
          const { currentFSM } = get();
          if (!currentFSM) return;

          const definition = currentFSM.definition;
          get().updateFSM({
            definition: {
              ...definition,
              transitions: [...(definition.transitions || []), transition]
            }
          });
        },

        updateTransition: (transitionId, updates) => {
          const { currentFSM } = get();
          if (!currentFSM) return;

          const definition = currentFSM.definition;
          const updatedTransitions = definition.transitions?.map(
            (t: Transition) => (t.id === transitionId ? { ...t, ...updates } : t)
          );

          get().updateFSM({
            definition: { ...definition, transitions: updatedTransitions }
          });
        },

        deleteTransition: (transitionId) => {
          const { currentFSM } = get();
          if (!currentFSM) return;

          const definition = currentFSM.definition;
          const updatedTransitions = definition.transitions?.filter(
            (t: Transition) => t.id !== transitionId
          );

          get().updateFSM({
            definition: { ...definition, transitions: updatedTransitions }
          });
        },

        selectStates: (stateIds) => set({ selectedStates: stateIds }),
        selectTransitions: (transitionIds) => set({ selectedTransitions: transitionIds }),
        clearSelection: () => set({ selectedStates: [], selectedTransitions: [] }),

        undo: () => {
          const { history, historyIndex } = get();
          if (historyIndex > 0) {
            set({
              currentFSM: history[historyIndex - 1],
              historyIndex: historyIndex - 1
            });
          }
        },

        redo: () => {
          const { history, historyIndex } = get();
          if (historyIndex < history.length - 1) {
            set({
              currentFSM: history[historyIndex + 1],
              historyIndex: historyIndex + 1
            });
          }
        },

        canUndo: () => get().historyIndex > 0,
        canRedo: () => get().historyIndex < get().history.length - 1,

        reset: () => set({
          currentFSM: null,
          history: [],
          historyIndex: -1,
          selectedStates: [],
          selectedTransitions: []
        })
      }),
      {
        name: 'fsm-store',
        partialize: (state) => ({ currentFSM: state.currentFSM })
      }
    )
  )
);
```

#### 2. Editor Store (`editorStore.ts`)

```typescript
// src/store/editorStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

type EditorMode = 'select' | 'add-state' | 'add-transition' | 'delete';
type ViewMode = 'graph' | 'split' | 'code';

interface EditorState {
  // Editor mode
  mode: EditorMode;
  viewMode: ViewMode;

  // UI state
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  zoom: number;

  // Panels
  showPropertiesPanel: boolean;
  showSidebar: boolean;
  showMinimap: boolean;

  // Clipboard
  clipboard: any | null;

  // Actions
  setMode: (mode: EditorMode) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  setZoom: (zoom: number) => void;

  togglePropertiesPanel: () => void;
  toggleSidebar: () => void;
  toggleMinimap: () => void;

  copy: (data: any) => void;
  paste: () => any | null;

  reset: () => void;
}

export const useEditorStore = create<EditorState>()(
  devtools((set, get) => ({
    mode: 'select',
    viewMode: 'graph',
    showGrid: true,
    snapToGrid: true,
    gridSize: 20,
    zoom: 1,
    showPropertiesPanel: true,
    showSidebar: true,
    showMinimap: false,
    clipboard: null,

    setMode: (mode) => set({ mode }),
    setViewMode: (viewMode) => set({ viewMode }),
    toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
    toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
    setZoom: (zoom) => set({ zoom }),

    togglePropertiesPanel: () =>
      set((state) => ({ showPropertiesPanel: !state.showPropertiesPanel })),
    toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
    toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),

    copy: (data) => set({ clipboard: data }),
    paste: () => get().clipboard,

    reset: () => set({
      mode: 'select',
      viewMode: 'graph',
      showGrid: true,
      snapToGrid: true,
      zoom: 1,
      clipboard: null
    })
  }))
);
```

#### 3. UI Store (`uiStore.ts`)

```typescript
// src/store/uiStore.ts
import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system';

  // Toasts
  toasts: Toast[];

  // Modals
  activeModal: string | null;

  // Loading states
  globalLoading: boolean;
  loadingMessage: string | null;

  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  openModal: (modalId: string) => void;
  closeModal: () => void;

  setGlobalLoading: (loading: boolean, message?: string) => void;
}

export const useUIStore = create<UIState>()((set, get) => ({
  theme: 'system',
  toasts: [],
  activeModal: null,
  globalLoading: false,
  loadingMessage: null,

  setTheme: (theme) => {
    set({ theme });
    // Apply theme to document
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  },

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    // Auto-remove after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),

  setGlobalLoading: (loading, message) =>
    set({ globalLoading: loading, loadingMessage: message || null })
}));
```

---

## Routing Structure

### React Router Configuration

```typescript
// src/config/routes.ts
export const ROUTES = {
  HOME: '/',
  EDITOR: '/editor',
  EDITOR_NEW: '/editor/new',
  EDITOR_EDIT: '/editor/:id',
  OPTIMIZE: '/optimize/:id',
  GALLERY: '/gallery',
  EXAMPLES: '/examples',
  EXAMPLE_DETAIL: '/examples/:id',
  LEARN: '/learn',
  LEARN_TUTORIAL: '/learn/:tutorialId',
  ABOUT: '/about',
  DOCS: '/docs',
  NOT_FOUND: '*'
} as const;

// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Layouts
import { MainLayout } from '@/layouts/MainLayout';
import { EditorLayout } from '@/layouts/EditorLayout';

// Pages
import { HomePage } from '@/pages/Home';
import { EditorPage } from '@/pages/Editor';
import { OptimizePage } from '@/pages/Optimize';
import { GalleryPage } from '@/pages/Gallery';
import { ExamplesPage } from '@/pages/Examples';
import { ExampleDetailPage } from '@/pages/ExampleDetail';
import { LearnPage } from '@/pages/Learn';
import { TutorialPage } from '@/pages/Tutorial';
import { AboutPage } from '@/pages/About';
import { DocsPage } from '@/pages/Docs';
import { NotFoundPage } from '@/pages/NotFound';

// Providers
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                {/* Main routes with MainLayout */}
                <Route element={<MainLayout />}>
                  <Route path={ROUTES.HOME} element={<HomePage />} />
                  <Route path={ROUTES.GALLERY} element={<GalleryPage />} />
                  <Route path={ROUTES.EXAMPLES} element={<ExamplesPage />} />
                  <Route path={ROUTES.EXAMPLE_DETAIL} element={<ExampleDetailPage />} />
                  <Route path={ROUTES.LEARN} element={<LearnPage />} />
                  <Route path={ROUTES.LEARN_TUTORIAL} element={<TutorialPage />} />
                  <Route path={ROUTES.ABOUT} element={<AboutPage />} />
                  <Route path={ROUTES.DOCS} element={<DocsPage />} />
                </Route>

                {/* Editor routes with EditorLayout */}
                <Route element={<EditorLayout />}>
                  <Route path={ROUTES.EDITOR} element={<Navigate to={ROUTES.EDITOR_NEW} />} />
                  <Route path={ROUTES.EDITOR_NEW} element={<EditorPage />} />
                  <Route path={ROUTES.EDITOR_EDIT} element={<EditorPage />} />
                  <Route path={ROUTES.OPTIMIZE} element={<OptimizePage />} />
                </Route>

                {/* 404 */}
                <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
```

### Route Protection (Phase 4)

```typescript
// src/components/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

---

## Data Fetching Strategy

### React Query Architecture

We use **TanStack Query (React Query)** for all server state management. Benefits:
- Automatic caching and background refetching
- Optimistic updates
- Request deduplication
- Pagination and infinite queries
- Parallel and dependent queries

### API Client Setup

```typescript
// src/api/client.ts
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available (Phase 4)
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    // Handle errors globally
    if (error.response?.status === 401) {
      // Redirect to login (Phase 4)
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Type-safe API response wrapper
export interface APIResponse<T> {
  success: boolean;
  data: T;
  metadata?: {
    timestamp: string;
    version: string;
    request_id: string;
  };
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}
```

### API Endpoints

```typescript
// src/api/endpoints/fsms.ts
import { apiClient, APIResponse, PaginatedResponse } from '../client';
import { FSM, FSMCreate, FSMUpdate } from '@/types/fsm';

export const fsmAPI = {
  // List FSMs
  list: async (params?: {
    page?: number;
    page_size?: number;
    visibility?: 'public' | 'private' | 'example';
    fsm_type?: 'moore' | 'mealy';
    search?: string;
    tags?: string;
    sort_by?: 'created_at' | 'updated_at' | 'view_count' | 'name';
    sort_order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<FSM>> => {
    return apiClient.get('/fsms', { params });
  },

  // Get single FSM
  get: async (id: string): Promise<APIResponse<FSM>> => {
    return apiClient.get(`/fsms/${id}`);
  },

  // Create FSM
  create: async (data: FSMCreate): Promise<APIResponse<FSM>> => {
    return apiClient.post('/fsms', data);
  },

  // Update FSM
  update: async (id: string, data: FSMUpdate): Promise<APIResponse<FSM>> => {
    return apiClient.put(`/fsms/${id}`, data);
  },

  // Delete FSM
  delete: async (id: string): Promise<void> => {
    return apiClient.delete(`/fsms/${id}`);
  },

  // Fork FSM
  fork: async (id: string, name?: string): Promise<APIResponse<FSM>> => {
    return apiClient.post(`/fsms/${id}/fork`, { name });
  }
};

// src/api/endpoints/algorithms.ts
import { apiClient, APIResponse } from '../client';
import { OptimizationRequest, OptimizationResponse, AlgorithmResult } from '@/types/algorithm';

export const algorithmAPI = {
  // Optimize FSM
  optimize: async (
    fsmId: string,
    request: OptimizationRequest
  ): Promise<APIResponse<OptimizationResponse>> => {
    return apiClient.post(`/fsms/${fsmId}/optimize`, request);
  },

  // Get optimization results
  getResults: async (
    fsmId: string,
    algorithm?: string
  ): Promise<APIResponse<AlgorithmResult[]>> => {
    return apiClient.get(`/fsms/${fsmId}/results`, {
      params: { algorithm }
    });
  },

  // Compare algorithms
  compare: async (
    fsmId: string,
    algorithms: string[],
    options?: Record<string, any>
  ): Promise<APIResponse<AlgorithmResult[]>> => {
    return apiClient.post(`/fsms/${fsmId}/compare`, {
      algorithms,
      options
    });
  },

  // Get task status
  getTaskStatus: async (taskId: string): Promise<APIResponse<any>> => {
    return apiClient.get(`/tasks/${taskId}`);
  }
};

// src/api/endpoints/export.ts
import { apiClient, APIResponse } from '../client';
import { ExportRequest, ExportResponse } from '@/types/export';

export const exportAPI = {
  // Export FSM
  export: async (
    fsmId: string,
    request: ExportRequest
  ): Promise<APIResponse<ExportResponse>> => {
    return apiClient.post(`/fsms/${fsmId}/export`, request);
  },

  // Get cached export
  getCached: async (fsmId: string, format: string): Promise<string> => {
    const response = await apiClient.get(`/fsms/${fsmId}/export/${format}`, {
      responseType: 'text'
    });
    return response as unknown as string;
  }
};

// src/api/endpoints/examples.ts
import { apiClient, APIResponse, PaginatedResponse } from '../client';
import { FSM } from '@/types/fsm';

export const examplesAPI = {
  // List examples
  list: async (category?: string): Promise<PaginatedResponse<FSM>> => {
    return apiClient.get('/examples', { params: { category } });
  },

  // Get example
  get: async (id: string): Promise<APIResponse<FSM>> => {
    return apiClient.get(`/examples/${id}`);
  }
};
```

### Custom Hooks for Data Fetching

```typescript
// src/hooks/useAPI/useFSMs.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fsmAPI } from '@/api/endpoints/fsms';
import { FSMCreate, FSMUpdate } from '@/types/fsm';
import { useUIStore } from '@/store/uiStore';

// Query keys
export const FSM_KEYS = {
  all: ['fsms'] as const,
  lists: () => [...FSM_KEYS.all, 'list'] as const,
  list: (params?: any) => [...FSM_KEYS.lists(), params] as const,
  details: () => [...FSM_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...FSM_KEYS.details(), id] as const
};

// List FSMs
export function useFSMs(params?: Parameters<typeof fsmAPI.list>[0]) {
  return useQuery({
    queryKey: FSM_KEYS.list(params),
    queryFn: () => fsmAPI.list(params),
    keepPreviousData: true
  });
}

// Get single FSM
export function useFSM(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: FSM_KEYS.detail(id),
    queryFn: () => fsmAPI.get(id),
    enabled: options?.enabled ?? !!id
  });
}

// Create FSM
export function useCreateFSM() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  return useMutation({
    mutationFn: (data: FSMCreate) => fsmAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(FSM_KEYS.lists());
      addToast({
        type: 'success',
        message: 'FSM created successfully'
      });
    },
    onError: (error: any) => {
      addToast({
        type: 'error',
        message: error.response?.data?.error?.message || 'Failed to create FSM'
      });
    }
  });
}

// Update FSM
export function useUpdateFSM() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FSMUpdate }) =>
      fsmAPI.update(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries(FSM_KEYS.detail(variables.id));
      queryClient.invalidateQueries(FSM_KEYS.lists());
      addToast({
        type: 'success',
        message: 'FSM updated successfully'
      });
    },
    onError: (error: any) => {
      addToast({
        type: 'error',
        message: error.response?.data?.error?.message || 'Failed to update FSM'
      });
    }
  });
}

// Delete FSM
export function useDeleteFSM() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  return useMutation({
    mutationFn: (id: string) => fsmAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(FSM_KEYS.lists());
      addToast({
        type: 'success',
        message: 'FSM deleted successfully'
      });
    },
    onError: (error: any) => {
      addToast({
        type: 'error',
        message: error.response?.data?.error?.message || 'Failed to delete FSM'
      });
    }
  });
}

// Fork FSM
export function useForkFSM() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      fsmAPI.fork(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries(FSM_KEYS.lists());
      addToast({
        type: 'success',
        message: 'FSM forked successfully'
      });
    },
    onError: (error: any) => {
      addToast({
        type: 'error',
        message: error.response?.data?.error?.message || 'Failed to fork FSM'
      });
    }
  });
}

// src/hooks/useAPI/useOptimization.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { algorithmAPI } from '@/api/endpoints/algorithms';
import { OptimizationRequest } from '@/types/algorithm';
import { useUIStore } from '@/store/uiStore';

export const OPTIMIZATION_KEYS = {
  all: ['optimizations'] as const,
  results: (fsmId: string) => [...OPTIMIZATION_KEYS.all, 'results', fsmId] as const
};

// Optimize FSM
export function useOptimizeFSM() {
  const queryClient = useQueryClient();
  const { addToast, setGlobalLoading } = useUIStore();

  return useMutation({
    mutationFn: ({ fsmId, request }: { fsmId: string; request: OptimizationRequest }) =>
      algorithmAPI.optimize(fsmId, request),
    onMutate: () => {
      setGlobalLoading(true, 'Optimizing FSM...');
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries(OPTIMIZATION_KEYS.results(variables.fsmId));
      addToast({
        type: 'success',
        message: `Optimization complete! Added ${response.data.dummy_states_added} dummy states.`
      });
    },
    onError: (error: any) => {
      addToast({
        type: 'error',
        message: error.response?.data?.error?.message || 'Optimization failed'
      });
    },
    onSettled: () => {
      setGlobalLoading(false);
    }
  });
}

// Get optimization results
export function useOptimizationResults(fsmId: string, algorithm?: string) {
  return useQuery({
    queryKey: [...OPTIMIZATION_KEYS.results(fsmId), algorithm],
    queryFn: () => algorithmAPI.getResults(fsmId, algorithm),
    enabled: !!fsmId
  });
}

// Compare algorithms
export function useCompareAlgorithms() {
  const { addToast, setGlobalLoading } = useUIStore();

  return useMutation({
    mutationFn: ({
      fsmId,
      algorithms,
      options
    }: {
      fsmId: string;
      algorithms: string[];
      options?: Record<string, any>;
    }) => algorithmAPI.compare(fsmId, algorithms, options),
    onMutate: () => {
      setGlobalLoading(true, 'Comparing algorithms...');
    },
    onSuccess: () => {
      addToast({
        type: 'success',
        message: 'Algorithm comparison complete'
      });
    },
    onError: (error: any) => {
      addToast({
        type: 'error',
        message: error.response?.data?.error?.message || 'Comparison failed'
      });
    },
    onSettled: () => {
      setGlobalLoading(false);
    }
  });
}
```

### WebSocket for Real-time Updates

```typescript
// src/hooks/useWebSocket.ts
import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket(url: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [url]);

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  return { isConnected, lastMessage, sendMessage };
}

// Usage in optimization component
export function useOptimizationProgress(taskId: string | null) {
  const wsUrl = taskId
    ? `${import.meta.env.VITE_WS_URL}/ws/optimize?task_id=${taskId}`
    : null;

  const { isConnected, lastMessage } = useWebSocket(wsUrl);

  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'pending' | 'running' | 'completed' | 'failed'>('pending');

  useEffect(() => {
    if (lastMessage?.type === 'progress') {
      setProgress(lastMessage.data.progress);
      setStatus(lastMessage.data.status);
    }
  }, [lastMessage]);

  return { isConnected, progress, status };
}
```

---

## Component Specifications

### Core UI Components

Due to length constraints, I'll provide key component specifications. Full implementations would be in separate files.

#### Button Component

```typescript
// src/components/ui/Button/Button.tsx
import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-600',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500',
        outline: 'border border-gray-300 bg-transparent hover:bg-gray-100 focus-visible:ring-gray-500',
        ghost: 'hover:bg-gray-100 focus-visible:ring-gray-500',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600'
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : leftIcon ? (
          <span className="mr-2">{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

#### Input Component

```typescript
// src/components/ui/Input/Input.tsx
import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftAddon, rightAddon, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {props.required && <span className="ml-1 text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          {leftAddon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder-gray-400',
              'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
              'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
              'dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              leftAddon && 'pl-10',
              rightAddon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightAddon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {rightAddon}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {hint && !error && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
```

---

## FSM Editor Design

### React Flow Integration

```typescript
// src/components/fsm/FSMEditor/FSMEditor.tsx
import { useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  addEdge,
  NodeTypes,
  EdgeTypes
} from 'reactflow';
import 'reactflow/dist/style.css';

import { FSMNode } from './FSMNode';
import { FSMEdge } from './FSMEdge';
import { useFSMStore } from '@/store/fsmStore';
import { useEditorStore } from '@/store/editorStore';

const nodeTypes: NodeTypes = {
  fsmState: FSMNode
};

const edgeTypes: EdgeTypes = {
  fsmTransition: FSMEdge
};

export function FSMEditor() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { currentFSM, addState, addTransition } = useFSMStore();
  const { mode, showGrid, snapToGrid, gridSize } = useEditorStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Convert FSM to React Flow format
  useEffect(() => {
    if (!currentFSM) return;

    const fsmNodes: Node[] = currentFSM.definition.states?.map((state: any) => ({
      id: state.id,
      type: 'fsmState',
      position: state.position || { x: 0, y: 0 },
      data: {
        label: state.name,
        output: state.output,
        isInitial: state.id === currentFSM.initial_state,
        isDummy: state.is_dummy || false
      }
    })) || [];

    const fsmEdges: Edge[] = currentFSM.definition.transitions?.map((transition: any) => ({
      id: transition.id,
      source: transition.from_state,
      target: transition.to_state,
      type: 'fsmTransition',
      label: transition.input || transition.label,
      data: {
        input: transition.input,
        output: transition.output
      }
    })) || [];

    setNodes(fsmNodes);
    setEdges(fsmEdges);
  }, [currentFSM]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      // Add transition to store
      addTransition({
        id: `${params.source}-${params.target}`,
        from_state: params.source,
        to_state: params.target,
        input: '',
        label: ''
      });

      setEdges((eds) => addEdge({ ...params, type: 'fsmTransition' }, eds));
    },
    [addTransition]
  );

  const onNodeDragStop = useCallback(
    (event: any, node: Node) => {
      // Update state position in store
      const { currentFSM, updateState } = useFSMStore.getState();
      if (!currentFSM) return;

      updateState(node.id, {
        position: node.position
      });
    },
    []
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (mode !== 'add-state') return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top
      };

      const stateId = `S${nodes.length}`;
      addState({
        id: stateId,
        name: stateId,
        position,
        output: '0'
      });
    },
    [mode, nodes.length, addState]
  );

  return (
    <div ref={reactFlowWrapper} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        fitView
      >
        <Background visible={showGrid} gap={gridSize} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

### Custom FSM Node

```typescript
// src/components/fsm/FSMEditor/FSMNode.tsx
import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { cn } from '@/utils/cn';

interface FSMNodeData {
  label: string;
  output?: string;
  isInitial?: boolean;
  isDummy?: boolean;
}

export const FSMNode = memo(({ data, selected }: NodeProps<FSMNodeData>) => {
  return (
    <div
      className={cn(
        'rounded-full border-2 bg-white px-6 py-4 shadow-md transition-all',
        'min-w-[80px] text-center',
        selected && 'ring-2 ring-primary-500 ring-offset-2',
        data.isInitial && 'border-primary-600',
        data.isDummy && 'border-dashed border-gray-400 bg-gray-50',
        !data.isInitial && !data.isDummy && 'border-gray-300'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="h-3 w-3 !bg-primary-500"
      />

      <div className="font-medium text-gray-900">{data.label}</div>

      {data.output && (
        <div className="mt-1 text-xs text-gray-500">
          Output: {data.output}
        </div>
      )}

      {data.isDummy && (
        <div className="mt-1 text-xs italic text-gray-400">
          (Dummy)
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="h-3 w-3 !bg-primary-500"
      />
    </div>
  );
});

FSMNode.displayName = 'FSMNode';
```

### Custom FSM Edge

```typescript
// src/components/fsm/FSMEditor/FSMEdge.tsx
import { memo } from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge
} from 'reactflow';

export const FSMEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  selected
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#3b82f6' : '#6b7280',
          strokeWidth: selected ? 2 : 1.5
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all'
          }}
          className="rounded bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm border border-gray-200"
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

FSMEdge.displayName = 'FSMEdge';
```

---

## Visualization Components

### Hypercube 3D Component

```typescript
// src/components/visualization/Hypercube3D/Hypercube3D.tsx
import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import * as THREE from 'three';

interface Hypercube3DProps {
  bitWidth: number;
  highlightedCodes?: string[];
  transitionPath?: string[];
}

function HypercubeGeometry({ bitWidth, highlightedCodes, transitionPath }: Hypercube3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Generate hypercube vertices for given bit width
  const vertices = useMemo(() => {
    const count = Math.pow(2, bitWidth);
    const positions: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const binary = i.toString(2).padStart(bitWidth, '0');

      // Map binary to 3D coordinates
      // For 3-bit: use x, y, z directly
      // For 4-bit: project to 3D
      const x = parseInt(binary[0]) * 2 - 1;
      const y = bitWidth > 1 ? parseInt(binary[1]) * 2 - 1 : 0;
      const z = bitWidth > 2 ? parseInt(binary[2]) * 2 - 1 : 0;

      positions.push(new THREE.Vector3(x, y, z));
    }

    return positions;
  }, [bitWidth]);

  // Generate edges (connect vertices that differ by 1 bit)
  const edges = useMemo(() => {
    const edgeList: [THREE.Vector3, THREE.Vector3][] = [];
    const count = Math.pow(2, bitWidth);

    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        // Check if Hamming distance is 1
        const xor = i ^ j;
        if ((xor & (xor - 1)) === 0) {
          // Power of 2, so Hamming distance = 1
          edgeList.push([vertices[i], vertices[j]]);
        }
      }
    }

    return edgeList;
  }, [vertices, bitWidth]);

  // Rotate hypercube
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Edges */}
      {edges.map((edge, i) => (
        <Line
          key={i}
          points={edge}
          color="#94a3b8"
          lineWidth={1}
        />
      ))}

      {/* Vertices */}
      {vertices.map((vertex, i) => {
        const grayCode = intToGray(i, bitWidth);
        const isHighlighted = highlightedCodes?.includes(grayCode);
        const isInPath = transitionPath?.includes(grayCode);

        return (
          <group key={i} position={vertex}>
            <mesh>
              <sphereGeometry args={[isHighlighted || isInPath ? 0.15 : 0.1, 16, 16]} />
              <meshStandardMaterial
                color={isInPath ? '#ef4444' : isHighlighted ? '#3b82f6' : '#64748b'}
                emissive={isHighlighted || isInPath ? '#ffffff' : '#000000'}
                emissiveIntensity={isHighlighted || isInPath ? 0.3 : 0}
              />
            </mesh>
            <Text
              position={[0, 0.3, 0]}
              fontSize={0.2}
              color="#1f2937"
            >
              {grayCode}
            </Text>
          </group>
        );
      })}

      {/* Transition path visualization */}
      {transitionPath && transitionPath.length > 1 && (
        <Line
          points={transitionPath.map(code => {
            const index = grayToInt(code);
            return vertices[index];
          })}
          color="#ef4444"
          lineWidth={3}
        />
      )}
    </group>
  );
}

export function Hypercube3D(props: Hypercube3DProps) {
  return (
    <div className="h-full w-full">
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <HypercubeGeometry {...props} />
        <OrbitControls />
      </Canvas>
    </div>
  );
}

// Utility functions
function intToGray(n: number, bitWidth: number): string {
  const gray = n ^ (n >> 1);
  return gray.toString(2).padStart(bitWidth, '0');
}

function grayToInt(gray: string): number {
  let n = parseInt(gray, 2);
  let mask = n;
  while (mask) {
    mask >>= 1;
    n ^= mask;
  }
  return n;
}
```

### Metrics Dashboard

```typescript
// src/components/visualization/MetricsDashboard/MetricsDashboard.tsx
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { AlgorithmResult } from '@/types/algorithm';

interface MetricsDashboardProps {
  originalFSM: any;
  optimizedFSM: any;
  results: AlgorithmResult;
}

export function MetricsDashboard({ originalFSM, optimizedFSM, results }: MetricsDashboardProps) {
  const comparisonData = [
    {
      name: 'States',
      original: originalFSM.state_count,
      optimized: optimizedFSM.state_count
    },
    {
      name: 'Transitions',
      original: originalFSM.transition_count,
      optimized: optimizedFSM.transition_count
    },
    {
      name: 'Avg Hamming',
      original: parseFloat(results.avg_hamming_before.toFixed(2)),
      optimized: parseFloat(results.avg_hamming_after.toFixed(2))
    }
  ];

  const improvementData = [
    { name: 'Improved', value: results.improvement_percentage },
    { name: 'Remaining', value: 100 - results.improvement_percentage }
  ];

  const COLORS = ['#10b981', '#e5e7eb'];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Summary Cards */}
      <Card className="p-6">
        <h3 className="text-sm font-medium text-gray-500">States Added</h3>
        <p className="mt-2 text-3xl font-bold text-gray-900">
          {results.dummy_states_added}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {((results.dummy_states_added / results.total_states_final) * 100).toFixed(1)}% of total
        </p>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-medium text-gray-500">Improvement</h3>
        <p className="mt-2 text-3xl font-bold text-green-600">
          {results.improvement_percentage.toFixed(1)}%
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Hamming distance reduction
        </p>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-medium text-gray-500">Execution Time</h3>
        <p className="mt-2 text-3xl font-bold text-gray-900">
          {results.execution_time_ms}ms
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Algorithm: {results.algorithm}
        </p>
      </Card>

      {/* Comparison Chart */}
      <Card className="p-6 md:col-span-2">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Before vs After</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="original" fill="#6b7280" name="Original" />
            <Bar dataKey="optimized" fill="#3b82f6" name="Optimized" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Improvement Pie Chart */}
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Improvement</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={improvementData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {improvementData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
```

---

*Due to length constraints, this is Part 1 of the frontend architecture document. The complete document continues with Design System, Accessibility, Performance Optimization, Error Handling, Testing Strategy, and more detailed component implementations.*

---

## Design System

### Color Palette

```typescript
// src/styles/theme/colors.ts
export const colors = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a'
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  },
  success: {
    50: '#f0fdf4',
    500: '#10b981',
    700: '#047857'
  },
  warning: {
    50: '#fffbeb',
    500: '#f59e0b',
    700: '#b45309'
  },
  error: {
    50: '#fef2f2',
    500: '#ef4444',
    700: '#b91c1c'
  },
  info: {
    50: '#eff6ff',
    500: '#3b82f6',
    700: '#1d4ed8'
  }
};
```

### Typography

```typescript
// src/styles/theme/typography.ts
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace']
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }]
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700'
  }
};
```

### Tailwind Configuration

```javascript
// tailwind.config.js
import { colors, typography } from './src/styles/theme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors,
      ...typography,
      spacing: {
        18: '4.5rem',
        112: '28rem',
        128: '32rem'
      },
      borderRadius: {
        '4xl': '2rem'
      },
      boxShadow: {
        'inner-lg': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.1)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio')
  ]
};
```

---

## Accessibility

### WCAG 2.1 AA Compliance Checklist

#### 1. Perceivable

- **Text Alternatives (1.1.1)**
  - [ ] All images have alt text
  - [ ] Decorative images use empty alt=""
  - [ ] Icons have aria-label or aria-labelledby

- **Color Contrast (1.4.3)**
  - [ ] Text contrast ratio ≥ 4.5:1
  - [ ] Large text contrast ratio ≥ 3:1
  - [ ] Use color contrast checker tools

- **Resize Text (1.4.4)**
  - [ ] Text can be resized to 200% without loss of content
  - [ ] Use relative units (rem, em) instead of px

#### 2. Operable

- **Keyboard Accessible (2.1.1)**
  - [ ] All interactive elements accessible via keyboard
  - [ ] No keyboard traps
  - [ ] Logical tab order

- **Focus Visible (2.4.7)**
  - [ ] Clear focus indicators on all interactive elements
  - [ ] Focus ring visible with high contrast

- **Skip Links (2.4.1)**
  - [ ] Skip to main content link
  - [ ] Skip navigation links

#### 3. Understandable

- **Page Titled (2.4.2)**
  - [ ] Unique, descriptive page titles
  - [ ] Title reflects page content

- **Labels and Instructions (3.3.2)**
  - [ ] Form inputs have labels
  - [ ] Error messages are clear and actionable
  - [ ] Required fields indicated

#### 4. Robust

- **Valid HTML (4.1.1)**
  - [ ] No duplicate IDs
  - [ ] Proper nesting of elements
  - [ ] Valid ARIA attributes

### Implementation Examples

```typescript
// src/components/ui/Button/Button.tsx (Accessible version)
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant,
    size,
    isLoading,
    leftIcon,
    rightIcon,
    children,
    disabled,
    'aria-label': ariaLabel,
    ...props
  }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        aria-label={ariaLabel}
        {...props}
      >
        {isLoading && (
          <span className="sr-only">Loading...</span>
        )}
        {/* Button content */}
      </button>
    );
  }
);

// src/components/fsm/FSMEditor/FSMEditor.tsx (Accessible version)
export function FSMEditor() {
  return (
    <div
      role="application"
      aria-label="FSM Editor"
      className="h-full w-full"
    >
      <div className="sr-only">
        <h2>Finite State Machine Editor</h2>
        <p>
          Use keyboard shortcuts: Press N to add a new state, E to add an edge,
          Delete to remove selected elements.
        </p>
      </div>

      <ReactFlow
        // ... props
        aria-label="FSM Canvas"
      >
        {/* Flow content */}
      </ReactFlow>
    </div>
  );
}

// Keyboard shortcuts
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Skip if user is typing in input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'n':
        setMode('add-state');
        announce('Mode: Add State');
        break;
      case 'e':
        setMode('add-transition');
        announce('Mode: Add Transition');
        break;
      case 'delete':
        deleteSelected();
        announce('Selected elements deleted');
        break;
      case 'escape':
        clearSelection();
        setMode('select');
        announce('Selection cleared');
        break;
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);

// Live region announcer
function announce(message: string) {
  const announcer = document.getElementById('aria-live-announcer');
  if (announcer) {
    announcer.textContent = message;
  }
}
```

### Screen Reader Support

```typescript
// src/components/layout/AriaLiveRegion.tsx
export function AriaLiveRegion() {
  return (
    <>
      <div
        id="aria-live-announcer"
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      />
      <div
        id="aria-live-assertive"
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      />
    </>
  );
}

// CSS for screen reader only content
// src/styles/globals.css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## Performance Optimization

### Code Splitting

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Lazy load pages
const EditorPage = lazy(() => import('@/pages/Editor'));
const OptimizePage = lazy(() => import('@/pages/Optimize'));
const GalleryPage = lazy(() => import('@/pages/Gallery'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        {/* Routes */}
      </Routes>
    </Suspense>
  );
}
```

### Memoization

```typescript
// src/components/visualization/FSMGraph.tsx
import { memo, useMemo } from 'react';

export const FSMGraph = memo(({ fsm }) => {
  const nodes = useMemo(() => {
    return fsm.states.map(transformState);
  }, [fsm.states]);

  const edges = useMemo(() => {
    return fsm.transitions.map(transformTransition);
  }, [fsm.transitions]);

  return <ReactFlow nodes={nodes} edges={edges} />;
});
```

### Virtual Scrolling

```typescript
// src/components/gallery/FSMGrid.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export function FSMGrid({ items }: { items: FSM[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 300,
    overscan: 5
  });

  return (
    <div ref={parentRef} className="h-screen overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            <FSMCard fsm={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Image Optimization

```typescript
// Use next/image-like component or native loading="lazy"
export function OptimizedImage({ src, alt, ...props }: ImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
}
```

### Bundle Analysis

```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'react-flow': ['reactflow'],
          'three': ['three', '@react-three/fiber', '@react-three/drei'],
          'charts': ['recharts'],
          'forms': ['react-hook-form', 'zod']
        }
      }
    }
  }
});
```

---

## Error Handling

### Error Boundary

```typescript
// src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);

    // Send to error tracking service (e.g., Sentry)
    if (import.meta.env.PROD) {
      // Sentry.captureException(error, { extra: errorInfo });
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
          <div className="max-w-md rounded-lg bg-white p-8 shadow-lg">
            <h1 className="mb-4 text-2xl font-bold text-red-600">
              Something went wrong
            </h1>
            <p className="mb-4 text-gray-600">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### API Error Handling

```typescript
// src/utils/errors.ts
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function handleAPIError(error: any): APIError {
  if (error.response) {
    const { status, data } = error.response;
    return new APIError(
      status,
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.message || 'An error occurred',
      data.error?.details
    );
  }

  if (error.request) {
    return new APIError(
      0,
      'NETWORK_ERROR',
      'Network error - please check your connection',
      error.message
    );
  }

  return new APIError(
    0,
    'UNKNOWN_ERROR',
    error.message || 'An unknown error occurred'
  );
}
```

### Form Validation with Zod

```typescript
// src/utils/validation/fsm-schema.ts
import { z } from 'zod';

export const stateSchema = z.object({
  id: z.string().min(1, 'State ID is required'),
  name: z.string().min(1, 'State name is required'),
  output: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number()
  }).optional()
});

export const transitionSchema = z.object({
  id: z.string().optional(),
  from_state: z.string().min(1, 'Source state is required'),
  to_state: z.string().min(1, 'Target state is required'),
  input: z.string().optional(),
  output: z.string().optional(),
  label: z.string().optional()
});

export const fsmCreateSchema = z.object({
  name: z.string().min(1, 'FSM name is required').max(255),
  description: z.string().optional(),
  fsm_type: z.enum(['moore', 'mealy']),
  states: z.array(z.string()).min(1, 'At least one state is required'),
  initial_state: z.string().min(1, 'Initial state is required'),
  transitions: z.array(transitionSchema),
  outputs: z.record(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['private', 'public', 'unlisted']).default('private')
});

export type FSMCreateInput = z.infer<typeof fsmCreateSchema>;

// Usage in form
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export function FSMCreateForm() {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FSMCreateInput>({
    resolver: zodResolver(fsmCreateSchema)
  });

  const onSubmit = (data: FSMCreateInput) => {
    // Data is type-safe and validated
    createFSM(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        label="FSM Name"
        {...register('name')}
        error={errors.name?.message}
      />
      {/* More fields */}
    </form>
  );
}
```

---

*This is a comprehensive frontend architecture document. Due to length, I'm creating this as a multi-part document. Let me continue with the remaining sections...*
