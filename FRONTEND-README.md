# GrayFSM Frontend - Complete Documentation

## Executive Summary

The GrayFSM frontend is a modern, accessible, and performant React application for creating, visualizing, and optimizing finite state machines using Gray code encoding. Built with React 18, TypeScript, and cutting-edge tools, it provides an intuitive interface for both educational and professional use cases.

---

## Quick Links

- [Architecture Document](./FRONTEND-ARCHITECTURE.md) - Complete architectural overview
- [Component Specifications](./FRONTEND-COMPONENTS.md) - Detailed component docs
- [Implementation Guide](./FRONTEND-IMPLEMENTATION-GUIDE.md) - Step-by-step build instructions
- [API Documentation](./openapi-spec.yaml) - Backend API contracts

---

## Technology Stack

### Core Framework
- **React 18.2+** - UI framework with concurrent features
- **TypeScript 5.0+** - Type-safe development
- **Vite 5.0+** - Lightning-fast build tool

### State Management
- **Zustand 4.0** - Lightweight state management
- **TanStack Query 5.0** - Server state management
- **React Context** - Theme and authentication

### Routing & Navigation
- **React Router 6** - Client-side routing
- **React Router DOM** - DOM bindings

### UI & Styling
- **Tailwind CSS 3** - Utility-first CSS
- **class-variance-authority** - Component variants
- **Framer Motion 11** - Animations
- **Headless UI** - Accessible components

### Visualization
- **React Flow 11** - FSM graph editor
- **Three.js + R3F** - 3D hypercube visualization
- **Recharts 2** - Charts and metrics
- **D3.js** (optional) - Advanced visualizations

### Forms & Validation
- **React Hook Form 7** - Form management
- **Zod 3** - Schema validation
- **@hookform/resolvers** - Integration

### Development Tools
- **Storybook 8** - Component documentation
- **Vitest** - Unit testing
- **Playwright** - E2E testing
- **ESLint + Prettier** - Code quality
- **Husky** - Git hooks

---

## Project Structure

```
frontend/
├── public/                      # Static assets
│   ├── examples/               # Example FSM files
│   └── tutorials/              # Tutorial content
│
├── src/
│   ├── api/                    # API layer
│   │   ├── client.ts          # Axios configuration
│   │   ├── endpoints/         # API endpoint modules
│   │   └── types/             # API type definitions
│   │
│   ├── components/            # React components
│   │   ├── ui/               # Base UI components
│   │   ├── fsm/              # FSM-specific components
│   │   ├── visualization/    # Charts and visualizations
│   │   ├── forms/            # Form components
│   │   └── layout/           # Layout components
│   │
│   ├── pages/                # Page components
│   │   ├── Home/
│   │   ├── Editor/
│   │   ├── Optimize/
│   │   ├── Gallery/
│   │   ├── Examples/
│   │   └── Learn/
│   │
│   ├── layouts/              # Layout wrappers
│   │   ├── MainLayout.tsx
│   │   └── EditorLayout.tsx
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── useAPI/          # API hooks
│   │   ├── useFSM/          # FSM logic hooks
│   │   └── useWebSocket/    # WebSocket hooks
│   │
│   ├── store/               # Zustand stores
│   │   ├── fsmStore.ts
│   │   ├── editorStore.ts
│   │   └── uiStore.ts
│   │
│   ├── utils/               # Utility functions
│   │   ├── fsm/            # FSM utilities
│   │   ├── gray-code/      # Gray code algorithms
│   │   └── format/         # Data formatting
│   │
│   ├── types/              # TypeScript types
│   │   ├── fsm.ts
│   │   ├── algorithm.ts
│   │   └── api.ts
│   │
│   ├── styles/             # Global styles
│   │   ├── globals.css
│   │   └── theme/
│   │
│   ├── config/             # Configuration
│   │   ├── constants.ts
│   │   ├── routes.ts
│   │   └── api.ts
│   │
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point
│
├── tests/                   # Test files
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── setup.ts
│
├── .storybook/             # Storybook config
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## Key Features

### 1. FSM Editor
- Drag-and-drop state creation
- Visual edge connections
- Properties panel for states/transitions
- Undo/redo support
- Auto-layout algorithms
- Grid snapping
- Keyboard shortcuts
- Import from JSON/CSV
- Export to multiple formats

### 2. Optimization Interface
- Multiple algorithm selection
- Real-time progress tracking
- Side-by-side comparison view
- Metrics dashboard
- Hypercube visualization (2D/3D)
- Transformation animation
- Export optimized FSM

### 3. Visualization
- Interactive FSM graphs
- 3D hypercube (Three.js)
- Transition path highlighting
- State encoding display
- Metrics charts
- Performance comparison

### 4. Educational Features
- Interactive tutorials
- Step-by-step guides
- Example library
- Animated explanations
- Concept visualizations

### 5. Accessibility
- WCAG 2.1 AA compliant
- Keyboard navigation
- Screen reader support
- High contrast mode
- Focus indicators
- ARIA labels

### 6. Performance
- Code splitting
- Lazy loading
- Virtual scrolling
- Memoization
- Optimistic updates
- Bundle optimization

---

## Getting Started

### Prerequisites

```bash
node >= 18.0.0
npm >= 9.0.0
```

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/grayfsm.git
cd grayfsm/frontend

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Start development server
npm run dev
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run dev:host         # Start with network access

# Build
npm run build            # Production build
npm run preview          # Preview production build

# Testing
npm run test             # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run test:e2e         # Run E2E tests

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format with Prettier
npm run type-check       # TypeScript type checking

# Storybook
npm run storybook        # Start Storybook (port 6006)
npm run build-storybook  # Build Storybook

# Other
npm run analyze          # Analyze bundle size
```

