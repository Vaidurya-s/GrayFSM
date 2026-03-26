/**
 * Performance Tests - Core Web Vitals
 *
 * Tests performance metrics and Core Web Vitals
 * Run with: npm run test:performance
 */
import { test, expect } from '@playwright/test';
import { HomePage, EditorPage } from '@page-objects';
import { getCoreWebVitals, checkPerformanceThresholds } from '@utils/test-helpers';

test.describe('Core Web Vitals', () => {
  test('should meet LCP threshold on home page', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Check Core Web Vitals
    await checkPerformanceThresholds(page, {
      LCP: 2500, // Largest Contentful Paint < 2.5s
    });
  });

  test('should meet FCP threshold on home page', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    await checkPerformanceThresholds(page, {
      FCP: 1800, // First Contentful Paint < 1.8s
    });
  });

  test('should have low CLS on editor page', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();

    // Wait for page to stabilize
    await page.waitForTimeout(3000);

    await checkPerformanceThresholds(page, {
      CLS: 0.1, // Cumulative Layout Shift < 0.1
    });
  });

  test('should load editor within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    const editorPage = new EditorPage(page);
    await editorPage.goToEditor();
    await editorPage.expectEditorLoaded();

    const loadTime = Date.now() - startTime;

    // Editor should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should handle large FSM rendering efficiently', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();

    const startTime = Date.now();

    // Add many states
    for (let i = 0; i < 20; i++) {
      await editorPage.addState(200 + (i % 5) * 100, 200 + Math.floor(i / 5) * 100);
    }

    const renderTime = Date.now() - startTime;

    // Should render 20 states within 5 seconds
    expect(renderTime).toBeLessThan(5000);

    await editorPage.expectStateCount(20);
  });

  test('should have acceptable Time to Interactive', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goto('/');

    // Measure time to interactive
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        if (performance.timing) {
          const { navigationStart, domInteractive } = performance.timing;
          resolve(domInteractive - navigationStart);
        } else {
          resolve(0);
        }
      });
    });

    // TTI should be under 3.8 seconds
    expect(metrics).toBeLessThan(3800);
  });

  test('should optimize resource loading', async ({ page }) => {
    await page.goto('/');

    // Get all resource timings
    const resources = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      return entries.map((entry: any) => ({
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize,
      }));
    });

    // No single resource should take more than 5 seconds
    for (const resource of resources) {
      expect(resource.duration).toBeLessThan(5000);
    }

    // Total resources should be reasonable
    expect(resources.length).toBeLessThan(100);
  });

  test('should have minimal JavaScript bundle size impact', async ({ page }) => {
    await page.goto('/');

    // Get JavaScript file sizes
    const jsResources = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      return entries
        .filter((entry: any) => entry.name.endsWith('.js'))
        .map((entry: any) => ({
          name: entry.name,
          size: entry.transferSize,
        }));
    });

    // Calculate total JS size
    const totalJSSize = jsResources.reduce((sum, resource) => sum + (resource.size || 0), 0);

    // Total JS should be under 500KB (gzipped)
    expect(totalJSSize).toBeLessThan(500 * 1024);
  });

  test('should handle optimization algorithm performance', async ({ page }) => {
    const homePage = new HomePage(page);
    const importPage = await import('@page-objects').then(m => new m.ImportPage(page));
    const editorPage = new EditorPage(page);

    // Import a medium-sized FSM
    const mediumFSM = {
      type: 'moore',
      states: Array.from({ length: 16 }, (_, i) => `S${i}`),
      initial_state: 'S0',
      transitions: Array.from({ length: 20 }, (_, i) => ({
        from_state: `S${i % 16}`,
        to_state: `S${(i + 7) % 16}`,
        input: `${i % 2}`,
      })),
      outputs: Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [`S${i}`, i.toString(2).padStart(4, '0')])
      ),
    };

    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(mediumFSM));
    await importPage.import();

    const startTime = Date.now();

    // Run greedy optimization
    await editorPage.optimize('greedy');

    const optimizationTime = Date.now() - startTime;

    // Greedy algorithm should complete within 5 seconds for 16-state FSM
    expect(optimizationTime).toBeLessThan(5000);
  });

  test('should maintain smooth frame rate during interactions', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();

    // Add states
    await editorPage.addState(300, 300);
    await editorPage.addState(500, 300);

    // Start performance monitoring
    await page.evaluate(() => {
      (window as any).frameCount = 0;
      (window as any).startTime = performance.now();

      const countFrame = () => {
        (window as any).frameCount++;
        requestAnimationFrame(countFrame);
      };

      requestAnimationFrame(countFrame);
    });

    // Perform interactions
    await editorPage.zoomIn(3);
    await editorPage.zoomOut(3);
    await editorPage.panCanvas(100, 100);

    await page.waitForTimeout(1000);

    // Calculate FPS
    const fps = await page.evaluate(() => {
      const elapsed = (performance.now() - (window as any).startTime) / 1000;
      return (window as any).frameCount / elapsed;
    });

    // Should maintain at least 30 FPS during interactions
    expect(fps).toBeGreaterThan(30);
  });

  test('should not have memory leaks', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();

    // Force garbage collection if available
    if (await page.evaluate(() => !!(window as any).gc)) {
      await page.evaluate(() => (window as any).gc());
    }

    await page.waitForTimeout(1000);

    // Get initial memory
    const initialMemory = await page.evaluate(() => {
      const perf = performance as any;
      return perf.memory ? perf.memory.usedJSHeapSize : 0;
    });

    // Perform operations
    for (let i = 0; i < 10; i++) {
      await editorPage.addState(200 + i * 50, 300);
      await page.waitForTimeout(100);
    }

    // Delete all states
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(100);
    }

    // Force garbage collection
    if (await page.evaluate(() => !!(window as any).gc)) {
      await page.evaluate(() => (window as any).gc());
    }

    await page.waitForTimeout(1000);

    // Get final memory
    const finalMemory = await page.evaluate(() => {
      const perf = performance as any;
      return perf.memory ? perf.memory.usedJSHeapSize : 0;
    });

    // Memory increase should be less than 10MB
    const memoryIncrease = finalMemory - initialMemory;
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});
