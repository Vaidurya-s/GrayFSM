/**
 * Custom test fixtures for Playwright
 */
import { test as base } from '@playwright/test';
import { HomePage, EditorPage, ExamplesPage, ImportPage, ComparisonPage } from '../page-objects';

type MyFixtures = {
  homePage: HomePage;
  editorPage: EditorPage;
  examplesPage: ExamplesPage;
  importPage: ImportPage;
  comparisonPage: ComparisonPage;
};

/**
 * Extended test with custom fixtures
 * All page objects are automatically initialized
 */
export const test = base.extend<MyFixtures>({
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await use(homePage);
  },

  editorPage: async ({ page }, use) => {
    const editorPage = new EditorPage(page);
    await use(editorPage);
  },

  examplesPage: async ({ page }, use) => {
    const examplesPage = new ExamplesPage(page);
    await use(examplesPage);
  },

  importPage: async ({ page }, use) => {
    const importPage = new ImportPage(page);
    await use(importPage);
  },

  comparisonPage: async ({ page }, use) => {
    const comparisonPage = new ComparisonPage(page);
    await use(comparisonPage);
  },
});

export { expect } from '@playwright/test';
