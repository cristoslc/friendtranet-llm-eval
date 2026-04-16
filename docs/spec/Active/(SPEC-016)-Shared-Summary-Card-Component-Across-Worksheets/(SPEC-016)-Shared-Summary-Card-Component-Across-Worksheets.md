---
title: "Shared Summary Card Component Across Worksheets"
artifact: SPEC-016
track: implementable
status: Active
author: Cristos
created: 2026-04-16
last-updated: 2026-04-16
type: enhancement
parent-epic: EPIC-001
linked-artifacts:
  - DESIGN-001
  - DESIGN-002
  - DESIGN-003
  - DESIGN-004
  - DESIGN-005
depends-on-artifacts: []
addresses: []
swain-do: required
---

# Shared Summary Card Component Across Worksheets

## Problem Statement

Each worksheet page (W1, W2, W3) and the Group Aggregation page hand-codes its own summary-card in the left `title-panel` aside. The visual treatments differ: W1 shows risk-only `HardwareTierBars`, W2 shows combined `HardwareTierBars` plus a text-only gate check with badges in the main column, W3 shows selection counts plus `HardwareTierBars`, and the aggregation page shows a count-plus-totals card without `HardwareTierBars` at all. These inconsistencies mean the user sees a different tier-comparison picture depending on which page they are on, and page-specific rendering logic is scattered across four page files instead of living in one shared component.

## Desired Outcomes

A single `SummaryCard` Svelte component renders the left-panel summary for every worksheet and the aggregation page. All pages share the same visual treatment: value display, risk/principle breakdown, and `HardwareTierBars` comparing combined value against tier TCOs. Each page passes its context via props; the component owns the layout, the breakdown, and the tier bars. No page hand-codes its own summary-card markup.

## External Behavior

### New component: `SummaryCard.svelte`

A reusable Svelte component in `$lib/components/` that renders the full summary-card:

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Primary heading (e.g., "Your risk estimate", "Your WTP", "Selection") |
| `value` | `number` | The primary $/yr figure to display in `.big-value` |
| `valueSuffix` | `string` | Suffix after the value (default: "/yr") |
| `breakdown` | `Array<{ label: string; value: number }>` | Zero or more breakdown lines shown as `.small-note` entries |
| `combinedLabel` | `string \| null` | If provided, renders a "Combined" section with this label (e.g., "Combined (W1 + W2)") |
| `combinedValue` | `number \| null` | Combined $/yr for the tier comparison (defaults to `value` if null) |
| `combinedBreakdown` | `Array<{ label: string; value: number }> \| null` | Breakdown for the combined line |
| `tierValue` | `number` | The value passed to `HardwareTierBars` (the annual $ to compare against TCOs) |
| `tierHeading` | `string` | Heading above the bars (default: "vs. hardware cost") |
| `extra` | `Snippet \| null` | Optional slot for page-specific content below the bars (e.g., W3 reset buttons) |
| `emptyMessage` | `string \| null` | Message to show when no data is available (suppresses value + bars) |

**Rendering rules:**

- When `emptyMessage` is set, show only the message (suppressed value, breakdown, bars).
- Otherwise, show `label` heading, `value` in `.big-value`, then each `breakdown` entry.
- If `combinedLabel` is set, render a second heading with `combinedLabel`, `combinedValue` in 1.1rem bold, and `combinedBreakdown` entries.
- Always render `HardwareTierBars value={tierValue} heading={tierHeading}`.
- If `extra` snippet is provided, render it below the bars.

### Page-specific usage

**W1 (Risk Scorecard):**

- `label="Your risk estimate"`, `value=computeTotalLoss()`, `valueSuffix="/year"`.
- `breakdown` includes base + premium when premium > 0.
- `combinedLabel="Combined (W1 + W2)"` when `computeAdjustedWtp() > 0` (null otherwise).
- `combinedValue=computeTotalLoss() + computeAdjustedWtp()`.
- `combinedBreakdown` shows "Risk + principle".
- `tierValue=computeTotalLoss() + computeAdjustedWtp()`.
- `emptyMessage` shown when `completedRowCount() === 0`.
- W1 now loads W2 data on mount so `computeAdjustedWtp()` is available.

