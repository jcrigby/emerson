#!/bin/bash
#
# spec.sh - Generate PRD, tests, and issues from a feature description
#
# Usage:
#   ./spec.sh "I want users to be able to export their project as a PDF"
#   ./spec.sh --file feature-request.txt
#
# This generates:
#   - .ralph/prd/FEATURE_NAME.md (the PRD)
#   - tests/feature-name.spec.ts (Playwright tests)
#   - Updates .ralph/issues.json with new issues
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PRD_DIR="$SCRIPT_DIR/prd"
LOG_DIR="$SCRIPT_DIR/logs"
ISSUES_FILE="$SCRIPT_DIR/issues.json"
MODEL="${RALPH_MODEL:-claude-sonnet-4-20250514}"
MAX_TOKENS="${RALPH_MAX_TOKENS:-8192}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "$PRD_DIR" "$LOG_DIR"

# Check dependencies
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}ANTHROPIC_API_KEY required${NC}"
    exit 1
fi

# Call Claude API
call_claude() {
    local system_prompt="$1"
    local user_prompt="$2"
    
    local request_body=$(jq -n \
        --arg model "$MODEL" \
        --argjson max_tokens "$MAX_TOKENS" \
        --arg system "$system_prompt" \
        --arg user "$user_prompt" \
        '{
            model: $model,
            max_tokens: $max_tokens,
            messages: [{role: "user", content: $user}],
            system: $system
        }')
    
    local response=$(curl -s https://api.anthropic.com/v1/messages \
        -H "Content-Type: application/json" \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -d "$request_body")
    
    echo "$response" | jq -r '.content[0].text // empty'
}

# Get project context
get_project_context() {
    echo "## Current Project Structure"
    echo '```'
    find "$PROJECT_ROOT/src" -name "*.tsx" -o -name "*.ts" | head -30 | while read f; do
        echo "${f#$PROJECT_ROOT/}"
    done
    echo '```'
    
    echo ""
    echo "## Existing Types"
    echo '```typescript'
    cat "$PROJECT_ROOT/src/types/index.ts" 2>/dev/null | head -100
    echo '```'
    
    echo ""
    echo "## Existing Tests"
    echo '```'
    find "$PROJECT_ROOT/tests" -name "*.spec.ts" | while read f; do
        echo "${f#$PROJECT_ROOT/}"
    done
    echo '```'
}

# Generate PRD
generate_prd() {
    local description="$1"
    local context=$(get_project_context)
    
    echo -e "${BLUE}Generating PRD...${NC}"
    
    local system_prompt="You are a senior product manager writing a PRD for the Emerson project - an AI-powered novel writing tool built with React, TypeScript, and Vite.

Write a detailed PRD that includes:
1. Overview - what this feature does
2. User Story - as a [user], I want [action] so that [benefit]
3. Acceptance Criteria - specific, testable requirements (use checkboxes)
4. Technical Requirements - components, files, types affected
5. UI/UX Specification - user flow, states (empty, loading, error, success)
6. Test Specification - what Playwright tests should verify
7. Out of Scope - what this feature does NOT include

Be specific and practical. Reference existing code patterns from the project context.
Output in Markdown format."

    local user_prompt="## Feature Request
$description

## Project Context
$context

Write the PRD for this feature."

    call_claude "$system_prompt" "$user_prompt"
}

