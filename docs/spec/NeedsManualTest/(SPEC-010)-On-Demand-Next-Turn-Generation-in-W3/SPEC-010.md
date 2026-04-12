---
title: "On-Demand Next-Turn Generation in W3"
artifact: SPEC-010
track: implementable
status: Ready
author: Cristos
created: 2026-04-12
last-updated: 2026-04-12
type: enhancement
parent-epic: EPIC-001
linked-artifacts:
  - SPEC-003
  - SPEC-006
  - DESIGN-004
depends-on-artifacts:
  - SPEC-003
addresses: []
swain-do: required
---

# On-Demand Next-Turn Generation in W3

## Problem Statement

W3 currently generates every turn of every conversation across every selected tier before the rating UI opens. That batch is slow and expensive. With [SPEC-006](../(SPEC-006)-Per-Turn-Conversation-Switching-in-W3-Rating/SPEC-006.md) in place, raters routinely skim one or two turns across many conversations and never touch the rest. Paying to generate the long tail of turns that nobody rates wastes money and delays first rating signal.

## Desired Outcomes

A rater can start an evaluation and see ratable content within a single round-trip — just turn 1 for every conversation. When they want to go deeper on a specific conversation, they click "Generate next turn" on that conversation, approve a small cost estimate, and wait seconds rather than minutes. Budget-conscious raters pay for the turns they actually look at; curious raters can go all the way to the end of a conversation one turn at a time.

## External Behavior

### Inputs

- "Start Evaluation" from the evaluation runner — unchanged entry point, but scoped to turn 1 only per conversation × tier.
- "Generate next turn" control on each conversation inside the rating UI.
- Explicit approve/cancel on the per-expansion cost preview.

### Outputs

- Initial batch cost preview reads "Generating turn 1 only. Later turns are generated on demand." with the turn-1 estimate.
- Rating UI opens as soon as turn 1 is generated for every conversation × selected tier.
- Each conversation in the switcher shows how many turns have been generated vs. the conversation's declared turn count (e.g., "1/5 turns generated").
- Clicking "Generate next turn" opens a mini preview: estimated seconds + estimated dollars for turn N+1 across the selected tiers for that conversation. Nothing runs until approved.
- After approval, turn N+1 generates for all candidate tiers of that one conversation and appears in the rating UI as soon as it's saved.

### Constraints

- Cache key extends to `(conversation hash, model ID, turn index)`. Existing `(conversation hash, model ID)` entries are migrated to treat each cached replay as a set of per-turn rows.
- A conversation's turn N cannot be generated until turn N-1 exists for every selected tier on that conversation. Replay is sequential per tier.
- On-demand generation for one conversation never blocks the rating UI for other conversations. The rater can keep rating while a background generation runs.
- Only one on-demand expansion runs at a time per conversation. A second click while the first is in flight is a no-op with a tooltip.
- Re-run semantics from [SPEC-003](../(SPEC-003)-Capability-Evaluation/SPEC-003.md) still apply: cached turns are reused; re-running requires explicit action.
- Per-candidate retry on failure (timeout, empty response per [SPEC-009](../(SPEC-009)-Fix-qwen3.5-9b-Turn-5-Empty-Response/(SPEC-009)-Fix-qwen3.5-9b-Turn-5-Empty-Response.md)) does not force re-generating the other candidates for that turn.

## Acceptance Criteria

