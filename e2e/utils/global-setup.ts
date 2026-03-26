/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...');

  // Create necessary directories
  const dirs = [
    'test-results',
    'test-results/html-report',
    'test-results/screenshots',
    'test-results/videos',
    'test-results/traces',
  ];

  dirs.forEach((dir) => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });

  // Health check for backend API
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const apiURL = process.env.API_URL || 'http://localhost:8000';
    console.log(`🔍 Checking backend health at ${apiURL}/api/v1/health`);

    const response = await page.goto(`${apiURL}/api/v1/health`, {
      timeout: 30000,
      waitUntil: 'networkidle',
    });

    if (response?.status() !== 200) {
      throw new Error(`Backend health check failed with status ${response?.status()}`);
    }

    console.log('✅ Backend is healthy');

    // Check frontend
    const frontendURL = process.env.BASE_URL || 'http://localhost:5173';
    console.log(`🔍 Checking frontend at ${frontendURL}`);

    const frontendResponse = await page.goto(frontendURL, {
      timeout: 30000,
      waitUntil: 'networkidle',
    });

    if (frontendResponse?.status() !== 200) {
      throw new Error(`Frontend health check failed with status ${frontendResponse?.status()}`);
    }

    console.log('✅ Frontend is ready');
  } catch (error) {
    console.error('❌ Health check failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ Global setup completed successfully');
}

export default globalSetup;
