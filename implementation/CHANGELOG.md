# FORSA — Changelog

## 2026-07-05 (continued — Phase 2 Milestone 7: Admin decision flow)
- New migration `010_admin_decision_flow.sql`: `applications
  .financing_tier`, `reviewer_decisions.financing_tier`/`is_override`,
  new `fraud_records` table. Verified against a real Postgres instance.
- Full outcome set (T-213): `submitHumanDecision` gained `waiting_list`
  (reuses the existing `capital_queue` mechanism); `ApplicationStatus`
  gained `MORE_INFO_REQUIRED`/`FRAUD_FLAGGED` — and the 6 dead V2-vocabulary
  enum values (deferred since Milestone 2) were finally retired here.
- Found and fixed a real bug: Stage 10 never had a status-map entry for
  `DecisionResult.CAPITAL_QUEUE`, so a soft-blocked application's status
  silently never updated.
- Financing tier + membership ratchet: approval can set silver/gold,
  ratchets `students.membership_status` up (never down, per D-004).
- CEO override (T-214 remainder): new `financing.override` permission,
  dedicated `overrideDecision()` method (never a branch inside the normal
  decision path), always distinctly audited.
- Risk rules (T-215): high-risk capital cap (10% default) and the
  D-010-resolved family exposure cap (100,000 TND default, grouped by
  primary guarantor) added to Stage 6. Returning-member-priority and
  first-year-risk deliberately deferred, flagged not dropped.
- Fraud/blacklist (T-217): dedicated `POST /pipeline/runs/:id/fraud`,
  blacklists the student + flags the application in one transaction.
  Matching key is a normalized-email hash for V1 (national ID isn't a
  structured field anywhere yet) — flagged honestly in the migration.
- Built the human-decision review UI in `forsa-dashboard`, which turned
  out not to exist at all despite the API helper existing since Phase 1.
  New Fraud Records admin page (was an empty placeholder).
- 12 new tests, 97/97 backend tests passing.

## 2026-07-05 (continued — Phase 2 Milestone 6: Household Stability / AI Review)
- New `src/ai/household-stability.util.ts`: the approved D-003 weights
  (35/25/20/10/10) + a pure `computeHouseholdStabilityScore()`. Stored in
  the existing `applications.ai_report`/`ai_score_overall` (no new
  columns needed beyond migration 009).
- Fixed a real trust gap found while building this: `ai_score_overall`/
  `ai_recommendation` used to be stored directly from the client's
  request body, unvalidated. `ApplicationsService.create()` now
  recomputes both deterministically server-side.
- Wrote the exact "lower-income-but-stable household outranks a
  wealthier-but-less-responsible one" test case T-211 calls for.
- Updated `InterviewPage.tsx`'s scoring prompt to the 5 canonical
  dimension names; stopped asking the AI to self-report an overall score.
- Traced the consequence: fixed `forsa-dashboard`'s `RankingPage.tsx`,
  which was still reading the old dimension names and would have shown
  blank scores for every new interview.
- Verified D-008's boundary holds: `src/score/score.service.ts` untouched.
- 8 new tests, 92/92 backend tests passing.

## 2026-07-05 (continued — Phase 2 Milestone 5: Financing Request)
- **Found the entire student-facing Financing Request submission flow was
  already broken**, independent of the new membership gate: (1)
  `POST /applications` requires a staff-only permission no self-registered
  student ever holds, (2) `InterviewPage.tsx` never sent `studentId`,
  (3) `NewApplicationPage.tsx` sent the wrong id (`user!.id`, not
  `students.id`), (4) `applications.ai_score_overall`/`ai_recommendation`/
  `ai_report`/`interview_language`/`interview_transcript` were referenced
  by the frontend and `seed-demo.ts` but never migrated — AI data was
  silently dropped on every submission.
- Fixed all four with one new route: `POST /applications/me`
  (`createForSelf`) — resolves the student via JWT identity, includes the
  AI fields, and gates on `membership_status IN ('bronze','silver','gold')`
  (T-207).
