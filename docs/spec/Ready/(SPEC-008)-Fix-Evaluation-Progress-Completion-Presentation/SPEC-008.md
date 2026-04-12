---
title: "Fix Evaluation Progress Completion Presentation"
artifact: SPEC-008
track: implementable
status: Ready
author: Cristos
created: 2026-04-12
last-updated: 2026-04-12
type: bug
parent-epic: EPIC-001
linked-artifacts:
  - DESIGN-004
depends-on-artifacts: []
addresses: []
swain-do: required
---

# Fix Evaluation Progress Completion Presentation

## Problem Statement

The W3 evaluation progress panel makes an in-flight run look done. When the per-worker bar reaches the final turn, it fills all the way and labels as `5/5` even while the overall counter still reads `0/1 pairs complete · 1 in flight`. The rater reads the filled bar as "finished" and gets confused when Cancel still works and the overall bar has not moved.

## Desired Outcomes

A rater can tell at a glance whether the run is still working. The worker row never visually resolves to "done" while any part of its pair is still in flight. The overall progress only advances when full pairs complete. When the whole run finishes, the panel changes shape so the closed state reads as closed.

## Reproduction Steps

1. Enter W3 with a valid API key.
2. Pick two curated conversations and the Mini tier.
3. Clear cached results for those pairs so every call is live.
4. Start the evaluation.
5. Wait until any worker row reaches its final turn and its response is still streaming or being saved.

**Observed:** the worker bar fills to 100% and labels `N/N` while the overall counter still reads `0/1 pairs complete · 1 in flight`. The panel reads as finished even though Cancel still does work.

## Severity

medium — misleads the rater but does not corrupt data or block recovery.

## Expected vs. Actual Behavior

**Expected:** per-worker bar holds at one tick short of full until the pair is saved. The row shows a `finalizing` label during that window. The bar fills to full and the row resolves only when the pair is counted complete.

**Actual:** per-worker bar hits `N/N` and fills fully the moment the final turn starts streaming. The worker row looks finished while the overall counter still shows work in flight.

## External Behavior

### Inputs

- Stream progress events from the evaluation runner (per turn streamed, per response saved, per pair complete).

### Outputs

- Per-worker row that reflects streamed-vs-saved state, not just turn count.
- A `finalizing` label while the final response is being saved.
- Overall progress bar that only advances on pair-complete events.
- A run-complete state that is visually distinct — not just a filled bar — with the Cancel button replaced by a dismiss or continue control.

### Constraints

- Must respect the rules in DESIGN-004 § "In-flight vs. done presentation".
- Must not regress the parallel worker-row visualization shipped in commit b802d1a. Every worker still gets its own row for the run duration.
- Must work when all pairs are cached (zero uncached pairs): the UI should jump straight to the complete state without flashing the in-flight layout.

## Acceptance Criteria

1. **Given** an evaluation run is active with 1 uncached pair in flight, **when** the worker reaches its final turn and the response is still streaming, **then** the worker bar holds at one tick short of full and the row shows a `finalizing` label.
2. **Given** an evaluation run is active, **when** a pair finishes streaming but has not yet been saved, **then** the overall progress bar and the `pairs complete` counter do not advance.
3. **Given** a pair's last turn is saved, **when** the save resolves, **then** the worker bar fills to full, the overall counter advances by one pair, and the worker row resolves to its done state.
4. **Given** every pair in the run is complete, **when** the final pair resolves, **then** the panel swaps to a visually distinct complete state and the Cancel button is replaced by a dismiss or continue control.
5. **Given** the user starts a run where every selected pair is already cached, **when** the panel renders, **then** it shows the complete state immediately without flashing the in-flight layout.
6. **Given** a run is canceling after the user clicked Cancel, **when** the final in-flight call resolves, **then** the panel shows a canceled state rather than a complete state.

## Verification

<!-- Populated when entering Needs Manual Test. -->

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**

- Evaluation progress panel markup, styles, and state bindings.
- Event plumbing between the runner and the panel so streamed and saved are separate signals.
- The complete, canceled, and no-uncached-pairs end states.

**Out of scope:**

- Time-remaining estimates.
- Retry UI or error-recovery flows.
- Progress presentation for synthetic generation or custom-conversation turn fan-out (handled separately when those paths land).
- Any change to cost preview, tier selection, or blind rating UI.

## Implementation Approach

1. Split the runner's per-pair lifecycle into explicit signals: `turn-streaming`, `turn-saved`, `pair-saved`. The panel subscribes to all three.
2. Change the worker row progress math to use saved-turn count, not streamed-turn count. Add a `finalizing` flag bound to "last turn is streaming but not yet saved".
3. Remove the `pairs complete` counter's dependency on worker-row state. It only advances on `pair-saved`.
4. Add a `complete` layout variant to the panel. It shares the worker-row list for continuity but swaps controls and header styling so the closed state reads as closed.
5. On mount, if the run has zero uncached pairs, render the `complete` layout directly — no in-flight flash.
6. On cancel, after the last in-flight call resolves, render a `canceled` layout variant distinct from `complete`.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-12 | | Initial creation. |
