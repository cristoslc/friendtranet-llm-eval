---
source-id: macstories-qwen3-235b-benchmark
title: "Notes on Early Mac Studio AI Benchmarks with Qwen3-235B-A22B and Qwen2.5-VL-72B"
url: https://www.macstories.net/notes/notes-on-early-mac-studio-ai-benchmarks-with-qwen3-235b-a22b-and-qwen2-5-vl-72b/
fetched: 2026-04-13
type: web
fetch-method: WebFetch
---

# Mac Studio Benchmarks — Qwen3-235B-A22B

Early benchmarks of the 235B-A22B MoE (22B active) on a Mac Studio M3 Ultra 512 GB.

## Memory usage

| Format | Peak RAM |
|--------|----------|
| MLX 4-bit | ~124 GB |
| GGUF 4-bit | ~133 GB |

## Performance

| Format | Tokens/sec |
|--------|-----------|
| MLX 4-bit | 24 tok/s |
| GGUF 4-bit | 16 tok/s |

## Hardware

Top-of-the-line Mac Studio: M3 Ultra, 512 GB unified memory, 8 TB storage.

## Takeaway

Qwen3-235B-A22B is the reference point for the project's High tier (256 GB Mac Studio M3 Ultra). ~124 GB peak at 4-bit MLX means it fits on a 256 GB machine with roughly 130 GB headroom. A 128 GB machine cannot run it — pressure would be catastrophic. The same scaling logic applies to the project's "Large" tier when that model is a 200B-class MoE.

For the Worksheet 3 Large tier (Qwen3.5-122B-A10B), the expected footprint is roughly half of this — around 70 GB at standard 4-bit MLX — putting it squarely in Mid tier (128 GB) territory.