---

## Environment Variables

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
VITE_ENABLE_DEVTOOLS=true
VITE_SENTRY_DSN=
```

---

## Development Guidelines

### Component Structure

```typescript
// components/ui/Button/
// ├── Button.tsx          # Component implementation
// ├── Button.test.tsx     # Unit tests
// ├── Button.stories.tsx  # Storybook stories
// └── index.ts           # Barrel export

// Button.tsx
export interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', ... }: ButtonProps) {
  // Implementation
}

// index.ts
export { Button } from './Button';
export type { ButtonProps } from './Button';
```

### Naming Conventions

- **Components**: PascalCase (`Button`, `FSMEditor`)
- **Files**: Match component name (`Button.tsx`)
- **Hooks**: camelCase with 'use' prefix (`useFSMs`, `useOptimization`)
- **Utilities**: camelCase (`formatDate`, `validateFSM`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_BASE_URL`)
- **Types**: PascalCase (`FSMCreate`, `AlgorithmResult`)

### Code Style

```typescript
// Use functional components with TypeScript
export function MyComponent({ prop1, prop2 }: MyComponentProps) {
  // Hooks first
  const [state, setState] = useState<string>('');
  const query = useQuery(...);

  // Event handlers
  const handleClick = () => {
    // ...
  };

  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}

// Use explicit return types for complex functions
function processData(input: string): ProcessedData {
  // ...
  return result;
}

// Prefer const over let
const items = [1, 2, 3];

// Use optional chaining and nullish coalescing
const value = data?.nested?.property ?? 'default';
```

---

## Testing

### Unit Tests

```typescript
// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles clicks', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
// FSM creation flow
test('create and save FSM', async () => {
  render(<App />);

  // Navigate to editor
  await user.click(screen.getByText('New FSM'));

  // Create FSM
  await user.type(screen.getByLabelText('Name'), 'Test FSM');
  await user.click(screen.getByText('Create'));

  // Verify
  expect(await screen.findByText('FSM created')).toBeInTheDocument();
});
```

### E2E Tests

```typescript
// e2e/optimization.spec.ts
test('optimize FSM', async ({ page }) => {
  await page.goto('/');
  await page.click('text=New FSM');
  // ... create FSM
  await page.click('text=Optimize');
  await page.click('text=Greedy');
  await page.click('button:has-text("Run")');
  await expect(page.locator('text=Complete')).toBeVisible();
});
```

---

## API Integration

### React Query Setup

```typescript
// api/client.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
});

// hooks/useAPI/useFSMs.ts
import { useQuery, useMutation } from '@tanstack/react-query';

export function useFSMs() {
  return useQuery({
    queryKey: ['fsms'],
    queryFn: () => apiClient.get('/fsms'),
  });
}

export function useCreateFSM() {
  return useMutation({
    mutationFn: (data: FSMCreate) => apiClient.post('/fsms', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['fsms']);
    },
  });
}
```

