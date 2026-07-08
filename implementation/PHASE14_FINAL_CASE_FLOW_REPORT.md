# Phase 14 — Final Case Flow Refinement: Implementation Report

The validated final V1 Tuition Facilitation workflow, implemented across all four affected repositories. This report covers what changed, why, what was verified, and what's honestly still open.

## Summary of changes

### 1. The student no longer enters tuition or support amount manually

`programs` gained a `tuition_amount` column (backfilled from `tuition_min`). The student's Apply wizard now shows tuition read-only once a program is selected, loaded from `GET /universities/:id/programs/public` (which now returns `tuition_amount`). The free-text program fallback is gone entirely — a program must be a real, configured selection, because there is otherwise nothing to load a tuition figure from.

Server-side, `applications.service.ts#createForSelf` looks up `programs.tuition_amount` itself and uses that value regardless of anything sent in the request body — verified live by submitting a request with a forged `tuitionAmount: 999999` and confirming the created application still shows the real program tuition (2500 TND). This is an integrity guarantee, not just a UI nicety.

### 2. Requested plan (Silver/Gold), live estimate, and the 30 TND fee

`applications` gained `requested_tier` (the student's preference, distinct from `financing_tier`, which remains the admin's actual decision at approval time — nothing about how tiers are decided changed). Selecting Silver or Gold in the wizard shows: tuition amount, plan structure (Silver = 10 months, Gold = 12 — see `STABILITY_SCORE_MODEL.md` for why this specific split), estimated monthly payment, the 30 TND/month administrative platform fee, and the total. Verified live: selecting Gold for a 6,000 TND program correctly computed 500 TND/month + 30 TND fee = 530 TND total.

### 3. Fee acknowledgment, required

`applications.platform_fee_acknowledged_at` is set only when the student checks *"I understand that FORSA charges 30 TND/month as an administrative platform fee"* — present in French, English, and Arabic. `createForSelf` rejects submission without it, and the pipeline's Stage 1 Completeness Gate now checks for it too (see below).

**Terminology audit:** grepped all three student-facing frontends plus the backend for "loan," "credit" (as a financial-product term, not the payment-method icon or ledger column), "financing company," "interest," and "lender/borrow" before writing any new copy. Zero pre-existing violations found; all new Phase 14 copy avoids these terms by construction ("Tuition Facilitation Plan," "administrative platform fee," never "loan" or "interest").

### 4. No document upload during the application

The Phase 12 document-completeness requirement (4 required uploads before submission) is removed from `createForSelf` entirely, and the Documents step is removed from the wizard (5 steps now: Profile, Financial, Guarantor, Legal Consent, AI Interview). The pipeline's Stage 1 Completeness Gate — which would otherwise block every single new application, since no documents will ever be uploaded digitally again — now checks `requested_tier` and `platform_fee_acknowledged_at` instead of document status.

Paperwork moved to the meeting: student brings CIN only; academic details (university/program/enrollment/tuition) are confirmed by the university, not the student; guarantor brings CIN, employment/income proof, and a signed كمبيالة per FORSA's template. This is reflected in the default `case_meetings.required_documents` list and in the meeting notification emails (migration 017).

### 5. The guarantor's Financial Responsibility Profile — and where the score comes from

Unchanged from Phase 13's Case Management redesign in structure — the guarantor remains part of the same Case File, invited only after the student submits. New this phase: completing the Financial Responsibility Profile now **automatically triggers** the internal FORSA Stability Score computation (`guarantors.service.ts#recomputeStabilityScore`), since Guarantor Stability is 60% of that score. Verified live end-to-end: a real guarantor completed their profile via the portal and the score, breakdown, and AI explanation appeared immediately in the admin Case Summary — same underlying data, no separate sync step.

### 6. Internal FORSA Stability Score V1

Full model specification in the new `STABILITY_SCORE_MODEL.md`. Summary: Guarantor Stability 60%, Household Stability 20%, Payment Capacity 15%, Student Stability Bonus 5% — student income is a bonus only, never a requirement, enforced by the bonus component returning 0 (not a penalty) when absent. Documents, enrollment proof, and FORSA history are not inputs. The AI only explains the score (risk factors, positive factors, suggested meeting questions, a confidence score reflecting profile completeness) — it never sets an approve/reject outcome; that remains a human status transition, completely unchanged.

### 7. Optional "Why are you choosing FORSA?" question

Four options (monthly payments fit my budget / cannot pay upfront / better cash-flow management / other), stored in `applications.forsa_choice_reason`, explicitly analytics-only — never read by any scoring or decisioning code path.

### 8–11. Portal updates, meeting invitation, language support

- **Student portal:** wizard changes above; Application page shows a plain-language "Next Step" and full meeting details (date, time, location, reference, instructions) once one is scheduled.
- **Guarantor portal:** Case Status card (Financial Profile / Meeting checkpoints — no separate Documents checkpoint, since verification now happens at the meeting) and the Financial Responsibility Profile form.
- **Admin dashboard:** Case Summary tab gained a "Case Request" card (requested plan, system-loaded tuition, plan structure, estimated monthly payment, fee acknowledgment) and an "Internal FORSA Stability Score" card (overall score, all 4 sub-scores, risk/positive factors, suggested meeting questions, confidence — clearly labeled advisory-only).
- **University/Finance portals:** no changes were needed — neither reads any of the fields this phase added.
- **Meeting invitations:** both student and guarantor now receive the assigned officer's name (looked up from `users.full_name`) alongside date, time, location, reference number, required attendees, and required paperwork, with an explicit line that originals are verified in person (migration 017).
- **Language support:** all new student-wizard copy (plan selection, fee disclosure/acknowledgment, why-FORSA question) is in French/English/Arabic using the same inline-ternary pattern as the rest of `ApplyPage.tsx`; verified live with a real RTL screenshot (Arabic renders right-to-left correctly, stepper reversed, all new sections translated, zero console errors). While building the guarantor portal's Case Status card, discovered the entire logged-in guarantor portal had a complete `useLocale`/i18n catalog built but **no language switcher anywhere** — every screen was hardcoded French regardless of locale. Added a working EN/FR/AR switcher to the guarantor `Layout.tsx` header and converted the new Case Status/Financial Profile components to use it, verified live (AR click correctly sets `dir="rtl"` and translates the new card). See "Remaining risks" below for what's still not translated.

