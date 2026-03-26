/**
 * Optimization Results Page Object Model
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class OptimizationPage extends BasePage {
  // Locators
  get resultsContainer(): Locator {
    return this.page.locator('[data-testid="optimization-results"]');
  }

  get originalFSMCanvas(): Locator {
    return this.page.locator('[data-testid="original-fsm-canvas"]');
  }

  get optimizedFSMCanvas(): Locator {
    return this.page.locator('[data-testid="optimized-fsm-canvas"]');
  }

  get metricsCard(): Locator {
    return this.page.locator('[data-testid="metrics-card"]');
  }

  get dummyStatesMetric(): Locator {
    return this.page.locator('[data-testid="dummy-states-metric"]');
  }

  get stateCountMetric(): Locator {
    return this.page.locator('[data-testid="state-count-metric"]');
  }

  get transitionCountMetric(): Locator {
    return this.page.locator('[data-testid="transition-count-metric"]');
  }

  get algorithmUsed(): Locator {
    return this.page.locator('[data-testid="algorithm-used"]');
  }

  get executionTimeMetric(): Locator {
    return this.page.locator('[data-testid="execution-time-metric"]');
  }

  get encodingTable(): Locator {
    return this.page.locator('[data-testid="encoding-table"]');
  }

  get hypercubeVisualization(): Locator {
    return this.page.locator('[data-testid="hypercube-viz"]');
  }

  get exportResultsButton(): Locator {
    return this.page.locator('[data-testid="export-results-btn"]');
  }

  get compareAlgorithmsButton(): Locator {
    return this.page.locator('[data-testid="compare-algorithms-btn"]');
  }

  get downloadVerilogButton(): Locator {
    return this.page.locator('[data-testid="download-verilog-btn"]');
  }

  get downloadVHDLButton(): Locator {
    return this.page.locator('[data-testid="download-vhdl-btn"]');
  }

  get backToEditorButton(): Locator {
    return this.page.locator('[data-testid="back-to-editor-btn"]');
  }

  get animationControls(): Locator {
    return this.page.locator('[data-testid="animation-controls"]');
  }

  get playAnimationButton(): Locator {
    return this.page.locator('[data-testid="play-animation-btn"]');
  }

  get pauseAnimationButton(): Locator {
    return this.page.locator('[data-testid="pause-animation-btn"]');
  }

  get animationSpeedSlider(): Locator {
    return this.page.locator('[data-testid="animation-speed-slider"]');
  }

  // Navigation
  async goToOptimizationResults(): Promise<void> {
    await this.goto('/optimization-results');
    await this.waitForPageLoad();
  }

  // Metrics retrieval
  async getOptimizationMetrics(): Promise<{
    dummyStates: number;
    totalStates: number;
    totalTransitions: number;
    algorithm: string;
    executionTime: number;
  }> {
    const dummyStates = parseInt(await this.dummyStatesMetric.textContent() || '0');
    const totalStates = parseInt(await this.stateCountMetric.textContent() || '0');
    const totalTransitions = parseInt(await this.transitionCountMetric.textContent() || '0');
    const algorithm = await this.algorithmUsed.textContent() || '';
    const executionTime = parseFloat(await this.executionTimeMetric.textContent() || '0');

    return {
      dummyStates,
      totalStates,
      totalTransitions,
      algorithm,
      executionTime,
    };
  }

  async getEncodingFromTable(): Promise<Map<string, string>> {
    const encodings = new Map<string, string>();
    const rows = await this.encodingTable.locator('tbody tr').all();

    for (const row of rows) {
      const state = await row.locator('td').nth(0).textContent();
      const encoding = await row.locator('td').nth(1).textContent();
      if (state && encoding) {
        encodings.set(state.trim(), encoding.trim());
      }
    }

    return encodings;
  }

  // Export operations
  async exportAsVerilog(): Promise<void> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadVerilogButton.click();
    const download = await downloadPromise;
    return download;
  }

  async exportAsVHDL(): Promise<void> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadVHDLButton.click();
    const download = await downloadPromise;
    return download;
  }

  async exportResults(format: 'json' | 'csv' | 'pdf'): Promise<void> {
    await this.exportResultsButton.click();
    await this.page.locator(`[data-testid="export-format-${format}"]`).click();

    const downloadPromise = this.page.waitForEvent('download');
    await this.page.locator('[data-testid="confirm-export-btn"]').click();
    await downloadPromise;
  }

  // Comparison
  async goToComparison(): Promise<void> {
    await this.compareAlgorithmsButton.click();
    await this.page.waitForURL('**/comparison');
  }

  // Navigation
  async backToEditor(): Promise<void> {
    await this.backToEditorButton.click();
    await this.page.waitForURL('**/editor');
  }

  // Animation controls
  async playOptimizationAnimation(): Promise<void> {
    await this.playAnimationButton.click();
    await this.page.waitForTimeout(500);
  }

  async pauseOptimizationAnimation(): Promise<void> {
    await this.pauseAnimationButton.click();
  }

  async setAnimationSpeed(speed: number): Promise<void> {
    await this.animationSpeedSlider.fill(speed.toString());
  }

  // Hypercube visualization
  async toggleHypercubeView(): Promise<void> {
    await this.page.locator('[data-testid="toggle-hypercube-btn"]').click();
    await this.page.waitForTimeout(500);
  }

  async rotateHypercube(x: number, y: number): Promise<void> {
    const viz = this.hypercubeVisualization;
    const box = await viz.boundingBox();

    if (box) {
      await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await this.page.mouse.down();
      await this.page.mouse.move(box.x + box.width / 2 + x, box.y + box.height / 2 + y);
      await this.page.mouse.up();
    }
  }

  // Assertions
  async expectOptimizationResultsLoaded(): Promise<void> {
    await expect(this.resultsContainer).toBeVisible();
    await expect(this.metricsCard).toBeVisible();
  }

  async expectOriginalAndOptimizedVisible(): Promise<void> {
    await expect(this.originalFSMCanvas).toBeVisible();
    await expect(this.optimizedFSMCanvas).toBeVisible();
  }

  async expectMetricsCardVisible(): Promise<void> {
    await expect(this.dummyStatesMetric).toBeVisible();
    await expect(this.stateCountMetric).toBeVisible();
    await expect(this.algorithmUsed).toBeVisible();
  }

  async expectDummyStatesAdded(): Promise<void> {
    const count = parseInt(await this.dummyStatesMetric.textContent() || '0');
    expect(count).toBeGreaterThan(0);
  }

  async expectAlgorithm(algorithm: string): Promise<void> {
    await expect(this.algorithmUsed).toContainText(algorithm);
  }

  async expectEncodingTableVisible(): Promise<void> {
    await expect(this.encodingTable).toBeVisible();
  }

  async expectHypercubeVisible(): Promise<void> {
    await expect(this.hypercubeVisualization).toBeVisible();
  }

  async expectExecutionTimeLessThan(maxTime: number): Promise<void> {
    const time = parseFloat(await this.executionTimeMetric.textContent() || '999999');
    expect(time).toBeLessThan(maxTime);
  }
}
