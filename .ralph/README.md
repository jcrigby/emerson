# Ralph: Automated Development Loop

Ralph is an automated development system that uses Claude API to go from feature request to working code.

## The Full Loop

```
Human: "I want feature X" (one sentence)
              ↓
┌──────────────────────────────────────┐
│         SPEC GENERATION              │
│                                      │
│  Claude: Writes PRD                  │
│  Claude: Writes failing tests        │
│  Claude: Generates issues.json       │
│                                      │
└──────────────────────────────────────┘
              ↓
┌──────────────────────────────────────┐
│         IMPLEMENTATION               │
│                                      │
│  Loop until all tests pass:          │
│    1. Read spec + code               │
│    2. Write implementation           │
│    3. Build                          │
│    4. Test                           │
│    5. If fail → retry                │
│    6. If pass → next issue           │
│                                      │
└──────────────────────────────────────┘
              ↓
Human: Review, merge
```

## Quickest Start (GitHub Issues)

1. **Add secret**: Settings → Secrets → `ANTHROPIC_API_KEY`
2. **Create Issue**: Describe your feature in plain English
3. **Add label**: `spec` to generate PRD and tests
4. **Add label**: `ralph` to implement (or `auto-implement` for both)
5. **Review**: Check the commits in the morning

That's it. Feature request → working code, overnight.

## Local Usage

```bash
export ANTHROPIC_API_KEY=sk-ant-...

# Generate spec from description
npm run ralph:spec "Users should be able to export their project as a PDF"

# Review what was generated
cat .ralph/prd/*.md
cat tests/*.spec.ts

# Run implementation
npm run ralph

# Check status
npm run ralph:status
```

## Commands

```bash
# Generate spec from feature description
./.ralph/spec.sh "Feature description here"
./.ralph/spec.sh --file feature-request.txt

# Run all pending issues
./.ralph/ralph.sh

# Run specific issue
./.ralph/ralph.sh --issue 001

# Parse existing PRD into issues
./.ralph/ralph.sh --parse path/to/PRD.md

# Show status
./.ralph/ralph.sh --status
```

## GitHub Labels

| Label | Effect |
|-------|--------|
| `spec` | Generates PRD, tests, and issues from the Issue body |
| `spec-complete` | (Auto-added) Spec generation finished |
| `ralph` | Runs implementation loop on pending issues |
| `auto-implement` | Runs spec generation AND implementation together |

### Example Issue

**Title:** PDF Export Feature

**Body:**
```
Users should be able to export their entire project as a formatted PDF document.

- Include all chapters in order
- Include title page with project name
- Table of contents
- Chapter headings
- Page numbers
```

**Labels:** `spec`, `auto-implement`

**Result:** Overnight, you get PRD, tests, implementation, all committed.

## How It Works

### 1. Issues File

All work is tracked in `.ralph/issues.json`:

```json
{
  "issues": [
    {
      "id": "001",
      "title": "Feature description",
      "status": "pending",          // pending | complete
      "spec": "What needs to work",
      "test_file": "tests/foo.spec.ts",
      "test_name": "specific test name",
      "relevant_files": ["src/Component.tsx"],
      "depends_on": [],
      "attempts": 0,
      "max_attempts": 5,
      "last_error": null
    }
  ]
}
```

### 2. Processing Loop

For each pending issue:

1. **Read context** - Load relevant source files
2. **Build prompt** - Spec + context + last error
3. **Call Claude** - One-shot API call
4. **Apply changes** - Extract and write files from response
5. **Build** - Run `npm run build`
6. **Test** - Run specific Playwright test
7. **Update status** - Mark complete or record error

### 3. Claude Response Format

Claude is instructed to respond with complete files:

```
=== FILE: src/components/Example.tsx ===
```typescript
// Complete file contents
export function Example() {
  return <div>...</div>;
}
```

=== FILE: src/lib/helper.ts ===
```typescript
// Another complete file
export function helper() {}
```
```

### 4. Error Recovery

If a test fails:
- Error is captured and stored in `last_error`
- Next attempt includes the error in context
- After `max_attempts`, issue is skipped
- Loop continues to next issue

## Writing Good Issues

### Do
- One test per issue
- Specific, testable acceptance criteria
- List all files that might need changes
- Order issues by dependency

### Don't
- Vague specs ("make it work better")
- Multiple unrelated changes per issue
- Missing test coverage
- Circular dependencies

## Writing Tests

Tests should be:

1. **Specific** - Test one behavior
2. **Isolated** - Clear storage before each test
3. **Deterministic** - Mock external APIs
4. **Fast** - No unnecessary waits

Example:

```typescript
test('saves valid API key', async ({ page }) => {
  await setupMocks(page);      // Deterministic
  await clearStorage(page);    // Isolated
  
  await page.goto('/');
  await page.click('text=Settings');
  await page.fill('input', 'valid-key');
  await page.click('text=Save');
  
  await expect(page.locator('text=Saved')).toBeVisible();  // Specific
});
```

## PRD Format

Use `.ralph/PRD_TEMPLATE.md` as a starting point. Key sections:

- **User Story** - Who wants what and why
- **Acceptance Criteria** - Testable requirements
- **Technical Requirements** - Files, types, components
- **Test Specification** - What tests to write

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | (required) | Claude API key |
| `RALPH_MODEL` | `claude-sonnet-4-20250514` | Model to use |
| `RALPH_MAX_TOKENS` | `8192` | Max response tokens |

## Logs

All logs are stored in `.ralph/logs/`:

- `build.log` - Last build output
- `test.log` - Last test output
- `response_XXX.txt` - Claude responses per issue

## Troubleshooting

### "No more pending issues" but tests still fail

Check if issues hit max attempts:
```bash
jq '.issues[] | select(.attempts >= .max_attempts)' .ralph/issues.json
```

### Claude keeps making the same mistake

Review `.ralph/logs/response_XXX.txt` for the issue. The error might not be descriptive enough. Try:
1. Adding more context to `relevant_files`
2. Making the spec more explicit
3. Simplifying the test

### Build passes but tests timeout

Playwright might not be waiting for the dev server. Check:
1. `playwright.config.ts` webServer settings
2. Increase timeout if needed
3. Ensure dev server starts without errors

## Extending Ralph

### Custom Test Commands

Edit `run_tests()` in `ralph.sh`:

```bash
run_tests() {
    # Add custom logic
    if [ "$test_file" == "tests/e2e.spec.ts" ]; then
        # Special handling for e2e tests
    fi
}
```

### Different CI Environments

For GitHub Actions, create `.github/workflows/ralph.yml`:

```yaml
- name: Run Ralph
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npm run ralph
```

### Multiple Projects

Copy `.ralph/` to each project. Or create a monorepo setup with shared scripts.
