---
source-id: kaitchup-kv-cache-small-moes
title: "The KV-Cache of Small MoEs: Qwen3, Qwen3.5, GLM 4.7 Flash, and Nemotron 3 Nano Compared"
url: https://kaitchup.substack.com/p/the-kv-cache-of-small-moes-qwen3
fetched: 2026-04-13
type: web
fetch-method: WebFetch
---

# KV-Cache of Small MoEs — Exact Architecture Numbers

Detailed architectural breakdown of Qwen3 and Qwen3.5 KV cache costs per token per session.

## Qwen3.5-35B-A3B

- 40 total layers — **hybrid** design: only 10 full-attention layers, the other 30 use linear attention
- At full-attention layers: 2 KV heads, 256-dim head
- **KV bytes per token** = 10 × 2 × 2 × 256 × 2 = **20,480 bytes/token** = ~20 KB/token
- At 8K context: ~0.16 GB per session
- At 32K context: ~0.67 GB per session
- **At 128K context: ~2.7 GB per session**

Linear-attention layers have negligible state compared to standard transformer KV caching, which is the key efficiency gain.

## Qwen3-30B-A3B-Instruct-2507 (reference)

- 48 layers, full attention throughout
- 32 query heads / 4 KV heads, 128-dim head
- KV bytes per token = 48 × 2 × 4 × 128 × 2 = 98,304 bytes/token = ~96 KB/token
- At 32K: ~3.22 GB per session
- At 128K: ~12.9 GB per session

This is roughly 5× heavier than Qwen3.5-35B-A3B at the same context — showing how much hybrid attention helps.

## Formula

Generic KV cache byte count per token per session:

```
KV_bytes = num_attention_layers × 2 × num_kv_heads × head_dim × bytes_per_value
```

Where `bytes_per_value` is 2 for fp16/bf16 (the standard), or lower if the KV cache itself is quantized (TurboQuant, INT8-KV, etc.).

## Takeaway for the Worksheet 3 tiers

Qwen3.5 hybrid models (Mini, Small, Large) all benefit from this efficiency. gpt-oss-120b (Medium) does not use hybrid attention, so its KV cache scales more aggressively with context. This changes the "fits" calculus at 128K significantly.
