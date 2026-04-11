---
id: SPIKE-001
title: Source and Sample Curated Conversations
type: spike
phase: active
parent-epic: EPIC-001
linked-artifacts:
  - DESIGN-006
  - SPEC-003
created: 2026-04-11
last-updated: 2026-04-11
timebox: 2 hours
---

# Source and Sample Curated Conversations

## Question

Can we assemble 25 curated multi-turn conversations from permissively licensed public datasets that cover the W2 classified content categories well enough for blind capability evaluation?

## Approach

1. **Trove collection:** use swain-search to pull conversation data from LMSYS-Chat-1M (Apache 2.0), WildBench (MIT), and MT-Bench (Apache 2.0). Focus on multi-turn conversations (4+ turns) that match sovereignty-gated content categories.

2. **Category mapping:** tag each candidate conversation against the W2 category taxonomy (household, health, financial, creative, professional, political, etc.). Identify coverage gaps.

3. **Quality filtering:** apply DESIGN-006 quality criteria — multi-turn, contextual dependency, realistic framing, no PII, coherent assistant responses.

4. **Complexity classification:** label each passing conversation as routine/moderate/hard per DESIGN-006 complexity definitions.

5. **Sample selection:** pick 25 conversations targeting the distribution in DESIGN-006's coverage table. For thin categories (health/therapy, intimate, thirdparty, religious), note which ones need Path 3 synthetic supplementation.

6. **Output:** write `src/lib/data/curated-conversations.json` conforming to DESIGN-006's bundle schema.

## Completion gate

- `curated-conversations.json` exists with 20+ conversations (25 target, 20 minimum).
- At least 6 of the 10 W2 categories have at least 1 conversation.
- Each conversation passes DESIGN-006 quality criteria.
- Coverage gap report identifies which categories need synthetic supplementation.

## Findings

### License corrections

The original spec (v9) stated incorrect licenses for some datasets:

- **LMSYS-Chat-1M:** listed as Apache 2.0 but actually requires a custom license agreement that restricts redistribution. **Excluded** from curated samples.
- **WildBench:** listed as MIT but is actually CC-BY-4.0. Still permissive enough for redistribution.
- **MT-Bench:** listed as Apache 2.0 but is actually CC-BY-4.0. Still permissive.

### Results

Assembled **13 conversations** from WildBench (10) and MT-Bench (3). This falls short of the 25 target and 20 minimum.

**Coverage achieved (5 of 10 categories):**

| Category | Count | Source |
|----------|-------|--------|
| household | 4 | WildBench. |
| creative | 3 | WildBench + MT-Bench. |
| professional | 3 | WildBench + MT-Bench. |
| financial | 1 | WildBench. |
| political | 2 | MT-Bench. |

**Coverage gaps (5 categories, 0 conversations):**

- health, intimate, thirdparty, religious, other — no viable candidates in public datasets, as DESIGN-006 predicted.

### Category mapping quality

WildBench conversations were mapped from their native tags (Planning, Creative Writing, etc.) to our W2 sovereignty-gated categories. Some mappings are loose — e.g., "Planning" → "household" includes non-household planning tasks. A manual review pass would improve category accuracy.

### Recommendation

The 13-conversation curated set is a viable starting point for Path 1 (free preview). To reach the 25 target, use Path 3 (synthetic generation via OpenRouter) for the 5 missing categories. This is the design-intended approach per DESIGN-004 and the original spec.

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Active | 2026-04-11 | | Initial creation. |
| Complete | 2026-04-11 | c8e7c17 | 13 conversations sourced. 5 categories covered, 5 need synthetic. |
