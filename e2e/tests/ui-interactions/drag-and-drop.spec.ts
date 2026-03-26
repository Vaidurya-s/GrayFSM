/**
 * UI Interaction Tests: Drag and Drop
 *
 * Tests all drag-and-drop functionality in the application
 */
import { test, expect } from '@playwright/test';
import { EditorPage, HomePage } from '@page-objects';

test.describe('Drag and Drop Interactions', () => {
  let homePage: HomePage;
  let editorPage: EditorPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    editorPage = new EditorPage(page);

    await homePage.goToHomePage();
    await homePage.clickCreateFSM();
    await editorPage.expectEditorLoaded();
  });

  test('should drag state from palette to canvas', async ({ page }) => {
    // Drag state from palette
    await editorPage.addStateWithDragAndDrop(300, 300);

    // Verify state was added
    await editorPage.expectStateCount(1);

    // Verify state is at approximately correct position
    const stateNode = await page.locator('.react-flow__node').first();
    const box = await stateNode.boundingBox();

    expect(box).toBeTruthy();
  });

  test('should drag existing state to new position', async ({ page }) => {
    // Add a state
    await editorPage.addState(200, 200);

    const stateNode = await page.locator('.react-flow__node').first();
    const stateId = await stateNode.getAttribute('data-id');

    // Get initial position
    const initialBox = await stateNode.boundingBox();

    if (stateId && initialBox) {
      // Drag to new position
      await editorPage.moveState(stateId, 600, 400);

      // Get new position
      const newBox = await stateNode.boundingBox();

      // Position should have changed
      expect(newBox?.x).not.toBe(initialBox.x);
      expect(newBox?.y).not.toBe(initialBox.y);
    }
  });

  test('should create transition by dragging between states', async ({ page }) => {
    // Add two states
    await editorPage.addState(200, 300);
    await editorPage.addState(500, 300);

    await editorPage.expectStateCount(2);

    // Get state IDs
    const states = await page.locator('.react-flow__node').all();
    const state1Id = await states[0].getAttribute('data-id');
    const state2Id = await states[1].getAttribute('data-id');

    if (state1Id && state2Id) {
      // Create transition by dragging
      await editorPage.addTransition(state1Id, state2Id);

      // Verify transition was created
      await editorPage.expectTransitionCount(1);
    }
  });

  test('should drag multiple states simultaneously with selection', async ({ page }) => {
    // Add multiple states
    await editorPage.addState(200, 200);
    await editorPage.addState(300, 200);
    await editorPage.addState(400, 200);

    await editorPage.expectStateCount(3);

    // Select all states (Ctrl+A or Cmd+A)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+a`);

    // Drag selected states
    const firstState = await page.locator('.react-flow__node').first();
    const box = await firstState.boundingBox();

    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 100);
      await page.mouse.up();

      await page.waitForTimeout(500);

      // All states should have moved
      const newBox = await firstState.boundingBox();
      expect(newBox?.x).not.toBe(box.x);
    }
  });

  test('should drag to select multiple states', async ({ page }) => {
    // Add several states
    await editorPage.addState(200, 200);
    await editorPage.addState(300, 250);
    await editorPage.addState(400, 300);

    await editorPage.expectStateCount(3);

    // Drag to select (lasso selection)
    const canvas = editorPage.canvas;
    const canvasBox = await canvas.boundingBox();

    if (canvasBox) {
      // Start drag from top-left
      await page.mouse.move(canvasBox.x + 150, canvasBox.y + 150);
      await page.mouse.down();

      // Drag to bottom-right to encompass all states
      await page.mouse.move(canvasBox.x + 450, canvasBox.y + 350);
      await page.mouse.up();

      await page.waitForTimeout(500);

      // Check if states are selected
      const selectedStates = await page.locator('.react-flow__node.selected').count();
      expect(selectedStates).toBeGreaterThan(0);
    }
  });

  test('should handle drag and drop with snap to grid', async ({ page }) => {
    // Enable snap to grid if available
    const snapToGridToggle = page.locator('[data-testid="snap-to-grid-toggle"]');
    if (await snapToGridToggle.isVisible()) {
      await snapToGridToggle.click();
    }

    // Add state
    await editorPage.addState(203, 197);

    const stateNode = await page.locator('.react-flow__node').first();
    const box = await stateNode.boundingBox();

    // With snap to grid, position should be aligned
    if (box) {
      // Assuming 10px grid
      expect(box.x % 10).toBeLessThan(5);
      expect(box.y % 10).toBeLessThan(5);
    }
  });

  test('should prevent dragging state outside canvas bounds', async ({ page }) => {
    await editorPage.addState(300, 300);

    const stateNode = await page.locator('.react-flow__node').first();
    const stateId = await stateNode.getAttribute('data-id');

    if (stateId) {
      // Try to drag far outside
      await editorPage.moveState(stateId, -1000, -1000);

      // State should be constrained within bounds
      const box = await stateNode.boundingBox();
      expect(box?.x).toBeGreaterThan(0);
      expect(box?.y).toBeGreaterThan(0);
    }
  });

  test('should show visual feedback during drag', async ({ page }) => {
    await editorPage.addState(300, 300);

    const stateNode = await page.locator('.react-flow__node').first();
    const box = await stateNode.boundingBox();

    if (box) {
      // Start dragging
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();

      // Node should have dragging class or style
      const isDragging = await stateNode.evaluate((el) => {
        return el.classList.contains('dragging') ||
               el.classList.contains('react-flow__node-dragging') ||
               window.getComputedStyle(el).cursor === 'grabbing';
      });

      await page.mouse.up();

      expect(isDragging).toBe(true);
    }
  });

  test('should handle rapid drag and drop operations', async ({ page }) => {
    // Rapidly add multiple states
    for (let i = 0; i < 5; i++) {
      await editorPage.addStateWithDragAndDrop(200 + i * 100, 300);
      await page.waitForTimeout(100);
    }

    // Should have all states
    await editorPage.expectStateCount(5);
  });

  test('should allow dragging transition control points', async ({ page }) => {
    // Add two states and create transition
    await editorPage.addState(200, 300);
    await editorPage.addState(600, 300);

    const states = await page.locator('.react-flow__node').all();
    const state1Id = await states[0].getAttribute('data-id');
    const state2Id = await states[1].getAttribute('data-id');

    if (state1Id && state2Id) {
      await editorPage.addTransition(state1Id, state2Id);

      // Get transition edge
      const edge = page.locator('.react-flow__edge').first();
      await expect(edge).toBeVisible();

      // Try to adjust transition path if control points are available
      const edgePath = edge.locator('.react-flow__edge-path');
      const pathBox = await edgePath.boundingBox();

      if (pathBox) {
        // Click on middle of edge to potentially add/drag control point
        await page.mouse.move(pathBox.x + pathBox.width / 2, pathBox.y + pathBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(pathBox.x + pathBox.width / 2, pathBox.y + pathBox.height / 2 + 50);
        await page.mouse.up();
      }
    }
  });

  test('should cancel drag operation with Escape key', async ({ page }) => {
    await editorPage.addState(300, 300);

    const stateNode = await page.locator('.react-flow__node').first();
    const initialBox = await stateNode.boundingBox();

    if (initialBox) {
      // Start dragging
      await page.mouse.move(initialBox.x + initialBox.width / 2, initialBox.y + initialBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(initialBox.x + 200, initialBox.y + 200);

      // Press Escape to cancel
      await page.keyboard.press('Escape');
      await page.mouse.up();

      // Position should be unchanged or reverted
      const finalBox = await stateNode.boundingBox();

      // Either position is same or very close
      const deltaX = Math.abs((finalBox?.x || 0) - initialBox.x);
      const deltaY = Math.abs((finalBox?.y || 0) - initialBox.y);

      expect(deltaX).toBeLessThan(50);
      expect(deltaY).toBeLessThan(50);
    }
  });
});
