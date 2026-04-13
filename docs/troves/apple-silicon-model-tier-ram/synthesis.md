# Apple Silicon RAM requirements for W3 model tiers

## Summary

Maps each Worksheet 3 tier (Mini → Large) to **unified-memory footprint** on an Apple Silicon Mac running MLX 4-bit (or native MXFP4 for gpt-oss), with **5 concurrent users × 128K context per session** (the friend-group KVM scenario).

This second extension adds **cross-family alternatives** at each tier — so users who prefer not to run Qwen (output style, ZDR availability, workload fit) have named alternatives with equivalent RAM footprints.

Also documents a validity caveat: OpenRouter providers serve at varying quantizations; W3 needs to pin `provider.quantizations` to produce a fair comparison (SPEC-013).

Per operator decision, models above the Large tier (GLM-4.6 / GLM-5 / Llama 4 Maverick) are explicitly **ruled out** — they require Max-tier hardware that's hard to source (secondary market only) and would push the project's purchase recommendation outside most households' reach. 2-bit quantization is likewise off the table; 4-bit MLX is the maximum compression used in this mapping.

## Final mapping (5 concurrent users × 128K context each)

### Mini tier (~34 GB envelope, Entry 64 GB hardware)

| Model | Family | Weights (4-bit) | KV × 5 @ 128K | Peak RAM | Notes |
|-------|--------|-----------------|---------------|----------|-------|
| **qwen/qwen3.5-9b** *(primary)* | Alibaba | 6 GB | 22 GB | **~34 GB** | Hybrid attention (8 full-attn of 32) |
| openai/gpt-oss-20b | OpenAI | 12 GB | 16 GB | **~34 GB** | MXFP4 native. Hybrid sliding+full alternating. 3.6B active MoE. |
| google/gemma-4-e4b | Google | 5 GB | ~6 GB | **~17 GB** | PLE architecture. Sub-Mini really, but usable for ultra-light workloads. |

### Small tier (~40 GB envelope, Entry 64 GB hardware)

| Model | Family | Weights (4-bit) | KV × 5 @ 128K | Peak RAM | Notes |
|-------|--------|-----------------|---------------|----------|-------|
| **qwen/qwen3.5-35b-a3b** *(primary)* | Alibaba | 20 GB | 14 GB | **~40 GB** | Hybrid attention (10 full-attn of 40). 3B active MoE. |
| google/gemma-4-26b-a4b | Google | 16 GB | ~13 GB | **~35 GB** | MoE with 3.8B active. Hybrid sliding+full + shared KV cache. |
| google/gemma-4-31b-dense | Google | 17 GB | ~20 GB | **~43 GB** | Dense 31B. Sliding-window attention keeps KV modest. |

### Medium tier (~91 GB envelope, Mid 128 GB min / High 256 GB comfortable)

| Model | Family | Weights | KV × 5 @ 128K | Peak RAM | Notes |
|-------|--------|---------|---------------|----------|-------|
| **openai/gpt-oss-120b** *(primary)* | OpenAI | 61 GB | 24 GB | **~91 GB** | MXFP4 native (only format). 5B active MoE. Full attention. |
| meta/llama-4-scout | Meta | 60 GB (est.) | ~40 GB | **~106 GB** | 17B active × 16 experts MoE. Weights figure has a Instruct-variant discrepancy — verify. |

### Large tier (~96 GB envelope, Mid 128 GB min / High 256 GB comfortable)

| Model | Family | Weights (4-bit) | KV × 5 @ 128K | Peak RAM | Notes |
|-------|--------|-----------------|---------------|----------|-------|
| **qwen/qwen3.5-122b-a10b** *(primary)* | Alibaba | 70 GB | 20 GB | **~96 GB** | Hybrid attention. 10B active MoE. |

No cross-family Large alternative was identified under the 4-bit-max constraint. The gap exists because: (a) Llama 4 Maverick is Max-tier-only (~200 GB at 4-bit); (b) Mistral's 2026 hybrid MoE successors are too small to land here; (c) GLM-4.6 is ruled out per frontier-model exclusion. Large tier is effectively a Qwen-only slot in the current market.

### Anchor tier (cloud-only)

| Model | Family | Notes |
|-------|--------|-------|
| **anthropic/claude-opus-4-6** *(primary)* | Anthropic | Frontier baseline. No local RAM cost. |

## Cross-family value per tier

Why cross-family alternatives matter:

- **Output style:** Qwen models skew verbose and analytical; Llama skews terse and instruction-oriented; Gemma skews multilingual and careful. Workload fit varies.
- **ZDR availability:** A given OpenRouter provider may not offer ZDR endpoints for every model. Having a cross-family fallback per tier prevents "no ZDR provider" dead-ends.
- **Training-data diversity:** Qwen, Llama, Gemma, OpenAI, Mistral each pull from different mixes. Different failure modes, different strengths.

## KV cache math per model (128K context, full-attention layers only)

Formula: `KV_bytes/token = full_attn_layers × 2 × kv_heads × head_dim × 2 (bytes for fp16)`.

