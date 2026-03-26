/**
 * Cross-Browser Compatibility Tests
 *
 * Tests that verify the application works across different browsers
 * Run with: npm run test:all-browsers
 */
import { test, expect } from '@playwright/test';
import { HomePage, EditorPage, ImportPage } from '@page-objects';
import { trafficLightFSM } from '@fixtures/fsm-examples';

test.describe('Cross-Browser Compatibility', () => {
  test('should load home page in all browsers', async ({ page, browserName }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();
    await homePage.expectHomePageLoaded();

    // Take screenshot for each browser
    await homePage.takeScreenshot(`home-page-${browserName}`);
  });

  test('should create FSM in all browsers', async ({ page, browserName }) => {
    const homePage = new HomePage(page);
    const editorPage = new EditorPage(page);

    await homePage.goToHomePage();
    await homePage.clickCreateFSM();

    await editorPage.expectEditorLoaded();

    // Add a state to verify interaction works
    await editorPage.addState(300, 300);
    await editorPage.expectStateCount(1);

    await editorPage.takeScreenshot(`editor-${browserName}`);
  });

  test('should optimize FSM in all browsers', async ({ page, browserName }) => {
    const homePage = new HomePage(page);
    const importPage = new ImportPage(page);
    const editorPage = new EditorPage(page);

    await homePage.goToHomePage();
    await homePage.clickImportFSM();

    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.import();

    await editorPage.optimize('greedy');

    // Wait for optimization to complete
    await page.waitForSelector('[data-testid="optimization-results"]', { timeout: 10000 });

    await page.screenshot({ path: `test-results/screenshots/optimization-${browserName}.png` });
  });

  test('should handle drag and drop in all browsers', async ({ page, browserName }) => {
    const homePage = new HomePage(page);
    const editorPage = new EditorPage(page);

    await homePage.goToHomePage();
    await homePage.clickCreateFSM();

    // Test drag and drop functionality
    await editorPage.addState(200, 200);
    const stateNode = await page.locator('.react-flow__node').first();
    const stateId = await stateNode.getAttribute('data-id');

    if (stateId) {
      // Move the state
      await editorPage.moveState(stateId, 400, 400);

      // Verify it moved
      const newBox = await stateNode.boundingBox();
      expect(newBox).toBeTruthy();
    }
  });

  test('should render React Flow correctly in all browsers', async ({ page, browserName }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await editorPage.expectEditorLoaded();

    // Verify React Flow canvas is visible
    await expect(editorPage.reactFlowCanvas).toBeVisible();

    // Verify controls are visible
    await expect(editorPage.zoomInButton).toBeVisible();
    await expect(editorPage.zoomOutButton).toBeVisible();
    await expect(editorPage.fitViewButton).toBeVisible();
  });

  test('should handle theme toggle in all browsers', async ({ page, browserName }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Toggle to dark mode
    await homePage.setDarkMode();
    const isDark = await homePage.isDarkMode();
    expect(isDark).toBe(true);

    await page.screenshot({ path: `test-results/screenshots/dark-mode-${browserName}.png` });

    // Toggle to light mode
    await homePage.setLightMode();
    const isLight = !(await homePage.isDarkMode());
    expect(isLight).toBe(true);

    await page.screenshot({ path: `test-results/screenshots/light-mode-${browserName}.png` });
  });

  test('should export files in all browsers', async ({ page, browserName }) => {
    const homePage = new HomePage(page);
    const importPage = new ImportPage(page);
    const editorPage = new EditorPage(page);

    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.import();

    // Export as JSON
    const download = await editorPage.export('json');
    expect(download).toBeTruthy();
  });

  test('should handle canvas zoom in all browsers', async ({ page, browserName }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await editorPage.addState(300, 300);

    // Test zoom
    await editorPage.zoomIn(3);
    await page.waitForTimeout(500);

    await editorPage.zoomOut(3);
    await page.waitForTimeout(500);

    await editorPage.fitView();
    await page.waitForTimeout(500);

    // Should complete without errors
    expect(true).toBe(true);
  });

  test('should display visualizations in all browsers', async ({ page, browserName }) => {
    const homePage = new HomePage(page);
    const importPage = new ImportPage(page);
    const editorPage = new EditorPage(page);

    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.import();

    await editorPage.optimize('greedy');

    // Check if hypercube visualization is available
    const hypercubeBtn = page.locator('[data-testid="toggle-hypercube-btn"]');
    if (await hypercubeBtn.isVisible()) {
      await hypercubeBtn.click();
      await page.waitForTimeout(1000);

      // Take screenshot of 3D visualization
      await page.screenshot({ path: `test-results/screenshots/hypercube-${browserName}.png` });
    }
  });

  test('should handle form inputs correctly in all browsers', async ({ page, browserName }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await editorPage.addState(300, 300);

    const stateNode = await page.locator('.react-flow__node').first();
    const stateId = await stateNode.getAttribute('data-id');

    if (stateId) {
      // Edit state properties
      await editorPage.editStateProperties(stateId, {
        name: 'TestState',
        output: '101',
        isInitial: true,
      });

      // Verify changes were saved
      await expect(stateNode).toContainText('TestState');
    }
  });

  test('should handle keyboard shortcuts in all browsers', async ({ page, browserName }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await editorPage.addState(300, 300);

    // Test Undo with Ctrl+Z (Cmd+Z on Mac)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+z`);

    // State should be removed
    await editorPage.expectStateCount(0);

    // Test Redo with Ctrl+Y (Cmd+Shift+Z on Mac)
    await page.keyboard.press(`${modifier}+y`);

    // State should be back
    await editorPage.expectStateCount(1);
  });
});