- New migration `009_financing_request.sql`: the 5 missing `applications`
  columns, plus `document_types.validity_months`/`documents.expires_at`
  (T-208/T-209 — confirmed, again, that "already scaffolded" per the task
  description was wrong). `DocumentsService.confirmUpload()` computes a
  real expiry; `stage1Completeness`'s document check now excludes expired
  documents even if still `verified`.
- Fixed `InterviewPage.tsx`'s submission error handling — used to
  silently swallow any failure and show a false success screen. Now
  shows a real error state with a link to `/join` on the gate rejection.
- Verified the migration against a real local Postgres instance (fourth
  time this phase).
- 7 new tests, 84/84 backend tests passing.

## 2026-07-05 (continued — Phase 2 Milestone 4: Digital Student Pass)
- New migration `008_digital_student_pass.sql`: `digital_student_passes`,
  one row per student, generate-once enforced via `UNIQUE(student_id)`.
  Verified against a real local Postgres instance.
- New `src/digital-pass/` module. Pass issuance happens *inside*
  `MembershipService.approve()`'s existing transaction — never a separate
  best-effort step.
- `GET /pass/verify/:token` (public): live check on both pass status and
  current membership status, so a blacklist immediately invalidates the
  pass.
- QR code generated server-side via the existing `qrcode` dependency — no
  new frontend dependency.
- `forsa-student`: new `/pass` page + top-bar nav icon.
- `forsa-dashboard`: `DigitalPassPage.tsx` (was an empty placeholder) now
  has real list + revoke.
- Checked and confirmed this does NOT resolve T-509 (a different,
  unrelated third-party QR call in `forsa-partner`) — corrected an
  initial overclaim before committing.
- 8 new tests, 78/78 backend tests passing.

## 2026-07-05 (continued — Phase 2 Milestone 3: FORSA ID generation)
- `generateForsaId()`: `FORSA-<year>-<6 hex chars>`, assigned in
  `MembershipService.approve()`. Uniqueness resolved via a pre-transaction
  SELECT-check loop, not a mid-transaction retry (a failed INSERT aborts
  the whole Postgres transaction without a SAVEPOINT — caught this before
  committing).
- `forsa-student`'s `HomePage.tsx` Membership Status / FORSA ID tiles now
  show real data instead of "Coming soon" placeholders.
- 2 new tests, 70/70 backend tests passing.

## 2026-07-05 (continued — Phase 2 Milestone 2: Membership Request → Bronze)
- New migration `007_membership_lifecycle.sql`: `membership_requests`,
  `students.membership_status`/`member_since`/`forsa_id`,
  `membership_status_history` (append-only), `password_setup_tokens`.
  Verified by actually running it against a real local Postgres instance
  on top of the full 001-006 chain.
- New `src/membership/` module: `POST /membership-requests` (public),
  staff list/approve/reject. Approval provisions `students`+`users`
  transactionally, issues Bronze, and — per D-001 — never invents a real
  password: emails a one-time hashed set-password link instead (new
  `POST /auth/set-password`, new `membership_approved` template).
- New `GET /universities/public` — the anonymous Membership Request form
  needs a university picker; the existing list route is staff-only.
- `forsa-dashboard`'s `MembershipQueuePage.tsx` (was an empty placeholder)
  now has real functionality.
- `forsa-student`: new `/join` (public form, now the primary sign-up path
  from `/login`) and `/set-password`.
- 8 new backend tests, 68/68 total passing. `tsc`/`build` clean across
  `forsa-os`, `forsa-dashboard`, `forsa-student`.

## 2026-07-05 (Phase 2 begins — decisions resolved, Milestone 1 done)
- Resolved D-003 (hardcoded, centralized Household Stability weights),
  D-008 (Household Stability/FORSA Score stay permanently separate), D-010
  new (family = student + primary guarantor household). User approved
  `PHASE_2_PLAN.md` with a revised 8-step execution order (§5a).