| Model | Full-attn layers | KV heads | Head dim | Bytes/token | Per-session @ 128K | 5 users |
|-------|------------------|----------|----------|-------------|--------------------|---------|
| qwen3.5-9b | 8 of 32 (hybrid) | 4 | 256 | 32,768 | 4.3 GB | 22 GB |
| qwen3.5-35b-a3b | 10 of 40 (hybrid) | 2 | 256 | 20,480 | 2.7 GB | 14 GB |
| gpt-oss-20b | 12 of 24 (hybrid) | 8 | 64 | 24,576 | 3.2 GB | 16 GB |
| gpt-oss-120b | all (full) | — | — | ~37,000 (official) | 4.8 GB | 24 GB |
| gemma-4-26b-a4b | hybrid + shared KV | — | — | ~20,000 (est.) | 2.6 GB | 13 GB |
| gemma-4-31b-dense | hybrid sliding | — | — | ~30,000 (est.) | 4 GB | 20 GB |
| qwen3.5-122b-a10b | hybrid (est.) | — | — | ~30,000 (est.) | 4 GB | 20 GB |
| llama-4-scout | assumed full | — | — | ~60,000 (est.) | 8 GB | 40 GB |

Architecture-confirmed numbers are marked "official" or with direct citations in the source files. Estimates are marked "(est.)" and carry the caveat that real numbers may differ by ±30%. The Large-tier Qwen estimate and the Llama 4 Scout estimate are the two I'd most like to validate empirically.

## Context length notes per provider

| Model | Native max context |
|-------|-------------------|
| qwen3.5-9b | 262K, extensible to 1M |
| qwen3.5-35b-a3b | 262K |
| qwen3.5-122b-a10b | 262K |
| gpt-oss-20b | 131K (128K) |
| gpt-oss-120b | 131K (128K) |
| gemma-4-26b-a4b | 256K |
| gemma-4-31b-dense | 256K |
| llama-4-scout | 10M (!) |
| claude-opus-4-6 | 200K (1M available) |

128K is the common denominator across all tiers — safe ceiling for an apples-to-apples W3 run. Going above 128K only helps for Qwen and Llama 4 Scout; gpt-oss caps hard at 131K.

## Hardware tier ladder

| Tier | Config | Upfront | Annual TCO | Sustained workload @ 5 users × 128K |
|------|--------|---------|-----------|-------------------------------------|
| Entry | Mac mini M4 Pro 64 GB | ~$2,400 | ~$984/yr | Mini, Small |
| Mid | Mac Studio M4 Max 128 GB | ~$4,500 | ~$1,680/yr | Medium, Large (tight) |
| High | Mac Studio M3 Ultra 256 GB | $7,899 | ~$2,808/yr | Medium, Large (comfortable) |
| Max | Mac Studio M3 Ultra 512 GB (secondary) | ~$14,000 | ~$4,848/yr | Not needed for Mini → Large |

## Worksheet 3 validity — OpenRouter quantization parity

OpenRouter routes across providers at varying quantizations (int4/int8/fp4/fp6/fp8/fp16/bf16/fp32). W3 must pin `provider.quantizations` or the comparison isn't fair — covered in SPEC-013. For non-native-quantization models (everything except gpt-oss, which is MXFP4 everywhere), set `['fp4', 'int4']` to match MLX 4-bit.

## Gaps / what's estimated

- **Qwen3.5-122B-A10B** KV-bytes-per-token — estimated from family patterns; not measured from config.json.
- **Llama 4 Scout** instruct-variant file size discrepancy (60 GB vs 200 GB community reports). Needs verification before committing to tier data.
- **Llama 4 Scout** KV architecture — assumed full-attention absent concrete attention-layout docs. If it uses hybrid attention like Gemma 4 / Qwen3.5, the real KV cost is lower.
- **Gemma 4** exact layer/head dims — the released blog posts describe the hybrid + shared-KV approach but don't publish the full config. Estimates are within a band supported by the Q4 file sizes.

## Derived data for `src/lib/data/tiers.ts`

Schema addition:

```ts
interface ModelTier {
  // existing fields
  minRamGB: number;                    // 5 users × 128K, incl OS
  minHardwareTier: 'entry' | 'mid' | 'high' | 'max' | 'cloud';
  comfortableHardwareTier: 'entry' | 'mid' | 'high' | 'max' | 'cloud';
  /** Cross-family alternatives at roughly the same RAM envelope. */
  alternatives?: Array<{ modelId: string; family: string; note: string }>;
}
```

Primary values:

| Tier | minRamGB | minHardwareTier | comfortableHardwareTier | Primary alternatives |
|------|----------|-----------------|------------------------|---------------------|
| Mini | 34 | entry | entry | gpt-oss-20b (OpenAI), gemma-4-e4b (Google) |
| Small | 40 | entry | entry | gemma-4-26b-a4b (Google), gemma-4-31b-dense (Google) |
| Medium | 91 | mid | high | llama-4-scout (Meta) |
| Large | 96 | mid | high | (no cross-family alternative under 4-bit-max constraint) |
| Anchor | 0 | cloud | cloud | — |
