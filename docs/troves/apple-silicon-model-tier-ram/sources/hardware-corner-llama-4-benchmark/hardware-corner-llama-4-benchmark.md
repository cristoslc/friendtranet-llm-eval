---
source-id: hardware-corner-llama-4-benchmark
title: "Llama 4 Scout & Maverick Benchmarks on Mac: How Fast Is Apple's M3 Ultra"
url: https://www.hardware-corner.net/llama-4-on-mac-m3-ultra-speed/
fetched: 2026-04-13
type: web
fetch-method: WebFetch
---

# Llama 4 — M3 Ultra Benchmarks

Hardware Corner's MLX 4-bit benchmark on Mac Studio M3 Ultra (512 GB, 800 GB/s memory bandwidth).

## Throughput table (4-bit MLX)

| Model | Context | Prompt (tok/s) | Generation (tok/s) |
|-------|---------|---------------|-------------------|
| Llama 4 Scout | 30 tokens | 103.0 | 44.2 |
| Llama 4 Scout | 10K tokens | 82.0 | 21.6 |
| Llama 4 Maverick | 30 tokens | 140.2 | 50.1 |
| Llama 4 Maverick | 10K tokens | 117.1 | 24.8 |

## What this tells us

- **Generation throughput degrades with context length** — Scout drops from 44 tok/s at 30 tokens to 22 tok/s at 10K tokens. Extrapolating, at 128K tokens generation will likely drop below 10 tok/s. Practical multi-user throughput at 128K is limited.
- **Maverick is faster than Scout** despite being larger (400B total vs 109B total) because the active-param path is similar (17B each) but Maverick's routing / expert mix is more efficient.
- **M3 Ultra is the appropriate test bed** for Medium-tier and above. The 512 GB RAM isn't being fully used — model state for Scout at 4-bit is only ~60 GB — but the 800 GB/s memory bandwidth is what drives throughput.

## Ruled out by user constraint

Llama 4 Maverick (~400B total / 200 GB at 4-bit MLX) requires Max tier (512 GB) hardware. Per operator decision to rule out frontier models above Large tier, Maverick is not included in the W3 tier mapping. Scout remains viable at Medium tier.
