---
source-id: llama-cpp-gpt-oss-guide
title: "guide: running gpt-oss with llama.cpp"
url: https://github.com/ggml-org/llama.cpp/discussions/15396
fetched: 2026-04-13
type: forum
fetch-method: WebFetch
---

# Running gpt-oss with llama.cpp — Official Guide

Maintainer-authored guide from the llama.cpp discussion board covering gpt-oss-120b.

## Memory breakdown (native MXFP4 format)

| Component | Size |
|-----------|------|
| Model weights | 61.0 GB |
| Compute buffers | 2.7 GB |
| KV cache (per 8,192 tokens) | 0.3 GB |
| **Total @ 8K context** | **64.0 GB** |

## Hardware guidance

- "Devices with more than 96 GB RAM" can run gpt-oss-120b at full context.
- Macs with 8 GB are explicitly ruled out — the guide says "gpt-oss models are not possible to run on Macs with that small amount of memory" and steers users to gpt-oss-20b.
- `--n-cpu-moe` and `-c` flags allow dialing down context to trade throughput for fit.

## Context

gpt-oss-120b is distributed natively in MXFP4 — there is no "Q4" equivalent to quantize further, because MXFP4 is already the training-time format. The model is a 117B-parameter MoE with roughly 5B active per token, which matters for throughput but not for RAM (all experts must be resident).

## Takeaway

The 64 GB minimum is a "load but not thrive" number — it leaves zero headroom for the OS, KV cache growth, and system services. A Mac mini M4 Pro 64 GB cannot realistically run this. A Mac Studio 128 GB can run it but will swap under sustained load. 96 GB+ is the stated comfortable floor; a Mac Studio 256 GB (High tier) runs it cleanly.
