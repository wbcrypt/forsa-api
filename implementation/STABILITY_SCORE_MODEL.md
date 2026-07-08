# Internal FORSA Stability Score — V1 Model

Phase 14 (Final Case Flow Refinement) replaces the interview-based Household Stability score as the number that actually informs a Case decision. This document is the model's specification: what it computes, from what, and — just as important — what it deliberately does not do.

## The one rule that shapes everything below

**AI must only explain the score, identify risk/positive factors, and suggest meeting questions. AI must never approve or reject.** Nothing in this model, or in the code that implements it (`src/ai/stability-score.util.ts`), ever produces an approve/reject outcome. The actual decision remains a human status transition (`applications.service.ts#transitionStatus`), exactly as it has throughout this platform. This is enforced by construction, not by convention: `computeStabilityScore()` returns a number and a breakdown; `explainStabilityScore()` returns prose. Neither function has a code path that could set `current_status`.

## Why this replaces the interview-based score

The previous model (`household-stability.util.ts`, Phase 2) computed a weighted average of 5 dimensions the AI self-reported after a conversational interview: household stability (35%), financial capacity (25%), academic commitment (20%), **documentation quality (10%)**, AI interview assessment (10%). Two of those — documentation quality and the AI's own interview assessment — are exactly what Phase 14 rules out: *"Do not include documents, enrollment proof, or FORSA history in V1 scoring."* Rather than patch that model, this phase introduces a new one built entirely from structured profile data — the student's and (mostly) the guarantor's own stated financial situation — collected once, not re-derived from an AI's reading of a conversation.

The old module (`household-stability.util.ts`) is untouched and still exists — any application scored under the old system keeps its old number. This is a forward-looking replacement, not a retroactive rewrite.

## When it's computed

Automatically, server-side, the moment the guarantor completes their Financial Responsibility Profile (`guarantors.service.ts#updateMyFinancialProfile` → `recomputeStabilityScore`). This is deliberate: Guarantor Stability is 60% of the score, so computing anything before that data exists would be scoring on the smaller, less decisive half of the picture. It recomputes (not just computes once) every time the guarantor updates their profile, so the number on file always reflects the latest data.

## The four components

| Component | Weight | Computed from |
|---|---|---|
| **Guarantor Stability** | 60% | The guarantor's own Financial Responsibility Profile: employment status, years employed, salary range, home ownership, existing loan burden relative to income. |
| **Household Stability** | 20% | The student's living situation and emergency contact on file, plus the guarantor's marital status and number of dependents. |
| **Payment Capacity** | 15% | The guarantor's estimated disposable income (salary band midpoint − monthly expenses − an estimated loan-service cost) against the estimated total monthly payment for the student's *requested* plan (tuition ÷ plan months + the 30 TND/month administrative fee). |
| **Student Stability Bonus** | 5% | The student's own income, scholarship, and employment status — **a bonus only.** A student with none of these contributes 0 to this component, never a penalty. "Student income is only a bonus, not a requirement" is enforced literally: `scoreStudentBonus()` returns 0 for missing data, and 0 weighted at 5% cannot meaningfully move the overall score. |

Overall score = `guarantorStability × 0.60 + householdStability × 0.20 + paymentCapacity × 0.15 + studentStabilityBonus × 0.05`, each sub-score itself on a 0–100 scale, rounded to 2 decimals.

### Guarantor Stability, in detail

A 100-point allocation: employment status (35 pts: employed/full-time highest, unemployed 0), years employed (up to 20 pts, linear up to a 5-year cap), salary range (25 pts: banded, not exact — highest band scores highest), home ownership (10 pts: owner > family-owned > tenant), and existing-loan burden relative to salary (10 pts: no loans scores full, loans exceeding ~60% of annualized salary score 0).

### Household Stability, in detail

A 100-point allocation across the student's living situation (35 pts — living with family scores highest, reflecting an existing support structure), whether an emergency contact is on file (15 pts — binary), the guarantor's marital status (25 pts — married scores highest, a simplifying V1 assumption about household stability that a future version could refine), and the guarantor's number of dependents (25 pts — a moderate number, 1–3, scores highest; zero is neutral; more than 3 scores lower, reflecting potential financial strain, not a moral judgment).

### Payment Capacity, in detail

This is the only component that depends on the application itself (tuition amount and requested tier), not just profile data. Plan months: **Silver = 10, Gold = 12** — a V1 product assumption (Gold gets a longer, easier term) documented here because it is not derived from any configured policy; a future phase could make this policy-driven instead of hardcoded. The estimated total monthly payment always includes the 30 TND/month administrative fee — the same fee the student acknowledges in the wizard. A guarantor whose disposable income covers 3× or more of that monthly figure scores 100; below 0.5× scores 5 (never 0, to avoid a false sense of "no capacity" from what might just be incomplete data).

### Student Stability Bonus, in detail

Up to 100 points, but weighted at only 5% of the overall — up to 50 pts for having any stated monthly income, 30 pts for a scholarship, 20 pts for part-time or full-time employment status. A student with a full-time job, a scholarship, and stated income scores the full 100 on this component — worth at most 5 points on the overall 0–100 scale.

## The explanation (advisory only)

`explainStabilityScore()` is a deterministic, rule-based generator (V1 — not a live LLM call) that reads the same inputs and the computed breakdown and produces:
- **Risk factors** — triggered by low sub-scores (guarantor stability below 40, payment capacity below 40, household stability below 40, no emergency contact on file).
- **Positive factors** — triggered by high sub-scores (guarantor stability or payment capacity at or above 75/80, any student stability bonus present).
- **Suggested meeting questions** — practical prompts for the reviewer (verify income proof against the stated salary range when guarantor stability is low; discuss the household budget when the guarantor has existing loans or more than 3 dependents).
- **Confidence score** — the percentage of the ~10 profile fields that were actually provided, not a measure of how "good" the Case is. A Case with a high stability score but a low confidence score is telling the reviewer "this looks fine, but based on thin data — confirm it at the meeting."

None of this is stored as a decision. It's rendered in the admin Case Summary tab (`ApplicationDetailPage.tsx`) purely as context for the human reviewer.

## What's deliberately excluded from V1

- **Documents.** No document upload happens during the application at all (Phase 14's own separate requirement); nothing about document status enters this score.
- **Enrollment proof.** University confirmation is a later pipeline stage, not an input here.
- **FORSA history.** No use of `forsa_scores`/`score_events` (the separate, ongoing post-approval FORSA Score engine — see `household-stability.util.ts`'s own note on why the two systems must never be merged) or any prior-application data. Every Case starts this score from zero, based only on what's on file for it right now.

## Verification performed

`src/ai/stability-score.util.spec.ts` — 10 unit tests, covering: the 60% weighting actually dominates (a strong guarantor with zero student data still scores well; a weak guarantor drags the score down even with strong student data), the student bonus is capped and isolated from household stability, an all-null input scores exactly 0, payment capacity correctly reflects both the 30 TND fee and the plan-months difference between Silver and Gold, and the explanation generator never emits approve/reject language.

Live end-to-end: a real guarantor completed their Financial Responsibility Profile via the portal; the score, breakdown, and explanation appeared immediately in the admin Case Summary — same request, no separate sync step, matching the "compute, don't duplicate" pattern this whole engagement has used since the Admin Pipeline / Student Timeline split.
