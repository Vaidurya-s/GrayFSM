/**
 * Import Page Object Model
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ImportPage extends BasePage {
  // Locators
  get fileUploadInput(): Locator {
    return this.page.locator('[data-testid="file-upload-input"]');
  }

  get dropZone(): Locator {
    return this.page.locator('[data-testid="drop-zone"]');
  }

  get formatSelector(): Locator {
    return this.page.locator('[data-testid="format-selector"]');
  }

  get jsonTextarea(): Locator {
    return this.page.locator('[data-testid="json-textarea"]');
  }

  get csvTextarea(): Locator {
    return this.page.locator('[data-testid="csv-textarea"]');
  }

  get importButton(): Locator {
    return this.page.locator('[data-testid="import-btn"]');
  }

  get cancelButton(): Locator {
    return this.page.locator('[data-testid="cancel-btn"]');
  }

  get validateButton(): Locator {
    return this.page.locator('[data-testid="validate-btn"]');
  }

  get validationResults(): Locator {
    return this.page.locator('[data-testid="validation-results"]');
  }

  get previewPanel(): Locator {
    return this.page.locator('[data-testid="import-preview"]');
  }

  // Navigation
  async goToImport(): Promise<void> {
    await this.goto('/import');
    await this.waitForPageLoad();
  }

  // Format selection
  async selectFormat(format: 'json' | 'csv'): Promise<void> {
    await this.formatSelector.click();
    await this.page.locator(`[data-value="${format}"]`).click();
  }

  // File upload
  async uploadFile(filePath: string): Promise<void> {
    await this.fileUploadInput.setInputFiles(filePath);
    await this.page.waitForTimeout(500);
  }

  async dragAndDropFile(filePath: string): Promise<void> {
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await this.dropZone.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
  }

  // Text input
  async pasteJSON(json: string): Promise<void> {
    await this.selectFormat('json');
    await this.jsonTextarea.fill(json);
  }

  async pasteCSV(csv: string): Promise<void> {
    await this.selectFormat('csv');
    await this.csvTextarea.fill(csv);
  }

  // Validation
  async validate(): Promise<void> {
    await this.validateButton.click();
    await this.page.waitForTimeout(500);
  }

  // Import
  async import(): Promise<void> {
    await this.importButton.click();
    await this.page.waitForURL('**/editor*');
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  // Complete import flow
  async importFromFile(filePath: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    await this.selectFormat(format);
    await this.uploadFile(filePath);
    await this.validate();
    await this.import();
  }

  async importFromText(text: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    if (format === 'json') {
      await this.pasteJSON(text);
    } else {
      await this.pasteCSV(text);
    }
    await this.validate();
    await this.import();
  }

  // Assertions
  async expectImportPageLoaded(): Promise<void> {
    await expect(this.dropZone).toBeVisible();
    await expect(this.importButton).toBeVisible();
  }

  async expectValidationSuccess(): Promise<void> {
    await expect(this.validationResults).toContainText('valid', { ignoreCase: true });
    await expect(this.previewPanel).toBeVisible();
  }

  async expectValidationError(message?: string): Promise<void> {
    await expect(this.validationResults).toBeVisible();
    if (message) {
      await expect(this.validationResults).toContainText(message);
    }
  }

  async expectPreviewVisible(): Promise<void> {
    await expect(this.previewPanel).toBeVisible();
  }
}
