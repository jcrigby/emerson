import { test, expect } from '@playwright/test';
import { setupOpenRouterMocks, clearStorage } from './utils';

test.describe('Structure View', () => {
  test.beforeEach(async ({ page }) => {
    await setupOpenRouterMocks(page);
    await clearStorage(page);
    
    // Set up API key
    await page.goto('/');
    await page.click('text=Settings');
    await page.fill('input[placeholder*="sk-or"]', 'valid-test-key');
    await page.click('text=Save');
    await expect(page.locator('text=API key validated')).toBeVisible({ timeout: 5000 });
    
    // Create a project first
    await page.click('text=Dashboard');
    await page.click('button:has-text("New Project")');
    await page.click('text=Starting fresh');
    await page.fill('input[placeholder*="Novel"]', 'Test Novel');
    await page.click('button:has-text("Create")');
    await expect(page.locator('h1:has-text("Structure")')).toBeVisible({ timeout: 10000 });
  });

  test('shows empty state with prompt to create outline', async ({ page }) => {
    await expect(page.locator('text=No outline yet')).toBeVisible();
    await expect(page.locator('button:has-text("Create Outline")')).toBeVisible();
  });

  test('can create a new chapter', async ({ page }) => {
    await page.click('button:has-text("Add Chapter")');
    
    await expect(page.locator('text=Chapter 1')).toBeVisible();
    await expect(page.locator('input[placeholder*="Chapter title"]')).toBeVisible();
  });

  test('can add scene to chapter', async ({ page }) => {
    // First create a chapter
    await page.click('button:has-text("Add Chapter")');
    await expect(page.locator('text=Chapter 1')).toBeVisible();
    
    // Add scene
    await page.click('button:has-text("Add Scene")');
    await expect(page.locator('text=Scene 1')).toBeVisible();
  });

  test('displays scene status badges', async ({ page }) => {
    await page.click('button:has-text("Add Chapter")');
    await page.click('button:has-text("Add Scene")');
    
    // New scene should show "planned" status
    await expect(page.locator('.badge:has-text("Planned")')).toBeVisible();
  });

  test('can edit chapter title', async ({ page }) => {
    await page.click('button:has-text("Add Chapter")');
    
    const titleInput = page.locator('input[placeholder*="Chapter title"]');
    await titleInput.fill('The Beginning');
    await titleInput.blur();
    
    await expect(page.locator('text=The Beginning')).toBeVisible();
  });

  test('can edit scene goal', async ({ page }) => {
    await page.click('button:has-text("Add Chapter")');
    await page.click('button:has-text("Add Scene")');
    
    await page.click('text=Scene 1');
    const goalInput = page.locator('textarea[placeholder*="goal"]');
    await goalInput.fill('Introduce the protagonist');
    
    await expect(page.locator('text=Introduce the protagonist')).toBeVisible();
  });

  test('can delete chapter', async ({ page }) => {
    await page.click('button:has-text("Add Chapter")');
    await expect(page.locator('text=Chapter 1')).toBeVisible();
    
    await page.click('button[aria-label="Delete chapter"]');
    await page.click('button:has-text("Confirm")');
    
    await expect(page.locator('text=Chapter 1')).not.toBeVisible();
  });

  test('can reorder chapters via drag or buttons', async ({ page }) => {
    // Create two chapters
    await page.click('button:has-text("Add Chapter")');
    await page.locator('input[placeholder*="Chapter title"]').fill('First');
    await page.click('button:has-text("Add Chapter")');
    await page.locator('input[placeholder*="Chapter title"]').last().fill('Second');
    
    // Move second chapter up
    await page.locator('text=Second').locator('..').locator('button[aria-label="Move up"]').click();
    
    // Verify order changed
    const chapters = await page.locator('.chapter-item').allTextContents();
    expect(chapters[0]).toContain('Second');
  });

  test('shows word count for chapters with content', async ({ page }) => {
    await page.click('button:has-text("Add Chapter")');
    await page.click('button:has-text("Add Scene")');
    
    // Scene with no content shows 0 words
    await expect(page.locator('text=0 words')).toBeVisible();
  });

  test('persists structure across page reload', async ({ page }) => {
    await page.click('button:has-text("Add Chapter")');
    await page.locator('input[placeholder*="Chapter title"]').fill('Persistent Chapter');
    
    await page.reload();
    
    await expect(page.locator('text=Persistent Chapter')).toBeVisible();
  });
});
