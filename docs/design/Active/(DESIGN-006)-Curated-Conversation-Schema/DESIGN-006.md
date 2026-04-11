---
id: DESIGN-006
title: Curated Conversation Schema
type: design
domain: data
phase: active
parent-epic: EPIC-001
linked-artifacts:
  - DESIGN-004
  - SPEC-003
created: 2026-04-11
last-updated: 2026-04-11
---

# Curated Conversation Schema

## Design Intent

**Context:** SPEC-003's Path 1 bundles 25-30 pre-selected multi-turn conversations as static JSON in the SPA. This design specifies the data format, tagging taxonomy, and quality criteria so conversations are usable for blind capability evaluation.

**Goals:** Conversations must be realistic enough that model adequacy ratings transfer to real sovereignty-gated workloads. Each conversation must carry enough metadata for category filtering, complexity sorting, and evaluation cost estimation.

**Constraints:** Only permissively licensed sources (Apache 2.0, MIT, CC-BY). No real PII in curated samples. Conversations must be multi-turn (minimum 4 turns) to test context-dependent reasoning. Must cover the W2 classified content categories with at least 2 conversations per well-represented category.

**Non-goals:** We are not building a general-purpose eval benchmark. Coverage of thin categories (therapy, intimate, religious) is best-effort — those lean on Path 3 (synthetic generation) by design.

## Conversation record schema

Each curated conversation is a JSON object:

```typescript
interface CuratedConversation {
  id: string;                    // stable hash or slug, e.g. "household-budget-003"
  source: {
    dataset: string;             // "lmsys-chat-1m" | "wildbench" | "mt-bench" | "synthetic"
    license: string;             // "Apache-2.0" | "MIT" | "CC-BY-4.0"
    originalId?: string;         // ID in the source dataset, for provenance
  };
  category: string;              // matches a classifiedCategories.id from principles.ts
  complexity: "routine" | "moderate" | "hard";
  summary: string;               // one-line description shown on the card, ≤120 chars
  turns: Turn[];
  metadata: {
    turnCount: number;           // redundant with turns.length, for display without parsing
    estimatedTokens: number;     // total across all turns, for cost estimation
    tags: string[];              // free-form tags for secondary filtering
  };
}

interface Turn {
  role: "user" | "assistant";
  content: string;
}
```

## Bundle format

All curated conversations ship as a single static JSON file at `src/lib/data/curated-conversations.json`:

```typescript
interface ConversationBundle {
  version: 1;
  generatedAt: string;           // ISO 8601 timestamp
  conversations: CuratedConversation[];
}
```

The SPA imports this at build time. No runtime fetch needed.

## Category coverage targets

Target distribution across W2 classified content categories. Categories marked "thin" have limited representation in public datasets and should be supplemented by Path 3 synthetic generation.

| Category ID | Label | Target count | Source coverage |
|-------------|-------|-------------|----------------|
| household | Household logistics / partner ops / family PII | 4 | Good — LMSYS, WildBench have planning/logistics conversations. |
| health | Personal health / medical / therapy | 3 | Thin — medical conversations exist but therapy is sparse. |
| financial | Financial records / tax prep / legal | 3 | Moderate — financial planning conversations available. |
| intimate | Intimate / relationship content | 2 | Thin — public datasets avoid this category. |
| thirdparty | Third-party content held in trust | 2 | Thin — rare in public datasets. |
| creative | Creative work in progress | 3 | Good — writing assistance conversations are common. |
| professional | Research/professional under confidentiality | 3 | Moderate — professional email/doc drafting available. |
| religious | Religious / spiritual / philosophical | 2 | Thin — philosophical conversations exist, religious less so. |
| political | Political organizing / civic work | 2 | Moderate — civic research conversations available. |
| other | Catch-all | 1 | N/A — one general-purpose conversation as baseline. |

**Total target: 25 conversations.** Aim for even complexity distribution within each category (roughly 1 routine, 1 moderate, 1 hard where count allows).

## Quality criteria

A conversation qualifies for inclusion if it meets all of:

1. **Multi-turn:** minimum 4 turns (2 user, 2 assistant). Ideally 8-15 turns.
2. **Contextual dependency:** later turns must reference or build on earlier context. Single-shot Q&A chains don't test what we need.
3. **Realistic task framing:** the user's request should sound like something a real person would bring to an AI assistant for the tagged category.
4. **No PII:** no real names, addresses, phone numbers, or identifiable details. Synthetic or redacted data only.
5. **License compliance:** source dataset license permits redistribution in a static web app.
6. **Coherent assistant responses:** the original assistant turns should be plausible (they serve as context for the blind eval, not as ground truth).

## Complexity classification

- **Routine:** straightforward single-topic request with clear expected output. Example: "Draft a grocery list for this week's meals."
- **Moderate:** multi-step task requiring some reasoning or context integration. Example: "Help me plan a budget for the next quarter given these constraints."
- **Hard:** ambiguous, multi-factor, or emotionally nuanced task requiring judgment. Example: "My partner and I disagree about how to handle a financial situation with a friend. Help me think through it."

## Evaluation flow integration

During blind evaluation (DESIGN-004), the SPA replays only the **user turns** from each conversation through each candidate model. The original assistant turns are discarded — each model generates its own responses. The conversation's `estimatedTokens` field enables cost preview before evaluation runs.
