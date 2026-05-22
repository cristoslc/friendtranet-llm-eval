# TROVE: token-rate-perception

**What different LLM token-per-second rates actually *feel like* across content types.**

## Key findings

1. **The same tok/s number produces very different perceptual experiences depending on content type.** Code is more token-dense than prose — `processUserInput` might be 3-4 tokens while an English word is typically 1 token. 30 tok/s of code lands far less visible content per second than 30 tok/s of English prose. Benchmark numbers are honest; the perceptual effect varies substantially.

2. **English prose averages ~1.3 tokens per word**, so 30 tok/s ≈ 23 words/s. This is a useful rule of thumb for translating tok/s into readable throughput.

3. **The tool provides a concrete sensory reference for benchmark numbers.** "47 tok/s on an M3" is abstract until you've watched tokens stream at that exact rate. The preset rates map to real hardware tiers: 5 tok/s (Raspberry Pi), 60 tok/s (hosted Claude/GPT), 200 tok/s (Groq), 800 tok/s (Cerebras).

4. **BPE-style tokenization splits longer identifiers** (camelCase, snake_case, PascalCase boundaries) and treats punctuation/operators as tokens. This is an approximation, not a precise tiktoken/Claude tokenizer reproduction, but close enough for perceptual calibration.

5. **The agent mode adds processing pauses** (0.4-6.0s simulated tool calls), which substantially changes the feel even at high tok/s — pauses between bursts of output make the overall experience feel slower than the raw tok/s suggests.

## Points of agreement

Both sources (web app and repo/README) agree on:
- Preset rates and their real-world hardware mappings
- The core BPE-like tokenization model (short words single token, longer identifiers split)
- The ~1.3 tokens/word English prose heuristic
- Code being more token-dense than prose, making the same tok/s feel different
- Three core modes (code, text, think) plus agent mode as a fourth

## Points of difference

- The web app has richer features (think length slider, custom text/code upload, token counter, share-as-URL, agent mode with pauses). The CLI version is more minimal.
- Agent mode exists only in the web app, not in the CLI Python version.

## Gaps

- No source compares this tool's tokenization directly against a real vendor tokenizer (tiktoken, Claude's tokenizer) to quantify the divergence.
- No discussion of how output modality (streaming vs. buffered) affects perceived latency — this is about steady-state throughput perception.
- No coverage of how different models' output structure (e.g., chain-of-thought vs. direct answer) interacts with perceived speed.
