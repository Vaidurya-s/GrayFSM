# Frontend Implementation Guide

This guide provides step-by-step instructions for implementing the complete GrayFSM frontend application.

## Implementation Checklist

### Phase 1: Foundation (Week 1-2)

#### 1.1 Project Setup ✓
- [x] Initialize Vite + React + TypeScript
- [x] Configure Tailwind CSS
- [x] Set up ESLint and Prettier
- [x] Create directory structure
- [x] Set up Git and .gitignore

#### 1.2 Core Infrastructure
- [x] TypeScript type definitions (FSM, API)
- [x] API client with Axios
- [x] API endpoint modules
- [x] Configuration files (routes, constants)
- [x] Utility functions (Gray code, hypercube)

#### 1.3 State Management
- [ ] **TODO**: Zustand stores
  - FSM Store (src/store/fsmStore.ts)
  - Editor Store (src/store/editorStore.ts)
  - UI Store (src/store/uiStore.ts)

#### 1.4 Data Fetching
- [ ] **TODO**: React Query setup (src/main.tsx)
- [ ] **TODO**: Custom hooks
  - useFSMs (src/hooks/useAPI/useFSMs.ts)
  - useOptimization (src/hooks/useAPI/useOptimization.ts)
  - useExport (src/hooks/useAPI/useExport.ts)
  - useExamples (src/hooks/useAPI/useExamples.ts)

### Phase 2: Design System (Week 2-3)

#### 2.1 Base Components
- [ ] **TODO**: Button (src/components/ui/Button/)
  - Button.tsx
  - Button.stories.tsx
  - Button.test.tsx

- [ ] **TODO**: Input (src/components/ui/Input/)
- [ ] **TODO**: Select (src/components/ui/Select/)
- [ ] **TODO**: Checkbox (src/components/ui/Checkbox/)
- [ ] **TODO**: Card (src/components/ui/Card/)
- [ ] **TODO**: Badge (src/components/ui/Badge/)
- [ ] **TODO**: Spinner (src/components/ui/Spinner/)

#### 2.2 Complex Components
- [ ] **TODO**: Modal (src/components/ui/Modal/)
- [ ] **TODO**: Toast (src/components/ui/Toast/)
- [ ] **TODO**: Tabs (src/components/ui/Tabs/)
- [ ] **TODO**: Dropdown (src/components/ui/Dropdown/)

### Phase 3: Layout & Navigation (Week 3-4)

#### 3.1 Layout Components
- [ ] **TODO**: Header (src/components/layout/Header/)
- [ ] **TODO**: Sidebar (src/components/layout/Sidebar/)
- [ ] **TODO**: Footer (src/components/layout/Footer/)
- [ ] **TODO**: MainLayout (src/layouts/MainLayout.tsx)
- [ ] **TODO**: EditorLayout (src/layouts/EditorLayout.tsx)

#### 3.2 Routing
- [ ] **TODO**: App.tsx with React Router
- [ ] **TODO**: Route configuration
- [ ] **TODO**: 404 page

### Phase 4: FSM Features (Week 4-6)

#### 4.1 FSM Editor
- [ ] **TODO**: FSMEditor component (src/components/fsm/FSMEditor/)
  - React Flow setup
  - Custom FSMNode component
  - Custom FSMEdge component
  - Toolbar
  - Properties panel

#### 4.2 Visualization
- [ ] **TODO**: FSMGraphViewer (src/components/visualization/FSMGraphViewer/)
- [ ] **TODO**: ComparisonView (src/components/visualization/ComparisonView/)
- [ ] **TODO**: HypercubeView2D (src/components/visualization/HypercubeView2D/)
- [ ] **TODO**: Hypercube3D with Three.js (src/components/visualization/Hypercube3D/)
- [ ] **TODO**: MetricsDashboard (src/components/visualization/MetricsDashboard/)

#### 4.3 Forms
- [ ] **TODO**: FSMCreateForm (src/components/forms/FSMCreateForm/)
- [ ] **TODO**: ImportForm (src/components/forms/ImportForm/)
- [ ] **TODO**: ExportForm (src/components/forms/ExportForm/)

### Phase 5: Pages (Week 6-7)

#### 5.1 Main Pages
- [ ] **TODO**: HomePage (src/pages/Home/)
  - Hero section
  - Feature grid
  - Example gallery
  - CTA section

- [ ] **TODO**: EditorPage (src/pages/Editor/)
  - FSM editor integration
  - Save/load functionality

- [ ] **TODO**: OptimizePage (src/pages/Optimize/)
  - Algorithm selection
  - Optimization controls
  - Results display

- [ ] **TODO**: GalleryPage (src/pages/Gallery/)
  - FSM grid with pagination
  - Filtering and search

- [ ] **TODO**: ExamplesPage (src/pages/Examples/)
  - Example list
  - Category navigation

### Phase 6: Integration & Polish (Week 7-8)

#### 6.1 API Integration
- [ ] **TODO**: Connect all components to API
- [ ] **TODO**: Error handling
- [ ] **TODO**: Loading states
- [ ] **TODO**: WebSocket for real-time updates

