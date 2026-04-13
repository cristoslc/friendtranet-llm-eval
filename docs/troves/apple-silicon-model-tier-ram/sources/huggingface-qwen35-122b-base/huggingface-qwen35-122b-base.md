---
source-id: huggingface-qwen35-122b-base
title: "Qwen3.5-122B-A10B base weights (4-bit file-size reference)"
url: https://huggingface.co/Qwen/Qwen3.5-122B-A10B
fetched: 2026-04-13
type: repository
fetch-method: WebSearch excerpt
notes: "Aggregated from community reports referenced in the search pass."
---

# Qwen3.5-122B-A10B — 4-bit File Size Reference

Community reporting aligned on the standard MLX 4-bit quantization weighing 69.6 GB on disk. Combined with compute buffers and an 8K KV cache, expected peak unified memory is approximately 72–78 GB for a single-session inference.

This sits just above the 64 GB Entry tier, which is why a Mac mini cannot run it at standard 4-bit. A 128 GB Mac Studio (Mid tier) has 50+ GB of headroom for OS and KV growth, which is comfortable for 8K-context workloads. A 256 GB Mac Studio (High tier) has enough headroom to run it alongside other applications.
