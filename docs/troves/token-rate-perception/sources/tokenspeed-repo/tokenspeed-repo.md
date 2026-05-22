# tokenspeed — GitHub Repository

URL: <https://github.com/MikeVeerman/tokenspeed>
Source: Mike Veerman
Fetched: 2026-05-22

## Files

- `index.html` — Single-page browser app (all CSS and JS inline)
- `tokenspeed.py` — Terminal (CLI) version, same concept, Python 3, no dependencies
- `README.md` — Project documentation
- `.gitignore` — Ignore venv/, __pycache__/, *.pyc

## CLI version (tokenspeed.py)

Terminal counterpart to the web app. Streams fake tokens at configurable rates in three modes (code, text, think). Uses raw terminal input for keyboard controls.

### Controls (CLI)

| Key | Action |
|-----|--------|
| +/- | Nudge rate by ×1.25 |
| 1-9 | Jump to preset (5, 10, 20, 30, 60, 100, 200, 400, 800 tok/s) |
| Space | Pause/resume |
| q | Quit |

### Usage

```bash
python3 tokenspeed.py                  # 30 tok/s, prompts for mode
python3 tokenspeed.py 60               # 60 tok/s, prompts for mode
python3 tokenspeed.py --mode code      # skip the prompt
python3 tokenspeed.py 120 --mode think # both at once
```

## Code modes and token generation

- **code generator**: Cycles through shuffled code snippets (Python, Rust, JS) with syntax highlighting. Splits identifiers via camelCase/snake_case PascalCase boundary regex (`IDENT_PARTS`). Longer identifiers (>=10 chars) have a 35% chance of random split.
- **text generator**: Cycles through Wikipedia "Intelligence" article words. Plain words ≤5 chars stay whole; >5 use probabilistic split (30% at 6-7 chars, 50% at 8-10, 75% at 11+).
- **think generator**: Produces reasoning sentences (from 20 curated thoughts) followed by code snippets. Think length configurable (1-20 sentences).
- **agent mode** (web only): Alternates tool calls with processing pauses (0.4-6.0s) and code generation.
