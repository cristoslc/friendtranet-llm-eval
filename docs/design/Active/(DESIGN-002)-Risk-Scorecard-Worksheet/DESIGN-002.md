---
id: DESIGN-002
title: Risk Scorecard Worksheet
type: design
phase: active
parent-epic: EPIC-001
created: 2026-04-11
---

# Risk Scorecard Worksheet

## Purpose

Design the UX for Worksheet 1 — the Risk Scorecard. This worksheet quantifies expected annual loss from ZDR+DPA provider failure modes to produce a defensible economic justification for sovereignty through risk mitigation.

## Layout

### Introduction panel

Brief explainer (2-3 sentences) on what this worksheet does and why. Link to expand full context on ZDR vs. DPA and the threat model. Users should not need to read the full context to complete the worksheet, but it should be available.

### Threat table

Ten rows, each representing a distinct threat scenario. The table scrolls horizontally on narrow viewports but the primary design targets desktop width.

Each row contains:

| Element | Type | Notes |
|---------|------|-------|
| Threat description | Static text | Short label + expand icon for full description. |
| Probability | Dropdown | Six anchored options with descriptive labels and midpoint values. |
| Impact | Selector | Three parallel scales (monetary, psychological, third-party). User picks highest-severity applicable. SPA uses the $ equivalent. |
| HW mitigation | Slider | Pre-filled with suggested fraction (0-100%). User-adjustable. Tooltip explains what hardware prevents for this threat. |
| Expected loss | Computed | `probability × impact × mitigation`. Updates live as inputs change. |

### Interaction details

**Probability dropdown anchors:**
- Effectively never (<0.1%) — "I'd be shocked if this happened."
- Very rare (0.1-1%) — "Happens to someone like me once a career."
- Rare (1-5%) — "Happens to someone I know once a decade."
- Occasional (5-15%) — "Happens in my social circle every few years."
- Common (15-40%) — "I know people it's happened to recently."
- Frequent (>40%) — "I've had near-misses or direct experience."

**Impact selector:** tabbed or segmented control switching between the three scales. Each scale shows 5-6 severity levels with dollar equivalents. The user selects one level per scale; the SPA takes the maximum across scales as the effective impact value. Visual indicator shows which scale is driving the value.

**Impact scale values:**

*Monetary:*

| Level | Label | $ equivalent |
|-------|-------|-------------|
| 1 | Negligible | $50 |
| 2 | Minor | $550 |
| 3 | Moderate | $5,500 |
| 4 | Major | $55,000 |
| 5 | Severe | $150,000 |

*Psychological-relational:*

| Level | Label | $ equivalent |
|-------|-------|-------------|
| 1 | Mild discomfort | $125 |
| 2 | Real distress | $1,250 |
| 3 | Violation | $6,000 |
| 4 | Betrayal | $30,000 |
| 5 | Trauma | $75,000 |

*Third-party (harm to others whose data is in user's pipeline):*

| Level | Label | $ equivalent |
|-------|-------|-------------|
| 1 | None | $0 |
| 2 | Minor | $1,250 |
| 3 | Real harm | $27,500 |
| 4 | Severe harm | $75,000 |

**HW mitigation slider:** labeled 0-100% with snap points at suggested values. Gray text shows the suggested default. Changing from default shows a small "customized" badge. Reset button returns to suggested value.

### Threat rows

The ten threat scenarios, with short labels, full descriptions (shown on expand), and suggested hardware mitigation fractions:

| # | Short label | Full description | HW prevents |
|---|------------|------------------|-------------|
| 1 | ZDR retention breach | Persistent-retention breach at ZDR provider — ZDR claim fails, data leaks. | 100% |
| 2 | Employee access | Provider employee unauthorized access during session. | 95% |
| 3 | Legal interception | Legal compulsion for live interception targeted at user. | 90% |
| 4 | Policy reversal | Provider policy reversal — starts retaining or training on user data. | 100% |
| 5 | Hostile acquisition | Provider acquisition with less-trusted owner. | 100% |
| 6 | Metadata exposure | Aggregate metadata exposure — usage patterns, billing, timing. | 60% |
| 7 | Session profiling | Correlation and profiling across sessions. | 80% |
| 8 | Supply-chain compromise | Supply-chain compromise (cloud-specific). Affects both cloud and local equally. | 0% |
| 9 | Cross-tenant leak | Cross-tenant data leak from provider infrastructure bug. | 100% |
| 10 | Nation-state insider | Insider nation-state compromise of provider. | 100% |

Row 8 is notable — it's the only threat where hardware provides zero protection. The SPA should surface this explicitly so users understand the limits of local hardware.

### Risk-aversion premium

Below the threat table. Optional section, collapsed by default.

- User selects their top-2 worst-case rows from the table (click to highlight).
- Per-row multiplier slider: 1x-5x.
- Live recomputation of total with premium applied.
- Framing text: "If you're more worried about worst cases than averages, apply a multiplier to the scenarios that concern you most."

### Output summary

Sticky footer or bottom card showing:
- Total annual risk-adjusted expected loss ($/year).
- Breakdown: base expected loss + risk-aversion premium.
- Visual comparison to hardware tier annual TCOs (horizontal bar or simple table):
  - Entry (Mac mini M4 Pro 64GB): ~$984/year.
  - Mid (Mac Studio M4 Max 128GB): ~$1,680/year.
  - High (Mac Studio M3 Ultra 256GB): ~$2,808/year.
  - Max (Mac Studio M3 Ultra 512GB, secondary market): ~$4,848/year.

## Empty state

All probabilities default to unselected. Impact defaults to unselected. HW mitigation defaults to suggested values. The output summary shows $0 until the user makes selections, with a prompt: "Select probability and impact for at least one threat to see your risk estimate."

## Completion criteria

W1 is complete when at least one threat row has both probability and impact selected. The user can proceed to W2 with partial completion — not all 10 rows need answers. Unanswered rows contribute $0 to the total. A subtle indicator shows how many rows are answered (e.g., "7 of 10 threats assessed").
