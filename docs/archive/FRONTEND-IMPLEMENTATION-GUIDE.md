# GrayFSM Frontend - Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the GrayFSM frontend, from project setup to deployment.

---

## Table of Contents

1. [Project Setup](#project-setup)
2. [Development Workflow](#development-workflow)
3. [Implementation Phases](#implementation-phases)
4. [Testing Strategy](#testing-strategy)
5. [Deployment](#deployment)
6. [Best Practices](#best-practices)

---

## Project Setup

### Prerequisites

```bash
# Required software
node >= 18.0.0
npm >= 9.0.0
git >= 2.30.0

# Recommended VS Code extensions
- ES7+ React/Redux/React-Native snippets
- Tailwind CSS IntelliSense
- ESLint
- Prettier
- TypeScript Vue Plugin (Volar)
```

### Step 1: Initialize Project

```bash
# Create Vite project
npm create vite@latest frontend -- --template react-ts

cd frontend

# Install dependencies
npm install

# Install core dependencies
npm install react-router-dom@6 \
  @tanstack/react-query@5 \
  zustand@4 \
  axios@1

# Install React Flow
npm install reactflow@11

# Install Three.js
npm install three@0.160 \
  @react-three/fiber@8 \
  @react-three/drei@9

# Install form libraries
npm install react-hook-form@7 \
  @hookform/resolvers@3 \
  zod@3

# Install UI libraries
npm install tailwindcss@3 \
  postcss@8 \
  autoprefixer@10 \
  class-variance-authority@0.7 \
  clsx@2 \
  tailwind-merge@2 \
  framer-motion@11 \
  recharts@2

# Install Tailwind plugins
npm install @tailwindcss/forms \
  @tailwindcss/typography \
  @tailwindcss/aspect-ratio

# Install dev dependencies
npm install -D @types/node \
  @types/three \
  vitest@1 \
  @testing-library/react@14 \
  @testing-library/jest-dom@6 \
  @testing-library/user-event@14 \
  jsdom@24 \
  @storybook/react-vite@8 \
  @storybook/addon-essentials@8 \
  @storybook/addon-interactions@8 \
  @storybook/addon-a11y@8
```

### Step 2: Configure Tailwind CSS

```bash
# Initialize Tailwind
npx tailwindcss init -p
```

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
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
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
  ],
}
```

```css
/* src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900 antialiased;
  }
}

@layer utilities {
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
}
```

### Step 3: Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Path aliases */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### Step 4: Configure Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

### Step 5: Environment Variables

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000

# .env.production
VITE_API_BASE_URL=https://api.grayfsm.com/api/v1
VITE_WS_URL=wss://api.grayfsm.com
```

### Step 6: Project Structure

```bash
# Create directory structure
mkdir -p src/{api,components,pages,layouts,hooks,store,utils,types,styles,config}
mkdir -p src/components/{ui,fsm,visualization,forms,layout}
mkdir -p src/api/endpoints
mkdir -p src/utils/{fsm,gray-code,format}
mkdir -p tests/{unit,integration,e2e}
```

---

## Development Workflow

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/fsm-editor

# Make changes...

# Commit with conventional commits
git commit -m "feat(editor): add FSM node creation"
git commit -m "fix(api): handle network errors gracefully"
git commit -m "docs(readme): update setup instructions"

# Push and create PR
git push origin feature/fsm-editor
```

### Daily Development Routine

```bash
# 1. Start backend (in separate terminal)
cd ../backend
python -m uvicorn app.main:app --reload

# 2. Start frontend dev server
npm run dev

# 3. Start Storybook (optional)
npm run storybook

# 4. Run tests in watch mode
npm run test:watch
```

### Code Quality Checks

```bash
# Run all checks before committing
npm run lint        # ESLint
npm run type-check  # TypeScript
npm run format      # Prettier
npm run test        # Vitest
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

#### Week 1: Core Setup

**Day 1-2: Project Infrastructure**
- [ ] Initialize Vite project
- [ ] Configure Tailwind CSS
- [ ] Set up TypeScript paths
- [ ] Configure ESLint and Prettier
- [ ] Set up Git hooks with Husky

```bash
# Install Husky for pre-commit hooks
npm install -D husky lint-staged

# Initialize Husky
npx husky-init

# Add pre-commit hook
echo "npx lint-staged" > .husky/pre-commit
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**Day 3-4: Base Components**
- [ ] Implement Button component
- [ ] Implement Input component
- [ ] Implement Card component
- [ ] Implement Modal component
- [ ] Write Storybook stories for each

**Example: Button Component Implementation**

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
        primary: 'bg-primary-600 text-white hover:bg-primary-700',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        outline: 'border border-gray-300 hover:bg-gray-100',
        ghost: 'hover:bg-gray-100',
        danger: 'bg-red-600 text-white hover:bg-red-700'
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
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="mr-2 h-4 w-4 animate-spin" /* ... */ />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

```typescript
// src/components/ui/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger']
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'icon']
    }
  }
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Button'
  }
};

export const Loading: Story = {
  args: {
    isLoading: true,
    children: 'Loading...'
  }
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  )
};
```

**Day 5: Routing & Layouts**
- [ ] Set up React Router
- [ ] Create MainLayout
- [ ] Create EditorLayout
- [ ] Implement basic navigation

#### Week 2: State Management & API

**Day 1-2: API Client**
- [ ] Configure Axios client
- [ ] Create API endpoint modules
- [ ] Set up React Query
- [ ] Implement error handling

**Day 3-4: Zustand Stores**
- [ ] FSM store
- [ ] Editor store
- [ ] UI store
- [ ] Add dev tools

**Day 5: Integration**
- [ ] Connect stores to components
- [ ] Test API integration
- [ ] Add loading states

### Phase 2: FSM Editor (Week 3-4)

#### Week 3: React Flow Integration

**Day 1-2: Basic Canvas**
```typescript
// src/components/fsm/FSMEditor/FSMEditor.tsx
export function FSMEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}
```

**Day 3-4: Custom Nodes & Edges**
- [ ] Implement FSMNode component
- [ ] Implement FSMEdge component
- [ ] Add node creation
- [ ] Add edge creation

**Day 5: Properties Panel**
- [ ] State properties editor
- [ ] Transition properties editor
- [ ] Validation

#### Week 4: Editor Features

**Day 1-2: Toolbar & Tools**
- [ ] Mode selector (select/add-state/add-transition)
- [ ] Undo/redo
- [ ] Copy/paste
- [ ] Delete

**Day 3-4: Advanced Features**
- [ ] Grid snapping
- [ ] Auto-layout
- [ ] Minimap
- [ ] Keyboard shortcuts

**Day 5: Save/Load**
- [ ] Save FSM to backend
- [ ] Load FSM from backend
- [ ] Auto-save
- [ ] Version history

### Phase 3: Optimization UI (Week 5-6)

#### Week 5: Optimization Interface

**Day 1-2: Algorithm Selection**
```typescript
// src/components/algorithm/AlgorithmSelector.tsx
export function AlgorithmSelector({ value, onChange }: Props) {
  const algorithms = [
    {
      id: 'greedy',
      name: 'Greedy',
      description: 'Fast, good results',
      icon: <ZapIcon />
    },
    {
      id: 'bfs_optimal',
      name: 'BFS Optimal',
      description: 'Guaranteed optimal per transition',
      icon: <TargetIcon />
    },
    {
      id: 'global_sa',
      name: 'Global (SA)',
      description: 'Best overall optimization',
      icon: <SparklesIcon />
    }
  ];

  return (
    <div className="space-y-2">
      {algorithms.map((algo) => (
        <button
          key={algo.id}
          onClick={() => onChange(algo.id)}
          className={cn(
            'w-full rounded-lg border-2 p-4 text-left transition',
            value === algo.id
              ? 'border-primary-600 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          )}
        >
          <div className="flex items-start gap-3">
            <div className="text-primary-600">{algo.icon}</div>
            <div>
              <div className="font-medium">{algo.name}</div>
              <div className="text-sm text-gray-500">{algo.description}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
```

**Day 3-4: Results Display**
- [ ] Comparison view
- [ ] Metrics dashboard
- [ ] Highlight changes

**Day 5: Export**
- [ ] Export form
- [ ] Verilog generation
- [ ] Download functionality

#### Week 6: Visualizations

**Day 1-3: Hypercube 2D**
- [ ] SVG-based hypercube
- [ ] State highlighting
- [ ] Transition paths

**Day 4-5: Hypercube 3D**
- [ ] Three.js scene setup
- [ ] Camera controls
- [ ] Animation

### Phase 4: Polish & Features (Week 7-8)

#### Week 7: User Experience

**Day 1-2: Animations**
```typescript
// src/components/visualization/TransformationAnimation.tsx
import { motion, AnimatePresence } from 'framer-motion';

export function TransformationAnimation({ steps }: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <StepVisualization step={steps[currentStep]} />
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <Button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          Previous
        </Button>

        <span className="text-sm text-gray-500">
          Step {currentStep + 1} of {steps.length}
        </span>

        <Button
          onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
          disabled={currentStep === steps.length - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
```

**Day 3-4: Loading States**
- [ ] Skeleton screens
- [ ] Progress indicators
- [ ] Optimistic updates

**Day 5: Responsive Design**
- [ ] Mobile layouts
- [ ] Tablet optimizations
- [ ] Touch interactions

#### Week 8: Examples & Documentation

**Day 1-2: Example Library**
- [ ] Create example FSMs
- [ ] Category organization
- [ ] Search & filter

**Day 3-4: Interactive Tutorials**
- [ ] Tutorial framework
- [ ] Step-by-step guides
- [ ] Interactive demos

**Day 5: Final Testing**
- [ ] E2E tests
- [ ] Accessibility audit
- [ ] Performance profiling

---

## Testing Strategy

### Unit Tests (Vitest)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```typescript
// tests/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

**Example Test Suite**:

```typescript
// src/hooks/useAPI/useFSMs.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFSMs } from './useFSMs';
import { fsmAPI } from '@/api/endpoints/fsms';

// Mock API
vi.mock('@/api/endpoints/fsms');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useFSMs', () => {
  it('fetches FSMs successfully', async () => {
    const mockData = {
      success: true,
      data: [
        { id: '1', name: 'Test FSM' }
      ],
      pagination: {
        page: 1,
        page_size: 20,
        total_items: 1,
        total_pages: 1,
        has_next: false,
        has_prev: false
      }
    };

    vi.mocked(fsmAPI.list).mockResolvedValue(mockData);

    const { result } = renderHook(() => useFSMs(), {
      wrapper: createWrapper()
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
  });

  it('handles errors', async () => {
    vi.mocked(fsmAPI.list).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFSMs(), {
      wrapper: createWrapper()
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
```

### Integration Tests

```typescript
// tests/integration/fsm-creation.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@/App';
import { server } from '@/tests/mocks/server';
import { rest } from 'msw';

describe('FSM Creation Flow', () => {
  it('allows user to create and save an FSM', async () => {
    const user = userEvent.setup();

    render(<App />);

    // Navigate to editor
    await user.click(screen.getByRole('link', { name: /new fsm/i }));

    // Add states
    await user.click(screen.getByRole('button', { name: /add state/i }));
    await user.click(screen.getByTestId('canvas'));

    // State appears
    await waitFor(() => {
      expect(screen.getByText('S0')).toBeInTheDocument();
    });

    // Add transition
    await user.click(screen.getByRole('button', { name: /add transition/i }));
    // ... simulate edge creation

    // Save FSM
    await user.click(screen.getByRole('button', { name: /save/i }));

    // Success message
    await waitFor(() => {
      expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
    });
  });
});
```

### E2E Tests (Playwright)

```bash
# Install Playwright
npm install -D @playwright/test

# Initialize Playwright
npx playwright install
```

```typescript
// tests/e2e/optimization.spec.ts
import { test, expect } from '@playwright/test';

test('optimize FSM end-to-end', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:3000');

  // Create FSM
  await page.click('text=New FSM');
  await page.fill('input[name="name"]', 'Test FSM');
  await page.selectOption('select[name="fsm_type"]', 'moore');
  await page.click('button:has-text("Create")');

  // Add states in editor
  await page.click('button:has-text("Add State")');
  await page.click('[data-testid="canvas"]', { position: { x: 100, y: 100 } });
  await page.click('[data-testid="canvas"]', { position: { x: 300, y: 100 } });

  // Save FSM
  await page.click('button:has-text("Save")');
  await expect(page.locator('text=Saved successfully')).toBeVisible();

  // Navigate to optimization
  await page.click('button:has-text("Optimize")');

  // Select algorithm
  await page.click('text=Greedy');

  // Run optimization
  await page.click('button:has-text("Optimize")');

  // Wait for results
  await expect(page.locator('text=Optimization complete')).toBeVisible({
    timeout: 10000
  });

  // Verify metrics
  const metricsCard = page.locator('[data-testid="metrics-dashboard"]');
  await expect(metricsCard).toContainText('States Added');
});
```

---

## Deployment

### Build for Production

```bash
# Build frontend
npm run build

# Preview build
npm run preview

# Analyze bundle
npm run build -- --mode analyze
```

### Deployment Options

#### Option 1: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Production deployment
vercel --prod
```

```json
// vercel.json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://api.grayfsm.com/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### Option 2: Netlify

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "https://api.grayfsm.com/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Option 3: Docker

```dockerfile
# Dockerfile
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```nginx
# nginx.conf
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api {
    proxy_pass http://api:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  gzip on;
  gzip_types text/css application/javascript application/json;
  gzip_min_length 1000;
}
```

---

## Best Practices

### Code Organization

1. **One component per file**
2. **Colocate related files** (component + styles + tests + stories)
3. **Use barrel exports** for cleaner imports
4. **Separate business logic** from UI components

### Performance

1. **Lazy load routes** with React.lazy
2. **Memoize expensive computations** with useMemo
3. **Use React.memo** for expensive components
4. **Virtualize long lists** with @tanstack/react-virtual
5. **Code splitting** by route and feature

### Accessibility

1. **Use semantic HTML**
2. **Provide ARIA labels** for interactive elements
3. **Ensure keyboard navigation**
4. **Maintain focus management**
5. **Test with screen readers**

### Type Safety

1. **Define explicit types** for all props
2. **Use discriminated unions** for variant props
3. **Validate API responses** with Zod
4. **Avoid 'any'** types

### Git Commits

Follow Conventional Commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

---

This implementation guide provides a complete roadmap for building the GrayFSM frontend from scratch to production deployment.
