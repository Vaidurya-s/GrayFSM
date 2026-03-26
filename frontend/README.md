# GrayFSM Frontend

A modern, interactive web application for optimizing finite state machines using Gray code encoding.

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Routing**: React Router v6
- **FSM Visualization**: React Flow
- **3D Graphics**: Three.js + React Three Fiber
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **Animation**: Framer Motion
- **Testing**: Vitest + React Testing Library
- **Documentation**: Storybook

## Project Structure

```
frontend/
├── public/                 # Static assets
├── src/
│   ├── api/               # API client and endpoints
│   ├── components/        # React components
│   │   ├── ui/           # Base design system components
│   │   ├── fsm/          # FSM-specific components
│   │   ├── forms/        # Form components
│   │   ├── visualization/ # Visualization components
│   │   ├── layout/       # Layout components
│   │   └── providers/    # Context providers
│   ├── hooks/            # Custom React hooks
│   │   └── useAPI/       # API integration hooks
│   ├── layouts/          # Page layouts
│   ├── pages/            # Page components
│   ├── store/            # Zustand stores
│   ├── styles/           # Global styles and theme
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── config/           # Configuration files
│   ├── App.tsx           # Root component
│   └── main.tsx          # Application entry point
├── .storybook/           # Storybook configuration
├── tests/                # Test files
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Backend API running (default: http://localhost:8000)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run Storybook
npm run storybook

# Lint code
npm run lint

# Format code
npm run format
```

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create a `.env.local` file:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000/ws
```

## Key Features

### 1. FSM Editor
- Drag-and-drop state machine creation
- React Flow-based interactive canvas
- Real-time validation
- Undo/redo support

### 2. Optimization Engine
- Multiple algorithm support (Greedy, BFS, Simulated Annealing)
- Real-time progress tracking
- Side-by-side comparison view
- Detailed metrics dashboard

### 3. Visualization
- Interactive FSM graph viewer
- 2D and 3D hypercube visualization
- Transition path animation
- Metrics charts and dashboards

### 4. Export
- Verilog and VHDL code generation
- JSON and CSV export
- Testbench generation
- Customizable export options

### 5. Examples Library
- Curated example FSMs
- Categories and filtering
- Interactive tutorials
- One-click import

## Component Library

### Design System Components
- `Button` - Multi-variant button component
- `Input` - Text input with validation
- `Select` - Dropdown select
- `Card` - Content container
- `Modal` - Dialog component
- `Toast` - Notification system
- `Badge` - Status indicator
- `Spinner` - Loading indicator

### FSM Components
- `FSMNode` - Custom React Flow node
- `FSMEdge` - Custom React Flow edge
- `FSMGraphViewer` - Read-only FSM visualization
- `FSMEditor` - Interactive FSM editor

### Visualization Components
- `ComparisonView` - Side-by-side FSM comparison
- `HypercubeView2D` - 2D hypercube visualization
- `Hypercube3D` - 3D hypercube with Three.js
- `MetricsDashboard` - Optimization metrics

### Form Components
- `FSMCreateForm` - Create new FSM
- `ImportForm` - Import from JSON/CSV
- `ExportForm` - Export to various formats

## State Management

### Zustand Stores

**FSM Store** (`src/store/fsmStore.ts`)
- Current FSM state
- History (undo/redo)
- Selection state
- CRUD operations

**Editor Store** (`src/store/editorStore.ts`)
- Editor mode (select, add-state, add-transition)
- View mode (graph, split, code)
- UI preferences (grid, snap, zoom)
- Clipboard operations

**UI Store** (`src/store/uiStore.ts`)
- Theme (light/dark)
- Toast notifications
- Modal state
- Global loading

## API Integration

### React Query Hooks

```typescript
// FSM operations
useFSMs(params)           // List FSMs
useFSM(id)               // Get single FSM
useCreateFSM()           // Create FSM
useUpdateFSM()           // Update FSM
useDeleteFSM()           // Delete FSM

// Optimization
useOptimizeFSM()         // Optimize FSM
useCompareAlgorithms()   // Compare algorithms

// Export
useExportFSM()           // Export FSM

// Examples
useExamples()            // List examples
useExample(id)           // Get example
```

## Routing

```typescript
/                        // Home page
/editor/new              // Create new FSM
/editor/:id              // Edit FSM
/optimize/:id            // Optimize FSM
/gallery                 // Public FSM gallery
/examples                // Example library
/examples/:id            // Example detail
/learn                   // Tutorials
/about                   // About page
/docs                    // Documentation
```

## Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- Button.test.tsx

# Run with coverage
npm test -- --coverage
```

### Component Tests
```typescript
// Example test
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

test('renders button', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader friendly
- Focus management
- ARIA labels and live regions
- Color contrast verified

## Performance

- Code splitting and lazy loading
- React Query caching
- Virtualized lists for large datasets
- Optimized re-renders with memo
- Bundle size monitoring

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Support

- Documentation: [/docs](./docs)
- Issues: [GitHub Issues](https://github.com/yourusername/grayfsm/issues)
- Discord: [Community Server](https://discord.gg/grayfsm)
