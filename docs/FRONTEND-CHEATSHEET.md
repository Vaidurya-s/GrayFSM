# GrayFSM Frontend - Quick Reference Cheatsheet

## Project Commands

```bash
# Development
npm run dev                    # Start dev server (localhost:3000)
npm run dev:host              # Start with network access

# Build
npm run build                 # Production build
npm run preview               # Preview production build

# Testing
npm run test                  # Run unit tests
npm run test:watch            # Watch mode
npm run test:coverage         # Coverage report
npm run test:e2e              # E2E tests

# Code Quality
npm run lint                  # ESLint
npm run lint:fix              # Fix ESLint issues
npm run format                # Prettier
npm run type-check            # TypeScript checking

# Storybook
npm run storybook             # Start Storybook
npm run build-storybook       # Build Storybook

# Analysis
npm run analyze               # Bundle analysis
```

---

## File Structure

```
src/
├── api/                      # API layer
│   ├── client.ts            # Axios setup
│   └── endpoints/           # API modules
├── components/              # Components
│   ├── ui/                 # Base UI
│   ├── fsm/                # FSM-specific
│   ├── visualization/      # Charts/graphs
│   ├── forms/              # Forms
│   └── layout/             # Layouts
├── pages/                   # Pages
├── hooks/                   # Custom hooks
├── store/                   # Zustand stores
├── utils/                   # Utilities
├── types/                   # TypeScript types
└── styles/                  # Global styles
```

---

## Component Template

```typescript
// ComponentName.tsx
import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

interface ComponentNameProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  className?: string;
}

export const ComponentName = forwardRef<
  HTMLDivElement,
  ComponentNameProps
>(({ variant = 'primary', children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('base-styles', className)}
      {...props}
    >
      {children}
    </div>
  );
});

ComponentName.displayName = 'ComponentName';

// index.ts
export { ComponentName } from './ComponentName';
export type { ComponentNameProps } from './ComponentName';
```

---

## React Hooks Patterns

### useState
```typescript
const [state, setState] = useState<Type>(initialValue);
const [isOpen, setIsOpen] = useState(false);
const [data, setData] = useState<User | null>(null);
```

### useEffect
```typescript
useEffect(() => {
  // Side effect
  return () => {
    // Cleanup
  };
}, [dependencies]);
```

### useMemo
```typescript
const computedValue = useMemo(() => {
  return expensiveComputation(data);
}, [data]);
```

### useCallback
```typescript
const memoizedCallback = useCallback(
  (arg: string) => {
    doSomething(arg);
  },
  [dependency]
);
```

### Custom Hook
```typescript
function useCustomHook(param: string) {
  const [state, setState] = useState<Type>();

  useEffect(() => {
    // Logic
  }, [param]);

  return { state, actions };
}
```

---

## API Hooks (React Query)

### Query
```typescript
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['key', id],
  queryFn: () => fetchData(id),
  staleTime: 5 * 60 * 1000,
  enabled: !!id,
});
```

### Mutation
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: (data: Type) => postData(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['key'] });
  },
});

// Usage
mutation.mutate(data);
```

### Infinite Query
```typescript
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: ['items'],
  queryFn: ({ pageParam = 1 }) => fetchPage(pageParam),
  getNextPageParam: (lastPage) => lastPage.nextPage,
});
```

---

## Zustand Store Pattern

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface StoreState {
  // State
  count: number;
  user: User | null;

  // Actions
  increment: () => void;
  setUser: (user: User) => void;
  reset: () => void;
}

export const useStore = create<StoreState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        count: 0,
        user: null,

        // Actions
        increment: () => set((state) => ({ count: state.count + 1 })),
        setUser: (user) => set({ user }),
        reset: () => set({ count: 0, user: null }),
      }),
      {
        name: 'store-name',
        partialize: (state) => ({ count: state.count }),
      }
    )
  )
);

// Usage
const { count, increment } = useStore();
const user = useStore((state) => state.user);
```

---

## React Router

### Setup
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Navigation
```typescript
import { Link, NavLink, useNavigate } from 'react-router-dom';

// Link
<Link to="/path">Go to Page</Link>

// NavLink (with active styling)
<NavLink
  to="/path"
  className={({ isActive }) => isActive ? 'active' : ''}
>
  Link
</NavLink>

// Programmatic
const navigate = useNavigate();
navigate('/path');
navigate(-1); // Go back
```

### Hooks
```typescript
import { useParams, useSearchParams, useLocation } from 'react-router-dom';

// Params
const { id } = useParams<{ id: string }>();

// Search params
const [searchParams, setSearchParams] = useSearchParams();
const page = searchParams.get('page');
setSearchParams({ page: '2' });

// Location
const location = useLocation();
```

---

## Form Handling (React Hook Form + Zod)

### Schema
```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Required').max(255),
  email: z.string().email('Invalid email'),
  age: z.number().min(18).optional(),
});

type FormData = z.infer<typeof schema>;
```

