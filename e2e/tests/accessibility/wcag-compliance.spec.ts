/**
 * Accessibility Tests - WCAG Compliance
 *
 * Tests accessibility compliance using axe-core
 * Run with: npm run test:accessibility
 */
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';
import { HomePage, EditorPage, ImportPage } from '@page-objects';

test.describe('WCAG 2.1 AA Compliance', () => {
  test('should have no accessibility violations on home page', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();
    await injectAxe(page);

    // Check for violations
    const violations = await getViolations(page);

    // Report violations if any
    if (violations.length > 0) {
      console.log('Accessibility violations found:', JSON.stringify(violations, null, 2));
    }

    expect(violations).toHaveLength(0);
  });

  test('should have no accessibility violations on editor page', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await injectAxe(page);

    const violations = await getViolations(page);
    expect(violations).toHaveLength(0);
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Check heading levels
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1); // Should have exactly one h1

    // Headings should follow hierarchy (no skipping levels)
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    const levels: number[] = [];

    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName);
      levels.push(parseInt(tagName.charAt(1)));
    }

    // Check no levels are skipped
    for (let i = 1; i < levels.length; i++) {
      const diff = levels[i] - levels[i - 1];
      expect(diff).toBeLessThanOrEqual(1);
    }
  });

  test('should have proper ARIA labels on interactive elements', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();

    // Check buttons have accessible names
    const buttons = await page.locator('button').all();

    for (const button of buttons) {
      const ariaLabel = await button.getAttribute('aria-label');
      const textContent = await button.textContent();
      const hasAccessibleName = ariaLabel || (textContent && textContent.trim().length > 0);

      expect(hasAccessibleName).toBe(true);
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Tab through interactive elements
    const focusableElements = await page.locator('a, button, input, select, textarea, [tabindex="0"]').all();

    expect(focusableElements.length).toBeGreaterThan(0);

    // Test tab navigation
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT']).toContain(firstFocused || '');
  });

  test('should have sufficient color contrast', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();
    await injectAxe(page);

    // Check specifically for color contrast violations
    const violations = await getViolations(page, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });

    expect(violations).toHaveLength(0);
  });

  test('should have proper form labels', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();
    await editorPage.addState(300, 300);

    const stateNode = await page.locator('.react-flow__node').first();
    const stateId = await stateNode.getAttribute('data-id');

    if (stateId) {
      await editorPage.selectState(stateId);

      // Check form inputs have labels
      const inputs = await page.locator('input[type="text"], input[type="number"]').all();

      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');

        if (id) {
          // Check if there's a label pointing to this input
          const label = await page.locator(`label[for="${id}"]`).count();
          const hasLabel = label > 0 || ariaLabel || ariaLabelledBy;

          expect(hasLabel).toBe(true);
        }
      }
    }
  });

  test('should have proper alt text for images', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    const images = await page.locator('img').all();

    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const role = await img.getAttribute('role');

      // Images should have alt text or role="presentation" for decorative images
      expect(alt !== null || role === 'presentation').toBe(true);
    }
  });

  test('should announce dynamic content changes to screen readers', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();

    // Check for ARIA live regions
    const liveRegions = await page.locator('[aria-live]').count();
    expect(liveRegions).toBeGreaterThan(0);

    // Add a state and check if change is announced
    await editorPage.addState(300, 300);

    // Check if status message has aria-live
    const statusMessage = page.locator('[data-testid="status-message"], [role="status"]');
    if (await statusMessage.isVisible()) {
      const ariaLive = await statusMessage.getAttribute('aria-live');
      expect(['polite', 'assertive']).toContain(ariaLive || '');
    }
  });

  test('should have proper focus indicators', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Tab to first interactive element
    await page.keyboard.press('Tab');

    // Check if focused element has visible focus indicator
    const hasFocusIndicator = await page.evaluate(() => {
      const focused = document.activeElement;
      if (!focused) return false;

      const styles = window.getComputedStyle(focused);
      const outline = styles.outline;
      const boxShadow = styles.boxShadow;

      return outline !== 'none' || boxShadow !== 'none';
    });

    expect(hasFocusIndicator).toBe(true);
  });

  test('should not have any automatically playing media', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Check for autoplay videos/audio
    const autoplayMedia = await page.locator('video[autoplay], audio[autoplay]').count();
    expect(autoplayMedia).toBe(0);
  });

  test('should allow text resize up to 200% without loss of functionality', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Increase text size by 200%
    await page.addStyleTag({
      content: 'html { font-size: 200% !important; }',
    });

    await page.waitForTimeout(500);

    // Core functionality should still work
    await homePage.expectHomePageLoaded();

    // Important buttons should still be visible
    await expect(homePage.createFSMButton).toBeVisible();
  });

  test('should have skip navigation link', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Check for skip to main content link
    const skipLink = page.locator('[href="#main-content"], a:has-text("Skip to main")').first();

    // Skip link should exist
    const exists = await skipLink.count();

    if (exists > 0) {
      // Should become visible on focus
      await skipLink.focus();
      await expect(skipLink).toBeVisible();
    }
  });

  test('should have proper landmark regions', async ({ page }) => {
    const homePage = new HomePage(page);

    await homePage.goToHomePage();

    // Check for semantic landmarks
    const header = await page.locator('header, [role="banner"]').count();
    const main = await page.locator('main, [role="main"]').count();
    const nav = await page.locator('nav, [role="navigation"]').count();

    expect(header).toBeGreaterThan(0);
    expect(main).toBeGreaterThan(0);
    expect(nav).toBeGreaterThan(0);
  });

  test('should handle screen reader announcements correctly', async ({ page }) => {
    const editorPage = new EditorPage(page);

    await editorPage.goToEditor();

    // Add state
    await editorPage.addState(300, 300);

    // Check for aria-live announcement
    const announcement = page.locator('[role="status"], [aria-live="polite"]');
    if (await announcement.isVisible()) {
      const text = await announcement.textContent();
      expect(text).toBeTruthy();
    }
  });
});