**W2 (Principle Scorecard):**

- `label="Your WTP"`, `value=computeAdjustedWtp()`, `valueSuffix="/yr"`.
- `breakdown` includes raw + monthly.
- `combinedLabel="Combined (W1 + W2)"`, `combinedValue=combinedTotal`.
- `combinedBreakdown` shows "Risk + principle".
- `tierValue=combinedTotal`.
- `emptyMessage` shown when WTP = 0 and stance is not "none".
- W2 already loads W1 on mount; no change needed.

**W3 (Capability Evaluation):**

- `label="Selection"`, `value=selectedConversations.length` (as count, not dollars — `valueSuffix` = " conversations").
- `breakdown` includes tier count.
- No combinedLabel (W3 does not add a new value dimension).
- `tierValue=combined` (existing combined from W1+W2, already computed in W3).
- `extra` snippet renders the W3 reset buttons.

**Aggregation (Group):**

- `label="Imported"`, `value=members.length` (count, `valueSuffix=" members"`).
- `combinedLabel="Group total"`, `combinedValue=groupCombinedTotal()`.
- `combinedBreakdown` shows "Risk + principle".
- `tierValue=groupCombinedTotal()`.
- Add `HardwareTierBars` to the aggregation summary-card (currently missing).

### Tier info tooltips on HardwareTierBars

- Each tier row in `HardwareTierBars` shows an info icon (ℹ or similar) next to the tier label.
- Hovering or focusing the icon shows a tooltip with the tier's hardware config, upfront cost, and annual TCO.
- The tooltip uses a native `title` attribute or a small CSS tooltip component (accessible, no JS dependency).
- Tooltip content format: `Mid — Mac Studio M4 Max 128GB 2TB — $4,500 upfront / $1,680/yr TCO`.

### NVIDIA DGX Spark tier

- Add a new hardware tier for the **NVIDIA DGX Spark** (GB10 Grace Blackwell, 128GB unified memory, 4TB SSD).
- Upfront: ~$4,699. Annual TCO: ~$1,649 ($4,699 / 36mo + ~$35/mo power/ops at 240W).
- Capability ceiling: ~200B params at FP4; 70B params at FP16 comfortable (128GB unified, 273 GB/s bandwidth — slower than Apple Silicon but more VRAM than Mid tier).
- Same 128GB RAM class as Mid (Mac Studio M4 Max 128GB). Positioned after Mid, before High — same tier order as TCO ascending. The DGX Spark trades Apple's memory bandwidth for CUDA ecosystem access and FP4 inference at ~200B params.
- Tier id: `nvidia-spark`. Label: `DGX Spark`. Config: `NVIDIA DGX Spark GB10 128GB 4TB`.

### Gate check removal from W2 main column

- The W2 gate check `decision-card` in the main column (lines 203-228) is **redundant** now that the summary-card shows the same tier justification via `HardwareTierBars`. Remove it. The summary-card in the left panel is the single source of truth for tier justification.

## Acceptance Criteria

