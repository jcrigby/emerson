import { test, expect } from '@playwright/test';
import { setupOpenRouterMocks, clearStorage } from './utils';

test.describe('Analyze View', () => {
  test.beforeEach(async ({ page }) => {
    await setupOpenRouterMocks(page);
    await clearStorage(page);
    
    // Set up API key and create project with content
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
    
    // Navigate to Analyze
    await page.click('text=Analysis');
  });

  test('shows analysis tabs', async ({ page }) => {
    await expect(page.locator('button:has-text("Continuity")')).toBeVisible();
    await expect(page.locator('button:has-text("Foreshadowing")')).toBeVisible();
    await expect(page.locator('button:has-text("Issues")')).toBeVisible();
  });

  test('shows empty state when no content to analyze', async ({ page }) => {
    await expect(page.locator('text=No content to analyze')).toBeVisible();
    await expect(page.locator('text=Write some scenes first')).toBeVisible();
  });

  test('can run continuity analysis', async ({ page }) => {
    // First add some content via Structure/Write
    await page.click('text=Structure');
    await page.click('button:has-text("Add Chapter")');
    await page.click('button:has-text("Add Scene")');
    await page.click('text=Write');
    await page.click('text=Scene 1');
    await page.locator('.prose-editor').fill('Alice has blue eyes. She walked to the library.');
    await page.click('button:has-text("Save")');
    
    // Run analysis
    await page.click('text=Analysis');
    await page.click('button:has-text("Run Analysis")');
    
    await expect(page.locator('text=Analyzing')).toBeVisible();
    await expect(page.locator('.continuity-results')).toBeVisible({ timeout: 15000 });
  });

  test('displays extracted facts', async ({ page }) => {
    // Setup content
    await page.click('text=Structure');
    await page.click('button:has-text("Add Chapter")');
    await page.click('button:has-text("Add Scene")');
    await page.click('text=Write');
    await page.click('text=Scene 1');
    await page.locator('.prose-editor').fill('Alice has blue eyes.');
    await page.click('button:has-text("Save")');
    
    await page.click('text=Analysis');
    await page.click('button:has-text("Run Analysis")');
    
    // Should show extracted fact
    await expect(page.locator('text=Alice')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=blue eyes')).toBeVisible();
  });

  test('flags continuity contradictions', async ({ page }) => {
    // Setup contradictory content
    await page.click('text=Structure');
    await page.click('button:has-text("Add Chapter")');
    await page.click('button:has-text("Add Scene")');
    await page.click('button:has-text("Add Scene")');
    
    await page.click('text=Write');
    await page.click('text=Scene 1');
    await page.locator('.prose-editor').fill('Alice has blue eyes.');
    await page.click('button:has-text("Save")');
    
    await page.click('text=Scene 2');
    await page.locator('.prose-editor').fill('Alice looked at him with her green eyes.');
    await page.click('button:has-text("Save")');
    
    await page.click('text=Analysis');
    await page.click('button:has-text("Run Analysis")');
    
    // Should flag contradiction
    await expect(page.locator('.contradiction')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=eye color')).toBeVisible();
  });

  test('shows foreshadowing tracker', async ({ page }) => {
    await page.click('button:has-text("Foreshadowing")');
    
    await expect(page.locator('text=Setups')).toBeVisible();
    await expect(page.locator('text=Payoffs')).toBeVisible();
  });

  test('can manually add foreshadowing setup', async ({ page }) => {
    await page.click('button:has-text("Foreshadowing")');
    await page.click('button:has-text("Add Setup")');
    
    await page.fill('input[placeholder*="Description"]', 'The locked door in the basement');
    await page.click('button:has-text("Save")');
    
    await expect(page.locator('text=The locked door')).toBeVisible();
    await expect(page.locator('.badge:has-text("Planted")')).toBeVisible();
  });

  test('can mark foreshadowing as paid off', async ({ page }) => {
    await page.click('button:has-text("Foreshadowing")');
    await page.click('button:has-text("Add Setup")');
    await page.fill('input[placeholder*="Description"]', 'The mysterious key');
    await page.click('button:has-text("Save")');
    
    await page.click('text=The mysterious key');
    await page.click('button:has-text("Mark Paid")');
    
    await expect(page.locator('.badge:has-text("Paid")')).toBeVisible();
  });

  test('shows issues panel with blocking and warnings', async ({ page }) => {
    await page.click('button:has-text("Issues")');
    
    await expect(page.locator('text=Blocking')).toBeVisible();
    await expect(page.locator('text=Warnings')).toBeVisible();
  });

  test('can resolve issue', async ({ page }) => {
    // First generate an issue via analysis
    await page.click('text=Structure');
    await page.click('button:has-text("Add Chapter")');
    await page.click('button:has-text("Add Scene")');
    await page.click('button:has-text("Add Scene")');
    
    await page.click('text=Write');
    await page.click('text=Scene 1');
    await page.locator('.prose-editor').fill('Alice has blue eyes.');
    await page.click('button:has-text("Save")');
    await page.click('text=Scene 2');
    await page.locator('.prose-editor').fill('Alice looked with green eyes.');
    await page.click('button:has-text("Save")');
    
    await page.click('text=Analysis');
    await page.click('button:has-text("Run Analysis")');
    await page.click('button:has-text("Issues")');
    
    // Find and resolve issue
    await page.locator('.issue-item').first().click();
    await page.click('button:has-text("Mark Resolved")');
    
    await expect(page.locator('.issue-item.resolved')).toBeVisible();
  });

  test('links issue to specific scene', async ({ page }) => {
    await page.click('text=Structure');
    await page.click('button:has-text("Add Chapter")');
    await page.click('button:has-text("Add Scene")');
    await page.click('text=Write');
    await page.click('text=Scene 1');
    await page.locator('.prose-editor').fill('Content with issue.');
    await page.click('button:has-text("Save")');
    
    await page.click('text=Analysis');
    await page.click('button:has-text("Run Analysis")');
    await page.click('button:has-text("Issues")');
    
    // Issues should link to scene
    const issueLink = page.locator('.issue-item a:has-text("Scene 1")');
    await issueLink.click();
    
    // Should navigate to scene
    await expect(page.locator('.editor-panel')).toBeVisible();
  });

  test('shows analysis summary with counts', async ({ page }) => {
    await expect(page.locator('.analysis-summary')).toBeVisible();
    await expect(page.locator('text=Facts:')).toBeVisible();
    await expect(page.locator('text=Issues:')).toBeVisible();
  });
});