# Generate tests
generate_tests() {
    local prd_content="$1"
    local feature_name="$2"
    
    echo -e "${BLUE}Generating tests...${NC}"
    
    # Read existing test utils for patterns
    local test_utils=$(cat "$PROJECT_ROOT/tests/utils.ts" 2>/dev/null | head -100)
    local example_test=$(cat "$PROJECT_ROOT/tests/settings.spec.ts" 2>/dev/null | head -80)
    
    local system_prompt="You are a senior QA engineer writing Playwright tests for the Emerson project.

Write comprehensive Playwright tests based on the PRD. Follow these patterns:
1. Use the existing test utilities (setupOpenRouterMocks, clearStorage, etc.)
2. Each test should be independent and isolated
3. Test happy paths and error states
4. Use descriptive test names that match the acceptance criteria
5. Mock external APIs (OpenRouter)

Output ONLY the TypeScript test file contents, no explanation."

    local user_prompt="## PRD
$prd_content

## Existing Test Utilities
\`\`\`typescript
$test_utils
\`\`\`

## Example Test Pattern
\`\`\`typescript
$example_test
\`\`\`

Write the Playwright test file for this feature."

    call_claude "$system_prompt" "$user_prompt"
}

# Generate issues
generate_issues() {
    local prd_content="$1"
    local test_file="$2"
    local test_content="$3"
    
    echo -e "${BLUE}Generating issues...${NC}"
    
    # Get existing issues for ID continuation
    local max_id=$(jq -r '.issues | map(.id | tonumber) | max // 0' "$ISSUES_FILE" 2>/dev/null || echo "0")
    local next_id=$((max_id + 1))
    
    local system_prompt="You are a technical project manager breaking down a PRD into discrete implementation tasks.

Create issues that:
1. Are completable in a single Claude API call
2. Have a specific test that verifies completion
3. Build on each other (specify dependencies)
4. Include all relevant source files

Output valid JSON array of issues (not the full issues.json, just the array).
Start issue IDs from $(printf "%03d" $next_id).

Schema for each issue:
{
  \"id\": \"001\",
  \"title\": \"Short descriptive title\",
  \"status\": \"pending\",
  \"priority\": 1,
  \"spec\": \"Detailed specification\",
  \"test_file\": \"tests/feature.spec.ts\",
  \"test_name\": \"exact test name to match\",
  \"relevant_files\": [\"src/components/File.tsx\"],
  \"depends_on\": [\"000\"],
  \"attempts\": 0,
  \"max_attempts\": 5,
  \"last_error\": null
}"

    local user_prompt="## PRD
$prd_content

## Test File: $test_file
\`\`\`typescript
$test_content
\`\`\`

Generate the issues array."

    call_claude "$system_prompt" "$user_prompt"
}

# Main
main() {
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
    
    # Step 1: Generate PRD
    local prd_file="$PRD_DIR/${feature_name}.md"
    local prd_content=$(generate_prd "$description")
    
    if [ -z "$prd_content" ]; then
        echo -e "${RED}Failed to generate PRD${NC}"
        exit 1
    fi
    
    echo "$prd_content" > "$prd_file"
    echo -e "${GREEN}✓ PRD saved: $prd_file${NC}"
    
    # Step 2: Generate tests
    local test_file="tests/${feature_name}.spec.ts"
    local test_content=$(generate_tests "$prd_content" "$feature_name")
    
    if [ -z "$test_content" ]; then
        echo -e "${RED}Failed to generate tests${NC}"
        exit 1
    fi
    
    # Clean up markdown code blocks if present
    test_content=$(echo "$test_content" | sed '/^```typescript$/d' | sed '/^```$/d')
    
    echo "$test_content" > "$PROJECT_ROOT/$test_file"
    echo -e "${GREEN}✓ Tests saved: $test_file${NC}"
    
    # Step 3: Generate issues
    local issues_json=$(generate_issues "$prd_content" "$test_file" "$test_content")
    
    if [ -z "$issues_json" ]; then
        echo -e "${RED}Failed to generate issues${NC}"
        exit 1
    fi
    
    # Clean up and merge into existing issues.json
    issues_json=$(echo "$issues_json" | sed '/^```json$/d' | sed '/^```$/d')
    
    # Validate JSON
    if ! echo "$issues_json" | jq empty 2>/dev/null; then
        echo -e "${RED}Invalid issues JSON generated${NC}"
        echo "$issues_json" > "$LOG_DIR/failed_issues.json"
        exit 1
    fi
    
    # Merge with existing issues
    local tmp=$(mktemp)
    jq --argjson new "$issues_json" '.issues += $new' "$ISSUES_FILE" > "$tmp"
    mv "$tmp" "$ISSUES_FILE"
    
    local new_count=$(echo "$issues_json" | jq 'length')
    echo -e "${GREEN}✓ Added $new_count issues to issues.json${NC}"
    
    # Summary
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}Spec generation complete!${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Generated files:"
    echo "  - $prd_file"
    echo "  - $test_file"
    echo "  - Updated: .ralph/issues.json (+$new_count issues)"
    echo ""
    echo "Next steps:"
    echo "  1. Review the PRD: cat $prd_file"
    echo "  2. Review the tests: cat $PROJECT_ROOT/$test_file"
    echo "  3. Run the loop: npm run ralph"
}

main "$@"
