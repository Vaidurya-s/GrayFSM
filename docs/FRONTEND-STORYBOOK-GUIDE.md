# GrayFSM Frontend - Storybook Setup & Component Documentation Guide

## Overview

Storybook is used for developing, documenting, and testing UI components in isolation. This guide covers setup, usage, and best practices for GrayFSM component documentation.

---

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Writing Stories](#writing-stories)
3. [Addons Configuration](#addons-configuration)
4. [Advanced Features](#advanced-features)
5. [Best Practices](#best-practices)

---

## Installation & Setup

### Install Storybook

```bash
# Install Storybook with React and Vite
npx storybook@latest init --type react --builder vite

# This installs:
# - @storybook/react-vite
# - @storybook/addon-essentials
# - @storybook/addon-interactions
# - @storybook/test
```

### Additional Addons

```bash
# Install useful addons
npm install -D \
  @storybook/addon-a11y \
  @storybook/addon-themes \
  @storybook/addon-viewport \
  @storybook/addon-measure \
  @storybook/addon-outline
```

### Configure Storybook

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],

  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    '@storybook/addon-viewport',
    '@storybook/addon-measure',
    '@storybook/addon-outline',
  ],

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  docs: {
    autodocs: 'tag',
  },

  async viteFinal(config) {
    // Add path aliases to match main app
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, '../src'),
    };

    return config;
  },
};

export default config;
```

### Preview Configuration

```typescript
// .storybook/preview.ts
import type { Preview } from '@storybook/react';
import { withThemeByClassName } from '@storybook/addon-themes';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#f9fafb',
        },
        {
          name: 'dark',
          value: '#111827',
        },
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1920px',
            height: '1080px',
          },
        },
      },
    },
  },

  decorators: [
    withThemeByClassName({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
  ],
};

export default preview;
```

### Custom Theme

```typescript
// .storybook/theme.ts
import { create } from '@storybook/theming/create';

export default create({
  base: 'light',
  brandTitle: 'GrayFSM Components',
  brandUrl: 'https://grayfsm.com',
  brandImage: '/logo.svg',
  brandTarget: '_self',

  colorPrimary: '#2563eb',
  colorSecondary: '#3b82f6',

  // UI
  appBg: '#f9fafb',
  appContentBg: '#ffffff',
  appBorderColor: '#e5e7eb',
  appBorderRadius: 8,

  // Typography
  fontBase: '"Inter", sans-serif',
  fontCode: '"JetBrains Mono", monospace',

  // Text colors
  textColor: '#1f2937',
  textInverseColor: '#ffffff',

  // Toolbar
  barTextColor: '#6b7280',
  barSelectedColor: '#2563eb',
  barBg: '#ffffff',

  // Form colors
  inputBg: '#ffffff',
  inputBorder: '#d1d5db',
  inputTextColor: '#1f2937',
  inputBorderRadius: 6,
});
```

```typescript
// .storybook/manager.ts
import { addons } from '@storybook/manager-api';
import theme from './theme';

addons.setConfig({
  theme,
});
```

---

## Writing Stories

### Basic Story Structure

```typescript
// src/components/ui/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

// Meta defines component-level configuration
const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger'],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'icon'],
      description: 'Button size',
    },
    isLoading: {
      control: 'boolean',
      description: 'Shows loading spinner',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the button',
    },
  },
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Default story
export const Default: Story = {
  args: {
    children: 'Button',
    variant: 'primary',
    size: 'md',
  },
};

// Variant examples
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Button',
  },
};

// Size examples
export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small Button',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large Button',
  },
};

// State examples
export const Loading: Story = {
  args: {
    isLoading: true,
    children: 'Loading...',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled Button',
  },
};

// With icons
export const WithLeftIcon: Story = {
  args: {
    leftIcon: <span>📝</span>,
    children: 'Edit',
  },
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>
      <div className="flex gap-2">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>
    </div>
  ),
};
```

### Complex Component Story

```typescript
// src/components/fsm/FSMNode/FSMNode.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { FSMNode } from './FSMNode';
import { ReactFlowProvider } from 'reactflow';

