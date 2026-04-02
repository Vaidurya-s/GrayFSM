/**
 * Home Page Object Model
 *
 * The actual HomePage at '/' is a simple FSM dashboard with no data-testid attributes.
 * Navigation to other areas happens via the Navbar (data-testid="navbar").
 */
import { Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  // The home page renders inside the app shell that includes the Navbar.
  // The page body itself has no data-testid attributes, so we use semantic selectors.

  get pageHeading(): Locator {
    return this.page.locator('h1', { hasText: 'GrayFSM' });
  }

  get yourFSMsHeading(): Locator {
    return this.page.locator('h2', { hasText: 'Your FSMs' });
  }

  // Navigation methods
  async goToHomePage(): Promise<void> {
    await this.goto('/');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to the new FSM editor via the navbar "+ New FSM" button.
   */
  async clickCreateFSM(): Promise<void> {
    await this.navNewFSMButton.click();
    await this.page.waitForURL('**/editor/new');
  }

  /**
   * Navigate to the Examples page via the navbar link.
   */
  async clickExamples(): Promise<void> {
    await this.navLink('examples').click();
    await this.page.waitForURL('**/examples');
  }

  /**
   * Navigate to the Gallery page via the navbar link.
   */
  async clickGallery(): Promise<void> {
    await this.navLink('gallery').click();
    await this.page.waitForURL('**/gallery');
  }

  // Assertion methods
  async expectHomePageLoaded(): Promise<void> {
    await expect(this.navbar).toBeVisible();
    await expect(this.navNewFSMButton).toBeVisible();
  }
}
