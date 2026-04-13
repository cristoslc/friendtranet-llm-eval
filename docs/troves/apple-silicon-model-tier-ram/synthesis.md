# Apple Silicon RAM requirements for W3 model tiers

## Summary

Maps each Worksheet 3 model tier to unified-memory footprint on an Apple Silicon Mac running MLX 4-bit (or MXFP4 native for gpt-oss-120b), with **3–5 concurrent users sharing one host** at **128K context per session** (the friend-group KVM scenario, longest practical context we expect to use).

Also documents a validity caveat for W3 as a cloud-vs-local comparison tool: OpenRouter providers serve at varying quantizations, so the current W3 request shape does not produce a fair comparison.

## Final mapping (5 concurrent users × 128K context each)

| Tier | Model ID | Format | Weights | KV × 5 @ 128K | OS overhead | **Peak RAM** | **Min hardware tier** | **Comfortable** |
|------|----------|--------|---------|---------------|-------------|--------------|----------------------|-----------------|
| Mini | `qwen/qwen3.5-9b` | MLX 4-bit | 6 GB | ~22 GB | ~6 GB | **~34 GB** | Entry 64 GB | Entry |
| Small | `qwen/qwen3.5-35b-a3b` | MLX 4-bit | 20 GB | ~14 GB | ~6 GB | **~40 GB** | Entry 64 GB | Entry |
| Medium | `openai/gpt-oss-120b` | MXFP4 native | 61 GB | ~24 GB | ~6 GB | **~91 GB** | Mid 128 GB | High 256 GB |
| Large | `qwen/qwen3.5-122b-a10b` | MLX 4-bit | 70 GB | ~20 GB | ~6 GB | **~96 GB** | Mid 128 GB | High 256 GB |
| Anchor | `anthropic/claude-opus-4-6` | cloud | 0 | 0 | 0 | **0 local** | cloud | cloud |

**Key architectural insight:** The Qwen3.5 family (Mini, Small, Large) uses hybrid attention — only 8–10 full-attention layers out of 32–40. The remaining layers use linear attention (Gated DeltaNet) which has negligible KV cache state. This makes 128K context dramatically cheaper than it would be on a full-attention model.

gpt-oss-120b (Medium) uses standard full attention across all layers and has a proportionally larger KV cache at long contexts. It's the one model in this ladder where the context length meaningfully shifts hardware requirements.

## KV cache math per model

Formula: `KV_bytes/token = num_attention_layers × 2 × num_kv_heads × head_dim × 2 (bytes for fp16)`

| Model | Attn layers | KV heads | Head dim | **Bytes/token** | 128K session | 5-user @ 128K |
|-------|-------------|----------|----------|-----------------|--------------|---------------|
| Mini (qwen3.5-9b) | 8 of 32 (hybrid) | 4 | 256 | 32,768 | 4.3 GB | 21.5 GB |
| Small (qwen3.5-35b-a3b) | 10 of 40 (hybrid) | 2 | 256 | 20,480 | 2.7 GB | 13.5 GB |
| Medium (gpt-oss-120b) | all (full) | varies | — | ~37,000 (from official) | 4.8 GB | 24 GB |
| Large (qwen3.5-122b-a10b) | similar hybrid to 35B | — | — | ~30,000 (est.) | ~4 GB | ~20 GB |

Large is estimated — the config wasn't fully visible in the sources gathered. Based on the family pattern (hybrid attention with similar linear/full ratio) and the weight-size-to-activation-overhead ratio of the 6.5-bit variant, 30 KB/token is a reasonable estimate. Worth empirical validation before freezing the DESIGN-004 frontmatter.

## Context length notes per provider

Native max context per model (for matched-precision W3 requests):

| Model | Native max |
|-------|-----------|
| qwen3.5-9b | 262,144 tokens (256K), extensible to 1M |
| qwen3.5-35b-a3b | 262,144 tokens |
| gpt-oss-120b | 131,072 tokens (128K) |
| qwen3.5-122b-a10b | 262,144 tokens |
| claude-opus-4-6 | 200,000 tokens (1M context mode available) |

128K is the common denominator across all tiers — the natural ceiling for an apples-to-apples W3 comparison. gpt-oss-120b cannot go higher without silent truncation. Setting W3's request `max_tokens` / context-length parameter to 128K for all tiers is the recommended matching strategy.

## How the numbers were built

### Mini — qwen3.5-9b

- `mlx-community-qwen35-9b-4bit` reports 5.6 GB disk weights at MLX 4-bit.
- `qwen35-9b-hf-architecture` confirms hybrid layout with 8 full-attention layers, yielding 32,768 bytes/token.
- 128K × 5 users = 22 GB KV cache on top of 6 GB weights.
- Fits Entry (64 GB) with ~30 GB of headroom for macOS, long contexts up to native 256K, and a 6th concurrent user.

### Small — qwen3.5-35b-a3b (35B total / 3B active MoE)

- `antekapetanovic-qwen35-35b-benchmark` measures 20 GB peak for single-user 4-bit MLX.
- `kaitchup-kv-cache-small-moes` confirms 10 full-attention layers / 2 KV heads / 256 head_dim → 20,480 bytes/token.
- 128K × 5 users = 14 GB KV cache.
- Still fits Entry (64 GB) comfortably with ~24 GB headroom. The 3B-active MoE design gives strong throughput.

