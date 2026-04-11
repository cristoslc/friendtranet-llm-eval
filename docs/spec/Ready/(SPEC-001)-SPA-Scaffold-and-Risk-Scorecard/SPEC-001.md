---
title: "SPA Scaffold & Risk Scorecard"
artifact: SPEC-001
track: implementable
status: Ready
author: Cristos
created: 2026-04-11
last-updated: 2026-04-11
type: feature
parent-epic: EPIC-001
linked-artifacts:
  - DESIGN-001
  - DESIGN-002
depends-on-artifacts: []
addresses: []
swain-do: required
---

# SPA Scaffold & Risk Scorecard

## Problem Statement

The friend group needs a tool to evaluate local LLM hardware purchases, but no application exists yet. This spec bootstraps the SPA and delivers the first worksheet so users can begin quantifying their risk exposure immediately.

## Desired Outcomes

Group members can load the SPA in a browser, understand the sovereignty question through a brief explainer, and complete Worksheet 1 to produce an annual risk-adjusted expected loss figure. All state persists across sessions via IndexedDB. No backend, no API key needed.

## External Behavior

### Inputs

- User selections for each of 10 threat rows: probability (6-option dropdown), impact (3-scale selector), and HW mitigation fraction (slider, pre-filled with defaults).
- Optional risk-aversion premium: top-2 worst-case row selection + 1-5x multiplier per row.

### Outputs

- Per-row expected loss: `probability_midpoint × impact_dollar_equivalent × mitigation_fraction`.
- Total annual risk-adjusted expected loss ($/year), with and without risk-aversion premium.
- Visual comparison of total against four hardware tier annual TCOs.

### Preconditions

- Static SPA served from local dev server or file:// protocol.
- Modern browser with IndexedDB support.

### Constraints

- Per DESIGN-001: static SPA, client-only, no backend, no telemetry.
- Per DESIGN-001: state lives in IndexedDB. Session storage reserved for API key (later specs).
- Per DESIGN-001: tech stack decision made here. Choose between vanilla web components, Preact, Solid, or Svelte based on smallest bundle + easiest GH Pages deploy.
- Per DESIGN-002: all probability anchors, impact scales, threat rows, and mitigation defaults must match the spec exactly (see DESIGN-002 for canonical values).

## Acceptance Criteria

1. **Given** a user loads the SPA, **when** the landing page renders, **then** they see a brief sovereignty explainer with an expandable ZDR vs. DPA section and a "Begin assessment" button.
2. **Given** a user enters Worksheet 1, **when** the threat table renders, **then** all 10 threat rows display with the correct short labels, expandable descriptions, and default HW mitigation fractions from DESIGN-002.
3. **Given** a user selects probability and impact for a threat row, **when** the values change, **then** the expected loss for that row updates live (no submit button).
4. **Given** a user has completed at least one threat row, **when** they view the output summary, **then** it shows the total expected loss and a tier comparison against Entry ($984/yr), Mid ($1,680/yr), High ($2,808/yr), and Max ($4,848/yr).
5. **Given** a user opens the risk-aversion premium section, **when** they select 2 rows and set multipliers, **then** the total updates to include the premium and shows the breakdown (base + premium).
6. **Given** a user closes and reopens the SPA, **when** Worksheet 1 loads, **then** all previous selections are restored from IndexedDB.
7. **Given** a user completes W1, **when** they click "Next," **then** the SPA navigates to Worksheet 2 (placeholder until SPEC-002).
8. **Given** a user has not selected probability and impact for any row, **when** they view the output summary, **then** it shows $0 with the prompt "Select probability and impact for at least one threat to see your risk estimate."

## Verification

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**
- Tech stack selection and project scaffolding (build tool, dev server, directory structure).
- Landing page with sovereignty explainer.
- Worksheet 1 complete implementation per DESIGN-002.
- IndexedDB persistence layer (shared infrastructure for all worksheets).
- Progress stepper in the shell (shows W1 active, W2/W3/Export as future steps).

**Out of scope:**
- Worksheet 2 content (SPEC-002). W2 route exists as a placeholder.
- Worksheet 3 and OpenRouter integration (SPEC-003).
- Group aggregation (SPEC-004).
- Deployment (SPEC-005).
- Mobile optimization beyond basic responsiveness.

## Implementation Approach

1. **Stack decision:** evaluate Svelte vs. Preact vs. vanilla. Prioritize smallest bundle and zero-config GH Pages. Scaffold with chosen tool.
2. **IndexedDB layer:** build a thin persistence wrapper (worksheets store, settings store). Test with W1 save/restore cycle.
3. **Shell component:** header with progress stepper, main content slot, footer. Route between landing, W1, W2 placeholder.
4. **Landing page:** sovereignty explainer content, expandable ZDR/DPA section, begin button.
5. **W1 ThreatTable:** render 10 rows from a data file (not hardcoded in markup). Each row: probability dropdown, impact selector, mitigation slider, computed expected loss.
6. **W1 output summary:** sticky footer with total, premium, tier comparison bars.
7. **Persistence integration:** auto-save on input change, restore on load.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-11 | | Initial creation. |
