---
title: "Retro: UX Iteration and Firefox Debugging"
artifact: RETRO-2026-04-12-ux-iteration-and-firefox-debug
track: standing
status: Active
created: 2026-04-12
last-updated: 2026-04-12
scope: "Post-ship UX iteration on Worksheet 1 (slider redesign, dark mode, margin legends), Firefox memory runaway debugging, Worksheet 3 resilience (parallel eval, partial re-run, truncation surfacing), and reset scopes."
period: "2026-04-11 — 2026-04-12 (continuation session, ~16 commits)"
linked-artifacts:
  - EPIC-001
  - DESIGN-002
  - DESIGN-004
  - SPEC-001
  - SPEC-003
---

# Retro: UX Iteration and Firefox Debugging

## Summary

Second session on the Sovereignty Stack SPA. Previous retro covered building the app from vision through working tests. This session was iteration on the working app: W1 UX redesign, dark mode, layout restructuring, Firefox memory runaway debugging, W3 evaluation resilience, and data-management ergonomics. No new artifacts shipped — all changes landed against existing SPECs. The app is more usable, more robust, and narrower in browser support (Chromium-only by explicit guard).

## Artifacts touched

| Artifact | Title | Change |
|----------|-------|--------|
| SPEC-001 | SPA Scaffold & Risk Scorecard | Implementation updated — slider-based UX, dark mode, sticky 3-panel layout. |
| SPEC-003 | Capability Evaluation | Parallel eval, truncation handling, partial re-run, reset scopes, editable model IDs. |
| DESIGN-002 | Risk Scorecard Worksheet | No artifact edits, but implementation diverged toward slider-based inputs with always-visible descriptions. |
| DESIGN-004 | Capability Evaluation Worksheet | No artifact edits, but implementation gained per-worker progress visualization and mid-turn re-run. |

None transitioned — all stay Active.

## Reflection

### What went well

**Operator-caught UX gaps surfaced real defects early.** The HW mitigation slider resetting to 0% on first dropdown interaction was a bug hiding in the store's `ensureResponse` helper. The operator noticed it immediately on first use and flagged it. Same for "labels aren't aligned with stops" and "summary card looks like part of the form" — these are the kinds of rough edges that only appear under actual human use, not in BDD assertions.

**Browser automation (Claude-in-Chrome) was fast for smoke-testing visual changes.** After each redesign (sticky headers, 3-panel layout, tick alignment, dark mode), a screenshot in Chrome confirmed the change quickly. Faster than asking the operator to verify manually, and the screenshots were legible enough to catch issues in the same turn.

**Live OpenRouter integration caught real-world failures that BDD missed.** The `[No response available]` lookup-mismatch bug, the 2048-token truncation, and the ZDR-unavailable 404 for `qwen3-235b-a22b` were all surfaced by live evaluation, not by the synthetic test suite. Tests verified the code compiled and rendered; only live use verified the backend behavior.

**Incremental, frequent commits kept the feedback loop tight.** Each fix landed in its own commit with a descriptive message. When a change broke something (e.g., the accidentally-committed env symlinks), the fix was a one-commit reversion. No half-finished branches or mixed intents.

**The 3-panel architectural redesign (globals / interaction / explanation) scaled.** Once implemented for W1, applying it to W2, W3, and aggregation was mechanical. The pattern provides clear places for new content: summary goes in the left panel, guidance in the right, form in the middle. Subsequent additions (reset buttons, model overrides, worker progress) each had a natural home.

### What was surprising

**The Firefox "memory balloon" was a Vite HMR bug, not our code.** We went through three rounds of defensive fixes (IDB debouncing, `$state.snapshot`, `structuredClone` fallback, sticky-layout tweaks) before seeing the actual console output. The root cause was Vite's `setupForwardConsoleHandler` trying to forward every console message through an undefined WebSocket — each forward threw, each thrown error got forwarded, 20,000+ retained exception objects. The fix was running `npm run preview` (production build, no HMR). **Always get console output before guessing at root cause** — I should have asked for that 30 minutes earlier.

**Svelte 5 `$state` proxies plus Firefox is a quiet performance pit.** JSON-stringifying a `$state` proxy on every keystroke worked in Chromium but was pathologically slow in Firefox. Switching to `$state.snapshot()` (or `structuredClone`) plus debounced persistence was a real improvement, though it wasn't the root cause of the freeze.

**Model IDs and cache keys have to agree, and the override feature broke that invariant.** When the user overrode a tier's model ID, evaluation stored results under the effective ID, but the blind-rating UI built `labelOrder` from the tier's default ID. Rating UI showed "No response available" because the lookup key didn't match. Easy bug to create, hard to catch without trying it end-to-end.