### Medium — openai/gpt-oss-120b (117B / 5B active, MXFP4 native)

- `llama-cpp-gpt-oss-guide` gives exact figures: 61 GB weights + 2.7 GB compute + 0.3 GB per 8K KV.
- Full attention throughout, so 128K context ≈ 16× the 8K number = 4.8 GB per session.
- 5 users × 4.8 GB = 24 GB KV cache.
- Total ~91 GB. Mid tier (128 GB) fits with ~37 GB headroom — enough for macOS but tight if other apps are memory-hungry.
- High tier (256 GB) is the comfortable recommendation, corroborated by `lmstudio-blog-gpt-oss`.

### Large — qwen3.5-122b-a10b (122B total / 10B active, hybrid MoE)

- `huggingface-qwen35-122b-base` + `inferencerlabs-qwen35-122b-65bit` triangulate ~70 GB at standard MLX 4-bit.
- Architecture is hybrid (per `kaitchup-kv-cache-small-moes` family patterns and Qwen3.5 family consistency), yielding estimated 30,000 bytes/token.
- 128K × 5 users ≈ 20 GB KV cache.
- Total ~96 GB. Mid tier (128 GB) fits, High tier (256 GB) is comfortable.

### Anchor — anthropic/claude-opus-4-6

- Cloud only. No local RAM cost. Frontier-quality baseline for blind rating.

## Hardware tier ladder (from `src/lib/data/tiers.ts`)

| Tier | Config | Upfront | Annual TCO | Sustained workload cap (5 users × 128K) |
|------|--------|---------|-----------|------------------------------------------|
| Entry | Mac mini M4 Pro 64 GB | ~$2,400 | ~$984/yr | Mini, Small |
| Mid | Mac Studio M4 Max 128 GB | ~$4,500 | ~$1,680/yr | Medium (tight), Large (tight) |
| High | Mac Studio M3 Ultra 256 GB | $7,899 | ~$2,808/yr | Medium, Large (comfortable) |
| Max | Mac Studio M3 Ultra 512 GB | ~$14,000 | ~$4,848/yr | Headroom for future Qwen3.5-397B / larger MoEs |

## Worksheet 3 validity caveat — OpenRouter quantization parity

**The issue:** OpenRouter routes API calls across 18+ providers per model, each serving at its own quantization. Supported bands: `int4`, `int8`, `fp4`, `fp6`, `fp8`, `fp16`, `bf16`, `fp32`, `unknown`. Without an explicit `provider.quantizations` parameter, OpenRouter picks whichever provider it wants per call — possibly different precisions across turns of the same conversation.

**Why this invalidates the current W3 comparison:**

- A rater might see bf16-precision output from the cloud and assume their Mac would produce similar quality at MLX 4-bit. It won't — bf16 beats 4-bit on subtle reasoning, numeric accuracy, and multilingual fidelity.
- Conversely, a rater might see output from an aggressive int4 provider that corrupts multi-byte characters (documented: QwenCode PR #348 explicitly avoids these) and conclude a model is bad when local MLX 4-bit would actually render it fine.
- Either way the "personal minimum adequate tier" number is compromised.

**Exception:** `gpt-oss-120b` is natively MXFP4 — every provider (local and cloud) serves at that precision. The Medium tier is the only default-fair comparison in the current W3 stack.

**Fix:** pin `provider.quantizations` to `['fp4', 'int4']` (closest match to MLX 4-bit) in the W3 OpenRouter request, AND pin `max_tokens` + context length to 128K across all tiers. This is the subject of SPEC-013 (filed alongside this trove).

## Derived data for `src/lib/data/tiers.ts`

Add per-tier fields:

```ts
interface ModelTier {
  // … existing fields …
  /** Min peak RAM in GB with 5 users × 128K context. Includes macOS overhead. */
  minRamGB: number;
  /** Target hardware tier ID (from hardwareTiers[]). */
  minHardwareTier: 'entry' | 'mid' | 'high' | 'max' | 'cloud';
  /** Hardware tier ID that runs this model comfortably (headroom for growth). */
  comfortableHardwareTier: 'entry' | 'mid' | 'high' | 'max' | 'cloud';
}
```

Values:

| Tier | minRamGB | minHardwareTier | comfortableHardwareTier |
|------|----------|-----------------|------------------------|
| Mini | 34 | entry | entry |
| Small | 40 | entry | entry |
| Medium | 91 | mid | high |
| Large | 96 | mid | high |
| Anchor | 0 | cloud | cloud |

## Gaps

- No direct multi-user benchmark on a Mac Studio 128 GB running gpt-oss-120b with 5 × 128K sessions. Numbers are additive math from single-user measurements.
- Qwen3.5-122B-A10B KV-bytes-per-token is estimated from family patterns, not measured from the config.json. Should be refined once someone reads the published configuration.
- Real-world macOS headroom varies — 6 GB is a rough baseline assuming minimal background apps. Heavy desktop use (browsers with many tabs, dev tools running) can easily push system overhead to 15–20 GB.
