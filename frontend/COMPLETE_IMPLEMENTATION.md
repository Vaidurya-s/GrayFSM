# Complete Frontend Implementation Code

This document contains all the critical code needed to complete the GrayFSM frontend implementation.

## Table of Contents
1. [Entry Points & App Structure](#entry-points--app-structure)
2. [Zustand Stores](#zustand-stores)
3. [React Query Hooks](#react-query-hooks)
4. [Design System Components](#design-system-components)
5. [Layout Components](#layout-components)
6. [FSM Components](#fsm-components)
7. [Page Components](#page-components)

---

## Entry Points & App Structure

### src/main.tsx
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

### src/App.tsx
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { EditorLayout } from './layouts/EditorLayout';
import { HomePage } from './pages/Home';
import { EditorPage } from './pages/Editor';
import { OptimizePage } from './pages/Optimize';
import { GalleryPage } from './pages/Gallery';
import { ExamplesPage } from './pages/Examples';
import { NotFoundPage } from './pages/NotFound';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/providers/ToastProvider';
import { ThemeProvider } from './components/providers/ThemeProvider';
import { ROUTES } from './config/routes';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<MainLayout />}>
                <Route path={ROUTES.HOME} element={<HomePage />} />
                <Route path={ROUTES.GALLERY} element={<GalleryPage />} />
                <Route path={ROUTES.EXAMPLES} element={<ExamplesPage />} />
              </Route>

              <Route element={<EditorLayout />}>
                <Route path={ROUTES.EDITOR_NEW} element={<EditorPage />} />
                <Route path={ROUTES.EDITOR_EDIT} element={<EditorPage />} />
                <Route path={ROUTES.OPTIMIZE} element={<OptimizePage />} />
              </Route>

              <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
```

---

## Zustand Stores

### src/store/fsmStore.ts
```tsx
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { FSM, State, Transition } from '@/types/fsm';

interface FSMState {
  currentFSM: FSM | null;
  history: FSM[];
  historyIndex: number;
  selectedStates: string[];
  selectedTransitions: string[];

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
          const { history, historyIndex } = get();
          const newHistory = history.slice(0, historyIndex + 1);
          if (fsm) newHistory.push(fsm);
          set({ history: newHistory, historyIndex: newHistory.length - 1 });
        },

        updateFSM: (updates) => {
          const { currentFSM } = get();
          if (!currentFSM) return;
          get().setCurrentFSM({ ...currentFSM, ...updates });
        },

        addState: (state) => {
          const { currentFSM } = get();
          if (!currentFSM) return;
          const updatedFSM = {
            ...currentFSM,
            states: [...currentFSM.states, state.name],
            definition: {
              ...currentFSM.definition,
              states: [...(currentFSM.definition.states || []), state],
            },
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
          get().updateFSM({ definition: { ...definition, states: updatedStates } });
        },

        deleteState: (stateId) => {
          const { currentFSM } = get();
          if (!currentFSM) return;
          const definition = currentFSM.definition;
          const updatedStates = definition.states?.filter((s: State) => s.id !== stateId);
          const updatedTransitions = definition.transitions?.filter(
            (t: Transition) => t.from_state !== stateId && t.to_state !== stateId
          );
          get().updateFSM({
            definition: { ...definition, states: updatedStates, transitions: updatedTransitions },
          });
        },

        addTransition: (transition) => {
          const { currentFSM } = get();
          if (!currentFSM) return;
          const definition = currentFSM.definition;
          get().updateFSM({
            definition: {
              ...definition,
              transitions: [...(definition.transitions || []), transition],
            },
          });
        },

        updateTransition: (transitionId, updates) => {
          const { currentFSM } = get();
          if (!currentFSM) return;
          const definition = currentFSM.definition;
          const updatedTransitions = definition.transitions?.map((t: Transition) =>
            t.id === transitionId ? { ...t, ...updates } : t
          );
          get().updateFSM({ definition: { ...definition, transitions: updatedTransitions } });
        },

        deleteTransition: (transitionId) => {
          const { currentFSM } = get();
          if (!currentFSM) return;
          const definition = currentFSM.definition;
          const updatedTransitions = definition.transitions?.filter(
            (t: Transition) => t.id !== transitionId
          );
          get().updateFSM({ definition: { ...definition, transitions: updatedTransitions } });
        },

        selectStates: (stateIds) => set({ selectedStates: stateIds }),
        selectTransitions: (transitionIds) => set({ selectedTransitions: transitionIds }),
        clearSelection: () => set({ selectedStates: [], selectedTransitions: [] }),

        undo: () => {
          const { history, historyIndex } = get();
          if (historyIndex > 0) {
            set({ currentFSM: history[historyIndex - 1], historyIndex: historyIndex - 1 });
          }
        },

        redo: () => {
          const { history, historyIndex } = get();
          if (historyIndex < history.length - 1) {
            set({ currentFSM: history[historyIndex + 1], historyIndex: historyIndex + 1 });
          }
        },

        canUndo: () => get().historyIndex > 0,
        canRedo: () => get().historyIndex < get().history.length - 1,

        reset: () =>
          set({
            currentFSM: null,
            history: [],
            historyIndex: -1,
            selectedStates: [],
            selectedTransitions: [],
          }),
      }),
      { name: 'fsm-store', partialize: (state) => ({ currentFSM: state.currentFSM }) }
    )
  )
);
```

### src/store/editorStore.ts
```tsx
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

type EditorMode = 'select' | 'add-state' | 'add-transition' | 'delete';
type ViewMode = 'graph' | 'split' | 'code';

interface EditorState {
  mode: EditorMode;
  viewMode: ViewMode;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  zoom: number;
  showPropertiesPanel: boolean;
  showSidebar: boolean;
  showMinimap: boolean;
  clipboard: any | null;

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
    reset: () =>
      set({
        mode: 'select',
        viewMode: 'graph',
        showGrid: true,
        snapToGrid: true,
        zoom: 1,
        clipboard: null,
      }),
  }))
);
```

### src/store/uiStore.ts
```tsx
import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface UIState {
  theme: 'light' | 'dark' | 'system';
  toasts: Toast[];
  activeModal: string | null;
  globalLoading: boolean;
  loadingMessage: string | null;

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
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  },

  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    const duration = toast.duration || 5000;
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },

  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
  setGlobalLoading: (loading, message) =>
    set({ globalLoading: loading, loadingMessage: message || null }),
}));
```

---

## React Query Hooks

### src/hooks/useAPI/useFSMs.ts
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fsmAPI } from '@/api';
import type { FSMCreate, FSMUpdate } from '@/types/fsm';
import { useUIStore } from '@/store/uiStore';

export const FSM_KEYS = {
  all: ['fsms'] as const,
  lists: () => [...FSM_KEYS.all, 'list'] as const,
  list: (params?: any) => [...FSM_KEYS.lists(), params] as const,
  details: () => [...FSM_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...FSM_KEYS.details(), id] as const,
};

export function useFSMs(params?: Parameters<typeof fsmAPI.list>[0]) {
  return useQuery({
    queryKey: FSM_KEYS.list(params),
    queryFn: () => fsmAPI.list(params),
  });
}

export function useFSM(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: FSM_KEYS.detail(id),
    queryFn: () => fsmAPI.get(id),
    enabled: options?.enabled ?? !!id,
  });
}

export function useCreateFSM() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  return useMutation({
    mutationFn: (data: FSMCreate) => fsmAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FSM_KEYS.lists() });
      addToast({ type: 'success', message: 'FSM created successfully' });
    },
    onError: (error: any) => {
      addToast({
        type: 'error',
        message: error.response?.data?.error?.message || 'Failed to create FSM',
      });
    },
  });
}

export function useUpdateFSM() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FSMUpdate }) => fsmAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: FSM_KEYS.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: FSM_KEYS.lists() });
      addToast({ type: 'success', message: 'FSM updated successfully' });
    },
    onError: (error: any) => {
      addToast({
        type: 'error',
        message: error.response?.data?.error?.message || 'Failed to update FSM',
      });
    },
  });
}

export function useDeleteFSM() {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();

  return useMutation({
    mutationFn: (id: string) => fsmAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FSM_KEYS.lists() });
      addToast({ type: 'success', message: 'FSM deleted successfully' });
    },
    onError: (error: any) => {
      addToast({
        type: 'error',
        message: error.response?.data?.error?.message || 'Failed to delete FSM',
      });
    },
  });
}
```

---

**Continue in next message due to length constraints...**

The implementation continues with:
- Design System Components (Button, Input, Card, Modal, etc.)
- Layout Components (Header, Sidebar, MainLayout)
- FSM Components (FSMEditor, FSMNode, FSMEdge)
- Visualization Components (FSMGraphViewer, ComparisonView, Hypercube)
- Form Components (FSMCreateForm, ImportForm, ExportForm)
- Page Components (HomePage, EditorPage, OptimizePage)

All component code is available in FRONTEND-ARCHITECTURE.md and FRONTEND-COMPONENTS.md.
For complete implementation, reference those documents and implement each component following the patterns shown above.
