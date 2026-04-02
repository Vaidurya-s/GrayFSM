/**
 * FSM Editor Page Object Model
 *
 * Selectors are matched to data-testid attributes in:
 *   frontend/src/pages/EditorPage.tsx
 *   frontend/src/components/fsm/FSMCanvas.tsx
 *   frontend/src/components/forms/FSMCreateForm.tsx
 */
import { Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class EditorPage extends BasePage {
  // ── Page root ───────────────────────────────────────────────────────────────

  /** The outermost wrapper rendered by EditorPage when it is ready */
  get editorPage(): Locator {
    return this.page.locator('[data-testid="editor-page"]');
  }

  // ── Toolbar buttons ──────────────────────────────────────────────────────────

  /** Hamburger button that opens/closes the property sidebar */
  get toggleSidebarButton(): Locator {
    return this.page.locator('[data-testid="editor-toggle-sidebar"]');
  }

  /**
   * "+ Add State" button in the toolbar (always visible when states already exist).
   * When the canvas is empty, use `addStateEmptyButton` instead.
   */
  get addStateButton(): Locator {
    return this.page.locator('[data-testid="editor-add-state"]');
  }

  /**
   * "Add First State" button shown on the empty-canvas placeholder.
   */
  get addStateEmptyButton(): Locator {
    return this.page.locator('[data-testid="editor-add-state-empty"]');
  }

  /**
   * Save / Create button in the toolbar.
   * Label changes to "Create" when no FSM id is present, "Save" when editing.
   */
  get saveButton(): Locator {
    return this.page.locator('[data-testid="editor-save"]');
  }

  /**
   * "Optimize" button — only visible when editing an existing FSM (has an id).
   */
  get optimizeButton(): Locator {
    return this.page.locator('[data-testid="editor-optimize"]');
  }

  // ── Sidebar / property panel ─────────────────────────────────────────────────

  get sidebar(): Locator {
    return this.page.locator('[data-testid="editor-sidebar"]');
  }

  // ── Canvas (ReactFlow) ───────────────────────────────────────────────────────

  /** The ReactFlow canvas wrapper */
  get canvas(): Locator {
    return this.page.locator('[data-testid="fsm-canvas"]');
  }

  /** ReactFlow internal canvas — useful for drag operations */
  get reactFlowCanvas(): Locator {
    return this.page.locator('.react-flow');
  }

  // ── Create FSM modal (shown when saving a brand-new unsaved FSM) ─────────────

  get createFSMModal(): Locator {
    return this.page.locator('[data-testid="create-fsm-modal"]');
  }

  get createFormNameInput(): Locator {
    return this.page.locator('[data-testid="fsm-form-name"]');
  }

  get createFormDescriptionInput(): Locator {
    return this.page.locator('[data-testid="fsm-form-description"]');
  }

  get createFormTypeSelect(): Locator {
    return this.page.locator('[data-testid="fsm-form-type"]');
  }

  get createFormVisibilitySelect(): Locator {
    return this.page.locator('[data-testid="fsm-form-visibility"]');
  }

  get createFormSubmitButton(): Locator {
    return this.page.locator('[data-testid="fsm-form-submit"]');
  }

  get createFormCancelButton(): Locator {
    return this.page.locator('[data-testid="fsm-form-cancel"]');
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  /** Navigate to the new-FSM editor page */
  async goToEditor(): Promise<void> {
    await this.goto('/editor/new');
    await this.waitForPageLoad();
    await this.waitForEditorReady();
  }

  /** Navigate to the editor for an existing FSM */
  async goToEditorForFSM(fsmId: string): Promise<void> {
    await this.goto(`/editor/${fsmId}`);
    await this.waitForPageLoad();
    await this.waitForEditorReady();
  }

  /** Wait until the editor page root is visible */
  async waitForEditorReady(): Promise<void> {
    await this.editorPage.waitFor({ state: 'visible', timeout: 10_000 });
  }

  // ── Canvas — wait until ReactFlow canvas is mounted ──────────────────────────

  async waitForCanvasReady(): Promise<void> {
    await this.canvas.waitFor({ state: 'visible', timeout: 10_000 });
    await this.page.waitForTimeout(500); // ReactFlow internal init
  }

  // ── State operations ─────────────────────────────────────────────────────────

  /**
   * Click the appropriate "Add State" button.
   * Uses the empty-state button if the canvas is empty, otherwise the toolbar button.
   */
  async addState(): Promise<void> {
    const emptyBtn = this.addStateEmptyButton;
    const toolbarBtn = this.addStateButton;

    const emptyVisible = await emptyBtn.isVisible().catch(() => false);
    if (emptyVisible) {
      await emptyBtn.click();
    } else {
      await toolbarBtn.click();
    }
    await this.page.waitForTimeout(300);
  }

  /** Click the toolbar "+ Add State" button, expecting it to be visible already */
  async addAdditionalState(): Promise<void> {
    await this.addStateButton.click();
    await this.page.waitForTimeout(300);
  }

  /** Click a ReactFlow node by its data-id attribute */
  async selectState(stateId: string): Promise<void> {
    await this.page.locator(`[data-id="${stateId}"]`).click();
  }

  // ── Transitions ───────────────────────────────────────────────────────────────

  /**
   * Draw a transition by dragging from the right handle of `fromStateId`
   * to the centre of `toStateId`.
   */
  async addTransition(fromStateId: string, toStateId: string): Promise<void> {
    const fromNode = this.page.locator(`[data-id="${fromStateId}"]`);
    const toNode = this.page.locator(`[data-id="${toStateId}"]`);

    const sourceHandle = fromNode.locator('.react-flow__handle-right');
    await sourceHandle.hover();
    await this.page.mouse.down();

    const targetBox = await toNode.boundingBox();
    if (targetBox) {
      await this.page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height / 2
      );
    }
    await this.page.mouse.up();
  }

  // ── Save / Create flow ────────────────────────────────────────────────────────

  /**
   * Click the Save/Create button and — if this is a new unsaved FSM — fill in
   * the create-modal and submit.
   *
   * @param options.name Required when creating a new FSM.
   * @param options.waitForRedirect When true, waits for navigation to the editor
   *   URL that includes the new FSM id.
   */
  async save(options?: {
    name?: string;
    fsmType?: 'moore' | 'mealy';
    visibility?: 'private' | 'public' | 'unlisted';
    waitForRedirect?: boolean;
  }): Promise<void> {
    await this.saveButton.click();

    // If the create-modal appeared, fill it in and submit.
    const modalVisible = await this.createFSMModal.isVisible().catch(() => false);
    if (modalVisible && options?.name) {
      await this.createFormNameInput.fill(options.name);
      if (options.fsmType) {
        await this.createFormTypeSelect.selectOption(options.fsmType);
      }
      if (options.visibility) {
        await this.createFormVisibilitySelect.selectOption(options.visibility);
      }
      await this.createFormSubmitButton.click();

      if (options.waitForRedirect !== false) {
        // After successful creation, the app redirects to /editor/<id>
        await this.page.waitForURL(/\/editor\/.+/, { timeout: 15_000 });
      }
    }
  }

  // ── Assertions ────────────────────────────────────────────────────────────────

  async expectEditorLoaded(): Promise<void> {
    await expect(this.editorPage).toBeVisible();
    await expect(this.saveButton).toBeVisible();
  }

  async expectStateCount(count: number): Promise<void> {
    const states = this.page.locator('.react-flow__node');
    await expect(states).toHaveCount(count);
  }

  async expectTransitionCount(count: number): Promise<void> {
    const edges = this.page.locator('.react-flow__edge');
    await expect(edges).toHaveCount(count);
  }

  async expectStateExists(stateId: string): Promise<void> {
    await expect(this.page.locator(`[data-id="${stateId}"]`)).toBeVisible();
  }

  async expectSidebarVisible(): Promise<void> {
    await expect(this.sidebar).toBeVisible();
  }

  async expectOptimizeButtonVisible(): Promise<void> {
    await expect(this.optimizeButton).toBeVisible();
  }
}
