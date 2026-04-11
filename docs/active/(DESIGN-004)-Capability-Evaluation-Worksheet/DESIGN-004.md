---
id: DESIGN-004
title: Capability Evaluation Worksheet
type: design
phase: active
parent-epic: EPIC-001
created: 2026-04-11
---

# Capability Evaluation Worksheet

## Purpose

Design the UX for Worksheet 3 — the Capability Adequacy Evaluation. This is the most complex worksheet. It costs real money, involves multi-turn conversation replay through multiple models, and culminates in a blind rating UI. The design must manage complexity without overwhelming non-technical users.

## Entry flow

### API key setup

First-time panel: "Worksheet 3 sends conversations to OpenRouter for evaluation. You need an OpenRouter API key with ZDR enabled."

- Text input for API key (masked, paste-friendly).
- "Verify" button that makes a lightweight API call to confirm the key works.
- Key stored in session storage only. Explicit note: "Your key is stored in this browser tab only and is cleared when you close it."
- Link to OpenRouter signup/key management for users who don't have one.

### Tier selection

Based on the gate check results, show which tiers are economically justified. Pre-select those. User can override to test additional tiers.

Candidate tiers with model IDs:
- Mini: `qwen/qwen3-30b-a3b`.
- Small: `qwen/qwen3-next-80b-a3b-instruct`.
- Medium: `openai/gpt-oss-120b`.
- Large: `qwen/qwen3-235b-a22b`.
- Anchor: `anthropic/claude-opus-4-6` or user-selected frontier model.

Anchor tier is always included for baseline comparison. User can change the anchor model.

## Conversation selection

### Three entry paths as tabs

**Path 1 — Curated samples (free)**

Grid of 25-30 pre-selected conversations, each tagged with W2 content categories. Filter by category to show relevant samples. Each card shows: category tag, complexity level, turn count, one-line description.

User selects 5-10 samples. Selected cards show a checkmark and reorder to the top.

**Path 2 — Paste your own**

Text area for pasting multi-turn conversation text. The SPA parses user/assistant turns (heuristic: looks for "User:", "Human:", "Assistant:", or similar markers). Preview panel shows parsed turns for confirmation before use.

Alternative: file upload for Claude Code session JSONL. The SPA extracts user turns and strips metadata.

**Path 3 — Generate synthetic**

Text input: "Describe a task category in 1-3 sentences." Example placeholder: "Drafting difficult emails to my partner about household logistics."

"Generate" button creates 3 conversations at routine/moderate/hard complexity via a frontier model call through OpenRouter. Cost estimate shown before generation (~$0.10-0.30 per category). Generated conversations appear as cards that the user can review, edit, or discard before adding to evaluation set.

### Conversation list

Unified list of all selected conversations across paths. Each entry shows source (curated/pasted/generated), category, turn count. Remove button per entry. "Start evaluation" button with cost preview.

## Evaluation runner

### Cost preview

Before running: "Evaluating N conversations × M tiers × ~K tokens/turn. Estimated cost: **$X.XX**. Proceed?"

Explicit approve/cancel. No auto-run.

### Progress display

Per-conversation, per-tier progress bar. Show which conversation and tier are currently running. Estimated time remaining based on observed throughput.

Cancel button that stops after the current in-flight call completes. Partial results are cached — resuming later skips completed evaluations.

### Caching

Results cached by `(conversation hash, model ID)` in IndexedDB. If a conversation has already been evaluated against a tier, show "cached" badge and skip the API call. Re-evaluation requires explicit "re-run" action per entry.

## Blind rating UI

After evaluation completes, the rating phase begins. One turn at a time, one conversation at a time.

### Turn rating card

- **Context panel (top):** conversation history up to the current turn. User messages in one style, prior assistant responses in another.
- **Candidate responses (bottom):** randomized labels A/B/C/D (no model identities). Each response in its own card. Scroll-synced if responses are long.
- **Rating controls per response:**
  - 4-point scale: Fully adequate (4) / Usable with minor cleanup (3) / Insufficient but directional (2) / Unusable (1).
  - Optional dimension tags (toggleable chips): factual accuracy / reasoning depth / tool use / instruction following / format / tone.
- **Navigation:** "Next turn" button enabled when all candidates for the current turn are rated. Progress indicator: "Turn 3 of 12, Conversation 2 of 8."

### Model reveal

After rating all turns in a conversation, reveal model identities alongside ratings. Show per-model score breakdown for that conversation. User can revise ratings after reveal (with a "revised after reveal" flag for data integrity).

## Output summary

### Per-tier metrics table

| Tier | Adequacy rate | Critical failure rate | Weighted adequacy | Meets threshold |
|------|--------------|----------------------|-------------------|-----------------|

Threshold indicators: green check (meets all three criteria), yellow warning (close), red x (fails).

### Personal minimum adequate tier

Highlighted row in the table — lowest tier meeting:
- Weighted adequacy rate >= 80%.
- Critical failure rate <= 10%.
- No critical failures in highest-frequency tasks.

### No-tier-meets-threshold state

If no tier qualifies: "None of the tested tiers meet your adequacy threshold for sovereignty-gated work." Three options presented as cards:
- Accept degradation — use the closest tier with explicit quality tradeoff.
- Cloud escape valve — route hard tasks through ZDR API, compute annual cost for that volume.
- Narrow the subset — reduce which content categories route to local hardware.

### Compromise cost

For tasks above the user's minimum tier, input field for estimated annual volume that would need cloud routing. SPA computes the OpenRouter ZDR API cost for that volume and adds it to the decision output.
