# Sovereignty Stack Decision SPA — Build Specification & Reference

**Date:** 2026-04-11
**Audience:** Coding agent implementing the SPA; also serves as LLM reference document for future conversations on this topic.

---

## 1. Purpose

Help a small friend group decide whether to collectively purchase local LLM inference hardware (specifically Mac Studio M3 Ultra class, or smaller alternatives) vs. relying entirely on cloud-based ZDR+DPA API providers for their shared sovereignty-oriented AI stack. The decision must integrate three dimensions — economic risk, values-based sovereignty, and capability adequacy — against hardware TCO across tiers.

The SPA guides each group member through three worksheets independently, then aggregates results into a group decision with defensible, legible justification.

## 2. Background Context (the SPA should explain this to users)

### The sovereignty question
Commercial AI providers (OpenAI, Anthropic, OpenRouter, etc.) process user prompts on their infrastructure. Even with Zero Data Retention (ZDR) commitments and Data Processing Agreements (DPAs), some users prefer or require that certain content never traverse third-party systems. Local hardware running open-weight models is the alternative, at the cost of capital expenditure, operational burden, and usually lower capability ceiling.

### ZDR vs DPA
- **ZDR (Zero Data Retention)** is a technical/operational commitment: the provider does not persistently store your prompts, completions, or metadata past the immediate request. Not a contract; a technical posture.
- **DPA (Data Processing Agreement)** is a legal contract establishing controller/processor roles, purpose limitation, security obligations, subprocessor disclosure, breach notification, and audit rights. Doesn't prevent retention technically; establishes legal consequences for mishandling.
- **Together:** ZDR minimizes surface area, DPA provides recourse. Enterprise-grade posture combines both.
- **For friend-group household PII:** OpenRouter's account-level ZDR + standard ToS is adequate for most realistic threat models. The marginal protection from local hardware over ZDR+DPA is small and concentrated in tail scenarios most people don't face.

### The real decision framework
Hardware vs. API is not a binary technical choice — it's a three-dimensional problem:

1. **Economic dimension:** does the group's combined risk-reduction value + principle-based willingness-to-pay exceed the annual TCO of the hardware tier being considered?
2. **Capability dimension:** does the hardware tier actually run models that are good enough for the work each member would route to it?
3. **Social dimension:** is operational hosting resolved? Is capital structure workable? Is the purchase driven by genuine shared values or one person's preference the group is tolerating?

A purchase is justified only when all three conditions hold. Any single dimension failing is a veto.

### Workload context anchor
The framework was developed from a real ccusage workload profile (42 days, 7.54B tokens, solo user, 89% Opus spend). That profile is an extreme outlier for agentic development work and should NOT be linearly scaled to friend-group usage. Realistic friend-group classified-tier volume is probably 500M–1.5B tokens/month combined, not 5B+. The SPA should remind users that capability and volume estimates default to conservative friend-group patterns unless the user is explicitly a heavy agentic developer.

### Capability floor reality check
"Sovereignty-gated content" usually does NOT require frontier-class reasoning. The value is in having AI assistance at all without sending content to third parties, not in matching Opus-class output quality. Realistic local capability ceilings (Qwen3-Next-80B-A3B, GPT-OSS-120B, Qwen3-235B-A22B) are adequate for household PII, personal notes, routine classified subagents, HouseOps-class task management, civic research, etc. They are NOT adequate for BV-architecture-class novel reasoning, which should route through commercial APIs with sanitization or not happen through AI at all.

### Hardware availability constraint (April 2026)
- **Mac Studio 512GB M3 Ultra:** pulled from Apple Store March 4–6 2026, DRAM shortage; secondary market only, ~$13–16K with elevated scam risk
- **Mac Studio 256GB M3 Ultra:** only available high-RAM SKU, 4–5 month lead time (April orders → August/September delivery)
- **Mac Studio 128GB M4 Max:** available, shorter lead times
- **Mac mini M4 Pro 64GB:** available, entry-level sovereignty floor
- **M5 Ultra expected mid-to-late 2026**, may still cap at 256GB per reporting

## 3. Hardware TCO Reference Table

