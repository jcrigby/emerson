import { test, expect } from '@playwright/test';
import { setupOpenRouterMocks, clearStorage } from './utils';

test.describe('Write View', () => {
  test.beforeEach(async ({ page }) => {
    await setupOpenRouterMocks(page);
    await clearStorage(page);
    
    // Set up API key and create project with structure
    await page.goto('/');
    await page.click('text=Settings');
    await page.fill('input[placeholder*="sk-or"]', 'valid-test-key');
    await page.click('text=Save');
    await expect(page.locator('text=API key validated')).toBeVisible({ timeout: 5000 });
    
    await page.click('text=Dashboard');
    await page.click('button:has-text("New Project")');
    await page.click('text=Starting fresh');
    await page.fill('input[placeholder*="Novel"]', 'Test Novel');
    await page.click('button:has-text("Create")');
    
    // Create a chapter and scene in Structure
    await page.click('button:has-text("Add Chapter")');
    await page.locator('input[placeholder*="Chapter title"]').fill('Chapter One');
    await page.click('button:has-text("Add Scene")');
    
    // Navigate to Write
    await page.click('text=Write');
  });

  test('shows scene selector', async ({ page }) => {
    await expect(page.locator('text=Chapter One')).toBeVisible();
    await expect(page.locator('text=Scene 1')).toBeVisible();
  });

  test('can select a scene to write', async ({ page }) => {
    await page.click('text=Scene 1');
    
    await expect(page.locator('.editor-panel')).toBeVisible();
    await expect(page.locator('.context-panel')).toBeVisible();
  });

  test('shows context panel with relevant info', async ({ page }) => {
    await page.click('text=Scene 1');
    
    await expect(page.locator('text=Context')).toBeVisible();
    await expect(page.locator('text=Characters')).toBeVisible();
    await expect(page.locator('text=Location')).toBeVisible();
  });

  test('can write scene beats/instructions', async ({ page }) => {
    await page.click('text=Scene 1');
    
    await page.click('button:has-text("Edit Beats")');
    await page.fill('textarea[placeholder*="beats"]', '- Introduce protagonist\n- Establish setting');
    await page.click('button:has-text("Save Beats")');
    
    await expect(page.locator('text=Introduce protagonist')).toBeVisible();
  });

  test('can trigger AI generation', async ({ page }) => {
    await page.click('text=Scene 1');
    
    await page.click('button:has-text("Generate")');
    
    // Should show loading state
    await expect(page.locator('text=Generating')).toBeVisible();
    
    // Should eventually show content (mocked)
    await expect(page.locator('.prose-editor')).not.toBeEmpty({ timeout: 10000 });
  });

  test('can manually edit generated prose', async ({ page }) => {
    await page.click('text=Scene 1');
    
    const editor = page.locator('.prose-editor');
    await editor.fill('Alice walked into the library.');
    
    await expect(editor).toHaveText('Alice walked into the library.');
  });

  test('shows word count while writing', async ({ page }) => {
    await page.click('text=Scene 1');
    
    const editor = page.locator('.prose-editor');
    await editor.fill('One two three four five.');
    
    await expect(page.locator('text=5 words')).toBeVisible();
  });

  test('can save scene content', async ({ page }) => {
    await page.click('text=Scene 1');
    
    const editor = page.locator('.prose-editor');
    await editor.fill('This is my scene content.');
    await page.click('button:has-text("Save")');
    
    await expect(page.locator('text=Saved')).toBeVisible();
    
    // Reload and verify persistence
    await page.reload();
    await page.click('text=Write');
    await page.click('text=Scene 1');
    
    await expect(editor).toHaveText('This is my scene content.');
  });

  test('can add characters to scene context', async ({ page }) => {
    await page.click('text=Scene 1');
    
    await page.click('button:has-text("Add Character")');
    await page.fill('input[placeholder*="character name"]', 'Alice');
    await page.click('button:has-text("Add")');
    
    await expect(page.locator('.context-panel text=Alice')).toBeVisible();
  });

  test('can set scene location', async ({ page }) => {
    await page.click('text=Scene 1');
    
    await page.click('button:has-text("Set Location")');
    await page.fill('input[placeholder*="location"]', 'The Library');
    await page.click('button:has-text("Set")');
    
    await expect(page.locator('.context-panel text=The Library')).toBeVisible();
  });

  test('shows previous scene summary for context', async ({ page }) => {
    // This test assumes we have a way to set scene summaries
    await page.click('text=Scene 1');
    
    // Previous scene summary panel should exist (may be empty)
    await expect(page.locator('text=Previous Scene')).toBeVisible();
  });

  test('can mark scene as complete', async ({ page }) => {
    await page.click('text=Scene 1');
    
    const editor = page.locator('.prose-editor');
    await editor.fill('Complete scene content here.');
    await page.click('button:has-text("Save")');
    
    await page.click('button:has-text("Mark Complete")');
    
    // Status should update
    await expect(page.locator('.badge:has-text("Complete")')).toBeVisible();
  });

  test('generates scene summary after completion', async ({ page }) => {
    await page.click('text=Scene 1');
    
    const editor = page.locator('.prose-editor');
    await editor.fill('Alice entered the library and found the ancient book.');
    await page.click('button:has-text("Save")');
    await page.click('button:has-text("Mark Complete")');
    
    // Summary should be generated (mocked)
    await expect(page.locator('.scene-summary')).not.toBeEmpty({ timeout: 10000 });
  });

  test('navigates to next scene after completion', async ({ page }) => {
    // Add second scene first
    await page.click('text=Structure');
    await page.click('button:has-text("Add Scene")');
    await page.click('text=Write');
    
    await page.click('text=Scene 1');
    await page.locator('.prose-editor').fill('Scene one content.');
    await page.click('button:has-text("Save")');
    await page.click('button:has-text("Mark Complete")');
    
    await page.click('button:has-text("Next Scene")');
    
    await expect(page.locator('.scene-header:has-text("Scene 2")')).toBeVisible();
  });
});
