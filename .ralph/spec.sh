#!/bin/bash
#
# spec.sh - Generate PRD, tests, and issues from a feature description
#
# Usage:
#   ./spec.sh "Users should be able to export their project as a PDF"
#   ./spec.sh --file feature-request.txt
#
# This generates:
#   - .ralph/prd/FEATURE_NAME.md (the PRD)
#   - tests/feature-name.spec.ts (Playwright tests)
#   - Appends new issues to .ralph/issues.json
#
# Requirements:
#   - Claude Code CLI (claude command)
#   - jq
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PRD_DIR="$SCRIPT_DIR/prd"
ISSUES_FILE="$SCRIPT_DIR/issues.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "$PRD_DIR"

# Check dependencies
check_dependencies() {
    local missing=()
    command -v jq >/dev/null 2>&1 || missing+=("jq")
    command -v claude >/dev/null 2>&1 || missing+=("claude (Claude Code CLI)")
    
    if [ ${#missing[@]} -ne 0 ]; then
        echo -e "${RED}Missing required tools: ${missing[*]}${NC}"
        exit 1
    fi
}

# Main
main() {
    check_dependencies
    
    local description=""
    
    # Parse args
    if [ "$1" == "--file" ]; then
        if [ -z "$2" ] || [ ! -f "$2" ]; then
            echo -e "${RED}File not found: $2${NC}"
            exit 1
        fi
        description=$(cat "$2")
    elif [ -n "$1" ]; then
        description="$1"
    else
        echo "Usage: $0 \"feature description\""
        echo "       $0 --file feature-request.txt"
        exit 1
    fi
    
    # Generate feature name from description
    local feature_name=$(echo "$description" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-30)
    
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Generating spec for: ${description:0:50}...${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Get next issue ID
    local max_id=$(jq -r '.issues | map(.id | tonumber) | max // 0' "$ISSUES_FILE" 2>/dev/null || echo "0")
    local next_id=$((max_id + 1))
    
    cd "$PROJECT_ROOT"
    
    # Use Claude Code to generate everything in one shot
    local prompt="You are a product manager and test engineer for the Emerson project - an AI-powered novel writing tool built with React, TypeScript, Vite, Tailwind, Zustand, and Dexie (IndexedDB).

## Feature Request
$description

## Your Task

Generate THREE outputs:

### 1. PRD (Product Requirements Document)

Write a detailed PRD in Markdown format that includes:
- Overview
- User Story (As a [user], I want [action] so that [benefit])
- Acceptance Criteria (specific, testable requirements)
- Technical Requirements (components, files, types)
- UI/UX Specification (user flow, states)
- Test Specification

Save this to: .ralph/prd/${feature_name}.md

### 2. Playwright Tests

Write comprehensive Playwright tests that verify the acceptance criteria.
Follow the patterns in the existing test files (tests/*.spec.ts).
Use the test utilities from tests/utils.ts.

Save this to: tests/${feature_name}.spec.ts

### 3. Issues JSON

Break the feature into discrete implementation tasks.
Each issue should:
- Be completable in one session
- Have one specific test that verifies it
- Include the test file and test name

Output a JSON array of issues starting with ID $(printf "%03d" $next_id).
Format:
[
  {
    \"id\": \"$(printf "%03d" $next_id)\",
    \"title\": \"Feature: specific task\",
    \"status\": \"pending\",
    \"priority\": 2,
    \"spec\": \"Detailed specification\",
    \"test_file\": \"tests/${feature_name}.spec.ts\",
    \"test_name\": \"exact test name\",
    \"relevant_files\": [\"src/components/File.tsx\"],
    \"depends_on\": [],
    \"attempts\": 0,
    \"max_attempts\": 5,
    \"last_error\": null
  }
]

Save this JSON to a temporary file, then I will merge it.

## Instructions

1. First, explore the existing codebase to understand patterns
2. Look at existing tests for style
3. Create all three files
4. Output the path to the issues JSON file at the end

Start by reading the project structure and existing code."

    echo -e "${BLUE}Invoking Claude Code to generate spec...${NC}"
    
    # Run Claude Code
    local output=$(claude -p "$prompt" 2>&1)
    
    echo "$output"
    
    # Check if files were created
    if [ -f ".ralph/prd/${feature_name}.md" ]; then
        echo -e "${GREEN}✓ PRD created: .ralph/prd/${feature_name}.md${NC}"
    else
        echo -e "${YELLOW}⚠ PRD file not found, Claude may have used a different name${NC}"
    fi
    
    if [ -f "tests/${feature_name}.spec.ts" ]; then
        echo -e "${GREEN}✓ Tests created: tests/${feature_name}.spec.ts${NC}"
    else
        echo -e "${YELLOW}⚠ Test file not found, Claude may have used a different name${NC}"
    fi
    
    # Look for any new issues JSON that might have been created
    echo ""
    echo -e "${BLUE}Checking for issues to merge...${NC}"
    
    # Check if issues.json was modified
    local new_count=$(jq '.issues | length' "$ISSUES_FILE")
    if [ "$new_count" -gt "$max_id" ]; then
        echo -e "${GREEN}✓ Issues added to issues.json${NC}"
    else
        echo -e "${YELLOW}⚠ You may need to manually add issues to issues.json${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}Spec generation complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review generated files"
    echo "  2. Run: npm run ralph:status"
    echo "  3. Run: npm run ralph"
}

main "$@"
