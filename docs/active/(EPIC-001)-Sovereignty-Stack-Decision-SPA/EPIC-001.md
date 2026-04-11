---
id: EPIC-001
title: Sovereignty Stack Decision SPA
type: epic
phase: active
parent-vision: VISION-001
created: 2026-04-11
---

# Sovereignty Stack Decision SPA

## Goal

Build and ship the complete decision SPA — from static scaffold through group aggregation — so the friend group can evaluate local LLM hardware purchase with defensible, structured reasoning.

## Children

| Artifact | Title | Phase |
|----------|-------|-------|
| DESIGN-001 | SPA UX & Architecture | active |
| DESIGN-002 | Risk Scorecard Worksheet | active |
| DESIGN-003 | Principle Scorecard Worksheet | active |
| DESIGN-004 | Capability Evaluation Worksheet | active |
| DESIGN-005 | Group Aggregation View | active |
| SPEC-001 | SPA Scaffold & Worksheet 1 (Risk) | draft |
| SPEC-002 | Worksheet 2 (Principle) | draft |
| SPEC-003 | Worksheet 3 (Capability Evaluation) | draft |
| SPEC-004 | Group Aggregation View | draft |
| SPEC-005 | GitHub Pages Deployment | draft |

## Sequencing

1. DESIGN-001 establishes overall UX and architecture. All other designs and specs depend on it.
2. DESIGN-002 through DESIGN-005 can proceed in parallel once DESIGN-001 is complete.
3. SPEC-001 builds the scaffold and W1. SPEC-002 through SPEC-004 layer on sequentially.
4. SPEC-005 ships it after the SPA is functional.

## Constraints

- Static SPA, client-only. No backend.
- All state in IndexedDB and session storage.
- OpenRouter API calls only in W3, user-approved with cost preview.
- Must work for non-technical friend-group members.

## Reference

Build spec: `data/sources/sovereignty-stack-spa-spec-v9.md`.