Apple direct pricing, April 2026, amortized over 36 months + ~$15/mo power/ops. Storage should be ≥2TB to hold multiple quantized model weights + working data.

| Config | Upfront | Monthly TCO | Annual TCO | Capability ceiling |
|---|---|---|---|---|
| Mac mini M4 Pro 64GB 2TB | ~$2,400 | $82 | ~$984 | Qwen3-Next-80B-A3B (tight) |
| Mac Studio M4 Max 128GB 2TB | ~$4,500 | $140 | ~$1,680 | GPT-OSS-120B comfortable |
| Mac Studio M3 Ultra 256GB 2TB | $7,899 | $234 | ~$2,808 | Qwen3-235B-A22B comfortable |
| Mac Studio M3 Ultra 256GB 4TB | $8,499 | $251 | ~$3,012 | Same as above, more storage |
| Mac Studio M3 Ultra 256GB 8TB | $9,699 | $284 | ~$3,408 | Same, abundant storage |
| Mac Studio M3 Ultra 512GB (secondary) | ~$14,000 | $404 | ~$4,848 | Qwen3.5-397B / GLM-5.1 / MiniMax M2.7 |

Add AppleCare+ (~$169) as optional line item.

## 4. Worksheet Specifications

The SPA presents three worksheets sequentially, with gating between them to avoid wasted effort.

### Worksheet 1: Risk Scorecard (quick, no API, individual)

**Purpose:** Quantify expected annual loss from ZDR+DPA provider failure modes, to produce a defensible economic justification for sovereignty through risk mitigation.

**Structure:** For each of 10 threat rows, user estimates probability and impact, SPA computes expected loss.

**Probability anchors (dropdown with midpoints):**
- Effectively never (<0.1% → 0.05%) — "I'd be shocked if this happened"
- Very rare (0.1–1% → 0.5%) — "Happens to someone like me once a career"
- Rare (1–5% → 3%) — "Happens to someone I know once a decade"
- Occasional (5–15% → 10%) — "Happens in my social circle every few years"
- Common (15–40% → 25%) — "I know people it's happened to recently"
- Frequent (>40% → 50%) — "I've had near-misses or direct experience"

**Impact anchors (three parallel scales, user picks highest-severity applicable, SPA uses that as the $ equivalent):**

*Monetary:* Negligible <$100 / Minor $100–1K / Moderate $1–10K / Major $10–100K / Severe >$100K

*Psychological-relational:* Mild discomfort $50–200 / Real distress $500–2K / Violation $2–10K / Betrayal $10–50K / Trauma >$50K