**Qwen 3.5 releases happened during the session.** The v9 spec referenced `Qwen3.5-397B` as aspirational. During this session, the user shared OpenRouter's live model catalog showing Qwen 3.5 as released (Feb-Mar 2026) with several usable smaller variants. Defaults got updated mid-session.

**The `@const` template-placement rule keeps biting.** Third time this session I hit Svelte 5's `{@const}` must be a direct child of a control-flow block. Each time the fix is to move the binding into the script as `$state` or `$derived`. Worth building muscle memory around.

### What would change

**Get console output at the FIRST report of a browser issue, not the third.** The Firefox debug took multiple iterations of guessing (IDB writes, $state cloning, sticky layout) before I finally asked for the console text. Every iteration before that was wasted effort — and worse, some of the "fixes" (like adding try/catch `console.warn`) would have *made the Vite cascade worse*. Rule: if the user says "it's slow/freezing/broken in X browser", the first request is always "open devtools and share the console."

**Trust `$state.snapshot()` in `.svelte.ts` files earlier.** I went through `JSON.parse(JSON.stringify(...))` → `plainify` helper with fallback chain → eventually `$state.snapshot`. The helper was over-engineering. `$state.snapshot` is built exactly for this use case and is documented. Use it and accept the `.svelte.ts` constraint.

**Build a canary E2E test for the blind rating UI earlier.** The "No response available" bug shipped because UAT and BDD both fell short of actually rendering the rating cards with real eval data. A single canary test that mocks eval results and renders the rating UI would have caught the label-mismatch lookup bug. Principle for next time: the farther a feature is from the default test path, the more it needs its own canary.

**Audit what `git add -A` sweeps in before committing.** The "61 files changed" commit (`1901da2`) had 52 unintended files (symlinks for agent platforms, VSCode config, debug test). A 5-second `git status --short` before committing would have caught it. Rule: when using `git add -A`, always scan the list.

### Patterns observed

**Designs as UX contracts hold up well, except when they under-specify content.** The DESIGN-002 legend reference scale originally listed "Probability anchors" with descriptive labels but not visceral examples for impact scales. The operator flagged the abstract legend as uninformative. The fix was expanding the data model (`impactScales[].levels[].example`) and surfacing the examples in both the legend and the inline slider. Lesson: when writing a design for an informational surface, include the *actual text* the user will see, not just the structural description.

**"X is working in Chrome" ≠ "X is working."** The Firefox memory balloon went unnoticed until the operator tried the app there. Browser guard now refuses non-Chromium browsers explicitly rather than claiming they work — better to fail loud than silently degrade.

**Parallelism needs parallel visualization.** The 4-worker concurrent evaluation was working correctly from day one, but the UI only displayed one current-turn counter, so it looked serial. Operator noticed and asked. Lesson: when a system has N concurrent actors, the UI should have N rows, not a single status line.

**Incremental UX refinement converges fast when the operator has explicit taste.** Operator said "tick labels aren't aligned", "summary card looks like form", "same base color", "label collisions at edges" — each a concrete fix, each applied in one commit. Contrast: retros where operators give vague feedback and the system flounders iterating. This project had a good feedback rhythm.

### README drift

No drift detected. The README describes the app at a high level (three worksheets, client-only, OpenRouter integration) and none of this session's changes invalidated those claims. The "Development — TBD" line could be filled in with the `npm run dev / build / preview` and `node tests/bdd.mjs` commands, but that's enhancement, not drift.

## Learnings captured

| Item | Type | Summary |
|------|------|---------|
| Always request console output before guessing browser bugs | feedback memory | Rule for Firefox/Safari debugging — saves 30+ min of guessing. |
| Use `$state.snapshot()` directly, not JSON round-trip | feedback memory | Extends prior Svelte 5 + IDB memory with cleaner solution. |
| Store lookup keys must use effective IDs when overrides exist | feedback memory | For any feature with override/alias mechanics. |
| `git add -A` needs a `git status` audit first | feedback memory | Prevents accidental env-file commits. |
| Parallel workers need parallel UI rows | feedback memory | When showing concurrent activity, one status line per actor. |
| v9 spec's aspirational model IDs have released | project memory | Qwen 3.5 family is now live on OpenRouter as of Feb-Mar 2026. |

## Next session candidates

- Canary E2E test that mocks eval results and renders the blind rating UI — prevent future lookup-key mismatches.
- Fill out README "Development" section with dev/preview/build/test commands.
- Investigate the real Firefox runtime issue (separate from the HMR cascade) so we can remove the browser guard.
- Wire synthetic conversation generation (Path 3 in W3) — still a placeholder.
- Add complexity filter to the default summary card (today only shows count + combined total).