- **Milestone 1 (payment cleanup warm-up) done**: K-13 (Konnect now fires a
  FORSA Score event on confirmation) and T-219 (student portal complete
  payment history via new self-scoped `GET /students/me/payments`).
- Fixed a live bug found along the way: `recordedBy: 'system'` was being
  inserted into `score_events.recorded_by` (a `UUID` column), throwing on
  every automated score event — the pre-existing overdue-installment cron
  job silently swallowed this, meaning `PAYMENT_OVERDUE` events were never
  actually recorded. Fixed by widening the type to `string | null` and
  passing `null` for system-triggered events.
- Fixed a DI foot-gun found along the way: `guarantors.module.ts`
  redundantly redeclared `KonnectService` as a local provider despite
  already importing `PaymentsModule` (which exports it) — this would have
  broken resolving `KonnectService`'s new `ScoreService` dependency.
  Removed the redundant declaration.
- 60/60 backend tests passing, `tsc`/`build` clean on `forsa-os` and
  `forsa-student`.

## 2026-07-05 (continued — launch-blocker hardening sprint, all 7 fixed)
- Created `LAUNCH_BLOCKERS.md`: classified 33 remaining open issues as 7
  Launch Blockers / 26 Post-Launch. Fixed 4 stale `KNOWN_ISSUES.md` statuses
  found along the way (K-01/K-02/K-03/K-06 → FIXED). Commit `ea3ec7fa`.
- D-004 (unified status/membership model) proposed and **decided**: two
  distinct state machines (membership status vs. financing-request status).
  Sub-question resolved by user: Silver/Gold persists permanently once
  earned, no automatic lapse. Commit `bc437493`.
- **K-14** (ledger unification) — extracted shared `LedgerService`; fixes an
  actual SQL error the Konnect path would have thrown on every real
  confirmation (referenced nonexistent `debit_account`/`credit_account`
  columns, violated the `entry_type` CHECK constraint). `forsa-os` commit
  `f5891824`.
- **K-17** (AI model string) — `'claude-sonnet-4-6'` → `'claude-opus-4-8'`.
  Same commit as above.
- **K-12** (dual/executive approver enforcement) — `submitHumanDecision` now
  requires the correct number of distinct approvers before advancing the
  pipeline; added a same-reviewer-double-vote guard. Also added pipeline
  test coverage for stages 3-7 (K-09 remainder). 57/57 tests passing.
  `forsa-os` commit `6b252284`.
- **K-16 + K-47** (refresh-token strategy) — confirmed bearer-in-body is the
  only pattern the backend supports (no cookie fallback); fixed
  `forsa-finance` (`37daf06`), `forsa-guarantor` (`205002f`), `forsa-partner`
  (`4392768`, was hitting a broken relative URL with no base).
- **K-18** (fabricated demo-mode AI scores) — `forsa-student`'s demo-mode
  fallback no longer submits a `Math.random()` score as if real;
  `aiScoreOverall`/`aiRecommendation` explicitly `null` when demo mode was
  used. `forsa-student` commit `a7a9eec`.
- Docs sync across all fixes: `forsa-os` commit `57913abe`.
- **All 7 launch blockers are now fixed — zero remain.** See
  `PHASE_1_COMPLETION_REPORT.md` (new) for the full permanent record.

## 2026-07-05 (continued — T-111 closed, Phase 1 complete)
- K-45: seeded `payment_receipt` document type (migration
  `006_receipt_upload.sql` + `scripts/seed.ts`).
- K-46: added `payments.receipt_document_id` column; `submitReceipt` now
  verifies a client-supplied `receiptDocumentId` actually belongs to the
  student before persisting it (new `verifyReceiptDocument()` helper, 3 new
  tests).