#### 6.2 Accessibility
- [ ] **TODO**: ARIA labels
- [ ] **TODO**: Keyboard navigation
- [ ] **TODO**: Focus management
- [ ] **TODO**: Screen reader testing

#### 6.3 Testing
- [ ] **TODO**: Unit tests for utilities
- [ ] **TODO**: Component tests
- [ ] **TODO**: Integration tests
- [ ] **TODO**: E2E tests (optional)

#### 6.4 Documentation
- [ ] **TODO**: Component documentation
- [ ] **TODO**: User guide
- [ ] **TODO**: Developer documentation

## Quick Start Implementation

### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

### Step 2: Create Zustand Stores

Copy the store implementations from `FRONTEND-ARCHITECTURE.md` into:
- `src/store/fsmStore.ts`
- `src/store/editorStore.ts`
- `src/store/uiStore.ts`

### Step 3: Create React Query Hooks

Implement the hooks in `src/hooks/useAPI/`:
- `useFSMs.ts`
- `useOptimization.ts`
- `useExport.ts`
- `useExamples.ts`

### Step 4: Build Design System

Start with the button component, then expand to other UI components.

### Step 5: Create Main App Structure

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
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

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { HomePage } from './pages/Home';
import { EditorPage } from './pages/Editor';
import { OptimizePage } from './pages/Optimize';
import { NotFoundPage } from './pages/NotFound';
import { ROUTES } from './config/routes';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path={ROUTES.HOME} element={<HomePage />} />
          <Route path={ROUTES.EDITOR_NEW} element={<EditorPage />} />
          <Route path={ROUTES.EDITOR_EDIT} element={<EditorPage />} />
          <Route path={ROUTES.OPTIMIZE} element={<OptimizePage />} />
          <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### Step 6: Build Component by Component

Work through the checklist above, implementing one component at a time.

## Development Workflow

### 1. Component Development
```bash
# Start dev server
npm run dev
```

### 2. Write Tests
```bash
# Run tests in watch mode
npm test
```

### 3. Type Checking
```bash
# Check types
npx tsc --noEmit
```

### 4. Linting
```bash
# Lint and fix
npm run lint
npm run format
```

## Component Template

Use this template for new components:

```tsx
// src/components/ui/MyComponent/MyComponent.tsx
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface MyComponentProps {
  className?: string;
  // Add props
}

export const MyComponent = forwardRef<HTMLDivElement, MyComponentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('base-classes', className)} {...props}>
        {/* Content */}
      </div>
    );
  }
);

MyComponent.displayName = 'MyComponent';
```

```tsx
// src/components/ui/MyComponent/MyComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    // Add assertions
  });
});
```

```ts
// src/components/ui/MyComponent/index.ts
export { MyComponent } from './MyComponent';
export type { MyComponentProps } from './MyComponent';
```

## Priority Order

Implement in this order for fastest path to working application:

1. **Immediate** (Days 1-3):
   - Zustand stores
   - React Query setup
   - Button, Input, Card components
   - Main layout
   - Home page skeleton

2. **High Priority** (Week 1):
   - FSM types and utilities
   - FSM store with CRUD operations
   - Basic FSM editor with React Flow
   - Form components

3. **Medium Priority** (Week 2-3):
   - All visualization components
   - API integration
   - Optimize page
   - Export functionality

4. **Lower Priority** (Week 4+):
   - Examples and gallery
   - 3D hypercube
   - Advanced features
   - Polish and testing

## Common Patterns

### Error Handling
```tsx
const { data, error, isLoading } = useFSM(id);

if (error) return <ErrorState error={error} />;
if (isLoading) return <LoadingSpinner />;
if (!data) return <NotFound />;

return <YourComponent data={data} />;
```

### Form Handling
```tsx
const form = useForm({
  resolver: zodResolver(schema),
  defaultValues,
});

const mutation = useCreateFSM();

const onSubmit = async (data) => {
  await mutation.mutateAsync(data);
};

return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>;
```

### State Management
```tsx
// Use Zustand for local state
const { currentFSM, setCurrentFSM } = useFSMStore();

// Use React Query for server state
const { data: fsms } = useFSMs();
```

## Resources

- React Flow Docs: https://reactflow.dev/
- Tailwind CSS: https://tailwindcss.com/
- React Hook Form: https://react-hook-form.com/
- Zod: https://zod.dev/
- TanStack Query: https://tanstack.com/query/latest
- Zustand: https://github.com/pmndrs/zustand

## Troubleshooting

### Common Issues

**Issue**: Type errors with React Flow
**Solution**: Ensure `@types/react` and `@types/react-dom` versions match React version

**Issue**: Tailwind classes not applying
**Solution**: Check `tailwind.config.js` content paths

**Issue**: API calls failing
**Solution**: Check `.env.local` and CORS settings on backend

**Issue**: Build errors
**Solution**: Clear `node_modules` and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

After implementation:
1. Performance optimization
2. Accessibility audit
3. Browser testing
4. User feedback integration
5. Deployment setup
