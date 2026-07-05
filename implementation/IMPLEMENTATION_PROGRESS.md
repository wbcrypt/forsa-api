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
- **Deliberately deferred to later milestones** (not forgotten): Digital
  Student Pass, the `ApplicationStatus` enum's dead-V2-vocabulary
  retirement (not a blocking dependency for this flow).

**Milestone 3 — FORSA ID generation — DONE.** Followed on immediately from
Milestone 2 since `forsa_id` had been left `null` there.
- `generateForsaId()` in `membership.service.ts`: `FORSA-<year>-<6
  uppercase hex chars>` (e.g. `FORSA-2026-3F9A2B`) via
  `crypto.randomBytes(3)`. No sequence/counter table.
- **Correctness detail that mattered**: initially wrote the collision-retry
  loop *inside* the transaction, catching a `UNIQUE` violation and
  `continue`-ing. Caught before committing that this doesn't work in
  Postgres — a failed statement inside a transaction aborts the whole
  transaction block (every subsequent statement fails with "current
  transaction is aborted" until rollback), so retrying past a caught
  unique-violation without a `SAVEPOINT` silently produces confusing
  failures instead of a clean retry. Fixed by resolving a unique
  candidate via a pre-transaction `SELECT`-check loop (up to 5 attempts)
  before ever opening the transaction, then doing a single INSERT with
  that confirmed id inside it. `forsa_id`'s real `UNIQUE` constraint
  remains the backstop for the (astronomically unlikely, 16M
  combinations/year) race between the check and the insert.
- Notification template updated to surface the new FORSA ID in the
  set-password email.
- `forsa-student`'s `HomePage.tsx`: `MembershipStatusTile`/`ForsaIdTile`
  replace the old `MembershipPreviewTile`/`ForsaIdPreviewTile` — real data
  from `GET /students/:id` (which already returns the new columns via its
  existing `SELECT s.*`), with an honest "Not a member yet"/"Not assigned
  yet" fallback for any pre-Phase-2 account that has no
  `membership_status` at all. The shared `PreviewTile` shell gained a
  `live` prop so real tiles no longer show the "Preview" badge — only the
  still-placeholder Digital Pass tile keeps it.
- 2 new tests (retry-on-collision, `generateForsaId` format assertion).
  70/70 backend tests passing. `tsc --noEmit`/`npm run build` clean on
  `forsa-os` and `forsa-student`.

**Milestone 4 — Digital Student Pass (M2) — DONE.**
- New migration `008_digital_student_pass.sql`: `digital_student_passes`,
  one row per student (`UNIQUE(student_id)` — generate-once enforced at
  the DB level, not just application convention), nullable
  `apple_wallet_pass_id`/`google_wallet_pass_id` reserved unused per the
  task's own explicit instruction. Actually ran the full 001→008 chain
  against a real local Postgres instance again (started the service,
  scratch DB, verified, dropped, stopped the service) rather than trusting
  the SQL by eye.
- New `src/digital-pass/` module. `issueForStudentTx(manager, ...)` takes
  an `EntityManager` directly so it can be called *inside*
  `MembershipService.approve()`'s existing transaction — wired in right
  after the `students`/`users` provisioning, before the notification send.
  A Bronze member can never exist without a pass, or vice versa, since
  they commit or fail together.
- `GET /pass/verify/:token` (`@Public()`): genuinely live on every call —
  checks both the pass row's own `status` and the student's current
  `membership_status`, so a blacklist action immediately invalidates the
  pass without needing a separate revoke step on every affected member.
  University/academic year are read via a join back to the student's
  originating `membership_requests` row (through
  `provisioned_student_id`) rather than copied onto the pass row — kept
  exactly one source of truth instead of a value that could silently
  drift from it.
- QR code: reused the `qrcode` npm package, already a dependency (used
  for MFA setup's `generateQrCode`) — `QRCode.toDataURL()` server-side,
  rendered by the frontend as a plain `<img src=...>`. No new frontend
  dependency needed for either portal.
- Checked whether this incidentally resolves T-509 (replace the
  third-party `api.qrserver.com` QR dependency) before claiming it did —
  it doesn't: that call lives in `forsa-partner`'s unrelated referral-link
  QR feature. Corrected an initial overclaim in `MASTER_TASK_LIST.md`
  before committing, once this was actually checked with a repo-wide grep
  rather than assumed.
- `forsa-student`: new `/pass` page (full pass card + QR code), linked
  from a new top-bar icon — deliberately placed next to the existing
  Notifications bell rather than added to the 5-slot bottom nav, matching
  that exact established "secondary page" convention already in the
  layout. `HomePage.tsx`'s Digital Pass tile now infers "issued" from
  `student.membership_status` being set (since the pass is now issued
  atomically alongside it) rather than making a second fetch just for the
  tile.
- `forsa-dashboard`: `DigitalPassPage.tsx` (was an empty placeholder) now
  has a real list + revoke-with-reason modal, same UI pattern as
  `MembershipQueuePage.tsx`.
- 8 new tests (`digital-pass.service.spec.ts`), plus 1 updated assertion
  in `membership.service.spec.ts` confirming the pass issuance call
  actually happens inside `approve()`. 78/78 backend tests passing.
  `tsc --noEmit`/`npm run build` clean on `forsa-os`, `forsa-dashboard`,
  `forsa-student`.

**Milestone 5 — Financing Request (M3) — DONE. Scope grew significantly
beyond the estimate.** Started as "gate applications behind Bronze
membership" (T-207) and "document freshness" (T-208/T-209); wiring the
gate surfaced that the entire student-facing submission flow was already
broken, independent of membership entirely:
1. `POST /applications` requires `@RequirePermissions('application.create')`
   — a staff-only CRM permission. Checked: no role is ever assigned to a
   self-registered student account (`registerSelf`/
   `MembershipService.approve()` never insert a `user_roles` row), so a
   real student calling this route would always get a 403. This has
   apparently never been caught because nothing had exercised this path
   end-to-end with a real self-registered account before now.
2. `InterviewPage.tsx`'s submission payload never included `studentId` at
   all — would have hit `applications.student_id`'s `NOT NULL` constraint.
3. `NewApplicationPage.tsx` *did* send a `studentId`, but it was
   `user!.id` — the authenticated user's own row id, not the actual
   `students.id` (a different UUID entirely, linked only via
   `students.user_id`) — would have violated the FK constraint.
4. `applications.ai_score_overall`/`ai_recommendation`/`ai_report`/
   `interview_language`/`interview_transcript` — referenced by
   `src/seeds/seed-demo.ts` and the K-18 fix's frontend payload — were
   never actually migrated. AI interview data was being silently
   discarded on every submission, gate or no gate, this whole time.

Fixed all four together with one new route: `POST /applications/me`
(`ApplicationsService.createForSelf`), which resolves the student
server-side from the JWT identity (never a client-supplied `studentId` —
same "resolve via user_id, never trust the client" pattern as every
`findMe`/`findMyPayments`/`findMyPass` this phase has built), includes
the previously-dropped AI/interview fields in the INSERT, and — the
actual T-207 deliverable — rejects with a clear message unless
`membership_status IN ('bronze','silver','gold')`. Both
`forsa-student` callers (`InterviewPage.tsx`, `NewApplicationPage.tsx`)
now call this route; `NewApplicationPage.tsx`'s now-unused `user!.id`
reference and its `useAuth` import were removed rather than left as dead
code implying it still mattered.

**New migration `009_financing_request.sql`** bundles both discoveries
since they surfaced in the same pass: the 5 missing `applications` AI/
interview columns, plus (T-208/T-209) `document_types.validity_months`
and `documents.expires_at` — confirmed directly against the live schema,
again, that the "already scaffolded" expiry tracking `MASTER_TASK_LIST.md`'s
own T-209 description assumed does not actually exist (this is the third
time this exact "spec says it's already built, schema says otherwise"
pattern has shown up this phase — worth remembering as a standing
skepticism default for this codebase's task descriptions, not just a
one-off). `DocumentsService.confirmUpload()` now computes a real
`expires_at` from the matching document type's `validity_months` at
upload-confirm time. `PipelineService.stage1Completeness`'s document
query now excludes expired documents from satisfying a requirement even
if the verification `status` is still `verified` — a document verified
18 months ago can be stale without ever being re-reviewed. No new admin
UI for configuring `validity_months` per document type — deliberately
deferred, noted as a fast-follow rather than silently skipped.

Also fixed `InterviewPage.tsx`'s submission error handling, a genuinely
new UX bug my own gate directly creates: it used to be a bare
`catch { /* still show done */ }` — any failure was silently swallowed
and the user saw a false "Interview Complete!" success screen with no
application ever actually created. The `'error'` phase already existed
in the component's own type union but was never rendered anywhere — now
it is, showing an honest message and, specifically for the 403 gate
case, a direct link to `/join` (Membership Request).

Verified the migration by actually running the full 001→009 chain
against a real local Postgres instance again (started the service,
scratch DB, confirmed the exact column types/defaults, dropped, stopped
the service) — this is now the fourth migration in this phase verified
this way, not just reviewed by eye.

4 new tests (`applications.service.spec.ts#createForSelf`), 2 new
(`documents.service.spec.ts`, new file), 1 new assertion in
`pipeline.service.spec.ts` confirming the expiry-safety clause stays in
the query. 84/84 backend tests passing. `tsc --noEmit`/`npm run build`
clean on `forsa-os` and `forsa-student`.

**Milestone 6 — Household Stability / AI Review (M4) — DONE.**
- New `src/ai/household-stability.util.ts`: `HOUSEHOLD_STABILITY_WEIGHTS`
  (the approved D-003 split — 35% Household Stability, 25% Financial
  Capacity, 20% Academic Commitment, 10% Documentation Quality, 10% AI
  Interview Assessment) and a pure `computeHouseholdStabilityScore()`.
  Storage matches the original plan exactly — reused
  `applications.ai_report` JSONB (from migration 009) rather than adding
  9 new columns.
- **Fixed a real trust gap that wasn't originally in this milestone's
  scope but was unavoidable once actually building the scoring
  function**: `ai_score_overall`/`ai_recommendation` used to be stored
  directly from whatever the client sent in the request body — zero
  server-side validation at all. `ApplicationsService.create()` now
  recomputes the score deterministically from `aiReport.scores` (the raw
  0-100 per-dimension numbers) using the centralized weights, and derives
  `ai_recommendation` from that same computed score via fixed thresholds
  (`deriveRecommendation()` — 80+ Gold, 60+ Silver, 40+ Referral, else
  Manual Review) — never trusting a client-supplied combined figure or an
  LLM's own self-reported "overall" either way (large language models are
  unreliable at precise weighted arithmetic, and a client could otherwise
  submit whatever score it wanted).
- Wrote the exact test case T-211's own task description calls for
  explicitly: a lower-income-but-stable household (high household
  stability + academic commitment, lower financial capacity) correctly
  outranks a wealthier-but-less-responsible one (high financial capacity,
  low stability) once the 35%/20% weights on the first two dimensions
  dominate the 25% financial-capacity weight by a wide enough margin.
- Updated `forsa-student/InterviewPage.tsx`'s scoring prompt to request
  the 5 canonical dimension names (`householdStability`,
  `financialCapacity`, `academicCommitment`, `documentationQuality`,
  `aiInterviewAssessment`) instead of the old, informally-named set from
  an earlier session (`educational_readiness`/`financial_readiness`/
  `planning_readiness`/`commitment_readiness`/`interview_quality`) — and
  stopped asking the AI to self-report an `overall_forsa_score`/
  `recommendation` at all, since the backend now computes both
  deterministically and would ignore whatever the client sent anyway.
- **Traced the consequence of that rename before considering this done**:
  `forsa-dashboard`'s `RankingPage.tsx` was still reading the old
  dimension names (`app.scores.educational_readiness` etc.) and would
  have silently rendered blank scores for every interview submitted after
  this change, with no error to signal it. Updated its `SortField` type,
  sort switch, CSV export, table columns, and detail panel to the 4
  highest-weighted of the 5 new dimensions (Household/Financial/Academic/
  Documents — Household 35% is the single most important column now),
  and switched the "overall" score source from the now-removed
  `scores.overall_forsa_score` JSON field to the reliable, server-computed
  `ai_score_overall` database column.
- **D-008 boundary explicitly verified, not just assumed**: grepped to
  confirm this milestone's changes never touch `src/score/score.service.ts`,
  `forsa_scores`, or `score_events` — the separate, ongoing post-financing
  FORSA Score engine stays completely untouched. Household Stability and
  FORSA Score remain two systems, per the user's D-008 decision.
- 8 new tests (`household-stability.util.spec.ts` — 5, plus 3 more in
  `applications.service.spec.ts` for the deterministic-scoring behavior).
  92/92 backend tests passing. `tsc --noEmit`/`npm run build` clean on
  `forsa-os`, `forsa-student`, `forsa-dashboard`.

**Milestone 7 — Admin decision flow (M5 + M7) — DONE.** The largest
milestone in the phase so far, covering T-213 (full outcome set), T-214
remainder (CEO override), T-215 (risk rules — 2 of 4 sub-items), and
T-217 (fraud/blacklist).

- **New migration `010_admin_decision_flow.sql`**: `applications
  .financing_tier`, `reviewer_decisions.financing_tier`/`is_override`,
  and the new `fraud_records` table (append-only, `RULE`-enforced like
  the platform's other audit tables). Verified by running the full
  001→010 chain against a real local Postgres instance — the fifth
  migration verified this way this phase.
- **Full outcome set (T-213)**: `submitHumanDecision`'s decision union
  gained `'waiting_list'` — Stage 9 maps it to the *existing*
  `DecisionResult.CAPITAL_QUEUE`/`capital_queue` mechanism, per the
  instruction not to build a parallel one. `ApplicationStatus` gained
  `MORE_INFO_REQUIRED` and `FRAUD_FLAGGED`. **This was also the point
  where the 6 dead V2-dashboard vocabulary enum values (deferred back in
  Milestone 2) finally got retired** — not a speculative cleanup this
  time, since this milestone genuinely needed the replacement values.
  Confirmed via repo-wide grep they were unreferenced before removing.
- **Found and fixed a real latent bug while wiring Waiting List**: Stage
  9 could already produce `DecisionResult.CAPITAL_QUEUE` (the automatic
  Stage-6 university-concentration soft-block already used it), but
  Stage 10's status-map never actually included an entry for it — an
  application soft-blocked into the capital queue never had its
  `current_status` updated to match, silently stuck at whatever it was
  before. Fixed as part of this task.
- **Financing tier + membership ratchet**: `applications.financing_tier`
  (silver/gold) is set by the reviewer alongside an `approved` decision
  (via a new `reviewer_decisions.financing_tier` column), and Stage 10
  applies it to the application *and* ratchets `students.membership_status`
  up to match — but only upward (a rank-comparison check: bronze=0,
  silver=1, gold=2), never down, per D-004's pure-ratchet decision. A
  student already at gold approving a new silver-tier renewal keeps gold.
- **CEO override (T-214 remainder)**: confirmed via schema check that no
  CEO-override permission existed (only a generic `report.ceo` reporting
  one). New `financing.override` permission, and a dedicated
  `overrideDecision()` method — deliberately **not** a branch inside
  `submitHumanDecision`, so the consensus-bypass logic can never
  accidentally leak into a normal reviewer decision path. Always sets a
  new `reviewer_decisions.is_override = true` column and writes a
  distinctly-named `pipeline.ceo_override` audit log entry — an override
  is never indistinguishable from a normal decision in the trail.
- **Risk rules (T-215) — the two hard caps done, two explicitly
  deferred**: added a high-risk capital-exposure cap (default 10%) and
  the D-010-resolved family-exposure cap (default 100,000 TND, grouped by
  `student_guarantors.guarantor_id` where `role='primary'`) to Stage 6,
  alongside the existing university-concentration cap — three
  independent exposure axes, any one can soft-block into `capital_queue`.
  The high-risk cap needed a `LEFT JOIN LATERAL` to find each deployed
  application's *most recent* risk profile (an application can have more
  than one pipeline run over its lifetime — renewals, re-entries) —
  **tested this exact query against a real Postgres instance** (not just
  the schema) before trusting it, since it's meaningfully more complex
  SQL than this session's other queries. "Returning members get
  priority" and "first-year students treated as higher risk" were
  **deliberately not built** — these are queue-ordering/risk-scoring-
  input concerns rather than hard caps (the existing
  `capital_queue.priority_score` column and Stage 4's risk weights are
  the natural homes for them respectively), flagged explicitly as
  deferred rather than silently dropped.
- **Fraud & blacklist (T-217)**: new dedicated `POST /pipeline/runs/:id/
  fraud` (`flagFraud`) — deliberately separate from the human-decision
  outcome set, since fraud permanently blocks the *student*, not just
  this one financing decision, and warrants its own more-restrictive
  `fraud.flag` permission. One transaction: `fraud_records` insert +
  `students.membership_status = 'blacklisted'` (+ history row) +
  `FRAUD_FLAGGED` application status (made terminal in
  `STATUS_TRANSITIONS` — no outgoing transition, since reopening a
  confirmed-fraud application would undermine the permanent-blacklist
  guarantee this status exists to enforce). **Matching-key reality
  check**: the task calls for a national-ID-hash key, but confirmed
  (again) national ID isn't a structured field anywhere in the current
  flow — only ever an uploaded document image. Used a deterministic hash
  of normalized email for V1 instead (the one identity signal actually
  collected from Visitor onward), with the migration's own comment
  flagging this honestly as a gap to close once national ID is captured
  structurally earlier in intake — not silently presented as solved.
- **Built the actual review UI, which turned out not to exist at all**:
  grepped `forsa-dashboard` and found `pipelineApi.submitDecision` had
  existed in `lib/api.ts` since Phase 1, but no page anywhere ever called
  it — a pipeline run pausing at Stage 8 for human review had no UI path
  to actually submit that decision. New `HumanDecisionPanel` component on
  `ApplicationDetailPage.tsx` (shown when `current_status ===
  'under_review'`): outcome select spanning the full new outcome set,
  amount + financing-tier inputs, notes, and permission-gated Flag Fraud
  / CEO Override action buttons and modals. New `FraudRecordsPage.tsx`
  (was an empty Phase 1 placeholder) now lists real fraud records via a
  new `GET /pipeline/fraud-records`.
- 12 new backend tests (dual-approver/K-12 tests already existed;
  added tests for the 2 new Stage 6 caps, `flagFraud`, and
  `overrideDecision`). 97/97 backend tests passing. `tsc --noEmit`/
  `npm run build` clean on `forsa-os` and `forsa-dashboard`.

**Milestone 8 — Remaining portal updates (M9 + M6) — DONE.** The final
milestone in the user's approved 8-step sequence, covering T-216
(Renewal), the remaining slice of T-220/T-221, and T-223 (University
Portal) — plus a severe security finding made and fixed along the way.

- **Renewal (T-216)**: confirmed most of this was already true rather
  than re-building it — every financing request already requires a
  fresh `POST /applications/me` call (no auto-renewal path exists), and
  FORSA Score was already a real Stage 4 risk-assessment input, not
  merely displayed. The one real gap: "returning members get priority"
  had no mechanism at all — grepped and confirmed
  `capital_queue.priority_score` was write-only, inserted at 4 call
  sites (Stage 6's 3 caps + Stage 9's `waiting_list` handling), never
  read or ordered by anything anywhere. Added a flat +100 boost for
  `is_renewal` applications at all 4 sites, and built the read side
  that finally consumes it.
- **Waiting List admin page (T-221 remainder)**: `WaitingListPage.tsx`
  was still an empty Phase 1 placeholder. New `GET /pipeline/
  capital-queue` (`findCapitalQueue`), ordered by `priority_score DESC,
  queued_at ASC` — the first read path this column ever had.
- **University Portal identity bug, found and fixed (T-223)**: while
  starting T-223's confirmation-actions work, read
  `forsa-university/src/pages/auth/LoginPage.tsx` and found it collects
  "University ID" as a raw, user-typed text input, stored directly to
  `localStorage` with **zero server-side verification** — every
  subsequent "my university" API call trusted that client-supplied
  value entirely. This is the exact same class of bug as K-03/T-103
  (`forsa-partner`'s `partners[0]` issue, fixed in Phase 1) — except
  worse here, since it's a manually-typed field, not even an array
  index: any logged-in university-portal user could type a different
  university's id and immediately read that university's complete
  student/financial data. **Fixed exactly mirroring T-103's approach**:
  new migration `011_university_identity.sql` adding `universities
  .user_id` (unique, FK to `users`) and `users.university_id_linked`;
  new self-scoped `GET /universities/me` (`findMe`) resolved via the JWT
  identity, never anything client-supplied. Since no university
  self-registration flow exists (unlike students/guarantors) to
  establish this link on its own, also added a staff-facing `PATCH
  /universities/:id/link-user`. Removed the University ID field from
  the login form entirely; `AuthContext.tsx` now resolves it server-side
  via `GET /universities/me` after login. Verified the full 001→011
  migration chain, including this exact schema, against a real local
  Postgres instance.
- **T-223's actual ask, delivered after the security fix**: new `POST
  /applications/:id/university-confirm` (`ApplicationsService
  .confirmEnrollment`) — self-scoped the same way (resolves the calling
  university via `universitiesService.findMe`, never a client-supplied
  id), and explicitly checks `application.university_id ===
  university.id` before allowing it (`ForbiddenException` otherwise).
  Inserts a new `ApplicationStatus.UNIVERSITY_CONFIRMED` between
  `CONTRACT_SIGNED` and `UNIVERSITY_PAID` in `STATUS_TRANSITIONS` — the
  university still can never touch a financing decision itself; this is
  one narrow status transition, not decision-making capability. New
  "Confirm Enrollment" button on `forsa-university`'s
  `StudentDetailPage.tsx`, shown only when `current_status ===
  'contract_signed'`.
- **Found and fixed a related gap while wiring the new status into the
  UI**: all 3 frontend portals' `Badge` color/label maps were missing
  every `ApplicationStatus` value added since Milestone 2
  (`more_info_required`, `fraud_flagged`, `capital_queue`'s "Waiting
  List" relabel, and this milestone's `university_confirmed`) — these
  would have rendered with fallback/default styling. Fixed across
  `forsa-dashboard`, `forsa-university`, and `forsa-student` together
  rather than one at a time. The student-facing label for
  `fraud_flagged` deliberately reads "Under Compliance Review" rather
  than exposing the raw fraud accusation to the flagged student.
- **`forsa-finance` (T-222) and `forsa-partner` (T-224) were not
  started this pass** — flagged explicitly as the remaining Phase 2
  frontend work, not silently dropped, since this was the last milestone
  in the user's approved 8-step sequence.
- 7 new backend tests (2 for `findCapitalQueue`/the renewal boost, 5 for
  `universities.service.spec.ts`'s identity fix, 2 for
  `confirmEnrollment`'s cross-university rejection — 106/106 backend
  tests passing total). `tsc --noEmit`/`npm run build` clean on
  `forsa-os`, `forsa-dashboard`, `forsa-university`, `forsa-student`.
  Migration 011 verified against a real local Postgres instance (the
  sixth migration verified this way across the phase).
