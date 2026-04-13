---
source-id: lmstudio-blog-gpt-oss
title: "Run OpenAI's gpt-oss locally in LM Studio"
url: https://lmstudio.ai/blog/gpt-oss
fetched: 2026-04-13
type: web
fetch-method: WebSearch excerpt
notes: "Summary pulled from search-result excerpt; LM Studio contributed the MLX implementation for gpt-oss."
---

# LM Studio on gpt-oss — Summary

LM Studio contributed the MLX implementation for running gpt-oss-20b and gpt-oss-120b locally. Both GGUF and MLX variants are distributed. LM Studio's guidance echoes the llama.cpp maintainer guide: 120B is memory-bandwidth-bound on laptop-class Apple Silicon, so an M4 Max 128 GB can host the model but will feel slow under real workloads. LM Studio recommends GPT-OSS-20B for most Mac users; the 120B is appropriate only on Mac Studio-class machines with ≥96 GB RAM.

This corroborates `llama-cpp-gpt-oss-guide`: minimum-to-load sits near 64 GB, comfortable use is 96 GB+, and real day-to-day sustained throughput wants Mac Studio bandwidth (M3 Ultra or better).
