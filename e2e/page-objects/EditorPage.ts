/**
 * FSM Editor Page Object Model
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class EditorPage extends BasePage {
  // Locators
  get canvas(): Locator {
    return this.page.locator('[data-testid="fsm-canvas"]');
  }

  get reactFlowCanvas(): Locator {
    return this.page.locator('.react-flow');
  }

  get addStateButton(): Locator {
    return this.page.locator('[data-testid="add-state-btn"]');
  }

  get addTransitionButton(): Locator {
    return this.page.locator('[data-testid="add-transition-btn"]');
  }

  get deleteButton(): Locator {
    return this.page.locator('[data-testid="delete-btn"]');
  }

  get optimizeButton(): Locator {
    return this.page.locator('[data-testid="optimize-btn"]');
  }

  get exportButton(): Locator {
    return this.page.locator('[data-testid="export-btn"]');
  }

  get saveButton(): Locator {
    return this.page.locator('[data-testid="save-btn"]');
  }

  get algorithmSelector(): Locator {
    return this.page.locator('[data-testid="algorithm-selector"]');
  }

  get statePropertiesPanel(): Locator {
    return this.page.locator('[data-testid="state-properties"]');
  }

  get transitionPropertiesPanel(): Locator {
    return this.page.locator('[data-testid="transition-properties"]');
  }

  get undoButton(): Locator {
    return this.page.locator('[data-testid="undo-btn"]');
  }

  get redoButton(): Locator {
    return this.page.locator('[data-testid="redo-btn"]');
  }

  get zoomInButton(): Locator {
    return this.page.locator('[data-testid="zoom-in-btn"]');
  }

  get zoomOutButton(): Locator {
    return this.page.locator('[data-testid="zoom-out-btn"]');
  }

  get fitViewButton(): Locator {
    return this.page.locator('[data-testid="fit-view-btn"]');
  }

  // Navigation
  async goToEditor(): Promise<void> {
    await this.goto('/editor');
    await this.waitForPageLoad();
    await this.waitForCanvasReady();
  }

  async waitForCanvasReady(): Promise<void> {
    await this.canvas.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(500); // Wait for React Flow to initialize
  }

  // State operations
  async addState(x: number = 200, y: number = 200): Promise<void> {
    await this.addStateButton.click();
    await this.canvas.click({ position: { x, y } });
    await this.page.waitForTimeout(300);
  }

  async addStateWithDragAndDrop(x: number = 200, y: number = 200): Promise<void> {
    // Drag state from palette to canvas
    const statePalette = this.page.locator('[data-testid="state-palette-item"]');
    await statePalette.dragTo(this.canvas, {
      targetPosition: { x, y },
    });
  }

  async selectState(stateId: string): Promise<void> {
    await this.page.locator(`[data-id="${stateId}"]`).click();
  }

  async deleteState(stateId: string): Promise<void> {
    await this.selectState(stateId);
    await this.deleteButton.click();
  }

  async editStateProperties(stateId: string, properties: {
    name?: string;
    output?: string;
    isInitial?: boolean;
  }): Promise<void> {
    await this.selectState(stateId);
    await this.statePropertiesPanel.waitFor({ state: 'visible' });

    if (properties.name) {
      await this.page.fill('[data-testid="state-name-input"]', properties.name);
    }
    if (properties.output) {
      await this.page.fill('[data-testid="state-output-input"]', properties.output);
    }
    if (properties.isInitial !== undefined) {
      const checkbox = this.page.locator('[data-testid="state-initial-checkbox"]');
      const isChecked = await checkbox.isChecked();
      if (isChecked !== properties.isInitial) {
        await checkbox.click();
      }
    }
  }

  async moveState(stateId: string, x: number, y: number): Promise<void> {
    const stateNode = this.page.locator(`[data-id="${stateId}"]`);
    await stateNode.dragTo(this.canvas, {
      targetPosition: { x, y },
    });
  }

  // Transition operations
  async addTransition(fromStateId: string, toStateId: string): Promise<void> {
    const fromState = this.page.locator(`[data-id="${stateId}"]`);
    const toState = this.page.locator(`[data-id="${toStateId}"]`);

    // Click on source state handle and drag to target state
    const sourceHandle = fromState.locator('.react-flow__handle-right');
    await sourceHandle.hover();
    await this.page.mouse.down();

    const targetBox = await toState.boundingBox();
    if (targetBox) {
      await this.page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    }
    await this.page.mouse.up();
  }

  async selectTransition(transitionId: string): Promise<void> {
    await this.page.locator(`[data-id="${transitionId}"]`).click();
  }

  async deleteTransition(transitionId: string): Promise<void> {
    await this.selectTransition(transitionId);
    await this.deleteButton.click();
  }

  async editTransitionProperties(transitionId: string, properties: {
    input?: string;
    output?: string;
  }): Promise<void> {
    await this.selectTransition(transitionId);
    await this.transitionPropertiesPanel.waitFor({ state: 'visible' });

    if (properties.input) {
      await this.page.fill('[data-testid="transition-input-input"]', properties.input);
    }
    if (properties.output) {
      await this.page.fill('[data-testid="transition-output-input"]', properties.output);
    }
  }

  // Optimization operations
  async selectAlgorithm(algorithm: 'greedy' | 'bfs' | 'global'): Promise<void> {
    await this.algorithmSelector.click();
    await this.page.locator(`[data-value="${algorithm}"]`).click();
  }

  async optimize(algorithm?: 'greedy' | 'bfs' | 'global'): Promise<void> {
    if (algorithm) {
      await this.selectAlgorithm(algorithm);
    }
    await this.optimizeButton.click();
    await this.waitForLoading();
  }

  // Export operations
  async export(format: 'json' | 'csv' | 'verilog' | 'vhdl'): Promise<void> {
    await this.exportButton.click();
    await this.page.locator(`[data-testid="export-${format}-btn"]`).click();

    // Wait for download
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.locator('[data-testid="confirm-export-btn"]').click();
    const download = await downloadPromise;

    return download;
  }

  // Canvas operations
  async zoomIn(times: number = 1): Promise<void> {
    for (let i = 0; i < times; i++) {
      await this.zoomInButton.click();
      await this.page.waitForTimeout(200);
    }
  }

  async zoomOut(times: number = 1): Promise<void> {
    for (let i = 0; i < times; i++) {
      await this.zoomOutButton.click();
      await this.page.waitForTimeout(200);
    }
  }

  async fitView(): Promise<void> {
    await this.fitViewButton.click();
    await this.page.waitForTimeout(300);
  }

  async panCanvas(x: number, y: number): Promise<void> {
    const canvasBox = await this.canvas.boundingBox();
    if (canvasBox) {
      await this.page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
      await this.page.mouse.down();
      await this.page.mouse.move(canvasBox.x + canvasBox.width / 2 + x, canvasBox.y + canvasBox.height / 2 + y);
      await this.page.mouse.up();
    }
  }

  // Undo/Redo
  async undo(): Promise<void> {
    await this.undoButton.click();
  }

  async redo(): Promise<void> {
    await this.redoButton.click();
  }

  // Save
  async save(): Promise<void> {
    await this.saveButton.click();
    await this.expectSuccessMessage('FSM saved successfully');
  }

  // Assertions
  async expectEditorLoaded(): Promise<void> {
    await expect(this.canvas).toBeVisible();
    await expect(this.addStateButton).toBeVisible();
    await expect(this.optimizeButton).toBeVisible();
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

  async expectTransitionExists(transitionId: string): Promise<void> {
    await expect(this.page.locator(`[data-id="${transitionId}"]`)).toBeVisible();
  }

  async expectOptimizationComplete(): Promise<void> {
    await expect(this.page.locator('[data-testid="optimization-results"]')).toBeVisible();
  }
}
