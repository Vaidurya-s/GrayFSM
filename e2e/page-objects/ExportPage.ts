/**
 * Export Page Object Model
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ExportPage extends BasePage {
  // Locators
  get exportFormatSelector(): Locator {
    return this.page.locator('[data-testid="export-format-selector"]');
  }

  get jsonFormatOption(): Locator {
    return this.page.locator('[data-testid="format-json"]');
  }

  get csvFormatOption(): Locator {
    return this.page.locator('[data-testid="format-csv"]');
  }

  get verilogFormatOption(): Locator {
    return this.page.locator('[data-testid="format-verilog"]');
  }

  get vhdlFormatOption(): Locator {
    return this.page.locator('[data-testid="format-vhdl"]');
  }

  get exportOptionsPanel(): Locator {
    return this.page.locator('[data-testid="export-options"]');
  }

  get includeCommentsCheckbox(): Locator {
    return this.page.locator('[data-testid="include-comments"]');
  }

  get includeTestbenchCheckbox(): Locator {
    return this.page.locator('[data-testid="include-testbench"]');
  }

  get moduleNameInput(): Locator {
    return this.page.locator('[data-testid="module-name-input"]');
  }

  get clockEdgeSelector(): Locator {
    return this.page.locator('[data-testid="clock-edge-selector"]');
  }

  get resetTypeSelector(): Locator {
    return this.page.locator('[data-testid="reset-type-selector"]');
  }

  get previewButton(): Locator {
    return this.page.locator('[data-testid="preview-btn"]');
  }

  get downloadButton(): Locator {
    return this.page.locator('[data-testid="download-btn"]');
  }

  get copyToClipboardButton(): Locator {
    return this.page.locator('[data-testid="copy-clipboard-btn"]');
  }

  get previewPane(): Locator {
    return this.page.locator('[data-testid="preview-pane"]');
  }

  get codePreview(): Locator {
    return this.page.locator('[data-testid="code-preview"]');
  }

  get syntaxHighlighter(): Locator {
    return this.page.locator('.hljs, [data-testid="syntax-highlight"]');
  }

  // Navigation
  async goToExport(): Promise<void> {
    await this.goto('/export');
    await this.waitForPageLoad();
  }

  // Format selection
  async selectFormat(format: 'json' | 'csv' | 'verilog' | 'vhdl'): Promise<void> {
    await this.exportFormatSelector.click();
    await this.page.locator(`[data-testid="format-${format}"]`).click();
    await this.page.waitForTimeout(300);
  }

  // Export options
  async setIncludeComments(include: boolean): Promise<void> {
    const isChecked = await this.includeCommentsCheckbox.isChecked();
    if (isChecked !== include) {
      await this.includeCommentsCheckbox.click();
    }
  }

  async setIncludeTestbench(include: boolean): Promise<void> {
    const isChecked = await this.includeTestbenchCheckbox.isChecked();
    if (isChecked !== include) {
      await this.includeTestbenchCheckbox.click();
    }
  }

  async setModuleName(name: string): Promise<void> {
    await this.moduleNameInput.fill(name);
  }

  async setClockEdge(edge: 'posedge' | 'negedge'): Promise<void> {
    await this.clockEdgeSelector.click();
    await this.page.locator(`[data-value="${edge}"]`).click();
  }

  async setResetType(type: 'sync' | 'async'): Promise<void> {
    await this.resetTypeSelector.click();
    await this.page.locator(`[data-value="${type}"]`).click();
  }

  // Preview operations
  async showPreview(): Promise<void> {
    await this.previewButton.click();
    await this.previewPane.waitFor({ state: 'visible' });
  }

  async getPreviewContent(): Promise<string> {
    await this.showPreview();
    return await this.codePreview.textContent() || '';
  }

  async copyToClipboard(): Promise<void> {
    await this.copyToClipboardButton.click();
    await this.expectSuccessMessage('Copied to clipboard');
  }

  // Download operations
  async download(): Promise<any> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadButton.click();
    const download = await downloadPromise;
    return download;
  }

  async downloadWithSettings(settings: {
    format: 'json' | 'csv' | 'verilog' | 'vhdl';
    moduleName?: string;
    includeComments?: boolean;
    includeTestbench?: boolean;
    clockEdge?: 'posedge' | 'negedge';
    resetType?: 'sync' | 'async';
  }): Promise<any> {
    await this.selectFormat(settings.format);

    if (settings.moduleName) {
      await this.setModuleName(settings.moduleName);
    }
    if (settings.includeComments !== undefined) {
      await this.setIncludeComments(settings.includeComments);
    }
    if (settings.includeTestbench !== undefined) {
      await this.setIncludeTestbench(settings.includeTestbench);
    }
    if (settings.clockEdge) {
      await this.setClockEdge(settings.clockEdge);
    }
    if (settings.resetType) {
      await this.setResetType(settings.resetType);
    }

    return await this.download();
  }

  // Assertions
  async expectExportPageLoaded(): Promise<void> {
    await expect(this.exportFormatSelector).toBeVisible();
    await expect(this.downloadButton).toBeVisible();
  }

  async expectFormatOptionsVisible(format: 'verilog' | 'vhdl'): Promise<void> {
    await this.selectFormat(format);
    await expect(this.moduleNameInput).toBeVisible();
    await expect(this.clockEdgeSelector).toBeVisible();
    await expect(this.resetTypeSelector).toBeVisible();
  }

  async expectPreviewVisible(): Promise<void> {
    await expect(this.previewPane).toBeVisible();
    await expect(this.codePreview).toBeVisible();
  }

  async expectPreviewContains(text: string): Promise<void> {
    await expect(this.codePreview).toContainText(text);
  }

  async expectSyntaxHighlightingActive(): Promise<void> {
    await expect(this.syntaxHighlighter).toBeVisible();
  }

  async expectValidVerilogSyntax(): Promise<void> {
    const content = await this.getPreviewContent();
    expect(content).toContain('module');
    expect(content).toContain('endmodule');
    expect(content).toContain('always');
  }

  async expectValidVHDLSyntax(): Promise<void> {
    const content = await this.getPreviewContent();
    expect(content).toContain('entity');
    expect(content).toContain('end entity');
    expect(content).toContain('architecture');
  }
}
