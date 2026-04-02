/**
 * Export Page Object Model
 *
 * Selectors are matched to data-testid attributes in:
 *   frontend/src/pages/ExportPage.tsx
 *   frontend/src/components/forms/ExportForm.tsx
 *
 * Route: /export/:id
 */
import { Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ExportPage extends BasePage {
  // ── Page root ────────────────────────────────────────────────────────────────

  get exportPage(): Locator {
    return this.page.locator('[data-testid="export-page"]');
  }

  // ── Export form ───────────────────────────────────────────────────────────────

  get exportForm(): Locator {
    return this.page.locator('[data-testid="export-form"]');
  }

  /** Radio button for a specific format. Values: verilog | vhdl | json | csv | testbench */
  formatRadio(format: 'verilog' | 'vhdl' | 'json' | 'csv' | 'testbench'): Locator {
    return this.page.locator(`[data-testid="export-format-${format}"]`);
  }

  /** Module name text input — only visible for verilog / vhdl / testbench formats */
  get moduleNameInput(): Locator {
    return this.page.locator('[data-testid="export-module-name"]');
  }

  /** Code style select — only visible for verilog / vhdl / testbench formats */
  get styleSelect(): Locator {
    return this.page.locator('[data-testid="export-style"]');
  }

  /** Include comments checkbox — only visible for verilog / vhdl / testbench formats */
  get includeCommentsCheckbox(): Locator {
    return this.page.locator('[data-testid="export-include-comments"]');
  }

  /** "Generate Export" submit button */
  get submitButton(): Locator {
    return this.page.locator('[data-testid="export-submit"]');
  }

  // ── Preview area ──────────────────────────────────────────────────────────────

  /** Code preview <pre> element — only visible after a successful export */
  get codePreview(): Locator {
    return this.page.locator('[data-testid="export-preview"]');
  }

  /** "Copy" button — only visible after a successful export */
  get copyButton(): Locator {
    return this.page.locator('[data-testid="export-copy"]');
  }

  /** "Download" button — only visible after a successful export */
  get downloadButton(): Locator {
    return this.page.locator('[data-testid="export-download"]');
  }

  // ── Navigation ─────────────────────────────────────────────────────────────────

  /**
   * Navigate directly to the export page for a given FSM id.
   * Requires a live backend to load the FSM.
   */
  async goToExportPage(fsmId: string): Promise<void> {
    await this.goto(`/export/${fsmId}`);
    await this.waitForPageLoad();
    await this.exportPage.waitFor({ state: 'visible', timeout: 15_000 });
  }

  // ── Form interactions ──────────────────────────────────────────────────────────

  async selectFormat(format: 'verilog' | 'vhdl' | 'json' | 'csv' | 'testbench'): Promise<void> {
    await this.formatRadio(format).click();
    await this.page.waitForTimeout(200);
  }

  async setModuleName(name: string): Promise<void> {
    await this.moduleNameInput.fill(name);
  }

  async setStyle(style: 'standard' | 'compact' | 'verbose'): Promise<void> {
    await this.styleSelect.selectOption(style);
  }

  async setIncludeComments(include: boolean): Promise<void> {
    const isChecked = await this.includeCommentsCheckbox.isChecked();
    if (isChecked !== include) {
      await this.includeCommentsCheckbox.click();
    }
  }

  /**
   * Submit the export form and wait for the code preview to appear.
   * Requires a running backend — callers should guard with test.skip if needed.
   */
  async generateExport(): Promise<void> {
    await this.submitButton.click();
    await this.codePreview.waitFor({ state: 'visible', timeout: 20_000 });
  }

  /**
   * Click the Download button and capture the download event.
   * Returns the Playwright Download object.
   */
  async downloadExport(): Promise<import('@playwright/test').Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadButton.click();
    return downloadPromise;
  }

  async copyToClipboard(): Promise<void> {
    await this.copyButton.click();
  }

  async getPreviewContent(): Promise<string> {
    return (await this.codePreview.textContent()) ?? '';
  }

  // ── Assertions ────────────────────────────────────────────────────────────────

  async expectExportPageLoaded(): Promise<void> {
    await expect(this.exportPage).toBeVisible();
    await expect(this.exportForm).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectPreviewVisible(): Promise<void> {
    await expect(this.codePreview).toBeVisible();
  }

  async expectPreviewContains(text: string): Promise<void> {
    await expect(this.codePreview).toContainText(text);
  }

  async expectDownloadButtonVisible(): Promise<void> {
    await expect(this.downloadButton).toBeVisible();
  }

  async expectCopyButtonVisible(): Promise<void> {
    await expect(this.copyButton).toBeVisible();
  }

  async expectValidVerilogPreview(): Promise<void> {
    const content = await this.getPreviewContent();
    expect(content).toContain('module');
    expect(content).toContain('endmodule');
  }

  async expectValidVHDLPreview(): Promise<void> {
    const content = await this.getPreviewContent();
    expect(content).toContain('entity');
    expect(content).toContain('architecture');
  }
}
