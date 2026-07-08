# User Experience Workflows

What each role actually sees and does, end to end. Written from the Case Management redesign (Phase 13) forward — see `CASE_MANAGEMENT_ARCHITECTURE.md` for the data model and API behind these journeys, and `FORSA_OPERATIONS_MANUAL.md` for the full operational reference.

## Student

**Framing:** the student is applying for a Tuition Facilitation Plan — never "upgrading." Silver/Gold is a decision the admin makes later; the student's job is to give FORSA a complete picture, not to pick a tier.

1. **Bronze Membership** — self-registers or is provisioned by staff. No application exists yet.
2. **Apply for Tuition Facilitation** — clicks through from the Dashboard checklist. This is a client-side wizard; nothing is saved to the server as a "draft" until the final submit (see `CASE_MANAGEMENT_ARCHITECTURE.md` on why a stored Draft Case was deliberately rejected). **Updated in Phase 14 (Final Case Flow Refinement)** — the validated final V1 workflow:
   - **Your Profile** — personal + academic info (university, program — a real selection, no free-text fallback; academic year). **Tuition is never typed** — selecting a program shows its tuition read-only, loaded from FORSA's own program configuration. Also here: **requested plan** (Silver or Gold — a preference, not a decision), a live display of plan structure/estimated monthly payment/the 30 TND/month administrative fee/total, a required fee-acknowledgment checkbox (FR/EN/AR), and an optional "Why are you choosing FORSA?" question (analytics only, never scored).
   - **Financial Situation** — payment responsibility, household income, employment, guarantor question.
   - **Guarantor** — name, email, relationship. The invitation is sent only after final submission, never before.
   - **Legal Consent.**
   - **AI Readiness Interview** — kept for qualitative context; no longer what produces the score that actually informs the decision (see below).
