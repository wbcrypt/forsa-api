# Case Management & Dual Applicant Workflow — Architecture (Phase 13)

## Why this exists

Manual review surfaced a structural problem: the platform treated the student and the guarantor as two loosely-connected participants, each with their own portal and their own status, with no single place that represented "the thing FORSA is actually deciding on." But FORSA never evaluates the student alone — it evaluates **Student + Guarantor + Educational Request** as one financial picture. This document describes how that single unit — the **Case** — is now represented across the data model, the backend, and all three user-facing portals.

**Explicit constraints this phase operated under** (carried through every design decision below):
- **No change to core business logic** — how a decision gets made, what makes an application eligible, tier assignment, is untouched.
- **No change to permissions** — every new endpoint reuses an existing permission (`application.view`, `application.edit`) or is self-scoped exactly like the endpoints around it. No new permission was introduced.
- **No change to the operational pipeline** — `applications.current_status`, its transition table, and the automated Stage 1–10 pipeline (`pipeline.service.ts`) are byte-for-byte unchanged. Everything described below is additive.

## The central design decision: a Case is not a new table

The obvious-looking approach — a `cases` table with `student_id` + `guarantor_id` + `application_id` — was rejected. An `applications` row already *is* the case: it already carries the student, the university/program/tuition request, and (via `student_guarantors`) the guarantor. Introducing a second entity that duplicates that relationship would create exactly the kind of two-sources-of-truth problem this phase exists to fix, and would touch the pipeline's own queries (`ctx.application`, `ctx.studentId`) — a genuine pipeline redesign, which is out of scope.

Instead, **the Case is an aggregation view over existing tables**, assembled fresh on every read by `applications.service.ts#getCaseSummary()`. There is nothing to keep in sync because there is only one copy of the data — the same pattern this codebase already used for the Admin Pipeline / Student Timeline split (`application-stages.util.ts`, previous phase): compute, don't duplicate.

## Entity relationships

```
                         ┌─────────────────┐
                         │   applications   │  ← the Case, conceptually
                         │  (current_status,│
                         │  the one real    │
                         │  state machine)  │
                         └────────┬─────────┘
                                  │
        ┌──────────────┬─────────┼─────────┬──────────────┐
        │              │         │         │              │
        ▼              ▼         ▼         ▼              ▼
   students      student_guarantors   application_    payment_
   (financial/    → guarantors        documents        schedules
   personal        (financial         (per required    → installments
   profile         responsibility     doc type)
   fields new      profile fields
   this phase)     new this phase)
                                  │
                                  ▼
                            case_meetings      ← genuinely new table
                         (the only new entity   this phase — the
                          this phase adds)       pre-contract
                                                  verification meeting
```

- **`applications`** — unchanged. Still the one real state machine (`current_status`), still the FK target for everything else. Gained one nullable column: `expected_graduation_date` (an Academic field the Case wizard collects that had nowhere to live).
- **`students`** — gained financial/personal columns (`employment_status`, `monthly_income`, `has_scholarship`, `scholarship_details`, `existing_loans_amount`, `other_financial_commitments`, `living_situation`, `emergency_contact_name/phone/relationship`). Nothing removed, nothing renamed.
- **`guarantors`** — gained the Financial Responsibility Profile columns (`employment_duration_years`, `salary_range`, `income_source`, `marital_status`, `number_of_dependents`, `home_ownership`, `monthly_expenses`, `existing_loans_amount`, `other_guarantees`, `supporting_other_students`, `financial_profile_completed_at`).
- **`case_meetings`** — the one genuinely new table. One row per scheduled meeting; a reschedule inserts a fresh row (old row → `rescheduled`, terminal) rather than mutating history away. This closes a gap that existed in the codebase before this phase: `guarantors.service.ts` had a hardcoded `const activationMeeting = null` with a comment explaining the table had never been built, even though the product's email templates (`email-templates.ts`) already anticipated an "Activation Meeting."
- **`notification_templates`** — gained three rows (`meeting_scheduled`, `meeting_rescheduled`, `meeting_cancelled`) so both student and guarantor are notified with the same reference number, date/time, location, and requirements.

Migration files: `migrations/014_case_management.sql`, `migrations/015_meeting_notification_template.sql`.

## The two-audience presentation, extended

The previous phase established that the Admin Pipeline (internal operational vocabulary) and Student Timeline (customer-journey vocabulary) are two computed views over the same `(current_status, completeness)` input — never two stored statuses. This phase extends both views to also account for the Case's guarantor and meeting state, and adds a third: **the guarantor's own Case status**.

