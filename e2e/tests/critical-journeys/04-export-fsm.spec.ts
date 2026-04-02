/**
 * Critical User Journey: Export FSM
 *
 * Tests the export workflow at /export/:id.
 *
 * Tests that call the backend (generateExport / download) require:
 *   BACKEND_URL=http://localhost:8000 TEST_FSM_ID=<uuid> npx playwright test 04-export-fsm
 *
 * Tests that only interact with the form UI run without a backend.
 */
import { test, expect } from '@playwright/test';
import { ExportPage } from '@page-objects';

const TEST_FSM_ID = process.env.TEST_FSM_ID ?? '';
const BACKEND_AVAILABLE = !!process.env.BACKEND_URL && !!TEST_FSM_ID;

test.describe('Export FSM', () => {
  let exportPage: ExportPage;

  test.beforeEach(async ({ page }) => {
    test.skip(!BACKEND_AVAILABLE, 'Requires BACKEND_URL and TEST_FSM_ID env vars');
    exportPage = new ExportPage(page);
    await exportPage.goToExportPage(TEST_FSM_ID);
  });

  // ── Page load ─────────────────────────────────────────────────────────────────

  test('should load the export page for an existing FSM', async () => {
    await exportPage.expectExportPageLoaded();
  });

  test('should show the export form with format options', async () => {
    await expect(exportPage.exportForm).toBeVisible();
    await expect(exportPage.submitButton).toBeVisible();

    // All format radio buttons should be present
    for (const fmt of ['verilog', 'vhdl', 'json', 'csv', 'testbench'] as const) {
      await expect(exportPage.formatRadio(fmt)).toBeAttached();
    }
  });

  // ── Format selection (UI-only) ────────────────────────────────────────────────

  test('should show HDL options when verilog format is selected', async () => {
    await exportPage.selectFormat('verilog');

    await expect(exportPage.moduleNameInput).toBeVisible();
    await expect(exportPage.styleSelect).toBeVisible();
    await expect(exportPage.includeCommentsCheckbox).toBeVisible();
  });

  test('should show HDL options when vhdl format is selected', async () => {
    await exportPage.selectFormat('vhdl');

    await expect(exportPage.moduleNameInput).toBeVisible();
    await expect(exportPage.styleSelect).toBeVisible();
    await expect(exportPage.includeCommentsCheckbox).toBeVisible();
  });

  test('should hide HDL options when json format is selected', async () => {
    await exportPage.selectFormat('json');

    await expect(exportPage.moduleNameInput).not.toBeVisible();
    await expect(exportPage.styleSelect).not.toBeVisible();
  });

  test('should hide HDL options when csv format is selected', async () => {
    await exportPage.selectFormat('csv');

    await expect(exportPage.moduleNameInput).not.toBeVisible();
  });

  test('should allow entering a custom module name', async () => {
    await exportPage.selectFormat('verilog');
    await exportPage.setModuleName('my_traffic_light');

    const value = await exportPage.moduleNameInput.inputValue();
    expect(value).toBe('my_traffic_light');
  });

  test('should allow changing code style', async () => {
    await exportPage.selectFormat('verilog');
    await exportPage.setStyle('compact');

    const value = await exportPage.styleSelect.inputValue();
    expect(value).toBe('compact');
  });

  test('should allow toggling include-comments checkbox', async () => {
    await exportPage.selectFormat('verilog');

    // Default is checked
    const initialState = await exportPage.includeCommentsCheckbox.isChecked();
    await exportPage.setIncludeComments(!initialState);

    const newState = await exportPage.includeCommentsCheckbox.isChecked();
    expect(newState).toBe(!initialState);
  });

  // ── Export generation (requires backend) ──────────────────────────────────────

  test('should generate and preview a Verilog export', async () => {
    await exportPage.selectFormat('verilog');
    await exportPage.generateExport();

    await exportPage.expectPreviewVisible();
    await exportPage.expectValidVerilogPreview();
    await exportPage.expectDownloadButtonVisible();
    await exportPage.expectCopyButtonVisible();

    await exportPage.takeScreenshot('export-verilog-preview');
  });

  test('should generate and preview a VHDL export', async () => {
    await exportPage.selectFormat('vhdl');
    await exportPage.generateExport();

    await exportPage.expectPreviewVisible();
    await exportPage.expectValidVHDLPreview();
  });

  test('should generate a JSON export', async () => {
    await exportPage.selectFormat('json');
    await exportPage.generateExport();

    await exportPage.expectPreviewVisible();

    const content = await exportPage.getPreviewContent();
    // Basic sanity: the JSON export should start with a brace
    expect(content.trim()).toMatch(/^\{/);
  });

  test('should generate a CSV export', async () => {
    await exportPage.selectFormat('csv');
    await exportPage.generateExport();

    await exportPage.expectPreviewVisible();
  });

  test('should respect module name in verilog preview', async () => {
    await exportPage.selectFormat('verilog');
    await exportPage.setModuleName('my_fsm_module');
    await exportPage.generateExport();

    await exportPage.expectPreviewContains('my_fsm_module');
  });

  test('should trigger a file download when Download is clicked', async () => {
    await exportPage.selectFormat('verilog');
    await exportPage.generateExport();

    const download = await exportPage.downloadExport();
    expect(download.suggestedFilename()).toBeTruthy();
  });

  test('should show copy and download buttons after generation', async () => {
    await exportPage.selectFormat('json');
    await exportPage.generateExport();

    await exportPage.expectCopyButtonVisible();
    await exportPage.expectDownloadButtonVisible();
  });

  test('should generate testbench format with HDL options', async () => {
    await exportPage.selectFormat('testbench');

    // Testbench is an HDL format — HDL options should show
    await expect(exportPage.moduleNameInput).toBeVisible();
    await exportPage.generateExport();
    await exportPage.expectPreviewVisible();
  });

  test('should take screenshot of export page', async () => {
    await exportPage.selectFormat('verilog');
    await exportPage.generateExport();

    await exportPage.takeScreenshot('export-page-verilog');
  });
});
