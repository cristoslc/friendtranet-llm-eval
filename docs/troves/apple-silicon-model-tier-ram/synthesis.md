# Apple Silicon RAM requirements for W3 model tiers

## Summary

This trove maps each Worksheet 3 model tier to the unified-memory footprint required on an Apple Silicon Mac at MLX 4-bit (or the model's native low-bit format), accounting for **3–5 concurrent users sharing one host** (the friend-group KVM scenario). It also flags a validity caveat for Worksheet 3 as a local-vs-cloud comparison tool.

## Final mapping (3–5 concurrent users, 8K context each)

| Model tier | Model ID | Format | Weights | KV × 5 users | Compute + OS overhead | **Peak RAM** | **Min hardware tier** | **Comfortable** |
|------------|----------|--------|---------|--------------|----------------------|--------------|----------------------|-----------------|
| Mini | `qwen/qwen3.5-9b` | MLX 4-bit | 5.6 GB | ~2.5 GB | ~4 GB | **~12 GB** | Entry 64 GB | Entry |
| Small | `qwen/qwen3.5-35b-a3b` | MLX 4-bit | 20 GB | ~3 GB | ~6 GB | **~29 GB** | Entry 64 GB | Entry |
| Medium | `openai/gpt-oss-120b` | MXFP4 native | 61 GB | ~1.5 GB | ~6 GB + OS | **~70 GB** | Mid 128 GB | **High 256 GB** |
| Large | `qwen/qwen3.5-122b-a10b` | MLX 4-bit | 70 GB | ~2.5 GB | ~6 GB + OS | **~80 GB** | Mid 128 GB | High 256 GB |
| Anchor | `anthropic/claude-opus-4-6` | cloud | 0 | 0 | 0 | **0 local** | n/a (cloud API) | n/a |

KV cache per 8K token context on these architectures is 0.3–0.6 GB per session; with 3–5 concurrent sessions the multi-user overhead is 1.5–3 GB per model. At 32K context the KV overhead grows 4× and may push Medium/Large up one hardware tier for comfort.

## How the numbers were built

### Mini — `qwen/qwen3.5-9b`

- `mlx-community-qwen35-9b-4bit` reports 5.6 GB disk weights at MLX 4-bit, group size 64.
- Community rule-of-thumb (confirmed across multiple benchmarks in this trove): peak RAM for a 9B dense model at 4-bit is 1.5–1.8× the weight size for a single-user 8K session.
- With 5 concurrent 8K-context users, add ~2.5 GB KV cache + ~4 GB for macOS and the inference stack.
- Fits comfortably on any supported Mac. The project floor is Entry (64 GB), which is vast overkill for this tier.

### Small — `qwen/qwen3.5-35b-a3b` (35B total / 3B active MoE)

- `antekapetanovic-qwen35-35b-benchmark` measures ~20 GB peak RAM at 4-bit MLX (single user, small context).
- The 3B-active MoE design keeps activation footprint minimal; the 35B total still lives fully in RAM, but compute/KV per token is small.
- Multi-user KV overhead at 8K × 5 ≈ 3 GB. Total comfortable footprint ~29 GB.
- A 32 GB Mac runs this cleanly alongside macOS. The project floor (Entry 64 GB) is extremely comfortable.

### Medium — `openai/gpt-oss-120b` (117B / 5B active MoE)

- gpt-oss is natively distributed in MXFP4 — not quantized further. `llama-cpp-gpt-oss-guide` gives an exact breakdown: 61 GB weights + 2.7 GB compute buffers + 0.3 GB per 8K KV.
- Single-user minimum-to-load is 64 GB, exactly at the Entry tier ceiling with zero OS headroom — the llama.cpp maintainer guide calls this "not possible" in practice.
- With 3–5 concurrent users the weights are shared but each needs its own KV cache. 5 × 0.3 GB = 1.5 GB added.
- Total peak ~70 GB of model state. Add macOS (~6 GB), the inference daemon, and whatever other desktop apps, and the number lands at 80–96 GB of practical working set. `lmstudio-blog-gpt-oss` and `llama-cpp-gpt-oss-guide` both converge on 96 GB+ as the comfortable floor.
- On a **128 GB Mid tier** this runs under noticeable memory pressure when other apps are open or any user extends context beyond 8K. On a **256 GB High tier** it runs with generous headroom. The project's minimum-to-run is Mid, but the comfortable recommendation is High.

### Large — `qwen/qwen3.5-122b-a10b` (122B total / 10B active MoE, Feb 2026)

- Standard MLX 4-bit weights ≈ 70 GB (derived from `huggingface-qwen35-122b-base` reporting 69.6 GB and confirmed against the 6.5-bit variant's 99.2 GB in `inferencerlabs-qwen35-122b-65bit`).
- Peak single-user memory at 8K context lands around 72–78 GB.
- 5 concurrent users at 8K: + ~2.5 GB. Total ~80 GB working set.
- The 3.7-bit mixed-precision variant (`moringlabs-qwen35-122b-37bit`) squeezes into 55.1 GB peak on a 64 GB Mac but at measurable quality cost — not the reference path for W3.
- Mid tier (128 GB) fits the standard 4-bit path with ~45 GB headroom, enough to remain responsive. High tier (256 GB) has room for larger contexts, background apps, and future model upgrades.

### Anchor — `anthropic/claude-opus-4-6`

- Cloud-only; no local RAM cost. Serves as the frontier-quality baseline in the blind rating.

## Hardware tier ladder (from `src/lib/data/tiers.ts`)

| Tier | Config | Upfront | Annual TCO | Ceiling (spec v9) |
|------|--------|---------|-----------|-------------------|
| Entry | Mac mini M4 Pro 64 GB | ~$2,400 | ~$984/yr | Qwen3-Next-80B-A3B (tight) |
| Mid | Mac Studio M4 Max 128 GB | ~$4,500 | ~$1,680/yr | GPT-OSS-120B comfortable (single user) |
| High | Mac Studio M3 Ultra 256 GB | $7,899 | ~$2,808/yr | Qwen3-235B-A22B comfortable |
| Max | Mac Studio M3 Ultra 512 GB (secondary) | ~$14,000 | ~$4,848/yr | 397B-class / GLM-5.1 / MiniMax M2.7 |

**Adjustment for multi-user scenario:** the "Mid fits Medium comfortably" claim from spec v9 assumed single-user workload. At 3–5 concurrent users, the comfortable line for the Medium tier shifts to **High**. The Large tier stays at Mid for "fits" but also wants High for comfort.

## OpenRouter comparison validity — Worksheet 3 caveat

The Worksheet 3 evaluation has a structural validity issue that the operator should be aware of.

### The issue

OpenRouter routes each API call to one of multiple inference providers. Each provider serves the model at its own chosen quantization — options include `fp4`, `int4`, `int8`, `fp6`, `fp8`, `fp16`, `bf16`, `fp32`, and `unknown`. Without a `provider.quantizations` parameter in the request, OpenRouter's default router may pick any of them. For a rater testing whether a 122B model is "good enough for their workload," the actual precision served can vary per call.

### Why this breaks the comparison

Worksheet 3's pitch is: test the candidate open-weight models via OpenRouter to decide whether local hardware is worth buying. But locally the user would run MLX 4-bit — roughly equivalent to `int4` or `fp4` depending on method. If OpenRouter happens to serve the same model at `bf16`, the rater is comparing **cloud-precision output** to what they think is **local capability** — and the cloud will consistently win on subtle reasoning, numeric accuracy, and multilingual fidelity. The resulting "local tier is adequate" conclusion is systematically too optimistic.

Conversely, if OpenRouter picks `fp4` or aggressive `int4` providers (known to corrupt multi-byte characters per the QwenCode PR #348), the rater may underrate a model that would run fine at MLX 4-bit on a properly tuned Mac.

### Mitigation

The W3 client should either:

1. **Force a matched-precision provider** by including `provider: { quantizations: ['fp4'] }` or `['int4']` in the OpenRouter request — closest to MLX 4-bit. This produces a fair local-vs-cloud comparison.
2. **Or request `bf16`/`fp16`** and disclose in the UI that "these ratings reflect cloud-quality output; local hardware at MLX 4-bit will be measurably worse on hard tasks."
3. **Or pin a specific provider** known to serve at the desired precision. OpenRouter exposes the provider list; the model page for gpt-oss-120b shows 18 providers.

For gpt-oss-120b specifically the comparison is cleaner — MXFP4 is the model's native format and is used both locally and in the cloud.

### Recommended project action

Add a `provider.quantizations` field to the W3 API request shape, defaulted to `['fp4', 'int4']` (matched to local MLX) with a user-facing disclosure that says: "Testing against matched low-bit cloud providers. Switch to `bf16`/`fp16` if you want to see frontier-quality baseline output (knowing your local hardware won't match it)." This is a new SPEC — file it separately.

## Points of agreement across sources

- All sources agree on the order of magnitude: 9B at 4-bit ≈ 5–6 GB, 35B-A3B at 4-bit ≈ 20 GB, 120B at 4-bit ≈ 60–70 GB, 122B-A10B at 4-bit ≈ 70 GB.
- Apple Silicon unified memory eliminates the traditional VRAM-vs-system-RAM split, so disk-weight × 1.2–1.5 is a good first approximation of peak RAM.
- Mac Studio bandwidth matters more than raw RAM for large-model throughput. M3 Ultra (256/512 GB configs) sustains token rates that M4 Max (128 GB) cannot.

## Points of disagreement

- **Where does gpt-oss-120b become "comfortable"?** `llama-cpp-gpt-oss-guide` and `lmstudio-blog-gpt-oss` both say 96 GB+. The project spec v9 says 128 GB "comfortable" — but that predates the multi-user consideration. At 3–5 users the real comfortable floor is 256 GB (High tier).
- **Does Qwen3.5-122B fit on Entry (64 GB)?** At standard 4-bit MLX, no. At 3.7-bit mixed (Moring Labs variant), yes — but only for single-user short-context workloads and at a quality cost. This is not the recommended default path.

## Gaps

- No direct measurement of 3–5 concurrent users on a real M4 Max 128 GB running gpt-oss-120b — the multi-user estimate is additive math from single-user benchmarks. Worth validating empirically before committing the tier guidance to frontmatter of DESIGN-004.
- OpenRouter does not publicly disclose which providers serve which quantization for every model. A snapshot of provider × quantization pairs for each W3 model is worth capturing separately — this would make the W3 validity remediation step actionable.

## Derived data for `src/lib/data/tiers.ts`

For each `ModelTier`, add:

```ts
// Numbers include 5-user multi-session KV cache allowance at 8K context.
minRamGB: number;          // minimum peak RAM to load + run
comfortableRamGB: number;  // relaxed workload, multi-user
minHardwareTier: 'entry' | 'mid' | 'high' | 'max' | 'cloud';
```

Values:

| Model tier | minRamGB | comfortableRamGB | minHardwareTier |
|------------|----------|------------------|-----------------|
| Mini | 12 | 16 | entry |
| Small | 29 | 48 | entry |
| Medium | 80 | 160 | mid (comfortable: high) |
| Large | 88 | 176 | mid (comfortable: high) |
| Anchor | 0 | 0 | cloud |

The `comfortableRamGB` line is roughly 2× the minRAM — a rule of thumb that leaves room for longer contexts (up to 32K), additional concurrent users beyond 5, and reasonable macOS workload.
