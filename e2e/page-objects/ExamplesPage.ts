/**
 * Examples Page Object Model
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ExamplesPage extends BasePage {
  // Locators
  get examplesGrid(): Locator {
    return this.page.locator('[data-testid="examples-grid"]');
  }

  get searchInput(): Locator {
    return this.page.locator('[data-testid="examples-search"]');
  }

  get categoryFilter(): Locator {
    return this.page.locator('[data-testid="category-filter"]');
  }

  get complexityFilter(): Locator {
    return this.page.locator('[data-testid="complexity-filter"]');
  }

  get exampleCards(): Locator {
    return this.page.locator('[data-testid="example-card"]');
  }

  get noResultsMessage(): Locator {
    return this.page.locator('[data-testid="no-results"]');
  }

  // Navigation
  async goToExamples(): Promise<void> {
    await this.goto('/examples');
    await this.waitForPageLoad();
  }

  // Search and filter
  async searchExamples(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  async filterByCategory(category: string): Promise<void> {
    await this.categoryFilter.click();
    await this.page.locator(`[data-value="${category}"]`).click();
  }

  async filterByComplexity(complexity: 'simple' | 'medium' | 'complex'): Promise<void> {
    await this.complexityFilter.click();
    await this.page.locator(`[data-value="${complexity}"]`).click();
  }

  async clearFilters(): Promise<void> {
    await this.page.locator('[data-testid="clear-filters-btn"]').click();
  }

  // Example operations
  async selectExample(exampleName: string): Promise<void> {
    await this.page.locator(`[data-testid="example-card"][data-name="${exampleName}"]`).click();
  }

  async loadExample(exampleName: string): Promise<void> {
    const card = this.page.locator(`[data-testid="example-card"][data-name="${exampleName}"]`);
    await card.locator('[data-testid="load-example-btn"]').click();
    await this.page.waitForURL('**/editor*');
  }

  async previewExample(exampleName: string): Promise<void> {
    const card = this.page.locator(`[data-testid="example-card"][data-name="${exampleName}"]`);
    await card.locator('[data-testid="preview-example-btn"]').click();
    await this.page.waitForSelector('[data-testid="example-preview-modal"]');
  }

  async closePreview(): Promise<void> {
    await this.page.locator('[data-testid="close-preview-btn"]').click();
  }

  // Assertions
  async expectExamplesLoaded(): Promise<void> {
    await expect(this.examplesGrid).toBeVisible();
    await expect(this.exampleCards.first()).toBeVisible();
  }

  async expectExampleCount(count: number): Promise<void> {
    await expect(this.exampleCards).toHaveCount(count);
  }

  async expectNoResults(): Promise<void> {
    await expect(this.noResultsMessage).toBeVisible();
  }

  async expectExampleVisible(exampleName: string): Promise<void> {
    await expect(this.page.locator(`[data-testid="example-card"][data-name="${exampleName}"]`)).toBeVisible();
  }
}
