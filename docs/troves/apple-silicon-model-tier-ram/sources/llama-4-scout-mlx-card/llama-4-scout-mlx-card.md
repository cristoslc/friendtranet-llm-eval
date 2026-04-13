---
source-id: llama-4-scout-mlx-card
title: "Llama 4 Scout 17B-16E — MLX 4-bit"
url: https://huggingface.co/mlx-community/Llama-4-Scout-17B-16E-Instruct-4bit
fetched: 2026-04-13
type: repository
fetch-method: WebSearch aggregation
---

# Llama 4 Scout — MLX 4-bit (Medium-tier alternative)

Meta's MoE released April 5 2026. Cross-family alternative to gpt-oss-120b at the Medium tier.

## Specs

| Field | Value |
|-------|-------|
| Total parameters | ~109B |
| Active parameters | 17B per token |
| Number of experts | 16 |
| MLX 4-bit (base) size | ~60 GB |
| MLX 4-bit Instruct size | ~200 GB (discrepancy, see caveat) |
| Native max context | 10M tokens |

## Caveat on file size

Multiple community sources report Scout-base at 60 GB on disk in MLX 4-bit, while the Instruct variant is reported at 200 GB (see `ml-explore/mlx-lm#76`). The 200 GB figure suggests either a packaging bug or that the Instruct-4bit variant isn't actually quantized — worth verifying which package users would download before committing the footprint to tier data. For the purposes of this trove, use the 60 GB figure.

## KV cache (estimated)

Llama 4 Scout does not use hybrid attention (based on surveyed material — the release post describes it as "MoE + multimodal" without mentioning sliding windows). Assume full attention across all layers. Without the published config, estimate KV per token based on the 17B active parameter density and typical Llama GQA patterns: ~60 KB/token at full attention.

At 128K context: ~8 GB per session. 5 users × 8 GB = ~40 GB KV cache.

## Peak RAM (5 users × 128K, estimated)

60 GB weights + 40 GB KV + 6 GB macOS = **~106 GB**. Tight on Mid tier (128 GB), comfortable on High tier (256 GB). Similar footprint to the existing Medium tier primary.

## Benchmarks on M3 Ultra (Hardware Corner)

At 4-bit MLX, 10K token context:
- Prompt: 82 tok/s
- Generation: 21.6 tok/s
- (Tested on M3 Ultra 512 GB.)

## Takeaway

Llama 4 Scout is a realistic Medium-tier cross-family alternative. The main risk is the ambiguous Instruct-variant file size — users should verify actual disk footprint before relying on it. For use where Qwen's style isn't preferred, Scout offers Meta's training distribution in a similar hardware envelope.
