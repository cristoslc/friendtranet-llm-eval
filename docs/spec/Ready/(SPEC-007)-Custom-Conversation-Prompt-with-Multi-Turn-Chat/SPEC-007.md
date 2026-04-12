---
title: "Custom Conversation Prompt with Multi-Turn Chat"
artifact: SPEC-007
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

# Custom Conversation Prompt with Multi-Turn Chat

## Problem Statement

The three W3 paths — curated, pasted, and synthetic — do not cover every workload. Sometimes a rater wants to drive a fresh conversation and follow up in the moment. Today that means leaving W3, drafting text by hand, and pasting it back. A first-class "Custom" path removes the friction. It also produces evaluations that match the rater's real intent.

## Desired Outcomes

A rater picks a "Custom" card, writes an opening prompt, and takes the selected models through up to five turns. The result slots into the same blind rating flow. Custom conversations save to IndexedDB like curated ones. Editing a prompt that has cached results triggers a clear warning before any data is lost.

## External Behavior

### Inputs

- A "Custom" conversation card placed first in the W3 conversation selector.
- A checkbox on the Custom card that must be checked before the opening-prompt textarea becomes editable.
- A multi-turn chat surface that runs the same candidate-model fan-out as every other path, up to five rater turns total.

### Outputs

- Up to five turns of rater-authored input plus per-turn responses from every selected candidate model.
- A saved custom conversation in IndexedDB, keyed by a hash of the opening prompt plus turn sequence, so the rating flow can cache and reuse results the same way it does for curated conversations.

### Constraints

- The textarea is read-only by default. Checking the gating checkbox enables it; unchecking disables it again without clearing the draft text.
- When the textarea holds a prompt that already produced cached results, the first edit attempt in that session triggers a warning modal. The modal explains that saving will wipe the cached results for this conversation. The rater must confirm before the edit applies. Cancelling restores the prior text.
- Cost preview must fire before each turn's model calls, matching the approval pattern already used for the other paths (per DESIGN-004).
- Maximum of five rater turns per custom conversation. The UI disables the input surface after the fifth turn.
- Custom conversations share the blind rating pipeline. The rating UI does not treat Custom specially — same labels, same reveal rules (per SPEC-006).

## Acceptance Criteria

1. **Given** a user enters W3 with a valid API key, **when** the conversation selector renders, **then** a "Custom" card appears as the first card with a gating checkbox and a disabled textarea.
2. **Given** the Custom card is visible, **when** the user checks the gating checkbox, **then** the textarea becomes editable. Unchecking it disables the textarea again without clearing its content.
3. **Given** the Custom card has no cached results, **when** the user edits the textarea, **then** the edit applies immediately with no warning.
4. **Given** the Custom card has cached results for one or more models, **when** the user attempts their first edit of the session, **then** a warning modal explains that saving will wipe the cached results. Confirming applies the edit and clears the cache entries. Cancelling restores the prior text.
5. **Given** the user has written an opening prompt and approved the cost preview, **when** evaluation starts, **then** all selected candidate models generate a response to the opening prompt and the rating UI opens on turn 1.
6. **Given** the rater has rated turn N of a custom conversation, **when** they submit their next user message, **then** each selected candidate model generates a response for turn N+1 after the cost preview is approved.
7. **Given** the rater has completed five turns, **when** they attempt to add a sixth, **then** the input surface is disabled and a message explains the five-turn cap.
8. **Given** the rater closes and reopens the tab, **when** they return to W3, **then** the custom conversation including its turns and ratings is restored from IndexedDB.

## Verification

<!-- Populated when entering Needs Manual Test. -->

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**

- The Custom card, its gating checkbox, and its opening-prompt textarea.
- The multi-turn chat loop, capped at five rater turns, reusing the existing OpenRouter client and cost-preview pattern.
- The cached-result invalidation warning modal.
- IndexedDB persistence so custom conversations survive tab close.

**Out of scope:**

- More than five rater turns — explicitly capped to keep cost predictable.
- Fine-tuned sampling controls (temperature, top-p, system prompts beyond the user-written one) — not needed for directional capability data.
- A library view for managing multiple saved custom conversations. One active custom conversation at a time is enough for now.
- Changes to how non-Custom paths render or behave.

## Implementation Approach

1. Add the Custom card as the first entry in the conversation selector. It owns local state for the checkbox, the draft prompt, and a "warning acknowledged this session" flag.
2. Wire the warning modal to the textarea's change event. On first edit with cached results present, block the change until the rater confirms. On confirm, delete the matching ratings and cached responses.
3. Extend the conversation data model to allow a growing turn list. The curated and pasted paths already store a turn array — custom conversations append to it as the chat runs.
4. Reuse the existing OpenRouter client and cost preview per turn. Enforce the five-turn cap in the chat surface, not in the store.
5. Plug into the blind rating UI unchanged. The rating code does not need to know a conversation is custom. It reads turns, labels responses, and saves ratings the same way.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-12 | | Initial creation. |