### Form
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function MyForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  const onSubmit = async (data: FormData) => {
    await submitData(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        Submit
      </button>
    </form>
  );
}
```

---

## Tailwind CSS Classes

### Layout
```css
flex flex-col items-center justify-between gap-4
grid grid-cols-3 gap-6
container mx-auto px-4
```

### Sizing
```css
w-full h-screen
w-64 h-32
min-w-0 max-w-lg
```

### Spacing
```css
p-4 px-6 py-2
m-4 mx-auto my-8
space-x-4 space-y-2
```

### Typography
```css
text-sm text-base text-lg text-xl
font-normal font-medium font-bold
text-gray-900 text-white
```

### Colors
```css
bg-primary-600 text-white
border border-gray-300
hover:bg-primary-700
```

### Responsive
```css
sm:text-base md:text-lg lg:text-xl
hidden md:block
flex-col md:flex-row
```

### States
```css
hover:bg-gray-100
focus:ring-2 focus:ring-primary-500
active:scale-95
disabled:opacity-50
```

---

## Testing

### Component Test
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

test('renders and handles click', () => {
  const handleClick = vi.fn();

  render(<Button onClick={handleClick}>Click</Button>);

  const button = screen.getByRole('button', { name: /click/i });
  fireEvent.click(button);

  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### Hook Test
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useCustomHook } from './useCustomHook';

test('custom hook works', async () => {
  const { result } = renderHook(() => useCustomHook('test'));

  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  });
});
```

### Query Test
```typescript
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

test('fetches data', async () => {
  const { result } = renderHook(() => useQuery(...), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
});
```

---

## Storybook

### Basic Story
```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { Component } from './Component';

const meta: Meta<typeof Component> = {
  title: 'Category/Component',
  component: Component,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Component>;

export const Default: Story = {
  args: {
    prop: 'value',
  },
};
```

### Interactive Story
```typescript
import { within, userEvent, expect } from '@storybook/test';

export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button'));
    await expect(canvas.getByText('Result')).toBeInTheDocument();
  },
};
```

---

## Type Definitions

### Props
```typescript
interface ComponentProps {
  // Required
  id: string;
  name: string;

  // Optional
  description?: string;

  // Union types
  variant: 'primary' | 'secondary';

  // Functions
  onClick: (e: React.MouseEvent) => void;
  onChange?: (value: string) => void;

  // Children
  children: React.ReactNode;

  // HTML attributes
  className?: string;
}
```

### Utility Types
```typescript
// Pick
type SubsetProps = Pick<FullProps, 'id' | 'name'>;

// Omit
type WithoutClick = Omit<ButtonProps, 'onClick'>;

// Partial
type OptionalProps = Partial<AllProps>;

// Required
type RequiredProps = Required<SomeProps>;

// Record
type StringMap = Record<string, string>;

// Extract/Exclude
type NumericVariant = Extract<Variant, 'small' | 'large'>;
type NonNumericVariant = Exclude<Variant, 'small' | 'large'>;
```

---

## Common Utilities

### Class Names (cn)
```typescript
import { cn } from '@/utils/cn';

<div className={cn(
  'base-class',
  variant === 'primary' && 'primary-class',
  isActive && 'active-class',
  className
)} />
```

### Date Formatting
```typescript
import { format, formatDistanceToNow } from 'date-fns';

format(new Date(), 'PPP'); // Jan 1, 2024
formatDistanceToNow(date, { addSuffix: true }); // 2 hours ago
```

### Debounce
```typescript
import { debounce } from 'lodash-es';

const debouncedSearch = debounce((value: string) => {
  search(value);
}, 300);
```

---

## Environment Variables

```typescript
// Access in code
const apiUrl = import.meta.env.VITE_API_BASE_URL;
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;

// Type definitions
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## Keyboard Shortcuts

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Ignore if typing in input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    // Ctrl/Cmd + Key
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }

    // Single key
    switch (e.key) {
      case 'n':
        createNew();
        break;
      case 'Escape':
        closeModal();
        break;
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

---

## Error Boundaries

```typescript
class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

---

## Performance Tips

1. **Use React.memo** for expensive components
2. **Use useMemo** for expensive computations
3. **Use useCallback** for function props
4. **Lazy load** routes and heavy components
5. **Virtualize** long lists
6. **Debounce** search inputs
7. **Optimize images** (lazy loading, WebP)
8. **Code split** by route
9. **Use production build** for testing
10. **Monitor bundle size**

---

## Debugging

```typescript
// React DevTools
// Install browser extension

// Log renders
useEffect(() => {
  console.log('Component rendered', { props, state });
});

// Debug React Query
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
<ReactQueryDevtools initialIsOpen={false} />

// Debug Zustand
import { devtools } from 'zustand/middleware';
const useStore = create(devtools(...));

// Performance profiling
import { Profiler } from 'react';

<Profiler
  id="MyComponent"
  onRender={(id, phase, actualDuration) => {
    console.log({ id, phase, actualDuration });
  }}
>
  <MyComponent />
</Profiler>
```

---

## Common Pitfalls

❌ **Don't:**
- Mutate state directly
- Use array index as key
- Define components inside components
- Forget cleanup in useEffect
- Call hooks conditionally
- Use any type
- Ignore TypeScript errors
- Skip accessibility

✅ **Do:**
- Use immutable updates
- Use unique stable keys
- Extract components to top level
- Return cleanup functions
- Call hooks at top level
- Define explicit types
- Fix TypeScript errors
- Test with keyboard/screen reader

---

This cheatsheet provides quick reference for common patterns and operations in the GrayFSM frontend.
