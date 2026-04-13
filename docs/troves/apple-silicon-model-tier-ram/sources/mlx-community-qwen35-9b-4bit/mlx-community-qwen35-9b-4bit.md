---
source-id: mlx-community-qwen35-9b-4bit
title: "mlx-community/Qwen3.5-9B-MLX-4bit"
url: https://huggingface.co/mlx-community/Qwen3.5-9B-MLX-4bit
fetched: 2026-04-13
type: repository
fetch-method: WebFetch
---

# Qwen3.5-9B-MLX-4bit — HuggingFace

Model card for the MLX 4-bit conversion of Qwen3.5-9B dense, hosted by mlx-community.

## Specs

| Field | Value |
|-------|-------|
| Disk size | ~5.6 GB (reported as 5.95 GB in file info) |
| Quantization | 4-bit, group size 64 (~5.059 bits-per-weight effective) |
| Format | MLX SafeTensors |
| Target hardware | Apple Silicon M1 / M2 / M3 / M4 |

## Notes from card

Documentation does not publish an explicit peak-memory number. The card notes the 4-bit quantization is "designed to run efficiently on resource-constrained Apple Silicon" and has "lower memory footprint compared to 8-bit quantization." Community reports consistently put practical inference memory at roughly 1.5–1.8× the disk weight when KV cache and compute buffers are included — so ~9–10 GB at 8K context, well within any supported Mac.
