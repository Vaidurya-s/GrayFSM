/**
 * Home Page Object Model
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  // Locators
  get heroSection(): Locator {
    return this.page.locator('[data-testid="hero-section"]');
  }

  get createFSMButton(): Locator {
    return this.page.locator('[data-testid="create-fsm-btn"]');
  }

  get importFSMButton(): Locator {
    return this.page.locator('[data-testid="import-fsm-btn"]');
  }

  get examplesButton(): Locator {
    return this.page.locator('[data-testid="examples-btn"]');
  }

  get featuresSection(): Locator {
    return this.page.locator('[data-testid="features-section"]');
  }

  get documentationLink(): Locator {
    return this.page.locator('[data-testid="documentation-link"]');
  }

  // Navigation methods
  async goToHomePage(): Promise<void> {
    await this.goto('/');
    await this.waitForPageLoad();
  }

  async clickCreateFSM(): Promise<void> {
    await this.createFSMButton.click();
    await this.page.waitForURL('**/editor');
  }

  async clickImportFSM(): Promise<void> {
    await this.importFSMButton.click();
    await this.page.waitForURL('**/import');
  }

  async clickExamples(): Promise<void> {
    await this.examplesButton.click();
    await this.page.waitForURL('**/examples');
  }

  async clickDocumentation(): Promise<void> {
    await this.documentationLink.click();
  }

  // Assertion methods
  async expectHomePageLoaded(): Promise<void> {
    await expect(this.heroSection).toBeVisible();
    await expect(this.createFSMButton).toBeVisible();
    await expect(this.importFSMButton).toBeVisible();
    await expect(this.examplesButton).toBeVisible();
  }

  async expectFeaturesSectionVisible(): Promise<void> {
    await expect(this.featuresSection).toBeVisible();
  }
}
