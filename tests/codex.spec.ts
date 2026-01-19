import { test, expect } from '@playwright/test';
import { setupOpenRouterMocks, clearStorage } from './utils';

test.describe('Codex View', () => {
  test.beforeEach(async ({ page }) => {
    await setupOpenRouterMocks(page);
    await clearStorage(page);
    
    // Set up API key and create project
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
    
    // Navigate to Codex
    await page.click('text=Codex');
  });

  test('shows tabs for different entry types', async ({ page }) => {
    await expect(page.locator('button:has-text("Characters")')).toBeVisible();
    await expect(page.locator('button:has-text("Locations")')).toBeVisible();
    await expect(page.locator('button:has-text("Items")')).toBeVisible();
    await expect(page.locator('button:has-text("Concepts")')).toBeVisible();
  });

  test('shows empty state when no entries', async ({ page }) => {
    await expect(page.locator('text=No characters yet')).toBeVisible();
    await expect(page.locator('button:has-text("Add Character")')).toBeVisible();
  });

  test('can create a new character', async ({ page }) => {
    await page.click('button:has-text("Add Character")');
    
    await page.fill('input[placeholder*="Name"]', 'Alice');
    await page.fill('textarea[placeholder*="Description"]', 'The protagonist');
    await page.click('button:has-text("Save")');
    
    await expect(page.locator('.codex-entry:has-text("Alice")')).toBeVisible();
  });

  test('can add aliases to character', async ({ page }) => {
    await page.click('button:has-text("Add Character")');
    await page.fill('input[placeholder*="Name"]', 'Alice');
    
    await page.click('button:has-text("Add Alias")');
    await page.fill('input[placeholder*="Alias"]', 'Al');
    await page.click('button:has-text("Save")');
    
    await page.click('.codex-entry:has-text("Alice")');
    await expect(page.locator('text=Al')).toBeVisible();
  });

  test('can create a new location', async ({ page }) => {
    await page.click('button:has-text("Locations")');
    await page.click('button:has-text("Add Location")');
    
    await page.fill('input[placeholder*="Name"]', 'The Library');
    await page.fill('textarea[placeholder*="Description"]', 'An ancient repository of knowledge');
    await page.click('button:has-text("Save")');
    
    await expect(page.locator('.codex-entry:has-text("The Library")')).toBeVisible();
  });

  test('can add custom attributes', async ({ page }) => {
    await page.click('button:has-text("Add Character")');
    await page.fill('input[placeholder*="Name"]', 'Bob');
    
    await page.click('button:has-text("Add Attribute")');
    await page.fill('input[placeholder*="Attribute name"]', 'Age');
    await page.fill('input[placeholder*="Value"]', '45');
    await page.click('button:has-text("Save")');
    
    await page.click('.codex-entry:has-text("Bob")');
    await expect(page.locator('text=Age: 45')).toBeVisible();
  });

  test('can search/filter entries', async ({ page }) => {
    // Create two characters
    await page.click('button:has-text("Add Character")');
    await page.fill('input[placeholder*="Name"]', 'Alice');
    await page.click('button:has-text("Save")');
    
    await page.click('button:has-text("Add Character")');
    await page.fill('input[placeholder*="Name"]', 'Bob');
    await page.click('button:has-text("Save")');
    
    // Search
    await page.fill('input[placeholder*="Search"]', 'Alice');
    
    await expect(page.locator('.codex-entry:has-text("Alice")')).toBeVisible();
    await expect(page.locator('.codex-entry:has-text("Bob")')).not.toBeVisible();
  });

  test('can delete entry', async ({ page }) => {
    await page.click('button:has-text("Add Character")');
    await page.fill('input[placeholder*="Name"]', 'ToDelete');
    await page.click('button:has-text("Save")');
    
    await page.click('.codex-entry:has-text("ToDelete")');
    await page.click('button:has-text("Delete")');
    await page.click('button:has-text("Confirm")');
    
    await expect(page.locator('.codex-entry:has-text("ToDelete")')).not.toBeVisible();
  });

  test('can edit existing entry', async ({ page }) => {
    await page.click('button:has-text("Add Character")');
    await page.fill('input[placeholder*="Name"]', 'Original');
    await page.click('button:has-text("Save")');
    
    await page.click('.codex-entry:has-text("Original")');
    await page.click('button:has-text("Edit")');
    await page.fill('input[placeholder*="Name"]', 'Updated');
    await page.click('button:has-text("Save")');
    
    await expect(page.locator('.codex-entry:has-text("Updated")')).toBeVisible();
  });

  test('shows entry count per type', async ({ page }) => {
    await page.click('button:has-text("Add Character")');
    await page.fill('input[placeholder*="Name"]', 'Char1');
    await page.click('button:has-text("Save")');
    
    await expect(page.locator('button:has-text("Characters")').locator('.badge')).toHaveText('1');
  });
});
