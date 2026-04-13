---
title: "Render Markdown in W3 Rating Responses"
artifact: SPEC-012
track: implementable
status: Ready
author: Cristos
created: 2026-04-12
last-updated: 2026-04-12
type: enhancement
parent-epic: EPIC-001
linked-artifacts:
  - SPEC-003
  - SPEC-010
  - DESIGN-004
depends-on-artifacts: []
addresses: []
swain-do: required
---

# Render Markdown in W3 Rating Responses

## Problem Statement

W3's blind-rating UI shows candidate responses as plain preformatted text. LLMs reply in markdown — headings, lists, code fences, tables, emphasis — and the rater has to read around the raw syntax. Raw `# heading` and triple-backtick fences muddy the judgment about whether a response is actually adequate, because the noise is from the presentation layer, not the model. Raters end up mentally compiling markdown on every card, which is slow and biases ratings toward shorter responses where the noise is less overwhelming.

## Desired Outcomes

Raters see candidate responses rendered the way the downstream consumer would actually see them. Judging "is this adequate?" becomes a judgment about the content, not a secondary skill of parsing markdown. Ratings stay comparable across candidates because every response is rendered with the same rules. The change is safe — LLM output is not trusted as HTML, so it cannot exfiltrate the API key or run scripts.

## External Behavior

### Inputs

- The existing candidate-response strings in `state.evalResults[key].responses[turnIndex]`.
- No new user-facing controls.

### Outputs

- Each candidate-response card in the blind-rating UI renders its response as HTML derived from markdown: headings, ordered and unordered lists, fenced and inline code, links, emphasis, and tables.
- Existing annotation prefixes injected by the store — `[⚠ Response truncated at max_tokens. ...]`, `[No response — finish_reason: ...]`, `[Error: ...]`, `[Error NNN: ...]` — continue to render readably (either plain or bolded by markdown; the prefix text must survive verbatim so the existing `response.includes(...)` / `startsWith(...)` checks keep working).
- The scrollable `max-height: 240px` container and `overflow-y: auto` stay, so long responses still scroll inside the card.

### Constraints

- LLM output must be sanitized before it hits the DOM. Render via `marked` for markdown-to-HTML conversion, then sanitize with `DOMPurify` before inserting with `{@html}`. Neither library gets skipped.
- Sanitizer config allows the common markdown output tags only: `p`, `br`, `strong`, `em`, `code`, `pre`, `h1..h6`, `ul`, `ol`, `li`, `blockquote`, `a`, `hr`, `table`, `thead`, `tbody`, `tr`, `th`, `td`. Attributes restricted to `href` (on `a`), `align` (on table cells), and `class` (for code highlighting if added later). All other tags and attributes — especially `script`, `iframe`, `style`, and every `on*` event handler — are stripped.
- Links rendered from markdown must open with `rel="noopener noreferrer"` and `target="_blank"` applied by the sanitizer hook, so a model-authored link cannot hijack the tab or access `window.opener`.
- Rendering is a pure string → string transformation. Same input always yields the same output. No network, no state mutation.
- The store's `response` string is unchanged — annotation detection (`response.includes('[⚠ Response truncated')`, `response.startsWith('[No response')`) continues to work against the raw string. HTML rendering happens in the template only.
- Bundle impact: `marked` ~30KB, `DOMPurify` ~5KB gzip. Acceptable for a local-first SPA shipping ~125KB of JS already.

## Acceptance Criteria

1. **Given** a candidate response containing markdown (heading, list, bold, inline code), **when** the rating card renders, **then** the markdown renders as HTML — the rater sees a styled heading, bulleted list, bold text, and monospaced inline code, not the raw `#`, `*`, or backtick characters.
2. **Given** a candidate response containing a fenced code block, **when** the card renders, **then** the code block appears as a `<pre><code>` element with a monospace font and preserved whitespace.
3. **Given** a response containing a markdown table, **when** the card renders, **then** the table renders as an HTML `<table>` with header and body rows.
4. **Given** a response containing a script tag (e.g., `<script>alert(1)</script>`), **when** the card renders, **then** the script tag is stripped and its contents do not execute — sanitizer removes it.
5. **Given** a response containing an image with an `onerror` attribute (e.g., `<img src=x onerror="fetch('https://example.com')">`), **when** the card renders, **then** the `onerror` handler is stripped and no request to `example.com` is made.
6. **Given** a response containing a markdown link, **when** the card renders and the rater clicks it, **then** the link opens in a new tab with `rel="noopener noreferrer"` set (verifiable via `link.rel` in DOM).
7. **Given** a response starting with the truncation marker `[⚠ Response truncated at max_tokens. ...]`, **when** the card renders, **then** the existing "needs re-run" badge still appears (the `response.includes('[⚠ Response truncated')` check on the raw string still matches).
8. **Given** a response that is the empty-response placeholder `[No response — finish_reason: length]`, **when** the card renders, **then** the existing `isEmpty` gate (`response.startsWith('[No response')`) still matches and the "needs re-run" badge shows.
9. **Given** two renders of the same response string, **when** both render, **then** the HTML output is identical (pure function; no per-render randomness).

## Verification

<!-- Populated when entering Needs Manual Test. -->

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**

- Add `marked` and `dompurify` as dependencies.
- A small helper module (e.g., `src/lib/stores/markdown.ts` or co-located in worksheet3 route) that exports `renderSafe(markdown: string): string` combining the two libraries with the allow-list config above.
- Swap the raw-text `{response}` rendering in the W3 rating card for `{@html renderSafe(response)}`.
- Minimal scoped CSS so rendered headings, lists, code blocks, tables look readable inside the 240px scroll container.

**Out of scope:**

- Syntax highlighting inside code blocks.
- Rendering markdown in the conversation context panel (user/assistant turns at the top of the card). That content is already plain user-authored text plus prior assistant responses — a follow-up could apply the same renderer, but this spec limits risk to the blind-rating card.
- KaTeX / MathJax / other math rendering.
- Editing rendered output (responses stay read-only).
- Retroactive re-rendering of responses on disk — the stored string is untouched.

## Implementation Approach

1. `npm install marked dompurify` and their types.
2. Create `src/lib/stores/markdown.ts` exporting `renderSafe(md: string): string`. Implementation: `DOMPurify.sanitize(marked.parse(md), { ALLOWED_TAGS: [...], ALLOWED_ATTR: [...] })` with a `hooks.afterSanitizeAttributes` hook that sets `target="_blank"` and `rel="noopener noreferrer"` on every `<a>`.
3. In `src/routes/worksheet3/+page.svelte`, replace the `{response}` expression inside the candidate response card with `{@html renderSafe(response)}`. Keep the surrounding `<div>` styles unchanged so the scroll container and wrap behavior are preserved.
4. Add scoped CSS (or rely on existing `.card` styles) so headings, lists, code, and tables look reasonable at the card's font size.
5. Tests:
   - Unit test (`tests/spec-012-unit.mjs`) for `renderSafe`: markdown inputs render expected tags; script tags stripped; `onerror` handlers stripped; links gain `rel="noopener noreferrer"`; annotation prefixes survive in the HTML's text content; identical input produces identical output.
   - Puppeteer BDD test (`tests/spec-012.mjs`) covering the rating card: a conversation with markdown in its mocked response renders a `<strong>` (or `<h2>`) in the DOM, and a response containing a script tag does NOT insert a `<script>` element.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-12 | | Initial creation. User-requested UX fix on top of SPEC-003 + SPEC-010 — raw markdown in rating responses was biasing ratings and slowing judgment. |
