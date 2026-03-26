/**
 * Global teardown for Playwright tests
 * Runs once after all tests complete
 */
import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown...');

  // Generate test summary
  const resultsPath = path.join(__dirname, '..', 'test-results', 'results.json');

  if (fs.existsSync(resultsPath)) {
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

    console.log('\n📊 Test Summary:');
    console.log(`Total suites: ${results.suites?.length || 0}`);
    console.log(`Total tests: ${results.stats?.expected || 0}`);
    console.log(`Passed: ${results.stats?.expected || 0}`);
    console.log(`Failed: ${results.stats?.unexpected || 0}`);
    console.log(`Skipped: ${results.stats?.skipped || 0}`);
    console.log(`Duration: ${(results.stats?.duration || 0) / 1000}s`);
  }

  // Clean up old screenshots if configured
  if (process.env.CLEAN_OLD_SCREENSHOTS === 'true') {
    const screenshotsDir = path.join(__dirname, '..', 'test-results', 'screenshots');
    const daysToKeep = parseInt(process.env.SCREENSHOTS_RETENTION_DAYS || '7');
    const cutoffDate = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

    if (fs.existsSync(screenshotsDir)) {
      const files = fs.readdirSync(screenshotsDir);
      files.forEach((file) => {
        const filePath = path.join(screenshotsDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs < cutoffDate) {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Deleted old screenshot: ${file}`);
        }
      });
    }
  }

  console.log('✅ Global teardown completed');
}

export default globalTeardown;
