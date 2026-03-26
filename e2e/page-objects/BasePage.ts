/**
 * Base Page Object Model
 * Contains common functionality for all pages
 */
import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Common locators
  get header(): Locator {
    return this.page.locator('header');
  }

  get navigation(): Locator {
    return this.page.locator('nav');
  }

  get footer(): Locator {
    return this.page.locator('footer');
  }

  get loadingSpinner(): Locator {
    return this.page.locator('[data-testid="loading-spinner"]');
  }

  get errorMessage(): Locator {
    return this.page.locator('[data-testid="error-message"]');
  }

  get successMessage(): Locator {
    return this.page.locator('[data-testid="success-message"]');
  }

  get themeToggle(): Locator {
    return this.page.locator('[data-testid="theme-toggle"]');
  }

  // Navigation methods
  async goto(path: string = '/'): Promise<void> {
    await this.page.goto(path, { waitUntil: 'networkidle' });
  }

  async navigateTo(path: string): Promise<void> {
    await this.page.click(`a[href="${path}"]`);
    await this.page.waitForURL(`**${path}`);
  }

  // Theme methods
  async toggleTheme(): Promise<void> {
    await this.themeToggle.click();
    await this.page.waitForTimeout(500); // Wait for theme transition
  }

  async setDarkMode(): Promise<void> {
    const isDark = await this.isDarkMode();
    if (!isDark) {
      await this.toggleTheme();
    }
  }

  async setLightMode(): Promise<void> {
    const isDark = await this.isDarkMode();
    if (isDark) {
      await this.toggleTheme();
    }
  }

  async isDarkMode(): Promise<boolean> {
    const html = this.page.locator('html');
    const classList = await html.getAttribute('class');
    return classList?.includes('dark') || false;
  }

  // Wait methods
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async waitForLoading(): Promise<void> {
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 });
  }

  // Assertion methods
  async expectToBeVisible(): Promise<void> {
    await expect(this.page).toHaveURL(/./);
  }

  async expectErrorMessage(message?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  async expectSuccessMessage(message?: string): Promise<void> {
    await expect(this.successMessage).toBeVisible();
    if (message) {
      await expect(this.successMessage).toContainText(message);
    }
  }

  // Screenshot methods
  async takeScreenshot(name: string): Promise<Buffer> {
    return await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  async compareScreenshot(name: string): Promise<void> {
    await expect(this.page).toHaveScreenshot(`${name}.png`, {
      maxDiffPixels: 100,
    });
  }

  // Accessibility helpers
  async checkA11y(): Promise<void> {
    // This will be implemented with @axe-core/playwright
  }

  // Console error detection
  async listenForConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    this.page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    return errors;
  }
}