1. **Given** any worksheet page (W1, W2, W3), **when** the left panel summary-card renders, **then** it uses the shared `SummaryCard` component with `HardwareTierBars` showing the combined value compared to tier TCOs.
2. **Given** W1 with risk $600/yr and principle WTP $400/yr, **when** viewing W1's summary-card, **then** `HardwareTierBars` shows bars relative to $1,000/yr (combined).
3. **Given** W2 with risk $600/yr and principle WTP $400/yr, **when** viewing W2's summary-card, **then** `HardwareTierBars` shows bars relative to $1,000/yr (combined) — same visual treatment as W1.
4. **Given** the aggregation page with 2 members imported, **when** the summary-card renders, **then** `HardwareTierBars` shows bars relative to the group combined total.
5. **Given** W1 with risk $600/yr and principle WTP $0, **when** viewing the summary-card, **then** `HardwareTierBars` shows bars relative to $600/yr and no "Combined" section appears.
6. **Given** W2 page, **when** the main column renders, **then** the gate check `decision-card` is removed (tier justification is shown solely in the summary-card).
7. **Given** W3 page, **when** the summary-card renders, **then** the W3 reset buttons appear below the `HardwareTierBars` in the `extra` snippet.
8. **Given** the `SummaryCard` component, **when** `emptyMessage` is set, **then** only the empty message renders (no value, no bars).
9. **Given** any page, **when** comparing the summary-card across W1, W2, W3, and aggregation, **then** the `HardwareTierBars` visual treatment is identical: same bar heights, same fill colors, same tier labels and amounts.
10. **Given** any `HardwareTierBars` row, **when** the user hovers or focuses the info icon next to the tier label, **then** a tooltip appears showing the tier's hardware config, upfront cost, and annual TCO.
11. **Given** the `HardwareTierBars` component, **when** five tiers are defined (Entry, Mid, DGX Spark, High, Max), **then** five rows render with the DGX Spark row positioned after Mid (same 128GB RAM class, lower TCO than High).
12. **Given** the DGX Spark tier, **when** the tooltip renders, **then** it shows "NVIDIA DGX Spark GB10 128GB 4TB — $4,699 upfront / $1,649/yr TCO".
13. **Given** a combined value of $1,680/yr, **when** the tier bars render, **then** the Mid tier bar fills to 100% (justified) and the DGX Spark tier bar fills to ~102% (also justified).

## Verification

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**
- New `SummaryCard` Svelte component with the props described above.
- Refactor W1, W2, W3, and aggregation pages to use `SummaryCard`.
- W1 loads W2 data on mount for combined value.
- Remove W2 main-column gate check `decision-card` (redundant with summary-card `HardwareTierBars`).
- Add `HardwareTierBars` to aggregation summary-card.
- Add info-icon tooltip to each `HardwareTierBars` row showing config, upfront, and TCO.
- Add NVIDIA DGX Spark as a new hardware tier in `tiers.ts`.

**Out of scope:**
- Persisting a display name preference for the aggregation auto-load (SPEC-017).
- Adding new breakdown dimensions (e.g., per-threat in the summary-card).
- Changing the W3 main-column results table or rating UI.

## Implementation Approach

1. **Create `SummaryCard.svelte`:** Extract the common summary-card pattern into a new component. The `.summary-card` CSS class stays in `app.css`; the component renders the markup that uses it. Takes props as described; renders `HardwareTierBars` internally.
2. **Add DGX Spark tier:** In `tiers.ts`, insert a `HardwareTier` entry for DGX Spark (`id: 'nvidia-spark'`) between Mid and High. Upfront $4,699, annual TCO ~$1,649, capability ceiling "~200B params FP4; 70B FP16 comfortable".
3. **Add tooltip to `HardwareTierBars`:** Add an info icon (using Unicode ℹ or a small SVG) next to each tier label. On hover/focus, show a CSS tooltip or native `title` with config + upfront + TCO. Style the tooltip to match the app's design system.
4. **Refactor W1:** Import `SummaryCard`, `loadW2`, `computeAdjustedWtp` from W2 store. Replace the inline summary-card markup. Pass combined value as `tierValue`.
5. **Refactor W2:** Import `SummaryCard`. Replace inline summary-card markup. Remove the gate check `decision-card` from main column (lines 203-228).
6. **Refactor W3:** Import `SummaryCard`. Replace inline summary-card markup. Pass reset buttons as `extra` snippet.
7. **Refactor aggregation:** Import `SummaryCard`. Replace inline summary-card markup. Pass `tierValue=groupCombinedTotal()`.
8. **Verify:** Visual consistency across all four pages. Edge cases: no data, partial data (W1 only, no W3), full data. Tooltip appears and dismisses correctly on hover/focus/blur.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Active | 2026-04-16 | | Initial creation. Replaces per-page summary-card bug fix with shared component. |