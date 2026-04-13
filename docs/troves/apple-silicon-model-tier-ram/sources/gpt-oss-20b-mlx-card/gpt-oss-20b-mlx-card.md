---
source-id: gpt-oss-20b-mlx-card
title: "InferenceIllusionist/gpt-oss-20b-MLX-4bit"
url: https://huggingface.co/InferenceIllusionist/gpt-oss-20b-MLX-4bit
fetched: 2026-04-13
type: repository
fetch-method: WebFetch
---

# gpt-oss-20b MLX 4-bit — HuggingFace

OpenAI's small open MoE — cross-family alternative to Qwen at the Mini tier.

## File size

- **11.8 GB** on disk (MLX 4-bit, effective 4.5 bits/weight)

## Architecture

| Field | Value |
|-------|-------|
| Total parameters | ~20B |
| Active parameters | ~3.6B per token (MoE) |
| Hidden size | 2,880 |
| Layers | 24 |
| Attention heads | 64 |
| KV heads | 8 |
| Head dimension | 64 |
| Local experts | 32 |
| Experts per token | 4 |
| Native max context | 131,072 tokens (128K) |

## Attention pattern

**Hybrid:** alternating layers — even layers (0, 2, 4…) use sliding window (128 tokens), odd layers (1, 3, 5…) use full attention. Twelve of the 24 layers carry meaningful KV cache at long contexts.

## KV cache derivation

Applying the formula to the 12 full-attention layers:

```
KV_bytes/token = 12 × 2 × 8 × 64 × 2 = 24,576 bytes/token
```

At 128K context: ~3.2 GB per session. 5 users × 3.2 GB = ~16 GB KV cache.

## Peak RAM (5 users × 128K)

12 GB weights + 16 GB KV + 6 GB macOS = **~34 GB**. Fits Entry tier (64 GB) with 30 GB headroom.

## Takeaway

gpt-oss-20b lands in the same RAM envelope as qwen3.5-9b despite being larger by parameter count, because hybrid sliding-window attention + MoE combine to keep per-token cost low. Strong Mini-tier alternative especially for users who want MXFP4-native parity between local and cloud (it's native format).
