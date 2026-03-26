/**
 * Algorithm Comparison Page Object Model
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ComparisonPage extends BasePage {
  // Locators
  get originalFSM(): Locator {
    return this.page.locator('[data-testid="original-fsm"]');
  }

  get optimizedFSM(): Locator {
    return this.page.locator('[data-testid="optimized-fsm"]');
  }

  get algorithmTabs(): Locator {
    return this.page.locator('[data-testid="algorithm-tabs"]');
  }

  get metricsPanel(): Locator {
    return this.page.locator('[data-testid="metrics-panel"]');
  }

  get dummyStatesCount(): Locator {
    return this.page.locator('[data-testid="dummy-states-count"]');
  }

  get totalStatesCount(): Locator {
    return this.page.locator('[data-testid="total-states-count"]');
  }

  get bitFlipsReduction(): Locator {
    return this.page.locator('[data-testid="bit-flips-reduction"]');
  }

  get executionTime(): Locator {
    return this.page.locator('[data-testid="execution-time"]');
  }

  get comparisonChart(): Locator {
    return this.page.locator('[data-testid="comparison-chart"]');
  }

  get exportComparisonButton(): Locator {
    return this.page.locator('[data-testid="export-comparison-btn"]');
  }

  get syncViewsToggle(): Locator {
    return this.page.locator('[data-testid="sync-views-toggle"]');
  }

  // Navigation
  async goToComparison(): Promise<void> {
    await this.goto('/comparison');
    await this.waitForPageLoad();
  }

  // Algorithm selection
  async selectAlgorithm(algorithm: 'greedy' | 'bfs' | 'global'): Promise<void> {
    await this.page.locator(`[data-testid="algorithm-tab-${algorithm}"]`).click();
    await this.page.waitForTimeout(300);
  }

  // View controls
  async toggleSyncViews(): Promise<void> {
    await this.syncViewsToggle.click();
  }

  async enableSyncViews(): Promise<void> {
    const isChecked = await this.syncViewsToggle.isChecked();
    if (!isChecked) {
      await this.toggleSyncViews();
    }
  }

  async disableSyncViews(): Promise<void> {
    const isChecked = await this.syncViewsToggle.isChecked();
    if (isChecked) {
      await this.toggleSyncViews();
    }
  }

  // Metrics
  async getMetrics(): Promise<{
    dummyStates: number;
    totalStates: number;
    bitFlipsReduction: number;
    executionTime: number;
  }> {
    const dummyStates = parseInt(await this.dummyStatesCount.textContent() || '0');
    const totalStates = parseInt(await this.totalStatesCount.textContent() || '0');
    const bitFlipsReduction = parseFloat(await this.bitFlipsReduction.textContent() || '0');
    const executionTime = parseFloat(await this.executionTime.textContent() || '0');

    return {
      dummyStates,
      totalStates,
      bitFlipsReduction,
      executionTime,
    };
  }

  // Export
  async exportComparison(format: 'pdf' | 'csv' | 'json'): Promise<void> {
    await this.exportComparisonButton.click();
    await this.page.locator(`[data-testid="export-${format}-btn"]`).click();

    const downloadPromise = this.page.waitForEvent('download');
    await this.page.locator('[data-testid="confirm-export-btn"]').click();
    await downloadPromise;
  }

  // Assertions
  async expectComparisonLoaded(): Promise<void> {
    await expect(this.originalFSM).toBeVisible();
    await expect(this.optimizedFSM).toBeVisible();
    await expect(this.metricsPanel).toBeVisible();
  }

  async expectMetricsVisible(): Promise<void> {
    await expect(this.dummyStatesCount).toBeVisible();
    await expect(this.totalStatesCount).toBeVisible();
    await expect(this.bitFlipsReduction).toBeVisible();
    await expect(this.executionTime).toBeVisible();
  }

  async expectDummyStatesLessThan(threshold: number): Promise<void> {
    const count = parseInt(await this.dummyStatesCount.textContent() || '999');
    expect(count).toBeLessThan(threshold);
  }

  async expectChartVisible(): Promise<void> {
    await expect(this.comparisonChart).toBeVisible();
  }
}
