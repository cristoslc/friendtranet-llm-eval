# Changelog

## [0.1.0] - 2026-04-14

### Features

#### Three-Worksheet Decision Flow

The SPA guides each group member through three worksheets before combining into a
group decision. Worksheet 1 (Risk Scorecard) quantifies expected annual loss from
ZDR+DPA provider failure modes using impact/probability sliders — no API key
needed. Worksheet 2 (Principle Scorecard) captures values-based willingness-to-pay
for sovereignty. Worksheet 3 (Capability Evaluation) runs blind multi-tier model
comparisons through OpenRouter and produces a minimum adequate tier score.

#### W3 Evaluation Engine

Worksheet 3 sends each selected conversation to every chosen model tier in
parallel. Responses appear with randomized labels (A, B, C, D) so ratings are
blind. Per-turn conversation switching (SPEC-006) lets the rater move between
conversations mid-session and pick up where they left off on reload. Custom
multi-turn conversations (SPEC-007) let the rater write their own opening prompt
and drive up to five follow-up turns before rating. On-demand next-turn generation
(SPEC-010) gives fine-grained control over when each turn fires. Responses render
with full Markdown including tables and code blocks.

#### W3 Precision and Context Controls (SPEC-013)

Every OpenRouter call now carries a `provider.quantizations` field matching the
active precision band. The default band ("Match local MLX 4-bit") sends
`['fp4', 'int4']` so cloud output is comparable to what the user would run locally
at MLX 4-bit. Two additional bands cover balanced (fp8) and frontier quality
(bf16/fp16) comparisons. A context selector caps `max_tokens` at Conservative 8K,
Long 32K, or Target 128K (default). A "Sending as" disclosure line above the Start
button confirms the active settings before spending tokens. Changing the precision
band after caching results triggers an invalidation modal; provider-unavailable
errors surface a fallback recovery modal.

#### W3 Hardware-Tier Legend (SPEC-014)

The "Model Tiers to Test" card now opens with a compact legend table showing each
tier's model ID, peak RAM at 5 users × 128K context, minimum hardware tier, and
comfortable hardware tier. A collapsible Methodology block below the table explains
the RAM math (4-bit MLX, KV cache formula, hybrid attention). The `ModelTier`
interface carries `peakRamGB`, `minHardwareTierId`, `comfortableHardwareTierId`,
and `alternatives` fields, keeping the data co-located with the tier definitions.

#### Model Tier Expansion

The evaluation set now spans seven tiers including two new hardware-gated tiers.
The XL tier (`z-ai/glm-4.6`, ~238 GB peak, requires High 256 GB hardware) and
Max tier (`meta/llama-4-maverick`, ~251 GB peak, requires Max 512 GB hardware)
both default to unchecked — opt-in only for users with the matching Apple Silicon
hardware. Both tiers carry an fp8/int4 precision caveat: OpenRouter serves them
at fp8 only while local MLX runs at int4. The conversational quality gap is modest
(~0.6 pp MMLU-Pro); the technical-domain gap is material (up to 8 pp HumanEval).

#### Data-Driven Quantization Bypass (SPEC-015)

A `cloudQuantization?: 'mxfp4' | 'fp8'` field on `ModelTier` generalizes the
logic that skips precision-band filtering for fixed-quantization models. Previously
only `gpt-oss-120b` (MXFP4-native) was hardcoded. The new field covers XL and Max
as well. All three are now recognized automatically — no future model with a fixed
cloud quantization requires a code change.

#### GitHub Pages Deployment (SPEC-005)

A GitHub Actions workflow builds and deploys the static SPA to GitHub Pages on
every push to trunk. The base path is set at build time so assets and links resolve
correctly under the repository subpath.

### Research

- **SPIKE-002** — hardware tier RAM verification: Qwen3.5-122B-A10B KV bytes
  confirmed from config.json at 24,576 bytes/token (prior estimate was 18% high);
  Llama 4 Scout Instruct file size confirmed at 61.1 GB (the 200 GB community
  figure was an upload error); Maverick fp8-only on all OpenRouter providers,
  226 GB at 4-bit MLX, conditionally accepted for Max tier.
- **SPIKE-001** — 13 curated conversations sourced from WildBench and MT-Bench
  (CC-BY-4.0), covering routine, moderate, and hard complexity tasks.
- **Hardware tier RAM trove** — 22 sources mapping each model tier to peak
  unified-memory footprint at 5 concurrent users × 128K context, 4-bit MLX.
  Covers Mini through Max tiers with cross-family alternatives per tier.

### Supporting Changes

- IndexedDB persistence with debounced writes; `$state.snapshot()` serialization.
- Firefox HMR WebSocket cascade fix that was causing memory balloon under dev.
- Per-tier model ID override UI for ZDR fallback when a default model lacks
  ZDR endpoints on the rater's OpenRouter account.
- Parallel evaluation worker visualization with per-tier progress rows.
- GH Pages base-path fix so assets resolve under the repository subpath.
- Truncation auto-retry with per-model `maxTokens` override for reasoning-capable
  models that consume tokens before emitting visible content.
