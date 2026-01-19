#!/bin/bash
#
# ralph.sh - Automated development loop using Claude Code
#
# Usage:
#   ./ralph.sh                    # Run all pending issues
#   ./ralph.sh --issue 001        # Run specific issue
#   ./ralph.sh --status           # Show current status
#   ./ralph.sh --reset 001        # Reset issue to pending
#   ./ralph.sh --verbose          # Show all commands (combine with above)
#
# Examples:
#   ./ralph.sh --verbose --issue 001    # Watch one issue in detail
#   ./ralph.sh --verbose                # Watch entire loop in detail
#
# Requirements:
#   - Claude Code CLI installed (`claude` command available)
#   - jq installed
#   - npm/node installed
#

set -e

# Check for --verbose flag
VERBOSE=false
for arg in "$@"; do
    if [ "$arg" == "--verbose" ] || [ "$arg" == "-v" ]; then
        VERBOSE=true
        set -x
    fi
done

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ISSUES_FILE="$SCRIPT_DIR/issues.json"
LOG_DIR="$SCRIPT_DIR/logs"

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
    command -v claude >/dev/null 2>&1 || missing+=("claude (Claude Code CLI)")
    command -v npm >/dev/null 2>&1 || missing+=("npm")
    
    if [ ${#missing[@]} -ne 0 ]; then
        echo -e "${RED}Missing required tools: ${missing[*]}${NC}"
        exit 1
    fi
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

# Update issue field
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

# Run a specific test
run_test() {
    local test_file="$1"
    local test_name="$2"
    
    cd "$PROJECT_ROOT"
    
    local test_cmd="npx playwright test"
    if [ -n "$test_file" ]; then
        test_cmd+=" $test_file"
    fi
    if [ -n "$test_name" ]; then
        test_cmd+=" -g \"$test_name\""
    fi
    
    echo -e "${BLUE}Running: $test_cmd${NC}"
    
    if eval "$test_cmd" > "$LOG_DIR/test.log" 2>&1; then
        return 0
    else
        return 1
    fi
}

# Process a single issue using Claude Code
process_issue() {
    local issue_id="$1"
    local issue=$(get_issue "$issue_id")
    
    if [ -z "$issue" ] || [ "$issue" == "null" ]; then
        echo -e "${RED}Issue $issue_id not found${NC}"
        return 1
    fi
    
    local title=$(echo "$issue" | jq -r '.title')
    local spec=$(echo "$issue" | jq -r '.spec')
    local test_file=$(echo "$issue" | jq -r '.test_file')
    local test_name=$(echo "$issue" | jq -r '.test_name')
    local attempts=$(echo "$issue" | jq -r '.attempts')
    local max_attempts=$(echo "$issue" | jq -r '.max_attempts')
    local last_error=$(echo "$issue" | jq -r '.last_error // empty')
    
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Issue $issue_id: $title${NC}"
    echo -e "${YELLOW}Attempt $((attempts + 1)) of $max_attempts${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    increment_attempts "$issue_id"
    
    # Build the prompt for Claude Code
    local prompt="You are working on the Emerson project, an AI-powered novel writing tool.

## Your Task

Implement or fix code to make this test pass:

**Issue:** $title

**Specification:** $spec

**Test File:** $test_file
**Test Name:** $test_name

## Instructions

1. First, read the test file to understand what's being tested
2. Explore the codebase to understand the current implementation
3. Make the necessary code changes
4. Run the specific test to verify: npx playwright test $test_file -g \"$test_name\"
5. If the test fails, read the error and fix it
6. Repeat until the test passes

When the test passes, say \"TEST PASSED\" and stop.
If you've tried multiple approaches and can't make it pass, say \"GIVING UP\" and explain why."

    # Add last error context if available
    if [ -n "$last_error" ] && [ "$last_error" != "null" ]; then
        prompt+="

## Previous Attempt Failed With:
$last_error

Try a different approach this time."
    fi
    
    # Run Claude Code in one-shot mode
    echo -e "${BLUE}Invoking Claude Code...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Use claude with -p for one-shot mode
    local output_file="$LOG_DIR/claude_${issue_id}_$(date +%s).log"
    
    if echo "$prompt" | claude -p --dangerously-skip-permissions 2>&1 | tee "$output_file"; then
        # Check if Claude reported success
        if grep -q "TEST PASSED" "$output_file"; then
            echo -e "${GREEN}✓ Claude reports test passed${NC}"
            
            # Verify by running the test ourselves
            if run_test "$test_file" "$test_name"; then
                echo -e "${GREEN}✓ Test verified passing!${NC}"
                update_issue "$issue_id" "status" "\"complete\""
                update_issue "$issue_id" "last_error" "null"
                return 0
            else
                echo -e "${RED}✗ Test still failing on verification${NC}"
                local error=$(tail -30 "$LOG_DIR/test.log" | jq -Rs .)
                update_issue "$issue_id" "last_error" "$error"
                return 1
            fi
        elif grep -q "GIVING UP" "$output_file"; then
            echo -e "${RED}✗ Claude gave up on this issue${NC}"
            local reason=$(grep -A 10 "GIVING UP" "$output_file" | head -10 | jq -Rs .)
            update_issue "$issue_id" "last_error" "$reason"
            return 1
        else
            echo -e "${YELLOW}? Claude finished without clear success/failure${NC}"
            # Try running the test to see where we are
            if run_test "$test_file" "$test_name"; then
                echo -e "${GREEN}✓ Test passes!${NC}"
                update_issue "$issue_id" "status" "\"complete\""
                update_issue "$issue_id" "last_error" "null"
                return 0
            else
                local error=$(tail -30 "$LOG_DIR/test.log" | jq -Rs .)
                update_issue "$issue_id" "last_error" "$error"
                return 1
            fi
        fi
    else
        echo -e "${RED}✗ Claude Code exited with error${NC}"
        update_issue "$issue_id" "last_error" "\"Claude Code exited with error\""
        return 1
    fi
}

# Reset an issue to pending
reset_issue() {
    local id="$1"
    update_issue "$id" "status" "\"pending\""
    update_issue "$id" "attempts" "0"
    update_issue "$id" "last_error" "null"
    echo -e "${GREEN}Reset issue $id to pending${NC}"
}

# Show status
show_status() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Emerson Development Status${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local total=$(jq '.issues | length' "$ISSUES_FILE")
    local complete=$(jq '[.issues[] | select(.status == "complete")] | length' "$ISSUES_FILE")
    local pending=$(jq '[.issues[] | select(.status == "pending") | select(.attempts < .max_attempts)] | length' "$ISSUES_FILE")
    local maxed=$(jq '[.issues[] | select(.status == "pending") | select(.attempts >= .max_attempts)] | length' "$ISSUES_FILE")
    
    echo ""
    echo -e "Total issues:     $total"
    echo -e "${GREEN}Complete:         $complete${NC}"
    echo -e "${YELLOW}Pending:          $pending${NC}"
    echo -e "${RED}Max attempts:     $maxed${NC}"
    echo ""
    
    echo "Issues:"
    jq -r '.issues[] | "  [\(if .status == "complete" then "✓" elif .attempts >= .max_attempts then "✗" else "○" end)] \(.id): \(.title) (\(.attempts)/\(.max_attempts))"' "$ISSUES_FILE"
}

# Main loop
run_loop() {
    echo -e "${BLUE}Starting Ralph development loop...${NC}"
    echo -e "${BLUE}Each issue runs in a fresh Claude Code session${NC}"
    echo ""
    
    while true; do
        local issue_id=$(get_next_issue)
        
        if [ -z "$issue_id" ]; then
            echo ""
            echo -e "${GREEN}No more pending issues!${NC}"
            show_status
            break
        fi
        
        if ! process_issue "$issue_id"; then
            local attempts=$(jq -r ".issues[] | select(.id == \"$issue_id\") | .attempts" "$ISSUES_FILE")
            local max=$(jq -r ".issues[] | select(.id == \"$issue_id\") | .max_attempts" "$ISSUES_FILE")
            
            if [ "$attempts" -ge "$max" ]; then
                echo -e "${RED}Issue $issue_id reached max attempts, skipping...${NC}"
            else
                echo -e "${YELLOW}Issue $issue_id failed, will retry...${NC}"
            fi
        fi
        
        echo ""
        
        # Small delay between issues
        sleep 2
    done
}

# Main - filter out verbose flag from args
main() {
    check_dependencies
    
    # Build args array without verbose flag
    local args=()
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --verbose|-v)
                shift
                ;;
            *)
                args+=("$1")
                shift
                ;;
        esac
    done
    
    # Process remaining args
    case "${args[0]:-}" in
        --issue)
            if [ -z "${args[1]:-}" ]; then
                echo "Usage: $0 --issue <issue_id>"
                exit 1
            fi
            process_issue "${args[1]}"
            ;;
        --status)
            show_status
            ;;
        --reset)
            if [ -z "${args[1]:-}" ]; then
                echo "Usage: $0 --reset <issue_id>"
                exit 1
            fi
            reset_issue "${args[1]}"
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --issue <id>       Process specific issue"
            echo "  --status           Show current status"
            echo "  --reset <id>       Reset issue to pending"
            echo "  --verbose, -v      Show all commands being executed"
            echo "  --help             Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 --verbose --issue 001   # Watch one issue in detail"
            echo "  $0 --status                # See what's pending"
            echo "  $0                         # Run full loop"
            echo ""
            echo "Requirements:"
            echo "  - Claude Code CLI (claude command)"
            echo "  - jq"
            echo "  - npm"
            ;;
        *)
            run_loop
            ;;
    esac
}

main "$@"
