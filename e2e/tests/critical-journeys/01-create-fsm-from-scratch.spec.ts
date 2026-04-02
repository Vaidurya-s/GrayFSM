/**
 * Critical User Journey: Create FSM from Scratch
 *
 * Covers the workflow of navigating to /editor/new, adding states via the
 * toolbar button, and saving (which opens the FSMCreateForm modal).
 *
 * Tests that interact with the backend (save / create) are marked with a
 * comment so CI can skip them when no backend is running.
 */
import { test, expect } from '@playwright/test';
import { EditorPage, HomePage } from '@page-objects';

test.describe('Create FSM from Scratch', () => {
  let homePage: HomePage;
  let editorPage: EditorPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    editorPage = new EditorPage(page);

    await homePage.goToHomePage();
  });

  // ── Pure front-end tests (no backend required) ──────────────────────────────

  test('should navigate to the editor via the navbar button', async ({ page }) => {
    await homePage.clickCreateFSM();
    await editorPage.expectEditorLoaded();
    await expect(page).toHaveURL(/\/editor\/new/);
  });

  test('should show empty-state prompt when there are no states', async () => {
    await editorPage.goToEditor();
    // "Add First State" button only exists in the empty placeholder
    await expect(editorPage.addStateEmptyButton).toBeVisible();
  });

  test('should add a state using the empty-state button', async () => {
    await editorPage.goToEditor();
    await editorPage.addState(); // clicks editor-add-state-empty

    // After adding the first state the ReactFlow canvas should appear
    await expect(editorPage.canvas).toBeVisible();
    await editorPage.expectStateCount(1);
  });

  test('should add multiple states using the toolbar button', async () => {
    await editorPage.goToEditor();

    // First state via empty-state button
    await editorPage.addState();
    await editorPage.expectStateCount(1);

    // Subsequent states via toolbar button
    await editorPage.addAdditionalState();
    await editorPage.expectStateCount(2);

    await editorPage.addAdditionalState();
    await editorPage.expectStateCount(3);

    await editorPage.takeScreenshot('fsm-creation-three-states');
  });

  test('should toggle the sidebar with the toolbar hamburger button', async () => {
    await editorPage.goToEditor();

    // Add a state so the canvas is rendered (sidebar only shows with canvas)
    await editorPage.addState();

    // Sidebar should be open by default
    await expect(editorPage.sidebar).toBeVisible();

    // Toggle closed
    await editorPage.toggleSidebarButton.click();
    await expect(editorPage.sidebar).not.toBeVisible();

    // Toggle open again
    await editorPage.toggleSidebarButton.click();
    await expect(editorPage.sidebar).toBeVisible();
  });

  test('should show the Create FSM modal when saving a new unsaved FSM', async () => {
    await editorPage.goToEditor();
    await editorPage.addState();

    // Clicking Save on a new (unsaved) FSM opens the create modal
    await editorPage.saveButton.click();
    await expect(editorPage.createFSMModal).toBeVisible();
    await expect(editorPage.createFormNameInput).toBeVisible();
    await expect(editorPage.createFormTypeSelect).toBeVisible();
    await expect(editorPage.createFormVisibilitySelect).toBeVisible();
  });

  test('should dismiss the Create FSM modal via Cancel', async () => {
    await editorPage.goToEditor();
    await editorPage.addState();

    await editorPage.saveButton.click();
    await expect(editorPage.createFSMModal).toBeVisible();

    await editorPage.createFormCancelButton.click();
    await expect(editorPage.createFSMModal).not.toBeVisible();
  });

  test('should add states using the toolbar after the first state', async () => {
    await editorPage.goToEditor();

    await editorPage.addState();
    await editorPage.addAdditionalState();
    await editorPage.addAdditionalState();
    await editorPage.addAdditionalState();

    await editorPage.expectStateCount(4);
    await editorPage.takeScreenshot('fsm-creation-four-states');
  });

  // ── Tests that require a running backend ────────────────────────────────────

  // NOTE: The tests below interact with the API to persist FSMs.
  // They will fail if the backend is not running.  Run them with:
  //   BACKEND_URL=http://localhost:8000 npx playwright test 01-create-fsm-from-scratch

  test('should create and save a new FSM via the modal [requires-backend]', async ({ page }) => {
    // Skip when backend is not available
    test.skip(
      !process.env.BACKEND_URL,
      'Requires a running backend (set BACKEND_URL to enable)'
    );

    await editorPage.goToEditor();
    await editorPage.addState();
    await editorPage.addAdditionalState();

    await editorPage.save({ name: 'E2E Test FSM', fsmType: 'moore', waitForRedirect: true });

    // After creation the app navigates to /editor/<new-id>
    await expect(page).toHaveURL(/\/editor\/.+/);
    await editorPage.expectEditorLoaded();

    // The Optimize button is now visible because we have an FSM id
    await editorPage.expectOptimizeButtonVisible();
  });

  test('should add a traffic light FSM and save [requires-backend]', async ({ page }) => {
    test.skip(
      !process.env.BACKEND_URL,
      'Requires a running backend (set BACKEND_URL to enable)'
    );

    await editorPage.goToEditor();

    // Add four states
    await editorPage.addState();
    await editorPage.addAdditionalState();
    await editorPage.addAdditionalState();
    await editorPage.addAdditionalState();

    await editorPage.expectStateCount(4);

    // Save with a name
    await editorPage.save({ name: 'Traffic Light', fsmType: 'moore', waitForRedirect: true });

    await expect(page).toHaveURL(/\/editor\/.+/);
    await editorPage.expectEditorLoaded();
    await editorPage.takeScreenshot('traffic-light-fsm-saved');
  });
});
