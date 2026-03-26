/**
 * Critical User Journey: Create FSM from Scratch
 *
 * This test covers the complete workflow of creating an FSM
 * from scratch using the drag-and-drop editor.
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

  test('should create a simple FSM with states and transitions', async ({ page }) => {
    // Navigate to editor
    await homePage.clickCreateFSM();
    await editorPage.expectEditorLoaded();

    // Add states
    await editorPage.addState(200, 200);
    await editorPage.addState(400, 200);
    await editorPage.addState(300, 400);

    // Verify states added
    await editorPage.expectStateCount(3);

    // Take screenshot of initial states
    await editorPage.takeScreenshot('fsm-creation-states-added');

    // Add transitions between states
    // Note: This assumes states are auto-assigned IDs
    const stateNodes = await page.locator('.react-flow__node').all();
    if (stateNodes.length >= 3) {
      const state1Id = await stateNodes[0].getAttribute('data-id');
      const state2Id = await stateNodes[1].getAttribute('data-id');
      const state3Id = await stateNodes[2].getAttribute('data-id');

      if (state1Id && state2Id && state3Id) {
        await editorPage.addTransition(state1Id, state2Id);
        await editorPage.addTransition(state2Id, state3Id);
        await editorPage.addTransition(state3Id, state1Id);
      }
    }

    // Verify transitions added
    await editorPage.expectTransitionCount(3);

    // Take final screenshot
    await editorPage.takeScreenshot('fsm-creation-complete');
  });

  test('should edit state properties', async ({ page }) => {
    await homePage.clickCreateFSM();
    await editorPage.expectEditorLoaded();

    // Add a state
    await editorPage.addState(300, 300);

    // Get the state ID
    const stateNode = await page.locator('.react-flow__node').first();
    const stateId = await stateNode.getAttribute('data-id');

    if (stateId) {
      // Edit state properties
      await editorPage.editStateProperties(stateId, {
        name: 'InitialState',
        output: '000',
        isInitial: true,
      });

      // Verify changes
      await expect(stateNode).toContainText('InitialState');
    }
  });

  test('should use drag and drop to add states', async ({ page }) => {
    await homePage.clickCreateFSM();
    await editorPage.expectEditorLoaded();

    // Add states using drag and drop from palette
    await editorPage.addStateWithDragAndDrop(250, 200);
    await editorPage.addStateWithDragAndDrop(450, 200);
    await editorPage.addStateWithDragAndDrop(350, 400);

    await editorPage.expectStateCount(3);
  });

  test('should move states by dragging', async ({ page }) => {
    await homePage.clickCreateFSM();
    await editorPage.expectEditorLoaded();

    // Add a state
    await editorPage.addState(200, 200);

    const stateNode = await page.locator('.react-flow__node').first();
    const stateId = await stateNode.getAttribute('data-id');

    if (stateId) {
      // Get initial position
      const initialBox = await stateNode.boundingBox();

      // Move state
      await editorPage.moveState(stateId, 400, 400);

      // Verify position changed
      const newBox = await stateNode.boundingBox();
      expect(newBox?.x).not.toBe(initialBox?.x);
      expect(newBox?.y).not.toBe(initialBox?.y);
    }
  });

  test('should delete states and transitions', async ({ page }) => {
    await homePage.clickCreateFSM();
    await editorPage.expectEditorLoaded();

    // Add states
    await editorPage.addState(200, 200);
    await editorPage.addState(400, 200);

    await editorPage.expectStateCount(2);

    // Get state IDs
    const stateNodes = await page.locator('.react-flow__node').all();
    const state1Id = await stateNodes[0].getAttribute('data-id');
    const state2Id = await stateNodes[1].getAttribute('data-id');

    if (state1Id && state2Id) {
      // Add transition
      await editorPage.addTransition(state1Id, state2Id);
      await editorPage.expectTransitionCount(1);

      // Delete a state
      await editorPage.deleteState(state2Id);
      await editorPage.expectStateCount(1);

      // Transition should also be deleted
      await editorPage.expectTransitionCount(0);
    }
  });

  test('should undo and redo operations', async ({ page }) => {
    await homePage.clickCreateFSM();
    await editorPage.expectEditorLoaded();

    // Add a state
    await editorPage.addState(300, 300);
    await editorPage.expectStateCount(1);

    // Undo
    await editorPage.undo();
    await editorPage.expectStateCount(0);

    // Redo
    await editorPage.redo();
    await editorPage.expectStateCount(1);
  });

  test('should save FSM', async ({ page }) => {
    await homePage.clickCreateFSM();
    await editorPage.expectEditorLoaded();

    // Create a simple FSM
    await editorPage.addState(300, 300);
    await editorPage.addState(500, 300);

    // Save
    await editorPage.save();

    // Verify success message
    await editorPage.expectSuccessMessage('FSM saved successfully');
  });

  test('should zoom and pan canvas', async ({ page }) => {
    await homePage.clickCreateFSM();
    await editorPage.expectEditorLoaded();

    // Add states to have something to see
    await editorPage.addState(300, 300);

    // Zoom in
    await editorPage.zoomIn(2);
    await page.waitForTimeout(500);

    // Zoom out
    await editorPage.zoomOut(2);
    await page.waitForTimeout(500);

    // Fit view
    await editorPage.fitView();
    await page.waitForTimeout(500);

    // Pan canvas
    await editorPage.panCanvas(100, 100);
    await page.waitForTimeout(500);
  });

  test('should create a traffic light FSM', async ({ page }) => {
    await homePage.clickCreateFSM();
    await editorPage.expectEditorLoaded();

    // Add four states for traffic light
    await editorPage.addState(200, 200); // Red
    await editorPage.addState(500, 200); // Green
    await editorPage.addState(350, 400); // Yellow
    await editorPage.addState(200, 400); // RedYellow

    await editorPage.expectStateCount(4);

    // Get state IDs
    const stateNodes = await page.locator('.react-flow__node').all();
    const stateIds = await Promise.all(
      stateNodes.map(node => node.getAttribute('data-id'))
    );

    // Name the states
    if (stateIds[0]) await editorPage.editStateProperties(stateIds[0], { name: 'Red', output: '100' });
    if (stateIds[1]) await editorPage.editStateProperties(stateIds[1], { name: 'Green', output: '001' });
    if (stateIds[2]) await editorPage.editStateProperties(stateIds[2], { name: 'Yellow', output: '010' });
    if (stateIds[3]) await editorPage.editStateProperties(stateIds[3], { name: 'RedYellow', output: '110' });

    // Create transitions (circular pattern)
    if (stateIds[0] && stateIds[3]) await editorPage.addTransition(stateIds[0], stateIds[3]);
    if (stateIds[3] && stateIds[1]) await editorPage.addTransition(stateIds[3], stateIds[1]);
    if (stateIds[1] && stateIds[2]) await editorPage.addTransition(stateIds[1], stateIds[2]);
    if (stateIds[2] && stateIds[0]) await editorPage.addTransition(stateIds[2], stateIds[0]);

    await editorPage.expectTransitionCount(4);

    // Take screenshot
    await editorPage.takeScreenshot('traffic-light-fsm');

    // Save
    await editorPage.save();
  });
});
