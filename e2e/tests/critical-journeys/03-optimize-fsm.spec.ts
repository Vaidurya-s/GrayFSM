/**
 * Critical User Journey: Optimize FSM
 *
 * Tests the FSM optimization workflow at /optimize/:id.
 * All tests in this file require a running backend because:
 *   - The page fetches the FSM by id on mount.
 *   - Submitting the OptimizationForm calls POST /api/v1/algorithms/optimize/:id.
 *
 * Set BACKEND_URL and TEST_FSM_ID environment variables to run these tests:
 *   BACKEND_URL=http://localhost:8000 TEST_FSM_ID=<uuid> npx playwright test 03-optimize-fsm
 */
import { test, expect } from '@playwright/test';
import { OptimizationPage } from '@page-objects';

// A pre-seeded FSM id must be provided via the environment.
// When absent, all tests in this file are skipped.
const TEST_FSM_ID = process.env.TEST_FSM_ID ?? '';
const BACKEND_AVAILABLE = !!process.env.BACKEND_URL && !!TEST_FSM_ID;

test.describe('Optimize FSM', () => {
  let optimizationPage: OptimizationPage;

  test.beforeEach(async ({ page }) => {
    test.skip(!BACKEND_AVAILABLE, 'Requires BACKEND_URL and TEST_FSM_ID env vars');
    optimizationPage = new OptimizationPage(page);
    await optimizationPage.goToOptimizationPage(TEST_FSM_ID);
  });

  test('should load the optimization page for an existing FSM', async () => {
    await optimizationPage.expectOptimizationPageLoaded();
  });

  test('should show the optimization form with algorithm selector', async () => {
    await optimizationPage.expectFormVisible();
    await expect(optimizationPage.algorithmSelect).toBeVisible();
    await expect(optimizationPage.timeoutInput).toBeVisible();
    await expect(optimizationPage.submitButton).toBeVisible();
  });

  test('should show FSM canvas on the optimization page', async () => {
    await expect(optimizationPage.fsmCanvas).toBeVisible();
  });

  test('should optimize FSM using the greedy algorithm', async () => {
    await optimizationPage.selectAlgorithm('greedy');
    await optimizationPage.runOptimization();

    // After a successful run the original/optimized toggle tabs appear
    await optimizationPage.expectResultsVisible();
  });

  test('should optimize FSM using the bfs_optimal algorithm', async () => {
    await optimizationPage.selectAlgorithm('bfs_optimal');
    await optimizationPage.runOptimization();

    await optimizationPage.expectResultsVisible();
  });

  test('should show Original and Optimized toggle tabs after optimization', async () => {
    await optimizationPage.selectAlgorithm('greedy');
    await optimizationPage.runOptimization();

    await expect(optimizationPage.viewOriginalButton).toBeVisible();
    await expect(optimizationPage.viewOptimizedButton).toBeVisible();
  });

  test('should switch between original and optimized canvas views', async () => {
    await optimizationPage.selectAlgorithm('greedy');
    await optimizationPage.runOptimization();

    // Switch to optimized view
    await optimizationPage.viewOptimized();

    // Switch back to original view
    await optimizationPage.viewOriginal();

    // Both buttons remain visible — no assertion error expected
    await expect(optimizationPage.viewOriginalButton).toBeVisible();
  });

  test('should show export link in results section', async () => {
    await optimizationPage.selectAlgorithm('greedy');
    await optimizationPage.runOptimization();

    await optimizationPage.expectExportLinkVisible();
    await optimizationPage.expectExportLinkHref(TEST_FSM_ID);
  });

  test('should navigate to export page via export link', async ({ page }) => {
    await optimizationPage.selectAlgorithm('greedy');
    await optimizationPage.runOptimization();

    await optimizationPage.exportLink.click();
    await expect(page).toHaveURL(new RegExp(`/export/${TEST_FSM_ID}`));
  });

  test('should allow changing algorithm timeout', async () => {
    await optimizationPage.setTimeout(5000);
    const value = await optimizationPage.timeoutInput.inputValue();
    expect(value).toBe('5000');
  });

  test('should show advanced options when global_sa algorithm is selected', async () => {
    await optimizationPage.selectAlgorithm('global_sa');

    // Advanced option inputs should appear
    await expect(optimizationPage.temperatureInput).toBeVisible();
    await expect(optimizationPage.coolingRateInput).toBeVisible();
    await expect(optimizationPage.iterationsInput).toBeVisible();
  });

  test('should hide advanced options for non-SA algorithms', async () => {
    await optimizationPage.selectAlgorithm('greedy');

    await expect(optimizationPage.temperatureInput).not.toBeVisible();
    await expect(optimizationPage.coolingRateInput).not.toBeVisible();
  });

  test('should take screenshot of optimization results', async () => {
    await optimizationPage.selectAlgorithm('greedy');
    await optimizationPage.runOptimization();

    await optimizationPage.takeScreenshot('optimization-greedy-results');
  });
});
