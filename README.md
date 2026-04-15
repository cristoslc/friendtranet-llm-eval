# Sovereignty Stack Decision SPA

A static, client-only single-page application that helps a small friend group decide whether to collectively purchase local LLM inference hardware or stay on cloud-based ZDR+DPA API providers.

## What it does

The SPA guides each group member through three worksheets, then aggregates results into a group decision:

1. **Risk Scorecard** — quantifies expected annual loss from ZDR+DPA provider failure modes (no API needed).
2. **Principle Scorecard** — captures values-based willingness-to-pay for sovereignty, independent of risk (no API needed).
3. **Capability Adequacy Evaluation** — blind A/B testing of local-tier models against a frontier baseline via OpenRouter (API key required, costs real money).

The decision integrates three dimensions — economic risk, values-based sovereignty, and capability adequacy — against hardware TCO across Apple Silicon tiers (Mac mini M4 Pro through Mac Studio M3 Ultra 512GB).

## Key constraints

- **Static SPA, no backend.** All state lives in IndexedDB and session storage.
- **Privacy-first.** No analytics, no telemetry. API keys stored in session storage only. Conversations never leave the browser except to OpenRouter (user-approved, user's own ZDR account).
- **Progressive disclosure.** Worksheets 1+2 work offline. Worksheet 3 includes bundled sample conversations for zero-cost preview before committing API spend.
- **Friend group scale.** $1-2K/mo combined budget ceiling. Corporate-tier analyses don't apply.

## Data sources

Curated conversations are from WildBench and MT-Bench (CC-BY-4.0), bundled in `src/lib/data/`. Hardware tier RAM requirements are documented in `docs/troves/apple-silicon-model-tier-ram/`.

## Development

```bash
npm install
npm run dev       # dev server on :5173
npm run build     # static build → build/
npx serve build   # preview the static build
```

Stack: SvelteKit 2, Svelte 5, TypeScript, adapter-static. No backend. State lives in IndexedDB.
