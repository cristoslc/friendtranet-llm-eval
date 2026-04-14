---
id: SPIKE-002
title: Llama 4 Maverick/Scout Precision Parity and Qwen3.5-122B KV Verification
type: spike
phase: ready
parent-epic: EPIC-001
linked-artifacts: []
created: 2026-04-14
last-updated: 2026-04-14
timebox: 2 hours
trove: apple-silicon-model-tier-ram@d681e07
---

# Llama 4 Maverick/Scout Precision Parity and Qwen3.5-122B KV Verification

## Questions

Three unresolved hardware-tier questions from the session on 2026-04-13:

1. **Maverick precision parity** — OpenRouter serves Llama 4 Maverick at fp8. The local comparison is at MLX 4-bit (int4). Is that mismatch acceptable for a Max-tier slot? Same rejection logic applies that ruled out GLM-4.6.
2. **Scout file-size discrepancy** — Community reports give ~60 GB (base) or ~200 GB (instruct) for Llama 4 Scout at 4-bit MLX. Which number is correct for the Medium-tier slot?
3. **Qwen3.5-122B-A10B KV bytes/token** — The current estimate of ~30,000 bytes/token is drawn from family patterns, not from the real config.json. What is the exact number?

## Findings

### Q1: Llama 4 Maverick precision parity

**OpenRouter quantization:** All documented providers (DeepInfra, Fireworks AI, Together AI, GCP Vertex AI, NVIDIA NIM) serve Llama 4 Maverick at **fp8 only**. No provider offers int4 or bf16 at retail. This is consistent with Meta's official release, which ships bf16 weights and an fp8 derivative — no int4 official build exists from Meta.

**MLX 4-bit build:** The mlx-community organization has published `Llama-4-Maverick-17B-128E-Instruct-4bit` on Hugging Face. The model is **226 GB** on disk. This is the community-converted int4 build. It is available for local use on Apple Silicon.

**fp8 vs int4 quality gap:** Research benchmarks show fp8 scores ~0.6 percentage points higher than int4 on MMLU-Pro (69.64% vs 68.66%). The gap widens on code generation tasks (39.02% vs 31.10% on HumanEval, an 8-point drop). For conversational use, the gap is modest (~0.6 pp). For technical domains, it is material.

**Decision framework — same logic as GLM-4.6:**

GLM-4.6 was rejected because OpenRouter only serves it at fp8, while local runs would be at MLX 4-bit, making the cloud-vs-local comparison invalid. Maverick has the same structure: OpenRouter = fp8, local = int4 MLX.

The difference is context. GLM-4.6 was rejected as a *replacement for an existing tier model*, where precision parity is a design requirement. Maverick was considered for a *new Max tier* that does not currently exist. If the Max tier opens, the comparison would be fp8 (cloud) vs int4 MLX (local). That is a real mismatch but not larger than any other fp8/int4 gap.

**Recommendation:** Accept Maverick for the Max tier on a conditional basis — the tier note must document the fp8/int4 delta and flag conversational quality as "likely comparable, technically degraded." Do not accept Maverick as a like-for-like substitute for any existing tier. The Max tier is hardware-gated by the 226 GB local footprint, which requires a Mac Studio M3 Ultra 512 GB (~$14K secondary market).

**Maverick RAM estimate (Max tier, 5 users × 128K context):**

Maverick uses 128 experts, 17B active parameters. No published hybrid-attention layout is available in the mlx-community card. Assuming full attention (conservative):

- Weights: 226 GB (confirmed, 4-bit MLX)
- KV cost: unknown architecture — estimate based on Llama 4 family patterns (~64 kv_heads × 128 head_dim or similar). Community reports suggest ~251 GB total at 4-bit with KV included. Not yet verified from config.json.
- Peak RAM: **~251 GB estimated** (unverified). Fits within 512 GB; does not fit in 256 GB.

This confirms the Max tier requires 512 GB hardware, and the High tier (256 GB) cannot run Maverick.

### Q2: Llama 4 Scout file-size discrepancy

**Resolved.** The 200 GB figure was an upload error. The mlx-community maintainer (awni) confirmed this and deleted the erroneous repository. The correct repository is `mlx-community/Llama-4-Scout-17B-16E-Instruct-4bit`.

**Actual file size:** The instruct variant is **61.1 GB** at 4-bit MLX (12 safetensors shards totalling ~61 GB, consistent with the base model size). This matches the base model because instruction tuning changes only the RLHF/SFT fine-tune layer alignment, not the full weight count.

