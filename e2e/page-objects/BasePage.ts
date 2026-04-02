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
  get navbar(): Locator {
    return this.page.locator('[data-testid="navbar"]');
  }

  get navbarLogo(): Locator {
    return this.page.locator('[data-testid="navbar-logo"]');
  }

  get navNewFSMButton(): Locator {
    return this.page.locator('[data-testid="nav-new-fsm"]');
  }

  get mobileMenuButton(): Locator {
    return this.page.locator('[data-testid="mobile-menu-button"]');
  }

  get mobileMenu(): Locator {
    return this.page.locator('[data-testid="mobile-menu"]');
  }

  /** @deprecated No loading-spinner testid exists — use page-specific loading selectors */
  get loadingSpinner(): Locator {
    return this.page.locator('.animate-spin').first();
  }

  // Navigation helpers
  navLink(label: string): Locator {
    return this.page.locator(`[data-testid="nav-link-${label.toLowerCase()}"]`);
  }

  // Navigation methods
  async goto(path: string = '/'): Promise<void> {
    await this.page.goto(path, { waitUntil: 'networkidle' });
  }

  async navigateTo(path: string): Promise<void> {
    await this.page.click(`a[href="${path}"]`);
    await this.page.waitForURL(`**${path}`);
  }

  async clickNavLink(label: 'home' | 'editor' | 'gallery' | 'examples' | 'about'): Promise<void> {
    await this.navLink(label).click();
  }

  async clickNavNewFSM(): Promise<void> {
    await this.navNewFSMButton.click();
    await this.page.waitForURL('**/editor/new');
  }

  // Wait methods
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  // Assertion methods
  async expectNavbarVisible(): Promise<void> {
    await expect(this.navbar).toBeVisible();
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
