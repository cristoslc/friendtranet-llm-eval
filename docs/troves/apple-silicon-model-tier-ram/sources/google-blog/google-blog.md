---
source-id: google-blog
title: "Gemma 4: Byte for byte, the most capable open models"
url: https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/
fetched: 2026-04-13
type: web
fetch-method: WebSearch excerpt
---

# Gemma 4 — Google Official Blog

Google's announcement for the Gemma 4 family (2026). Reinforces the specs in `gemma-4-release` and `gemma4-wiki-mlx-requirements`.

## Key claims

- Four variants: E2B, E4B, 26B A4B (MoE), 31B Dense.
- Day-one MLX support via mlx-vlm.
- Benchmarked across context lengths 4K through 256K on Apple Silicon, including TurboQuant (MLX's 2.5-bit KV cache quantization) for long-context decode speedups.
- MoE variant (26B A4B): 25.2B total, 3.8B active per token.

## Why this source is listed

Corroborates the architectural claims in the HF blog source and establishes Google's official positioning — Gemma 4 is a first-class open-model family on Apple Silicon, making it a credible cross-family alternative at the W3 Small tier.