## Affected repos

| Repo | Changes |
|---|---|
| `forsa-os` | Migrations 016–017; `stability-score.util.ts` (+spec); `createForSelf`/`create` rewritten; pipeline Stage 1 rewritten; `getCaseSummary` extended; guarantor service scoring trigger + case-status wording fix; `universities.service.ts` tuition exposure |
| `forsa-student` | `ApplyPage.tsx` rewritten (plan/fee/no-docs/why-FORSA, Documents step removed); `InterviewPage.tsx` updated for the new fields; `ApplicationPage.tsx`/`ProfilePage.tsx` unchanged from Phase 13 (still correct) |
| `forsa-dashboard` | `ApplicationDetailPage.tsx`'s Case Summary tab extended (Case Request + Stability Score cards) |
| `forsa-guarantor` | `DashboardPage.tsx` Case Status card wording fixed + i18n; `Layout.tsx` gained a working language switcher; `i18n.ts` gained ~30 new keys × 3 languages |

## Tests run

- **Backend:** 198/198 passing (10 new for `stability-score.util.ts`; `applications.service.spec.ts` and `pipeline.service.spec.ts` rewritten for the removed document requirement and new tier/fee-acknowledgment checks — every test that previously asserted document-blocking behavior now asserts the equivalent tier/fee behavior instead, nothing silently deleted).
- **Typecheck:** clean on all 4 repos.
- **6-portal smoke test:** all clean, before and after every redeploy in this phase.

## Browser scenarios verified

1. Program selection auto-loads tuition (6,000 TND for Doctorat en Médecine); no manual tuition field exists anywhere in the wizard.
2. Selecting Gold for that program correctly shows "12 mois / 500 TND mensualité / 30 TND frais / 530 TND total" — the exact arithmetic, live in the browser.
3. Fee acknowledgment checkbox and why-FORSA question render correctly in French; full wizard re-tested in Arabic with correct RTL layout and zero console errors.
4. A crafted `tuitionAmount: 999999` in the raw API request was silently ignored; the created application used the real program tuition.
5. Guarantor invited → accepted → completed Financial Responsibility Profile via the portal → Stability Score (67.00: Guarantor 70, Household 50, Payment Capacity 100, Student Bonus 0) and explanation appeared in the admin Case Summary immediately.
6. Admin Case Summary tab renders the Case Request card, Stability Score card (with risk/positive factors and meeting questions, no approve/reject language), Student/Guarantor Summary cards, and Meeting panel, all in one place.
7. Guarantor portal's new language switcher: AR click sets `dir="rtl"` and correctly translates the Case Status card; zero console errors.

## Remaining risks

1. **Backend-computed `nextAction` strings (student timeline and guarantor case status) are English-only regardless of the viewer's selected locale.** This is a systemic simplification present since Phase 13, not newly introduced — these are single computed sentences returned by the API, not routed through any translation layer. Fully localizing them would mean either branching every string 3 ways server-side or redesigning the response as a translation key + parameters and translating client-side. Flagged here rather than silently shipped as "full language support" — it isn't, for this one specific field, on both the student and guarantor portals.
2. **The pre-existing rest of the guarantor dashboard (student summary card, payment KPIs, payment ledger, FORSA contact card) remains hardcoded French**, unchanged from before this phase. Only the new Case Status/Financial Profile components (built in Phase 13/14) were converted to the i18n system as part of adding the language switcher. Retrofitting the entire pre-existing dashboard is a larger, separate undertaking outside this phase's specific scope.
3. **Plan months (Silver = 10, Gold = 12) are a hardcoded V1 product assumption**, not policy-configurable. Documented explicitly in `STABILITY_SCORE_MODEL.md` as a decision a future phase could make policy-driven instead.
4. **The Stability Score's household-stability sub-model treats "married" as universally more stable than other marital statuses** — a simplifying V1 assumption, not a claim about any individual guarantor's actual situation. Worth revisiting if this ever needs to be defensible to an external auditor.
5. Everything flagged as an open risk in the previous phase's `CASE_MANAGEMENT_ARCHITECTURE.md` (no real guarantor document-upload flow, Stage 3's university-agreement requirement being independent of this fix, etc.) remains open and unaffected by this phase.

## Manual testing instructions

See `MANUAL_TESTING_GUIDE.md`'s updated Scenario B and new Scenario B.5 for the full step-by-step walkthrough: apply as a Bronze student without ever seeing a tuition input field, confirm the plan/fee display and required acknowledgment, submit, invite and complete a guarantor's Financial Responsibility Profile, confirm the Stability Score appears in the admin Case Summary, schedule a meeting and confirm both parties receive matching paperwork instructions, approve, and confirm the Digital Pass updates.