- Guarantor portal receipt upload: added `POST
  /guarantors/my-student/payment-receipt/upload-url` +
  `.../confirm-upload` (guarantor-scoped, since `GuarantorsController` has
  no `PermissionsGuard` and guarantor users hold none of the staff
  `document.*` permissions); wired `forsa-guarantor`'s `PaymentsPage.tsx` to
  the real upload flow, matching the student portal's already-working
  pattern.
- Incidental fix: `submitReceiptOnBehalf`'s audit-log INSERT was using
  wrong column names, silently swallowed by a `.catch()` — guarantor
  payment submissions were never actually being audit-logged. Fixed.
- **Phase 1 is now complete — every item in `MASTER_TASK_LIST.md`'s Phase 1
  section is checked off.** Phase 2 (membership-first redesign) is
  unblocked. See `NEXT_SESSION.md` for the starting point.


## 2026-07-05 (continued — in-session completion of remaining Phase 1 items)
- T-102: guarantor self-registration — `POST /guarantors/register` (backend,
  `forsa-os` `7ed9caaa`) + rebuilt `RegisterPage.tsx` (frontend,
  `forsa-guarantor` `262b455`).
- T-106: wired `NotificationsService` into `applications`/`payments`/
  `documents`/`contracts` — the 8 originally-seeded email templates now
  actually fire (`forsa-os` `cdaba1d7`).
- T-107: verified `STATUS_TRANSITIONS` already rejects dead-vocabulary status
  writes correctly; hardened the API boundary with `TransitionStatusDto`
  (`forsa-os` `2826814b`).
- T-103 (frontend half): `forsa-partner`'s `loadPartner()` now calls
  `GET /partners/me` instead of `partners[0]` (`forsa-partner` `39c9a5f`).
- T-109: added the Phase 1 test foundation — 7 spec files, 33 tests
  (`forsa-os` `595e825a`).
- New gaps logged: K-47 (`forsa-partner` refresh interceptor uses bare
  `axios.post`, not the configured instance).
- Also finished, mid-session, the wiring the earlier rate-limited backend/
  dashboard workers left half-done: `POST /students/register`+`GET
  /students/me` controller routes (`forsa-os` `ca6cf80d`), and the dashboard's
  6 new nav items + i18n labels (`forsa-dashboard` `0054633e`).
- **Phase 1 status: all items `[x]` except T-111 (receipt upload), which
  remains partially done — blocked on backend gaps K-45/K-46, guarantor half
  never started.**


Terse, chronological, commit-style entries. One line per notable change.
For the "why"/narrative behind a session, see `IMPLEMENTATION_PROGRESS.md`.
For the full pre-existing history before this continuity system existed, see
`git log` in each repo — this file starts capturing forward from 2026-07-05.

## 2026-07-05
- **Backend + dashboard workers interrupted mid-task by an account session
  rate limit (reset 2:50pm Africa/Tunis); orchestrating session inspected
  both repos, confirmed both left clean/typechecking, and manually completed
  the specific in-flight edits each was cut off mid-way through:**
  - `forsa-os`: wired the already-written `registerSelf()`/`findMe()`
    service methods into `students.controller.ts` as `POST /students/register`
    (`@Public()`) and `GET /students/me` — completing T-101's backend half.
    Confirmed already-done by the backend worker before it was cut off:
    `GET /partners/me` (T-103), Konnect webhook `@Public()`+`@SkipThrottle()`
    fix (T-105), global `ThrottlerGuard` registration (T-110), and
    `database/schema/` archival to `docs/archive/schema-superseded/` (T-108).
    Confirmed NOT started: notifications wiring (T-106), backend status-enum
    enforcement (T-107 backend half), test suite (T-109), guarantor
    registration (T-102).
  - `forsa-dashboard`: added the 6 missing nav items
    (membershipQueue/financingQueue/aiQueue/waitingList/digitalPass/
    fraudRecords) to `Layout.tsx` plus matching en/fr/ar i18n labels — the
    icons were already imported by the interrupted worker, just not wired
    into the nav array yet. Confirmed already-done: payment-verification
    double-prefix fix (T-104), status Badge/filter recognition for both
    vocabularies (T-107 frontend half), hardcoded `localhost:3000` links
    fix (T-113/T-516), role-assignment UI (T-112, with a flagged gap — no
    `GET /roles` backend route exists yet), and pending-page route scaffolding
    for the 6 new Phase 2 sections (T-221).
  - Both repos verified: `tsc --noEmit` clean, `npm run build` clean, no
    commits made (left in working tree for review).
  - Three new backend gaps logged: K-44 (`GET /roles` missing), K-45
    (`payment_receipt` document type missing), K-46 (`receiptDocumentId`
    column missing on `payments`).