**OpenRouter quantization for Scout:** OpenRouter's 7 providers (DeepInfra, Fireworks AI, Together AI, GCP Vertex AI, NVIDIA NIM, GroqCloud) do not publicly advertise a specific quantization format for Scout. NVIDIA's official release includes fp8 (Hopper/Blackwell) and NVFP4 (Blackwell) variants. Community evidence suggests Scout is served at bf16 on most cloud providers, with on-the-fly int4 possible on single-H100 deployments. No fp8-only lock-in equivalent to Maverick has been identified for Scout.

**Revised Medium-tier numbers:**

- Weights: 61.1 GB (confirmed)
- KV cost: Scout is 109B total / 17B active, 16 experts. No published hybrid-attention layout. Full-attention assumption at 128K × 5 users gives ~40 GB KV (prior estimate stands).
- Peak RAM: **~106 GB** — this is Medium to High tier, straddling the 128 GB Mac Studio M4 Max.

The 60 GB weight figure corrects the prior "60 GB (est.)" note in the synthesis. The tier assignment (Mid 128 GB min / High 256 GB comfortable) is unchanged.

### Q3: Qwen3.5-122B-A10B KV bytes per token (real number)

**Source:** `Qwen/Qwen3.5-122B-A10B/config.json` on Hugging Face (fetched 2026-04-14).

**Architecture parameters:**

| Parameter | Value |
|-----------|-------|
| num_hidden_layers | 48 |
| num_attention_heads | 32 |
| num_key_value_heads | 2 |
| head_dim | 256 |
| hidden_size | 3,072 |
| num_experts | 256 |
| num_experts_per_tok | 8 |
| Full-attention layers | 12 (indices 3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47) |
| Linear-attention layers | 36 (all others) |
| Hybrid ratio | 1 full per 4 layers (every 4th) |

**Exact KV bytes/token formula:**

```
KV_bytes/token
  = full_attn_layers × 2 (K+V) × num_kv_heads × head_dim × 2 (bf16 bytes)
  = 12 × 2 × 2 × 256 × 2
  = 24,576 bytes/token
```

**Per-session at 128K tokens:** 24,576 × 131,072 = **~3.22 GB**

**5 users:** ~**16.1 GB**

**Comparison to prior estimate:**

| Source | Bytes/token | 5-user KV @ 128K |
|--------|-------------|-----------------|
| Session estimate (family patterns) | ~30,000 | ~20 GB |
| Real config.json (this spike) | **24,576** | **~16 GB** |
| Difference | -18% | -4 GB |

The real number is 18% lower than the estimate. This reduces the Large-tier peak RAM from ~96 GB to ~92 GB (70 GB weights + 16 GB KV + ~6 GB OS/overhead). The Large tier still sits comfortably within the Mid 128 GB hardware tier; the tier assignment is unchanged.

**Comparison to Small tier (Qwen3.5-35B-A3B):**

The prior trove measured Small at 20,480 bytes/token (10 full-attention layers of 40). Large at 24,576 bytes/token (12 full-attention of 48) is consistent and slightly higher, as expected from a larger model with more total layers.

## Summary of decisions

| Question | Result |
|----------|--------|
| Maverick for Max tier | Accept conditionally. Document fp8/int4 delta. Requires 512 GB hardware. |
| Scout Instruct file size | Confirmed 61.1 GB. Prior "60 GB (est.)" corrects to 61.1 GB exact. |
| Qwen3.5-122B KV bytes/token | 24,576 bytes/token (real). Prior ~30,000 estimate was 18% high. |

## Trove updates

The following data in `apple-silicon-model-tier-ram` requires correction:

1. **Large tier KV table row** — update qwen3.5-122b-a10b from "~30,000 (est.)" to 24,576 (exact), and 5-user KV from 20 GB to ~16 GB. Peak RAM revises from ~96 GB to ~92 GB.
2. **Medium tier cross-family row** — update llama-4-scout weight from "60 GB (est.)" to 61.1 GB (confirmed). Add note that the 200 GB figure was an upload error (resolved upstream).
3. **Max tier entry** — add Maverick at 226 GB weights, ~251 GB estimated peak RAM, fp8/int4 parity caveat. Mark tier as conditional on 512 GB hardware.
4. **Gaps section** — close the Qwen3.5-122B KV and Scout file-size gaps. Add a residual gap for Maverick KV architecture (no config.json verified yet).
