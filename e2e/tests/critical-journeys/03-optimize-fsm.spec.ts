/**
 * Critical User Journey: Optimize FSM
 *
 * Tests the FSM optimization with different algorithms
 */
import { test, expect } from '@playwright/test';
import { HomePage, EditorPage, ImportPage, OptimizationPage, ComparisonPage } from '@page-objects';
import { trafficLightFSM, vendingMachineFSM, complexFSM } from '@fixtures/fsm-examples';

test.describe('Optimize FSM', () => {
  let homePage: HomePage;
  let editorPage: EditorPage;
  let importPage: ImportPage;
  let optimizationPage: OptimizationPage;
  let comparisonPage: ComparisonPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    editorPage = new EditorPage(page);
    importPage = new ImportPage(page);
    optimizationPage = new OptimizationPage(page);
    comparisonPage = new ComparisonPage(page);
  });

  test('should optimize FSM using greedy algorithm', async ({ page }) => {
    // Import a test FSM
    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.import();

    // Optimize with greedy algorithm
    await editorPage.selectAlgorithm('greedy');
    await editorPage.optimize();

    // Wait for optimization to complete
    await optimizationPage.expectOptimizationResultsLoaded();

    // Verify results are shown
    await optimizationPage.expectOriginalAndOptimizedVisible();
    await optimizationPage.expectMetricsCardVisible();

    // Verify algorithm used
    await optimizationPage.expectAlgorithm('greedy');

    // Take screenshot
    await optimizationPage.takeScreenshot('optimization-greedy-results');
  });

  test('should optimize FSM using BFS algorithm', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(vendingMachineFSM));
    await importPage.import();

    // Optimize with BFS algorithm
    await editorPage.selectAlgorithm('bfs');
    await editorPage.optimize();

    await optimizationPage.expectOptimizationResultsLoaded();
    await optimizationPage.expectAlgorithm('bfs');

    // Get metrics
    const metrics = await optimizationPage.getOptimizationMetrics();

    // Verify metrics are reasonable
    expect(metrics.totalStates).toBeGreaterThanOrEqual(vendingMachineFSM.states.length);
    expect(metrics.executionTime).toBeGreaterThan(0);

    // Verify execution time is reasonable (< 5 seconds for small FSM)
    await optimizationPage.expectExecutionTimeLessThan(5000);
  });

  test('should optimize FSM using global optimization algorithm', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.import();

    // Optimize with global algorithm
    await editorPage.selectAlgorithm('global');
    await editorPage.optimize();

    // Global optimization might take longer - wait appropriately
    await optimizationPage.expectOptimizationResultsLoaded();
    await optimizationPage.expectAlgorithm('global');

    // Verify optimization happened
    await optimizationPage.expectMetricsCardVisible();
  });

  test('should show dummy states in optimization results', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(complexFSM));
    await importPage.import();

    await editorPage.optimize('greedy');

    await optimizationPage.expectOptimizationResultsLoaded();

    // Complex FSM should require dummy states
    const metrics = await optimizationPage.getOptimizationMetrics();
    expect(metrics.dummyStates).toBeGreaterThan(0);

    // Verify total states = original states + dummy states
    expect(metrics.totalStates).toBe(complexFSM.states.length + metrics.dummyStates);
  });

  test('should display Gray code encoding table', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.import();

    await editorPage.optimize('greedy');

    await optimizationPage.expectOptimizationResultsLoaded();
    await optimizationPage.expectEncodingTableVisible();

    // Get encodings and verify they are Gray codes
    const encodings = await optimizationPage.getEncodingFromTable();

    // Verify all states have encodings
    expect(encodings.size).toBeGreaterThan(0);

    // Verify encodings are binary strings
    for (const [state, encoding] of encodings.entries()) {
      expect(encoding).toMatch(/^[01]+$/);
      expect(state).toBeTruthy();
    }
  });

  test('should show hypercube visualization', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.import();

    await editorPage.optimize('greedy');

    await optimizationPage.expectOptimizationResultsLoaded();

    // Toggle hypercube view
    await optimizationPage.toggleHypercubeView();
    await optimizationPage.expectHypercubeVisible();

    // Take screenshot
    await optimizationPage.takeScreenshot('hypercube-visualization');
  });

  test('should allow playing optimization animation', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(vendingMachineFSM));
    await importPage.import();

    await editorPage.optimize('greedy');

    await optimizationPage.expectOptimizationResultsLoaded();

    // Play animation
    await optimizationPage.playOptimizationAnimation();

    // Wait a bit for animation to play
    await page.waitForTimeout(2000);

    // Pause animation
    await optimizationPage.pauseOptimizationAnimation();

    // Adjust speed
    await optimizationPage.setAnimationSpeed(2);
  });

  test('should navigate to algorithm comparison', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.import();

    await editorPage.optimize('greedy');

    await optimizationPage.expectOptimizationResultsLoaded();

    // Navigate to comparison
    await optimizationPage.goToComparison();

    // Verify on comparison page
    await comparisonPage.expectComparisonLoaded();
  });

  test('should handle optimization of FSM with no problematic transitions', async ({ page }) => {
    // FSM already optimally encoded
    const optimalFSM = {
      type: 'moore',
      states: ['S0', 'S1'],
      initial_state: 'S0',
      transitions: [
        { from_state: 'S0', to_state: 'S1', input: '0' },
        { from_state: 'S1', to_state: 'S0', input: '1' },
      ],
      outputs: {
        S0: '0',
        S1: '1',
      },
    };

    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(optimalFSM));
    await importPage.import();

    await editorPage.optimize('greedy');

    await optimizationPage.expectOptimizationResultsLoaded();

    // Should have 0 dummy states
    const metrics = await optimizationPage.getOptimizationMetrics();
    expect(metrics.dummyStates).toBe(0);
  });

  test('should compare multiple optimization algorithms', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(complexFSM));
    await importPage.import();

    await editorPage.optimize('greedy');
    await optimizationPage.goToComparison();

    await comparisonPage.expectComparisonLoaded();

    // Check greedy results
    await comparisonPage.selectAlgorithm('greedy');
    const greedyMetrics = await comparisonPage.getMetrics();

    // Check BFS results
    await comparisonPage.selectAlgorithm('bfs');
    const bfsMetrics = await comparisonPage.getMetrics();

    // Check global results
    await comparisonPage.selectAlgorithm('global');
    const globalMetrics = await comparisonPage.getMetrics();

    // Verify all algorithms produced results
    expect(greedyMetrics.totalStates).toBeGreaterThan(0);
    expect(bfsMetrics.totalStates).toBeGreaterThan(0);
    expect(globalMetrics.totalStates).toBeGreaterThan(0);

    // Global should generally be equal or better than greedy
    expect(globalMetrics.dummyStates).toBeLessThanOrEqual(greedyMetrics.dummyStates);
  });

  test('should show loading indicator during optimization', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(complexFSM));
    await importPage.import();

    // Click optimize
    await editorPage.optimize('global');

    // Should show loading spinner
    await expect(editorPage.loadingSpinner).toBeVisible();

    // Wait for completion
    await optimizationPage.expectOptimizationResultsLoaded();

    // Loading should be hidden
    await expect(editorPage.loadingSpinner).not.toBeVisible();
  });

  test('should optimize large FSM within reasonable time', async ({ page }) => {
    // Large FSM with 32 states
    const largeFSM = {
      type: 'moore',
      states: Array.from({ length: 32 }, (_, i) => `S${i}`),
      initial_state: 'S0',
      transitions: Array.from({ length: 32 }, (_, i) => ({
        from_state: `S${i}`,
        to_state: `S${(i + 1) % 32}`,
        input: `${i % 2}`,
      })),
      outputs: Object.fromEntries(
        Array.from({ length: 32 }, (_, i) => [`S${i}`, i.toString(2).padStart(5, '0')])
      ),
    };

    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(largeFSM));
    await importPage.import();

    const startTime = Date.now();

    // Use greedy for faster optimization of large FSM
    await editorPage.optimize('greedy');

    await optimizationPage.expectOptimizationResultsLoaded();

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should complete within 10 seconds
    expect(totalTime).toBeLessThan(10000);
  });
});
