/**
 * Critical User Journey: Export FSM
 *
 * Tests exporting optimized FSM to various formats
 */
import { test, expect } from '@playwright/test';
import { HomePage, ImportPage, EditorPage, OptimizationPage, ExportPage } from '@page-objects';
import { trafficLightFSM, vendingMachineFSM } from '@fixtures/fsm-examples';
import * as fs from 'fs';

test.describe('Export FSM', () => {
  let homePage: HomePage;
  let importPage: ImportPage;
  let editorPage: EditorPage;
  let optimizationPage: OptimizationPage;
  let exportPage: ExportPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    importPage = new ImportPage(page);
    editorPage = new EditorPage(page);
    optimizationPage = new OptimizationPage(page);
    exportPage = new ExportPage(page);

    // Setup: Import and optimize an FSM
    await homePage.goToHomePage();
    await homePage.clickImportFSM();
    await importPage.pasteJSON(JSON.stringify(trafficLightFSM));
    await importPage.import();
    await editorPage.optimize('greedy');
    await optimizationPage.expectOptimizationResultsLoaded();
  });

  test('should export optimized FSM as JSON', async ({ page }) => {
    const download = await optimizationPage.exportResults('json');

    // Verify download occurred
    expect(download).toBeTruthy();
    expect(download.suggestedFilename()).toContain('.json');

    // Download and verify content
    const downloadPath = `/tmp/claude/downloads/${download.suggestedFilename()}`;
    await download.saveAs(downloadPath);

    // Verify file exists and is valid JSON
    const content = await fs.promises.readFile(downloadPath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed).toHaveProperty('type');
    expect(parsed).toHaveProperty('states');
    expect(parsed).toHaveProperty('transitions');
    expect(parsed).toHaveProperty('dummy_states');

    // Cleanup
    await fs.promises.unlink(downloadPath);
  });

  test('should export optimized FSM as CSV', async ({ page }) => {
    const download = await optimizationPage.exportResults('csv');

    expect(download).toBeTruthy();
    expect(download.suggestedFilename()).toContain('.csv');

    // Download and verify CSV format
    const downloadPath = `/tmp/claude/downloads/${download.suggestedFilename()}`;
    await download.saveAs(downloadPath);

    const content = await fs.promises.readFile(downloadPath, 'utf-8');

    // CSV should have header row
    expect(content).toContain('from_state');
    expect(content).toContain('to_state');

    // Cleanup
    await fs.promises.unlink(downloadPath);
  });

  test('should export optimized FSM as Verilog', async ({ page }) => {
    const download = await optimizationPage.exportAsVerilog();

    expect(download).toBeTruthy();
    expect(download.suggestedFilename()).toMatch(/\.v$/);

    // Download and verify Verilog syntax
    const downloadPath = `/tmp/claude/downloads/${download.suggestedFilename()}`;
    await download.saveAs(downloadPath);

    const content = await fs.promises.readFile(downloadPath, 'utf-8');

    // Verify Verilog syntax
    expect(content).toContain('module');
    expect(content).toContain('endmodule');
    expect(content).toContain('always');
    expect(content).toContain('case');
    expect(content).toMatch(/localparam.*Gray code/i);

    // Should contain comments about dummy states
    expect(content).toMatch(/dummy/i);

    // Cleanup
    await fs.promises.unlink(downloadPath);
  });

  test('should export optimized FSM as VHDL', async ({ page }) => {
    const download = await optimizationPage.exportAsVHDL();

    expect(download).toBeTruthy();
    expect(download.suggestedFilename()).toMatch(/\.vhd$/);

    // Download and verify VHDL syntax
    const downloadPath = `/tmp/claude/downloads/${download.suggestedFilename()}`;
    await download.saveAs(downloadPath);

    const content = await fs.promises.readFile(downloadPath, 'utf-8');

    // Verify VHDL syntax
    expect(content).toContain('entity');
    expect(content).toContain('end entity');
    expect(content).toContain('architecture');
    expect(content).toContain('process');
    expect(content).toContain('case');

    // Cleanup
    await fs.promises.unlink(downloadPath);
  });

  test('should customize Verilog export options', async ({ page }) => {
    // Navigate to export page
    await optimizationPage.page.click('[data-testid="advanced-export-btn"]');
    await exportPage.expectExportPageLoaded();

    // Configure Verilog export
    await exportPage.selectFormat('verilog');
    await exportPage.setModuleName('traffic_light_fsm');
    await exportPage.setClockEdge('posedge');
    await exportPage.setResetType('async');
    await exportPage.setIncludeComments(true);
    await exportPage.setIncludeTestbench(true);

    // Preview
    await exportPage.showPreview();
    await exportPage.expectPreviewVisible();

    // Verify preview contains module name
    await exportPage.expectPreviewContains('traffic_light_fsm');

    // Download
    const download = await exportPage.download();
    expect(download).toBeTruthy();
  });

  test('should show syntax highlighting in preview', async ({ page }) => {
    await optimizationPage.page.click('[data-testid="advanced-export-btn"]');
    await exportPage.expectExportPageLoaded();

    await exportPage.selectFormat('verilog');
    await exportPage.showPreview();

    // Verify syntax highlighting is active
    await exportPage.expectSyntaxHighlightingActive();
  });

  test('should export with testbench generation', async ({ page }) => {
    await optimizationPage.page.click('[data-testid="advanced-export-btn"]');
    await exportPage.expectExportPageLoaded();

    await exportPage.selectFormat('verilog');
    await exportPage.setIncludeTestbench(true);

    await exportPage.showPreview();
    const content = await exportPage.getPreviewContent();

    // Testbench should include test module
    expect(content).toContain('_tb'); // testbench suffix
    expect(content).toContain('initial'); // testbench initial block
  });

  test('should copy code to clipboard', async ({ page }) => {
    await optimizationPage.page.click('[data-testid="advanced-export-btn"]');
    await exportPage.expectExportPageLoaded();

    await exportPage.selectFormat('verilog');
    await exportPage.showPreview();

    // Copy to clipboard
    await exportPage.copyToClipboard();

    // Should show success message
    await exportPage.expectSuccessMessage('Copied to clipboard');
  });

  test('should export with synchronous vs asynchronous reset', async ({ page }) => {
    await optimizationPage.page.click('[data-testid="advanced-export-btn"]');
    await exportPage.expectExportPageLoaded();

    await exportPage.selectFormat('verilog');

    // Test async reset
    await exportPage.setResetType('async');
    await exportPage.showPreview();
    let content = await exportPage.getPreviewContent();
    expect(content).toMatch(/posedge.*reset|negedge.*reset/); // Async reset in sensitivity list

    // Test sync reset
    await exportPage.setResetType('sync');
    await exportPage.showPreview();
    content = await exportPage.getPreviewContent();
    expect(content).toMatch(/posedge.*clk/); // Sync reset only has clock
  });

  test('should export with positive vs negative edge clock', async ({ page }) => {
    await optimizationPage.page.click('[data-testid="advanced-export-btn"]');
    await exportPage.expectExportPageLoaded();

    await exportPage.selectFormat('verilog');

    // Test posedge
    await exportPage.setClockEdge('posedge');
    await exportPage.showPreview();
    let content = await exportPage.getPreviewContent();
    expect(content).toContain('posedge clk');

    // Test negedge
    await exportPage.setClockEdge('negedge');
    await exportPage.showPreview();
    content = await exportPage.getPreviewContent();
    expect(content).toContain('negedge clk');
  });

  test('should validate VHDL syntax in preview', async ({ page }) => {
    await optimizationPage.page.click('[data-testid="advanced-export-btn"]');
    await exportPage.expectExportPageLoaded();

    await exportPage.selectFormat('vhdl');
    await exportPage.showPreview();

    await exportPage.expectValidVHDLSyntax();
  });

  test('should validate Verilog syntax in preview', async ({ page }) => {
    await optimizationPage.page.click('[data-testid="advanced-export-btn"]');
    await exportPage.expectExportPageLoaded();

    await exportPage.selectFormat('verilog');
    await exportPage.showPreview();

    await exportPage.expectValidVerilogSyntax();
  });

  test('should handle export of complex FSM with many dummy states', async ({ page }) => {
    // Navigate back and import complex FSM
    await editorPage.goto('/');
    await homePage.clickImportFSM();

    const complexFSM = {
      type: 'moore',
      states: Array.from({ length: 16 }, (_, i) => `S${i}`),
      initial_state: 'S0',
      transitions: Array.from({ length: 30 }, (_, i) => ({
        from_state: `S${i % 16}`,
        to_state: `S${(i * 3 + 7) % 16}`,
        input: `${i % 2}`,
      })),
      outputs: Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [`S${i}`, i.toString(2).padStart(4, '0')])
      ),
    };

    await importPage.pasteJSON(JSON.stringify(complexFSM));
    await importPage.import();
    await editorPage.optimize('greedy');

    // Export as Verilog
    const download = await optimizationPage.exportAsVerilog();

    const downloadPath = `/tmp/claude/downloads/${download.suggestedFilename()}`;
    await download.saveAs(downloadPath);

    const content = await fs.promises.readFile(downloadPath, 'utf-8');

    // Verify dummy states are included
    expect(content).toMatch(/dummy/i);

    // Verify all states have encodings
    expect(content).toContain('localparam');

    // Cleanup
    await fs.promises.unlink(downloadPath);
  });

  test('should preserve FSM functionality in exported code', async ({ page }) => {
    await optimizationPage.page.click('[data-testid="advanced-export-btn"]');
    await exportPage.expectExportPageLoaded();

    await exportPage.selectFormat('verilog');
    await exportPage.showPreview();

    const content = await exportPage.getPreviewContent();

    // Verify all original states are present (not just dummy states)
    for (const state of trafficLightFSM.states) {
      expect(content).toContain(state);
    }

    // Verify transitions are preserved
    expect(content).toContain('case'); // State machine logic
  });
});
