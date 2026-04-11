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

## Lifecycle

| Phase | Date | Commit | Notes |
|-------|------|--------|-------|
| Active | 2026-04-11 | | Initial creation. |