const meta: Meta<typeof FSMNode> = {
  title: 'FSM/FSMNode',
  component: FSMNode,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <div style={{ width: 300, height: 200 }}>
          <Story />
        </div>
      </ReactFlowProvider>
    ),
  ],
  argTypes: {
    data: {
      control: 'object',
    },
    selected: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof FSMNode>;

export const Default: Story = {
  args: {
    data: {
      label: 'S0',
      output: '00',
      isInitial: false,
      isDummy: false,
    },
    selected: false,
  },
};

export const InitialState: Story = {
  args: {
    data: {
      label: 'S0',
      output: '00',
      isInitial: true,
      isDummy: false,
    },
  },
};

export const DummyState: Story = {
  args: {
    data: {
      label: 'D0',
      output: '01',
      isInitial: false,
      isDummy: true,
    },
  },
};

export const Selected: Story = {
  args: {
    data: {
      label: 'S1',
      output: '10',
      isInitial: false,
      isDummy: false,
    },
    selected: true,
  },
};
```

### Interactive Stories with Play Function

```typescript
// src/components/forms/FSMCreateForm/FSMCreateForm.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect } from '@storybook/test';
import { FSMCreateForm } from './FSMCreateForm';

const meta: Meta<typeof FSMCreateForm> = {
  title: 'Forms/FSMCreateForm',
  component: FSMCreateForm,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FSMCreateForm>;

export const Default: Story = {};

// Interactive test
export const WithValidation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Try to submit empty form
    const submitButton = canvas.getByRole('button', { name: /create/i });
    await userEvent.click(submitButton);

    // Verify validation errors appear
    await expect(
      canvas.getByText(/name is required/i)
    ).toBeInTheDocument();

    // Fill in valid data
    const nameInput = canvas.getByLabelText(/name/i);
    await userEvent.type(nameInput, 'Test FSM');

    const typeSelect = canvas.getByLabelText(/type/i);
    await userEvent.selectOptions(typeSelect, 'moore');

    // Errors should disappear
    await expect(
      canvas.queryByText(/name is required/i)
    ).not.toBeInTheDocument();
  },
};

export const Prefilled: Story = {
  args: {
    initialData: {
      name: 'Traffic Light',
      fsm_type: 'moore',
      visibility: 'public',
    },
  },
};
```

### MDX Documentation

```mdx
<!-- src/components/ui/Button/Button.mdx -->

import { Canvas, Meta, Story, ArgsTable } from '@storybook/blocks';
import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

# Button

The Button component is a versatile, accessible button with multiple variants and sizes.

## Usage

```tsx
import { Button } from '@/components/ui/Button';

function MyComponent() {
  return (
    <Button variant="primary" size="md" onClick={() => alert('Clicked!')}>
      Click Me
    </Button>
  );
}
```

## Variants

The button comes in five variants:

<Canvas of={ButtonStories.AllVariants} />

### Primary
Use for the main call-to-action on a page.

<Canvas of={ButtonStories.Primary} />

### Secondary
Use for secondary actions.

<Canvas of={ButtonStories.Secondary} />

### Outline
Use for less prominent actions.

<Canvas of={ButtonStories.Outline} />

## States

### Loading
Show a spinner when an async action is in progress.

<Canvas of={ButtonStories.Loading} />

### Disabled
Disable the button when action is not available.

<Canvas of={ButtonStories.Disabled} />

## Props

<ArgsTable of={ButtonStories} />

## Accessibility

The Button component follows WAI-ARIA button pattern:

- Uses semantic `<button>` element
- Keyboard accessible (Space/Enter to activate)
- Focus visible with outline
- Screen reader announces loading state via `aria-busy`
- Disabled state prevents interaction

## Best Practices

✅ **Do:**
- Use clear, action-oriented labels
- Provide loading state for async actions
- Use appropriate variant for context

