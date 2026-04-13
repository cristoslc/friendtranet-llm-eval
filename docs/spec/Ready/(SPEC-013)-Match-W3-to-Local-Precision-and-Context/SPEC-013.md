---
title: "Match W3 Evaluation to Local Precision and Context"
artifact: SPEC-013
track: implementable
status: Ready
author: Cristos
created: 2026-04-13
last-updated: 2026-04-13
type: enhancement
parent-epic: EPIC-001
linked-artifacts:
  - SPEC-003
  - SPEC-006
  - SPEC-007
  - DESIGN-004
depends-on-artifacts:
  - SPEC-003
addresses: []
trove: apple-silicon-model-tier-ram@198b2d9
swain-do: required
---

# Match W3 Evaluation to Local Precision and Context

## Problem Statement

Worksheet 3 sends models to OpenRouter. OpenRouter routes each call to one of many providers. Providers serve the same model at different quantizations (`fp4`, `int4`, `int8`, `fp6`, `fp8`, `fp16`, `bf16`, `fp32`). Without a pinned `provider.quantizations` parameter the rater sees an unspecified mix. Some calls run at full cloud precision. Others run at aggressive low-bit output. Neither matches what the local Mac would produce at MLX 4-bit. The "personal minimum adequate tier" score is compromised. The rating reflects cloud-provider variance, not real local capability.

Context length is a second axis. Different providers honor different max-token budgets. If the cloud call uses 32K context and the rater later runs 128K at home, the comparison fails again. For the friend-group case (3–5 users, long chats), 128K is the target envelope per the research trove.

## Desired Outcomes

Every W3 call hits a provider that matches the user's local precision and context budget. The rater sees, in plain text, what precision band the test runs at and how to change it. The minimum-tier score then reflects real local capability.

## External Behavior

### Inputs

- The existing W3 request flow (single eval, re-run, Custom conversation turns) — unchanged from the user's perspective.
- A W3 Settings panel with two controls:
  - Precision band: **Match local MLX 4-bit** (default, sends `['fp4', 'int4']`), **Balanced** (`['fp8']`), **Frontier quality** (`['bf16', 'fp16']`).
  - Max context: **Conservative 8K**, **Long 32K**, **Target 128K** (default), or a custom value capped at the model's native max.

### Outputs

- Every OpenRouter call carries a `provider.quantizations` field matching the chosen precision band.
- Every call caps `max_tokens` and effective context to the chosen length, or the model's native max — whichever is smaller.
- The blind rating UI shows a small precision badge ("tested at fp4/int4 — matches local MLX 4-bit") next to each tier's responses, so raters understand the comparison frame.
- The Evaluation summary line before run-start shows the precision band + context length so the user confirms before spending tokens.
- gpt-oss-120b is served at MXFP4 regardless of the precision band — it's the model's only available format. The badge notes this.

### Constraints

- Defaults must produce a fair local-vs-cloud comparison without user configuration. The out-of-the-box state is Match local MLX 4-bit + 128K.
- If no provider offers the chosen precision, OpenRouter's API errors out. The W3 client must catch this and present a recovery option: fall back to the next-higher precision band and warn.
- Custom conversations (SPEC-007) must honor the same precision + context settings as curated conversations.
- Changing the precision band invalidates cached responses for any convs that were cached at a different band. Invalidation follows the same cache-clear warning pattern used in SPEC-007 AC #4.
- The `anchor` tier is cloud-only and is not subject to precision matching — it's the frontier baseline and stays at Anthropic's default (bf16/fp32 internally).

## Acceptance Criteria

