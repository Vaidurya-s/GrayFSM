/**
 * Helper utilities for E2E tests
 */
import { Page, expect } from '@playwright/test';

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for element to be visible and ready
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options?: { timeout?: number; state?: 'visible' | 'hidden' | 'attached' }
): Promise<void> {
  await page.waitForSelector(selector, {
    timeout: options?.timeout || 10000,
    state: options?.state || 'visible',
  });
}

/**
 * Take a full page screenshot with timestamp
 */
export async function takeFullPageScreenshot(
  page: Page,
  name: string
): Promise<Buffer> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;

  return await page.screenshot({
    path: `test-results/screenshots/${filename}`,
    fullPage: true,
  });
}

/**
 * Get Core Web Vitals metrics
 */
export async function getCoreWebVitals(page: Page): Promise<{
  LCP: number | null;
  FCP: number | null;
  CLS: number | null;
  FID: number | null;
  TTFB: number | null;
}> {
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const webVitals = {
          LCP: null as number | null,
          FCP: null as number | null,
          CLS: null as number | null,
          FID: null as number | null,
          TTFB: null as number | null,
        };

        entries.forEach((entry: any) => {
          if (entry.entryType === 'largest-contentful-paint') {
            webVitals.LCP = entry.renderTime || entry.loadTime;
          }
          if (entry.entryType === 'first-contentful-paint') {
            webVitals.FCP = entry.startTime;
          }
          if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
            webVitals.CLS = (webVitals.CLS || 0) + entry.value;
          }
          if (entry.entryType === 'first-input') {
            webVitals.FID = entry.processingStart - entry.startTime;
          }
        });

        // Get TTFB from navigation timing
        const navEntry = performance.getEntriesByType('navigation')[0] as any;
        if (navEntry) {
          webVitals.TTFB = navEntry.responseStart - navEntry.requestStart;
        }

        resolve(webVitals);
      });

      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-contentful-paint', 'layout-shift', 'first-input'] });

      // Resolve after 5 seconds if no metrics
      setTimeout(() => resolve({
        LCP: null,
        FCP: null,
        CLS: null,
        FID: null,
        TTFB: null,
      }), 5000);
    });
  });

  return metrics;
}

/**
 * Check performance metrics against thresholds
 */
export async function checkPerformanceThresholds(
  page: Page,
  thresholds: {
    LCP?: number;
    FCP?: number;
    CLS?: number;
    FID?: number;
    TTFB?: number;
  }
): Promise<void> {
  const metrics = await getCoreWebVitals(page);

  if (thresholds.LCP && metrics.LCP) {
    expect(metrics.LCP).toBeLessThan(thresholds.LCP);
  }
  if (thresholds.FCP && metrics.FCP) {
    expect(metrics.FCP).toBeLessThan(thresholds.FCP);
  }
  if (thresholds.CLS && metrics.CLS) {
    expect(metrics.CLS).toBeLessThan(thresholds.CLS);
  }
  if (thresholds.FID && metrics.FID) {
    expect(metrics.FID).toBeLessThan(thresholds.FID);
  }
  if (thresholds.TTFB && metrics.TTFB) {
    expect(metrics.TTFB).toBeLessThan(thresholds.TTFB);
  }
}

/**
 * Clear browser storage
 */
export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Mock API response
 */
export async function mockAPIResponse(
  page: Page,
  url: string,
  response: any,
  status = 200
): Promise<void> {
  await page.route(url, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Wait for API call to complete
 */
export async function waitForAPICall(
  page: Page,
  urlPattern: string | RegExp
): Promise<void> {
  await page.waitForResponse((response) => {
    const url = response.url();
    if (typeof urlPattern === 'string') {
      return url.includes(urlPattern);
    }
    return urlPattern.test(url);
  });
}

/**
 * Simulate slow network
 */
export async function simulateSlowNetwork(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (500 * 1024) / 8, // 500kb/s
    uploadThroughput: (500 * 1024) / 8,
    latency: 400, // 400ms
  });
}

/**
 * Check for console errors
 */
export async function checkConsoleErrors(page: Page, allowedErrors: string[] = []): Promise<void> {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const isAllowed = allowedErrors.some((allowed) => text.includes(allowed));
      if (!isAllowed) {
        errors.push(text);
      }
    }
  });

  page.on('pageerror', (error) => {
    const text = error.message;
    const isAllowed = allowedErrors.some((allowed) => text.includes(allowed));
    if (!isAllowed) {
      errors.push(text);
    }
  });

  // Check for errors after a delay
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
}

/**
 * Get memory usage
 */
export async function getMemoryUsage(page: Page): Promise<{
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}> {
  return await page.evaluate(() => {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  });
}

/**
 * Detect memory leaks by comparing memory before and after operations
 */
export async function detectMemoryLeak(
  page: Page,
  operation: () => Promise<void>,
  threshold = 10 * 1024 * 1024 // 10MB
): Promise<void> {
  // Force garbage collection if available
  await page.evaluate(() => {
    if ((window as any).gc) {
      (window as any).gc();
    }
  });

  await page.waitForTimeout(1000);
  const memoryBefore = await getMemoryUsage(page);

  await operation();

  // Force garbage collection
  await page.evaluate(() => {
    if ((window as any).gc) {
      (window as any).gc();
    }
  });

  await page.waitForTimeout(1000);
  const memoryAfter = await getMemoryUsage(page);

  const memoryIncrease = memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize;

  expect(memoryIncrease).toBeLessThan(threshold);
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000 } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }

  throw new Error('Retry failed');
}
