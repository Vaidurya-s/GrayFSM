/**
 * Critical User Journey: Import FSM
 *
 * Tests importing FSM from various formats (JSON, CSV)
 */
import { test, expect } from '@playwright/test';
import { HomePage, ImportPage, EditorPage } from '@page-objects';
import { trafficLightFSM, vendingMachineFSM, csvFSMData } from '@fixtures/fsm-examples';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Import FSM', () => {
  let homePage: HomePage;
  let importPage: ImportPage;
  let editorPage: EditorPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    importPage = new ImportPage(page);
    editorPage = new EditorPage(page);
  });

  test('should import FSM from JSON file', async ({ page }) => {
    // Create temporary JSON file
    const tempDir = '/tmp/claude/e2e-test-data';
    await fs.promises.mkdir(tempDir, { recursive: true });
    const jsonPath = path.join(tempDir, 'traffic-light.json');
    await fs.promises.writeFile(jsonPath, JSON.stringify(trafficLightFSM, null, 2));

    // Navigate to import page
    await homePage.goToHomePage();
    await homePage.clickImportFSM();

    // Upload file
    await importPage.uploadFile(jsonPath);
    await importPage.expectPreviewVisible();

    // Verify preview shows FSM
    await importPage.expectStateCountInPreview(4);
    await importPage.expectTransitionCountInPreview(4);

    // Import to editor
    await importPage.import();

    // Verify redirect to editor
    await expect(page).toHaveURL(/.*editor/);
    await editorPage.expectStateCount(4);

    // Cleanup
    await fs.promises.unlink(jsonPath);
  });

  test('should import FSM from CSV file', async ({ page }) => {
    // Create temporary CSV file
    const tempDir = '/tmp/claude/e2e-test-data';
    await fs.promises.mkdir(tempDir, { recursive: true });
    const csvPath = path.join(tempDir, 'simple-fsm.csv');
    await fs.promises.writeFile(csvPath, csvFSMData);

    // Navigate to import page
    await homePage.goToHomePage();
    await homePage.clickImportFSM();

    // Upload CSV
    await importPage.uploadFile(csvPath);
    await importPage.expectPreviewVisible();

    // Import
    await importPage.import();

    // Verify in editor
    await expect(page).toHaveURL(/.*editor/);
    await editorPage.expectStateCount(3);

    // Cleanup
    await fs.promises.unlink(csvPath);
  });

  test('should import FSM by pasting JSON', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();

    // Paste JSON
    await importPage.pasteJSON(JSON.stringify(vendingMachineFSM));
    await importPage.expectPreviewVisible();

    // Verify preview
    await importPage.expectStateCountInPreview(4);

    // Import
    await importPage.import();

    // Verify in editor
    await editorPage.expectStateCount(4);
  });

  test('should handle invalid JSON gracefully', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();

    // Paste invalid JSON
    await importPage.pasteJSON('{ invalid json }');

    // Expect error message
    await importPage.expectErrorMessage('Invalid JSON format');
  });

  test('should validate FSM structure', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();

    // Invalid FSM - missing required fields
    const invalidFSM = {
      type: 'moore',
      states: ['A', 'B'],
      // Missing initial_state
      transitions: [],
    };

    await importPage.pasteJSON(JSON.stringify(invalidFSM));

    // Expect validation error
    await importPage.expectErrorMessage('Missing required field: initial_state');
  });

  test('should detect invalid state references', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();

    const invalidFSM = {
      type: 'moore',
      states: ['A', 'B'],
      initial_state: 'C', // Invalid - state doesn't exist
      transitions: [],
      outputs: { A: '0', B: '1' },
    };

    await importPage.pasteJSON(JSON.stringify(invalidFSM));

    // Expect validation error
    await importPage.expectErrorMessage('Initial state "C" not found in states list');
  });

  test('should import large FSM successfully', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();

    // Create large FSM
    const largeFSM = {
      type: 'moore',
      states: Array.from({ length: 32 }, (_, i) => `S${i}`),
      initial_state: 'S0',
      transitions: Array.from({ length: 32 }, (_, i) => ({
        from_state: `S${i}`,
        to_state: `S${(i + 1) % 32}`,
        input: `${i % 2}`,
      })),
      outputs: Object.fromEntries(
        Array.from({ length: 32 }, (_, i) => [`S${i}`, i.toString(2).padStart(5, '0')])
      ),
    };

    await importPage.pasteJSON(JSON.stringify(largeFSM));
    await importPage.expectPreviewVisible();
    await importPage.import();

    // Verify in editor
    await editorPage.expectStateCount(32);
  });

  test('should support both Moore and Mealy machines', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();

    // Mealy machine
    const mealyFSM = {
      type: 'mealy',
      states: ['S0', 'S1', 'S2'],
      initial_state: 'S0',
      transitions: [
        { from_state: 'S0', to_state: 'S1', input: '0', output: '0' },
        { from_state: 'S1', to_state: 'S2', input: '1', output: '1' },
        { from_state: 'S2', to_state: 'S0', input: '0', output: '0' },
      ],
    };

    await importPage.pasteJSON(JSON.stringify(mealyFSM));
    await importPage.expectPreviewVisible();
    await importPage.import();

    await editorPage.expectStateCount(3);
  });

  test('should show file upload progress for large files', async ({ page }) => {
    const tempDir = '/tmp/claude/e2e-test-data';
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Create very large FSM
    const veryLargeFSM = {
      type: 'moore',
      states: Array.from({ length: 100 }, (_, i) => `S${i}`),
      initial_state: 'S0',
      transitions: Array.from({ length: 100 }, (_, i) => ({
        from_state: `S${i}`,
        to_state: `S${(i + 1) % 100}`,
        input: `${i % 2}`,
      })),
      outputs: Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [`S${i}`, i.toString(2).padStart(7, '0')])
      ),
    };

    const largePath = path.join(tempDir, 'large-fsm.json');
    await fs.promises.writeFile(largePath, JSON.stringify(veryLargeFSM, null, 2));

    await homePage.goToHomePage();
    await homePage.clickImportFSM();

    await importPage.uploadFile(largePath);

    // Expect loading indicator during parsing
    await expect(page.locator('[data-testid="parsing-indicator"]')).toBeVisible();
    await importPage.expectPreviewVisible();

    // Cleanup
    await fs.promises.unlink(largePath);
  });

  test('should allow re-importing after error', async ({ page }) => {
    await homePage.goToHomePage();
    await homePage.clickImportFSM();

    // First import - invalid
    await importPage.pasteJSON('{ invalid }');
    await importPage.expectErrorMessage();

    // Clear and try again with valid FSM
    await importPage.clearInput();
    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.expectPreviewVisible();
    await importPage.import();

    // Should succeed
    await editorPage.expectStateCount(4);
  });
});