1. **Given** W3 is loaded with no stored settings, **when** the user first opens the evaluation panel, **then** precision = "Match local MLX 4-bit" and context = "Target 128K" are selected by default.
2. **Given** the user has selected Match local MLX 4-bit, **when** any candidate eval fires, **then** the OpenRouter request body contains `provider.quantizations: ['fp4', 'int4']`.
3. **Given** the user has selected Balanced, **when** any candidate eval fires, **then** the OpenRouter request body contains `provider.quantizations: ['fp8']`.
4. **Given** the user has selected Frontier quality, **when** any candidate eval fires, **then** the OpenRouter request body contains `provider.quantizations: ['bf16', 'fp16']`.
5. **Given** the user has chosen Target 128K, **when** the request fires for any model, **then** `max_tokens` is capped at `min(128000, model_native_max)` and context is capped the same way. gpt-oss-120b caps at 128000; qwen3.5 models cap at 128000 even though their native max is 256K.
6. **Given** the user changes the precision band, **when** cached responses exist that were generated at the old band, **then** a warning modal explains the mismatch and offers Clear cache & re-run, or Keep cache & note mismatch in rating UI.
7. **Given** the anchor tier fires, **when** the request is sent, **then** no `provider.quantizations` filter is applied (anchor remains full precision).
8. **Given** gpt-oss-120b fires, **when** any precision band is active, **then** the precision badge in the rating UI says "MXFP4 native — local and cloud match" rather than the generic band label.
9. **Given** an OpenRouter call fails because no provider offers the selected precision, **when** the error surfaces, **then** the UI offers: fall back to the next-higher precision and re-run, or abort the evaluation.
10. **Given** the user has set a precision band and context length, **when** the Evaluation card renders, **then** a line above the Start button shows "Sending as fp4/int4 · 128K context" so the user confirms the comparison frame before spending tokens.

## Verification

<!-- Populated when entering Needs Manual Test. -->

| Criterion | Evidence | Result |
|-----------|----------|--------|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |
| 6 | | |
| 7 | | |
| 8 | | |
| 9 | | |
| 10 | | |

## Scope & Constraints

**In scope:**

- A W3 settings surface for precision band + max context.
- Wiring `provider.quantizations` into every eval / re-run / custom-turn OpenRouter request.
- Capping `max_tokens` and effective context to the selected length or model native max.
- Precision badges on candidate response cards in the rating UI.
- Evaluation-summary disclosure of current band + context.
- Cache-invalidation warning on band change.
- Error recovery when the chosen band has no available provider.

**Out of scope:**

- Per-model precision overrides (every call in one run uses the same band).
- User-authored custom quantization combinations beyond the three presets.
- Validating that cloud output at fp4/int4 actually semantically matches MLX 4-bit — that's a research question, not a testable product behavior.
- Changing the rating scale, tier thresholds, or metrics math (SPEC-003, SPEC-006 unchanged).

## Implementation Approach

1. Add `w3Settings: { precisionBand: 'local' | 'balanced' | 'frontier', maxContext: number }` to `W3State`, with defaults `'local'` + `131072`. Persist to IndexedDB through the existing `schedulePersist` path.
2. Extend the OpenRouter request builder in `worksheet3.svelte.ts` to inject `provider.quantizations` based on the active band. For the anchor tier, skip the filter. For gpt-oss-120b, always skip (MXFP4-native).
3. Cap `max_tokens` in the request to `min(w3.w3Settings.maxContext, modelNativeMax(modelId))`. Add a small `MODEL_NATIVE_MAX_CONTEXT` lookup in `$lib/data/tiers.ts` keyed by model ID.
4. Add the Settings panel to `+page.svelte` above the Evaluation card. Two radio groups (band, context). Persist on change via the existing save pipeline.
5. Render the precision badge on each candidate card in the rating UI. Use the active band (or "MXFP4 native" for gpt-oss-120b) to label it.
6. Add the "Sending as X · YK context" summary line above the Start button. Also show in the Custom card's Start button tooltip.
7. On precision-band change: check `w3.evalResults` for any entries tagged with a different band (new `cachedPrecision` field on `EvalResult`), show the cache-invalidation modal if any match, apply band change on confirm and clear stale cache or keep cache with a mismatch flag.
8. Error path: if OpenRouter returns a provider-unavailable error, parse the response, surface the fallback option via a modal, and re-fire the request at the fallback band on confirm.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-13 | | Initial creation. Based on trove `apple-silicon-model-tier-ram@198b2d9`. Addresses a validity issue discovered while mapping local hardware RAM requirements — without precision + context matching, the W3 evaluation is not a fair proxy for local capability. |
