---
title: "Generalize Fixed-Quantization Tier Handling"
artifact: SPEC-015
track: implementable
status: Needs Manual Test
author: Cristos
created: 2026-04-14
last-updated: 2026-04-14
type: bug-fix
parent-epic: EPIC-001
linked-artifacts:
  - SPEC-013
  - SPEC-014
depends-on-artifacts:
  - SPEC-013
trove: apple-silicon-model-tier-ram@c1d2f4b
swain-do: required
---

# Generalize Fixed-Quantization Tier Handling

## Problem Statement

SPEC-013 added `provider.quantizations` injection to all W3 OpenRouter calls. It hardcodes `openai/gpt-oss-120b` as the only model that bypasses the precision band (it is MXFP4-native). Two new tiers added after SPEC-013 — XL (`z-ai/glm-4.6`) and Max (`meta/llama-4-maverick`) — also have fixed cloud quantization (fp8-only on all providers). Neither is recognized by the bypass logic.

Without a fix, every XL and Max call sends `provider.quantizations: ['fp4', 'int4']` under the default "Match local MLX 4-bit" band. No provider serves either model at fp4/int4, so every call fails with a provider-unavailable error.

## Desired Outcomes

XL and Max calls reach their providers without a quantization filter. The precision badge and mismatch logic reflect their actual cloud quantization (fp8) rather than treating them like a band-selectable model.

## External Behavior

### Inputs

The existing W3 evaluation flow — no new controls are added.

### Outputs

- XL and Max calls are sent with no `provider.quantizations` filter, allowing each provider to serve at its native format (fp8).
- The precision badge on XL and Max candidate cards reads "fp8 only — cloud serves fp8, local runs int4."
- The `hasBandMismatch` warning is suppressed for XL and Max (their cached precision is always fp8 regardless of band).
- The "Active band" summary disclosure adds "XL and Max run fp8 regardless of band" alongside the existing gpt-oss-120b note.
- gpt-oss-120b behavior and badge text are unchanged.

### Constraints

- The fix is data-driven: a new `cloudQuantization?: 'mxfp4' | 'fp8'` field on `ModelTier` replaces all hardcoded model-ID checks. No future fixed-quantization model should require a code change.
- The implementation approach in `resolveQuantizations` and `precisionLabel` must look up the tier from `modelTiers` by `modelId`, not hardcode any model ID strings.

## Acceptance Criteria

1. **Given** the XL tier is selected and the precision band is "Match local MLX 4-bit," **when** an eval fires, **then** the OpenRouter request body contains no `provider.quantizations` field.
2. **Given** the Max tier is selected and any precision band is active, **when** an eval fires, **then** the OpenRouter request body contains no `provider.quantizations` field.
3. **Given** a completed XL or Max eval result, **when** the precision badge renders, **then** it reads "fp8 only — cloud serves fp8, local runs int4."
4. **Given** a cached XL or Max result at any precision band, **when** the user changes the precision band, **then** no band-mismatch warning appears for those tiers.
5. **Given** the Evaluation Settings panel renders, **when** the "Active band" summary is shown, **then** it lists XL and Max alongside gpt-oss-120b as band-bypass exceptions.
6. **Given** `ModelTier.cloudQuantization` is set to `'mxfp4'` for gpt-oss-120b, **when** `resolveQuantizations` is called for that model, **then** behavior is unchanged from SPEC-013 (returns null, badge text unchanged).
7. **Given** svelte-check runs on the modified files, **then** 0 errors and 0 warnings.

## Implementation Approach

1. Add `cloudQuantization?: 'mxfp4' | 'fp8'` to the `ModelTier` interface in `tiers.ts`.
2. Set `cloudQuantization: 'mxfp4'` on `openai/gpt-oss-120b`, `cloudQuantization: 'fp8'` on `z-ai/glm-4.6` and `meta/llama-4-maverick`.
3. In `resolveQuantizations` in `worksheet3.svelte.ts`: replace the hardcoded `gpt-oss-120b` check with `if (modelTiers.find(t => t.modelId === modelId)?.cloudQuantization) return null`.
4. In `precisionLabel`: replace hardcoded `gpt-oss-120b` label with a lookup; add an `'fp8'` branch returning "fp8 only — cloud serves fp8, local runs int4."
5. In `+page.svelte` line 1264: replace `modelId !== 'openai/gpt-oss-120b'` with `!modelTiers.find(t => t.modelId === modelId)?.cloudQuantization`.
6. In `+page.svelte` line 786: update the summary note to name all three band-bypass models.

## Verification

| Criterion | Evidence | Result |
|-----------|----------|--------|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |
| 6 | | |
| 7 | | |

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-14 | | Triggered by XL + Max tier addition; SPEC-013 bypass logic was not designed for multiple fixed-quantization models. |
| Needs Manual Test | 2026-04-14 | | Implemented inline on trunk. 3 files changed: tiers.ts (cloudQuantization field + data), worksheet3.svelte.ts (resolveQuantizations + precisionLabel), +page.svelte (hasBandMismatch + summary text). svelte-check 0 errors. |
