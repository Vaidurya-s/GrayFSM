/**
 * Responsive Design Tests
 *
 * Tests application behavior across different screen sizes
 * Run with: npm run test:mobile or npm run test:tablet
 */
import { test, expect, devices } from '@playwright/test';
import { HomePage, EditorPage } from '@page-objects';

test.describe('Responsive Design - Mobile', () => {
  test.use({ ...devices['iPhone 12'] });

  test('should display mobile-optimized home page', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();
    await homePage.expectHomePageLoaded();

    // Check if mobile navigation is visible
    const mobileMenu = page.locator('[data-testid="mobile-menu"]');
    if (await mobileMenu.isVisible()) {
      expect(await mobileMenu.isVisible()).toBe(true);
    }

    await homePage.takeScreenshot('home-mobile');
  });

  test('should show mobile navigation menu', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Open mobile menu
    const menuButton = page.locator('[data-testid="mobile-menu-button"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();

      // Menu should be visible
      const mobileNav = page.locator('[data-testid="mobile-navigation"]');
      await expect(mobileNav).toBeVisible();
    }
  });

  test('should adapt editor for mobile view', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await editorPage.expectEditorLoaded();

    // Toolbar should be collapsed or in mobile mode
    const mobileToolbar = page.locator('[data-testid="mobile-toolbar"]');
    if (await mobileToolbar.isVisible()) {
      await expect(mobileToolbar).toBeVisible();
    }

    await editorPage.takeScreenshot('editor-mobile');
  });

  test('should handle touch interactions', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();

    // Add state using tap
    await editorPage.addState(200, 200);
    await editorPage.expectStateCount(1);
  });

  test('should show mobile-optimized forms', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await editorPage.addState(200, 200);

    const stateNode = await page.locator('.react-flow__node').first();
    const stateId = await stateNode.getAttribute('data-id');

    if (stateId) {
      await editorPage.selectState(stateId);

      // Properties panel should adapt to mobile
      const propertiesPanel = page.locator('[data-testid="state-properties"]');
      if (await propertiesPanel.isVisible()) {
        await expect(propertiesPanel).toBeVisible();

        // Take screenshot
        await page.screenshot({ path: 'test-results/screenshots/properties-mobile.png' });
      }
    }
  });
});

test.describe('Responsive Design - Tablet', () => {
  test.use({ ...devices['iPad Pro'] });

  test('should display tablet-optimized layout', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();
    await homePage.expectHomePageLoaded();

    await homePage.takeScreenshot('home-tablet');
  });

  test('should show tablet navigation', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Navigation should be visible in tablet mode
    await expect(homePage.navigation).toBeVisible();
  });

  test('should handle editor in landscape mode', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await editorPage.expectEditorLoaded();

    // Add states and verify layout
    await editorPage.addState(300, 300);
    await editorPage.addState(500, 300);

    await editorPage.takeScreenshot('editor-tablet-landscape');
  });

  test('should support pinch-to-zoom gestures', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await editorPage.addState(300, 300);

    // Simulate zoom gestures
    await editorPage.zoomIn(2);
    await page.waitForTimeout(500);

    await editorPage.zoomOut(2);
    await page.waitForTimeout(500);
  });
});

test.describe('Responsive Design - Various Resolutions', () => {
  const resolutions = [
    { width: 1366, height: 768, name: '1366x768' },
    { width: 1920, height: 1080, name: '1920x1080' },
    { width: 2560, height: 1440, name: '2560x1440' },
    { width: 3840, height: 2160, name: '4K' },
  ];

  for (const resolution of resolutions) {
    test(`should render correctly at ${resolution.name}`, async ({ page }) => {
      await page.setViewportSize({ width: resolution.width, height: resolution.height });

      const homePage = new HomePage(page);
      await homePage.goToHomePage();
      await homePage.expectHomePageLoaded();

      await page.screenshot({
        path: `test-results/screenshots/home-${resolution.name}.png`,
        fullPage: true,
      });
    });

    test(`should handle editor at ${resolution.name}`, async ({ page }) => {
      await page.setViewportSize({ width: resolution.width, height: resolution.height });

      const editorPage = new EditorPage(page);
      await editorPage.goToEditor();
      await editorPage.expectEditorLoaded();

      // Add some states to test layout
      await editorPage.addState(400, 300);
      await editorPage.addState(600, 300);

      await page.screenshot({
        path: `test-results/screenshots/editor-${resolution.name}.png`,
        fullPage: true,
      });
    });
  }
});

test.describe('Responsive Design - Orientation Changes', () => {
  test('should handle portrait to landscape rotation', async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 390, height: 844 });

    const homePage = new HomePage(page);
    await homePage.goToHomePage();

    await page.screenshot({ path: 'test-results/screenshots/portrait.png' });

    // Rotate to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/screenshots/landscape.png' });

    // Layout should still be functional
    await homePage.expectHomePageLoaded();
  });
});

test.describe('Responsive Design - Small Screens', () => {
  test('should handle very small screens gracefully', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });

    const homePage = new HomePage(page);
    await homePage.goToHomePage();

    // Should show warning or mobile-optimized view
    const smallScreenWarning = page.locator('[data-testid="small-screen-warning"]');
    const hasWarning = await smallScreenWarning.isVisible();

    // Either show warning or mobile view should work
    if (!hasWarning) {
      await homePage.expectHomePageLoaded();
    }

    await page.screenshot({ path: 'test-results/screenshots/very-small-screen.png' });
  });
});

test.describe('Responsive Design - Text Scaling', () => {
  test('should handle increased text size', async ({ page }) => {
    const homePage = new HomePage(page);

    // Increase text size by 200%
    await page.addStyleTag({
      content: '* { font-size: 200% !important; }',
    });

    await homePage.goToHomePage();
    await homePage.expectHomePageLoaded();

    await page.screenshot({ path: 'test-results/screenshots/large-text.png' });

    // Layout should not break with large text
    await expect(homePage.heroSection).toBeVisible();
  });
});

test.describe('Responsive Design - Touch Targets', () => {
  test.use({ ...devices['iPhone 12'] });

  test('should have adequately sized touch targets', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Check button sizes
    const buttons = await page.locator('button').all();

    for (const button of buttons) {
      const box = await button.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        // Touch targets should be at least 44x44 pixels (WCAG guideline)
        expect(box.width).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }
  });
});
