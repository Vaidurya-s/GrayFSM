/**
 * Examples Page Object Model
 *
 * Selectors are matched to data-testid attributes in:
 *   frontend/src/pages/ExamplesPage.tsx
 *
 * Route: /examples
 *
 * Note: ExamplesPage has no search/filter UI — it only shows a grid of example
 * cards when the backend returns data, or a static placeholder grid when the
 * backend is unavailable.  Card test-ids are dynamic: `example-card-${example.id}`.
 */
import { Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ExamplesPage extends BasePage {
  // ── Page root ─────────────────────────────────────────────────────────────────

  get examplesPage(): Locator {
    return this.page.locator('[data-testid="examples-page"]');
  }

  // ── Page heading ──────────────────────────────────────────────────────────────

  get pageHeading(): Locator {
    return this.page.locator('h1', { hasText: 'Example FSMs' });
  }

  // ── Example cards (backend data) ──────────────────────────────────────────────

  /**
   * Returns the locator for a specific example card by its database id.
   * data-testid="example-card-{id}"
   */
  exampleCard(exampleId: string): Locator {
    return this.page.locator(`[data-testid="example-card-${exampleId}"]`);
  }

  /**
   * All dynamically-rendered example cards (pattern match).
   */
  get allExampleCards(): Locator {
    return this.page.locator('[data-testid^="example-card-"]');
  }

  // ── Empty / error states ──────────────────────────────────────────────────────

  /** Static placeholder cards shown when backend returns no examples */
  get staticPlaceholderCards(): Locator {
    return this.page.locator('.bg-gray-50.rounded-lg.p-4.border');
  }

  get errorBanner(): Locator {
    return this.page.locator('.bg-red-50', { hasText: 'Failed to load examples' });
  }

  get emptyStateContainer(): Locator {
    return this.page.locator('h3', { hasText: 'No examples yet' });
  }

  /** "Create Your Own FSM" link inside the empty-state block */
  get createYourOwnLink(): Locator {
    return this.page.locator('a', { hasText: 'Create Your Own FSM' });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────────

  async goToExamples(): Promise<void> {
    await this.goto('/examples');
    await this.waitForPageLoad();
    await this.examplesPage.waitFor({ state: 'visible', timeout: 10_000 });
  }

  // ── Example card interactions ─────────────────────────────────────────────────

  /**
   * Click an example card (by its database id) to navigate to its detail page.
   */
  async clickExampleCard(exampleId: string): Promise<void> {
    await this.exampleCard(exampleId).click();
  }

  /**
   * Click the first available example card (useful when ids are unknown).
   */
  async clickFirstExampleCard(): Promise<void> {
    await this.allExampleCards.first().click();
  }

  // ── Assertions ─────────────────────────────────────────────────────────────────

  async expectExamplesPageLoaded(): Promise<void> {
    await expect(this.examplesPage).toBeVisible();
    await expect(this.pageHeading).toBeVisible();
  }

  /** Asserts that live example cards are rendered (requires backend). */
  async expectLiveExamplesVisible(): Promise<void> {
    await expect(this.allExampleCards.first()).toBeVisible();
  }

  /**
   * Asserts that the example count equals `count`.
   * Only works when the backend returns data.
   */
  async expectExampleCount(count: number): Promise<void> {
    await expect(this.allExampleCards).toHaveCount(count);
  }

  async expectEmptyStateVisible(): Promise<void> {
    await expect(this.emptyStateContainer).toBeVisible();
  }

  async expectErrorBannerVisible(): Promise<void> {
    await expect(this.errorBanner).toBeVisible();
  }

  async expectExampleCardVisible(exampleId: string): Promise<void> {
    await expect(this.exampleCard(exampleId)).toBeVisible();
  }
}
