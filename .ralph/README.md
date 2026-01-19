# Ralph: Automated Development Loop

Ralph is an automated development system that uses Claude Code to implement features based on failing tests.

## The Loop

```
Human: "I want feature X"
              ↓
         spec.sh
              ↓
   PRD + Tests + Issues
              ↓
         ralph.sh
              ↓
┌─────────────────────────────────┐
│  For each issue:                │
│                                 │
│  1. Fresh Claude Code session   │
│  2. Claude reads test           │
│  3. Claude explores codebase    │
│  4. Claude implements           │
│  5. Claude runs test            │
│  6. If fail → retry             │
│  7. If pass → next issue        │
│                                 │
└─────────────────────────────────┘
              ↓
Human: Review, commit, push
```

## Why Claude Code?

The original Ralph used direct API calls with manually specified context files. This was fragile—if the fix needed a file we didn't list, it failed.

Claude Code solves this:
- **Explores the codebase itself** — finds relevant files
- **Runs commands** — builds, tests, sees real errors
- **Iterates within a task** — tries multiple approaches
- **Fresh context per issue** — no rot from previous work

## Requirements

- [Claude Code CLI](https://github.com/anthropics/claude-code) installed and authenticated
- Node.js 18+
- jq

## Quick Start

```bash
# Check what needs doing
npm run ralph:status

# Run the loop (processes all pending issues)
npm run ralph

# Run a specific issue
./.ralph/ralph.sh --issue 001

# Reset a failed issue to try again
./.ralph/ralph.sh --reset 001
```

## Generating Specs

```bash
# From a description
npm run ralph:spec "Users should be able to export their project as a PDF"

# From a file
./.ralph/spec.sh --file feature-request.txt
```

This invokes Claude Code to:
1. Explore the existing codebase
2. Generate a PRD (`.ralph/prd/feature-name.md`)
3. Generate Playwright tests (`tests/feature-name.spec.ts`)
4. Add issues to `issues.json`

## Issues File

All work is tracked in `.ralph/issues.json`:

```json
{
  "issues": [
    {
      "id": "001",
      "title": "Short description",
      "status": "pending",
      "priority": 2,
      "spec": "What needs to work",
      "test_file": "tests/feature.spec.ts",
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

**Status values:**
- `pending` — Ready to work
- `complete` — Done

**The loop:**
1. Gets next pending issue with attempts < max_attempts
2. Invokes Claude Code with the spec and test name
3. Claude explores, implements, runs test
4. If test passes → mark complete
5. If test fails → increment attempts, record error, continue
6. Repeat until no pending issues

## Commands

```bash
# Run all pending issues
./.ralph/ralph.sh

# Run specific issue
./.ralph/ralph.sh --issue 001

# Show status
./.ralph/ralph.sh --status

# Reset issue to pending
./.ralph/ralph.sh --reset 001

# Generate spec from description
./.ralph/spec.sh "feature description"
```

## Logs

All logs are stored in `.ralph/logs/`:
- `claude_XXX_timestamp.log` — Claude Code output per issue
- `test.log` — Last test run output

## Writing Good Issues

**Do:**
- One test per issue
- Specific, testable acceptance criteria
- Order by dependency (basics first)

**Don't:**
- Vague specs ("make it better")
- Multiple unrelated changes
- Skip test coverage

## CI/CD

The Ralph loop runs locally (requires Claude Code CLI). 

GitHub Actions runs tests on push/PR to verify nothing broke:
- `.github/workflows/test.yml` — Runs Playwright tests
- `.github/workflows/deploy.yml` — Deploys to GitHub Pages

## Typical Workflow

```bash
# Morning: generate spec for today's feature
npm run ralph:spec "Add PDF export with chapter headers"

# Review what was generated
cat .ralph/prd/add-pdf-export*.md
cat tests/add-pdf-export*.spec.ts

# Run the loop (go make coffee)
npm run ralph

# Check status
npm run ralph:status

# Review changes, commit
git add -A
git commit -m "feat: PDF export"
git push
```

## Cost

Each issue = one Claude Code session. 

Typical session: 5-20 API calls depending on complexity.

A feature with 5 issues might cost $0.50-2.00 depending on model and iteration count.
