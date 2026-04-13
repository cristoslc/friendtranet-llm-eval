---
source-id: openrouter-provider-routing
title: "OpenRouter Provider Routing & Quantization Selection"
url: https://openrouter.ai/docs/guides/routing/provider-selection
fetched: 2026-04-13
type: web
fetch-method: WebFetch
---

# OpenRouter Provider Routing — Quantization Control

## Supported quantization levels

OpenRouter supports filtering across nine levels:

- `int4`, `int8` — integer quantization
- `fp4`, `fp6`, `fp8`, `fp16` — floating-point (4–16 bit)
- `bf16` — brain float 16-bit
- `fp32` — full 32-bit float
- `unknown` — providers that don't declare their quantization

## Filtering syntax

Via the REST API `provider` object:

```json
{
  "model": "openai/gpt-oss-120b",
  "messages": [{ "role": "user", "content": "…" }],
  "provider": {
    "quantizations": ["fp4", "int4"]
  }
}
```

TypeScript / SDK:

```ts
const completion = await openRouter.chat.send({
  model: 'openai/gpt-oss-120b',
  messages: [{ role: 'user', content: '…' }],
  provider: { quantizations: ['fp4', 'int4'] },
});
```

## Default behavior

Without the `provider.quantizations` filter, OpenRouter's router selects whichever provider it prefers at that moment — possibly a low-bit provider (`fp4`, `int4`) that materially degrades output. This is why tools like QwenCode explicitly set a floor (PR #348 filters to `fp8` or better for coding workloads).

## Docs note

OpenRouter's own guidance: *"Quantized models may exhibit degraded performance for certain prompts, depending on the method used."* The routing layer does not currently promise semantic equivalence across providers — the application is responsible for choosing an acceptable precision band.

## Implication for Worksheet 3

To make W3's blind rating a fair comparison between "cloud model output" and "what I'd see at home on MLX 4-bit," the OpenRouter request must pin quantizations to `fp4` / `int4`. Without the pin, the rating reflects an unspecified mix of provider precisions and is not a valid input to the local-hardware purchase decision.
