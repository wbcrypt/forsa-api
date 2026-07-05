# FORSA — Implementation Progress

Chronological session log. Newest session at the top. Each entry: date, what
was worked, what actually changed (files/commits), what's still open. This is
the "what happened" record — `CHANGELOG.md` is the terse commit-style list,
this file has the narrative.

---

## Session — 2026-07-05

**Goal**: stand up the `/implementation` continuity workspace per the user's
"Option 1, treat as long-running project" instruction, so future sessions
never depend on conversation memory.

**What happened**:
1. Read `FORSA_PLATFORM_SPEC.md` (full 780-line reverse-engineering doc) and
   `AUDIT_REPORT.md` (30 Jun 2026 live audit) end-to-end.
2. Cross-checked the audit's "bugs found and fixed" list against actual git
   history in `forsa-os` — confirmed 3 of them are genuinely fixed in this
   repo (see `KNOWN_ISSUES.md` "Already fixed" table).
3. Verified all 6 sibling frontend repos exist on disk as independent git
   repos (`forsa-dashboard`, `forsa-student`, `forsa-university`,
   `forsa-partner`, `forsa-finance`, `forsa-guarantor`).
4. Created the 7 required files in `/implementation`.
5. Mid-session, the user delivered the **FORSA V1 — Master Implementation
   Specification** (the membership-first redesign spec) — folded this in as
   the authoritative forward plan: rewrote `MASTER_TASK_LIST.md` into 5
   phases (Phase 1 critical fixes → Phase 2 membership-first redesign →
   Phase 3 adversarial testing → Phase 4 final deliverables/go-no-go → Phase 5
   non-blocking cleanup), preserved the spec verbatim in
   `IMPLEMENTATION_NOTES.md`, and logged the resulting open design questions
   in `DECISIONS.md` (D-001 through D-009).
6. User then requested splitting Phase 1 across parallel Claude Code
   sessions — created self-contained worker prompts: `WORKER_BACKEND.md`
   (forsa-os), `WORKER_STUDENT.md` (forsa-student), `WORKER_DASHBOARD.md`
   (forsa-dashboard).

**No product code was changed this session** — this was purely continuity
infrastructure + planning. `git status` in `forsa-os` should show only new
files under `implementation/` (untracked, not yet committed — ask the user
before committing, per standing instructions not to commit without being
asked).

**Still open / next up**: dispatch the 3 worker prompts to parallel sessions;
once they report back, reconcile their findings into this file, update
`MASTER_TASK_LIST.md` checkboxes, and dispatch the remaining 4 portal workers
(`forsa-partner`, `forsa-university`, `forsa-finance`, `forsa-guarantor`) for
Phase 1 (each only has small Phase-1-relevant items — see
`MASTER_TASK_LIST.md`). See `NEXT_SESSION.md` for the concrete pickup point.

**Update (same day, later)**: user opted to have the orchestrating session
spawn the 3 workers as background agents (rather than manually pasting into
separate terminals). All 3 launched in parallel against
`forsa-os`/`forsa-student`/`forsa-dashboard` respectively, each told not to
touch the other repos and not to commit.

**Student portal worker — completed.** Verified against actual `forsa-os`
source that none of the backend Phase 1 fixes had landed yet at the time it
ran. Fixed 4 real `tsc --noEmit` errors as an incidental build-health pass
(no typecheck script existed in `forsa-student`'s `package.json` before this —
worth adding one). Delivered: `RegisterPage.tsx` now sends `password`;
distinguishes "account created but sign-in failed" from "may already be
registered"; new `ForgotPasswordPage.tsx` (support-contact placeholder, since
no reset endpoint exists) wired at `/forgot-password`. Receipt upload in
`PaymentsPage.tsx` now runs a real S3 presigned-upload flow via a new
`uploadFileToS3()` helper in `lib/api.ts` (deliberately bypasses the app's own
axios instance so it doesn't inject a Bearer token/baseURL onto the presigned
S3 URL — worth remembering if this pattern gets copied elsewhere).
`HomePage.tsx` rewritten to the new membership-first field order with 3
clearly-marked "Preview" placeholder tiles (Membership Status/FORSA ID/Digital
Pass) since no backend endpoint exists for those yet.