| Audience | Endpoint | What it shows |
|---|---|---|
| Admin | `GET /applications/:id/case` | The complete Case: student profile, guarantor profile, every document, AI analysis, completeness, risk flags, meeting, payment schedule — everything an underwriting decision needs, in one response. |
| Student | `GET /applications/me/:id/timeline` (extended) | Case Status (the 8-milestone Student Timeline), Case Progress, **Next Required Action** (new — a single plain-language sentence telling the student exactly what to do next), and meeting details if one exists. |
| Guarantor | `GET /guarantors/my-case` (new) | Invitation Status, Profile Status (Financial Responsibility Profile complete or not), Documents Remaining, Meeting Information, and their own Next Required Action. |

All three are computed from the same underlying rows (`applications.current_status`, `application_documents`, `student_guarantors`/`guarantors`, `case_meetings`) — verified live side-by-side against the same real Case during this phase's testing (see `MANUAL_TESTING_GUIDE.md`).

## Lifecycle

The product-level lifecycle this phase was asked to support:

```
Bronze Member
  → Apply for Tuition Facilitation      (client-side wizard state; no
    "Draft Case"                          application row exists yet —
                                           see below)
  → Step 1: Student Financial Profile   (students table + application
                                          fields; enforced complete
                                          before submission — unchanged
                                          from the previous phase)
  → Step 2: Student Review + Submit     (POST /applications/me — current_status
                                          starts at 'new_lead')
  → Step 3: Guarantor Invitation        (unchanged — triggered
    (automatic, tied to the Case)         immediately after submission,
                                          student_guarantors row created
                                          'pending_invitation')
  → Step 4: Guarantor Portal             (guarantor accepts → completes
    Financial Responsibility Profile     the NEW financial-profile
                                          endpoint → financial_profile_
                                          completed_at set)
  → Step 5: Case Completion              (all of the above converge —
                                          this is what getCaseSummary()
                                          shows as "complete")
  → AI Analysis                          (unchanged — produces a report;
                                          "AI must never approve or
                                          reject" was already true and
                                          remains true: ai_recommendation
                                          is advisory only, the actual
                                          decision is a human status
                                          transition)
  → Admin Review                         (NEW: Case Summary tab bundles
                                          everything instead of five tabs)
  → Meeting                              (NEW: case_meetings — generated
                                          by staff action after
                                          approval-in-principle,
                                          independent of current_status)
  → Contract → University Payment
  → Membership updated → Silver/Gold
  → Digital Pass + Dashboard updated     (unchanged — this whole chain
                                          was verified working in the
                                          previous phase)
```

**"Draft Case"** is deliberately *not* a stored application row. The previous phase's fix already established that the admin pipeline must only ever receive applications with all mandatory data present — `createForSelf` validates completeness before a row is created at all. Introducing a real "draft" application row would mean either relaxing that validation (regressing the previous fix) or maintaining two different completeness rules for two different row states. The wizard's in-progress state (phases 1 through 4, before final submit) *is* the Draft Case — it lives in the client's session state until the student clicks Submit, exactly as it did before this phase, and is documented as such rather than re-implemented as a database concept.

## State machine

**Unchanged, per this phase's explicit constraint.** `applications.current_status` and its transition table are exactly what they were before this phase — see `FORSA_OPERATIONS_MANUAL.md` §10 for the full transition table, unaffected by anything in this document.

**`case_meetings.status`** is the one new, genuinely small state machine this phase introduces, and it is deliberately *not* wired into `current_status` at all:

```
scheduled ──┬──> confirmed ──> completed
            ├──> rescheduled  (terminal for this row; a new row is
            │                  created at 'scheduled' with a fresh
            │                  reference number)
            └──> cancelled    (terminal; requires a reason)
```

A meeting can be scheduled, rescheduled, or cancelled at any point without touching the Case's real status — matching how the product actually operates (staff decide when a Case is ready for a meeting; the meeting's own outcome is recorded separately, and a human still makes the real approve/reject/contract decisions via the existing status transitions).

## Permissions

**No new permission was introduced.** Every new endpoint reuses whichever existing permission already gates functionally equivalent actions on the same resource:

| Endpoint | Permission | Rationale |
|---|---|---|
| `GET /applications/:id/case` | `application.view` (existing) | Reading a fuller view of an application a staff member could already view. |
| `POST /applications/:id/meetings` | `application.edit` (existing) | Scheduling a meeting is an editorial action on the application, same tier as a status transition. |
| `PATCH /applications/meetings/:meetingId` | `application.edit` (existing) | Same. |
| `GET /applications/me/:id/timeline` (extended) | none — self-scoped | Unchanged pattern: identity resolved from the caller's own JWT, ownership verified by a join, exactly like every other `/me/` route in this codebase. |
| `GET /guarantors/my-case` | none — self-scoped | Same self-scoped pattern as the existing `/guarantors/my-student`. |
| `PATCH /guarantors/my-case/financial-profile` | none — self-scoped | Same. |

