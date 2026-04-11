---
title: "Principle Scorecard"
artifact: SPEC-002
track: implementable
status: Ready
author: Cristos
created: 2026-04-11
last-updated: 2026-04-11
type: feature
parent-epic: EPIC-001
linked-artifacts:
  - DESIGN-003
depends-on-artifacts:
  - SPEC-001
addresses: []
swain-do: required
---

# Principle Scorecard

## Problem Statement

Risk quantification alone misses a key dimension: many people want sovereignty on principle, independent of expected loss. Without capturing willingness-to-pay from values, the economic case is incomplete and the group can't distinguish risk-driven from values-driven motivation.

## Desired Outcomes

Group members complete Worksheet 2 to produce an adjusted annual WTP figure. Combined with W1's risk figure, the SPA can determine which hardware tiers are economically justified — and gate access to W3 accordingly.

## External Behavior

### Inputs

- Step 1: multi-select from 10 classified content categories (+ free-text "Other").
- Step 2: single-select sovereignty stance from 8 options (+ free-text "Combination").
- Step 3: WTP slider ($0-$3,000/year, $50 increments).
- Step 4: compromise tolerance (single-select, 5 options with percentage reductions).
- Step 5: sanity check confirmation (yes/no).

### Outputs

- Adjusted annual WTP: `slider_value × (1 - compromise_reduction)`.
- Combined W1+W2 total (risk + principle) in $/year.
- Gate check result: list of economically justified hardware tiers, or "no tier justified."

### Constraints

- Per DESIGN-003: all five steps visible on a single scrollable page (not wizard-style).
- Per DESIGN-003: calibration prompts use fixed defaults ($120 streaming, $50 email, $200 data broker, $100 donation).
- Per DESIGN-003: "None — risk-only" stance skips Step 3 slider to $0 and shortens the worksheet.
- Per DESIGN-003: gate check is inline after W2, not a separate page.

## Acceptance Criteria

1. **Given** a user enters W2, **when** Step 1 renders, **then** all 10 content categories display as card-style checkboxes with a count indicator.
2. **Given** a user selects "None — risk-only" in Step 2, **when** the selection registers, **then** Step 3 defaults to $0 and shows the note "Your sovereignty value comes entirely from Worksheet 1 (risk). That's a valid position."
3. **Given** a user moves the WTP slider, **when** the value changes, **then** the four calibration anchor prompts display alongside the slider with their fixed dollar values.
4. **Given** a user selects "Significantly (50%)" in Step 4, **when** the selection registers, **then** the adjusted WTP displays as "Your $X/year x (100% - 50%) = $Y/year adjusted."
5. **Given** a user reaches Step 5 with adjusted WTP of $1,200/year, **when** the sanity check renders, **then** it shows "Your final value / 12 = $100/month. Would you actually subscribe at that price?"
6. **Given** a user clicks "No, that's too high" on the sanity check, **when** the action fires, **then** focus returns to the Step 3 slider without judgment framing.
7. **Given** a user confirms the sanity check, **when** the gate check computes, **then** it shows which tiers the combined W1+W2 total justifies (or "no tier justified") with the correct tier thresholds.
8. **Given** the combined W1+W2 total is below $984/year (Entry tier), **when** the gate check renders, **then** it shows the neutral "no tier justified" message and offers optional W3 access.
9. **Given** all W2 inputs persist to IndexedDB, **when** the user reloads, **then** all selections restore including stance, slider position, and compromise tolerance.

## Verification

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**
- All five steps of Worksheet 2 per DESIGN-003.
- Gate check logic combining W1+W2 totals against tier TCOs.
- IndexedDB persistence for W2 state.
- Navigation: back to W1, forward to W3 (or gate-blocked summary).

**Out of scope:**
- Worksheet 3 implementation (SPEC-003). W3 route gated by the gate check.
- Personalized calibration prompts (fixed defaults only).

## Implementation Approach

1. **Step components:** build each step as a component reading/writing shared worksheet state.
2. **Gate check logic:** pure function taking W1 total + W2 adjusted WTP, returning list of justified tiers.
3. **Persistence:** extend IndexedDB worksheets store for W2 data, same auto-save pattern as W1.
4. **Sanity check loop:** "No" button scrolls to Step 3 and highlights the slider. No modal, no extra state.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-11 | | Initial creation. |
