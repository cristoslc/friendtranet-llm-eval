---
source-id: gemma4-wiki-mlx-requirements
title: "Gemma4 MLX: Complete Local AI Setup & Performance Guide 2026"
url: https://www.gemma4.wiki/models/gemma4-mlx
fetched: 2026-04-13
type: web
fetch-method: WebFetch
---

# Gemma 4 MLX Requirements per Variant

Concrete file sizes and Mac hardware recommendations from the Gemma 4 community wiki.

## RAM / file size table

| Variant | BF16 | Q4_0 | Recommended Mac | Min RAM |
|---------|------|------|----------------|---------|
| E2B | 9.6 GB | 3.2 GB | M1/M2/M3/M4 (any) | 8 GB |
| E4B | 15 GB | 5 GB | M1/M2/M3/M4 (any) | 8 GB |
| 26B A4B | 48 GB | 15.6 GB | M2 Pro, M3 Pro | 24 GB |
| 31B Dense | 58.3 GB | 17.4 GB | M1 Max, M2 Ultra, M3 Max | 48 GB+ |

## Key warning

"Running the 31B Dense model on a machine with only 16GB of RAM will cause heavy system swapping, significantly shortening the lifespan of your SSD and resulting in unusable speeds."

## What this tells us for the W3 tier map

- **26B A4B** is a drop-in Mini/Small-tier alternative to `qwen3.5-35b-a3b` — similar architecture (MoE with few-billion active), similar weight footprint, different model family.
- **31B Dense** is heavier than Qwen's Small primary because it's fully dense. The KV cache is tempered by sliding-window attention, but weights are bigger per parameter read. It lands in Small tier with less headroom.
- **E2B / E4B** are too small for the current W3 Mini tier (9B) — they're useful as a sub-Mini tier if future designs explore ultra-lightweight local models.
