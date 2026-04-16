---
title: "Group Auto-Loads Own Assessment"
artifact: SPEC-017
track: implementable
status: Active
author: Cristos
created: 2026-04-16
last-updated: 2026-04-16
type: enhancement
parent-epic: EPIC-001
linked-artifacts:
  - DESIGN-005
depends-on-artifacts:
  - SPEC-004
addresses: []
swain-do: required
---

# Group Auto-Loads Own Assessment

## Problem Statement

The Group Aggregation page starts empty. The user must complete their worksheets, export their data to JSON, then import that same JSON back into the aggregation page before adding other members' files. This round-trip is unnecessary friction — the user's own data already exists in IndexedDB. The aggregation page should detect and display the user's own assessment automatically, then provide the dropzone for importing other members' files.

## Desired Outcomes

When the user navigates to the Group Aggregation page, their own assessment data (from IndexedDB) appears as the first member card. The dropzone remains available for importing other members' JSON exports. The user can remove their own card if they want to exclude their data. No export-and-import round-trip required for the current user's own data.

## External Behavior

### Auto-load on page mount

- On mount, the aggregation page reads W1, W2, and W3 from IndexedDB (via `dbGet`).
- If any worksheet data exists (at minimum W1 has at least one completed threat row), the user's own assessment is generated as an `ExportData` object via `generateExport()` and inserted as the first entry in `members[]`.
- The user's card is visually distinct: it shows "(you)" after the display name and has a slightly different styling (e.g., a subtle border accent) to distinguish it from imported members.
- The display name for the auto-loaded member uses a configurable default like "My Assessment" or the value stored in a session-scope preference. If no preference exists, prompt once with a text input in the card header.

### Dropzone scope

- The dropzone legend text changes from "Drop JSON export files here" to "Add other members' results" or similar.
- The dropzone only accepts JSON files from other members. The user's own data is already present.
- Importing a file with the same `displayName` as the auto-loaded member shows a warning: "A member named '{name}' is already present. Import anyway?" with Yes/No options.

### Remove behavior

- The user can remove their own auto-loaded card (the X button works the same as for imported members).
- After removal, a "Load my assessment" button appears in the import panel to re-add it without requiring export/import.

### Summary-card update

- The left-panel summary-card reflects the auto-loaded member in the count: "1 member" initially (or "0 members" if no own data exists).
- HardwareTierBars appear in the summary-card once the user's data is loaded, showing their combined value vs. hardware tiers.

### Edge cases

- **No worksheet data at all:** The page behaves exactly as it does now — empty dropzone, zero members, prompt to import.
- **Only W1 completed:** Auto-load works with partial data (W2 and W3 marked as zero/not-evaluated).
- **Only W2 completed:** Auto-load works with partial data (W1 risk = 0, W3 not evaluated).
- **User clears all data (reset):** The auto-loaded card disappears on next page visit.

## Acceptance Criteria

1. **Given** the user has completed at least W1, **when** navigating to the Group Aggregation page, **then** their own assessment appears as the first member card with "(you)" label.
2. **Given** the auto-loaded member card, **when** viewing the card, **then** it shows the same data fields (risk value, principle WTP, combined, minimum tier) as any imported member card.
3. **Given** the auto-loaded member card, **when** the user clicks "Remove," **then** the card is removed and a "Load my assessment" button appears in the import panel.
4. **Given** the user has no worksheet data, **when** navigating to the Group Aggregation page, **then** the page shows the empty dropzone state (0 members) with no auto-loaded card.
5. **Given** the auto-loaded member exists, **when** importing a JSON file with the same display name, **then** a warning prompts the user before adding a duplicate.
6. **Given** the auto-loaded member and 2 imported members, **when** group totals compute, **then** all 3 members are included in the sum.
7. **Given** the summary-card, **when** the auto-loaded member is present, **then** `HardwareTierBars` shows the user's combined value vs. hardware tiers (not just import-based totals).

## Verification

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**
- Auto-detect and load the current user's assessment from IndexedDB on aggregation page mount.
- Visual distinction for the user's own card ("you" label, subtle styling).
- "Load my assessment" button after removal.
- Duplicate-name warning on import.
- Summary-card HardwareTierBars for the user's own data.
- Dropzone legend text update.

**Out of scope:**
- Persisting a display name preference across sessions (future enhancement).
- Muting or locking the user's own card to prevent removal.
- Real-time sync when the user modifies worksheet data in another tab.

## Implementation Approach

1. **Import stores:** Add imports for `loadW1`, `isW1Loaded`, `computeTotalLoss` from W1 store; `loadW2`, `computeAdjustedWtp` from W2 store; `dbGet` from DB store; `generateExport` from export store.
2. **onMount auto-load:** In the aggregation page's `onMount`, call `loadW1()` and `loadW2()`. After load, check if any W1 responses exist (at least one threat has a probability set). If so, call `generateExport(displayName)` and prepend to `members[]`.
3. **Track own member index:** Add an `$state` variable `ownMemberIndex` to track which entry in `members[]` is the auto-loaded one. Set to 0 on auto-load, set to -1 on removal.
4. **Card rendering:** When rendering a member card, check `i === ownMemberIndex` to add "(you)" label and distinct styling.
5. **Remove handling:** Override `removeMember` for the own card: set `ownMemberIndex = -1` and show the "Load my assessment" button.
6. **Re-add button:** "Load my assessment" button calls `generateExport` again and prepends to `members[]`, resetting `ownMemberIndex = 0`.
7. **Duplicate check:** In `handleFiles`, before pushing to `members`, check if `data.displayName` matches `members[ownMemberIndex]?.displayName`. If so, show a confirmation dialog.
8. **Summary-card:** Add `HardwareTierBars` to the aggregation summary-card, using the auto-loaded member's combined value when present.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Active | 2026-04-16 | | Initial creation. |