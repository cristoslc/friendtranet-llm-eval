---
source-id: gemma-4-release
title: "Welcome Gemma 4: Frontier multimodal intelligence on device"
url: https://huggingface.co/blog/gemma4
fetched: 2026-04-13
type: web
fetch-method: WebFetch
---

# Gemma 4 — Release Overview

Google's Gemma 4 family, released 2026, shipping day-one with MLX support.

## Variants

| Variant | Parameters | Architecture | Context |
|---------|-----------|-------------|---------|
| E2B | 2B effective (PLE) | Per-Layer Embeddings | 128K |
| E4B | 4.5B effective (PLE) | Per-Layer Embeddings | 128K |
| 26B A4B | 25.2B total / 3.8B active | MoE | 256K |
| 31B Dense | 31B | Dense transformer | 256K |

## Attention mechanism

Hybrid: alternating local sliding-window attention layers + global full-context layers. Smaller models use 512-token sliding windows; larger models use 1024-token sliding windows. Two RoPE configurations — standard for sliding layers, proportional for global layers.

**Shared KV cache:** The last N layers reuse K/V from earlier same-type attention layers, reducing per-token KV cache cost substantially.

## Per-Layer Embeddings (E2B / E4B)

PLE is a parallel conditioning pathway alongside the main residual stream. Each decoder layer receives a dedicated vector for modulation. Lower-dimensional than main hidden size. This is Google's alternative to MoE for mobile-class inference.

## Benchmark highlights

- 31B scores 85.2% on MMLU Pro, 89.2% on AIME 2026 (vs Gemma 3 27B's 20.8% on AIME).
- 31B ranks #3 open model on Arena AI text leaderboard (as of release).
- E2B outperforms Gemma 3 27B on several tasks despite 12× smaller effective parameter count.

## Gaps in this source

Blog post does not disclose exact `num_layers`, `num_attention_heads`, `num_key_value_heads`, or `head_dim` per variant. Values in the synthesis are derived from the MLX-supported Q4 file sizes and published hidden_size assumptions; the exact KV cache per token is estimated within a band.