---

## State Management

### Zustand Store Example

```typescript
// store/fsmStore.ts
import { create } from 'zustand';

interface FSMState {
  currentFSM: FSM | null;
  setCurrentFSM: (fsm: FSM) => void;
  // ... more state and actions
}

export const useFSMStore = create<FSMState>((set) => ({
  currentFSM: null,
  setCurrentFSM: (fsm) => set({ currentFSM: fsm }),
}));

// Usage in component
function MyComponent() {
  const { currentFSM, setCurrentFSM } = useFSMStore();

  return <div>{currentFSM?.name}</div>;
}
```

---

## Deployment

### Build for Production

```bash
# Create optimized build
npm run build

# Output in dist/
# ├── index.html
# ├── assets/
# │   ├── index-[hash].js
# │   └── index-[hash].css
# └── ...
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production
vercel --prod
```

### Deploy to Netlify

```bash
# Build command
npm run build

# Publish directory
dist

# Redirects (in netlify.toml)
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Docker Deployment

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Performance Optimization

### Code Splitting

```typescript
// Lazy load routes
const EditorPage = lazy(() => import('./pages/Editor'));
const OptimizePage = lazy(() => import('./pages/Optimize'));

// In router
<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/editor" element={<EditorPage />} />
    <Route path="/optimize/:id" element={<OptimizePage />} />
  </Routes>
</Suspense>
```

### Memoization

```typescript
// Expensive computation
const processedData = useMemo(() => {
  return heavyComputation(data);
}, [data]);

// Expensive component
const ExpensiveComponent = memo(({ data }) => {
  return <div>{/* render */}</div>;
});
```

### Virtual Scrolling

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function LargeList({ items }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      {/* Virtualized items */}
    </div>
  );
}
```

---

## Accessibility

### Keyboard Navigation

```typescript
// Implement keyboard shortcuts
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'n' && e.ctrlKey) {
      createNewFSM();
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

### ARIA Labels

```typescript
// Provide descriptive labels
<button
  aria-label="Delete state S0"
  onClick={() => deleteState('S0')}
>
  <TrashIcon />
</button>

// Use semantic HTML
<nav aria-label="Main navigation">
  <ul role="list">
    <li><a href="/editor">Editor</a></li>
  </ul>
</nav>
```

### Focus Management

```typescript
// Trap focus in modal
import { FocusTrap } from '@headlessui/react';

function Modal({ isOpen, onClose, children }) {
  return (
    <FocusTrap active={isOpen}>
      <div role="dialog" aria-modal="true">
        {children}
      </div>
    </FocusTrap>
  );
}
```

---

## Troubleshooting

### Common Issues

**Issue: Module not found**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Issue: Build errors**
```bash
# Clean build cache
rm -rf dist .vite
npm run build
```

**Issue: Type errors**
```bash
# Regenerate TypeScript cache
rm -rf node_modules/.cache
npm run type-check
```

**Issue: API connection failed**
```bash
# Check backend is running
curl http://localhost:8000/api/v1/health

# Verify environment variables
echo $VITE_API_BASE_URL
```

---

## Contributing

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes with tests
3. Run all checks: `npm run lint && npm run test && npm run type-check`
4. Create PR with description
5. Address review comments
6. Merge after approval

### Commit Convention

```
feat: add FSM export to CSV
fix: resolve state deletion bug
docs: update API integration guide
style: format code with Prettier
refactor: simplify optimization logic
test: add tests for FSM validator
chore: update dependencies
```

---

## Resources

### Documentation
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Query](https://tanstack.com/query/latest/docs/react)
- [React Flow](https://reactflow.dev)
- [Three.js](https://threejs.org/docs)

### Tools
- [Storybook](https://storybook.js.org)
- [Vitest](https://vitest.dev)
- [Playwright](https://playwright.dev)

### Community
- [GitHub Issues](https://github.com/yourusername/grayfsm/issues)
- [Discord Server](#)
- [Discussion Forum](#)

---

## License

MIT License - see [LICENSE](../LICENSE) for details

---

## Acknowledgments

- React Team for the amazing framework
- Vercel for Vite and SWR
- All open-source contributors

---

**Built with ❤️ for the hardware design and computer science community**
