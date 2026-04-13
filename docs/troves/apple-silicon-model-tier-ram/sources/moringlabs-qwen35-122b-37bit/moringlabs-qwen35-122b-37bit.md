---
source-id: moringlabs-qwen35-122b-37bit
title: "MoringLabs/Qwen3.5-122B-A10B-MLX-3.7bit-VL"
url: https://huggingface.co/MoringLabs/Qwen3.5-122B-A10B-MLX-3.7bit-VL
fetched: 2026-04-13
type: repository
fetch-method: WebFetch
---

# Qwen3.5-122B-A10B MLX 3.7-bit VL — HuggingFace

Aggressive mixed-precision quantization variant targeting 64 GB Apple Silicon machines. Useful as a reference for the "tight fit" end of Entry-tier hardware.

## Specs

| Field | Value |
|-------|-------|
| Quantization | 3.7-bit mixed (experts compressed, routers/attention/vision tower at BF16) |
| Model size | 52 GB |
| Peak memory @ 4K context | 55.1 GB |
| Minimum hardware | 64 GB unified memory |
| Recommended hardware | 96 GB+ unified memory |
| Primary benchmark target | M2 Max 96 GB |

## Implementation notes

Experts quantized non-uniformly to 5/4/3/2 bits. Routers, attention, and the vision tower preserved at full BF16 to protect quality. Advertised as the first 122B multimodal model that fits in 64 GB Unified Memory.

## Takeaway

Not relevant as the default MLX 4-bit model footprint, but indicates what is technically achievable with aggressive mixed quantization. For the project's purposes, the default 4-bit path (see `inferencerlabs-qwen35-122b-65bit` derived estimate) is the realistic reference — 3.7-bit mixed is an advanced option that lets Entry-tier (64 GB) machines technically touch a 122B model at some quality cost.
