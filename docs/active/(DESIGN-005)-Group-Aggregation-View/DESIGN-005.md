---
id: DESIGN-005
title: Group Aggregation View
type: design
phase: active
parent-epic: EPIC-001
created: 2026-04-11
---

# Group Aggregation View

## Purpose

Design the UX for the aggregation view — where one person imports all group members' exported worksheets and the SPA computes a group decision.

## Entry point

Accessible from the landing page as a separate path from the individual worksheet flow. No gating — the aggregator doesn't need to have completed their own worksheets first (though they usually will have).

## Import flow

### Import panel

- Drag-and-drop zone or file picker for JSON exports. Accept multiple files at once.
- Per-file validation on import: schema version check, completeness check (did this person finish W1+W2? W3?).
- File list showing imported members with status badges:
  - Complete (all three worksheets).
  - Partial (W1+W2 only — W3 was gated or skipped).
  - Invalid (schema mismatch or corrupt file).
- Remove button per file. "Add more" button.

### Anonymization toggle

Global toggle: "Anonymize member names." When on, members display as "Member A", "Member B", etc. When off, member names from the export files are shown (exports include a user-chosen display name, not necessarily real name).

## Per-member summary cards

One card per imported member. Each shows:

- Risk-adjusted value ($/year) from W1.
- Principle WTP ($/year) from W2.
- Combined value ($/year).
- Personal minimum adequate tier from W3 (or "not evaluated" if W3 was skipped).
- Compromise cost ($/year) if applicable.

Cards are sortable by combined value. Visual indicator of relative contribution to group total (bar width or percentage).

## Group totals panel

### Combined value

- Total combined (risk + principle) across all members, $/year.
- Breakdown bar: risk portion vs. principle portion, colored differently.

### Capability floor

- Highest personal minimum adequate tier across members who plan to use the hardware.
- If any member didn't complete W3, flag it: "Member X did not evaluate capability. Their tier requirement is unknown."

### Tier comparison table

| Tier | Annual TCO | Group value | Justified? | Clears capability floor? |
|------|-----------|-------------|------------|-------------------------|

Green/red indicators per cell. The "sweet spot" row (if any) where both economic and capability conditions hold is highlighted.

## Three-dimensional check

Three cards, one per dimension. Each shows pass/fail with explanation.

**Economic:** "Combined group value ($X/year) [>=/<] tier TCO ($Y/year)." Pass or fail.

**Capability:** "Tier [name] [clears/does not clear] the group's capability floor ([tier name] required by [member])." Pass or fail.

**Social:** Manual confirmation checkbox. "Has the group resolved hosting commitment, capital structure, and values alignment?" This is not computable — it's a human acknowledgment. Unchecked = dimension not evaluated, not failed.

## Decision output

Large card with one of four outcomes:

- **GO** — green. "All three dimensions pass at [tier]. Proceed to capital structure conversation." The SPA's job is done.
- **SMALLER TIER** — yellow. "Economic case passes at [smaller tier], which clears capability for [N of M] members. [Remaining members] would need cloud escape-valve routing at ~$Z/year."
- **DEFER** — gray. "Capability or economic case fails by a margin that could shift. Consider re-evaluating when [M5 Ultra ships / more members complete W3 / group budget changes]."
- **SKIP** — neutral gray. "Clear fail on [dimension]. Stay on API + Team Premium stack. This is a valid outcome."

SKIP is deliberately not red. Not buying hardware is not a failure.

## Red flag cards

Below the decision output, automatically surfaced when applicable:

- **Driver flag:** "Member [X]'s scores account for N% of the group total." Shown when any member exceeds 70%.
- **Risk-dominant flag:** "Risk values exceed principle values by >3x for most members. This decision is primarily risk-driven."
- **Principle-dominant flag:** "Principle values exceed risk values by >3x for most members. This decision is primarily values-driven."
- **Capability floor flag:** "No member cleared even the mini tier. The group may not have sovereignty-gated workloads that benefit from local hardware."

Each flag is a card with the finding and a one-sentence implication. No judgment — just surfacing patterns for the group to discuss.

## Export

"Export group report" button generates a summary PDF or printable HTML with:
- Per-member summaries (anonymized or not, matching toggle state).
- Group totals, tier comparison, dimensional check results.
- Decision output and red flags.
- Timestamp and schema version.

This gives the group a shareable artifact for their discussion, independent of the SPA.
