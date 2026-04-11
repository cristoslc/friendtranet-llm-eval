---
title: "GitHub Pages Deployment"
artifact: SPEC-005
track: implementable
status: Ready
author: Cristos
created: 2026-04-11
last-updated: 2026-04-11
type: feature
parent-epic: EPIC-001
linked-artifacts: []
depends-on-artifacts:
  - SPEC-001
  - SPEC-004
addresses: []
swain-do: required
---

# GitHub Pages Deployment

## Problem Statement

The SPA exists locally but isn't accessible to friend group members who need to complete worksheets on their own machines. It needs to be deployed to a URL they can visit without cloning the repo or running a dev server.

## Desired Outcomes

The SPA is live on GitHub Pages at a stable URL. Pushes to `release` branch automatically deploy. Group members can access the tool in their browser and complete the full assessment flow.

## External Behavior

### Inputs

- Push to `release` branch triggers a GitHub Actions workflow.
- SPA build output (static HTML/CSS/JS).

### Outputs

- Live SPA at `https://<org>.github.io/<repo>/` (or custom domain if configured).
- Successful deploy status visible in GitHub Actions.

### Constraints

- GitHub Pages serves static files only — no server-side processing (already satisfied by SPA architecture).
- Build output must be a single directory of static assets (HTML, CSS, JS, JSON).
- Bundled curated conversations (Path 1 data) included in the deploy artifact.
- No secrets in the deployed bundle. API key entry happens at runtime.

## Acceptance Criteria

1. **Given** a push to `release`, **when** the GitHub Actions workflow runs, **then** it builds the SPA and deploys to GitHub Pages.
2. **Given** the deploy succeeds, **when** a user visits the GitHub Pages URL, **then** the SPA loads and the landing page renders correctly.
3. **Given** the deployed SPA, **when** a user completes Worksheets 1 and 2, **then** IndexedDB persistence works identically to local development.
4. **Given** the deployed SPA, **when** a user enters an OpenRouter API key in W3, **then** API calls to OpenRouter succeed (no CORS issues from the GH Pages domain).
5. **Given** a subsequent push to `release`, **when** the workflow re-runs, **then** the previous deployment is replaced with the new build.

## Verification

| Criterion | Evidence | Result |
|-----------|----------|--------|

## Scope & Constraints

**In scope:**
- GitHub Actions workflow file (`.github/workflows/deploy.yml`).
- Build step configuration for the chosen framework.
- GitHub Pages configuration (branch, directory).
- Smoke test: confirm the deployed URL serves the SPA.

**Out of scope:**
- Custom domain setup (can be added later via GitHub Pages settings).
- CDN or caching optimization.
- Analytics or error tracking.

## Implementation Approach

1. **Workflow file:** GitHub Actions workflow triggered on push to `release`. Steps: checkout, install deps, build, deploy to `gh-pages` branch (or use `actions/deploy-pages`).
2. **Build configuration:** ensure the build produces a clean `dist/` or `build/` directory with all static assets and bundled data files.
3. **GH Pages settings:** configure repo to serve from the deploy branch/directory.
4. **Smoke test:** after first deploy, verify the URL loads, W1 renders, and an OpenRouter test call succeeds from the deployed domain.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Ready | 2026-04-11 | | Initial creation. |
