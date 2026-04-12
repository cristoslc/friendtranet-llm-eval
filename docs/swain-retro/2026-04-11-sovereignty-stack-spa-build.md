---
title: "Retro: Sovereignty Stack Decision SPA — Full Build"
artifact: RETRO-2026-04-11-sovereignty-stack-spa-build
track: standing
status: Active
created: 2026-04-11
last-updated: 2026-04-11
scope: "Full project initialization through SPEC-003 live verification"
period: "2026-04-11 — 2026-04-11 (single-day build)"
linked-artifacts:
  - VISION-001
  - EPIC-001
  - SPEC-001
  - SPEC-002
  - SPEC-003
  - SPEC-004
  - SPEC-005
  - SPIKE-001
  - DESIGN-001
  - DESIGN-002
  - DESIGN-003
  - DESIGN-004
  - DESIGN-005
  - DESIGN-006
---

# Retro: Sovereignty Stack Decision SPA — Full Build

## Summary

Took a fresh directory with only a transferred v9 spec document to a working, tested SPA in a single session. Shipped the full artifact hierarchy (1 vision, 1 epic, 6 designs, 3 personas, 2 journeys, 5 specs, 1 spike), implemented a SvelteKit static SPA covering all three worksheets plus group aggregation, verified the W3 blind evaluation pipeline against real OpenRouter calls, and landed 165 passing tests across three suites. 14 commits on `trunk`.

## Artifacts

| Artifact | Title | Outcome |
|----------|-------|---------|
| VISION-001 | Sovereignty Stack Decision SPA | Active |
| EPIC-001 | Sovereignty Stack Decision SPA | Active |
| PERSONA-001 | Cristos — Host & Operator | Active |
| PERSONA-002 | Privacy-Principled Member | Active |
| PERSONA-003 | Pragmatic Skeptic | Active |
| JOURNEY-001 | Individual Assessment Flow | Active |
| JOURNEY-002 | Group Aggregation & Decision | Active |
| DESIGN-001 | SPA UX & Architecture | Active |
| DESIGN-002 | Risk Scorecard Worksheet | Active |
| DESIGN-003 | Principle Scorecard Worksheet | Active |
| DESIGN-004 | Capability Evaluation Worksheet | Active |
| DESIGN-005 | Group Aggregation View | Active |
| DESIGN-006 | Curated Conversation Schema | Active |
| SPEC-001 | SPA Scaffold & Risk Scorecard | Ready (implemented) |
| SPEC-002 | Principle Scorecard | Ready (implemented) |
| SPEC-003 | Capability Evaluation | Ready (implemented, live-verified) |
| SPEC-004 | Group Aggregation View | Ready (implemented) |
| SPEC-005 | GitHub Pages Deployment | Ready (implemented) |
| SPIKE-001 | Source and Sample Curated Conversations | Complete (13 conversations) |

## Reflection

### What went well

**Vision-first artifact cascade.** Creating the vision, personas, and journeys before the designs meant every design had a clear anchor in user intent. When DESIGN-002 needed to decide whether to show a warning on Threat 8 (HW prevents 0%), the answer came naturally from the Pragmatic Skeptic persona's need for honest framing — no separate debate needed.

**Designs with concrete content beat abstract designs.** The first pass of DESIGN-002/003/004 described UX patterns without listing the actual questions. The operator caught this and asked for the questions listed verbatim. After embedding the threat rows, impact scales, stance options, and calibration anchors directly into the designs, the downstream SPEC implementation needed almost no additional research — the data tables were already canonical.

**Separate SPIKE for data sourcing kept SPEC-003 clean.** The LMSYS-Chat-1M license turned out to be restrictive (requires custom agreement, not Apache 2.0 as the v9 spec claimed). Isolating dataset research in SPIKE-001 meant SPEC-003 didn't need to be blocked or revised — the spike reported back with findings (WildBench + MT-Bench were usable, 5 of 10 categories covered, the rest need Path 3 synthetic generation as the design already anticipated).

**Live E2E caught a silent Svelte 5 bug.** The BDD tests (110 passing) and UAT (42 passing) both missed the `state_unsafe_mutation` error because they didn't hit the rating UI at the right code path. Only the live OpenRouter test exercised the full flow end-to-end and surfaced that `getOrCreateTurnRating` was mutating state inside a `{@const}` template expression. The rating UI was silently failing to render — no error visible to the user, but the feature was broken.

**Minimal cost live verification.** Selecting the shortest MT-Bench conversation (2 turns) and limiting tiers to Mini + Anchor kept the live test under $0.02 while still exercising the full pipeline: API key handling, cost preview, evaluation runner, IndexedDB caching, randomized blind labels, rating persistence, metrics computation.

### What was surprising

**Svelte 5's event delegation breaks Puppeteer programmatic selects.** Initial UAT attempts to set select values via `page.evaluate` + `dispatchEvent('change')` worked visually but didn't trigger Svelte's handlers. Svelte 5 uses event delegation at the document root, and synthetic events dispatched via JavaScript don't carry the metadata Svelte expects. The fix: use Puppeteer's native `element.select()` which simulates a real user interaction. This took two debugging iterations to identify.

**IndexedDB doesn't accept Svelte 5 `$state` proxies.** The initial `saveW1/saveW2/saveW3` functions passed state objects directly to `dbSet`, which ultimately calls `structuredClone` internally. Svelte 5 state proxies fail this cloning silently — no error thrown, just no data written. The fix was a `JSON.parse(JSON.stringify(state))` round-trip to materialize the plain object. All three stores needed the same fix. This is a real gotcha that isn't documented prominently in Svelte 5's migration guide.

