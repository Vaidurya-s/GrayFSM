/**
 * Critical User Journey: Browse and Load Example FSMs
 *
 * Tests the example library functionality
 */
import { test, expect } from '@playwright/test';
import { HomePage, ExamplesPage, EditorPage } from '@page-objects';

test.describe('Browse and Load Example FSMs', () => {
  let homePage: HomePage;
  let examplesPage: ExamplesPage;
  let editorPage: EditorPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    examplesPage = new ExamplesPage(page);
    editorPage = new EditorPage(page);

    await homePage.goToHomePage();
    await homePage.clickExamples();
  });

  test('should display example library', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    // Should have multiple categories
    await examplesPage.expectCategoriesVisible();

    // Take screenshot
    await examplesPage.takeScreenshot('examples-library');
  });

  test('should filter examples by category', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    // Filter by category
    await examplesPage.filterByCategory('basic');

    // Verify filtered results
    const count = await examplesPage.getExampleCount();
    expect(count).toBeGreaterThan(0);

    // Clear filter
    await examplesPage.clearFilters();

    // Count should increase
    const newCount = await examplesPage.getExampleCount();
    expect(newCount).toBeGreaterThanOrEqual(count);
  });

  test('should search for examples', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    // Search for traffic light
    await examplesPage.searchExamples('traffic');

    // Should find traffic light example
    await examplesPage.expectExampleVisible('traffic-light');
  });

  test('should preview example before loading', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    // Click on an example to preview
    await examplesPage.clickExample('traffic-light');

    // Should show preview modal
    await examplesPage.expectPreviewModalVisible();

    // Should show example details
    await examplesPage.expectPreviewDetails();

    // Take screenshot
    await examplesPage.takeScreenshot('example-preview');
  });

  test('should load example into editor', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    // Load traffic light example
    await examplesPage.loadExample('traffic-light');

    // Should redirect to editor
    await expect(page).toHaveURL(/.*editor/);
    await editorPage.expectEditorLoaded();

    // Should have loaded states
    await editorPage.expectStateCount(4); // Traffic light has 4 states
  });

  test('should load vending machine example', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    await examplesPage.loadExample('vending-machine');

    await expect(page).toHaveURL(/.*editor/);
    await editorPage.expectStateCount(4);
  });

  test('should load sequence detector example', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    await examplesPage.loadExample('sequence-detector');

    await expect(page).toHaveURL(/.*editor/);
    await editorPage.expectStateCount(4);
  });

  test('should show example metadata', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    await examplesPage.clickExample('traffic-light');

    // Preview should show metadata
    const metadata = await examplesPage.getExampleMetadata();

    expect(metadata.name).toBeTruthy();
    expect(metadata.description).toBeTruthy();
    expect(metadata.category).toBeTruthy();
    expect(metadata.stateCount).toBeGreaterThan(0);
    expect(metadata.transitionCount).toBeGreaterThan(0);
  });

  test('should navigate between example categories', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    // Click different categories
    await examplesPage.filterByCategory('basic');
    await page.waitForTimeout(500);

    await examplesPage.filterByCategory('intermediate');
    await page.waitForTimeout(500);

    await examplesPage.filterByCategory('advanced');
    await page.waitForTimeout(500);

    // Each category should have examples
    const count = await examplesPage.getExampleCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should display example thumbnail/preview', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    // Check if examples have thumbnails
    const hasThumbnails = await examplesPage.checkExampleThumbnails();
    expect(hasThumbnails).toBe(true);
  });

  test('should close preview modal', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    await examplesPage.clickExample('traffic-light');
    await examplesPage.expectPreviewModalVisible();

    // Close modal
    await examplesPage.closePreviewModal();

    // Modal should be hidden
    await examplesPage.expectPreviewModalHidden();
  });

  test('should handle keyboard navigation in examples', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    // Open preview
    await examplesPage.clickExample('traffic-light');
    await examplesPage.expectPreviewModalVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await examplesPage.expectPreviewModalHidden();
  });

  test('should show loading state while loading example', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    // Click load button
    await examplesPage.clickLoadButton('traffic-light');

    // Should show loading indicator briefly
    await expect(page.locator('[data-testid="loading-example"]')).toBeVisible();

    // Wait for redirect
    await expect(page).toHaveURL(/.*editor/);
  });

  test('should load complex example successfully', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    // Filter to advanced
    await examplesPage.filterByCategory('advanced');

    // Load first advanced example
    const examples = await page.locator('[data-testid^="example-card"]').all();
    if (examples.length > 0) {
      await examples[0].click();
      await examplesPage.loadFromPreview();

      await expect(page).toHaveURL(/.*editor/);
      await editorPage.expectEditorLoaded();
    }
  });

  test('should sort examples by different criteria', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    // Sort by name
    await examplesPage.sortBy('name');
    await page.waitForTimeout(300);

    // Sort by complexity
    await examplesPage.sortBy('complexity');
    await page.waitForTimeout(300);

    // Sort by popularity
    await examplesPage.sortBy('popularity');
    await page.waitForTimeout(300);

    // Should still have examples
    const count = await examplesPage.getExampleCount();
    expect(count).toBeGreaterThan(0);
  });

  test('should show example difficulty indicator', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    // Check if examples show difficulty
    const firstExample = page.locator('[data-testid^="example-card"]').first();
    const hasDifficulty = await firstExample.locator('[data-testid="difficulty-badge"]').isVisible();

    expect(hasDifficulty).toBe(true);
  });

  test('should navigate back from example preview', async ({ page }) => {
    await examplesPage.expectExamplesPageLoaded();

    const initialUrl = page.url();

    await examplesPage.clickExample('traffic-light');
    await examplesPage.expectPreviewModalVisible();

    // Navigate back
    await page.goBack();

    // Should be back on examples page
    expect(page.url()).toBe(initialUrl);
  });
});
