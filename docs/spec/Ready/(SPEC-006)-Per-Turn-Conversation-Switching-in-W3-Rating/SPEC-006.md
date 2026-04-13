---
title: "Per-Turn Conversation Switching in W3 Rating"
artifact: SPEC-006
track: implementable
status: Ready
author: Cristos
created: 2026-04-12
last-updated: 2026-04-13
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
- Model identity reveal is per-turn. A "Reveal Models" control appears once every candidate on that turn is rated. Reveal state persists per (conversation, turn).
- Candidate model column order randomizes per turn. A rater viewing turn 1 and turn 2 of the same conversation sees a different A/B/C/D assignment for each turn.

### Constraints

- Ratings save to IndexedDB on each submit. Keys: (conversation hash, turn index, model label).
- Switching conversations never drops in-flight ratings.
- Metrics must degrade well on small samples. Show the sample count.
- Replaces SPEC-003 criterion 7. Reveal is per-turn, gated on "all candidates rated for that turn." Switching conversations or revisiting a turn preserves its reveal state.
- The A/B/C/D → model-id mapping is drawn fresh per (conversation, turn). The mapping persists in IndexedDB so returning to a rated turn shows the same labels that were shown when it was rated.

## Acceptance Criteria

1. **Given** a user is rating turn 1 of conversation A, **when** they switch to conversation B, **then** the rating for A is saved and B opens at its first unrated turn.
2. **Given** a user has rated some turns across several conversations, **when** they open the summary view, **then** per-tier metrics show with a sample-size tag on each.
3. **Given** a user rated every candidate on turn N of conversation A and clicked "Reveal Models", **when** they revisit turn N, **then** identities stay revealed. Other turns (rated or not) remain in their own reveal state.
4. **Given** a user reopens the tab after a restart, **when** W3 loads, **then** every prior rating is present and the rating UI resumes at the last rated turn.
5. **Given** the rating UI is open, **when** the user clicks the switcher, **then** a list of all loaded conversations shows with each one's rating progress ("0/4", "2/4", "4/4").
6. **Given** a conversation has zero rated turns, **when** metrics run, **then** that conversation adds nothing to any tier and is not counted against coverage.
7. **Given** a rater views turn N of a conversation followed by turn N+1, **when** each turn's evaluation panel renders, **then** the candidate column order is independently randomized per turn (the model in column A on turn N is not guaranteed to be in column A on turn N+1).
8. **Given** a rater rated turn N earlier, **when** they revisit turn N after navigating away, **then** the A/B/C/D column order matches what was shown at the time of rating (mapping persisted per-turn).

## Verification

<!-- Populated when entering Needs Manual Test. -->

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**

- Rating UI navigation controls that switch conversations mid-flow.
- Persistence of partial ratings per turn.
- Summary metrics that accept partial coverage and show sample size.
- Per-turn identity reveal gating, persisted so revisits stay consistent.
- Per-turn randomization of candidate column order, persisted so revisits stay consistent.

**Out of scope:**

- Changing the 4-point rating scale or dimension tags.
- Changing what "critical failure" means or the adequacy thresholds.
- Group aggregation behavior (SPEC-004).
- A "mark this conversation skipped" explicit control — absence of ratings already communicates skipped.

## Implementation Approach

1. Replace the full-conversation rating loop with per-turn persistence. Each submit writes one row to the ratings store.
2. Add a conversation switcher to the rating UI header. It lists every loaded conversation with a progress count. Clicking one swaps the active conversation.
3. Rework metrics to iterate over all rating rows. Drop the "conversation must be complete" requirement. Emit sample counts next to each adequacy rate.
4. Keep per-turn identity reveal (already implemented). Confirm reveal state persists across conversation switches and tab reloads; gate the "Reveal Models" control on all candidates for that turn being rated.
5. Add sample-size badges next to each per-tier metric in the summary view. Low-confidence numbers should read as low-confidence.
6. When rendering a turn, generate the A/B/C/D → model-id mapping by shuffling the selected-model list with a per-turn seed. Persist the mapping in IndexedDB (keyed by conversation hash + turn index) so returning to the turn reproduces the shown order.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-12 | | Initial creation. |
| Ready | 2026-04-13 | | Aligned spec with existing code: reveal is per-turn (manual "Reveal Models" button gated on "all candidates rated this turn"), and per-turn column randomization with persisted `labelOrder` is already in place. Added AC #7 and #8 to make those guarantees explicit. Net new work from this spec is conversation switching + partial-coverage metrics + sample-size badges. |
