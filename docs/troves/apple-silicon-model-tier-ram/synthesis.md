# Apple Silicon RAM requirements for W3 model tiers

## Summary

Maps each Worksheet 3 tier (Mini → Large) to **unified-memory footprint** on an Apple Silicon Mac running MLX 4-bit (or native MXFP4 for gpt-oss), with **5 concurrent users × 128K context per session** (the friend-group KVM scenario).

This second extension adds **cross-family alternatives** at each tier — so users who prefer not to run Qwen (output style, ZDR availability, workload fit) have named alternatives with equivalent RAM footprints.

Also documents a validity caveat: OpenRouter providers serve at varying quantizations; W3 needs to pin `provider.quantizations` to produce a fair comparison (SPEC-013).

Llama 4 Maverick is conditionally accepted as a new Max tier (SPIKE-002). GLM-4.6 is also reinstated as a new XL tier (High 256 GB hardware, ~230–245 GB peak RAM); it carries the same fp8/int4 caveat as Maverick. 2-bit quantization is off the table; 4-bit MLX is the maximum compression used in this mapping.

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
| meta/llama-4-scout | Meta | **61.1 GB** | ~40 GB | **~106 GB** | 17B active × 16 experts MoE. 200 GB community figure was an upload error (resolved, repo deleted by maintainer). |

### Large tier (~96 GB envelope, Mid 128 GB min / High 256 GB comfortable)

| Model | Family | Weights (4-bit) | KV × 5 @ 128K | Peak RAM | Notes |
|-------|--------|-----------------|---------------|----------|-------|
| **qwen/qwen3.5-122b-a10b** *(primary)* | Alibaba | 70 GB | 20 GB | **~96 GB** | Hybrid attention. 10B active MoE. |

No cross-family Large alternative was identified under the 4-bit-max constraint. GLM-4.6 (~230–245 GB at 4-bit MLX) and Maverick (226 GB) both exceed the Large-tier envelope and are assigned to their own tiers (XL and Max respectively). Large tier is a Qwen-only slot.

### Max tier (~251 GB estimated peak RAM, 512 GB hardware required)

| Model | Family | Weights (4-bit) | KV × 5 @ 128K | Peak RAM | Notes |
|-------|--------|-----------------|---------------|----------|-------|
| **meta/llama-4-maverick** *(conditional)* | Meta | **226 GB** (confirmed) | ~25 GB (est.) | **~251 GB** (est.) | fp8 cloud / int4 local mismatch. Accept conditionally — document delta. Requires Mac Studio M3 Ultra 512 GB (~$14K). KV architecture not yet verified from config.json. |

All cloud providers (DeepInfra, Fireworks AI, Together AI, GCP Vertex AI, NVIDIA NIM) serve Maverick at **fp8 only**. Local MLX runs use int4. The quality gap is modest for conversation (~0.6 pp on MMLU-Pro) but material for technical tasks (up to 8 pp on HumanEval). The Max tier must carry a precision-parity caveat in W3.

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
| qwen3.5-122b-a10b | 12 of 48 (hybrid) | 2 | 256 | **24,576** | 3.2 GB | **~16 GB** |
| llama-4-scout | assumed full | — | — | ~60,000 (est.) | 8 GB | 40 GB |

Architecture-confirmed numbers are marked "official" or with direct citations in the source files. Estimates are marked "(est.)" and carry the caveat that real numbers may differ by ±30%. The Llama 4 Scout KV estimate is the primary remaining uncertainty; the Large-tier Qwen number is now confirmed from config.json.

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
| High | Mac Studio M3 Ultra 256 GB | $7,899 | ~$2,808/yr | Medium, Large (comfortable); GLM-4.6 XL tier (conditional, fp8/int4 caveat; ~230–245 GB peak, tight fit) |
| Max | Mac Studio M3 Ultra 512 GB (secondary) | ~$14,000 | ~$4,848/yr | Llama 4 Maverick (conditional, fp8/int4 caveat; ~251 GB peak) |

## Worksheet 3 validity — OpenRouter quantization parity

OpenRouter routes requests across providers at varying quantizations. W3 must pin `provider.quantizations` to make the comparison fair — covered in SPEC-013. Set `['fp4', 'int4']` for all models except gpt-oss (MXFP4 everywhere). For the XL tier (GLM-4.6) and Max tier (Maverick), fp8 is the only cloud option; document the delta rather than filtering it out.

## Gaps / what's estimated

- ~~**Qwen3.5-122B-A10B** KV-bytes-per-token~~ — **Closed (SPIKE-002).** Real value: 24,576 bytes/token (12 full-attn of 48, 2 kv_heads, 256 head_dim).
- ~~**Llama 4 Scout** instruct-variant file size discrepancy~~ — **Closed (SPIKE-002).** 200 GB was an upload error. Correct size: 61.1 GB.
- **Llama 4 Scout** KV architecture — assumed full-attention; no published layer layout. If hybrid, the real KV cost is lower than the 40 GB / 106 GB estimates.
- **Llama 4 Maverick** KV architecture — config.json not yet verified. Peak RAM (~251 GB) is estimated; hybrid attention could reduce it.
- **Gemma 4** exact layer/head dims — blog posts describe hybrid + shared-KV but don't publish the full config. Estimates align with Q4 file sizes.

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
| Large | **92** | mid | high | (no cross-family alternative under 4-bit-max constraint) |
| Max | **~251** | max | max | llama-4-maverick (Meta, conditional — fp8/int4 caveat) |
| Anchor | 0 | cloud | cloud | — |
