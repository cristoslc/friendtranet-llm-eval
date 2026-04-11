---
id: DESIGN-003
title: Principle Scorecard Worksheet
type: design
phase: active
parent-epic: EPIC-001
created: 2026-04-11
---

# Principle Scorecard Worksheet

## Purpose

Design the UX for Worksheet 2 — the Principle Scorecard. This worksheet captures values-based willingness-to-pay for sovereignty independent of realized risk. It answers: "Even if the risk is low, what would you pay for local control?"

## Layout

Five sequential steps within a single scrollable page. Each step builds on the previous. Steps remain visible (not wizard-style) so the user can see how their earlier answers feed into later ones.

### Step 1: Define personal classified subset

**Multi-select checkbox list.** Each item has a short label and a one-line description.

Categories:
- Household logistics / partner ops / family PII.
- Personal health / medical / therapy / mental-health processing.
- Financial records / tax prep / legal drafts.
- Intimate / relationship content.
- Third-party content held in trust (friends' disclosures, community work).
- Creative work in progress considered personal/unfinished.
- Research or professional work under confidentiality obligations.
- Religious / spiritual / philosophical reflection.
- Political organizing / dissent / sensitive civic work.
- Other (free text input that appears when checked).

Visual treatment: card-style checkboxes, not a plain list. Selected cards get a subtle highlight. Count indicator: "N categories selected."

### Step 2: Stance category

**Single-select radio group.** Each option has a label and a one-sentence framing.

- Topological sovereignty — "Content originating in my perimeter should stay in my perimeter."
- Trust disposition — "I don't want commercial entities with sensitive personal content as baseline."
- Consent obligations — "Third parties in my pipeline didn't consent to commercial AI processing."
- Political/infrastructure — "Supporting non-commercial infrastructure is a civic act."
- Epistemic/learning — "I want to understand the tech by running it."
- Aesthetic/identity — "Aligns with who I want to be, independent of argument."
- Combination (free text).
- None — risk-only.

If "None" selected, Step 3 slider defaults to $0 and the worksheet shortens. Show a note: "Your sovereignty value comes entirely from Worksheet 1 (risk). That's a valid position."

### Step 3: Annual willingness-to-pay

**Slider: $0-$3,000/year** with $50 increments. Current value displayed prominently.

Calibration prompts appear as contextual anchors alongside the slider:
- "You pay ~$X/year for music streaming."
- "You pay ~$X/year for private email (if applicable)."
- "You'd pay ~$X once to delete your data from a data broker."
- "You'd spend ~$X on a donation to a cause you believe in."

Prompts use common defaults ($120 for streaming, $50 for email, $200 for data broker deletion, $100 for donation). Not personalized — they are framing anchors, not calculations.

Instruction text above slider: "Don't anchor to what you think the hardware costs. Answer what sovereignty is worth to you."

### Step 4: Compromise tolerance

**Single-select segmented control.** Each option shows the label, the reduction percentage, and a one-line attitude framing.

- Not at all (0%) — "Any subset I can protect is worth protecting."
- Slightly (10%) — "Small gaps are acceptable."
- Moderately (25%) — "I'd tolerate meaningful gaps."
- Significantly (50%) — "If I'm already compromising, why pay for partial?"
- Substantially (75%+) — "If not complete, I'd rather not bother."

Live update: show the adjusted WTP value immediately. "Your $X/year × (100% - Y%) = $Z/year adjusted."

### Step 5: Sanity check

Card with computed monthly equivalent: "Your final value / 12 = **$X/month**. Would you actually subscribe to a sovereignty service at that price?"

Two buttons:
- **Yes, that feels right** — proceed.
- **No, that's too high** — returns focus to Step 3 slider with a prompt to revise downward. No judgment framing.

## Output summary

Bottom card showing:
- Selected categories count.
- Stance category.
- Raw WTP, compromise reduction, adjusted WTP ($/year).
- Combined W1+W2 total (risk + principle).
- Tier comparison: which hardware tiers are economically justified by the combined total. Tier thresholds:
  - Entry (Mac mini M4 Pro 64GB): ~$984/year.
  - Mid (Mac Studio M4 Max 128GB): ~$1,680/year.
  - High (Mac Studio M3 Ultra 256GB): ~$2,808/year.
  - Max (Mac Studio M3 Ultra 512GB, secondary market): ~$4,848/year.
  Highlighted tier names with checkmarks or x-marks.

## Gate check transition

After W2 completion, the gate check is inline (not a separate page). It reads the combined W1+W2 total and shows one of:

- **Tier(s) justified:** "Your combined risk + principle value ($X/year) justifies [tier names]. Worksheet 3 tests whether those tiers are capable enough for your work. Estimated API cost: ~$Y. Proceed?"
- **No tier justified:** "Your combined value ($X/year) doesn't reach the annual cost of any hardware tier. The math says stay on cloud APIs. You can still explore Worksheet 3 if you're curious, but the economic case isn't there."

The "no tier" message is neutral, not discouraging. This is a valid and useful finding.
