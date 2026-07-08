# Workflow Audit Report

Audit of the running product against `FORSA_WORKFLOW_GUIDE.md`. For each workflow: what was checked, what was found, and what changed as a direct result of this pass. Live browser/API test evidence is in `BROWSER_TEST_REPORT.md`; the severity-ranked open items are in `PILOT_BLOCKERS.md`.

## Method

For each of the 8 documented workflows: read the actual backend service/controller code (not just the frontend), cross-check every state transition against `STATUS_TRANSITIONS`/enum definitions, check the database for orphaned records, grep for raw translation keys and placeholder links across all 6 frontend portals, and live-test the result via real HTTP calls and a real browser wherever practical.

## Findings and fixes made during this pass

### 1. No duplicate-request prevention (Tuition Facilitation) — fixed
`ApplicationsService.createForSelf` had zero check for an existing in-flight application. A student could submit any number of Tuition Facilitation requests simultaneously — no error, no warning, just N parallel applications for the same student. Fixed by blocking on any application not in a terminal state (`rejected`/`completed`/`withdrawn`), so the "Apply Again" path after a rejection continues to work. Verified live (see Browser Test Report §2.2).

### 2. `isRenewal` bound to the wrong field — fixed
`InterviewPage.tsx`'s submission set `isRenewal: studentData.isCurrentStudent === 'yes'` — a completely different question ("are you currently enrolled" vs. "is this a renewal of a previous plan"). Every current-student applicant was silently mislabeled as a renewal in the database. There is no renewal-selection UI anywhere in the product, so this is now always `false` rather than guessing from an unrelated field.

### 3. Generic error message on submission failure — fixed
The AI interview's submit handler already had a specific 403 branch (added in an earlier phase) but fell through to a generic "something failed, contact support" message for everything else, including the new 400 duplicate-request block. Fixed to surface the backend's specific message for 400s too.

### 4. Three real, live placeholder phone numbers — fixed
`ForgotPasswordPage.tsx` had an actual clickable `tel:+216XXXXXXXX` link (going nowhere), and `DocumentsPage.tsx`/`PaymentsPage.tsx` displayed `+216 XX XXX XXX` as if it were a real support number. All three sat next to a real, working support email — removed the fake phone number in each case rather than inventing a number that looks real but isn't.

### 5. Membership request rejection sent zero notification — fixed
Every other decision point in the product (membership approval, application approval/rejection, guarantor invite) emails the affected person. `MembershipService.reject()` was the one exception — it updated the request's status and nothing else. A rejected visitor had no way to know a decision was even made. `NotificationsService` was already injected into the class (used for the other two membership emails) and simply never called here. Added a `membership_rejected` template and wired it in. Verified live: a real test rejection produced a real email in MailHog with the reason included.

### 6. Two test regressions introduced by this session's own earlier fixes — fixed
The Phase 7 tier-ratchet fix and the new duplicate-request check (item 1 above) both added new `dataSource.query()` calls inside `transitionStatus`/`createForSelf` that existing unit test mocks didn't anticipate, breaking 2 previously-passing tests. Fixed the mocks and added dedicated tests for the new behavior instead of just patching the existing ones.

### 7. Stale mock in `membership.service.spec.ts` — fixed
A test for `createRequest`'s happy path only mocked 2 query calls, but the method makes 3 (pending-request check, active-member check, insert) — the active-member check was added in an earlier phase without updating this test, so it started throwing "already exists" instead of succeeding. Fixed the mock sequence.

### 8. Guarantor invite/accept/decline lifecycle had zero test coverage — fixed
The entire mechanism built in Phase 7 to replace public guarantor self-registration (`previewInvite`/`acceptInvite`/`declineInvite`) had no unit tests at all. Added 13 tests covering every distinct error path (invalid/used/declined/expired token, weak password, existing account) and the "no orphan account on decline" invariant.

## Confirmed, unfixed gaps (out of scope for this pass — see rationale)

### Partner commission auto-creation never triggers
`partners.service.ts` has a fully-built, correct `calculateCommission`/`createCommissionRecord` pair (splits gross amount into FORSA's share and the partner's share), and a real `partner_commissions` table with a working UI on top of it. But **nothing in the codebase ever calls either function automatically** — not on application approval, not on payment, not on disbursement. A commission row today only exists if someone inserts it directly. This is a real, confirmed gap, not fixed here because closing it requires a business decision this audit shouldn't invent unilaterally: *when* should a commission actually get created — on approval, on first payment, on full disbursement? Each has different implications for when a partner gets paid. Flagged in `PILOT_BLOCKERS.md`.