❌ **Don't:**
- Use multiple primary buttons on same page
- Make buttons too small (min 44x44px for touch)
- Use generic labels like "Click Here"
```

---

## Addons Configuration

### Accessibility Testing

```typescript
// Enable a11y addon
export const AllVariants: Story = {
  parameters: {
    a11y: {
      // Configure axe rules
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
        ],
      },
      // Run checks on specific elements
      element: '#root',
    },
  },
  render: () => (
    <div id="root">
      {/* Components */}
    </div>
  ),
};
```

### Viewport Testing

```typescript
// Test responsive design
export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};
```

### Actions Testing

```typescript
// Log interactions
export const Interactive: Story = {
  args: {
    onClick: fn(), // From @storybook/test
    onMouseEnter: fn(),
    onMouseLeave: fn(),
  },
};
```

---

## Advanced Features

### Global Decorators

```typescript
// .storybook/preview.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export const decorators = [
  (Story) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Story />
      </BrowserRouter>
    </QueryClientProvider>
  ),
];
```

### Mock Service Worker (MSW)

```typescript
// .storybook/preview.ts
import { initialize, mswLoader } from 'msw-storybook-addon';

// Initialize MSW
initialize();

const preview: Preview = {
  loaders: [mswLoader],
  // ...
};
```

```typescript
// Component.stories.tsx
import { http, HttpResponse } from 'msw';

export const Success: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/v1/fsms', () => {
          return HttpResponse.json({
            success: true,
            data: [
              { id: '1', name: 'Test FSM' }
            ],
          });
        }),
      ],
    },
  },
};

export const Error: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/v1/fsms', () => {
          return HttpResponse.json(
            { error: 'Not found' },
            { status: 404 }
          );
        }),
      ],
    },
  },
};
```

### Custom Addons

```typescript
// .storybook/addons/theme-switcher.tsx
import { useGlobals } from '@storybook/manager-api';
import { IconButton } from '@storybook/components';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

export const ThemeSwitcher = () => {
  const [{ theme }, updateGlobals] = useGlobals();

  const toggleTheme = () => {
    updateGlobals({
      theme: theme === 'light' ? 'dark' : 'light',
    });
  };

  return (
    <IconButton onClick={toggleTheme}>
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
    </IconButton>
  );
};
```

---

## Best Practices

### Story Organization

```
src/
├── components/
│   ├── ui/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   ├── Button.stories.tsx
│   │   │   ├── Button.mdx (optional)
│   │   │   └── index.ts
│   │   └── ...
│   ├── fsm/
│   │   └── ...
│   └── ...
```

### Naming Convention

```typescript
// Component.stories.tsx structure

// 1. Meta (required)
const meta: Meta<typeof Component> = {
  title: 'Category/Component',  // Use slash for hierarchy
  component: Component,
  tags: ['autodocs'],            // Enable auto-generated docs
};

// 2. Stories (PascalCase)
export const Default: Story = {};
export const WithProps: Story = {};
export const InteractiveExample: Story = {};

// 3. Complex renders
export const AllVariants: Story = {
  render: () => <div>{/* JSX */}</div>
};
```

### Documentation

1. **Always include:**
   - Default story
   - All variant stories
   - All state stories (loading, error, empty)
   - Interactive example with play function

2. **Use controls for:**
   - Props that users commonly change
   - Boolean toggles
   - Enums and unions

3. **Use MDX for:**
   - Complex documentation
   - Usage examples
   - Guidelines and best practices
   - Accessibility notes

### Testing in Storybook

```typescript
// Interaction testing
export const UserFlow: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Fill form', async () => {
      await userEvent.type(
        canvas.getByLabelText('Name'),
        'Test FSM'
      );
    });

    await step('Submit form', async () => {
      await userEvent.click(
        canvas.getByRole('button', { name: /submit/i })
      );
    });

    await step('Verify success', async () => {
      await expect(
        canvas.getByText(/success/i)
      ).toBeInTheDocument();
    });
  },
};
```

---

## Running Storybook

```bash
# Development
npm run storybook

# Build static site
npm run build-storybook

# Preview built Storybook
npx http-server ./storybook-static

# Deploy to Chromatic (optional)
npx chromatic --project-token=<token>
```

---

## CI/CD Integration

```yaml
# .github/workflows/storybook.yml
name: Storybook

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build Storybook
        run: npm run build-storybook

      - name: Publish to Chromatic
        uses: chromaui/action@v1
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
```

---

This guide provides comprehensive coverage of Storybook setup and usage for the GrayFSM project. Follow these patterns to create consistent, well-documented component stories.
