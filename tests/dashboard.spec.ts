import { test, expect } from '@playwright/test';
import { setupOpenRouterMocks, clearStorage } from './utils';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupOpenRouterMocks(page);
    await clearStorage(page);
  });

  test('shows empty state when no projects', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('text=Projects')).toBeVisible();
    await expect(page.locator('text=No projects yet')).toBeVisible();
    await expect(page.locator('text=New Project')).toBeVisible();
  });

  test('shows API key warning when not configured', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('text=No API key configured')).toBeVisible();
  });

  test('hides API key warning after key is configured', async ({ page }) => {
    await page.goto('/');
    
    // Configure API key
    await page.click('text=Settings');
    await page.fill('input[placeholder*="sk-or"]', 'valid-test-key');
    await page.click('text=Save');
    await expect(page.locator('text=API key validated')).toBeVisible({ timeout: 5000 });
    
    // Go back to dashboard
    await page.click('text=Dashboard');
    
    // Warning should be gone
    await expect(page.locator('text=No API key configured')).not.toBeVisible();
  });

  test('new project button triggers ingestion flow', async ({ page }) => {
    await page.goto('/');
    
    // Click new project
    await page.click('button:has-text("New Project")');
    
    // Should see ingestion welcome screen
    await expect(page.locator('text=What are we working with')).toBeVisible({ timeout: 5000 });
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/');
    
    // Should start on dashboard
    await expect(page.locator('text=Projects')).toBeVisible();
    
    // Click settings
    await page.click('text=Settings');
    await expect(page.locator('text=OpenRouter API Key')).toBeVisible();
    
    // Click back to dashboard
    await page.click('text=Dashboard');
    await expect(page.locator('text=Projects')).toBeVisible();
  });

  test('sidebar can collapse and expand', async ({ page }) => {
    await page.goto('/');
    
    // Find sidebar - should show "Emerson" text when expanded
    await expect(page.locator('text=Emerson')).toBeVisible();
    
    // Click collapse button (chevron)
    await page.click('button:has(svg.lucide-chevron-left)');
    
    // "Emerson" text should be hidden when collapsed
    await expect(page.locator('aside >> text=Emerson')).not.toBeVisible();
    
    // Click expand button
    await page.click('button:has(svg.lucide-chevron-left)');
    
    // Should be visible again
    await expect(page.locator('aside >> text=Emerson')).toBeVisible();
  });
});
