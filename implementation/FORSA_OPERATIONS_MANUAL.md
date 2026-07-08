# FORSA Operations Manual

**The single source of truth for how FORSA operates.** Written for developers, administrators, university partners, and future employees — anyone who needs to know exactly what happens, who is responsible, and what the system actually does at every step.

Every workflow described here reflects the **actual implemented system** as of this writing, verified against the running code and a live local stack — not an aspirational design. Where the implementation differs from what would ideally exist, that gap is stated plainly, explained, and given a recommendation. Nothing is hidden. A companion document, `OPERATIONS_AUDIT_REPORT.md`, independently verifies every claim made here against the platform itself.

---

## 1. Platform Overview

### What FORSA is

FORSA is a Tunisian tuition-facilitation ecosystem. It connects students who need help funding university tuition with a structured, staff-reviewed **Tuition Facilitation Plan** — never described internally or externally as a "loan," "credit," or product with an "interest rate." A guarantor (typically a parent or relative) backs the plan financially. Partner universities confirm enrollment and receive funds; referral partners can introduce students; FORSA's finance team tracks disbursement and collection.

### Operating model

FORSA runs as a single-tenant deployment per institution today (the schema is multi-tenant-capable — every table carries a `tenant_id` — but only one tenant, "FORSA," is provisioned in this environment). The platform is six separate frontend applications, each a distinct portal for a distinct audience, all served by one shared NestJS backend API and one shared Postgres database:

| Portal | Audience | Domain (local) |
|---|---|---|
| Homepage | Public visitors | `forsa.tn` |
| Student | Students / applicants | `student.forsa.tn` |
| Guarantor | Guarantors | `guarantor.forsa.tn` |
| University | Partner university staff | `university.forsa.tn` |
| Partner | Referral partners | `partner.forsa.tn` |
| Admin / Dashboard | FORSA staff | `admin.forsa.tn` |
| Finance | FORSA finance team | (served from the same admin/dashboard build, gated by role) |

Everything runs today in Docker Compose on a local/staging environment — there is no production VPS deployment and no real DNS/TLS yet. That is a deliberate, standing decision, not an oversight: the platform has not been told to deploy to a real server, and this manual does not change that.

### User roles

- **Visitor** — anonymous, no account. Can browse the public homepage and submit a Membership Request.
- **Student** — a FORSA member from Bronze upward. Has a real login, a FORSA ID, and (once membership is approved) a Digital Student Pass.
- **Guarantor** — the person financially backing a student's Tuition Facilitation Plan. Reaches the platform only through an invitation, never public self-registration.
- **University staff** — one account per partner university. Sees only that university's own students and applications.
- **Partner** — a referral agency. Sees only its own referred students.
- **FORSA staff (Admin)** — reviews and decides on membership requests and Tuition Facilitation applications, manages guarantors, sees everything within the tenant.
- **FORSA Finance** — a narrower staff role focused on payments, collections, and finance reporting.

### Responsibilities

| Who | Responsible for |
|---|---|
| Student | Submitting accurate information, uploading required documents, keeping their guarantor relationship current, making or arranging payments |
| Guarantor | Reviewing and accepting/declining the role honestly, backing the student's payment obligations, submitting payment receipts on the student's behalf where applicable |
| University | Confirming enrollment and tuition amounts once FORSA approves a plan; nothing earlier in the decision |
| Partner | Referring genuine prospective students; has no role in the actual approval decision |
| FORSA staff | Reviewing every Membership Request and Tuition Facilitation application, making the approval/rejection decision, keeping guarantor and document status current, maintaining the audit trail |
| FORSA Finance | Verifying payment receipts, tracking overdue installments, running collections, reconciling the ledger |

### Permissions — the short version

Full detail is in §12 (Permissions Matrix). The operating principle: **every non-staff portal (student, guarantor, university, partner) is self-scoped** — the backend resolves "whose data is this" entirely from the caller's own JWT identity, never from anything the client sends, and these accounts hold **zero** of the granular staff permissions described below. Staff accounts hold explicit, named permissions (`application.view`, `membership.approve`, `payment.record`, etc.) checked per-endpoint.

**A real operational fact worth stating plainly:** the permission *catalog* is granular (61 distinct named permissions exist, covering everything from `report.ceo` to `fraud.flag`), but only **two roles actually exist today** — `SUPER_ADMIN` (all 61 permissions) and `FINANCE_TEAM` (a 9-permission subset: `payment.*`, `collections.*`, `report.finance`, `report.collections`, `student.view`). There is no dedicated CEO role, loan-officer role, or collections-only agent role in practice — anyone who isn't finance-only is a full super-admin today. See §12 and the recommendation in §15.

### Business philosophy

- **The membership tier is a result, never a request.** A student never asks to be "upgraded" to Silver or Gold — the tier is assigned automatically the moment a Tuition Facilitation Plan is approved at that level. This was a deliberate redesign (Phase 7 of this engagement) after finding students had no clear path from Bronze to Silver/Gold; see §2 and §5.
- **Rejection is a soft landing, not a dead end.** A rejected Membership Request or Tuition Facilitation application never terminates the relationship — Bronze membership (once granted) is never revoked by a facilitation rejection, and reapplication is always possible.
- **No orphan accounts, ever.** A guarantor who declines never gets a login. A rejected visitor never gets a `students` row. Every account that exists corresponds to a real, current relationship.
- **Audit trails are immutable by design.** `membership_status_history` cannot be `DELETE`d or `UPDATE`d at the database level (a Postgres rule enforces this) — once a membership tier change is recorded, it stays recorded forever.

---

## 2. Membership Lifecycle

```
Visitor
   │  submits Membership Request (public, no auth)
   ▼
Pending Review  ──────────────┐
   │  admin approves           │  admin rejects
   ▼                           ▼
Bronze                     Rejected
   │  submits Tuition          (no account created;
   │  Facilitation Application  email sent explaining why;
   ▼                            visitor may submit a new
Tuition Facilitation Application  request any time)
   │  admin approves at a tier
   ▼
Silver  or  Gold
   (assigned automatically to match
    the approved facilitation plan's tier —
    never requested directly)
```

### State: Visitor → Membership Request

- **Trigger:** a visitor fills out and submits the public "Join FORSA" form.
- **Responsible role:** the visitor themself; no staff involvement yet.
- **System actions:** validates every field (first/last name, email, phone, city, programme, academic year, current-or-future-student, optional university). Rejects with a specific message if the email already has a pending request, or if it already belongs to an active student.
- **Notifications:** `membership_submitted` email to the visitor.
- **Database state:** one `membership_requests` row created, `status = 'pending'`. No `users`/`students` row exists yet.
- **Exit conditions:** admin approves → Bronze; admin rejects → Rejected. No auto-expiry exists on a pending request (see §14).

> **Documented deviation:** the intended design description sometimes references an "email verification" step between submission and pending review. **No such gate exists in the real implementation.** The Membership Request form is genuinely public and unauthenticated; the very first email a visitor receives *is* the submission confirmation, not a verification link they must click before their request is even considered. This is called out explicitly rather than silently assumed away — if a verification gate is actually wanted, it does not exist today and would need to be built.

### State: Pending Review → Rejected

