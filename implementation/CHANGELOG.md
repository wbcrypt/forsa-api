# FORSA — Changelog

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
