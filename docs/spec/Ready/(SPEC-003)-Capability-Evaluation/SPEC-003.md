---
title: "Capability Evaluation"
artifact: SPEC-003
track: implementable
status: Ready
author: Cristos
created: 2026-04-11
last-updated: 2026-04-11
type: feature
parent-epic: EPIC-001
linked-artifacts:
  - DESIGN-004
depends-on-artifacts:
  - SPEC-002
addresses: []
swain-do: required
---

# Capability Evaluation

## Problem Statement

Economic justification is necessary but not sufficient. The group needs to know whether local-tier models are actually good enough for their sovereignty-gated workloads. Without blind capability testing, the decision rests on vibes rather than evidence.

## Desired Outcomes

Group members who pass the gate check can run blind evaluations of candidate local models against a frontier baseline, rate outputs without knowing which model produced them, and get a defensible personal minimum adequate tier backed by real data.

## External Behavior

### Inputs

- OpenRouter API key (session storage only).
- Tier selection: which candidate models to test (pre-selected from gate check, user-overridable).
- Conversations via three paths:
  - Path 1: select from 25-30 bundled curated samples (free).
  - Path 2: paste multi-turn text or upload Claude Code JSONL.
  - Path 3: describe a task category in 1-3 sentences for synthetic generation via OpenRouter.
- Blind ratings: 4-point scale per candidate response per turn. Optional dimension tags.
- Cost approval before each evaluation run.

### Outputs

- Per-tier metrics: adequacy rate (% turns scoring >= 3), critical failure rate (% scoring 1), weighted adequacy rate.
- Personal minimum adequate tier: lowest tier meeting all three thresholds (weighted adequacy >= 80%, critical failure rate <= 10%, no critical failures in highest-frequency tasks).
- Compromise cost: estimated annual API cost for tasks that exceed the minimum tier.
- "No tier meets threshold" state with three explicit options (accept degradation, cloud escape valve, narrow subset).

### Constraints

- Per DESIGN-004: API key stored in session storage only, cleared on tab close.
- Per DESIGN-004: cost preview required before every API call batch (evaluation runs and synthetic generation).
- Per DESIGN-004: blind rating UI shows randomized labels (A/B/C/D), model identities revealed only after all turns in a conversation are rated.
- Per DESIGN-004: evaluation results cached by (conversation hash, model ID) in IndexedDB. Re-runs are free.
- All OpenRouter calls use the user's account-level ZDR. SPA never transmits the key anywhere except OpenRouter endpoints.

### Candidate model tiers

- Mini: `qwen/qwen3-30b-a3b`.
- Small: `qwen/qwen3-next-80b-a3b-instruct`.
- Medium: `openai/gpt-oss-120b`.
- Large: `qwen/qwen3-235b-a22b`.
- Anchor: `anthropic/claude-opus-4-6` (default, user-changeable).

## Acceptance Criteria

1. **Given** a user enters W3 with a valid API key, **when** the key is verified via a lightweight OpenRouter call, **then** the tier selection panel shows with justified tiers pre-selected.
2. **Given** a user selects Path 1 (curated samples), **when** they filter by a W2 content category, **then** only conversations tagged with that category display.
3. **Given** a user selects Path 3 (synthetic), **when** they enter a task description and click Generate, **then** a cost estimate shows before the API call fires, and 3 conversations at routine/moderate/hard complexity are generated on approval.
4. **Given** a user has selected conversations and tiers, **when** they click Start Evaluation, **then** a cost preview shows the estimated total, and evaluation begins only after explicit approval.
5. **Given** an evaluation is running, **when** the user clicks Cancel, **then** the current in-flight call completes and no new calls are made. Partial results are cached.
6. **Given** evaluation completes for a conversation, **when** the blind rating UI renders for turn 1, **then** candidate responses appear with randomized labels (A/B/C/D) and no model identities.
7. **Given** a user rates all turns for a conversation, **when** they complete the final turn, **then** model identities are revealed alongside the ratings with per-model score breakdowns.
8. **Given** a user has rated all conversations, **when** the output summary renders, **then** per-tier metrics display with the personal minimum adequate tier highlighted (or the "no tier meets threshold" state with three options).
9. **Given** a conversation+model pair has already been evaluated, **when** the user re-runs evaluation for the same pair, **then** the cached result is used and a "cached" badge displays. No API call is made.
10. **Given** the user closes and reopens the browser tab, **when** the API key field renders, **then** it is empty (session storage cleared). Evaluation results and ratings persist in IndexedDB.

## Verification

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**
- API key entry, validation, and session storage management.
- All three conversation entry paths per DESIGN-004.
- OpenRouter API integration for conversation replay and synthetic generation.
- Blind rating UI with model reveal.
- Adequacy metrics computation and minimum tier determination.
- Evaluation caching in IndexedDB.
- Compromise cost estimation.
- JSON export of W3 results (integrated into the full worksheet export).

**Out of scope:**
- Curating the 25-30 sample conversations (separate data task, bundled as static JSON).
- Group aggregation (SPEC-004).
- Custom evaluation prompts or fine-tuned scoring rubrics.

## Implementation Approach

1. **API key panel:** masked input, session storage write, verify endpoint call.
2. **Conversation manager:** unified data model for curated/pasted/generated conversations. IndexedDB conversations store.
3. **OpenRouter client:** thin wrapper around fetch. Handles streaming, error recovery, cost estimation from model pricing. Rate limiting to avoid OpenRouter throttling.
4. **Evaluation runner:** sequential conversation replay per tier. Progress tracking. Cancel support. Result caching.
5. **Blind rating UI:** randomized label assignment (seeded per conversation for consistency). 4-point rating controls. Dimension tag toggles. Model reveal on conversation completion.
6. **Metrics computation:** pure functions for adequacy rate, critical failure rate, weighted adequacy, minimum tier determination.
7. **Export integration:** extend the JSON export format from SPEC-001 to include W3 metrics and tier results.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-11 | | Initial creation. |