- **Student portal worker (forsa-student) completed Phase 1 pass.** Fixed 4
  real `tsc --noEmit` errors (missing `vite-env.d.ts` ambient types, missing
  `lucide-react` imports in `PaymentsPage.tsx`). `RegisterPage.tsx` now sends
  `password` to `POST /students` and shows an honest failure message instead
  of a misleading one; added `ForgotPasswordPage.tsx` + `/forgot-password`
  route (support-contact placeholder). `PaymentsPage.tsx`'s receipt upload now
  runs a real S3 presigned-upload flow instead of sending only a filename
  (blocked on two backend gaps — see T-111). `HomePage.tsx` rewritten around
  the new membership-first field order (Welcome/Membership Status/FORSA
  ID/Digital Pass/Profile Completion/Financing Status/Next Action/Payment
  Status) with clearly-marked placeholders for the 3 fields with no backend
  endpoint yet. No commits made — changes left in the working tree for review.
- Created `/implementation` continuity workspace in `forsa-os`
  (`MASTER_TASK_LIST.md`, `IMPLEMENTATION_PROGRESS.md`,
  `IMPLEMENTATION_NOTES.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`,
  `NEXT_SESSION.md`, `CHANGELOG.md`).
- Captured the FORSA V1 Master Implementation Specification
  (membership-first redesign) verbatim in `IMPLEMENTATION_NOTES.md` and
  restructured `MASTER_TASK_LIST.md` into Phase 1 (critical fixes) → Phase 2
  (redesign) → Phase 3 (testing) → Phase 4 (deliverables) → Phase 5 (cleanup).
- Logged 9 open/decided architecture questions in `DECISIONS.md` (D-001–D-009).
- Created parallel worker prompts `WORKER_BACKEND.md`, `WORKER_STUDENT.md`,
  `WORKER_DASHBOARD.md` for the first batch of Phase 1 work.
- No product code changed this session.

---

## Pre-existing history (reconstructed from `forsa-os` git log, for reference)

- `7c6aa408` (2026-06-30) security: untrack `.env.local` and expand `.gitignore`.
- `f5be99be` (2026-06-30) fix: wire `CurrentUser`/`CurrentTenant` into guarantors controller (was using local no-op stubs, causing 500s on every `/guarantors/*` call).
- `94a36b2d` (2026-06-30) fix: correct LIMIT/OFFSET parameter index in `listReceipts` (was casting the tenant UUID as the LIMIT value).
- `c4565ffb` (2026-06-28) add seed script.
- `d7115d22` (2026-06-28) fix payments module all dependencies.
- `41e0ffa4` fix payments module konnect dependency.
- `35ac4ca3` fix guarantors module dependency.
- `a2011781` remove node_modules from git.
- `ff7ae076` fix argon2 native build.
- `42e3e590` fix dist path.
- `d846afd8` fix dockerfile.
- `4c3cd40b` fix all build errors.
- `73191960` fix all ts build errors.
- `29852481` fix tsconfig for production.
- `a8022a02` fix ts errors for production build.
- `0e050ec2` add package-lock.json.
- `fa5b6644` FORSA API - initial deploy.
