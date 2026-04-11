---
title: "Group Aggregation View"
artifact: SPEC-004
track: implementable
status: Ready
author: Cristos
created: 2026-04-11
last-updated: 2026-04-11
type: feature
parent-epic: EPIC-001
linked-artifacts:
  - DESIGN-005
depends-on-artifacts:
  - SPEC-002
addresses: []
swain-do: required
---

# Group Aggregation View

## Problem Statement

Individual worksheets produce per-member numbers, but the purchase decision is a group decision. Without structured aggregation, the group has no shared view of whether the economics, capability, and social dimensions align — and no way to surface patterns (one person driving the total, risk vs. principle skew) that should inform discussion.

## Desired Outcomes

One group member imports everyone's exported JSONs. The SPA computes group totals, runs the three-dimensional check, produces a clear GO/SMALLER-TIER/DEFER/SKIP decision, and surfaces red flags. The group walks away with a defensible, shareable recommendation.

## External Behavior

### Inputs

- One or more JSON export files from individual worksheet completions.
- Anonymization toggle (on/off).
- Social dimension confirmation checkbox (manual).

### Outputs

- Per-member summary cards: risk value, principle WTP, combined value, minimum adequate tier, compromise cost.
- Group totals: combined risk+principle, risk/principle breakdown, capability floor.
- Tier comparison table with hardware configs, annual TCOs, and justified/capability indicators.
- Three-dimensional check cards (economic, capability, social) with pass/fail and explanation.
- Decision output: GO, SMALLER TIER, DEFER, or SKIP with context-specific explanation.
- Red flag cards when triggered (driver >70%, risk/principle skew >3x, nobody clears mini tier).
- Exportable group report (printable HTML or PDF).

### Constraints

- Per DESIGN-005: aggregation is local computation against imported JSONs. No server, no shared state.
- Per DESIGN-005: SKIP is neutral gray, not red. Not buying hardware is not a failure.
- Per DESIGN-005: social dimension is a manual checkbox, not computed.
- Per DESIGN-005: accessible from landing page as a separate path — no worksheet completion required.

### Hardware tier reference (for tier comparison table)

| Tier | Config | Annual TCO | Capability ceiling |
|------|--------|-----------|-------------------|
| Entry | Mac mini M4 Pro 64GB 2TB | ~$984 | Qwen3-Next-80B-A3B (tight). |
| Mid | Mac Studio M4 Max 128GB 2TB | ~$1,680 | GPT-OSS-120B comfortable. |
| High | Mac Studio M3 Ultra 256GB 2TB | ~$2,808 | Qwen3-235B-A22B comfortable. |
| Max | Mac Studio M3 Ultra 512GB (secondary) | ~$4,848 | Qwen3.5-397B / GLM-5.1 / MiniMax M2.7. |

### Red flag thresholds

- **Driver flag:** any member's combined value exceeds 70% of group total.
- **Risk-dominant:** risk values exceed principle values by >3x for majority of members.
- **Principle-dominant:** principle values exceed risk values by >3x for majority of members.
- **Capability floor flag:** no member's personal minimum adequate tier clears Mini.

## Acceptance Criteria

1. **Given** an aggregator imports 3 valid JSON exports, **when** the import completes, **then** 3 member cards display with risk value, principle WTP, combined value, and minimum tier (or "not evaluated").
2. **Given** one imported file has W1+W2 only (no W3), **when** the member card renders, **then** it shows "Partial" status and minimum tier shows "not evaluated."
3. **Given** an aggregator imports an invalid JSON file, **when** validation runs, **then** the file shows "Invalid" status with a reason and does not affect group totals.
4. **Given** the anonymization toggle is on, **when** member cards render, **then** names show as "Member A", "Member B", etc.
5. **Given** group combined value is $2,100/year, **when** the tier comparison table renders, **then** Entry ($984) and Mid ($1,680) show "Justified" and High ($2,808) and Max ($4,848) show "Not justified."
6. **Given** all three dimensions pass at a tier, **when** the decision card renders, **then** it shows "GO" in green with the tier name and "Proceed to capital structure conversation."
7. **Given** economic passes at Entry but the capability floor requires Mid, **when** the decision card renders, **then** it shows the appropriate SMALLER TIER or DEFER outcome.
8. **Given** one member's combined value is 75% of the group total, **when** the red flags compute, **then** the driver flag card appears identifying that member (or "Member X" if anonymized).
9. **Given** the aggregator clicks "Export group report," **when** the export generates, **then** a printable HTML file downloads containing all summaries, tier comparison, decision output, and red flags.
10. **Given** the social dimension checkbox is unchecked, **when** the three-dimensional check renders, **then** the social card shows "Not confirmed" (not "Failed").

## Verification

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**
- JSON import with validation and error handling.
- Per-member summary cards with anonymization.
- Group totals computation and tier comparison.
- Three-dimensional check logic and display.
- Decision output (GO/SMALLER/DEFER/SKIP).
- Red flag detection and display.
- Group report export.

**Out of scope:**
- Real-time sharing or sync between members (out of scope per VISION-001).
- Capital structure or ownership split tooling.
- Editing imported data within the aggregation view.

## Implementation Approach

1. **Import parser:** validate JSON exports against schema version. Extract W1/W2/W3 data. Handle partial exports (missing W3).
2. **Aggregation engine:** pure functions for group totals, tier justification, three-dimensional check, red flag detection. All logic unit-testable without UI.
3. **Member cards:** component rendering per-member data with anonymization support.
4. **Decision logic:** cascading rules — check GO first, then SMALLER TIER, then DEFER, then SKIP. Each outcome has a template with slot-filled explanation text.
5. **Report export:** render the aggregation view to a self-contained HTML file (inline CSS, no external deps) suitable for printing or PDF conversion.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-11 | | Initial creation. |
