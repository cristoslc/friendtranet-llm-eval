---
id: VISION-001
title: Sovereignty Stack Decision SPA
type: vision
phase: active
created: 2026-04-11
---

# Sovereignty Stack Decision SPA

## What this is

A static, client-only single-page application that helps a small friend group decide whether to collectively purchase local LLM inference hardware or stay on cloud-based ZDR+DPA API providers.

## Why it exists

The group faces a real decision with real money at stake. Hardware vs. API is not a binary technical choice — it is a three-dimensional problem spanning economics, values, and capability. Without structured evaluation, the decision collapses into one person's enthusiasm or another's skepticism. The SPA makes the decision legible, defensible, and grounded in each member's actual risk tolerance, values, and workload needs.

## Core principles

- **Three-dimensional evaluation.** A purchase is justified only when economic, capability, and social conditions all hold. Any single dimension failing is a veto.
- **Individual first, group second.** Each member completes worksheets independently before results aggregate. No anchoring to others' answers.
- **Privacy by architecture.** Static SPA, no backend, no telemetry. API keys in session storage only. Conversations never leave the browser except to OpenRouter under the user's own ZDR account.
- **Progressive disclosure.** Risk and principle worksheets work offline with no API key. Capability evaluation unlocks only when earlier worksheets justify it and costs real money the user explicitly approves.
- **Honest framing.** The SPA surfaces red flags (one member dominating scores, risk vs. principle skew, nobody clearing capability thresholds) rather than steering toward a purchase.

## What success looks like

Each group member walks away understanding their own risk valuation and sovereignty stance. The group has a defensible GO/SMALLER-TIER/DEFER/SKIP decision with clear justification. Nobody feels railroaded. If the answer is "don't buy," that is a valid and useful outcome.

## Hardware context (April 2026)

The decision spans Apple Silicon tiers from Mac mini M4 Pro 64GB (~$984/yr TCO) through Mac Studio M3 Ultra 512GB (~$4,848/yr TCO, secondary market only). The 512GB M3 Ultra was pulled from Apple Store in March 2026 due to DRAM shortage. M5 Ultra expected mid-to-late 2026.

## Scope boundaries

The SPA does not manage capital structure, ownership splits, operational hosting decisions, or sanitization workflows. It produces a justified recommendation. The group still makes the call.
