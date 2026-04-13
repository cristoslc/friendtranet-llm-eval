---
source-id: antekapetanovic-qwen35-35b-benchmark
title: "Ollama vs. llama.cpp vs. MLX with Qwen3.5 35B on Apple Silicon"
url: https://antekapetanovic.com/blog/qwen3.5-apple-silicon-benchmark/
author: "Ante Kapetanovic"
fetched: 2026-04-13
type: web
fetch-method: WebFetch
---

# Qwen3.5 35B-A3B on Apple Silicon — Benchmarks

Independent benchmark comparing Ollama, llama.cpp, and MLX backends running Qwen3.5-35B-A3B (35B total / 3B active MoE) at 4-bit on an M4 Max.

## Memory usage

| Metric | Value |
|--------|-------|
| Peak RAM at 4-bit MLX | ~20 GB |
| Minimum machine that loads the model | 24 GB unified memory (author cites base MacBook Air as sufficient) |

## Hardware tested

Apple M4 Max, 128 GB unified memory. Author notes the 128 GB is "excessive" for this model — a 32 GB Mac would be comfortable with OS overhead included.

## Performance

| Backend | Tokens/sec |
|---------|-----------|
| MLX Python API | ~130 tok/s |
| MLX HTTP server | 90–108 tok/s |
| llama.cpp | ~71 tok/s |
| Ollama | ~43 tok/s |

## Takeaway

A 3B-active MoE with 35B total parameters quantized to 4-bit is extremely memory-efficient on Apple Silicon — it fits in half the RAM a 35B dense model would need. The entire tier ladder above Entry (64 GB) can run this model with headroom.
