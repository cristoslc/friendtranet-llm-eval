---
title: "W3 Hardware-Tier Legend"
artifact: SPEC-014
track: implementable
status: Needs Manual Test
author: Cristos
created: 2026-04-14
last-updated: 2026-04-14
type: enhancement
parent-epic: EPIC-001
linked-artifacts:
  - SPEC-003
  - SPEC-013
depends-on-artifacts:
  - SPEC-003
trove: apple-silicon-model-tier-ram@d681e07
swain-do: required
---

# SPEC-014: W3 Hardware-Tier Legend

## Problem

The W3 capability evaluation page lists five model tiers (Mini, Small, Medium, Large, Anchor). There is no legend explaining which tiers can run locally and what hardware they require. A user cannot tell whether "Mini" needs a Mac mini or a Mac Studio without digging through external docs.

## Solution

Extend the `ModelTier` data type with RAM and hardware-tier fields. Render a compact legend table in the "Model Tiers to Test" card, above the tier checkboxes. Add a collapsible methodology block below the table.

Also add a `MODEL_NATIVE_MAX_CONTEXT` map to `tiers.ts`. SPEC-013 requires it for `max_tokens` capping.

## Data

### RAM envelope — 5 users × 128K context, 4-bit MLX

Source: trove `apple-silicon-model-tier-ram@d681e07`.

| Tier | Primary model | Peak RAM | Min hardware | Comfortable hardware |
|------|--------------|----------|-------------|---------------------|
| Mini | qwen/qwen3.5-9b | 34 GB | Entry (64 GB) | Entry (64 GB) |
| Small | qwen/qwen3.5-35b-a3b | 40 GB | Entry (64 GB) | Entry (64 GB) |
| Medium | openai/gpt-oss-120b | 91 GB | Mid (128 GB) | High (256 GB) |
| Large | qwen/qwen3.5-122b-a10b | 96 GB | Mid (128 GB) | High (256 GB) |
| Anchor | anthropic/claude-opus-4-6 | 0 GB | Cloud only | Cloud only |

### Cross-family alternatives

| Tier | Alternative model | Peak RAM | Note |
|------|-----------------|----------|------|
| Mini | openai/gpt-oss-20b | 34 GB | MXFP4 native; 3.6B active MoE; hybrid attention. |
| Mini | google/gemma-4-e4b | 17 GB | PLE architecture; sub-Mini footprint. |
| Small | google/gemma-4-26b-a4b | 35 GB | 3.8B active MoE; hybrid + shared KV cache. |
| Small | google/gemma-4-31b-dense | 43 GB | Dense 31B; sliding-window attention. |
| Medium | meta/llama-4-scout | 106 GB | 17B active × 16 experts MoE; weight size unverified. |
| Large | — | — | No cross-family alternative under 4-bit-max constraint. |
| Anchor | — | — | Cloud only. |

### Native max context per model

| Model ID | Native max context (tokens) |
|---------|----------------------------|
| qwen/qwen3.5-9b | 32,768 |
| qwen/qwen3.5-35b-a3b | 32,768 |
| openai/gpt-oss-120b | 128,000 |
| qwen/qwen3.5-122b-a10b | 131,072 |
| anthropic/claude-opus-4-6 | 200,000 |

## Changes

### `src/lib/data/tiers.ts`

1. Extend `ModelTier` with four new fields:

   ```ts
   peakRamGB: number;
   minHardwareTierId: string;
   comfortableHardwareTierId: string | null;
   alternatives: Array<{ modelId: string; peakRamGB: number; note: string }>;
   ```

2. Populate those fields in the `modelTiers` array using the data table above.

3. Export a new `MODEL_NATIVE_MAX_CONTEXT` map:

   ```ts
   export const MODEL_NATIVE_MAX_CONTEXT: Record<string, number> = {
     'qwen/qwen3.5-9b': 32768,
     'qwen/qwen3.5-35b-a3b': 32768,
     'openai/gpt-oss-120b': 128000,
     'qwen/qwen3.5-122b-a10b': 131072,
     'anthropic/claude-opus-4-6': 200000,
   };
   ```

### `src/routes/worksheet3/+page.svelte`

Inside the "Model Tiers to Test" card, before the `{#each modelTiers}` block, add:

1. A legend table with columns: **Tier | Model | Peak RAM | Min hw | Comfortable hw | Cloud-only?**
   - Resolve hardware tier labels from `hardwareTiers` by ID.
   - Show "Cloud only" in the Min hw and Comfortable hw cells for the Anchor tier.
2. A `<details><summary>Methodology</summary>…</details>` block collapsed by default. The block explains: 5 concurrent users, 128K context per user, 4-bit MLX quantization, KV cache math.

Import `hardwareTiers` in the script block if not already imported.

## Acceptance criteria

1. The `ModelTier` interface has all four new fields: `peakRamGB`, `minHardwareTierId`, `comfortableHardwareTierId`, `alternatives`.
2. All non-anchor model tiers have correct `peakRamGB`, `minHardwareTierId`, and `comfortableHardwareTierId` values per the data table above.
3. The Anchor tier has `peakRamGB: 0` and `comfortableHardwareTierId: null`.
4. The legend table renders in the "Model Tiers to Test" card, above the tier checkboxes.
5. The table shows correct min and comfortable hardware labels (e.g., "Entry", "High"), resolved from `hardwareTiers`.
6. The methodology `<details>` block is collapsed by default and expands on click.
7. `MODEL_NATIVE_MAX_CONTEXT` exists in `tiers.ts` and has entries for all five current model IDs.
8. `npx svelte-check` passes with no errors.
9. `npm run build` succeeds with no errors.

## Out of scope

- Displaying alternatives in the UI (data is added to the type; UI display is deferred).
- Any changes to evaluation logic or scoring.
- Changes to other worksheets.

## Lifecycle

| Date | Event |
|------|-------|
| 2026-04-14 | Created. |
| 2026-04-14 | Implemented in worktree spec-014-legend; merged to trunk. Status → Needs Manual Test. |
