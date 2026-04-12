---
title: "Per-Turn Conversation Switching in W3 Rating"
artifact: SPEC-006
track: implementable
status: Ready
author: Cristos
created: 2026-04-12
last-updated: 2026-04-12
type: enhancement
parent-epic: EPIC-001
linked-artifacts:
  - SPEC-003
  - DESIGN-004
depends-on-artifacts:
  - SPEC-003
addresses: []
swain-do: required
---

# Per-Turn Conversation Switching in W3 Rating

## Problem Statement

The W3 rating UI makes you rate every turn of one conversation before starting the next. That bar is too high. Partial ratings across many conversations give better signal than full ratings of one. Forcing completion also skews the data toward whichever conversation the rater opened first.

## Desired Outcomes

A rater can rate one or two turns, switch to another conversation, and come back later — or never. Each partial rating still counts. The summary view accepts partial coverage. It reports per-tier adequacy with the data it has. This matches how the friend group will actually use the tool.

## External Behavior

### Inputs

- Ratings on any turn of any conversation, in any order.
- Navigation between conversations from inside the rating UI.

### Outputs

- Per-tier metrics built from whatever ratings exist, with a sample-size tag per tier.
- Per-conversation progress badge (e.g., "2 of 4 turns rated").
- Model identity reveal stays per-conversation. Identities unlock once every turn of that conversation is rated.

### Constraints

- Ratings save to IndexedDB on each submit. Keys: (conversation hash, turn index, model label).
- Switching conversations never drops in-flight ratings.
- Metrics must degrade well on small samples. Show the sample count.
- Replaces SPEC-003 criterion 7. Reveal is still gated on "all turns rated" — but only per conversation, not the whole run.

## Acceptance Criteria

1. **Given** a user is rating turn 1 of conversation A, **when** they switch to conversation B, **then** the rating for A is saved and B opens at its first unrated turn.
2. **Given** a user has rated some turns across several conversations, **when** they open the summary view, **then** per-tier metrics show with a sample-size tag on each.
3. **Given** a user rated every turn of conversation A but no turns of B, **when** they view A, **then** model identities for A are revealed. B stays blind.
4. **Given** a user reopens the tab after a restart, **when** W3 loads, **then** every prior rating is present and the rating UI resumes at the last rated turn.
5. **Given** the rating UI is open, **when** the user clicks the switcher, **then** a list of all loaded conversations shows with each one's rating progress ("0/4", "2/4", "4/4").
6. **Given** a conversation has zero rated turns, **when** metrics run, **then** that conversation adds nothing to any tier and is not counted against coverage.

## Verification

<!-- Populated when entering Needs Manual Test. -->

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**

- Rating UI navigation controls that switch conversations mid-flow.
- Persistence of partial ratings per turn.
- Summary metrics that accept partial coverage and show sample size.
- Per-conversation identity reveal gating.

**Out of scope:**

- Changing the 4-point rating scale or dimension tags.
- Changing what "critical failure" means or the adequacy thresholds.
- Group aggregation behavior (SPEC-004).
- A "mark this conversation skipped" explicit control — absence of ratings already communicates skipped.

## Implementation Approach

1. Replace the full-conversation rating loop with per-turn persistence. Each submit writes one row to the ratings store.
2. Add a conversation switcher to the rating UI header. It lists every loaded conversation with a progress count. Clicking one swaps the active conversation.
3. Rework metrics to iterate over all rating rows. Drop the "conversation must be complete" requirement. Emit sample counts next to each adequacy rate.
4. Gate the model-identity reveal per conversation. The reveal check runs when that conversation's last turn gets a rating — not at the end of the whole run.
5. Add sample-size badges next to each per-tier metric in the summary view. Low-confidence numbers should read as low-confidence.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-12 | | Initial creation. |
