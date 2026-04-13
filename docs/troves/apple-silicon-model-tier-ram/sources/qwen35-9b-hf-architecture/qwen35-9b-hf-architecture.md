---
source-id: qwen35-9b-hf-architecture
title: "Qwen3.5-9B architecture — hybrid attention layout"
url: https://huggingface.co/Qwen/Qwen3.5-9B
fetched: 2026-04-13
type: repository
fetch-method: WebSearch excerpt
---

# Qwen3.5-9B — Hybrid Attention Architecture

Dense 9B model using the same hybrid Gated-DeltaNet + Gated-Attention layout as the larger Qwen3.5 MoE variants.

## Architecture

- 32 total transformer blocks
- Layout: 8 × (3 × DeltaNet + FFN → 1 × Gated Attention + FFN)
- **8 full-attention layers** (one per group of 4)
- 24 DeltaNet linear-attention layers
- Gated Attention: 16 Q heads / 4 KV heads, head_dim=256
- Hidden dim: 4096

## KV cache derivation

Applying the formula from `kaitchup-kv-cache-small-moes`:

```
KV_bytes/token = 8 layers × 2 × 4 kv_heads × 256 head_dim × 2 bytes = 32,768 bytes/token
```

## Memory by context length (single session)

| Context | KV per session |
|---------|---------------|
| 8K | ~0.27 GB |
| 32K | ~1.1 GB |
| 128K | ~4.3 GB |
| 256K (native max) | ~8.6 GB |

## Multi-user (5 concurrent sessions, 128K each)

5 × 4.3 GB = ~21.5 GB KV cache total, on top of the ~6 GB weights at MLX 4-bit. Plus ~6 GB macOS overhead = ~34 GB peak. Fits Entry tier (64 GB) with ~30 GB headroom.
