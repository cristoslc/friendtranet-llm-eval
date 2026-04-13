---
source-id: inferencerlabs-qwen35-122b-65bit
title: "inferencerlabs/Qwen3.5-122B-A10B-MLX-6.5bit"
url: https://huggingface.co/inferencerlabs/Qwen3.5-122B-A10B-MLX-6.5bit
fetched: 2026-04-13
type: repository
fetch-method: WebFetch
---

# Qwen3.5-122B-A10B MLX 6.5-bit — HuggingFace

Higher-quality quantization variant of the Worksheet 3 Large tier model.

## Specs

| Field | Value |
|-------|-------|
| Quantization | 6.5-bit MLX |
| File size | 99.2 GB |
| Tested hardware | M3 Ultra, 512 GB RAM |
| Peak memory observed | ~92.5 GiB |
| Throughput | ~46.7 tok/s @ 1,000 tokens |

## Derived 4-bit estimate

Community convention plus the ratio between 4-bit and 6.5-bit quantized weights (~4 ÷ 6.5 = 0.615×) puts the standard 4-bit MLX weight size at roughly 61 GB and peak memory for 4-bit around 69–72 GB (weights + compute + 8K KV cache). This matches the 69.6 GB figure reported elsewhere for the standard 4-bit conversion.

## Takeaway

Qwen3.5-122B-A10B at standard 4-bit MLX will not fit on a 64 GB Mac mini (Entry tier) with any headroom — the 70 GB peak already exceeds the total RAM. A 128 GB Mac Studio M4 Max (Mid tier) runs it with ~55 GB free for OS and KV growth. A 256 GB Mac Studio (High tier) is comfortable.
