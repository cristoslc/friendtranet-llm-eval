---
id: JOURNEY-001
title: Individual Assessment Flow
type: journey
phase: active
parent-vision: VISION-001
created: 2026-04-11
---

# Individual Assessment Flow

## Overview

A single group member completes the three worksheets in sequence. Each worksheet gates the next to avoid wasted effort and unnecessary API spend.

## Steps

### 1. Landing & context

The member arrives at the SPA. A brief explainer covers the sovereignty question, ZDR vs. DPA, the three-dimensional decision framework, and why the group is doing this. No API key needed yet.

### 2. Worksheet 1 — Risk Scorecard

Ten threat rows, each with probability and impact estimates. Probability uses anchored dropdowns ("I'd be shocked if this happened" through "I've had near-misses"). Impact uses three parallel scales (monetary, psychological-relational, third-party harm). The SPA computes expected annual loss with hardware mitigation fractions. Optional risk-aversion premium on top-2 worst-case rows.

**Output:** annual risk-adjusted expected loss, $/year.

### 3. Worksheet 2 — Principle Scorecard

Define personal classified subset (multi-select). Pick a sovereignty stance category. Slider for annual willingness-to-pay with calibration prompts anchored to real spending. Compromise tolerance adjustment. Sanity check: "Your value / 12 = $X/month. Would you actually subscribe at that price?"

**Output:** adjusted annual WTP, $/year.

### 4. Gating check

SPA combines Worksheet 1+2 totals. If no hardware tier is economically justified, the member sees this clearly and can stop. No pressure to continue. If a tier is justified, Worksheet 3 unlocks with a cost preview.

### 5. Worksheet 3 — Capability Adequacy Evaluation

Three entry paths: curated samples (free), user-provided conversations, or synthetic generation (costs money). The member picks conversations matching their sovereignty-gated categories. The SPA replays them through candidate model tiers via OpenRouter. Blind rating UI — no model identities shown until after scoring.

**Output:** personal minimum adequate tier, adequacy rates, critical failure rates.

### 6. Export

The member exports their worksheet results as JSON for group aggregation.

## Key design constraints

- Worksheets 1+2 work offline with no API key.
- Worksheet 3 shows estimated API cost before running and requires explicit approval.
- All state lives in IndexedDB and session storage. Nothing leaves the browser except OpenRouter API calls.
- The flow should take 15–30 minutes for Worksheets 1+2, plus variable time for Worksheet 3 depending on how many conversations the member evaluates.