## Responsibilities (who does what, and where they see it)

| Role | Responsibility | Where |
|---|---|---|
| **Student** | Complete their own financial/personal profile; upload required documents; invite a guarantor (as part of the wizard, or independently); submit; attend the activation meeting if one is scheduled. | Apply wizard (Steps 1–4, unchanged in structure from the previous phase), Profile page (financial/personal fields — new this phase), Application page (Next Required Action + meeting details — new this phase). |
| **Guarantor** | Accept the invitation; complete the Financial Responsibility Profile; upload supporting documents; attend the meeting. | Guarantor Dashboard's new Case Status card — Financial Profile form, documents status, meeting information. |
| **Admin/Staff** | Review the complete Case (not five separate tabs); see risk flags and AI analysis alongside the raw profiles; schedule/confirm/reschedule/cancel the meeting; make the actual decision (unchanged mechanism — status transitions). | Application Detail page's new "📋 Case Summary" tab. |

## What was deliberately not built

- **No new "Case" database table** — see above; this was a considered rejection, not an oversight.
- **No changes to `current_status` or its transition table.**
- **No changes to the automated pipeline (`pipeline.service.ts`, Stages 1–10).**
- **No new roles or permissions.**
- **AI still never approves or rejects anything** — `ai_recommendation`/`ai_report` remain advisory fields exactly as before; nothing in this phase changes who or what makes the actual decision.
- **The Apply wizard's step structure is unchanged** (still the 6 steps from the previous phase: Profile, Financial, Documents, Guarantor, Consent, AI Interview) — the new financial/personal fields were added to the **Profile page** instead of inserted as new wizard steps, to avoid re-touching wizard phase-transition logic that was just stabilized and tested in the previous phase. This is a deliberate scope decision: the data gets collected as part of the Case either way, but through the lower-risk surface.

## Verification performed

Full live verification against the running stack (see `MANUAL_TESTING_GUIDE.md` for the step-by-step scenario):
- Scheduled a meeting via the admin Case Summary tab; confirmed both the student and the guarantor received the `meeting_scheduled` email in MailHog with matching reference numbers, dates, and location.
- Confirmed, rescheduled (verified a fresh reference number was issued and the old row marked `rescheduled`), and cancelled a meeting.
- Completed a guarantor's Financial Responsibility Profile via the portal; confirmed the same data appeared immediately in the admin Case Summary (same underlying row, no sync step).
- Confirmed the student's Application page correctly renders the Next Required Action and meeting details from the same data the admin and guarantor views use.
- Full backend regression: 185/185 tests passing (17 new tests added for the stage/milestone computation logic in the previous phase remain green; this phase added schema and endpoint coverage without touching that logic). All 6 portals smoke-tested clean after redeploy.

## Addendum — Phase 14 (Final Case Flow Refinement)

The Case model above gained fields, not structure — everything in "The central design decision" and "Entity relationships" above still holds exactly as written. Summary of what Phase 14 added to the Case:

- **`applications.requested_tier`** — the plan (Silver/Gold) the student requests at submission, distinct from `financing_tier` (the admin's actual decision at approval). A preference, never an auto-approval.
- **`applications.platform_fee_acknowledged_at`** — set only when the student explicitly checks the 30 TND/month fee acknowledgment; required by `createForSelf` and checked again by the pipeline's Stage 1 Completeness Gate.
- **`applications.forsa_choice_reason`** — optional, analytics-only.
- **`applications.stability_score_overall` / `stability_score_breakdown` / `stability_ai_explanation`** — the V1 internal FORSA Stability Score (full model: `STABILITY_SCORE_MODEL.md`), computed deterministically and automatically the moment the guarantor completes their Financial Responsibility Profile (`guarantors.service.ts#recomputeStabilityScore`). This is what "AI Analysis" in the admin Case Summary now actually shows, alongside (not replacing) the interview-based `ai_report`/`ai_score_overall` from the AI Readiness Interview step, which remains but no longer drives the decision.
- **`programs.tuition_amount`** — the single authoritative tuition figure, looked up server-side by `createForSelf` and never trusted from the client. This is what makes "the student must not manually enter tuition" an integrity guarantee rather than just a missing input field.

**Removed from the Case's intake requirements:** the Phase 12 document-upload gate. No document is ever uploaded during the application; CIN (student) and CIN/income proof/كمبيالة (guarantor) are verified in person at the activation meeting instead — reflected in `case_meetings.required_documents`'s default list and the meeting notification emails.

**Unaffected by Phase 14:** the Case-is-not-a-new-table decision, `case_meetings`'s own lifecycle, every permission, and the operational pipeline's stage structure (Stage 1 checks *different* things now, but the pipeline still has the same 10 stages in the same order).