*Third-party (harm to others whose data is in user's pipeline):* None $0 / Minor $500–2K / Real harm $5–50K / Severe harm >$50K

**Threat rows (with suggested hardware-mitigation fraction, user-adjustable):**
1. Persistent-retention breach at ZDR provider (ZDR claim fails, data leaks) — HW prevents 100%
2. Provider employee unauthorized access during session — HW prevents 95%
3. Legal compulsion for live interception targeted at user — HW prevents 90%
4. Provider policy reversal (starts retaining/training) — HW prevents 100%
5. Provider acquisition with less-trusted owner — HW prevents 100%
6. Aggregate metadata exposure (patterns, billing, timing) — HW prevents 60%
7. Correlation/profiling across sessions — HW prevents 80%
8. Supply-chain compromise (cloud-specific) — HW prevents 0% (affects both equally)
9. Cross-tenant data leak (provider infrastructure bug) — HW prevents 100%
10. Insider nation-state compromise of provider — HW prevents 100%

**Computation:** For each row, expected loss = probability × impact × HW prevention fraction. Sum across rows.

**Risk-aversion premium (optional):** User identifies top-2 worst-case rows, applies 1–5× multiplier to reflect risk-aversion beyond pure expected value. SPA recomputes with premium.

**Output:** Annual risk-adjusted expected loss, $/year.

### Worksheet 2: Principle Scorecard (quick, no API, individual)

**Purpose:** Quantify values-based willingness-to-pay for sovereignty independent of realized risk, to capture the non-risk reason people want local hardware.

**Step 1: Define personal classified subset (multi-select checkboxes):**
- Household logistics / partner ops / family PII
- Personal health / medical / therapy / mental-health processing
- Financial records / tax prep / legal drafts
- Intimate / relationship content
- Third-party content held in trust (friends' disclosures, community work)
- Creative work in progress considered personal/unfinished
- Research or professional work under confidentiality obligations
- Religious / spiritual / philosophical reflection
- Political organizing / dissent / sensitive civic work
- Other (free text)

**Step 2: Stance category (single-select radio):**
- Topological sovereignty ("content originating in my perimeter should stay in my perimeter")
- Trust disposition ("I don't want commercial entities with sensitive personal content as baseline")
- Consent obligations ("third parties in my pipeline didn't consent to commercial AI processing")
- Political/infrastructure ("supporting non-commercial infrastructure is a civic act")
- Epistemic/learning ("I want to understand the tech by running it")
- Aesthetic/identity ("aligns with who I want to be, independent of argument")
- Combination (free text)
- None — risk-only

**Step 3: Annual willingness-to-pay slider** ($0–$3,000/year), with calibration prompts:
- "You pay $X/year for music streaming. More or less than that?"
- "You pay $X/year for private email (if applicable)"
- "You'd pay $X once to delete your data from a data broker"
- "You'd spend $X on a donation to a cause you believe in"

Instructions emphasize: "Don't anchor to what you think the hardware costs. Answer what it's worth *to you*."

**Step 4: Compromise tolerance** (single-select, applies reduction to Step 3 value):
- Not at all (0% reduction) — "any subset I can protect is worth protecting"
- Slightly (10%)
- Moderately (25%)
- Significantly (50%) — "if I'm already compromising, why pay for partial?"
- Substantially (75%+) — "if not complete, I'd rather not bother"

**Step 5: Sanity check.** Show "Your final value / 12 = $X/month. Would you actually subscribe at that price?" If user says no, prompt to revise Step 3 down.

**Output:** Adjusted annual WTP value, $/year.

### Worksheet 3: Capability Adequacy Evaluation (API-powered, individual)

**Purpose:** Test whether candidate local-tier models are actually good enough for the user's sovereignty-gated workloads. This is the worksheet that requires an OpenRouter API key and costs real money to run.

**Gating:** Only unlocked if Worksheets 1+2 totals suggest a hardware tier might be justified. Show message: "Your Worksheets 1+2 totals suggest [tier X] might be economically justified. Worksheet 3 tests whether [tier X] is actually capable enough for your work. This will cost approximately $Y in OpenRouter API calls (estimated before running). Proceed?"

**Three entry paths:**

*Path 1 — Curated sample conversations (zero-cost preview):*
SPA ships with 25–30 pre-selected multi-turn conversations drawn from permissively licensed public datasets (LMSYS-Chat-1M Apache 2.0, WildBench MIT, MT-Bench Apache 2.0). Each tagged to match Worksheet 2 content categories. Some categories have thin coverage in public datasets (therapy, intimate, religious) — those lean on Path 3.

User picks 5–10 samples matching their selected Worksheet 2 categories. Samples bundled as static JSON in the SPA.

*Path 2 — User-provided conversations:*
User pastes multi-turn conversation text OR uploads Claude Code session JSONL file (from `~/.claude/projects/`). SPA extracts user turns, strips any PII automatically, confirms with user before use. Best fidelity but highest friction.

*Path 3 — Synthetic conversation generation:*
User describes a task category in 1–3 sentences ("drafting difficult emails to my partner about household logistics"). SPA calls OpenRouter with a frontier model (prefer Opus 4.6 or equivalent via ZDR-attested endpoint) to generate 3 conversations at different complexity levels (routine/moderate/hard), each 8–15 turns with realistic follow-ups, corrections, and context-dependencies.

Generation prompt template included in SPA, cost ~$0.10–0.30 per category. Generated conversations cached in IndexedDB for reuse.

**Candidate model tiers** (OpenRouter model IDs, verify current at runtime):
- Mini: `qwen/qwen3-30b-a3b`
- Small: `qwen/qwen3-next-80b-a3b-instruct`
- Medium: `openai/gpt-oss-120b`
- Large: `qwen/qwen3-235b-a22b`
- Anchor (user's current baseline): `anthropic/claude-opus-4-6` or user-selected frontier model

Only tiers justified by Worksheet 1+2 totals are tested by default, user can override.

**Evaluation runner:**
For each selected conversation, replay user turns sequentially through each candidate tier via OpenRouter. For each user turn, send accumulated context (prior user turns + captured assistant responses from this candidate) and capture the next response. Store all outputs per (conversation, turn, model) tuple.

All calls use the user's OpenRouter API key with account-level ZDR enforcement. Key stored only in browser session storage, never transmitted to any backend. SPA is static/client-only.

**Cost preview:** Before running, show estimated total cost based on conversation count × tier count × average tokens per turn. User approves explicitly.

**Caching:** Results cached by (conversation hash, model ID) in IndexedDB. Re-runs are free. Enables iteration on task catalog without regenerating everything.

**Blind rating UI:**
For each turn in each conversation:
- Display conversation context up to the turn being rated
- Show candidate outputs in random order labeled A/B/C/D (no model identities)
- User rates each on 4-point scale:
  - 4 — Fully adequate (would use as-is)
  - 3 — Usable with minor cleanup
  - 2 — Insufficient but directionally correct
  - 1 — Unusable
- Optional dimension tags: factual accuracy / reasoning depth / tool use / instruction following / format / tone
- Only after rating complete does SPA reveal model identities

**Output:**
Per-tier metrics:
- Adequacy rate (% of turns scoring ≥3)
- Critical failure rate (% scoring 1)
- Weighted adequacy rate (weighted by user-specified task frequency if provided)

**Personal minimum adequate tier:** lowest tier meeting all three:
- Weighted adequacy rate ≥ 80%
- Critical failure rate ≤ 10%
- No critical failures in highest-frequency tasks

If no tier meets threshold: user's sovereignty-gated work isn't well-served by any local option in the tested range. Show this explicitly with options (accept degradation / use cloud escape valve / narrow principled subset).

**Compromise cost field:** for tasks above user's personal minimum tier, user estimates annual volume that would need cloud escape-valve routing, SPA computes OR ZDR API cost.

## 5. Aggregation View

Pulls from all three worksheets across all group members (each member has a private session; aggregation combines anonymized totals).

**Per-member summary (anonymizable):**
- Risk-adjusted value $/year
- Principle WTP $/year
- Personal minimum adequate tier
- Compromise cost $/year

**Group totals:**
- Combined (risk + principle) $/year
- Highest required capability floor across members
- Corresponding tier annual TCO
- Three-dimensional check:
  1. Economic: combined value ≥ tier TCO?
  2. Capability: tier clears group floor?
  3. Social: handled outside SPA, flagged as user confirmation

**Decision output:**
- GO (all three pass) → proceed to capital structure conversation
- SMALLER TIER (economic passes at smaller tier that clears capability floor for most but not all)
- DEFER (capability or economic fails by margin that might shift with more data)
- SKIP (clear fail) → stay on API + Team Premium stack

**Red flags surfaced automatically:**
- One member's scores dominate >70% of total → driver identified, question whether group purchase is right shape
- Risk dominates principle by >3× for most members → decision is really risk-based, name it
- Principle dominates risk by >3× for most members → decision is really values-based, name it
- Nobody clears even mini tier → group isn't serious about this

## 6. Technical Requirements

- **Static SPA, client-only.** No backend, no server-side state, no analytics, no telemetry.
- **State storage:** IndexedDB for conversations, cache, worksheet responses. Session storage for API keys (cleared on tab close). Optional export/import of worksheet state as JSON for user backup.
- **OpenRouter integration:** direct fetch from browser to OR API. User provides key. SPA never transmits key anywhere except OR endpoints.
- **Offline mode:** curated samples and pre-run example outputs bundled so users can experience rating flow before committing API spend.
- **Progressive disclosure:** Worksheets 1+2 fully functional without API key. Worksheet 3 requires key only for Paths 2 and 3 (Path 1 with bundled pre-run outputs works offline).
- **Privacy posture:** no conversations leave browser except to OR (user-approved via their own ZDR account). No cross-user data sharing by default. Aggregation is local computation against imported sibling worksheet JSON exports.

## 7. Group Aggregation Flow

Since SPA is client-only, group aggregation requires members to export their individual worksheet results as JSON files and share them with whoever is running the aggregation view. The aggregator imports multiple sibling JSONs, SPA computes group totals, displays decision output.

Alternative: a shared-secret Matrix room or similar side channel for sharing JSONs. Not SPA's concern.

## 8. Decision Rules (encoded in aggregation view)

A purchase is justified at tier T if and only if:

1. **Economic:** sum of all members' (risk + principle) values ≥ annual TCO of tier T
2. **Capability:** T ≥ highest personal minimum adequate tier across members who plan to use the hardware
3. **Social:** user-confirmed (hosting commitment, capital structure, values alignment)

If 1 and 3 pass but 2 fails → buy smaller tier OR don't buy. Don't buy a tier nobody clears.
If 2 and 3 pass but 1 fails → members don't value sovereignty enough to pay for it. Revise honestly or accept group doesn't want this.
If all three pass → proceed to capital structure conversation (out of SPA scope).

## 9. Scope Boundaries (what SPA does NOT do)

- Does not manage capital structure / ownership splits (downstream conversation)
- Does not handle operational decisions (hosting location, patch cadence, etc.)
- Does not evaluate sanitization workflows (assumed not available as dev overhead)
- Does not replace actual hardware purchase decision — produces justification framework, group still makes the call
- Does not address consent/authorization questions for third-party data (flagged as out-of-scope warning in Worksheet 2)

## 10. Key Prior-Conversation Findings (for LLM context)

- **Friend group, not business:** $1–2K/mo combined budget ceiling; scales most corporate-tier analyses inapplicable
- **No sanitization:** removes hybrid paths where content could be abstracted before hitting cloud
- **Cristos hosts/operates:** social gate 2 (ops willingness) is resolved; decision hinges on risk/principle valuation and capability adequacy
- **Capital structure undetermined:** explicitly out of scope until risk+principle priced properly
- **Workload profile caveat:** Cristos's solo ccusage profile is extreme outlier, should not linearly scale to friend group
- **OpenRouter account-level ZDR:** already enabled, third-party attested, trusted as meeting threat model for most content
- **Tidegate:** open-source reference architecture; reasoning-heavy design work routes to non-classified tier regardless; NOT a runtime control
- **BV architecture work:** out of scope — employer policy governs, not group stack
- **Civic work with named residents:** authorization/consent problem, not technical control problem; separate from stack decision

## 11. Previous Artifacts (superseded by this v9)

- v1: Initial memory-tier framing (64/128/256GB model mapping)
- v2: 512GB Ultra recommendation (pre-availability check)
- v3: Business-scale framing pre-budget-constraint
- v4: First friend-group rewrite
- v5: Full-conversation rewrite with Tidegate as control (incorrect framing)
- v6: Tidegate fully excised (over-correction)
- v7: Tidegate restored as non-classified workload, removed as control
- v8: HouseOps routing corrected to cheap MoE tier
- v9 (this): SPA build spec + full framework

## 12. Data Sources Referenced

- `2026-04-07_sessions.json` ccusage export (authoritative solo workload baseline)
- OpenRouter ZDR documentation + model pricing pages, April 2026
- claude.com/pricing — Team Premium $100/seat annual, April 2026
- Apple Mac Studio configurator + B&H Photo pricing, April 2026
- MacRumors, Tom's Hardware, 9to5Mac, Ars Technica — 512GB Ultra pull reporting (March 4–6, 2026)
- LMSYS-Chat-1M, WildBench, MT-Bench, MT-Eval — public multi-turn evaluation datasets

---

**Implementation note for coding agent:** This spec is the complete decision framework. The SPA's job is to make it legible and actionable for non-technical friend-group members who won't read a document this long. Lean heavily on progressive disclosure, sensible defaults, and guided flows. The worksheets are the product; everything else is context for why they exist and how they connect.