- **Trigger:** an admin reviews the request in the Membership Queue and rejects it.
- **Responsible role:** FORSA staff holding `membership.approve`.
- **System actions:** `membership_requests.status = 'rejected'`, reviewer and reason recorded.
- **Notifications:** `membership_rejected` email, including the reason if one was given. *(This notification was found missing during the Phase 8 audit and fixed — see `WORKFLOW_AUDIT_REPORT.md` for the history; it is correctly wired as of this manual.)*
- **Database state:** no `users`/`students` row is ever created for a rejected request.
- **Exit conditions:** terminal for this specific request, but not terminal for the person — nothing prevents the same email submitting a brand-new Membership Request later (there is no "permanently blocked" flag from a rejection alone).

### State: Pending Review → Bronze

- **Trigger:** an admin reviews the request and approves it.
- **Responsible role:** FORSA staff holding `membership.approve`.
- **System actions, all in one database transaction:**
  1. A `students` row is created: `membership_status = 'bronze'`, a unique FORSA ID generated in the format `FORSA-<year>-<6 hex chars>` (collision-checked and retried if needed).
  2. A `users` row is created: `portal_type = 'student'`, `status = 'pending_verification'`, an unusable placeholder password hash.
  3. A **Digital Student Pass** is issued in the same transaction — a Bronze member never exists without a pass, or vice versa.
  4. A one-time, SHA-256-hashed, 48-hour password-setup token is generated.
- **Notifications:** `membership_approved` email containing the FORSA ID and the set-password link.
- **Database state:** `membership_requests.status = 'approved'`, real `students`/`users`/`digital_student_passes` rows exist, `membership_status_history` gets its first row (`previous_status = NULL`, `new_status = 'bronze'`).
- **Exit conditions:** the student clicks the set-password link → account becomes fully active → they can log in. If they never click it, the account sits in `pending_verification` indefinitely (see §14 — no automatic expiry/reaping exists today).

### State: Bronze → Tuition Facilitation Application

Covered in full in §5. In summary: from the Student Dashboard, the one and only "Apply now" entry point (`/apply`) starts a multi-step application. Submitting it does not change `membership_status` — the student remains Bronze until (and unless) that specific application is approved.

### State: Tuition Facilitation Application → Silver / Gold

