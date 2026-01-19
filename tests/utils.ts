import { Page, Route } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// Mock OpenRouter API responses
export const mockResponses = {
  // API key validation
  authValid: {
    data: {
      label: 'test-key',
      limit: 100,
      usage: 10,
    }
  },
  
  authInvalid: {
    error: {
      message: 'Invalid API key',
      code: 401
    }
  },

  // File classification response
  classifyChapter: (filename: string) => ({
    choices: [{
      message: {
        content: JSON.stringify({
          classification: 'chapter-draft',
          confidence: 0.9,
          summary: `Chapter draft from ${filename}`,
          characters: ['Alice', 'Bob'],
          locations: ['The Library'],
          concepts: ['The Prophecy'],
          chapterNumber: 1,
          isComplete: true
        })
      }
    }],
    usage: { prompt_tokens: 100, completion_tokens: 50 }
  }),

  classifyCharacterDoc: (filename: string) => ({
    choices: [{
      message: {
        content: JSON.stringify({
          classification: 'character-doc',
          confidence: 0.85,
          summary: `Character documentation from ${filename}`,
          characters: ['Alice'],
          locations: [],
          concepts: [],
          chapterNumber: null,
          isComplete: true
        })
      }
    }],
    usage: { prompt_tokens: 100, completion_tokens: 50 }
  }),

  classifyWorldbuilding: (filename: string) => ({
    choices: [{
      message: {
        content: JSON.stringify({
          classification: 'worldbuilding',
          confidence: 0.88,
          summary: `World building notes from ${filename}`,
          characters: [],
          locations: ['The Library', 'The Tower'],
          concepts: ['Magic System', 'The Prophecy'],
          chapterNumber: null,
          isComplete: true
        })
      }
    }],
    usage: { prompt_tokens: 100, completion_tokens: 50 }
  }),

  // Project analysis response
  analyzeProject: {
    choices: [{
      message: {
        content: JSON.stringify({
          genreGuess: 'Fantasy',
          possibleDuplicates: [
            { items: ['Alice', 'Alicia'], reason: 'Possible nickname or typo' }
          ],
          questions: [
            {
              id: 'q1',
              type: 'duplicate',
              question: 'Is "Alice" the same character as "Alicia"?',
              options: ['Yes, same person', 'No, different characters']
            }
          ]
        })
      }
    }],
    usage: { prompt_tokens: 200, completion_tokens: 100 }
  }
};

// Setup mock routes for OpenRouter
export async function setupOpenRouterMocks(page: Page) {
  // Auth endpoint
  await page.route('**/openrouter.ai/api/v1/auth/key', async (route: Route) => {
    const headers = route.request().headers();
    const authHeader = headers['authorization'] || '';
    
    if (authHeader.includes('valid-test-key')) {
      await route.fulfill({ json: mockResponses.authValid });
    } else {
      await route.fulfill({ status: 401, json: mockResponses.authInvalid });
    }
  });

  // Chat completions endpoint (for classification and analysis)
  let callCount = 0;
  await page.route('**/openrouter.ai/api/v1/chat/completions', async (route: Route) => {
    callCount++;
    const body = JSON.parse(route.request().postData() || '{}');
    const content = body.messages?.[1]?.content || '';
    
    // Determine what kind of request this is based on prompt content
    if (content.includes('FILE NAME:')) {
      // File classification request
      const filenameMatch = content.match(/FILE NAME: ([^\n]+)/);
      const filename = filenameMatch?.[1] || 'unknown.txt';
      
      if (filename.includes('chapter') || filename.includes('ch')) {
        await route.fulfill({ json: mockResponses.classifyChapter(filename) });
      } else if (filename.includes('character')) {
        await route.fulfill({ json: mockResponses.classifyCharacterDoc(filename) });
      } else {
        await route.fulfill({ json: mockResponses.classifyWorldbuilding(filename) });
      }
    } else if (content.includes('CHARACTERS') && content.includes('LOCATIONS')) {
      // Project analysis request
      await route.fulfill({ json: mockResponses.analyzeProject });
    } else {
      // Default response
      await route.fulfill({
        json: {
          choices: [{ message: { content: '{"result": "ok"}' } }],
          usage: { prompt_tokens: 50, completion_tokens: 20 }
        }
      });
    }
  });
}

// Create test fixture files programmatically
export function getFixturePath(filename: string): string {
  return path.join(__dirname, 'fixtures', filename);
}

// Helper to simulate file drop
// Note: Playwright can't directly simulate drag-drop of real files,
// so we use a workaround with the File System Access API or input[type=file]
export async function uploadFiles(page: Page, selector: string, files: string[]) {
  const input = await page.locator(selector);
  await input.setInputFiles(files);
}

// Helper to clear IndexedDB before tests
export async function clearStorage(page: Page) {
  // Navigate to the app first so we have access to storage
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    indexedDB.deleteDatabase('emerson');
  });
}

// Wait for app to be ready
export async function waitForApp(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="app-ready"], .page-card, text=Projects', { 
    timeout: 10000 
  });
}

// Helper to check test results
export interface TestResult {
  passed: boolean;
  failures: string[];
  duration: number;
}

export function parseTestResults(jsonPath: string): TestResult {
  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    const results = JSON.parse(content);
    
    const failures: string[] = [];
    let passed = true;
    
    for (const suite of results.suites || []) {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          if (test.status !== 'passed' && test.status !== 'skipped') {
            passed = false;
            failures.push(`${spec.title}: ${test.results?.[0]?.error?.message || 'Unknown error'}`);
          }
        }
      }
    }
    
    return {
      passed,
      failures,
      duration: results.stats?.duration || 0
    };
  } catch (err) {
    return {
      passed: false,
      failures: [`Failed to parse test results: ${err}`],
      duration: 0
    };
  }
}
