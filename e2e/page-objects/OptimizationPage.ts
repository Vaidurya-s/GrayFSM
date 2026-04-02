/**
 * Optimization Page Object Model
 *
 * Selectors are matched to data-testid attributes in:
 *   frontend/src/pages/OptimizationPage.tsx
 *   frontend/src/components/forms/OptimizationForm.tsx
 *   frontend/src/components/fsm/FSMCanvas.tsx
 *
 * Route: /optimize/:id
 */
import { Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class OptimizationPage extends BasePage {
  // ── Page root ────────────────────────────────────────────────────────────────

  get optimizationPage(): Locator {
    return this.page.locator('[data-testid="optimization-page"]');
  }

  // ── FSM Canvas (shared component) ────────────────────────────────────────────

  get fsmCanvas(): Locator {
    return this.page.locator('[data-testid="fsm-canvas"]');
  }

  // ── Original / Optimized toggle buttons ──────────────────────────────────────

  /** "Original" tab — only visible after an optimization run */
  get viewOriginalButton(): Locator {
    return this.page.locator('[data-testid="optimization-view-original"]');
  }

  /** "Optimized" tab — only visible after an optimization run */
  get viewOptimizedButton(): Locator {
    return this.page.locator('[data-testid="optimization-view-optimized"]');
  }

  // ── Optimization form ─────────────────────────────────────────────────────────

  get optimizationForm(): Locator {
    return this.page.locator('[data-testid="optimization-form"]');
  }

  get algorithmSelect(): Locator {
    return this.page.locator('[data-testid="optimization-algorithm-select"]');
  }

  get timeoutInput(): Locator {
    return this.page.locator('[data-testid="optimization-timeout"]');
  }

  /** Only visible when algorithm is "global_sa" */
  get temperatureInput(): Locator {
    return this.page.locator('[data-testid="optimization-temperature"]');
  }

  /** Only visible when algorithm is "global_sa" */
  get coolingRateInput(): Locator {
    return this.page.locator('[data-testid="optimization-cooling-rate"]');
  }

  /** Only visible when algorithm is "global_sa" or "global_ga" */
  get iterationsInput(): Locator {
    return this.page.locator('[data-testid="optimization-iterations"]');
  }

  get submitButton(): Locator {
    return this.page.locator('[data-testid="optimization-submit"]');
  }

  // ── Results area ──────────────────────────────────────────────────────────────

  /**
   * Link to the export page that appears in the results section after optimization.
   * href: /export/:id?optimized=true
   */
  get exportLink(): Locator {
    return this.page.locator('[data-testid="optimization-export-link"]');
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  /**
   * Navigate directly to the optimization page for a given FSM id.
   * Requires a live backend to load the FSM.
   */
  async goToOptimizationPage(fsmId: string): Promise<void> {
    await this.goto(`/optimize/${fsmId}`);
    await this.waitForPageLoad();
    await this.optimizationPage.waitFor({ state: 'visible', timeout: 15_000 });
  }

  // ── Form interactions ──────────────────────────────────────────────────────────

  async selectAlgorithm(algorithm: 'greedy' | 'bfs_optimal' | 'global_sa' | 'global_ga'): Promise<void> {
    await this.algorithmSelect.selectOption(algorithm);
  }

  async setTimeout(ms: number): Promise<void> {
    await this.timeoutInput.fill(String(ms));
  }

  /**
   * Submit the optimization form and wait for the results section to appear.
   * Requires a running backend — callers should guard with test.skip if needed.
   */
  async runOptimization(): Promise<void> {
    await this.submitButton.click();
    // Wait for either the toggle buttons (success) or error banner
    await Promise.race([
      this.viewOriginalButton.waitFor({ state: 'visible', timeout: 30_000 }),
      this.page.locator('.bg-red-50').waitFor({ state: 'visible', timeout: 30_000 }),
    ]);
  }

  /** Switch the canvas to show the original FSM */
  async viewOriginal(): Promise<void> {
    await this.viewOriginalButton.click();
  }

  /** Switch the canvas to show the optimized FSM */
  async viewOptimized(): Promise<void> {
    await this.viewOptimizedButton.click();
  }

  // ── Assertions ─────────────────────────────────────────────────────────────────

  async expectOptimizationPageLoaded(): Promise<void> {
    await expect(this.optimizationPage).toBeVisible();
    await expect(this.optimizationForm).toBeVisible();
    await expect(this.fsmCanvas).toBeVisible();
  }

  async expectResultsVisible(): Promise<void> {
    await expect(this.viewOriginalButton).toBeVisible();
    await expect(this.viewOptimizedButton).toBeVisible();
    await expect(this.exportLink).toBeVisible();
  }

  async expectFormVisible(): Promise<void> {
    await expect(this.optimizationForm).toBeVisible();
    await expect(this.algorithmSelect).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectExportLinkVisible(): Promise<void> {
    await expect(this.exportLink).toBeVisible();
  }

  async expectExportLinkHref(fsmId: string): Promise<void> {
    const href = await this.exportLink.getAttribute('href');
    expect(href).toContain(`/export/${fsmId}`);
  }
}
