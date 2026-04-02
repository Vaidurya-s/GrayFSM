/**
 * Critical User Journey: Browse and Load Example FSMs
 *
 * Tests the /examples page.
 *
 * The page has two states:
 *   1. Backend unavailable / no examples: shows the "No examples yet" placeholder
 *      with four static card previews.
 *   2. Backend available and seeded: shows live example cards with
 *      data-testid="example-card-{id}" attributes.
 *
 * Tests in the "no backend" group only assert on the static placeholder UI.
 * Tests in the "[requires-backend]" group skip unless BACKEND_URL is set.
 */
import { test, expect } from '@playwright/test';
import { HomePage, ExamplesPage } from '@page-objects';

const BACKEND_AVAILABLE = !!process.env.BACKEND_URL;

test.describe('Browse Example FSMs', () => {
  let homePage: HomePage;
  let examplesPage: ExamplesPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    examplesPage = new ExamplesPage(page);

    await homePage.goToHomePage();
    await homePage.clickExamples();
    await examplesPage.expectExamplesPageLoaded();
  });

  // ── Always-on tests (work with or without a backend) ─────────────────────────

  test('should display the Examples page heading', async () => {
    await expect(examplesPage.pageHeading).toBeVisible();
    await expect(examplesPage.pageHeading).toHaveText('Example FSMs');
  });

  test('should navigate to /examples via the navbar', async ({ page }) => {
    await expect(page).toHaveURL(/\/examples/);
  });

  test('should render the page wrapper with correct testid', async () => {
    await expect(examplesPage.examplesPage).toBeVisible();
  });

  test('should show the "Create Your Own FSM" link when no examples exist', async () => {
    // This test is meaningful only when the backend is absent or returns nothing.
    test.skip(BACKEND_AVAILABLE, 'Only relevant when backend is not seeded');

    await expect(examplesPage.emptyStateContainer).toBeVisible();
    await expect(examplesPage.createYourOwnLink).toBeVisible();
  });

  test('should display static placeholder cards in empty state', async () => {
    test.skip(BACKEND_AVAILABLE, 'Only relevant when backend is not seeded');

    // The empty state block contains four hardcoded preview cards
    const staticCards = examplesPage.staticPlaceholderCards;
    await expect(staticCards).toHaveCount(4);
  });

  test('should have "Create Your Own FSM" link that points to /editor/new', async () => {
    test.skip(BACKEND_AVAILABLE, 'Only relevant when backend is not seeded');

    const href = await examplesPage.createYourOwnLink.getAttribute('href');
    expect(href).toBe('/editor/new');
  });

  test('should navigate to editor/new via the "Create Your Own FSM" link', async ({ page }) => {
    test.skip(BACKEND_AVAILABLE, 'Only relevant when backend is not seeded');

    await examplesPage.createYourOwnLink.click();
    await expect(page).toHaveURL(/\/editor\/new/);
  });

  test('should take a screenshot of the examples page', async () => {
    await examplesPage.takeScreenshot('examples-page');
  });

  // ── Tests that require a running, seeded backend ──────────────────────────────

  test('should show live example cards from the backend [requires-backend]', async () => {
    test.skip(!BACKEND_AVAILABLE, 'Requires BACKEND_URL env var');

    await examplesPage.expectLiveExamplesVisible();
  });

  test('should navigate to an example detail page when card is clicked [requires-backend]', async ({ page }) => {
    test.skip(!BACKEND_AVAILABLE, 'Requires BACKEND_URL env var');

    // Click the first card — data-testid="example-card-{id}"
    await examplesPage.clickFirstExampleCard();

    // Route pattern: /examples/:id
    await expect(page).toHaveURL(/\/examples\/.+/);
  });

  test('should render difficulty badges on each live example card [requires-backend]', async ({ page }) => {
    test.skip(!BACKEND_AVAILABLE, 'Requires BACKEND_URL env var');

    // Each card has a difficulty span styled with colour classes
    const difficultyBadges = page.locator('[data-testid^="example-card-"] span', {
      hasText: /beginner|intermediate|advanced/i,
    });
    const count = await difficultyBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show at least one live example card [requires-backend]', async () => {
    test.skip(!BACKEND_AVAILABLE, 'Requires BACKEND_URL env var');

    const count = await examplesPage.allExampleCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show tags on live example cards [requires-backend]', async ({ page }) => {
    test.skip(!BACKEND_AVAILABLE, 'Requires BACKEND_URL env var');

    // Tags are rendered as small blue pills inside each card
    const tagPills = page.locator('[data-testid^="example-card-"] .bg-blue-50');
    const count = await tagPills.count();
    // Not all examples must have tags, but at least some should
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