3. **Submit** — rejected outright, with a specific message, if any required field, the plan selection, or the fee acknowledgment is missing. **No document is uploaded here at all** — CIN (student) and CIN/income proof/كمبيالة (guarantor) are verified in person at the activation meeting instead. On success: the application is created (with tuition looked up server-side, never trusted from the client) and the guarantor invitation is sent immediately after.
4. **Profile page (Case Management addition)** — the student can complete/update their fuller financial and personal profile at any time: employment status, monthly income, scholarships, existing loans, other commitments, living situation, emergency contact. This is part of the same Case FORSA is evaluating — it doesn't need to happen only inside the wizard.
5. **Application page** — always shows:
   - **Case Status / Progress** — the 8-milestone Student Timeline (Application Started → Application Submitted → Documents Verified → Guarantor Status → Under Review → Decision → University Confirmation → Active Student), in plain language. Never an internal term like "capital_queue" or "more_info_required."
   - **Next Required Action** — one sentence telling the student exactly what to do next (invite a guarantor, wait for review, attend a scheduled meeting, nothing — you're active).
   - **Meeting details**, once one is scheduled: date, time, location, reference number, instructions.
6. **Decision** — if rejected, reassurance copy (Bronze stays intact, a working "Apply Again" button) — rejection is never framed as a dead end.
7. **Meeting** — attends the activation meeting with original documents.
8. **Activation** — Dashboard tier tile and Digital Pass update automatically once approved and confirmed; no separate "upgrade" action ever appears.

## Guarantor

**Framing:** the guarantor is not a bystander who occasionally uploads a receipt — they are half of the financial picture FORSA is evaluating.

1. **Invitation** — never self-registers. Receives a secure, single-use, expiring link either from the student's Apply wizard (sent right after submission) or from the standalone `/guarantor` page at any time.
2. **Accept** — sets a password, activates portal access.
3. **Financial Responsibility Profile** — the guarantor's own dashboard shows a Case Status card. Completing the Financial Profile (employment duration, salary range, income source, marital status, dependents, home ownership, monthly expenses, existing loans, other guarantees, supporting other students) **automatically triggers the internal FORSA Stability Score computation** (Phase 14 — Guarantor Stability is 60% of that score), and the dashboard tells the guarantor exactly what's still outstanding via a single "next action" line.
4. **Meeting paperwork (Phase 14)** — **no digital document upload step exists for the guarantor either.** CIN, employment/income proof, and a signed كمبيالة (per FORSA's template) are brought to and verified at the in-person activation meeting instead.
5. **Dashboard always shows (Phase 14 — the Documents checkpoint was removed since verification moved to the meeting):**
   - **Invitation Status** — implicit (reaching the dashboard at all means it's active).
   - **Profile Status** — Financial Responsibility Profile complete or pending.
   - **Meeting Information** — date, time, location, reference number, assigned officer, required paperwork, once scheduled.
6. **Payments** — once the Case is active, sees the payment schedule and can submit receipts or pay on the student's behalf, unchanged from before this phase.
7. **Meeting** — attends alongside the student, bringing the original paperwork above.

**Language:** the guarantor portal's logged-in area gained a working French/English/Arabic switcher in Phase 14 (previously, despite a complete translation catalog existing in the codebase, no screen ever rendered one — every page was hardcoded French). The Case Status card and Financial Profile form are fully translated; the pre-existing rest of the dashboard (student summary card, payment KPIs/ledger) remains French-only for now — see `PHASE14_FINAL_CASE_FLOW_REPORT.md`'s remaining risks.

## Admin / Staff

**Framing:** a decision is made on the complete Case, not on a student record with a guarantor as an afterthought.

1. **Application list** — unchanged: queue-tag triage (Urgent, Missing Guarantor, Waiting Documents, Waiting List, Ready for Review, etc.).
2. **Application detail — Overview tab** — the Admin Pipeline tracker (internal operational vocabulary: Draft → Submitted → Completeness Verification → Guarantor → AI Review → Internal Review → Pre-Approval → Contract → University Confirmation → Approved → University Payment → Active Student) plus the document Completeness Checklist. Unchanged from the previous phase.
3. **Application detail — Case Summary tab** — the complete Case in one place, instead of reconstructing it from five different tabs:
   - **Case Request (Phase 14)** — requested plan (Silver/Gold), system-loaded tuition, plan structure, estimated monthly payment, and whether the 30 TND/month fee was acknowledged.
   - Student Summary (financial + personal fields).
   - Guarantor Summary (Financial Responsibility Profile fields, and whether it's complete).
   - **Internal FORSA Stability Score (Phase 14)** — the overall score and all 4 weighted sub-scores (Guarantor Stability, Household Stability, Payment Capacity, Student Stability Bonus), plus the AI's explanation: risk factors, positive factors, suggested meeting questions, and a confidence score — clearly advisory, never an approval or rejection.
   - AI Interview Risk Flags, still surfaced separately from the AI Readiness Interview step when present.
   - Meeting Status — schedule one (after approval in principle), confirm, reschedule, or cancel, directly from this tab. The default paperwork checklist (Phase 14): CIN for the student; CIN, income proof, and a signed كمبيالة for the guarantor.
4. **AI Report tab** — unchanged: the AI Readiness Interview's own scores, strengths, concerns, recommendation. Advisory only — like the Stability Score, the AI never approves or rejects; a human status transition is always the actual decision.
5. **Decision** — the existing status-transition mechanism, unchanged. Tier (Silver/Gold) is chosen by the human reviewer at approval time — informed by, but never bound to, the student's requested plan or the Stability Score.
6. **Meeting** — scheduled from the Case Summary tab once a decision is made in principle; both student and guarantor are notified by email with matching reference numbers, the assigned officer's name, and an explicit line that originals are verified in person.
7. **Contract → University Confirmation → University Payment → Active Student** — unchanged mechanism; the Admin Pipeline tracker and the student's own Timeline reflect the same underlying status throughout, just in different vocabulary (see `CASE_MANAGEMENT_ARCHITECTURE.md`'s "two-audience presentation").

## University Partner

Unchanged by this phase: confirms enrollment via their one write action (`POST /applications/:id/university-confirm`), views their own students' applications read-only.

## Referral Partner

Unchanged by this phase: views referrals, commissions, and reports for students they referred.

## Finance

Unchanged by this phase: records and verifies payments, views collections, generates reports. The Case's payment schedule (now visible in the admin Case Summary tab too) is the same `payment_schedules`/`installments` data Finance has always worked from.
