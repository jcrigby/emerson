#!/bin/bash
#
# ralph.sh - Automated development loop using Claude API
#
# Usage:
#   ./ralph.sh                    # Run all pending issues
#   ./ralph.sh --issue 001        # Run specific issue
#   ./ralph.sh --parse PRD.md     # Parse PRD into issues.json
#   ./ralph.sh --status           # Show current status
#
# Environment:
#   ANTHROPIC_API_KEY - Required for Claude API calls
#   RALPH_MODEL       - Model to use (default: claude-sonnet-4-20250514)
#   RALPH_MAX_TOKENS  - Max tokens for response (default: 8192)
#

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ISSUES_FILE="$SCRIPT_DIR/issues.json"
LOG_DIR="$SCRIPT_DIR/logs"
MODEL="${RALPH_MODEL:-claude-sonnet-4-20250514}"
MAX_TOKENS="${RALPH_MAX_TOKENS:-8192}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Check for required tools
check_dependencies() {
    local missing=()
    
    command -v jq >/dev/null 2>&1 || missing+=("jq")
    command -v curl >/dev/null 2>&1 || missing+=("curl")
    command -v npm >/dev/null 2>&1 || missing+=("npm")
    
    if [ ${#missing[@]} -ne 0 ]; then
        echo -e "${RED}Missing required tools: ${missing[*]}${NC}"
        exit 1
    fi
    
    if [ -z "$ANTHROPIC_API_KEY" ]; then
        echo -e "${RED}ANTHROPIC_API_KEY environment variable is required${NC}"
        exit 1
    fi
}

# Call Claude API
call_claude() {
    local system_prompt="$1"
    local user_prompt="$2"
    local output_file="$3"
    
    local request_body=$(jq -n \
        --arg model "$MODEL" \
        --argjson max_tokens "$MAX_TOKENS" \
        --arg system "$system_prompt" \
        --arg user "$user_prompt" \
        '{
            model: $model,
            max_tokens: $max_tokens,
            messages: [
                {role: "user", content: $user}
            ],
            system: $system
        }')
    
    local response=$(curl -s https://api.anthropic.com/v1/messages \
        -H "Content-Type: application/json" \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -d "$request_body")
    
    # Extract content from response
    local content=$(echo "$response" | jq -r '.content[0].text // empty')
    
    if [ -z "$content" ]; then
        echo -e "${RED}Error from Claude API:${NC}"
        echo "$response" | jq -r '.error.message // .'
        return 1
    fi
    
    echo "$content" > "$output_file"
    return 0
}

# Get next pending issue
get_next_issue() {
    jq -r '.issues[] | select(.status == "pending") | select(.attempts < .max_attempts) | .id' "$ISSUES_FILE" | head -1
}

# Get issue by ID
get_issue() {
    local id="$1"
    jq -r ".issues[] | select(.id == \"$id\")" "$ISSUES_FILE"
}

# Update issue status
update_issue() {
    local id="$1"
    local field="$2"
    local value="$3"
    
    local tmp=$(mktemp)
    jq "(.issues[] | select(.id == \"$id\") | .$field) = $value" "$ISSUES_FILE" > "$tmp"
    mv "$tmp" "$ISSUES_FILE"
}

# Increment issue attempts
increment_attempts() {
    local id="$1"
    local current=$(jq -r ".issues[] | select(.id == \"$id\") | .attempts" "$ISSUES_FILE")
    update_issue "$id" "attempts" "$((current + 1))"
}

# Read relevant files for context
read_relevant_files() {
    local issue_id="$1"
    local files=$(jq -r ".issues[] | select(.id == \"$issue_id\") | .relevant_files[]" "$ISSUES_FILE")
    
    local context=""
    for file in $files; do
        local filepath="$PROJECT_ROOT/$file"
        if [ -f "$filepath" ]; then
            context+="
=== $file ===
$(cat "$filepath")
"
        fi
    done
    
    echo "$context"
}

# Run build
run_build() {
    echo -e "${BLUE}Running build...${NC}"
    cd "$PROJECT_ROOT"
    
    if npm run build > "$LOG_DIR/build.log" 2>&1; then
        echo -e "${GREEN}Build passed${NC}"
        return 0
    else
        echo -e "${RED}Build failed${NC}"
        cat "$LOG_DIR/build.log"
        return 1
    fi
}

# Run tests
run_tests() {
    local test_file="$1"
    local test_name="$2"
    
    echo -e "${BLUE}Running tests...${NC}"
    cd "$PROJECT_ROOT"
    
    local test_cmd="npx playwright test"
    if [ -n "$test_file" ]; then
        test_cmd+=" $test_file"
    fi
    if [ -n "$test_name" ]; then
        test_cmd+=" -g \"$test_name\""
    fi
    
    if $test_cmd > "$LOG_DIR/test.log" 2>&1; then
        echo -e "${GREEN}Tests passed${NC}"
        return 0
    else
        echo -e "${RED}Tests failed${NC}"
        # Extract just the failure summary
        grep -A 20 "failing" "$LOG_DIR/test.log" || cat "$LOG_DIR/test.log"
        return 1
    fi
}

# Process a single issue
process_issue() {
    local issue_id="$1"
    local issue=$(get_issue "$issue_id")
    
    if [ -z "$issue" ]; then
        echo -e "${RED}Issue $issue_id not found${NC}"
        return 1
    fi
    
    local title=$(echo "$issue" | jq -r '.title')
    local spec=$(echo "$issue" | jq -r '.spec')
    local test_file=$(echo "$issue" | jq -r '.test_file')
    local test_name=$(echo "$issue" | jq -r '.test_name')
    local last_error=$(echo "$issue" | jq -r '.last_error // empty')
    
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Processing: $title${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Read context
    local file_context=$(read_relevant_files "$issue_id")
    
    # Build prompt
    local system_prompt="You are an expert TypeScript/React developer working on the Emerson project - an AI-powered novel writing tool.

Your task is to implement or fix code to make a specific test pass. You will be given:
1. The specification for what needs to work
2. The relevant source files
3. The test that needs to pass
4. Any previous error messages

Respond with ONLY the file changes needed. Use this exact format for each file:

=== FILE: path/to/file.tsx ===
\`\`\`typescript
// Complete file contents here
\`\`\`

If multiple files need changes, include multiple FILE blocks.
Do not include explanations outside of code comments.
Do not include partial files - always output the complete file."

    local user_prompt="## Issue: $title

## Specification
$spec

## Relevant Files
$file_context

## Test to Pass
File: $test_file
Test: $test_name"

    if [ -n "$last_error" ]; then
        user_prompt+="

## Previous Error
$last_error"
    fi
    
    # Call Claude
    increment_attempts "$issue_id"
    local response_file="$LOG_DIR/response_${issue_id}.txt"
    
    echo -e "${BLUE}Calling Claude API...${NC}"
    if ! call_claude "$system_prompt" "$user_prompt" "$response_file"; then
        update_issue "$issue_id" "last_error" "\"API call failed\""
        return 1
    fi
    
    # Parse and apply file changes
    echo -e "${BLUE}Applying changes...${NC}"
    apply_changes "$response_file"
    
    # Run build
    if ! run_build; then
        local error=$(tail -50 "$LOG_DIR/build.log" | jq -Rs .)
        update_issue "$issue_id" "last_error" "$error"
        return 1
    fi
    
    # Run tests
    if ! run_tests "$test_file" "$test_name"; then
        local error=$(tail -50 "$LOG_DIR/test.log" | jq -Rs .)
        update_issue "$issue_id" "last_error" "$error"
        return 1
    fi
    
    # Success!
    update_issue "$issue_id" "status" "\"complete\""
    update_issue "$issue_id" "last_error" "null"
    echo -e "${GREEN}✓ Issue $issue_id complete!${NC}"
    return 0
}

# Apply file changes from Claude's response
apply_changes() {
    local response_file="$1"
    
    # Extract file blocks using awk
    awk '
        /^=== FILE: / {
            # Extract filename
            match($0, /FILE: ([^ ]+)/, arr)
            filename = arr[1]
            in_file = 1
            in_code = 0
            content = ""
            next
        }
        /^```/ {
            if (in_file) {
                if (in_code) {
                    # End of code block - write file
                    print content > "'"$PROJECT_ROOT"'/" filename
                    close("'"$PROJECT_ROOT"'/" filename)
                    print "  Updated: " filename
                    in_file = 0
                    in_code = 0
                } else {
                    # Start of code block
                    in_code = 1
                }
            }
            next
        }
        in_code {
            content = content $0 "\n"
        }
    ' "$response_file"
}

# Parse PRD into issues
parse_prd() {
    local prd_file="$1"
    
    if [ ! -f "$prd_file" ]; then
        echo -e "${RED}PRD file not found: $prd_file${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Parsing PRD into issues...${NC}"
    
    local system_prompt="You are a technical project manager. Parse the given PRD into discrete, testable issues for an automated development loop.

Each issue should:
1. Be completable in a single coding session
2. Have a clear, testable acceptance criterion
3. List the specific files that need to be modified
4. Build on previous issues (specify dependencies)

Output valid JSON matching this schema:
{
  \"project\": \"emerson\",
  \"version\": \"string\",
  \"created\": \"YYYY-MM-DD\",
  \"issues\": [
    {
      \"id\": \"001\",
      \"title\": \"Short title\",
      \"status\": \"pending\",
      \"priority\": 1,
      \"spec\": \"Detailed specification of what needs to work\",
      \"test_file\": \"tests/example.spec.ts\",
      \"test_name\": \"test description to match\",
      \"relevant_files\": [\"src/file1.tsx\", \"src/file2.ts\"],
      \"depends_on\": [],
      \"attempts\": 0,
      \"max_attempts\": 5,
      \"last_error\": null
    }
  ]
}

Output ONLY valid JSON, no markdown or explanation."

    local prd_content=$(cat "$prd_file")
    local response_file="$LOG_DIR/prd_parse.json"
    
    if call_claude "$system_prompt" "$prd_content" "$response_file"; then
        # Validate JSON
        if jq empty "$response_file" 2>/dev/null; then
            cp "$response_file" "$ISSUES_FILE"
            echo -e "${GREEN}Created issues.json with $(jq '.issues | length' "$ISSUES_FILE") issues${NC}"
        else
            echo -e "${RED}Invalid JSON in response${NC}"
            cat "$response_file"
            exit 1
        fi
    else
        exit 1
    fi
}

# Show status
show_status() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Emerson Development Status${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local total=$(jq '.issues | length' "$ISSUES_FILE")
    local complete=$(jq '[.issues[] | select(.status == "complete")] | length' "$ISSUES_FILE")
    local pending=$(jq '[.issues[] | select(.status == "pending")] | length' "$ISSUES_FILE")
    local failed=$(jq '[.issues[] | select(.attempts >= .max_attempts)] | length' "$ISSUES_FILE")
    
    echo -e "Total issues:    $total"
    echo -e "${GREEN}Complete:        $complete${NC}"
    echo -e "${YELLOW}Pending:         $pending${NC}"
    echo -e "${RED}Max attempts:    $failed${NC}"
    echo ""
    
    echo "Issues:"
    jq -r '.issues[] | "  [\(.status | if . == "complete" then "✓" elif .attempts >= .max_attempts then "✗" else "○" end)] \(.id): \(.title) (attempts: \(.attempts))"' "$ISSUES_FILE"
}

# Main loop
run_loop() {
    echo -e "${BLUE}Starting Ralph development loop...${NC}"
    
    while true; do
        local issue_id=$(get_next_issue)
        
        if [ -z "$issue_id" ]; then
            echo -e "${GREEN}No more pending issues!${NC}"
            show_status
            break
        fi
        
        if ! process_issue "$issue_id"; then
            local attempts=$(jq -r ".issues[] | select(.id == \"$issue_id\") | .attempts" "$ISSUES_FILE")
            local max=$(jq -r ".issues[] | select(.id == \"$issue_id\") | .max_attempts" "$ISSUES_FILE")
            
            if [ "$attempts" -ge "$max" ]; then
                echo -e "${RED}Issue $issue_id reached max attempts, moving on...${NC}"
            else
                echo -e "${YELLOW}Issue $issue_id failed, will retry...${NC}"
            fi
        fi
        
        echo ""
    done
}

# Main
main() {
    check_dependencies
    
    case "${1:-}" in
        --parse)
            if [ -z "${2:-}" ]; then
                echo "Usage: $0 --parse <PRD.md>"
                exit 1
            fi
            parse_prd "$2"
            ;;
        --issue)
            if [ -z "${2:-}" ]; then
                echo "Usage: $0 --issue <issue_id>"
                exit 1
            fi
            process_issue "$2"
            ;;
        --status)
            show_status
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --parse <PRD.md>   Parse PRD into issues.json"
            echo "  --issue <id>       Process specific issue"
            echo "  --status           Show current status"
            echo "  --help             Show this help"
            echo ""
            echo "Environment:"
            echo "  ANTHROPIC_API_KEY  Required for Claude API"
            echo "  RALPH_MODEL        Model to use (default: claude-sonnet-4-20250514)"
            ;;
        *)
            run_loop
            ;;
    esac
}

main "$@"
