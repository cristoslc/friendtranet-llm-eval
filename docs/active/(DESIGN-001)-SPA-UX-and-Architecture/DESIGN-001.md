---
id: DESIGN-001
title: SPA UX & Architecture
type: design
phase: active
parent-epic: EPIC-001
created: 2026-04-11
---

# SPA UX & Architecture

## Purpose

Define the overall user experience flow, component architecture, state management approach, and visual design direction for the Sovereignty Stack Decision SPA.

## UX flow

The SPA is a linear wizard with gating between stages. The user sees one worksheet at a time with clear progress indication.

```
Landing → W1 (Risk) → W2 (Principle) → Gate Check → W3 (Capability) → Export
                                           ↓
                                     [not justified]
                                           ↓
                                    Summary + Stop
```

A separate aggregation entry point lets the aggregator import multiple exports without completing the individual flow.

### Progressive disclosure

- **No API key needed:** Landing, W1, W2, gate check, export.
- **API key required:** W3 only. Key entered just-in-time, stored in session storage, cleared on tab close.
- **Cost approval required:** before each W3 evaluation run, show estimated cost and require explicit confirmation.

### Navigation

- Linear forward progression with back-navigation to revise earlier worksheets.
- Worksheet state persists in IndexedDB. Returning to a completed worksheet shows saved answers, editable in place.
- No skip-ahead past the gate check.

## Component architecture

### Page structure

- **Shell:** persistent header (project title, progress stepper), main content area, persistent footer (export/import actions).
- **Worksheet container:** renders the active worksheet. Each worksheet is a self-contained component receiving shared state hooks.
- **Gate check:** reads W1+W2 outputs, computes tier justification, renders GO/STOP decision with explanation.
- **Aggregation view:** standalone page accessible from landing. No worksheet dependency.

### Key components

- **ThreatRow** — single row in W1 with probability dropdown, impact selector, mitigation fraction slider.
- **WTPSlider** — W2 willingness-to-pay with calibration prompt anchoring.
- **ConversationPicker** — W3 entry path selector (curated/pasted/synthetic).
- **BlindRatingCard** — W3 single-turn blind comparison with randomized model labels.
- **DecisionCard** — aggregation view decision output (GO/SMALLER/DEFER/SKIP) with red flag badges.

## State management

### IndexedDB schema

- **worksheets** store: keyed by `{userId, worksheetId}`. Holds all answers, computed outputs, and completion status.
- **conversations** store: keyed by content hash. Holds curated samples, user-provided conversations, and synthetic generations.
- **evaluations** store: keyed by `{conversationHash, modelId}`. Holds model outputs and user ratings. Enables caching — re-runs are free.
- **settings** store: singleton. Holds API key reference (pointer to session storage), selected tiers, user preferences.

### Session storage

- OpenRouter API key only. Cleared on tab close. Never persisted to IndexedDB or anywhere durable.

### Export format

JSON file containing:
- W1 outputs (per-threat expected loss, total, risk-aversion premium).
- W2 outputs (classified categories, stance, adjusted WTP, compromise tolerance).
- W3 outputs (per-tier adequacy rates, critical failure rates, personal minimum tier, compromise cost).
- Schema version for forward compatibility.

No raw conversation content in exports. Only aggregate scores and tier results.

## Visual design direction

- Clean, minimal. No heavy framework chrome. The content is dense enough — the UI should get out of the way.
- Muted palette. This is a serious financial decision, not a marketing page.
- High contrast for decision outputs (GO = green, SKIP = neutral gray, not red — "skip" is a valid outcome, not a failure).
- Mobile-responsive but optimized for laptop/desktop. The worksheets have too many columns for comfortable phone use.
- Accessibility: WCAG AA contrast ratios, keyboard navigable, screen reader labels on all interactive elements.

## Tech stack considerations

Defer final stack choice to SPEC-001. Candidates:
- Vanilla HTML/CSS/JS with web components (simplest, no build step).
- Preact or Solid (small bundle, reactive state, familiar JSX).
- Svelte (compiled, small output, good for forms-heavy UI).

Criteria: smallest possible bundle, no runtime framework dependency if avoidable, easy GitHub Pages deploy (static output).