### No "email verification" gate on the public Membership Request
The Phase 8 task description described an "email verification" step between submission and pending review. The real flow has no such gate — the Membership Request form is genuinely public/unauthenticated, and the first email a visitor receives is the submission confirmation itself, not a verification link. This isn't a bug so much as a documentation-vs-reality mismatch; noted explicitly in the Workflow Guide rather than silently building a new verification step that wasn't asked for as a fix.

### Unclaimed Bronze accounts never expire
An admin-approved Membership Request immediately creates a real `users` row (`status = 'pending_verification'`) alongside the set-password email. If the student never clicks the link, that account sits in `pending_verification` forever — no scheduled job reaps it. Found 3 such accounts from earlier-phase testing still present in the database (harmless, but a real gap: nothing distinguishes "just approved, email in flight" from "abandoned 6 months ago"). Low priority for a single-university pilot's timescale, but worth a scheduled cleanup job before a larger rollout.

### Konnect (online payment gateway) integration unverified
`konnect.service.ts` and its webhook endpoint exist in the codebase and look complete, but were not part of this session's live verification pass (no sandbox credentials configured locally). Documented as "exists, unverified" rather than either "confirmed working" or "broken."

### Two admin "advance application status" screens still exist as separate UIs
`ApplicationDetailPage.tsx` (pipeline/human-decision) and `ApplicationWorkflowPage.tsx` (plain status transition) remain two different screens — a divergence first flagged in the Phase 5 UX audit. Phase 7 fixed the *behavior* gap between them (both now correctly ratchet the student's tier on approval); unifying them into one screen is a larger UI refactor, deliberately out of scope for a workflow-correctness pass.

## What was checked and found already correct

- **No orphan users/guarantors** in the database (`users` with `portal_type='student'`/`'guarantor'` but no matching `students`/`guarantors` row; `guarantors` with a `user_id` set but no active `student_guarantors` link) — all zero.
- **No raw translation keys** render anywhere reachable — re-swept all 4 portals that use a `t()`-key system (student, partner, dashboard; university has no such system) after the Phase 7 `bronze*` key fix; confirmed clean.
- **Self-scoping holds** for all four non-staff portals (student, guarantor, university, partner) — each resolves its own identity server-side from the JWT and never trusts a client-supplied ID, confirmed via both code audit and live 403 checks against staff-only routes.
- **Membership tier ratchet** now behaves identically regardless of which admin screen performed the approval (the Phase 7 fix, re-verified live in this pass — see Browser Test Report §4).
- **`membership_status_history` and (implicitly, by the same pattern) any other append-only audit table is immutable by design** — a Postgres rule blocks `DELETE`/`UPDATE` outright. Discovered while cleaning up test data; a genuinely good compliance-oriented design choice, not a bug. (This does mean a small number of clearly-labeled test/demo student rows from this and earlier sessions can never be fully purged from the database — harmless, but worth knowing before assuming any cleanup script can fully reset demo data.)

## Phase 13 — Case Management & Dual Applicant Workflow

A structural finding, distinct from the discrete bugs above: the platform's data model and UI treated the student and guarantor as two disconnected participants, each with their own status and their own portal, with no single representation of "the complete financial picture FORSA is actually deciding on." Requested fix: redesign the application experience and data model around one **Case File** (Student + Guarantor + Educational Request), without touching core business logic, permissions, or the operational pipeline.

Full architecture, entity relationships, state machine, lifecycle, and rationale for every design decision (including why a new `cases` table was deliberately rejected in favor of an aggregation view) is in `CASE_MANAGEMENT_ARCHITECTURE.md`. Summary of what changed:

- **Schema (additive only)** — `students` and `guarantors` gained financial/personal profile columns; `applications` gained `expected_graduation_date`; a genuinely new `case_meetings` table closes a gap that existed before this phase (`guarantors.service.ts` had a hardcoded `activationMeeting = null` with a comment noting the table had never been built, despite the product's own email templates already anticipating an "Activation Meeting").
- **A guarantor's Financial Responsibility Profile is now a real, trackable step** (`financial_profile_completed_at`), not an assumption — the guarantor portal shows its own Case Status card (Profile / Documents / Meeting) with a live next-action.
- **The admin application detail page gained a "Case Summary" tab** bundling student summary, guarantor summary, documents, AI analysis, risk flags, and meeting status/scheduling — instead of staff reconstructing one underwriting decision from five separate tabs.
- **The student's Application page gained a "Next Required Action"** — one plain-language sentence, computed server-side from the same data the admin Case Summary and guarantor Case Status use, so all three views can never disagree about where the Case actually stands.
- **No change to `applications.current_status`, its transition table, the automated pipeline, or any permission** — confirmed by re-running the full backend test suite (185/185 passing, no existing test touched) and re-smoke-testing all 6 portals after redeploy.
