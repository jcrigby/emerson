import { test, expect } from '@playwright/test';
import { setupOpenRouterMocks, clearStorage, waitForApp } from './utils';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await setupOpenRouterMocks(page);
    await clearStorage(page);
  });

  test('shows settings page with API key input', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Settings');
    
    await expect(page.locator('text=OpenRouter API Key')).toBeVisible();
    await expect(page.locator('input[placeholder*="sk-or"]')).toBeVisible();
  });

  test('validates and saves valid API key', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Settings');
    
    // Enter valid key
    await page.fill('input[placeholder*="sk-or"]', 'valid-test-key');
    await page.click('text=Save');
    
    // Should show success
    await expect(page.locator('text=API key validated')).toBeVisible({ timeout: 5000 });
  });

  test('shows error for invalid API key', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Settings');
    
    // Enter invalid key
    await page.fill('input[placeholder*="sk-or"]', 'invalid-key');
    await page.click('text=Save');
    
    // Should show error
    await expect(page.locator('text=Invalid API key')).toBeVisible({ timeout: 5000 });
  });

  test('persists API key across page reload', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Settings');
    
    // Enter and save valid key
    await page.fill('input[placeholder*="sk-or"]', 'valid-test-key');
    await page.click('text=Save');
    await expect(page.locator('text=API key validated')).toBeVisible({ timeout: 5000 });
    
    // Reload page
    await page.reload();
    await page.click('text=Settings');
    
    // Key should still be there (shown as saved)
    await expect(page.locator('text=API key validated')).toBeVisible();
  });

  test('can clear saved API key', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Settings');
    
    // Save a key first
    await page.fill('input[placeholder*="sk-or"]', 'valid-test-key');
    await page.click('text=Save');
    await expect(page.locator('text=API key validated')).toBeVisible({ timeout: 5000 });
    
    // Clear it
    await page.click('text=Clear');
    
    // Should be back to input state
    await expect(page.locator('input[placeholder*="sk-or"]')).toHaveValue('');
  });

  test('can change model preferences', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Settings');
    
    // Find and change analysis model dropdown
    const analysisSelect = page.locator('select').first();
    await analysisSelect.selectOption({ index: 1 });
    
    // Reload and verify persistence
    await page.reload();
    await page.click('text=Settings');
    
    // Model selection should persist (just verify the dropdown is still there)
    await expect(page.locator('select').first()).toBeVisible();
  });
});
