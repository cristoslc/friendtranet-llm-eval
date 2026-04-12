---
title: "Fix qwen3.5-9b Turn 5 Empty Response"
artifact: SPEC-009
track: implementable
status: Ready
author: Cristos L-C
created: 2026-04-12
last-updated: 2026-04-12
priority-weight: ""
type: bug
parent-epic: ""
parent-initiative: ""
linked-artifacts: []
depends-on-artifacts: []
addresses: []
evidence-pool: ""
source-issue: ""
swain-do: required
---

# Fix qwen3.5-9b Turn 5 Empty Response

## Problem Statement

In W3 evaluation, the pair `Mini / qwen/qwen3.5-9b / wb-b54d18230c5` returns empty text on turn 5. The API sets `finish_reason: length`. Commit 9aa7abe raised `max_tokens` to 8192. But this pair still hits the cap. The turn has no content for the rater.

## Desired Outcomes

Mini-tier runs (qwen3.5-9b) should finish without empty turns. If the model truly cannot fit a reply in the budget, the error should be clear. The operator should have a way to recover. The rating pass should not be blocked.

## External Behavior

- When a turn truncates, the UI shows the cause and offers retry or skip.
- Per-model `max_tokens` can be set. Small models with odd caps get their own value.
- Empty-content turns do not count as success. Aggregation skips them with a note.

## Acceptance Criteria

- **Given** a W3 run that uses qwen/qwen3.5-9b, **when** a turn comes back empty with `finish_reason: length`, **then** the UI shows the cause and offers a per-turn retry with more tokens.
- **Given** a per-model `max_tokens` override for qwen/qwen3.5-9b, **when** the model runs, **then** the override wins over the 8192 default.
- **Given** a turn still truncates on retry, **when** the operator picks skip, **then** a placeholder with the cause is stored. Aggregation has no silent gap.

## Reproduction Steps

1. Open the W3 rating view with the 2-conversation × 5-tier default grid.
2. Run the evaluation for conversation `wb-b54d18230c5` against the Mini tier (qwen/qwen3.5-9b).
3. Observe turn 5 returns empty content with `finish_reason: length` despite `max_tokens=8192`.

## Severity

medium

## Expected vs. Actual Behavior

**Expected:** Turn 5 produces usable assistant text, or a clearly surfaced, recoverable truncation with operator controls.

**Actual:** Turn 5 is empty. The run is marked complete but the pairing is unusable for rating without a manual re-run.

## Verification

| Criterion | Evidence | Result |
|-----------|----------|--------|
| UI shows cause + per-turn retry on truncation | `src/routes/worksheet3/+page.svelte` (isTruncated branch, `truncated` badge, `↻ re-run` + `⊘ skip` buttons); `isTurnTruncated` helper in the store. Type check + build pass. Needs live smoke. | Pending |
| Per-model `max_tokens` override wins over default | `src/lib/data/tiers.ts` sets `maxTokens: 16384` on Mini. `resolveMaxTokens` is used in both `runEvaluation` and `rerunPairFromTurn`. Type check + build pass. Needs live smoke. | Pending |
| Skipped turn yields placeholder with cause; aggregation shows recorded gap | `skipTurnForModel` stores the turn index in `EvalResult.skippedTurns`. `computeMetrics` counts and surfaces `skippedTurns` per tier. The metrics table gains a Skipped column. Needs live smoke. | Pending |

### Smoke-test plan (operator action)

1. Start the dev server: `npm run dev`.
2. Open the SPA. Go to **Worksheet 3**. Paste an OpenRouter API key.
3. Select conversation `wb-b54d18230c5` (or the previously failing one) and the Mini tier.
4. Click **Start evaluation**. Watch the status.
5. On the turn that used to fail, confirm one of:
   - The turn now has visible content (override plus auto-retry worked).
   - The turn is flagged in errors as `Empty response ... after 2 attempts [prompt=... completion=... reasoning=...]`. The instrumentation exposes the cause.
6. Start **Rating**. On a truncated turn, confirm:
   - The response card shows a **truncated** badge.
   - Both **↻ re-run** and **⊘ skip** buttons appear.
   - Clicking **skip** mutes the card and switches the badge to **skipped (truncation)**.
   - **↶ un-skip** appears and restores the card.
7. Scroll to the **metrics table**. Confirm the **Skipped** column shows the count for the Mini tier.

## Scope & Constraints

- Check the cause first. Does OpenRouter cap qwen3.5-9b below 8192? Are reasoning tokens eating the budget? Or does prior turn context alone push past the cap?
- Do not raise `max_tokens` for all models. Costs scale per call.
- Keep changes in the worksheet3 store and evaluator. Do not rework the tier system.

## Implementation Approach

1. Reproduce the bug. Log the request, the response, and the `usage` block. Look for `reasoning_content`.
2. Pick one: per-model `max_tokens`, auto-retry with a bigger budget on length-truncation, or both.
3. Add a per-turn retry or skip control. Build on the existing per-pair re-run button.
4. Store skipped turns as placeholders. Aggregation must not drop them in silence.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-12 | df29230 | Initial creation |