**Confirmed new backend dependencies surfaced by this worker** (add to
whichever backend task picks these up — likely T-101/T-111 in the backend
worker's own pass, or a fast-follow):
1. `POST /students` needs a `password` field on its DTO + needs to become
   genuinely public (or be replaced) per D-001 — still 401s for anonymous
   callers today.
2. A `document_types` row with code `payment_receipt` (active) needs to
   exist, or the new upload-url call from the student portal will 400.
3. `payments.submitReceipt`/the `payments` table need a `receiptDocumentId`
   column — the student portal now sends one but it's currently a silent
   no-op field server-side.

Working tree in `forsa-student` was left uncommitted for review: modified
`App.tsx`, `lib/api.ts`, `HomePage.tsx`, `RegisterPage.tsx`,
`PaymentsPage.tsx`; new `ForgotPasswordPage.tsx`, `vite-env.d.ts`.

Backend and dashboard workers still running as of this update — see
`MASTER_TASK_LIST.md`/`KNOWN_ISSUES.md` for the latest checkbox/status state,
this file gets a new entry once each finishes.

**Update (same day, later) — both remaining workers hit an account-wide
session rate limit mid-task** (reset 2:50pm Africa/Tunis) and terminated
early. Rather than re-dispatching fresh agents into the same limit, the
orchestrating session inspected both repos directly: both were left with
clean, typechecking, buildable code — no syntax errors or half-written
blocks — just a small number of genuinely unfinished wiring steps, each
identifiable from the failure message's last line ("Now insert the
`registerSelf`/`findMe` methods..." and "Now wire routes into `App.tsx` and
nav items into `Layout.tsx`.").

**Backend worker (forsa-os) — assessment:** of its 8 assigned items, 4 were
fully done and well-documented before the cutoff: T-103 (`GET /partners/me`,
via new migration `005_phase1_identity.sql` adding `partners.user_id`/
`students.user_id` columns), T-105 (Konnect webhook `@Public()` +
`@SkipThrottle()`, HMAC verification untouched), T-108 (schema archived to
`docs/archive/schema-superseded/README.md`), T-110 (`ThrottlerGuard`
registered globally as `APP_GUARD`). T-101's service-layer half
(`registerSelf`/`findMe` in `students.service.ts`, using argon2id hashing via
a new `common/utils/password.util.ts`, wrapped in a DB transaction, with a
sensible audit-log write) was also done, but the controller wiring to
actually expose it as `POST /students/register`/`GET /students/me` was the
exact step in progress when the rate limit hit — **completed by the
orchestrating session** directly (small, mechanical, low-risk: added the two
routes, `@Public()` on the register route only, verified `tsc --noEmit`
clean). Not started: T-102 (guarantor registration), T-106 (notifications
wiring), T-107 backend half (status-enum enforcement), T-109 (test suite).

**Dashboard worker (forsa-dashboard) — assessment:** of its assigned items,
T-104 (payment-verification double-prefix fix — replaced raw `api.get('/api/
v1/...')` calls with the existing `paymentsApi` helpers), T-107 frontend half
(Badge/filter recognition for both status vocabularies), T-113/T-516
(hardcoded `localhost:3000` links → derived from `API_BASE_URL`), and T-112
(role-assignment UI in `UsersPage.tsx`, with a well-documented flagged gap —
no `GET /roles` backend route exists, so it falls back to manual Role ID
entry) were all done. Part B nav scaffolding (T-221) was also mostly done:
6 new pending-state pages existed under `src/pages/pending/`, routes were
wired into `App.tsx`, and the 6 corresponding lucide-react icons were already
imported into `Layout.tsx` — but the actual `navItems` array entries and
matching i18n label keys (en/fr/ar) were the exact step in progress when the
rate limit hit. **Completed by the orchestrating session**: added the 6
`navItems` entries using the already-imported icons, and matching
translation keys in `lib/i18n.ts` for all three locales. Verified `tsc
--noEmit` and `npm run build` both clean.

**New gaps surfaced and logged** (`KNOWN_ISSUES.md` K-44/K-45/K-46): no
`GET /roles` backend route; no `payment_receipt` `document_types` row; no
`receiptDocumentId` column on `payments`. None of these block anything
already shipped — they're follow-ups for whoever picks up T-106/T-109/T-111's
remaining backend half.

No commits made in either repo — both left uncommitted for review, per
standing instructions not to commit without being asked.

**Next up**: T-102 (guarantor registration, needs a `forsa-guarantor`
worker), T-106 (notifications wiring), T-107 backend enforcement half, T-109
(test suite — should also cover the K-05/T-105 signature-verification case
that was never written), and the `forsa-partner` frontend half of T-103
(switch `loadPartner()` to call the new `/partners/me` endpoint instead of
`partners[0]`). See `NEXT_SESSION.md` for the concrete pickup point once this
session ends.

**Update (same day, continued) — user asked to work through the 5 remaining
items directly in-session rather than dispatching more background agents
(which had just hit the same rate limit), committing after each one.** Done,
in order:

1. **T-102 (guarantor registration)** — mirrored T-101's pattern exactly.
   Backend: `POST /guarantors/register` looks up an existing guarantor row
   by tenant+email (staff must add the guarantor first — this only
   activates portal access, never creates a guarantor from scratch) and
   provisions a real `users` row. Frontend: fully rebuilt
   `forsa-guarantor/src/pages/auth/RegisterPage.tsx`, which was unadapted
   student-portal template debris (collecting date-of-birth/nationality/
   academic-level — meaningless for a guarantor) and wasn't even routed;
   now a proper activation form, routed at `/register`. Flagged (not
   removed) a pre-existing dead `authApi.activateGuarantor()`/
   `POST /guarantors/activate` helper that hints at a nicer token-based
   invite flow (migration 004's `guarantors.invite_token` column) — out of
   scope, noted for later. Committed: `forsa-os` `7ed9caaa`, `forsa-guarantor`
   `262b455`.
2. **T-106 (notifications wiring)** — added `NotificationsModule` to
   `applications`/`payments`/`documents`/`contracts` modules and wired the
   8 originally-seeded email templates to their natural trigger points
   (`application_created`, `application_approved`/`rejected`,
   `payment_confirmed`, `payment_due_soon`/`overdue`, `document_requested`,
   `contract_ready`) via a small fire-and-forget `notifyStudent()` helper
   per service (failures logged, never thrown). Committed `cdaba1d7`.
3. **T-107 (backend status-enum enforcement)** — traced `PATCH
   /applications/:id/status` end to end before writing anything. Finding:
   `transitionStatus()`'s `STATUS_TRANSITIONS` allow-list check already
   correctly rejects any write to a "dead" V2-vocabulary status or an
   arbitrary string — this was never actually a live bypass, despite how
   the original audit language read. The real gap was zero boundary-level
   validation (a bare untyped `body` param). Added `TransitionStatusDto`
   with `@IsEnum(ApplicationStatus)`. Committed `2826814b`.
4. **`forsa-partner` frontend fix (T-103's remaining half)** — rewrote
   `AuthContext.tsx#loadPartner` to call the new `GET /partners/me` instead
   of falling back to `partners[0]` from a full partner list; removed the
   `localStorage 'partner_id'` caching it depended on. Flagged a new,
   unrelated bug found while in this file: the 401-refresh interceptor uses
   a bare `axios.post()` instead of the configured instance (K-47, not
   fixed — out of this task's narrow scope). Committed `39c9a5f`.
5. **T-109 (test suite)** — 7 spec files, 33 tests, all passing first run,
   `tsc`/`build` clean throughout: JWT guard, permissions guard, auth
   `validateCredentials` (lockout/timing-safety/status checks), application
   `STATUS_TRANSITIONS` allow-list + notification firing, payment ledger
   double-entry writes, Konnect signature verification (directly closes the
   K-05 gap flagged in step 3's era), and pipeline stages 1-2. Committed
   `595e825a`.

**Verification discipline used throughout**: every change was checked with
`tsc --noEmit` and `npm run build` (or the frontend equivalent `vite build`)
before committing — no step was taken on faith. Two genuinely new backend
gaps were found and logged rather than silently worked around: K-44 (no
`GET /roles` route) and K-47 (partner portal's refresh interceptor bug).

**Phase 1 status after this session**: every item is `[x]` except **T-111
(receipt file upload)**, which remains `[~]` — partially done from an
earlier session (student portal half), blocked on two small backend gaps
(K-45/K-46), and the guarantor half was never started. This was not one of
the 5 items in this session's punch list. **Phase 1 is therefore not yet
100% complete** — T-111 is the one remaining item before Phase 2 can start
per the controlling spec's ordering rule.

**Update (same day, final) — user asked to close T-111 and formally
complete Phase 1.** Done:

1. **K-45** — new migration `006_receipt_upload.sql` seeds an active
   `payment_receipt` `document_types` row (idempotent), also added to
   `scripts/seed.ts` for fresh installs.
2. **K-46** — same migration adds `payments.receipt_document_id UUID
   REFERENCES documents(id)` + index. `payments.service.ts#submitReceipt`
   gained a `verifyReceiptDocument()` helper that confirms a client-supplied
   `receiptDocumentId` actually resolves to a completed upload
   (`entity_type='student'`, matching `entity_id`, `status='uploaded'`, same
   tenant) before persisting it — never trusts the id blindly. 3 new tests
   added to `payments.service.spec.ts` (unknown/foreign document rejected,
   own document accepted and persisted, no-document legacy path still
   works).
3. **Guarantor half** — `GuarantorsController`/`GuarantorsService` gained
   `POST /guarantors/my-student/payment-receipt/upload-url` and
   `.../confirm-upload`, a guarantor-scoped route into `DocumentsService`'s
   upload flow (needed because `GuarantorsController` has no
   `PermissionsGuard` and a guarantor user holds none of the staff
   `document.*` permissions the generic route requires — `entityType:
   'guarantor'` was already a supported value in `generateUploadUrl`, just
   never exposed through a route a guarantor could reach). Same ownership
   check pattern as the student path. `forsa-guarantor`'s
   `PaymentsPage.tsx` now runs the real upload → confirm → submit sequence
   via new `guarantorApi` helpers in `lib/api.ts`, mirroring the student
   portal's pattern exactly — the student portal itself needed no further
   changes, since it was already built against this contract.
4. Incidental fix while touching `submitReceiptOnBehalf`: its audit-log
   INSERT used wrong column names (silently swallowed by a `.catch()`) —
   guarantor payment submissions were never actually being audit-logged.
   Fixed alongside the `receiptDocumentId` wiring.

Verified: `tsc --noEmit` clean, `npm run build` clean (backend + both
frontends), `npm run test` → 36/36 passing (33 from the earlier T-109 pass +
3 new ones for this change).

**Phase 1 is now formally complete — every item in `MASTER_TASK_LIST.md`'s
Phase 1 section is `[x]`.** See `NEXT_SESSION.md` for the Phase 2 starting
point and which open `DECISIONS.md` items should be resolved before writing
Phase 2 code.

**Update (same day, launch-blocker hardening sprint) — user asked for a
concise status report, which surfaced that no `LAUNCH_BLOCKERS.md` existed
yet; user then asked for one to be built by cross-referencing
`KNOWN_ISSUES.md`, `MASTER_TASK_LIST.md`, and `FORSA_PLATFORM_SPEC.md`, then
to resolve D-004 and fix all resulting blockers in severity order before
Phase 2 starts.** Done, in order:

1. **`LAUNCH_BLOCKERS.md` created.** Classified all 33 remaining open issues:
   7 Launch Blockers, 26 Post-Launch. While building it, found and fixed 4
   stale `KNOWN_ISSUES.md` statuses (K-01/K-02/K-03/K-06 were still marked
   `OPEN`/`PARTIALLY FIXED` despite their `MASTER_TASK_LIST.md` tasks being
   fully `[x]`). Committed `ea3ec7fa`.
2. **D-004 proposed and decided.** Two related but distinct state machines:
   coarse `membership_status` (bronze/silver/gold/blacklisted, on `students`)
   and fine-grained financing-request status (extends the existing
   `ApplicationStatus` enum in place). Proposed 2026-07-05, committed
   `bc437493`. User approved the same day with the outstanding sub-question
   resolved: **Silver/Gold membership persists permanently once earned —
   it's a pure ratchet, the only downward move is via the fraud/blacklist
   path, never automatic lapse/expiry.** Documented in `DECISIONS.md`.
   Phase 2 schema work (T-201 onward) is now unblocked.
3. **Blocker #2 (K-14, ledger unification) + half of #4 (K-17, AI model
   string).** Extracted a shared `LedgerService`
   (`src/payments/ledger.service.ts`) — the Konnect path's old raw INSERT
   referenced `debit_account`/`credit_account` columns that don't exist in
   the live schema at all, with an `entry_type` value violating the table's
   `CHECK` constraint, meaning every real Konnect confirmation would throw a
   SQL error *after* the payment was already marked verified. Both
   `PaymentsService` and `KonnectService` now write through the shared
   service. AI model string switched `'claude-sonnet-4-6'` →
   `'claude-opus-4-8'` (note: the original string turned out to likely
   still be a valid model id — switched anyway per the `claude-api` skill's
   current default-model guidance). 37/37 tests passing. Committed
   `f5891824`.
4. **Blocker #1 (K-12, dual/executive approver enforcement).**
   `submitHumanDecision` previously read only the *most recent* reviewer
   decision and unconditionally continued the pipeline — a single reviewer
   could finalize any decision regardless of the dual/executive-approver
   count Stage 7 computed. Fixed: an `'approved'` decision now only
   proceeds once `COUNT(DISTINCT reviewer_id)` of approved decisions meets
   `required_approvers`; otherwise returns `awaiting_additional_approver`
   without advancing. `rejected`/`on_hold`/`needs_more_documents` still
   proceed on one reviewer's say-so (deliberate — the control is about
   single-handed *approval*, not slowing a stop/pause). Added a
   same-reviewer-can't-vote-twice guard. Also added pipeline test coverage
   for stages 3–7 (university/partnership, risk assessment, policy
   evaluation, portfolio/capital + concentration cap, approval threshold —
   all 4 modes) as part of closing K-09's remainder. 57/57 tests passing.
   Committed `6b252284`.
5. **Blocker #3 (K-16 + K-47, refresh-token strategy).** Confirmed against
   `RefreshTokenDto` that bearer-in-body is the only correct pattern against
   the real backend — no cookie fallback exists. Fixed `forsa-finance` and
   `forsa-guarantor` (were sending an empty body, 400ing on every
   access-token expiry, silently forcing re-login) and `forsa-partner`
   (refresh interceptor called bare `axios.post()` with no configured base
   URL — fixed to use the correct full URL, deliberately kept as a bare
   `axios` call rather than routing through the intercepted `api` instance,
   to avoid interceptor-recursion risk on an invalid token). University
   portal's separate relative-path refresh bug (K-26) was not touched —
   different root cause, remains Post-Launch. Committed `forsa-finance`
   `37daf06`, `forsa-guarantor` `205002f`, `forsa-partner` `4392768`.
6. **Blocker #4 remainder (K-18, fabricated demo-mode scores).**
   `forsa-student`'s AI interview demo-mode fallback (triggered on *any*
   exception talking to the real AI endpoint, not just a missing key) used
   to generate a `Math.random()` "AI score" and submit it as
   `aiScoreOverall`/`aiRecommendation` on the real application record —
   indistinguishable from a genuine assessment, with only an ephemeral
   chat-UI badge as disclosure that never reached the backend. Fixed at the
   root: demo mode no longer fabricates any score; those two fields are
   explicitly `null` whenever the real `/ai/score` endpoint wasn't used,
   tracked via a `demo_mode` flag threaded through the report JSON.
   Confirmed safe to null out: grepped for any backend logic reading these
   two columns (none — only the already-broken `seed-demo.ts` references
   them), and the dashboard's `RankingPage` already defaults to `{}` on a
   missing `scores` object without crashing. Committed `forsa-student`
   `a7a9eec`.
7. Updated `MASTER_TASK_LIST.md`, `KNOWN_ISSUES.md`, `LAUNCH_BLOCKERS.md`
   after each fix to keep the tracking docs in sync in real time, not as a
   batch at the end. Committed `57913abe`.

**All 7 launch blockers are now fixed.** Full detail in
`PHASE_1_COMPLETION_REPORT.md` (new file, the permanent engineering record
for this gate). Verification discipline held throughout: every change
typechecked and built (backend + each touched frontend) before committing.
See `NEXT_SESSION.md` for the Phase 2 kickoff plan.

## Phase 2 — begins 2026-07-05

User approved `PHASE_2_PLAN.md` and resolved all three remaining gating
decisions: D-003 (hardcoded, centralized Household Stability weights —
35/25/20/10/10), D-008 (Household Stability and FORSA Score stay
permanently separate), and D-010/new (family = student + primary
guarantor household). User also gave a revised 8-step execution order
(§5a of the plan), splitting the original M1 milestone into distinct
Membership Request→Bronze and FORSA ID steps. Instructed to continue
through all steps without stopping, updating docs after each milestone,
unless a genuine new business decision is discovered.

**Milestone 1 — Payment cleanup warm-up (M8: K-13 + T-219) — DONE.**
- K-13: `konnect.service.ts` now fires a `ScoreService.recordEvent` call on
  confirmed payments, mirroring `payments.service.ts#verifyPayment`'s
  on-time/late logic exactly. `KonnectService` gained `ScoreService` as a
  new constructor dependency (via the already-imported `ScoreModule` in
  `PaymentsModule`).
- Along the way, discovered `guarantors.module.ts` redundantly redeclared
  `KonnectService` as a local provider on top of already importing
  `PaymentsModule` (which exports a fully-wired instance) — this redundant
  declaration would have failed to resolve the new `ScoreService`
  dependency (no `ScoreModule` import in `GuarantorsModule`'s own scope).
  Removed the redundant declaration; `GuarantorsService` still gets the
  correctly-wired singleton via the `PaymentsModule` import alone.
- Also discovered, while wiring the new score event, a live and more
  severe latent bug: `recordedBy: 'system'` was being passed to
  `ScoreService.recordEvent`, which inserts it into `score_events
  .recorded_by` — a `UUID` column. This throws `invalid input syntax for
  type uuid` at the database. The pre-existing daily overdue-installment
  cron job (`payments.service.ts`) had this exact same bug, silently
  swallowed by a `.catch()` — meaning `PAYMENT_OVERDUE` score events have
  never actually been recorded in production. Fixed by widening
  `recordEvent`'s `recordedBy` type to `string | null` and passing `null`
  (the column is nullable) for both the cron job and the new Konnect path.
- T-219: found the actual data source already existed —
  `getPaymentHistory` (backing the existing but staff-only `GET
  /students/:id/payments`) already spans every payment across every
  application/financing period. It just wasn't reachable by an actual
  student portal user (`payment.view` is a staff permission). Added
  `GET /students/me/payments` (`findMyPayments`), self-scoped via the
  caller's own `user_id` — same pattern as the existing `findMe`. Wired
  `forsa-student`'s `PaymentsPage.tsx` with a new "Complete Payment
  History" section, deliberately rendered from every page state (including
  the "no current schedule" empty states) since a renewed student's
  prior-period payments shouldn't disappear just because their current
  period has no active schedule yet.
- New test files: `students.service.spec.ts` (first test coverage for this
  module), 1 new test in `konnect.service.spec.ts`. 60/60 backend tests
  passing. `tsc --noEmit`/`npm run build` clean on both `forsa-os` and
  `forsa-student`.

**Milestone 2 — Membership Request → Bronze (M0 schema + M1) — DONE.**
- New migration `007_membership_lifecycle.sql`: `membership_requests`,
  `students.membership_status`/`member_since`/`forsa_id`, append-only
  `membership_status_history` (RULE-enforced, mirrors
  `application_status_history`), `password_setup_tokens` (D-001's
  set-password-link mechanism, mirroring the existing
  `user_sessions.session_token_hash`/`mfa_challenges.token_hash`
  convention — hashed, never raw). **Actually ran this migration against a
  real local Postgres instance** (started homebrew's `postgresql@18`,
  created a scratch DB, ran the full `001`→`007` chain with
  `ON_ERROR_STOP=1`) rather than only reviewing the SQL by eye — confirmed
  clean apply and an exact schema match against the service code before
  writing a single line of TypeScript against it. Dropped the scratch DB
  and stopped the local Postgres service afterward.
- New `src/membership/` module: `MembershipController`/`MembershipService`,
  `POST /membership-requests` (`@Public()`), staff list/approve/reject.
  `approve()` provisions `students`+`users` transactionally (same pattern
  as T-101's `registerSelf`), sets `membership_status='bronze'`, writes
  history, and — per D-001 — never invents a real password: the `users`
  row gets an unusable random placeholder hash, and a one-time hashed
  token is emailed via a new `membership_approved` notification template
  with a `/set-password?token=...` link.
- New `POST /auth/set-password` (`AuthService.setPassword`) consumes that
  token: validates hash+expiry+unused, hashes the real password
  (argon2id, same complexity rules as staff accounts), activates the
  account.
- New `GET /universities/public` (minimal id/name/city projection) — a
  gap the task description didn't anticipate: the anonymous Membership
  Request form needs a university picker, and the existing university
  list route requires a staff permission.
- `forsa-dashboard`: `MembershipQueuePage.tsx` (was an empty Phase-1
  placeholder) now has real list/approve/reject with tabs, a reject-reason
  modal, and toast feedback — same UI pattern as the existing
  `PaymentVerificationPage.tsx`.
- `forsa-student`: new `/join` (public Membership Request form — now the
  primary "no account?" link from `/login`, superseding the old
  `/register` per D-004's intent without removing it, since pre-existing
  accounts still need it to keep working) and `/set-password`.
- Manually traced the DI graph for the new module before considering it
  done (rather than assuming `tsc` clean = correctly wired — `tsc` cannot
  catch NestJS DI resolution errors, and this exact class of bug bit
  Milestone 1's `guarantors.module.ts` fix): confirmed `DataSource` is
  implicitly global via `@nestjs/typeorm`'s own `TypeOrmCoreModule`, and
  `NotificationsModule` is correctly imported and exports what
  `MembershipService` needs.
- 8 new tests (`membership.service.spec.ts`), covering the transaction
  happy path (with an assertion that the emailed link actually contains a
  token), duplicate-request rejection, already-processed-request
  rejection, and existing-account conflict. 68/68 backend tests passing.
  `tsc --noEmit`/`npm run build` clean on `forsa-os`, `forsa-dashboard`,
  `forsa-student`.
- **Deliberately deferred to later milestones** (not forgotten): FORSA ID
  generation logic (`forsa_id` column exists, stays `null` for now — next
  milestone), Digital Student Pass, the `ApplicationStatus` enum's dead-
  V2-vocabulary retirement (not a blocking dependency for this flow).
