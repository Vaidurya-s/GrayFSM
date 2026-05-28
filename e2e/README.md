# GrayFSM E2E Test Suite

Comprehensive end-to-end testing suite for the GrayFSM application using Playwright.

## Overview

This test suite provides complete coverage of the GrayFSM application, including:

- **Critical User Journeys**: Complete workflows from FSM creation to export
- **Cross-Browser Testing**: Chrome, Firefox, Safari compatibility
- **Responsive Design**: Mobile, tablet, and desktop viewports
- **Accessibility**: WCAG 2.1 AA compliance testing
- **Performance**: Core Web Vitals and performance metrics
- **Visual Regression**: UI consistency across releases
- **UI Interactions**: Drag-drop, forms, navigation
- **Error Scenarios**: Invalid inputs, network failures, edge cases

## Table of Contents

- [Installation](#installation)
- [Running Tests](#running-tests)
- [Test Organization](#test-organization)
- [Page Object Models](#page-object-models)
- [Test Fixtures](#test-fixtures)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Installation

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+ (for backend)
- Git

### Setup

```bash
# Navigate to E2E directory
cd e2e

# Install dependencies
npm install

# Install Playwright browsers
npm run install

# Or install with OS dependencies
npx playwright install --with-deps
```

### Environment Configuration

Create a `.env` file in the `e2e/` directory:

```env
# Application URLs
BASE_URL=http://localhost:3000
API_URL=http://localhost:8000

# Test configuration
HEADLESS=false
SLOW_MO=0
TIMEOUT=30000

# Visual regression
UPDATE_SNAPSHOTS=false

# Performance thresholds
LCP_THRESHOLD=2500
FCP_THRESHOLD=1800
CLS_THRESHOLD=0.1
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run in headed mode (see browser)
npm run test:headed

# Run in debug mode
npm run test:debug

# Run specific test file
npm test tests/critical-journeys/01-create-fsm-from-scratch.spec.ts

# Run tests matching a pattern
npm test -- --grep "create FSM"
```

### Browser-Specific Tests

```bash
# Run on Chromium only
npm run test:chromium

# Run on Firefox only
npm run test:firefox

# Run on WebKit (Safari) only
npm run test:webkit

# Run on all browsers
npm run test:all-browsers
```

### Device-Specific Tests

```bash
# Run mobile tests
npm run test:mobile

# Run tablet tests
npm run test:tablet

# Run on specific device
npm test -- --project="mobile-chrome"
```

### Category-Specific Tests

```bash
# Critical user journeys
npm run test:critical

# Accessibility tests
npm run test:accessibility

# Performance tests
npm run test:performance

# Visual regression tests
npm run test:visual

# Update visual snapshots
npm run test:update-snapshots
```

### UI Mode

```bash
# Run Playwright UI for interactive testing
npm run test:ui
```

## Test Organization

```
e2e/
├── tests/
│   ├── critical-journeys/       # Main user workflows
│   │   ├── 01-create-fsm-from-scratch.spec.ts
│   │   ├── 02-import-fsm.spec.ts
│   │   ├── 03-optimize-fsm.spec.ts
│   │   ├── 04-export-fsm.spec.ts
│   │   └── 05-browse-examples.spec.ts
│   ├── cross-browser/           # Browser compatibility
│   │   ├── browser-compatibility.spec.ts
│   │   └── responsive-design.spec.ts
│   ├── ui-interactions/         # UI element interactions
│   │   ├── drag-and-drop.spec.ts
│   │   ├── forms.spec.ts
│   │   └── navigation.spec.ts
│   ├── accessibility/           # WCAG compliance
│   │   └── wcag-compliance.spec.ts
│   ├── performance/             # Performance metrics
│   │   └── core-web-vitals.spec.ts
│   └── visual-regression/       # Visual consistency
│       └── visual-consistency.spec.ts
├── page-objects/                # Page Object Models
│   ├── BasePage.ts
│   ├── HomePage.ts
│   ├── EditorPage.ts
│   ├── ImportPage.ts
│   ├── ExamplesPage.ts
│   ├── ComparisonPage.ts
│   ├── OptimizationPage.ts
│   └── ExportPage.ts
├── fixtures/                    # Test data
│   ├── fsm-examples.ts
│   └── test-fixtures.ts
├── utils/                       # Helper utilities
│   ├── test-helpers.ts
│   ├── global-setup.ts
│   └── global-teardown.ts
├── playwright.config.ts         # Configuration
├── tsconfig.json               # TypeScript config
└── README.md                   # This file
```

## Page Object Models

Page Object Models (POMs) provide a clean abstraction for interacting with pages.

### Available Page Objects

- **BasePage**: Common functionality for all pages
- **HomePage**: Landing page interactions
- **EditorPage**: FSM editor canvas and controls
- **ImportPage**: FSM import functionality
- **ExamplesPage**: Example library browsing
- **ComparisonPage**: Algorithm comparison views
- **OptimizationPage**: Optimization results and metrics
- **ExportPage**: Export formats and options

### Using Page Objects

```typescript
import { EditorPage } from '@page-objects';

test('example test', async ({ page }) => {
  const editorPage = new EditorPage(page);

  // Navigate to editor
  await editorPage.goToEditor();

  // Add a state
  await editorPage.addState(300, 300);

  // Verify state was added
  await editorPage.expectStateCount(1);
});
```

### Common Methods

All page objects extend `BasePage` with these methods:

```typescript
// Navigation
await page.goto('/path');
await page.navigateTo('/path');

// Theme
await page.toggleTheme();
await page.setDarkMode();
await page.setLightMode();

// Waiting
await page.waitForPageLoad();
await page.waitForLoading();

// Assertions
await page.expectToBeVisible();
await page.expectSuccessMessage('Saved');
await page.expectErrorMessage('Invalid');

// Screenshots
await page.takeScreenshot('name');
await page.compareScreenshot('name');
```

## Test Fixtures

### FSM Examples

Pre-defined FSM structures for testing:

```typescript
import {
  trafficLightFSM,
  vendingMachineFSM,
  sequenceDetectorFSM,
  simpleFSM,
  complexFSM,
  largeFSM
} from '@fixtures/fsm-examples';

test('import traffic light', async ({ page }) => {
  await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
});
```

### Test Helpers

Utility functions for common operations:

```typescript
import {
  waitForNetworkIdle,
  getCoreWebVitals,
  checkPerformanceThresholds,
  mockAPIResponse,
  simulateSlowNetwork,
  detectMemoryLeak
} from '@utils/test-helpers';

test('performance test', async ({ page }) => {
  await checkPerformanceThresholds(page, {
    LCP: 2500,
    FCP: 1800,
    CLS: 0.1
  });
});
```

## CI/CD Integration

### GitHub Actions

Example workflow configuration:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd e2e
          npm ci
          npx playwright install --with-deps

      - name: Start services
        run: |
          docker-compose up -d
          # Wait for services
          sleep 10

      - name: Run E2E tests
        run: |
          cd e2e
          npm test
        env:
          BASE_URL: http://localhost:3000
          API_URL: http://localhost:8000

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: e2e/test-results/
          retention-days: 30
```

### Test Reports

Tests generate multiple report formats:

- **HTML Report**: `test-results/html-report/index.html`
- **JSON Report**: `test-results/results.json`
- **JUnit XML**: `test-results/junit.xml`

View HTML report:

```bash
npm run report
```

## Best Practices

### Writing Tests

1. **Use Page Objects**: Always use page objects instead of direct selectors
2. **Descriptive Names**: Test names should clearly describe what they test
3. **Arrange-Act-Assert**: Follow AAA pattern in tests
4. **Independent Tests**: Each test should be independent and isolated
5. **Clean Up**: Tests should clean up after themselves

```typescript
// Good
test('should create FSM with three states', async ({ page }) => {
  // Arrange
  const editorPage = new EditorPage(page);
  await editorPage.goToEditor();

  // Act
  await editorPage.addState(200, 200);
  await editorPage.addState(400, 200);
  await editorPage.addState(300, 400);

  // Assert
  await editorPage.expectStateCount(3);
});

// Bad
test('test 1', async ({ page }) => {
  await page.goto('/editor');
  await page.click('button');
  await page.click('[data-testid="canvas"]');
  // Multiple unrelated assertions...
});
```

### Selectors

1. **Prefer data-testid**: Use `data-testid` attributes
2. **Avoid CSS selectors**: Don't rely on implementation details
3. **User-facing**: Use text content when appropriate

```typescript
// Good
await page.locator('[data-testid="optimize-btn"]').click();
await page.getByRole('button', { name: 'Optimize' }).click();

// Bad
await page.locator('.btn.primary.optimize-button-class').click();
```

### Waits

1. **Auto-waiting**: Playwright auto-waits for most actions
2. **Explicit waits**: Use `waitFor()` for complex scenarios
3. **Avoid timeouts**: Minimize `page.waitForTimeout()` usage

```typescript
// Good
await page.locator('[data-testid="results"]').waitFor({ state: 'visible' });

// Acceptable when necessary
await page.waitForTimeout(500); // Animation duration

// Bad
await page.waitForTimeout(5000); // Arbitrary wait
```

### Debugging

```typescript
// Pause test execution
await page.pause();

// Take screenshot
await page.screenshot({ path: 'debug.png' });

// Console logs
console.log(await page.locator('h1').textContent());

// Slow down execution
// Set SLOW_MO=1000 in .env

// Use debug mode
// npm run test:debug
```

## Troubleshooting

### Common Issues

#### Tests Timing Out

```bash
# Increase timeout
npm test -- --timeout 60000

# Or in test file
test.setTimeout(60000);
```

#### Browser Not Found

```bash
# Reinstall browsers
npx playwright install --with-deps
```

#### Flaky Tests

1. Check for race conditions
2. Add appropriate waits
3. Use `test.retry()` in CI
4. Check for animations interfering

```typescript
// Disable animations
await page.addStyleTag({
  content: '* { animation: none !important; transition: none !important; }'
});
```

#### Visual Regression Failures

```bash
# Update snapshots if changes are intentional
npm run test:update-snapshots

# Increase threshold for minor differences
await expect(page).toHaveScreenshot('name.png', {
  maxDiffPixels: 200,
  threshold: 0.3
});
```

### Performance Issues

```bash
# Run fewer workers
npm test -- --workers=1

# Disable video recording
# Set video: 'off' in playwright.config.ts

# Use headed mode for debugging
npm run test:headed
```

### Getting Help

- **Playwright Docs**: https://playwright.dev
- **Project Issues**: File bug in GitHub repository
- **Debug Logs**: Set `DEBUG=pw:api` environment variable

## Coverage Report

Generate and view coverage:

```bash
# Run tests with coverage
npm test -- --coverage

# View coverage report
open coverage/index.html
```

## Advanced Usage

### Custom Fixtures

Create reusable test fixtures:

```typescript
import { test as base } from '@playwright/test';
import { EditorPage } from '@page-objects';

type MyFixtures = {
  editorWithFSM: EditorPage;
};

export const test = base.extend<MyFixtures>({
  editorWithFSM: async ({ page }, use) => {
    const editor = new EditorPage(page);
    await editor.goToEditor();
    await editor.addState(300, 300);
    await use(editor);
  },
});

// Use in tests
test('test with fixture', async ({ editorWithFSM }) => {
  await editorWithFSM.expectStateCount(1);
});
```

### Parallel Execution

```typescript
// Run tests in parallel
test.describe.configure({ mode: 'parallel' });

// Or serial
test.describe.configure({ mode: 'serial' });
```

### Tags

```typescript
// Tag tests
test('critical flow @smoke @critical', async ({ page }) => {
  // Test code
});

// Run tagged tests
npm test -- --grep @smoke
```

## Contributing

When adding new tests:

1. Follow existing patterns
2. Update page objects if needed
3. Add fixtures for reusable data
4. Document complex test scenarios
5. Ensure tests pass in CI
6. Update this README if adding new categories

## License

MIT License - See main project LICENSE file