**The brace-expansion `mkdir` foot-gun.** The shell `mkdir -p path/"{a,b,c}"` creates directories literally named `{a,b,c}` (one directory with commas in the name) when the braces are quoted. Happened twice during artifact creation, requiring `git mv` cleanup both times. Pattern: omit quotes when you want brace expansion, use quotes when you want literal braces.

**License claims in the v9 spec were wrong.** The source spec listed LMSYS-Chat-1M as "Apache 2.0" but it actually requires a custom license agreement. WildBench was listed as "MIT" but is CC-BY-4.0. MT-Bench was listed as "Apache 2.0" but is also CC-BY-4.0. All three are permissive enough for a static SPA in practice, but the categorization was wrong. Always verify licenses at the source.

**Folder structure mismatch with swain conventions.** Initial artifacts were created flat in `docs/active/` instead of the per-type structure (`docs/vision/Active/`, `docs/design/Active/`, etc.) that swain expects. The error only surfaced when running index rebuild scripts. Required a one-shot reorganization via `git mv`.

### What would change

**Start with the correct folder structure.** Reading the swain-design definition files *before* creating the first artifact would have saved the reorganization commit. The definition files explicitly state `docs/<type>/<Phase>/(TYPE-NNN)-<Title>/` structure — I should have checked them first rather than defaulting to flat structure.

**Don't trust license claims in legacy docs.** When the v9 spec said "Apache 2.0" for three datasets, take that as an input to verify, not a fact. Spot-checking one license file at the HuggingFace source would have caught the LMSYS issue earlier.

**Svelte 5 + `$state` + IndexedDB needs a story from day one.** The persistence bug wasn't surfaced until UAT because all the W1/W2 tests happened in the same session without a page reload. Any project using Svelte 5 with IndexedDB persistence should have a test that reloads the page and verifies restored state — on day one, not after the full app is built.

**Run tests against live integrations earlier.** The state_unsafe_mutation bug was present from the first W3 commit but didn't surface until live E2E testing. A single canary test that hits the rating UI (even without real API calls) would have caught it. The cost of adding that canary early is much lower than the cost of discovering it via `$0.02` in live API calls.

### Patterns observed

**Designs that list concrete questions/values are more valuable than designs that describe UX patterns.** The difference between "a threat table with probability and impact" and "these 10 threats, these 6 probability anchors, these 3 impact scales with these dollar values" is the difference between needing follow-up work and being implementation-ready.

**Spike → design → spec is a cleaner dependency chain than spec → spike.** When research was needed (curated conversations), spinning up a spike alongside a design (DESIGN-006) let both proceed in parallel without blocking SPEC-003. The spike reported findings, the design codified the schema, the spec referenced both.

**Background agents for commits keep the main thread unblocked.** Every commit in this session was dispatched to a general-purpose agent. Freed up the main context to keep implementing, reduced back-and-forth. The pattern: draft, then hand off the commit with a HEREDOC message and the exact files to stage.

**Operator-in-the-loop for scope choices, autonomous for execution.** The operator made the shape decisions (split W1+W2 into separate specs, add DESIGNs for each worksheet, skip proposed phase for artifacts). Execution within those boundaries was autonomous. This worked well — the operator wasn't a bottleneck for typing code, but nothing surprising-in-direction happened without them.

### README drift

README.md mentions the SPA decision framework, hardware context, and worksheets. No drift detected — the README accurately describes what shipped. The "Development — TBD" section could be updated to note `npm run dev`, `npm run build`, and the test commands (`node tests/uat.mjs`, `node tests/bdd.mjs`, `OPENROUTER_KEY=... node tests/w3-live.mjs`), but that's a minor improvement not a drift issue.

## Learnings captured

| Item | Type | Summary |
|------|------|---------|
| Svelte 5 state proxies fail structuredClone to IndexedDB | feedback memory | JSON round-trip plain objects before persistence. |
| Svelte 5 forbids state mutation in template expressions | feedback memory | Separate pure-read from persist-to-state functions. |
| Puppeteer + Svelte 5 event delegation | feedback memory | Use native `element.select()`, not programmatic dispatchEvent. |
| Swain artifact folder structure | project memory | Always `docs/<type>/<Phase>/`, never flat. |
| Designs need concrete content | feedback memory | List the actual questions/options/values, not just UX patterns. |
| Brace-expansion with quoted shell paths | feedback memory | Quotes break expansion, unquoted braces work. |

## Test results

| Suite | Tests | Status |
|-------|-------|--------|
| UAT (Puppeteer, synthetic) | 42 | All passing |
| BDD (Puppeteer, from designs) | 110 | All passing |
| Live E2E (OpenRouter) | 13 | All passing |
| **Total** | **165** | **0 failures** |

Live E2E verified the actual OpenRouter integration — 2 API calls, ~5KB responses each, full rating UI flow, ~$0.02 total cost.

## Next session candidates

- Curate category remainder via Path 3 synthetic generation (health, intimate, thirdparty, religious, other) — addresses the SPIKE-001 coverage gap.
- Tighten WildBench category mapping — some mappings are loose (e.g., "DC Cinematic Universe" tagged as household) and would benefit from manual review.
- Implement Path 2 (paste/upload conversation) and Path 3 (synthetic generation) entry paths in W3 — currently placeholders.
- Deploy to GitHub Pages and confirm the GH Actions workflow runs cleanly.
- Add `npm` scripts for the test suites so they're one-command runnable.