- **Trigger:** an admin approves the application at Level 2 or Level 3 (or Level 1, which does not itself imply an automatic tier change — see the exact mapping in §5), selecting a Silver or Gold tier.
- **Responsible role:** FORSA staff holding `application.edit` (or, via the automated pipeline path, whoever made the human decision at the review stage).
- **System actions:** the student's `membership_status` is updated to the approved tier **only if it ranks higher than their current tier** (bronze=0, silver=1, gold=2 — strictly ratchets upward, never downward). A `membership_status_history` row is written recording the change and the reason ("Tuition Facilitation Plan approved at {tier} tier").
- **Notifications:** `application_approved` email, explicitly naming the tier.
- **Database state:** `applications.current_status` moves to `approved_levelN`, `applications.financing_tier` is set, `students.membership_status` updates (or doesn't, if it would be a downgrade — e.g., a Gold member approved again at Silver correctly keeps Gold).
- **Exit conditions:** the plan continues toward `contract_sent` → `contract_signed` → `university_confirmed` → `university_paid` → `active_student` (full detail in §5/§10). The membership tier itself does not change again from this application once set.

**This exact mechanism — a manual admin decision correctly updating the student's real tier — was, until Phase 7 of this engagement, broken in half the admin UI.** Two separate admin screens can both approve an application; only one of them originally contained the tier-ratchet logic. This is now fixed so both produce the identical outcome; see `TUITION_FACILITATION_JOURNEY.md` for the incident history and `WORKFLOW_AUDIT_REPORT.md` for the verification.

---

## 3. Student Journey

From the homepage to an active, funded student — every page, every decision point, every notification.

1. **Homepage** (`forsa.tn`) — public marketing site. Presents the three membership tiers and a single, unambiguous primary CTA: "Join FORSA" / "Rejoindre gratuitement."
2. **`/join` (Membership Request)** — public form, no login required. See §2.
3. **Confirmation** — `membership_submitted` email. The visitor now waits; there is no logged-in "status page" available to a non-member, by design (they have no account yet).
4. **Approval email** (`membership_approved`) — contains the FORSA ID and a set-password link.
5. **`/set-password?token=...`** — the student sets a real password. Single-use token; a second click on the same link (or an expired one) shows a specific, distinct message rather than a generic failure.
6. **`/login`** — first real authenticated entry into the product.
7. **Dashboard (`/`)** — before any application exists, shows a **progress checklist** (Phase 10): Membership Approved, FORSA ID Issued, Digital Pass Issued, Complete Profile, Invite Guarantor, Submit Tuition Facilitation Request — with the one current required step always highlighted. Once an application exists, this is replaced by a decision-tree "Next Action" card adapting to the application's real state (in review / approved / rejected / waiting list / payment due).
8. **`/guarantor`** (Phase 10) — invite a guarantor directly (first name, last name, email, relationship), no staff action required; shows live status (pending/active/declined) with a resend action. Reachable from the Dashboard checklist.
9. **`/apply`** — the one canonical entry point into the Tuition Facilitation wizard (see §5 for every step). A second, incomplete flow (`/application/new`) existed until Phase 7 and has been retired; it now redirects here.
10. **`/application`** — status page for whatever the student's most recent application is. Shows the **Application Timeline** (workflow architecture redesign — see §10's "Two views of one application"): Application Started → Application Submitted → Documents Verified → Guarantor Status → Under Review → Decision → University Confirmation → Active Student, in plain language with no internal CRM terms; if rejected, a reassurance section (Bronze intact, "what's included," "what happens next") plus a working "Apply Again" button; if waitlisted (Phase 10), an explanation, Bronze-intact reassurance, an estimated queue position, and while-you-wait guidance.
11. **`/documents`** — upload required documents; also shows Activation Meeting logistics once pre-approved.
12. **`/payments`** — payment schedule, installment status, bank-transfer instructions, receipt upload.
13. **`/pass`** — the Digital Student Pass (QR code), visually reflecting the current membership tier.
14. **`/profile`** — personal information, password change, language switcher (EN/FR/AR, with Arabic RTL support).
15. **`/notifications`** — in-app notification history (see §11's caveat — this page is currently always empty; see Cross-cutting notes).

**Every possible outcome from an application decision:**
- **Approved** at Silver or Gold → tier updates automatically, `application_approved` email, journey continues toward contract → enrollment confirmation → active student.
- **Rejected** → Bronze membership fully intact, `application_rejected` email (explicitly reassuring, mentions Bronze is unaffected), reapply available immediately via `/apply`.
- **On hold / more info required** → student is asked for something specific, returns to review once resolved.
- **Waiting list (capital queue)** → explicitly, deliberately worded as *not* a rejection — "placed on FORSA's Waiting List while capital becomes available," with its own `waiting_list` notification distinct from `application_rejected`. Since Phase 10, the student-facing detail page also shows a real estimated queue position and explicit while-you-wait guidance rather than a bare status label.
- **Fraud-flagged** → terminal, no further transition possible (a deliberate design choice protecting the integrity of a permanent-blacklist guarantee).

Graduation / plan completion: `active_student` → `completed` (the plan is fully paid and closed) or `withdrawn` (the student leaves the program before completion). Neither of these currently triggers a distinct notification template of its own — see §14.

---

## 4. Guarantor Journey

Guarantors **never self-register**. The only way into the guarantor portal is a secure, single-use invitation created by a student or by staff.

**Updated in Phase 10**: a student can now create this invitation directly, with no staff action required — `POST /students/me/guarantors` (surfaced in the student portal's `/guarantor` page), resolving the student from their own login identity. Staff retain the same ability via the student record in the admin dashboard, for cases where a student needs help or staff are entering the guarantor on their behalf (e.g., phone intake). Both paths produce the identical invitation mechanism described below.

**Updated in the workflow alignment fix**: the Tuition Facilitation Apply wizard now has its own mandatory Guarantor step (§5), collecting the same details and sending the same invitation as the standalone `/guarantor` page — but only *after* the application is actually created, never before. This is the primary path a first-time applicant hits in practice; the standalone page remains available for adding/replacing a guarantor outside the wizard (e.g., before starting an application, or after a decline). The pipeline's Completeness Gate (Stage 1) now genuinely requires a guarantor relationship to exist — an invitation still pending acceptance satisfies it (waiting on a response is a normal in-review state), but no guarantor at all blocks the application from reaching a human reviewer.

```
Invitation created (by student, self-service — or by admin, on the
student's behalf)
   │  secure random token generated, SHA-256 hash stored,
   │  raw token emailed, 7-day expiry
   ▼
Guarantor opens the invite link
   ▼
Preview  (public, read-only — sees who invited them and for whom,
          commits to nothing yet)
   │
   ├──► Accept ─────────────────────────────┐
   │      sets a password                    │
   │      account created (portal_type=      │
   │      'guarantor'), token cleared         │
   │      (single-use — replay fails          │
   │      afterward)                          │
   │                                          ▼
   │                                    Account created
   │                                          │
   │                                          ▼
   │                                     Auto-logged-in
   │                                          │
   │                                          ▼
   │                                  Guarantor Portal —
   │                                  sees linked student,
   │                                  application status,
   │                                  payment schedule
   │
   └──► Decline (optional reason recorded)
          NO account is ever created
          student_guarantors.status = 'declined'
          admin sees the decline + reason
```

- **Invitation:** created via the student's own `/guarantor` page (self-service, added in Phase 10 — `POST /students/me/guarantors`) or, equivalently, by an admin against the student record. Requires a real first name, last name, and email; rejects a duplicate email already added as a guarantor for that student. The `/apply` wizard's "do you have a guarantor?" question is still a separate, informational yes/no answer (context for the AI interview) rather than a form embedded in the wizard itself — the actual invitation happens on the dedicated `/guarantor` page, reachable directly from the Bronze Dashboard checklist.
- **Preview:** `GET /guarantors/invite/:token`, public, no auth. Distinguishes four distinct failure states with four distinct messages: invalid/no-such-token, already used, already declined, expired.
- **Accept:** password only (their profile — first/last name, relationship — was already captured at invitation time by whoever added them). Creates the `users` row, sets `portal_activated = true`, clears the invite token, and (if linked to a specific student) flips `student_guarantors.status` to `active`.
- **Decline:** optional reason, no password needed. No account, ever. `student_guarantors.status = 'declined'`.
- **Profile completion:** the guarantor's *basic* profile (name, relationship, phone, employment status) is still captured up front at invitation time by whoever adds them. **Updated in Phase 13 (Case Management):** once accepted, the guarantor's own dashboard now shows a Case Status card prompting them to complete a genuine **Financial Responsibility Profile** themselves — `PATCH /guarantors/my-case/financial-profile` — covering employment duration, salary range, income source, marital status, dependents, home ownership, monthly expenses, existing loans, other guarantees, and whether they're already supporting another student. This is FORSA evaluating the guarantor half of the Case, not just recording who they are. `guarantors.financial_profile_completed_at` tracks completion; `GET /guarantors/my-case` reports it alongside documents and meeting status.
- **Documents:** there is still **no dedicated identity/income document-upload step in the guarantor's own onboarding** — the guarantor portal's document-related capability remains limited to uploading a *payment receipt* on the student's behalf once linked. `guarantors.document_status` exists as a column and is surfaced in the new Case Status view, but nothing in the codebase currently writes to it via a real upload flow — it is read-only from the guarantor's own portal today. This gap, first flagged before Phase 13, remains open; see §14.
- **Portal / future interactions:** once active, the guarantor sees their linked student's application status, payment schedule, and can submit payment receipts or initiate an online payment (Konnect, unverified — see §8) on the student's behalf.
- **Resend:** if an invite is still pending, an admin can resend it — this immediately invalidates the old token and issues a fresh one (never two live tokens at once).

**Admin visibility:** the student's Guarantors tab shows the real status at all times — Pending Invitation / Active / Declined — with email, invite-sent timestamp, invite-expiry timestamp, and portal-activation status, plus a Resend action when appropriate.

---

## 5. Tuition Facilitation Workflow

### Who starts it

The student, from their own Dashboard, via the single canonical `/apply` entry point. (Staff can also create an application directly against a student record via the CRM-style `POST /applications` endpoint — used for phone/in-person intake rather than self-service — but this manual treats the self-service path as primary since it's what the product's UI is built around.)

### The wizard, in order

**Updated in Phase 14 (Final Case Flow Refinement)** — the validated final V1 workflow. The wizard now has 5 steps (the Documents step from the workflow alignment fix is removed entirely — see below):

1. **Your Profile** — personal details; academic info (university, program — a real selection only, no free-text fallback; academic year; current-student status). **Tuition is never typed by the student** — once a program is selected, its `tuition_amount` (configured by FORSA/admin against the program) is fetched and shown read-only. Also collected here: the **requested plan** (Silver or Gold — a preference the student expresses, not a decision; the admin still makes the actual tier decision at approval, unchanged), with a live display of tuition amount, plan structure (Silver = 10 months, Gold = 12 — see `STABILITY_SCORE_MODEL.md`), estimated monthly payment, the **30 TND/month administrative platform fee**, and the total — plus a required acknowledgment checkbox ("I understand that FORSA charges 30 TND/month as an administrative platform fee," in French/English/Arabic) and an optional, analytics-only "Why are you choosing FORSA?" question (never used in scoring or decisioning).
2. **Financial Situation** — payment-responsible party, household income, employment status, and a yes/no "do you have a guarantor?" question — informational context for the AI interview.
3. **Guarantor** — first name, last name, email, relationship. Collected as part of the application itself — the invitation is sent only once the application is actually created (step 5), never before or separately.
4. **Legal Consent** — explicit, itemized consent that a human review committee decides, not the AI.
5. **AI Readiness Interview** — a real conversational interview, kept for qualitative context; its own self-reported dimension scores are **no longer what informs the actual decision** (see "How the Case is scored" below — that's the new internal FORSA Stability Score, computed from structured profile data instead). **Submit** → `POST /applications/me`, which:
   - Rejects with a specific message if required fields (program, university, academic year, requested plan, fee acknowledgment) are missing.
   - Looks up `programs.tuition_amount` itself and uses that value — a client-supplied `tuitionAmount` in the request is silently ignored, even if present. Verified live: a forged `tuitionAmount: 999999` in the raw request had no effect; the created application used the real program tuition.
   - Rejects with a specific message if the selected program has no tuition configured yet.
   - **No document upload happens here at all** — see below.
   - On success, the student portal calls the guarantor-invite endpoint immediately after.
   - Resolves the student from the caller's own JWT — a client-supplied student ID in the request body is never trusted.

A student can also still invite a guarantor independently at any time via the `/guarantor` page reachable from the Bronze Dashboard checklist (e.g., before starting an application, or to replace a declined guarantor) — the wizard's own Guarantor step and the standalone page use the same underlying self-service mechanism.

**Phase 13 (Case Management), unaffected by Phase 14:** the student's fuller financial and personal profile — employment status, monthly income, scholarships, existing loans, other financial commitments, living situation, emergency contact — is collected via the **Profile page** (`PATCH /students/me`) rather than as additional wizard steps, so this data can be added or updated at any time.

### Documents — verified physically at the meeting, not uploaded (Phase 14)

**"No document upload during the application. Documents are verified physically during the meeting."** This reverses the workflow alignment fix's document-upload requirement — the Phase 12 requirement existed because nothing else ensured Stage 1 could ever pass; Phase 14 replaces that gate with the tier/fee-acknowledgment check instead (see §10) and moves paperwork verification to the in-person activation meeting:
- **Student meeting paperwork:** CIN (national ID) only. Academic verification — university, program, enrollment, tuition — is confirmed by the university directly, not uploaded by the student.
- **Guarantor meeting paperwork:** CIN, employment/income proof according to their situation, and a signed, completed كمبيالة per FORSA's template.

This is the default `case_meetings.required_documents` list (`applications.service.ts#scheduleMeeting`) and is spelled out explicitly in the meeting notification email (§ "The Case, and the activation meeting").

### How the Case is scored (Phase 14)

The internal FORSA Stability Score — full model in `STABILITY_SCORE_MODEL.md` — is computed automatically, server-side, the moment the guarantor completes their Financial Responsibility Profile (Guarantor Stability 60%, Household Stability 20%, Payment Capacity 15%, Student Stability Bonus 5%; documents, enrollment proof, and FORSA history are explicitly excluded from V1). **Student income is a bonus only, never a requirement** — its absence contributes 0 to that 5%-weighted component, never a penalty. The AI's role is strictly to explain the already-computed score (risk factors, positive factors, suggested meeting questions, a confidence score) — it never approves or rejects anything; that remains a human status transition, unchanged from every prior phase of this platform.

### Duplicate prevention

A student **cannot** have two Tuition Facilitation applications in flight simultaneously. Any existing application not in a terminal state (`rejected`, `completed`, `withdrawn`) blocks a new submission with a specific error. A rejected application does **not** block reapplication — that's the deliberate "Apply Again" path. *(This check did not exist before the Phase 8 audit; it is fixed and verified as of this manual.)*

### Who validates

FORSA staff, via either of two admin screens (a pre-existing architectural divergence — see §9/§10): the pipeline/human-decision review screen, or the manual Application Workflow screen. Both now produce identical, correct outcomes. The application detail view shows a **Completeness Checklist** (program selected, guarantor status) so staff never have to guess why an application is or isn't ready to clear Stage 1 — the document-status rows remain in this checklist's infrastructure but are moot for any Phase-14-era application, since none will ever have an uploaded document to show.

### What documents

**Superseded by Phase 14** — the previous model (required national ID, Bac diploma, university acceptance letter, and income proof, uploaded digitally before submission and tracked per `document_type_code` against the application) is gone. No document is ever uploaded during the application; the `application_documents`/`documents` infrastructure remains in the codebase but nothing writes to it for a new application anymore. Paperwork is verified in person at the activation meeting instead — see "Documents — verified physically at the meeting" above.

### What decisions

`under_review` can move to: `approved_level1`, `approved_level2`, `approved_level3`, `rejected`, `on_hold`, `capital_queue` (waiting list), `more_info_required`, or `fraud_flagged`.

### What happens after approval

`approved_levelN` → `contract_sent` → `contract_signed` → `university_confirmed` (the partner university's one write action — see §6) → `university_paid` → `active_student` → eventually `completed` or `withdrawn`. **Unchanged by Phase 13** — the Case Management redesign explicitly does not touch this transition table.

### The Case, and the activation meeting (Phase 13 — Case Management)

FORSA does not evaluate the student alone — it evaluates Student + Guarantor + Educational Request as one **Case**. This is not a new database entity (see `CASE_MANAGEMENT_ARCHITECTURE.md` for why that was deliberately rejected); it's a richer view over the same application, student, and guarantor rows, assembled by `GET /applications/:id/case` and rendered as the admin's new "Case Summary" tab: student profile, guarantor's Financial Responsibility Profile, every document, AI analysis, risk flags, and meeting status, in one place.

After an approval in principle (`approved_levelN`) and before the contract stage, staff typically schedule an **activation meeting** — a real capability new in Phase 13 (`case_meetings`; previously the product's copy referenced an "Activation Meeting" with no table or endpoint behind it at all). Both student and guarantor are emailed the same date, time, office location, reference number, **assigned FORSA officer** (looked up by name, not just shown as an ID — Phase 14), required attendees, and required paperwork, with an explicit line that originals are verified in person. The default paperwork list (Phase 14): CIN for the student; CIN, employment/income proof, and a signed كمبيالة for the guarantor. A meeting's own status (`scheduled → confirmed → completed`, or `rescheduled`/`cancelled`) is tracked independently of `current_status` — scheduling, confirming, or cancelling a meeting never touches the application's real state machine.

### How Silver/Gold is assigned

Automatically, as described in §2 — the reviewing admin selects the tier (Silver or Gold) as part of the approval action itself; the system then ratchets the student's `membership_status` up to match, never down. **This is a manual selection by the human reviewer at decision time, not an automatic scoring-based tier assignment** — the AI interview's score informs the *decision* to approve or reject, but the specific Silver-vs-Gold tier choice is a human judgment call made in the same action as the approval.

### Notifications sent

`application_approved` (names the tier), `application_rejected` (explicitly reassuring — Bronze unaffected), `waiting_list` (explicitly not a rejection), `document_requested`, `contract_ready`.

### If rejected

Bronze membership is untouched. The student sees a real, warm reassurance screen (fixed in Phase 7 after being found to render broken placeholder text) listing exactly what Bronze still includes, and a direct "Apply Again" button.

### Can it be resubmitted

Yes, any number of times, as long as the prior attempt reached a terminal state first (rejected/completed/withdrawn) — see Duplicate Prevention above.

---

## 6. University Workflow

A university account is provisioned by FORSA staff (one per partner institution) and is **strictly self-scoped**: every query is forced to that university's own ID, resolved server-side from the caller's JWT, never from anything client-supplied.

**Can do:**
- View the university's own students and their applications (read-only).
- View a real-time dashboard of KPIs scoped to that university only.
- **Confirm Enrollment** — the one and only write action available: transitions an application from `contract_signed` to `university_confirmed`, confirming enrollment and tuition before the payment plan activates. This transition is only legal from that exact prior status — attempting it earlier correctly fails.
- Export reports (CSV/PDF) of the university's own applications.
- View (read-only) the payment schedule status for its own students.

**Cannot do:**
- See any other university's data.
- Influence, approve, or reject a FORSA financing decision. That decision is made entirely before the university's involvement even begins.
- Record or modify a payment.
- Interact with the guarantor relationship at all.

**Permissions:** none of the granular staff permission set — the same "self-scoped, zero staff grants" pattern as the student and partner portals.

---

## 7. Partner Workflow

A partner account represents a referral agency. Like university accounts, strictly self-scoped to the partner's own `partner_id`.

**Referral lifecycle:** an application can be tagged with `applications.partner_id` / `applications.referral_source_id`, associating it with a specific referring partner. The partner then sees that student's application progress through the same status pipeline described in §5 (read-only).

**Status changes:** the partner has no ability to change an application's status — purely observational.

**Commission logic — a confirmed, real gap.** `partners.service.ts` contains a fully-built, correct commission calculation function (`calculateCommission`) and a record-creation function (`createCommissionRecord`), splitting the gross amount into FORSA's share and the partner's share, backed by a real `partner_commissions` table with a working partner-facing UI. **However, nothing in the codebase ever calls either function automatically** — not on approval, not on payment, not on disbursement. A commission row exists today only if inserted directly. This is documented, not hidden: closing it requires a business decision (commission triggered on approval? first payment? full disbursement?) that this manual does not presume to make unilaterally. See §13 and §15.

**Visibility:** referral count, approval rate, and (once/if a commission record exists) commission amount and status — all scoped to that partner's own referrals only.

---

## 8. Finance Workflow

The Finance portal (and the `FINANCE_TEAM` staff role) covers:

- **Payments** — manual bank-transfer with receipt upload is the verified, working payment method today. A student or guarantor uploads a receipt (`status = 'receipt_uploaded'`); finance staff verify it (`status = 'confirmed'`) or reject it (student/guarantor notified to resubmit).
- **Statuses** — installments move through `pending` → `due_soon` → `due_today` → (`paid` / `partial` / `late`) → possibly `default_risk` → `defaulted`, or `settled`/`waived` in exceptional cases. Payments themselves: `pending` → `confirmed` (or `reversed`/`failed`/`refunded`).
- **Receipts** — uploaded via presigned URL, verified against the correct installment before being trusted, confirmed or rejected by finance staff.
- **Administrative fees** — not implemented as a distinct concept in the current schema; tuition amount and requested support amount are the only monetary fields tracked at the application level.
- **Renewals** — `applications.is_renewal` exists as a field, but there is currently no UI path for a student to actually select "this is a renewal of a previous plan" — every application self-submitted through `/apply` is created with `is_renewal: false` (a mislabeling bug where this was previously derived from an unrelated "are you a current student" answer was found and fixed during the Phase 8 audit). A genuine renewal flow — picking a prior completed/active plan to renew — does not exist yet.
- **Late payments** — tracked via the `late`/`default_risk`/`defaulted` installment statuses and a dedicated collections worklist (`collections.controller.ts`'s `worklist`/`late` endpoints), sourced from installments past their grace-due date.
- **Exceptional cases** — a `student_exceptional_events` table exists (event type, reason code, description) for recording things like a payment hardship or a documented life event affecting a student's plan, gated behind `exceptional_event.open`/`exceptional_event.view` permissions.
- **Konnect (online payment gateway)** — code exists (`konnect.service.ts`, initiate + webhook endpoints) and appears complete, but was **not verified live** in this engagement (no sandbox credentials configured locally). Treat as "exists, unverified," not "confirmed working."
- **Disbursements** — tracked once an application reaches `contract_signed`/`university_paid`/`active_student`, aggregated in the Finance portal's Disbursements view.

---

## 9. Administrator Workflow

Every action a FORSA staff member (`SUPER_ADMIN`) can take:

- **Membership approval** — review the Membership Queue, approve (provisions Bronze + FORSA ID + Digital Pass + set-password email) or reject (now correctly emails the applicant — see §2).
- **Application approval** — via either of two screens (a real, acknowledged architectural divergence, not a documentation choice):
  - The **pipeline / human-decision** screen (`ApplicationDetailPage.tsx`), which goes through the AI-scored pipeline review flow.
  - The **manual workflow** screen (`ApplicationWorkflowPage.tsx`), a simpler direct status-transition UI.
  Both now correctly ratchet the student's membership tier on approval (fixed in Phase 7 after being found broken in the second screen only).
- **Queue triage (Phase 10)** — the Applications list computes a per-row queue tag (Urgent, Missing Guarantor, Waiting Documents, Waiting Student, Waiting University, Waiting List, Ready for Review) and offers quick-filter chips, so staff can immediately spot which applications are blocked and why without opening each one individually. The tag is computed fresh on every load (current status, time since last update, and whether a live guarantor relationship exists) — not a stored field, so it can never go stale. Filtering is client-side over the current page today, accurate at pilot scale but worth revisiting if application volume grows past a page size.
- **Admin Pipeline tracker (workflow architecture redesign)** — the application detail page's Overview tab shows a 12-stage internal-operations tracker (Draft through Active Student — see §10's "Two views of one application") in place of the raw `current_status` string, alongside the Completeness Checklist. This is a genuinely different vocabulary from what a student sees on the exact same application — see §3's `/application` timeline.
- **Rejection** — of either a Membership Request or a Tuition Facilitation application, each with its own notification template and its own "this is not the end of the relationship" framing.
- **Document requests** — mark a required document as needing resubmission, triggering `document_requested`.
- **Notifications** — every email the system sends is recorded in `notification_logs` with a sent/failed status per attempt, and (locally) visible in real time via MailHog.
- **Audit logs** — every significant staff/system action (membership decisions, status transitions, guarantor invite accept/decline, etc.) is recorded in `audit_logs` with actor, timestamp, and before/after values where captured. Visible via the Admin Audit Log page.
- **Status changes** — the full state-machine detail is in §10.
- **Escalation paths** — there is no formal, distinct "escalate to a supervisor" mechanism in the product today; `SUPER_ADMIN` is effectively the only staff tier with broad authority (see the role-provisioning gap noted in §1/§12), so in practice every staff account today already holds full authority and there is no one to escalate *to* within the system itself.

---

## 10. State Machine

### Two views of one application: Admin Pipeline vs. Student Timeline

**Workflow architecture redesign.** `applications.current_status` (documented in full below) is, and remains, the one real stored state machine — it is genuinely internally consistent. But it mixes CRM-intake vocabulary (`new_lead`, `contacted`, `waiting_for_documents`) with automated-gate vocabulary (`capital_queue`, `more_info_required`) with post-decision operational vocabulary (`contract_signed`, `university_confirmed`) in a single flat enum, because that mixture genuinely reflects how the internal process works. The mistake was ever showing that same vocabulary to a student — "capital_queue"? "more_info_required"? — which is exactly the kind of raw, uninterpreted internal state this platform's own first principle (§ FORSA_PRINCIPLES.md — "students always know the next step") exists to prevent.

The fix is **not** a second stored status. It's two pure, stateless functions (`applications/application-stages.util.ts`) that each take the same input — `current_status` plus document/guarantor completeness (which `current_status` alone doesn't capture) — and produce two different, audience-appropriate vocabularies:

**Admin Pipeline** (internal operational process — `computeAdminStage`, surfaced as `application.adminStage` on the admin detail view):

```
Draft → Submitted → Completeness Verification → Guarantor → AI Review →
Internal Review → Pre-Approval → Contract → University Confirmation →
Approved → University Payment → Active Student
```

- **Draft** — not a stored state at all; it's the wizard in progress, before the student has completed all mandatory information. The admin pipeline never receives anything before this point — `createForSelf` rejects incomplete submissions outright (§5).
- **Completeness Verification** / **Guarantor** — precedence-ordered checks applied while an application is still at `new_lead`/`contacted`/`waiting_for_documents`/`documents_received`: documents not all reviewed yet takes priority display over guarantor not yet accepted, which takes priority over "just hasn't been picked up by staff yet."
- **AI Review** — documents and guarantor are both settled, but the application hasn't formally moved to `under_review`. (In the current implementation the AI interview itself runs client-side during the wizard, before submission — this stage represents the gap between "everything's in" and "a human is now actively looking at it," not a separate backend AI processing step.)
- **Internal Review** — `under_review`, `more_info_required`, `on_hold`, `capital_queue`, `appealing` all collapse into this one stage; `capital_queue` additionally carries its own "Waiting List" badge (never worded as a rejection, per §3/§13).
- **Pre-Approval** — `approved_level1/2/3`, before a contract exists.
- **Contract** — `contract_sent`, `contract_signed`.
- **University Confirmation** — `university_confirmed`.
- **Approved** — has no distinct stored status of its own (there is no real gap between `university_confirmed` and `university_paid` to hold it). It completes together with University Confirmation once the application has progressed to University Payment or beyond, rather than inventing a new stored value for what is, in the current implementation, a single instantaneous checkpoint rather than a lingering state.
- **University Payment** — `university_paid`.
- **Active Student** — `active_student`, `completed`.
- `rejected`, `fraud_flagged`, `withdrawn` are modeled as **exceptions**, shown as a distinct badge outside the linear sequence — never as "stuck at stage N," because none of them are a stalled happy path; they're real, different outcomes (and rejection specifically is never terminal — §2/§13).

**Student Timeline** (customer journey, plain language — `computeStudentMilestone`, served via the self-scoped `GET /applications/me/:id/timeline`):

```
Application Started → Application Submitted → Documents Verified →
Guarantor Status → Under Review → Decision → University Confirmation →
Active Student
```

Every internal CRM term is absent by construction — a student's `current_status` might be `capital_queue` or `more_info_required` and they will only ever see "Under Review." "Guarantor Status" and "Decision" carry a live detail line (the guarantor's real status; "Approved"/reassuring not-approved copy) rather than just a checkmark, since those two milestones are as much about *what's true right now* as about *progress*.

**Why this guarantees synchronization rather than just achieving it once:** both functions are computed fresh on every read, from the same two inputs, with no second stored value anywhere for either one. There is nothing to keep in sync by hand and nothing that can silently drift — the two views can describe an application differently, but they cannot disagree about where it actually stands, because they're both looking at the exact same ground truth. Verified live against real applications in every representative state (early review with no guarantor, and fully active) — see `MANUAL_TESTING_FINDINGS.md` for the specific side-by-side checks performed.

### `applications.current_status` (the primary entity state machine)

| From | Allowed to | Notes |
|---|---|---|
| `new_lead` | `contacted`, `waiting_for_documents`, `under_review` | Self-submitted applications skip straight to `under_review` via the pipeline's Stage 8 — the AI interview stands in for the CRM "contacted" step |
| `contacted` | `waiting_for_documents`, `rejected` | |
| `waiting_for_documents` | `documents_received`, `on_hold` | |
| `documents_received` | `under_review` | |
| `under_review` | `approved_level1/2/3`, `rejected`, `on_hold`, `waiting_for_documents`, `capital_queue`, `more_info_required`, `fraud_flagged` | The main decision fork |
| `more_info_required` | `under_review`, `rejected` | Post-assessment feedback loop, distinct from the pre-submission `waiting_for_documents` |
| `approved_level1/2/3` | `contract_sent`, `on_hold` | |
| `rejected` | `appealing`, `new_lead` | **Rejection is never terminal** — a fresh application or a formal appeal is always possible |
| `on_hold` | `under_review`, `rejected`, `waiting_for_documents` | |
| `capital_queue` | `under_review`, `rejected` | The waiting list |
| `fraud_flagged` | *(none)* | **Terminal by design** — protects the permanent-blacklist guarantee; reopening would undermine it |
| `contract_sent` | `contract_signed` | |
| `contract_signed` | `university_confirmed` | |
| `university_confirmed` | `university_paid` | University's one write action lands here |
| `university_paid` | `active_student` | |
| `active_student` | `completed`, `withdrawn` | |
| `appealing` | `under_review`, `rejected` | |

**Forbidden transitions:** anything not listed above for a given state is rejected with an explicit "Invalid status transition: X → Y" error — there is no silent fallback or default path.

**Invalid situations / recovery:** an attempt to skip a required step (e.g., confirming enrollment before a contract is signed) is rejected outright by the university-portal's `confirmEnrollment` check, which validates the current status server-side rather than trusting the request. There is no automatic recovery mechanism for a stuck `on_hold`/`more_info_required` application beyond a staff member manually moving it forward once the blocking issue is resolved — this is by design (a human must confirm the blocker is actually cleared).

### `students.membership_status`

| From | Allowed to | Notes |
|---|---|---|
| *(none)* | `bronze` | Only path in: Membership Request approval |
| `bronze` | `silver`, `gold`, `blacklisted` | |
| `silver` | `gold`, `blacklisted` | Never back to `bronze` |
| `gold` | `blacklisted` | Never back to `bronze`/`silver` |
| `blacklisted` | *(none observed in code)* | Fraud path — no reinstatement mechanism found in the current implementation |

**Forbidden:** any downward move (`gold`→`silver`, `silver`→`bronze`, etc.) is prevented at the application layer by the rank-comparison check in the tier-ratchet logic — the database column itself has no `CHECK` constraint enforcing this, so the *only* protection is the service-layer code path. Anyone writing directly to the database (a manual SQL fix, a future script) could bypass this; there is no defense-in-depth at the schema level. Flagged as a recommendation in §15.

### `student_guarantors.status`

`pending_invitation` → `active` (on accept) or `declined` (on decline) or `withdrawn` (a separate, manually-triggered removal not covered by the invite flow itself). No transition exists from `declined`/`withdrawn` back to `active` without creating a brand-new invitation.

### `guarantors.invite_token` lifecycle

A live token exists only between invitation and (accept | decline | resend | expiry). It is a single physical column — `NULL` means "no live invite outstanding" (either never invited, already accepted, already declined, or superseded by a resend). There is no separate historical log of *previous* tokens; a resend simply overwrites the value.

### `membership_requests.status`

`pending` → `approved` or `rejected`. Both are terminal for that specific request row; a new request is a new row.

### Document status (`documents.status` / `application_documents.status`)

`uploading` → `uploaded` → `under_review` → `verified` or `rejected` → (possibly) `expired`/`superseded` if a newer version is uploaded.

### Contract status (`contracts.status`)

`draft` → `sent_for_signature` → `fully_signed` → `active`.

### Payment / Installment status

Installments: `pending` → `due_soon` → `due_today` → `paid`/`partial`/`late` → `default_risk` → `defaulted`, or `settled`/`waived`.
Payments: `pending` → `confirmed`, or `reversed`/`failed`/`refunded`.

---

## 11. Notifications

All 14 templates that exist today, every one email-only:

| Template code | Trigger | Recipient | Content summary |
|---|---|---|---|
| `membership_submitted` | Membership Request submitted | Visitor | Confirmation, "we'll be in touch" |
| `membership_approved` | Membership Request approved | New student | FORSA ID + set-password link |
| `membership_rejected` | Membership Request rejected | Visitor | Explains no approval this time, includes reason if given |
| `digital_pass_ready` | Digital Pass issued (same transaction as Bronze approval) | Student | Points them to view their pass |
| `guarantor_invited` | Guarantor added to a student's record | Guarantor | Invite link, 7-day expiry notice |
| `application_created` | New application entered the system | Student | Acknowledges receipt |
| `document_requested` | Staff mark a document as needing resubmission | Student | Which document, why |
| `application_approved` | Application approved at any level | Student | Names the tier explicitly |
| `application_rejected` | Application rejected | Student | Explicitly reassures Bronze status is unaffected |
| `waiting_list` | Application routed to the capital queue | Student | Explicitly *not* worded as a rejection |
| `contract_ready` | Contract generated and ready to sign | Student | Signature link/instructions |
| `payment_due_soon` | An installment is approaching its due date | Student/Guarantor | Amount, due date |
| `payment_overdue` | An installment has passed its due date | Student/Guarantor | Amount, how overdue |
| `payment_confirmed` | Finance verifies a submitted receipt | Student/Guarantor | Confirmation, reference |

**Channels:** every template above is `email` only. The schema supports `sms`, `whatsapp`, `in_app`, and `push` as `NotificationChannel` values, and `notification_logs` is channel-aware — but **no SMS or push notification is actually sent by any code path today.** This is a real, current limitation, not a future-proofed feature already working: if the platform is described to a university partner as sending SMS reminders, that description would not currently be accurate.

**Delivery mechanics:** every notification send is fire-and-forget (`.catch(err => logger.error(...))`) — a failed notification is logged but never allowed to block or roll back the business transaction that triggered it. Locally, all outbound email is captured by MailHog rather than a real SMTP provider; production would need a real provider configured.

**In-app / dashboard notifications — a structurally dead feature.** The student portal's `/notifications` page calls `GET /notifications`, which queries `notification_logs WHERE channel = 'in_app'`. Every single notification actually sent anywhere in the codebase is sent with `channel: 'email'` — nothing ever creates a `notification_logs` row with `channel = 'in_app'`. The query, the endpoint, and the page all work correctly; there is simply never any data for them to return. This is not a "thin" feature, it is a **fully wired but permanently empty** one. Fixing it is a one-line decision away (either send a parallel `in_app` notification alongside each `email` one, or change the query to include email-channel logs too) but as of this writing, no student has ever seen anything on that page.

---

## 12. Permissions Matrix

Columns represent the four self-scoped portals (Student, Guarantor, University, Partner) plus staff (Admin/Finance, distinguished by which of the 61 named permissions their role actually holds). "View own" means scoped strictly to the caller's own data by server-side identity resolution — never a client-suppliable filter.

| Feature | Student | Guarantor | University | Partner | Admin (SUPER_ADMIN) | Finance (FINANCE_TEAM) |
|---|---|---|---|---|---|---|
| Membership Request | Create (as visitor) | — | — | — | View, Approve/Reject | — |
| Own application | View, Create, View history | — | — | — | View, Edit, Approve/Reject, Assign | View |
| Applications (all) | — | — | View own university's | View own referrals' | View, Edit, Approve, Assign, Export | View |
| Tuition Facilitation submission | Create (self) | — | — | — | Create (CRM path) | — |
| Confirm Enrollment | — | — | Create (own applications only) | — | — | — |
| Guarantor invite | — | Preview/Accept/Decline (own token) | — | — | Create, Resend, View status | — |
| Guarantor's own linked student | — | View own | — | — | View | — |
| Documents | Upload, View own | Upload receipt on behalf | View own university's students' | — | Review, Approve/Reject, View | View |
| Payments | View own, submit receipt | Submit receipt on behalf, initiate Konnect on behalf | View own students' (read-only) | — | Record, View | Record, Reverse, View |
| Contracts | View own (sign) | — | — | — | Generate, Send, View | View |
| Digital Pass | View own | — | — | — | View, Revoke | — |
| Reports | — | — | Export own | View own commissions/referrals | CEO, Sales, Finance, Collections, Partners, Audit | Finance, Collections |
| Audit Log | — | — | — | — | View | — |
| Users (staff accounts) | — | — | — | — | Create, Edit, Deactivate, Assign role | — |
| University records | — | — | View own | — | Create, Edit, Approve agreement | — |
| Partner records | — | — | — | View own | Create, Edit | — |
| Partner commissions | — | — | — | View own (if a record exists — see §7 gap) | Approve | — |
| Pipeline / AI scoring | — | — | — | — | Run, Review, View | — |
| Fraud flagging | — | — | — | — | Flag | — |
| Exceptional events | — | — | — | — | Open, View | — |

**Delete** is notably absent as a capability anywhere in this matrix for any role. There is no exposed "delete a student," "delete an application," or "delete a guarantor" action in the product for good reason — the audit-trail-preservation philosophy in §1 makes hard deletion something the system actively resists (see the immutable `membership_status_history` table). Where cleanup is genuinely needed (e.g., abandoned test data), it currently requires direct database access, not a product feature.

---

## 13. Business Rules

- **One active Tuition Facilitation request at a time.** A student cannot have two applications in flight simultaneously; a new submission is blocked with a specific error until the existing one reaches a terminal state (rejected/completed/withdrawn). *(Added during the Phase 8 audit — did not exist before.)*
- **Guarantors can be resent an invite, but not silently replaced.** Only one live invite token exists per guarantor at a time; resending invalidates the previous one. There is no "swap this guarantor for a different person" action short of adding a new guarantor and manually withdrawing the old link.
- **Renewals are a field, not a flow.** `is_renewal` exists on `applications` but nothing in the current self-service UI lets a student actually flag or select a renewal — every self-submitted application is `is_renewal: false`.
- **Duplicate prevention on Membership Requests.** A visitor cannot submit a second pending Membership Request for the same email, nor submit one at all if that email already belongs to an active student.
- **Membership tier only ever moves upward** (bronze → silver → gold), and only as the direct, automatic result of an approved Tuition Facilitation Plan at that tier — never a student-initiated "upgrade" request. Enforced in application code (§10), not at the database schema level.
- **Rejection never revokes existing membership.** A Tuition Facilitation rejection leaves `membership_status` untouched. A Membership Request rejection simply never creates an account in the first place — there's nothing to revoke.
- **Document validation is per-type, independent of the application's own status** — a document can be `rejected` and need resubmission without the whole application itself moving to `rejected`.
- **University confirmation is a hard gate.** `university_paid` cannot be reached without first passing through `university_confirmed`, and that in turn requires `contract_signed` — the state machine does not allow skipping ahead.
- **Fraud flagging is terminal and irreversible in the current implementation.** No transition exists out of `fraud_flagged`. This is a deliberate protection, but it also means there is currently no documented "we made a mistake, please reinstate" override path — if that's ever needed operationally, it would require a direct database intervention today, not a product action.

---

## 14. Edge Cases

- **Rejected users** — handled cleanly for both Membership Requests (no account ever created, notification now sent) and Tuition Facilitation applications (Bronze intact, clear reapply path). Verified live for both in Phase 8 testing.
- **Cancelled requests** — there is no explicit "visitor withdraws their own pending Membership Request" action; a visitor who changes their mind simply has to wait for staff to reject it, or contact staff directly. Not a broken flow, just a missing convenience.
- **Expired invitations** (guarantor) — handled with a specific, distinct error message ("This invite link has expired. Ask the student's FORSA contact to resend it."), verified live.
- **Duplicate accounts** — actively prevented at the Membership Request stage (existing pending request or existing active member with the same email both block a new submission) and at the guarantor-add stage (duplicate email as an existing guarantor for that student is rejected).
- **Wrong email** (student mistypes their own or a guarantor's email during intake) — there is no dedicated "correct this email" self-service flow; today this requires a staff member to intervene directly (e.g., resending a guarantor invite doesn't let you change the destination email — it must be corrected on the guarantor record first, which is an admin action).
- **Missing documents** — tracked per-document (`absent` status), with `document_requested` notifications; does not block the application from being reviewed, but would reasonably be expected to factor into an admin's decision.
- **University changes** — if a student needs to switch universities mid-application, there is no dedicated "transfer" workflow; this would today require staff to edit the application record directly rather than the system offering a guided path.
- **Payment failures** — a rejected receipt returns the payment to an unverified state with the student/guarantor expected to resubmit; there is no automated retry or escalation beyond that.
- **Unclaimed Bronze accounts** — an approved Membership Request immediately creates a real login account (`pending_verification`); if the set-password email link is never clicked, nothing currently expires or cleans up that account. Three such accounts from earlier testing were found still present during the Phase 8 audit.
- **Orphan prevention** — actively verified clean: no `users` row exists today with `portal_type='student'`/`'guarantor'` lacking a matching `students`/`guarantors` row, and no `guarantors` row has a `user_id` set without a corresponding active `student_guarantors` link.
- **Immutable audit rows blocking test cleanup** — a genuinely good design (append-only `membership_status_history`) has the side effect that a small number of test/demo student records can never be fully purged from the database once they've undergone a real tier change, only stripped of every other linked record. Worth knowing before assuming any cleanup script achieves a truly blank slate.

---

## 15. Pilot Readiness

**If tomorrow the first university starts using FORSA:**

**Would every employee know exactly what to do?** For the two roles that actually exist (`SUPER_ADMIN`, `FINANCE_TEAM`), yes — this manual and the underlying product cover their real responsibilities completely. But because only two roles exist against a 61-permission catalog, "every employee" in practice means "every employee who isn't finance gets full admin authority." For a first pilot with a small, trusted staff, this is workable. It stops being workable the moment FORSA hires someone who should see applications but not, say, manage user accounts or approve university agreements — that distinction cannot be expressed today.

**Would every workflow be understandable?** Yes. The state machines are explicit and enforced in code, not left to convention. The guarantor mid-application understandability gap noted in earlier drafts of this manual — the product asked "do you have a guarantor?" during `/apply` but didn't trigger anything from that answer — was closed in Phase 10: a student can now invite their own guarantor directly from a dedicated `/guarantor` page, reachable from the Bronze Dashboard checklist, with no staff action required. The Bronze Dashboard itself was also ambiguous about the next required action before Phase 10; it now shows an explicit progress checklist that always highlights the one current step.

**Would every decision be documented?** Yes — every approval, rejection, and status change is captured in `audit_logs`, and the state machine forbids undocumented/invalid transitions outright rather than allowing silent shortcuts.

### Operational gaps — status after Phase 14

Full detail and verification evidence for everything below is in `PILOT_BLOCKERS_STATUS.md`, `PHASE10_IMPLEMENTATION_REPORT.md`, `MANUAL_TESTING_FINDINGS.md`, and `PHASE14_FINAL_CASE_FLOW_REPORT.md`. Summary:

**Closed — Phase 14 (Final Case Flow Refinement), the validated final V1 workflow:**
- Tuition/support amount are never typed by the student — always server-derived from `programs.tuition_amount`, verified live against a forged client-supplied value being silently ignored.
- The pipeline's Stage 1 Completeness Gate no longer requires any document upload (which would otherwise now block every application, since documents are verified in person at the meeting instead) — it checks the requested plan and fee acknowledgment instead.
- A real, deterministic internal FORSA Stability Score (Guarantor 60% / Household 20% / Payment Capacity 15% / Student Bonus 5%) now exists and is computed automatically — see `STABILITY_SCORE_MODEL.md`.
- Discovered and fixed while implementing this phase: the guarantor portal had a complete i18n system built (`useLocale`, full FR/EN/AR translation catalogs) but **no language switcher rendered anywhere** in the logged-in portal — every screen was hardcoded French regardless of locale. Added a working switcher; the pre-existing rest of that portal (payment ledger, student summary card) remains untranslated as a separate, smaller follow-up (see `PHASE14_FINAL_CASE_FLOW_REPORT.md`'s remaining risks).

**Closed — workflow alignment fix (most severe, found via manual pilot testing):**
- The admin pipeline's Stage 1 Completeness Gate was blocking **every** self-submitted application, because the wizard never collected the documents, program, or guarantor the gate actually requires. The system was creating applications guaranteed to fail immediately. Now: the wizard has mandatory Documents and Guarantor steps, `createForSelf` validates completeness before an application is ever created, and the admin detail view shows a real Completeness Checklist. Verified live: Stage 1 now genuinely passes for a properly-completed submission.
- A second, compounding gap found in the process: the `programs` table was completely empty tenant-wide, meaning `program_id` — one of Stage 1's hard requirements — could never actually be populated through the real UI for any university, independent of anything else. Seeded 5 real programs for the one existing partner university; this needs to be done for any additional university added before its students can ever successfully apply.

**Closed in Phase 10:**
- Guarantor invitation is now genuinely student-initiated, no staff action required (further embedded directly into the Apply wizard by the workflow alignment fix above).
- The Bronze Dashboard's ambiguous single next-action card replaced with a real progress checklist.
- The waiting list (`capital_queue`) experience now explains what's happening, confirms Bronze is intact, gives an estimated queue position, and says what to do while waiting — instead of falling through to a generic "in progress" message.
- The admin Applications list now surfaces computed queue-blocker tags (Urgent, Missing Guarantor, Waiting Documents, Waiting Student, Waiting University, Waiting List, Ready for Review) so staff can spot stuck applications without opening each one.

**Still open, deliberately (each is a scoping question or hardening recommendation, not a live defect):**
1. **Partner commissions never auto-create** (§7) — a real gap only if a referral partner is part of this specific pilot. Needs a product decision on trigger timing before building.
2. **Role granularity doesn't match the permission catalog** (§1/§12) — only two roles exist against 61 defined permissions. Fine for a small pilot team; a blocker the moment staff needs to be differentiated.
3. **No database-level enforcement of the membership-tier ratchet** (§10) — the "never downgrade" rule lives only in application code. Low risk today, worth hardening before more people have database access.
4. **Unclaimed Bronze accounts never expire** (§14) — not disruptive at pilot scale.
5. **Konnect online payment is unverified** (§8) — fine if the pilot only uses manual bank transfer (verified working).
6. **No SMS/push notifications actually send today** (§11) — schema-ready, not built. Don't describe this as live to a pilot partner.
7. **No renewal flow, despite the field existing** (§8/§13) — only relevant if a returning student is expected during the pilot window.
8. **Fraud-flagged accounts have no reinstatement path** (§13) — acceptable if fraud-flagging is genuinely meant to be permanent and human-reviewed before it's ever applied.
9. **A pipeline can still block later at Stage 3** ("no active university agreement found") for a university with no agreement on file — separate from and unaffected by the Stage 1 fix above; confirm every partner university involved in the pilot has an active agreement row before relying on the automated pipeline path for their students.

None of the above are Critical in the sense of corrupting a business process today, now that the workflow alignment fix has closed the one gap that genuinely was. The core membership → guarantor → application (with real documents) → completeness gate → tier-assignment → payment loop that a first pilot actually needs was verified working end-to-end against the live stack.
