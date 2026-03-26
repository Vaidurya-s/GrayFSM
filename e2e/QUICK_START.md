# GrayFSM E2E Tests - Quick Start Guide

## Installation (One-Time Setup)

```bash
cd /home/arunupscee/Music/grayFSM/e2e
npm install
npm run install  # Install Playwright browsers
```

## Running Tests

### Most Common Commands

```bash
# Run all tests
npm test

# Run in browser (see what's happening)
npm run test:headed

# Interactive UI mode
npm run test:ui

# Debug mode (step through tests)
npm run test:debug
```

### By Category

```bash
npm run test:critical        # Main user workflows (5 files)
npm run test:accessibility   # WCAG compliance
npm run test:performance     # Speed and metrics
npm run test:visual          # UI consistency
```

### By Browser

```bash
npm run test:chromium        # Chrome only
npm run test:firefox         # Firefox only
npm run test:webkit          # Safari only
npm run test:all-browsers    # All 3 browsers
```

### By Device

```bash
npm run test:mobile          # Phone screens
npm run test:tablet          # Tablet screens
```

### Specific Test File

```bash
# Run one test file
npm test tests/critical-journeys/01-create-fsm-from-scratch.spec.ts

# Run tests matching a pattern
npm test -- --grep "create FSM"
```

## View Test Results

```bash
# Open HTML report
npm run report
```

Reports are in: `test-results/html-report/index.html`

## Update Visual Snapshots

```bash
# When UI changes are intentional
npm run test:update-snapshots
```

## Common Issues

### "Browser not found"
```bash
npx playwright install --with-deps
```

### "Port already in use"
```bash
# Kill existing services
pkill -f "vite"
pkill -f "uvicorn"
```

### Tests timing out
```bash
# Run with longer timeout
npm test -- --timeout=60000
```

### Flaky test
```bash
# Run same test 10 times to identify issue
npm test -- --repeat-each=10 tests/path/to/test.spec.ts
```

## File Locations

All test files are in `/home/arunupscee/Music/grayFSM/e2e/tests/`:

```
tests/
├── critical-journeys/       # Main workflows
│   ├── 01-create-fsm-from-scratch.spec.ts
│   ├── 02-import-fsm.spec.ts
│   ├── 03-optimize-fsm.spec.ts
│   ├── 04-export-fsm.spec.ts
│   └── 05-browse-examples.spec.ts
├── cross-browser/           # Browser compatibility
├── ui-interactions/         # Drag-drop, forms, etc.
├── accessibility/           # WCAG compliance
├── performance/             # Speed metrics
└── visual-regression/       # UI screenshots
```

## Test Coverage

- ✅ **120+ tests** covering all features
- ✅ **3 browsers**: Chrome, Firefox, Safari
- ✅ **7 screen sizes**: Mobile to 4K
- ✅ **WCAG 2.1 AA** accessibility
- ✅ **Core Web Vitals** performance
- ✅ **Visual regression** prevention

## Need Help?

- **Full Documentation**: `README.md`
- **Detailed Guide**: `/home/arunupscee/Music/grayFSM/E2E_TEST_SUITE_DOCUMENTATION.md`
- **Playwright Docs**: https://playwright.dev

## Quick Tips

1. **Run locally before committing**: `npm test`
2. **Check specific feature**: `npm test -- --grep "feature name"`
3. **Debug failing test**: `npm run test:debug`
4. **See tests run**: `npm run test:headed`
5. **Interactive mode**: `npm run test:ui`

That's it! You're ready to run E2E tests. 🚀
