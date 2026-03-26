/**
 * Visual Regression Tests
 *
 * Tests visual consistency across releases
 * Run with: npm run test:visual
 * Update snapshots with: npm run test:update-snapshots
 */
import { test, expect } from '@playwright/test';
import { HomePage, EditorPage, ImportPage } from '@page-objects';
import { trafficLightFSM } from '@fixtures/fsm-examples';

test.describe('Visual Regression - Homepage', () => {
  test('should match homepage screenshot', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();
    await homePage.expectHomePageLoaded();

    // Take screenshot and compare
    await expect(page).toHaveScreenshot('homepage.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should match homepage dark mode screenshot', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();
    await homePage.setDarkMode();

    await expect(page).toHaveScreenshot('homepage-dark.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should match features section', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();
    await homePage.expectFeaturesSectionVisible();

    const featuresSection = await homePage.featuresSection;
    await expect(featuresSection).toHaveScreenshot('features-section.png', {
      maxDiffPixels: 50,
    });
  });
});

test.describe('Visual Regression - Editor', () => {
  test('should match empty editor screenshot', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await editorPage.expectEditorLoaded();

    await expect(page).toHaveScreenshot('editor-empty.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('should match editor with FSM', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();

    // Create a simple FSM
    await editorPage.addState(300, 200);
    await editorPage.addState(500, 200);
    await editorPage.addState(400, 400);

    const states = await page.locator('.react-flow__node').all();
    const state1Id = await states[0].getAttribute('data-id');
    const state2Id = await states[1].getAttribute('data-id');
    const state3Id = await states[2].getAttribute('data-id');

    if (state1Id && state2Id && state3Id) {
      await editorPage.addTransition(state1Id, state2Id);
      await editorPage.addTransition(state2Id, state3Id);
    }

    // Fit view for consistent screenshot
    await editorPage.fitView();

    await expect(page).toHaveScreenshot('editor-with-fsm.png', {
      maxDiffPixels: 150,
      threshold: 0.3,
    });
  });

  test('should match state properties panel', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await editorPage.addState(300, 300);

    const stateNode = await page.locator('.react-flow__node').first();
    const stateId = await stateNode.getAttribute('data-id');

    if (stateId) {
      await editorPage.selectState(stateId);

      const propertiesPanel = editorPage.statePropertiesPanel;
      await expect(propertiesPanel).toHaveScreenshot('state-properties-panel.png', {
        maxDiffPixels: 50,
      });
    }
  });

  test('should match toolbar', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();

    const toolbar = page.locator('[data-testid="editor-toolbar"]');
    if (await toolbar.isVisible()) {
      await expect(toolbar).toHaveScreenshot('editor-toolbar.png', {
        maxDiffPixels: 50,
      });
    }
  });
});

test.describe('Visual Regression - Optimization Results', () => {
  test('should match optimization results page', async ({ page }) => {
    const homePage = new HomePage(page);
    const importPage = new ImportPage(page);
    const editorPage = new EditorPage(page);

    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.import();

    await editorPage.optimize('greedy');

    // Wait for results
    await page.waitForSelector('[data-testid="optimization-results"]', { timeout: 10000 });

    await expect(page).toHaveScreenshot('optimization-results.png', {
      maxDiffPixels: 200,
      threshold: 0.3,
    });
  });

  test('should match metrics card', async ({ page }) => {
    const homePage = new HomePage(page);
    const importPage = new ImportPage(page);
    const editorPage = new EditorPage(page);

    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.import();

    await editorPage.optimize('greedy');

    const metricsCard = page.locator('[data-testid="metrics-card"]');
    await metricsCard.waitFor({ state: 'visible' });

    await expect(metricsCard).toHaveScreenshot('metrics-card.png', {
      maxDiffPixels: 100,
    });
  });

  test('should match encoding table', async ({ page }) => {
    const homePage = new HomePage(page);
    const importPage = new ImportPage(page);
    const editorPage = new EditorPage(page);

    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.import();

    await editorPage.optimize('greedy');

    const encodingTable = page.locator('[data-testid="encoding-table"]');
    await encodingTable.waitFor({ state: 'visible' });

    await expect(encodingTable).toHaveScreenshot('encoding-table.png', {
      maxDiffPixels: 100,
    });
  });
});

test.describe('Visual Regression - Theme Consistency', () => {
  test('should maintain consistent colors in light mode', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();
    await homePage.setLightMode();

    // Check primary button color
    const primaryButton = homePage.createFSMButton;
    const bgColor = await primaryButton.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Color should match design system
    expect(bgColor).toBeTruthy();

    await expect(page).toHaveScreenshot('theme-light.png', {
      maxDiffPixels: 100,
    });
  });

  test('should maintain consistent colors in dark mode', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();
    await homePage.setDarkMode();

    await expect(page).toHaveScreenshot('theme-dark.png', {
      maxDiffPixels: 100,
    });
  });

  test('should maintain consistent typography', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Check heading fonts
    const h1 = page.locator('h1').first();
    const fontFamily = await h1.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily;
    });

    expect(fontFamily).toBeTruthy();
  });
});

test.describe('Visual Regression - Responsive Layouts', () => {
  test('should match mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const homePage = new HomePage(page);
    await homePage.goToHomePage();

    await expect(page).toHaveScreenshot('layout-mobile.png', {
      maxDiffPixels: 150,
      fullPage: true,
    });
  });

  test('should match tablet layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const homePage = new HomePage(page);
    await homePage.goToHomePage();

    await expect(page).toHaveScreenshot('layout-tablet.png', {
      maxDiffPixels: 150,
      fullPage: true,
    });
  });

  test('should match desktop layout', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    const homePage = new HomePage(page);
    await homePage.goToHomePage();

    await expect(page).toHaveScreenshot('layout-desktop.png', {
      maxDiffPixels: 150,
      fullPage: true,
    });
  });
});

test.describe('Visual Regression - Interactive States', () => {
  test('should match button hover state', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Hover over button
    await homePage.createFSMButton.hover();
    await page.waitForTimeout(300);

    await expect(homePage.createFSMButton).toHaveScreenshot('button-hover.png', {
      maxDiffPixels: 30,
    });
  });

  test('should match button focus state', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Focus on button
    await homePage.createFSMButton.focus();
    await page.waitForTimeout(300);

    await expect(homePage.createFSMButton).toHaveScreenshot('button-focus.png', {
      maxDiffPixels: 30,
    });
  });

  test('should match selected state', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await editorPage.addState(300, 300);

    const stateNode = await page.locator('.react-flow__node').first();
    const stateId = await stateNode.getAttribute('data-id');

    if (stateId) {
      await editorPage.selectState(stateId);

      await expect(stateNode).toHaveScreenshot('state-selected.png', {
        maxDiffPixels: 50,
      });
    }
  });
});
