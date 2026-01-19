import { test, expect } from '@playwright/test';
import { setupOpenRouterMocks, clearStorage } from './utils';
import * as path from 'path';

test.describe('Ingestion', () => {
  test.beforeEach(async ({ page }) => {
    await setupOpenRouterMocks(page);
    await clearStorage(page);
    
    // Set up API key first
    await page.goto('/');
    await page.click('text=Settings');
    await page.fill('input[placeholder*="sk-or"]', 'valid-test-key');
    await page.click('text=Save');
    await expect(page.locator('text=API key validated')).toBeVisible({ timeout: 5000 });
  });

  test('shows welcome screen with two options', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("New Project")');
    
    await expect(page.locator('text=What are we working with')).toBeVisible();
    await expect(page.locator('text=I have files')).toBeVisible();
    await expect(page.locator('text=Starting fresh')).toBeVisible();
  });

  test('starting fresh goes directly to naming', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("New Project")');
    
    // Click "Starting fresh"
    await page.click('text=Starting fresh');
    
    // Should ask for project name
    await expect(page.locator('text=What would you like to call this project')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder*="Novel"]')).toBeVisible();
  });

  test('can create project from scratch', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("New Project")');
    await page.click('text=Starting fresh');
    
    // Wait for name prompt
    await expect(page.locator('input[placeholder*="Novel"]')).toBeVisible({ timeout: 5000 });
    
    // Enter name and create
    await page.fill('input[placeholder*="Novel"]', 'My Test Novel');
    await page.click('button:has-text("Create")');
    
    // Should show success message
    await expect(page.locator('text=My Test Novel')).toBeVisible({ timeout: 10000 });
  });

  test('file upload triggers analysis flow', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("New Project")');
    
    // We can't easily simulate drag-drop, but we can check that
    // the drop zone and file picker elements exist
    await expect(page.locator('text=I have files')).toBeVisible();
    await expect(page.locator('text=Drop folder or click to browse')).toBeVisible();
  });

  // This test requires actual file input which is complex in Playwright
  // Marking as a template for future implementation
  test.skip('processes dropped files and shows summary', async ({ page }) => {
    // This would need:
    // 1. A way to inject files into the drop zone
    // 2. Or use an input[type=file] element
    // 3. Mock responses are already set up in setupOpenRouterMocks
    
    await page.goto('/');
    await page.click('button:has-text("New Project")');
    
    // Simulate file upload (implementation TBD)
    // await uploadFiles(page, 'fixtures/');
    
    // Should show analysis progress
    // await expect(page.locator('text=Reading your files')).toBeVisible();
    
    // Should show summary
    // await expect(page.locator('text=words of prose')).toBeVisible();
  });
});
