# Emerson PRD: [Feature Name]

## Overview
Brief description of what this feature does and why it matters.

## User Story
As a [user type], I want to [action] so that [benefit].

## Acceptance Criteria

### Must Have
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

### Nice to Have
- [ ] Optional criterion 1
- [ ] Optional criterion 2

## Technical Requirements

### Components Affected
- `src/components/ComponentName.tsx`
- `src/lib/module.ts`

### New Files Needed
- `src/components/NewComponent.tsx`

### Data Model Changes
- New type: `TypeName`
- Modified type: `ExistingType`

## UI/UX Specification

### User Flow
1. User does X
2. System responds with Y
3. User sees Z

### States
- **Empty**: What shows when there's no data
- **Loading**: What shows during async operations
- **Error**: What shows when something fails
- **Success**: What shows when operation completes

## Test Specification

### Unit Tests
- Test case 1: description
- Test case 2: description

### Integration Tests (Playwright)
- Test case 1: User can complete flow
- Test case 2: Error states are handled

## Out of Scope
Things explicitly NOT included in this feature.

## Open Questions
- Question 1?
- Question 2?

---

## For Ralph Loop

After reviewing this PRD, generate an `issues.json` file that breaks this into discrete, testable tasks. Each task should:

1. Be completable in a single Claude API call
2. Have a clear test that verifies completion
3. Build on previous tasks (ordered dependencies)
4. Include relevant file paths for context
