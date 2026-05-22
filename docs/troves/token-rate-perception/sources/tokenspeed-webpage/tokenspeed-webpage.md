# tokenspeed — feel LLM tokens-per-second

URL: <https://mikeveerman.github.io/tokenspeed/?rate=10&mode=text>
Source: Mike Veerman
Fetched: 2026-05-22

## Overview

tokenspeed is a browser-based tool that renders fake LLM token output at any configurable rate, so you can internalize what different tok/s numbers actually look and feel like. Published at `mikeveerman.github.io/tokenspeed` with source on GitHub.

The tagline: "How fast is 10 tokens per second *really*?"

## Four modes

- **code** — syntax-highlighted pseudo-code (Python, Rust, JS), the most common thing you watch stream out of an LLM.
- **text** — lorem ipsum prose (Wikipedia "Intelligence" article), for the chat/answer case.
- **think** — dim-italic reasoning sentences alternating with code, mimicking a reasoning model thinking out loud.
- **agent** — alternating tool calls and code generation with processing pauses, simulating an AI coding agent.

## Preset rates

| Key | Rate (tok/s) | Real-world reference |
|-----|-------------|---------------------|
| 1   | 5           | Raspberry-Pi-class local model |
| 2   | 10          | Slow local model |
| 3   | 20          | Modest local model |
| 4   | 30          | Default — decent local model |
| 5   | 60          | Typical hosted Claude or GPT |
| 6   | 100         | Fast hosted |
| 7   | 200         | Groq territory |
| 8   | 400         | Very fast inference |
| 9   | 800         | Cerebras-class — bottleneck is your eyeballs |

## Key insight: code vs. prose token density

The tool is designed to expose a critical gap in how benchmark numbers are perceived. Code is more token-dense than prose, so the same tok/s can feel very different depending on content type. 30 tok/s of code lands far less visible content per second than 30 tok/s of English. The benchmark number is honest; the perceptual effect varies a lot by content type.

English prose averages ~1.3 tokens per word, so 30 tok/s ≈ 23 words/s.

## Tokenization model

Approximates BPE-style tokenization, not any vendor-specific encoder (tiktoken, Claude's tokenizer, etc.). Short words are often one token; longer identifiers split into chunks (e.g., `processUserInput` → `process` + `User` + `Input`). Punctuation and operators usually count as tokens too.

## Controls

- Space: pause/resume
- +/- (or =/_ ): nudge rate by ×1.25
- 1-9: preset rates
- c/t/h/a: switch mode (code/text/think/agent)
- </> (or ,/.): adjust think length
- u: toggle custom text panel
- n: toggle token counter
- Share button: copies URL with current rate and mode as query params

## Technical notes

- Uses `requestAnimationFrame` for streaming; caps frame output at 300 tokens per frame
- Accumulator-based timing with 0.1s cap on dt to avoid burst after tab-backgrounding
- Trims DOM nodes to 3500 when exceeding 5000 for performance
- URL state encoded in query params: `?rate=30&mode=code&think=5`
