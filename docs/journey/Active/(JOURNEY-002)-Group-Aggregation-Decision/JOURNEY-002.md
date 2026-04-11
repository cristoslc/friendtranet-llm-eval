---
id: JOURNEY-002
title: Group Aggregation & Decision
type: journey
phase: active
parent-vision: VISION-001
created: 2026-04-11
---

# Group Aggregation & Decision

## Overview

After all members complete their individual assessments, one person (likely Cristos) runs the aggregation view by importing everyone's exported JSON files. The SPA computes group totals and produces a structured decision.

## Steps

### 1. Import sibling worksheets

The aggregator imports multiple JSON exports. The SPA validates each file and displays per-member summaries (anonymizable if desired): risk-adjusted value, principle WTP, personal minimum adequate tier, and compromise cost.

### 2. Group totals

The SPA computes combined risk+principle value per year, identifies the highest required capability floor across members, and maps it to the corresponding hardware tier's annual TCO.

### 3. Three-dimensional check

The SPA evaluates all three conditions:

- **Economic:** combined value >= tier TCO?
- **Capability:** tier clears the group's capability floor?
- **Social:** user-confirmed (hosting commitment, capital structure, values alignment). This is a manual checkbox — the SPA cannot evaluate social dynamics automatically.

### 4. Decision output

One of four outcomes:

- **GO** — all three pass. Proceed to capital structure conversation (out of SPA scope).
- **SMALLER TIER** — economic passes at a smaller tier that clears capability floor for most but not all members.
- **DEFER** — capability or economic fails by a margin that might shift with more data or future hardware.
- **SKIP** — clear fail. Stay on API + Team Premium stack.

### 5. Red flag review

The SPA automatically surfaces:

- One member's scores dominating >70% of total (driver identified).
- Risk dominating principle by >3x for most members (decision is really risk-based).
- Principle dominating risk by >3x for most members (decision is really values-based).
- Nobody clearing even mini tier (group isn't serious about this).

### 6. Group discussion

The SPA's job ends at the recommendation. The group discusses, potentially revisits individual worksheets, and makes the call. The SPA provides the framework and the numbers — it does not make the decision.

## Key design constraints

- Aggregation is local computation against imported JSONs. No server, no shared state.
- Per-member data can be anonymized for the group view if members prefer.
- The social dimension is explicitly a manual confirmation, not computed.