1. **Given** the rater clicks Start Evaluation, **when** the cost preview renders, **then** the estimate is scoped to turn 1 per conversation × selected tier and the preview text states that later turns generate on demand.
2. **Given** the initial batch is complete, **when** the rating UI opens, **then** every conversation has turn 1 generated for every selected tier and no turn 2+ data is present.
3. **Given** a conversation has at least one un-generated turn, **when** the rater clicks "Generate next turn" on that conversation, **then** a cost-and-time preview appears and no generation starts until the rater approves.
4. **Given** the rater approves a next-turn expansion for conversation A at turn index N, **when** generation runs, **then** turn N is fetched sequentially for every selected tier on conversation A, saved to cache keyed by (conversation hash, model ID, turn index), and the rating UI shows turn N as soon as every candidate for that turn is saved.
5. **Given** a next-turn expansion is in flight on conversation A, **when** the rater switches to conversation B and rates turns there, **then** conversation B is fully interactive and conversation A's switcher entry shows a "generating turn N" indicator that clears when the expansion completes.
6. **Given** a conversation has `turn_count` turns declared, **when** the final turn has been generated, **then** the "Generate next turn" control on that conversation is hidden or disabled with a tooltip explaining that no further turns exist.
7. **Given** the rater expands to turn N and then closes and reopens the tab, **when** W3 loads, **then** every cached turn (including the on-demand expansions) is restored and the "Generate next turn" control reflects the current progress.
8. **Given** the on-demand expansion fails for one candidate model on turn N (timeout, empty response), **when** the failure is surfaced in the rating UI, **then** only that candidate shows as failed and the rater can retry just that candidate without re-running the others.
9. **Given** the rater has already generated turn N for a conversation, **when** they trigger another expansion on the same conversation, **then** the preview estimates only turn N+1 (not a cumulative bulk estimate) and only turn N+1 runs on approval.

## Verification

<!-- Populated when entering Needs Manual Test. -->

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**

- Changing the initial evaluation batch to turn-1-only per conversation × tier.
- A "Generate next turn" control per conversation inside the rating UI.
- Cost/time preview for each per-turn expansion.
- Per-conversation in-flight indicator during expansion.
- Per-candidate retry on failure.
- Cache schema extension to per-turn granularity and migration of existing cached replays.

**Out of scope:**

- A bulk "generate all remaining turns" action. Easy to blow the budget by accident.
- Background auto-generation while the rater is rating. Explicit action keeps the cost model legible.
- Changing the rating scale, dimension tags, reveal semantics, or per-turn randomization ([SPEC-006](../(SPEC-006)-Per-Turn-Conversation-Switching-in-W3-Rating/SPEC-006.md)).
- Changing tier selection or conversation-source paths ([SPEC-003](../(SPEC-003)-Capability-Evaluation/SPEC-003.md)).
- Generating more than one next turn per click for a conversation.

## Implementation Approach

1. Split the evaluation runner's replay loop into `runInitialBatch(conversations, tiers)` (hard-cap at turn index 1) and `expandTurn(conversationHash, nextTurnIndex, tiers)` (single conversation, single turn across tiers). Both write to the same results store.
2. Extend the IndexedDB results schema so each row is `(conversation hash, model ID, turn index) → { response, timestamp, cost, status }`. Write a one-shot migration that splits any existing full-conversation cached rows into per-turn rows.
3. Add a `generatedTurnCount` per conversation derived from the results store. The rating UI uses this to gate the "Generate next turn" affordance and decorate the conversation switcher.
4. Reuse the main cost-preview component with a per-turn estimate function. Preview copy states "~N seconds" and "~$X.XX" for one turn across the selected tiers.
5. Model in-flight state per conversation (`generating: { turnIndex, tiers[] }`) in the evaluation runner's state. Switching conversations in the rating UI does not pause generation; the in-flight indicator persists on the conversation that owns the expansion.
6. Hook per-candidate retry into the existing truncation/empty-response surfacing from [SPEC-009](../(SPEC-009)-Fix-qwen3.5-9b-Turn-5-Empty-Response/(SPEC-009)-Fix-qwen3.5-9b-Turn-5-Empty-Response.md). Retry replays only the failed `(conversation hash, model ID, turn index)` triple.
7. Update the evaluation-runner progress display to degrade gracefully: during the initial batch it shows "turn 1 of 1" per pair; during an on-demand expansion it shows one worker row scoped to the active conversation.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-12 | | Initial creation. User-requested enhancement on top of SPEC-003 + SPEC-006 to move W3 generation from upfront batch to lazy per-turn expansion. |
