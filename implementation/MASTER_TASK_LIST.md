# FORSA — Master Task List

> Single source of truth for outstanding engineering work across the whole
> FORSA platform (backend `forsa-os` + 6 frontend portals). Seeded from
> `/Users/wael/Downloads/forsa-deploy-stack-final/FORSA_PLATFORM_SPEC.md`
> (reverse-engineering audit), `/Users/wael/Downloads/forsa-deploy-stack-final/AUDIT_REPORT.md`
> (30 Jun 2026 live audit), and the **FORSA V1 — Master Implementation
> Specification** delivered 2026-07-05 (full text preserved in
> `IMPLEMENTATION_NOTES.md` → "Source specs").
>
> **Repo map** (all siblings of this directory's parent, each its own git repo):
> `forsa-os` (backend, this repo) · `forsa-dashboard` (admin) · `forsa-student` ·
> `forsa-university` · `forsa-partner` · `forsa-finance` · `forsa-guarantor`.
>
> **Governing rule from the 2026-07-05 spec: Phase 1 must be 100% complete
> before any Phase 2 (redesign) work starts.** Do not skip ahead.
>
> Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked/needs decision
>
> When you complete a task: check it here, add an entry to `CHANGELOG.md`, log
> detail in `IMPLEMENTATION_PROGRESS.md`, and record any design choice made
> along the way in `DECISIONS.md`.

---

## Phase 0 — Continuity system

- [x] T-000 Create `/implementation` workspace — 2026-07-05
- [x] T-001 Fold the 2026-07-05 Master Implementation Specification into this
      task list, `DECISIONS.md`, and `IMPLEMENTATION_NOTES.md` — 2026-07-05

---

## Phase 1 — Critical Engineering Fixes (BLOCKING — complete before Phase 2)

**STATUS: COMPLETE as of 2026-07-05.** Every item below (T-101 through T-113)
is checked off. **A supplementary launch-blocker audit (`LAUNCH_BLOCKERS.md`)
then classified all remaining known issues and found 7 genuine launch
blockers on top of this list — all 7 are now also fixed** (K-12, K-14,
K-16+K-47, K-17+K-18, K-09 stages 3-8). D-004 is resolved (`DECISIONS.md`):
Silver/Gold membership persists permanently once earned. **See
`PHASE_1_COMPLETION_REPORT.md` for the full permanent record — this is now
the authoritative gate document, supersedes the summary below.** Phase 2
(membership-first redesign) is unblocked — see `NEXT_SESSION.md` for the
concrete Phase 2 starting point.

Per the 2026-07-05 spec's own ordering. Each bullet below is that spec's item,
expanded with the concrete detail already gathered from the audit.

- [x] T-101 **Student self-registration → real auth account.**
      `RegisterPage.tsx` (`forsa-student`) calls `POST /students`
      (`forsa-os/src/students/`), a staff-only CRM lead-creation endpoint
      (`student.create` permission) that never writes to `users`/auth and never
      stores a password — so a "registered" student cannot log in afterward.
      Needs design decision D-001 before coding (new public registration
      endpoint that creates both a `students` row and a `users` row
      transactionally, vs. other approach).
      **2026-07-05 — DONE (both halves).** Backend: `POST /students/register`
      (`@Public()`, `forsa-os` commit `ca6cf80d`) creates a real `students` +
      `users` row transactionally (argon2id-hashed password), and
      `GET /students/me` resolves the caller's own student profile via
      `students.user_id`. Frontend (`forsa-student` commit `17a2c4b`):
      `RegisterPage.tsx` now calls the new endpoint (with `tenantId` from the
      portal's existing `TENANT_ID` constant, matching how login already
      works) instead of the old staff-only `POST /students`, sends `password`,
      and distinguishes "account created, sign-in failed" from "may already be
      registered" on failure. Added `ForgotPasswordPage.tsx`/`/forgot-password`
      (support-contact placeholder — no reset endpoint exists yet).
- [x] T-102 **Guarantor self-registration → real auth account.**
      `forsa-guarantor/src/pages/auth/RegisterPage.tsx` is not routed in
      `App.tsx` at all, and is internally broken (missing `tenantId` arg to
      `login()`, posts to `/students`). Depends on D-001's pattern, applied to
      guarantors (`guarantors.user_id` linkage already exists in the schema
      from migration 004 — use it).
      **2026-07-05 — DONE (both halves).** Backend: `POST /guarantors/register`
      (`forsa-os` commit `7ed9caaa`) looks up an existing guarantor row by
      tenant+email (staff must have added the guarantor first — this endpoint
      only activates portal access, never creates a guarantor from scratch),
      creates a real `users` row (argon2id, `portal_type='guarantor'`), links
      `guarantors.user_id`. Frontend: `forsa-guarantor` commit `262b455`
      rebuilt `RegisterPage.tsx` (was unadapted student-template debris
      collecting date-of-birth/nationality/academic-level — meaningless for a
      guarantor), routed at `/register`, fixed the missing `tenantId` arg to
      `login()`. Flagged as dead code (not removed): the pre-existing
      `authApi.activateGuarantor()`/`POST /guarantors/activate` helper, which
      hints at a nicer token-based invite flow (migration 004's
      `guarantors.invite_token` column) that was never built — out of scope
      for this pass, noted in a code comment for a future session.
- [x] T-103 **Partner portal identity isolation.**
      `forsa-partner`'s `loadPartner()` assigns `partners[0]` from a list
      endpoint as "this user's partner" on first login with no cached ID —
      can leak another partner's data. Fix: add a JWT-scoped `GET /partners/me`
      endpoint in `forsa-os/src/partners/`, switch the frontend to use it
      instead of list-index-0. Highest-severity frontend bug in the platform —
      do not onboard any real partner before this lands.
      **2026-07-05 — backend half DONE.** `GET /partners/me` added
      (`partners.controller.ts`/`partners.service.ts`), resolves via
      `partners.user_id` keyed off the JWT identity per migration
      `005_phase1_identity.sql` (adds `partners.user_id UUID UNIQUE REFERENCES
      users(id)`). Verified: route registered before `:id` so it isn't
      swallowed by the param route; no `@RequirePermissions()` (partner portal
      users hold no staff permissions).
      **2026-07-05 — frontend half also DONE.** `forsa-partner`'s
      `AuthContext.tsx#loadPartner` rewritten to call the new
      `partnerApi.me()` (`GET /partners/me`) unconditionally, removing the
      `partners[0]`-on-first-login fallback and the `localStorage
      'partner_id'` caching it depended on entirely — every page that reads
      `partner.id` from context (Dashboard/Students/Commissions/Referrals/
      Reports/Profile) now gets it from a server-verified identity, never a
      list index. New gap surfaced while doing this (not fixed, out of this
      task's scope): the 401-refresh interceptor in this repo's `lib/api.ts`
      calls bare `axios.post()` instead of the configured instance —
      logged as K-47.
- [x] T-104 **Admin Dashboard payment verification endpoint.**
      `PaymentVerificationPage.tsx` (`forsa-dashboard`) sends an explicit
      `/api/v1/...` prefix on top of the already-prefixed shared axios client
      → `/api/v1/api/v1/payments/...` → 404. Strip the redundant prefix to
      match every other page in that portal.
      **2026-07-05 — DONE.** Replaced raw `api.get('/api/v1/payments/...')`/
      `api.patch('/api/v1/...')` calls with the existing `paymentsApi.
      listReceipts/verifyPayment/rejectPayment` helpers (same pattern every
      other page in the portal already uses). Verified via `git diff` + clean
      `tsc --noEmit`/`npm run build`.
- [x] T-105 **Konnect webhook auth, keeping signature verification.**
      `POST /payments/konnect-webhook` (`forsa-os/src/payments/payments.controller.ts`)
      is behind the controller's class-level `JwtAuthGuard`+`PermissionsGuard`
      with no `@Public()` override, despite a comment claiming otherwise —
      Konnect's server-to-server call would 401. Fix: mark the route
      `@Public()` (route-level override, not controller-level) and confirm the
      existing HMAC-SHA256 signature check + anti-replay re-verification
      against Konnect's API is the sole trust boundary on that route. Write a
      test that a request without a JWT but with a valid signature succeeds,
      and one with an invalid signature is rejected regardless of auth.
      **2026-07-05 — route fix DONE, test NOT written.** Route-level
      `@Public()` added to `konnectWebhook()`, plus `@SkipThrottle()` (a
      needed side effect of T-110 going in at the same time — Konnect calls
      from a small set of shared gateway IPs on behalf of every tenant, so
      per-IP throttling would otherwise drop legitimate confirmations). HMAC
      signature verification in `KonnectService.processWebhook()` untouched.
      **Still open**: the actual valid/invalid-signature test case from
      T-109's scope was not written this pass.
- [x] T-106 **Connect business-event infrastructure to actual workflows.**
      `NotificationsService` has zero call sites in any business-logic module
      today. Wire real trigger points (see full channel list under Phase 2 →
      Notifications below, which supersedes/extends the original 8 templates):
      `applications.service.ts` (submitted/status-changed), `payments.service.ts`
      (due-soon/overdue/confirmed), `documents.service.ts` (missing docs),
      `contracts.service.ts` (ready to sign). Build this on the existing
      SMTP+template+`notification_logs` plumbing, which already works
      end-to-end — it just isn't called.
      **2026-07-05 — DONE for the 8 originally-seeded templates.** Added
      `NotificationsModule` to `applications`/`payments`/`documents`/
      `contracts` modules' imports; each service gained a fire-and-forget
      `notifyStudent()` helper (failures logged, never thrown — a
      notification going down must not break the underlying transaction).
      Wired: `application_created` (on `create()`), `application_approved`/
      `application_rejected` (on `transitionStatus()` reaching an approved
      level or `rejected`), `payment_confirmed` (on `recordPayment`/
      `verifyPayment` reaching installment status `paid`), `payment_due_soon`/
      `payment_overdue` (in the daily `updateInstallmentStatuses` cron, at the
      exact points installments flip to `due_soon`/`late`), `document_requested`
      (on `reviewDocument` rejecting an application-attached document),
      `contract_ready` (on `sendForSignature`). `push`/`in_app`/`sms` channels
      and the Phase 2 membership-event templates (T-225) remain future work —
      this pass only wires the pre-existing 8 email templates.
- [x] T-107 **Unify application status vocabulary** *(Phase 1 scope: harden
      enforcement + confirm current behavior; full unification remains
      Phase 2, gated on D-004 — see below)*.
      Core pipeline's 16-status `STATUS_TRANSITIONS` machine
      (`forsa-os/src/applications/applications.service.ts`) vs. the Admin
      Dashboard's `ApplicationWorkflowPage` V2 vocabulary
      (Applied → AI Interview → Internal Review → Pre-Approved → Activation
      Meeting → Contract Signed → Approved → University Payment → Active
      Student), written via free-text through the same generic status-update
      call, unrecognized by the shared `Badge` component. **Note**: Phase 2's
      new membership lifecycle (see below) introduces its own vocabulary again
      — resolve this task by designing one status model that serves pipeline +
      dashboard UI + the new membership stages together, not by patching V1/V2
      in isolation. See D-004.
      **2026-07-05 — DONE for Phase 1's scope.** Frontend half (dashboard
      worker): `Badge` component + status filters in `ApplicationsPage.tsx`/
      `ApplicationWorkflowPage.tsx` now recognize and render both
      vocabularies so nothing shows unstyled/unfilterable. Backend half
      (verified + hardened, not newly broken): traced `PATCH
      /applications/:id/status` end to end — confirmed
      `transitionStatus()`'s `STATUS_TRANSITIONS[currentStatus].includes(newStatus)`
      check is already a genuine allow-list that correctly rejects (400) any
      write to one of the enum's "dead" V2-vocabulary values (`applied`,
      `ai_interview_completed`, `internal_review`, `pre_approved`,
      `document_verification`, `contracts_signed`, `university_payment`) or
      any arbitrary string — this was *not* actually a live bypass, contrary
      to how the original audit language read. What genuinely was missing:
      the route had **zero boundary-level validation** — `@Body() body: {
      status: ApplicationStatus; notes?: string }` was a bare TypeScript
      type, erased at runtime, relying entirely on the service-layer check as
      the only defense. Added `TransitionStatusDto`
      (`src/applications/dto/transition-status.dto.ts`) with
      `@IsEnum(ApplicationStatus)`, matching how `auth`/`policy` DTOs already
      validate their bodies. Full vocabulary unification (one coherent status
      model spanning pipeline + dashboard UI + Phase 2's membership stages)
      remains explicitly out of scope here — that's D-004, Phase 2.
- [x] T-108 **Remove duplicated schema sources.**
      `database/schema/00_master.sql`...`08_seed.sql` (~73 tables, abandoned,
      never adopted) vs. `migrations/001-004*.sql` (~62 tables, live). Action:
      archive `database/schema/` (move to `docs/archive/` or delete outright —
      see D-007) so no engineer builds against the wrong one. The Phase 2
      redesign will add new tables (membership, FORSA ID, Digital Pass,
      fraud records) — those must go into new numbered `migrations/*.sql`
      files, never into `database/schema/`.
      **2026-07-05 — DONE.** Moved to `docs/archive/schema-superseded/` with a
      clear `README.md` explaining it's superseded/never-adopted, pointing at
      `migrations/` as the live schema, and explicitly instructing that Phase
      2's new tables go into new `migrations/*.sql` files.
- [x] T-109 **Add automated testing foundation** *(Phase 1 minimum bar met;
      full 10-stage pipeline coverage + broader sweep remains Phase 3, T-301)*.
      Zero test files exist anywhere across all 7 repos despite full Jest
      scaffolding in `forsa-os`. Minimum bar before Phase 2 starts: auth/login
      + JWT guard tests, application `STATUS_TRANSITIONS` allow-list tests,
      payment recording + ledger-write tests, pipeline stage 1-10 tests. This
      becomes the harness Phase 3 (full test sweep) builds on.
      **2026-07-05 — DONE for the Phase 1 minimum bar.** 7 spec files, 33
      tests, all passing on first run (`npm run test`), `tsc --noEmit` and
      `npm run build` both clean:
      - `src/auth/guards/jwt-auth.guard.spec.ts` — `@Public()` bypass,
        rejection when no user/error present.
      - `src/auth/guards/permissions.guard.spec.ts` — no-permissions-required
        passthrough, missing-user rejection, granted/denied permission checks,
        security-event logging on denial (including when the log write itself
        fails — must still deny).
      - `src/auth/auth.service.spec.ts` — `validateCredentials`: unknown
        email (timing-safe dummy hash still runs), locked/deactivated account
        rejection, wrong-password failed-attempt increment, lockout at the
        configured max attempts, correct-password success + counter reset.
      - `src/applications/applications.service.spec.ts` — `STATUS_TRANSITIONS`
        allow-list: legal transition succeeds and writes history, illegal
        transition (including a write to one of the enum's "dead" V2-vocabulary
        values) is rejected with zero side-effect queries, `application_approved`/
        `application_rejected` notifications fire with correct variables.
      - `src/payments/payments.service.spec.ts` — `recordPayment` writes a
        matched debit/credit ledger pair sharing one `batch_id`, fires the
        correct on-time score event, rejects double-recording an already-paid
        installment.
      - `src/payments/konnect.service.spec.ts` — directly closes the K-05
        gap flagged in T-105: invalid signature rejected, missing signature
        rejected (when a secret is configured), valid signature passes the
        auth boundary, a signature computed over a different (tampered)
        payload is rejected.
      - `src/pipeline/pipeline.service.spec.ts` — Stage 1 (completeness:
        missing-documents block, missing-guarantor block, full pass) and
        Stage 2 (eligibility: under-age block, below-minimum-score block,
        pass) via direct private-method invocation — a pragmatic pattern
        given these are `private` methods on a service with no public
        single-stage entry point.
      **Explicitly not done in this pass** (left for Phase 3's T-301, which
      builds on this foundation): stages 3-10 of the pipeline, e2e/HTTP-level
      tests (no `test/jest-e2e.json` exists yet — these are unit/service-level
      tests only), and any frontend test (all 6 portals still have zero).

**Also required before Phase 2, carried over from the audit (not explicitly
named in the 2026-07-05 spec bullets, but blocking in practice):**

- [x] T-110 Rate limiting is configured (`ThrottlerModule`) but the guard is
      never applied anywhere (`forsa-os/src/app.module.ts`) — register
      `ThrottlerGuard` as `APP_GUARD` and confirm the login/MFA `@Throttle`
      overrides still work.
      **2026-07-05 — DONE.** `ThrottlerGuard` registered as `APP_GUARD` in
      `app.module.ts` with a clear comment on why `@Public()` routes are NOT
      exempt by default (login/MFA/Konnect webhook are exactly the public
      routes most worth rate-limiting) — with `@SkipThrottle()` added
      specifically to the Konnect webhook route as a deliberate, documented
      exception (see T-105).
- [x] T-111 Receipt-upload flows (Student + Guarantor portals) transmit only
      the filename, never the file bytes — Finance staff have nothing to
      inspect. Wire a real upload using the existing S3 presigned-URL flow
      already used by `documents.service.ts`.
      **2026-07-05 — DONE, all 3 gaps closed.**
      - **K-45 (missing `document_types` row)**: new migration
        `006_receipt_upload.sql` seeds an active `payment_receipt` document
        type row (idempotent `ON CONFLICT (code) DO NOTHING`); also added to
        `scripts/seed.ts`'s `DOCUMENT_TYPES` array for fresh installs.
      - **K-46 (missing column)**: same migration adds
        `payments.receipt_document_id UUID REFERENCES documents(id)` +
        index. `payments.service.ts#submitReceipt` now accepts
        `receiptDocumentId`, verifies it via a new `verifyReceiptDocument()`
        helper (confirms the `documents` row is `entity_type='student'`,
        `entity_id=<this student>`, `status='uploaded'`, in this tenant —
        never trusts a client-supplied documentId blindly) before persisting
        it on both the INSERT and UPDATE-existing-receipt paths. Locked down
        with 3 new tests in `payments.service.spec.ts`.
      - **Guarantor portal half**: added `POST
        /guarantors/my-student/payment-receipt/upload-url` and
        `.../confirm-upload` (`GuarantorsController`/`GuarantorsService`,
        `forsa-os`) — a guarantor-scoped route into `DocumentsService`'s
        upload flow, needed because `GuarantorsController` has no
        `PermissionsGuard` (self-scoped by design) and a guarantor user holds
        none of the staff `document.*` permissions the generic
        `POST /documents/upload-url` route requires. `entityType: 'guarantor'`
        was already a supported value in `generateUploadUrl`. Same ownership
        verification pattern as the student path (`entity_type='guarantor'`,
        `entity_id=<this guarantor>`). Frontend (`forsa-guarantor`):
        `PaymentsPage.tsx`'s receipt-submission mutation now runs the full
        upload → confirm → submit sequence via new `guarantorApi.
        getReceiptUploadUrl`/`confirmReceiptUpload`/`uploadFileToS3` helpers
        in `lib/api.ts`, mirroring the student portal's already-working
        pattern exactly.
      - Incidental fix while in this code: `submitReceiptOnBehalf`'s audit-log
        INSERT was using wrong column names (`action, target_type` instead of
        the real schema's `action_type, module, target_entity`) — silently
        swallowed by a `.catch(() => {})` before, so guarantor payment
        submissions were never actually being audit-logged. Fixed as part of
        touching this method for the `receiptDocumentId` wiring.
      - Student portal side needed **no further changes** — it was already
        built against exactly this contract by an earlier session; the 2
        backend gaps blocking it are what's fixed here.
- [x] T-112 **Admin Dashboard role-assignment UI** (was deferred to "V2" in
      `UsersPage.tsx`, requiring a raw undocumented API call). Backend
      `GET/POST/DELETE /users/:id/roles` already existed and works.
      **2026-07-05 — DONE**, with one flagged gap: `UsersPage.tsx` now has a
      real assign/revoke UI, but the "list of assignable roles" call
      (`rolesApi.list()` → `GET /roles`) has **no matching backend
      controller** — confirmed via grep, no `@Controller('roles')` exists
      anywhere in `forsa-os/src`. The dashboard worker handled this gracefully
      (falls back to manual Role ID entry rather than blocking) and clearly
      documented the gap in `lib/api.ts`. **Follow-up**: either add a
      `GET /roles` route backend-side, or have the frontend fall back to a
      different existing endpoint that already lists roles.
- [x] T-113 **Admin Dashboard hardcoded `localhost:3000` links**
      (`SettingsPage.tsx` MFA-setup/Swagger links — this is the audit's
      original finding, tracked as T-516 in the Phase 5 list below; fixing it
      landed as part of this Phase 1 dashboard pass since it was low-risk and
      already in scope for the worker). **2026-07-05 — DONE.** Links now
      derive from the same `API_BASE_URL` the app's own axios client uses
      (`lib/api.ts`), correctly resolving to an absolute URL whether
      `VITE_API_URL` is set or not. See T-516 for the cross-reference — do not
      duplicate this fix there.

---

## Phase 2 — New Operating Model: Membership-First

**Do not start until every Phase 1 item above is checked off.** This phase
replaces the platform's current "financing-first" framing (register → apply →
financing decision) with a membership-first lifecycle. It touches the data
model, all 6 frontends, and the pipeline/scoring engines. Treat each
subsection as its own workstream; log every non-obvious design call in
`DECISIONS.md` as you go (several open questions are already flagged there —
resolve them before writing code that depends on the answer).

### 2.1 Lifecycle & data model
- [~] T-201 Design and migrate new tables/columns for: membership records
      (level: bronze/silver/gold, status, `forsa_id`, `member_since`),
      Digital Student Pass (generate-once/update-status-only — never
      recreate), fraud/blacklist records, waiting-list entries. New
      `migrations/00X_membership.sql`, following the live schema convention
      (raw SQL + `scripts/migrate.ts`), not `database/schema/`.
      **2026-07-05 — membership records DONE via
      `migrations/007_membership_lifecycle.sql`**: `membership_requests`
      (public intake), `students.membership_status`/`member_since`/
      `forsa_id` (column added now, generation logic is a separate
      follow-up), `membership_status_history` (append-only, RULE-enforced
      like `application_status_history`), `password_setup_tokens` (D-001's
      set-password-link mechanism). Migration verified by actually running
      it against a real local Postgres instance on top of the full
      001-006 chain — not just reviewed by eye. **Digital Student Pass
      table, fraud/blacklist records, and waiting-list entries are NOT yet
      in this migration** — deferred to their own milestones (Digital Pass
      next; fraud/blacklist and waiting-list later in the admin-decision
      milestone) so each migration stays scoped to the feature landing
      alongside it.
- [ ] T-202 Decide how the new lifecycle stages (Visitor → Membership Request →
      Bronze → FORSA ID → Digital Pass → Member Dashboard → Complete Profile →
      Financing Eligibility → Financing Request → Documents → AI Interview →
      AI Assessment → Human Review → Silver/Gold → University Confirmation →
      Payment Plan → FORSA Score → Renewal) map onto the existing `applications`
      state machine and pipeline stages 1-10 — see D-004/D-008. Implement the
      resulting single, coherent status model (this is where T-107 above and
      this design converge).
      **Note 2026-07-05**: the `ApplicationStatus` enum's dead-V2-vocabulary
      cleanup (part of this task's original D-004 scope) has been
      deliberately deferred rather than done alongside T-201 — it isn't a
      blocking dependency for Membership Request → Bronze (that flow never
      touches `applications.current_status`), and doing it opportunistically
      when the new status values (`university_confirmed`, `fraud_flagged`,
      etc.) actually get used avoids a speculative, unused enum change now.

### 2.2 Membership request & Bronze issuance
- [x] T-203 Build a genuinely public `POST /membership-requests` endpoint
      (`forsa-os`) collecting only: name, phone, email, city, university,
      programme, academic year, current/future student. Explicitly no
      guarantor, no financial documents, no salary/bank statements at this
      stage.
      **2026-07-05 — DONE.** New `src/membership/` module
      (`MembershipController`/`MembershipService`). Also added a genuinely
      public `GET /universities/public` (minimal id/name/city projection)
      since the anonymous form needs a real university picker and the
      existing `GET /universities` requires a staff permission — this was
      a gap the task description didn't anticipate.
- [x] T-204 On approval: issue Bronze membership, generate FORSA ID, generate
      Digital Student Pass (idempotent — one-time generation, status-only
      updates thereafter). This is also the natural place to finally solve
      T-101/T-102 (registration → real `users` row) since Bronze issuance is
      the first point a real portal login should exist.
      **2026-07-05 — Bronze issuance + real `users` row + FORSA ID
      generation all DONE; Digital Student Pass is the one remaining
      follow-up milestone (already scoped, not forgotten).** `POST
      /membership-requests/:id/approve` provisions a `students` + `users`
      row transactionally (same pattern as T-101's `registerSelf`), sets
      `membership_status='bronze'`, `member_since=CURRENT_DATE`, a
      permanent `forsa_id`, and writes a `membership_status_history` row.
      **FORSA ID format**: `FORSA-<year>-<6 uppercase hex chars>` (e.g.
      `FORSA-2026-3F9A2B`), generated by `generateForsaId()` in
      `membership.service.ts`. No sequence/counter table — uniqueness is
      checked with a pre-transaction SELECT loop (up to 5 attempts) rather
      than retried inside the transaction itself, since a failed INSERT
      would otherwise abort the whole Postgres transaction (no
      SAVEPOINT); `forsa_id`'s real `UNIQUE` constraint is the backstop if
      the astronomically unlikely collision (16M combinations/year) ever
      happens anyway. **Per D-001, never invents a real password**: the
      `users` row gets an unusable random placeholder hash, and a one-time
      hashed token (mirroring the existing
      `user_sessions.session_token_hash`/`mfa_challenges.token_hash`
      convention — raw token never stored) is emailed via a new
      `membership_approved` notification template (now includes the
      FORSA ID) with a `/set-password?token=...` link. New `POST
      /auth/set-password` consumes that token. `forsa-dashboard`'s
      Membership Queue (was an empty placeholder) now has real
      list/approve/reject. `forsa-student` gained `/join` (public
      Membership Request form, now the primary "no account?" link from
      `/login`, superseding the old `/register` per D-004 — `/register`
      itself is left working, not removed, for any pre-existing account)
      and `/set-password`; `HomePage.tsx`'s Membership Status and FORSA ID
      tiles are now wired to real data (the "Preview" badge only remains
      on the Digital Pass tile). 10 backend tests total for this module
      (`membership.service.spec.ts`), 70/70 total passing.

### 2.3 Digital Student Pass
- [x] T-205 Build pass generation (FORSA logo, student name, FORSA ID, member
      since, membership level, university, academic year, QR verification,
      status). Design the data model so wallet-provider fields (Apple
      Wallet/Google Wallet pass identifiers, signing certs) can be added later
      without a breaking migration — don't build the wallet integration itself
      yet, just don't block it.
      **2026-07-05 — DONE.** New migration `008_digital_student_pass.sql`:
      `digital_student_passes` (one row per student, `UNIQUE(student_id)` —
      generate-once/status-updates-only, enforced by application logic
      never inserting a second row, not just convention). Nullable
      `apple_wallet_pass_id`/`google_wallet_pass_id` columns reserved now
      per the task's own instruction, unused. New `src/digital-pass/`
      module: `DigitalPassService.issueForStudentTx(manager, ...)` is
      called *inside* `MembershipService.approve()`'s existing transaction
      (not as a separate best-effort step) — a Bronze member can never
      exist without a pass, or vice versa. University/academic year are
      **not** denormalized onto the pass row — read live via a join back
      to the student's originating `membership_requests` row, so there's
      exactly one place that data can drift from. QR code generated
      server-side via the `qrcode` npm package (already a dependency, used
      for MFA setup) as a data URL — no new frontend dependency needed.
      **Note on T-509**: does NOT resolve it — checked, and the
      third-party `api.qrserver.com` call T-509 flags is in
      `forsa-partner/src/pages/referrals/ReferralsPage.tsx` (partner
      referral-link QR codes), a genuinely separate feature this
      milestone never touches. This pass's QR code uses the self-hosted
      `qrcode` package server-side — T-509 remains open, but the fix
      pattern (swap to `qrcode`, already an existing dependency) is now
      proven out and directly reusable there.
      `forsa-student` gained `/pass` (full pass display + QR code, linked
      from a new top-bar icon next to Notifications, matching that exact
      secondary-page convention) and `forsa-dashboard`'s
      `DigitalPassPage.tsx` (was an empty placeholder) now has a real
      list + revoke action.
- [x] T-206 QR verification: a scan should resolve to a live status check
      (membership valid/level/expired), not a static payload — needs a
      lightweight public verification endpoint.
      **2026-07-05 — DONE.** `GET /pass/verify/:token` (`@Public()`) —
      queries current pass status + student membership status live on
      every call (no caching, no static payload embedded in the QR image
      itself — the QR only encodes the verify URL). Reports `valid: false`
      both when the pass row itself is revoked *and* when the underlying
      student has been blacklisted, even if the pass row's own status is
      still `active` — a blacklist should immediately invalidate the pass
      without requiring a separate revoke action on every blacklisted
      member's pass.

### 2.4 Financing request (post-Bronze only)
- [x] T-207 Gate the existing financing/application flow behind an active
      Bronze (or higher) membership — a visitor with no membership should not
      be able to reach it.
      **2026-07-05 — DONE, and surfaced a much bigger pre-existing bug along
      the way: the entire student-facing Financing Request submission flow
      was completely broken before this fix, independent of any membership
      gating.** Three separate, compounding problems, discovered while
      wiring the gate: (1) `POST /applications` requires
      `@RequirePermissions('application.create')`, a staff-only CRM
      permission — but no role is ever assigned to a self-registered
      student account (`registerSelf`/`MembershipService.approve()` never
      insert a `user_roles` row), so a real student calling this route
      would always 403. (2) `forsa-student/src/pages/apply/
      InterviewPage.tsx`'s submission payload never included `studentId`
      at all — the INSERT would have hit `applications.student_id`'s
      `NOT NULL` constraint. (3) `NewApplicationPage.tsx` *did* send a
      `studentId`, but it was `user!.id` (the auth user's row), not the
      actual `students.id` — a different UUID entirely, which would have
      violated the FK constraint. **None of this was caught before now
      because nothing had ever actually exercised this code path
      end-to-end.** Fixed by adding a new self-scoped `POST /applications/me`
      (`ApplicationsService.createForSelf`) that resolves the student
      server-side from the JWT identity (never a client-supplied
      `studentId` — same pattern as `findMe`/`findMyPayments`/`findMyPass`)
      and gates on `membership_status IN ('bronze','silver','gold')`
      before creating. Both `forsa-student` callers (`InterviewPage.tsx`,
      `NewApplicationPage.tsx`) now call this route instead of the
      generic staff one. Also fixed: `InterviewPage.tsx`'s submission
      error handling used to be a bare `catch { /* still show done */ }` —
      any failure (including the new 403 gate) was silently swallowed and
      the user saw a false "Interview Complete!" success screen with no
      application actually created. Now shows a real error state
      directing the user to `/join` (Membership Request) when the gate
      rejects them, or a support-contact message for any other failure.
      Also added the missing `applications.ai_score_overall`/
      `ai_recommendation`/`ai_report`/`interview_language`/
      `interview_transcript` columns (migration 009) — these were
      referenced by `src/seeds/seed-demo.ts` and the K-18 fix's frontend
      payload but had never actually been migrated, meaning AI interview
      data was being silently dropped by every submission even before
      today. 4 new tests, 84/84 backend tests passing.
- [x] T-208 Student-side required documents for financing: identity, address,
      university documents, tuition, academic records.
      **2026-07-05 — document *requirement checklist* itself unchanged
      (already existed via `document.requirements.standard` policy +
      Stage 1 completeness); this pass's scope was specifically the
      freshness/expiry half — see T-209.**
- [x] T-209 Guarantor-side required documents: identity, employment
      certificate, payslips, last 3 bank statements, existing loans, financial
      commitments. All documents must be current — add an expiry/freshness
      check (leverage `document_types.expiry`-tracking already scaffolded per
      spec §8).
      **2026-07-05 — freshness/expiry check DONE; confirmed the
      "already scaffolded" claim in this task's own description is
      wrong.** Checked directly against the live schema: neither
      `document_types` nor `documents` had any expiry-tracking column at
      all before today. New migration `009_financing_request.sql` adds
      `document_types.validity_months` (NULL = never expires) and
      `documents.expires_at`. `DocumentsService.confirmUpload()` now
      computes `expires_at` from the matching document type's
      `validity_months` at the moment a document is confirmed uploaded.
      `PipelineService.stage1Completeness`'s document-completeness query
      now excludes expired documents from counting as satisfying a
      requirement, even if their verification `status` is still
      `verified`/`under_review` — a document verified 18 months ago can be
      stale without ever being re-reviewed. No new admin UI for
      configuring which document types expire and after how long — that's
      a reasonable fast-follow (a single `validity_months` field per
      document type in an existing settings page), deliberately deferred
      to keep this pass's scope to making the mechanism actually work.

### 2.5 AI philosophy & scoring model
- [~] T-210 AI outputs (advisory only, never a decision): Household Stability,
      Financial Capacity, Academic Commitment, Documentation Quality,
      Interview Assessment, Risk Level, Recommendation, Confidence, Executive
      Summary. AI must never be able to set an approval outcome directly —
      audit the code path to guarantee `aiRecommendation` can only ever flow
      into a human-decision input, never auto-write `approved_level*`
      (this directly fixes the T-312-class fabricated-demo-score risk from the
      original audit).
      **2026-07-05 — K-18 fabricated-demo-score sub-issue FIXED (launch
      blocker); the full Household Stability output set (9 fields above) is
      Phase 2 scope, not yet built.** `forsa-student/src/pages/apply/
      InterviewPage.tsx`'s demo-mode fallback used to generate a
      `Math.random()` "AI score" and submit it as `aiScoreOverall`/
      `aiRecommendation` — indistinguishable from a real assessment to
      anyone downstream, with only an ephemeral chat-UI badge as disclosure.
      Fixed: demo mode no longer fabricates any score; those two fields are
      explicitly `null` whenever the real `/ai/score` endpoint wasn't used
      (tracked via a `demo_mode` flag threaded through `aiReport`). Confirmed
      no backend logic reads these columns (grep — only the already-broken
      `seed-demo.ts` does), and the dashboard's display code already
      defaults to `{}` on a missing `scores` object, so nothing downstream
      breaks on the new `null`. The broader Household Stability
      advisory-output redesign (this task's original scope) remains open.
- [x] T-211 Implement Household Stability as the primary evaluation
      dimension with recommended weights: 35% Household Stability, 25%
      Financial Capacity, 20% Academic Commitment, 10% Documentation Quality,
      10% Interview. Decide how this relates to the existing FORSA Score
      Engine's 5 dimensions (`payment_reliability` 0.40,
      `documentation_reliability` 0.20, `communication_reliability` 0.15,
      `academic_continuity` 0.15, `guarantor_reliability` 0.10) — these are
      **not the same weighting scheme or even the same dimensions**; see
      D-008. A lower-income-but-stable household must be able to outrank a
      wealthier-but-less-responsible one when both can sustain the payment
      plan — write this as an actual test case once the scoring logic exists.
      **2026-07-05 — DONE (D-003 weights, hardcoded + centralized per the
      approved decision).** New `src/ai/household-stability.util.ts`
      exports `HOUSEHOLD_STABILITY_WEIGHTS` (35/25/20/10/10) and a pure
      `computeHouseholdStabilityScore()` — every call site reads from this
      one module, nothing inlines the percentages. **Correctness fix that
      wasn't originally in scope but was clearly necessary once building
      this**: `ai_score_overall`/`ai_recommendation` used to be whatever
      the client sent, completely untrusted server-side — a bug
      independent of D-003 but directly adjacent to it. Now
      `ApplicationsService.create()` recomputes `ai_score_overall`
      deterministically from `aiReport.scores` (the AI's raw per-dimension
      numbers) using these weights, and `ai_recommendation` is derived
      from that same computed score via fixed thresholds
      (`deriveRecommendation()`) — never trusted directly from the client
      or the LLM's own (unreliable) arithmetic either way. Updated
      `forsa-student/InterviewPage.tsx`'s scoring prompt to request the 5
      canonical dimension names (was the old, now-retired
      educational_readiness/financial_readiness/planning_readiness/
      commitment_readiness/interview_quality set) and stopped sending
      `aiScoreOverall`/`aiRecommendation` in the submission payload at all
      (the backend computes and ignores them regardless now). The exact
      "lower-income-but-stable household can outrank a wealthier-but-
      less-responsible one" test case this task calls for is written and
      passing in `household-stability.util.spec.ts`. **D-008 boundary
      respected**: this only ever touches `applications.ai_report`/
      `ai_score_overall` — `src/score/score.service.ts`
      (`forsa_scores`/`score_events`, the separate ongoing FORSA Score
      engine) was not touched at all. Also fixed a consequence of the
      dimension rename: `forsa-dashboard`'s `RankingPage.tsx` was still
      reading the old dimension names and would have silently shown blank
      scores for every new interview — updated its 4 displayed
      sub-dimension columns to the 4 highest-weighted of the 5 new ones
      (Household/Financial/Academic/Documents), and switched its "overall"
      source to the reliable `ai_score_overall` DB column instead of the
      now-removed `scores.overall_forsa_score` JSON field. 8 new tests
      across `household-stability.util.spec.ts` +
      `applications.service.spec.ts`, 92/92 backend tests passing.
- [x] T-212 Fix the hardcoded invalid Anthropic model string
      (`'claude-sonnet-4-6'` in `forsa-os/src/ai/`) as part of this rebuild —
      use a real current model id (check the `claude-api` skill for the
      current list) and consider the official Anthropic SDK over the
      hand-rolled `axios` call.
      **2026-07-05 — model string fixed (K-17), SDK migration NOT done.**
      Per the `claude-api` skill, `'claude-sonnet-4-6'` is actually a real,
      currently-active model id today (the original audit's "invalid"
      characterization may have predated Sonnet 4.6's release, or was simply
      wrong) — but per the skill's own non-negotiable default ("always use
      `claude-opus-4-8` unless the user explicitly names a different
      model"), switched to `claude-opus-4-8` anyway for a feature that feeds
      real financing decisions. Still using the hand-rolled `axios` call
      against the raw Messages API, not the official `@anthropic-ai/sdk` —
      that migration remains a follow-up (bigger scope, not done as part of
      this quick launch-blocker fix). **K-18 (fabricated demo-mode score
      reaching real decisions) is separately still open** — this task only
      closed the model-string half of the combined "AI interview" launch
      blocker.

### 2.6 Human decision & outcomes
- [x] T-213 Implement the full outcome set: Bronze, Silver, Gold, Waiting
      List, More Information Required, Financing Not Approved At This Time,
      Fraud. Waiting List must be used specifically when funding is
      unavailable — **never reject solely because capital is exhausted**;
      this replaces/extends the existing `capital_queue` soft-block concept
      (Pipeline Stage 6) — reconcile the two rather than building a parallel
      mechanism.
      **2026-07-05 — DONE.** `submitHumanDecision`'s decision union extended
      with `'waiting_list'` (Stage 9 maps it to `DecisionResult
      .CAPITAL_QUEUE`, reusing the existing `capital_queue` table/mechanism
      per the instruction — not a parallel one). `ApplicationStatus` gained
      `MORE_INFO_REQUIRED` and `FRAUD_FLAGGED` (and the enum's 6 dead
      V2-vocabulary values were finally retired here — this is the first
      point Phase 2 actually needed the new values, not a speculative
      cleanup; confirmed via repo-wide grep they were unreferenced). Bronze/
      Silver/Gold is `applications.financing_tier` (new column, migration
      010), set by the reviewer alongside an `approved` decision and applied
      in Stage 10 — which also ratchets `students.membership_status` up to
      match (never down, per D-004). **Found and fixed a real latent bug
      while wiring Waiting List**: Stage 9 could already produce
      `DecisionResult.CAPITAL_QUEUE` (the automatic Stage-6 soft-block
      already used it), but Stage 10's status-map never actually included
      it — an application soft-blocked this way had its `current_status`
      silently left unchanged forever. Fixed as part of this task, not
      separately. Financing Not Approved At This Time reuses the existing
      `rejected` outcome (already the correct semantic, no new status value
      needed). Fraud is a dedicated `POST /pipeline/runs/:id/fraud` action
      (see T-217), deliberately not folded into this decision union.
- [x] T-214 Enforce that only a human can approve financing, and that CEO is
      the sole override role — this is also where the existing but unenforced
      dual/executive multi-approver requirement (Stage 7/8 gap from the
      original audit) should finally be gated for real.
      **2026-07-05 — dual/executive multi-approver enforcement DONE (K-12,
      launch blocker #1, prior session); CEO-override DONE this session.**
      `submitHumanDecision` (`src/pipeline/pipeline.service.ts`) previously
      inserted a `reviewer_decisions` row and unconditionally continued the
      pipeline to Stage 9 — a single reviewer could finalize any decision
      regardless of the dual/executive-approver count Stage 7 itself
      computed and Stage 8 recorded on `multi_approval_sets`. Now: an
      `approved` decision is only allowed to proceed once `COUNT(DISTINCT
      reviewer_id)` of `'approved'` decisions on that pipeline run meets
      `required_approvers` — otherwise it returns `{ status:
      'awaiting_additional_approver', ... }` without advancing the
      pipeline. `rejected`/`on_hold`/`needs_more_documents` still proceed
      immediately on a single reviewer's say-so (deliberate — the control
      this closes is specifically about preventing one person from
      single-handedly approving a large amount, not about slowing down a
      stop/pause action). Also added a same-reviewer-can't-vote-twice guard
      (`ConflictException`), since without it the same person could satisfy
      a "2 distinct approvers" requirement by submitting twice.
      **CEO-override**: new `POST /pipeline/runs/:id/override`
      (`PipelineService.overrideDecision`) — a dedicated method, not a
      branch inside `submitHumanDecision`, so the consensus bypass can
      never accidentally apply to a normal reviewer decision. Gated behind
      a new, distinct `financing.override` permission (not
      `pipeline.review`) — "CEO is the sole override role" is enforced by
      which role a tenant assigns this permission to, not a hardcoded
      user/role check in code (matching how every other role/permission
      assignment in this platform already works). Always writes
      `reviewer_decisions.is_override = true` (new column) and a distinct
      `pipeline.ceo_override` audit log entry — an override is never
      indistinguishable from a normal decision in the audit trail.
      **Also built the actual review UI, which turned out not to exist at
      all**: `pipelineApi.submitDecision` existed in
      `forsa-dashboard/lib/api.ts` since Phase 1 but no page anywhere ever
      called it — a pipeline run pausing at Stage 8 for human review had
      no UI path to submit that decision. New `HumanDecisionPanel` on
      `ApplicationDetailPage.tsx` (shown when `current_status ===
      'under_review'`): outcome select (including the new Waiting List/
      More Info outcomes), amount + financing-tier inputs, notes, and
      permission-gated Flag Fraud / CEO Override buttons.

### 2.7 Risk rules
- [~] T-215 Implement: max 10% of available capital in high-risk exposure;
      define and enforce max exposure per family; returning members get
      priority; first-year students are treated as generally higher risk than
      continuing students. Reconcile with the existing 40%-portfolio
      university-concentration cap (Stage 6) — these are different exposure
      axes (per-family/risk-tier vs. per-university) and both need to hold
      simultaneously.
      **2026-07-05 — the two hard caps DONE; "returning member priority" and
      "first-year higher risk" deliberately deferred (not forgotten).** Both
      new caps live in Stage 6 (`stage6PortfolioCapital`) alongside the
      existing university-concentration cap — three exposure axes, all
      three checked independently, any one can soft-block into
      `capital_queue`. **High-risk cap**: projects this application's
      requested amount onto total deployed high-risk exposure (via each
      deployed application's *most recent* `risk_profiles` row — an
      application can have more than one pipeline run over its lifetime —
      matched with a `LEFT JOIN LATERAL`, verified executing correctly
      against a real Postgres instance, not just reviewed by eye) —
      policy-configurable, defaults to 10%. **Family exposure cap
      (D-010)**: sums exposure across every student sharing the same
      `student_guarantors.guarantor_id` (`role='primary'`, `status=
      'active'`) — matches D-010's definition exactly (family = student +
      primary guarantor household; a guarantor backing multiple students
      has their exposure summed, not capped per-student). Policy-
      configurable, defaults to 100,000 TND per tenant.
      **Deferred, not built**: "returning members get priority" and
      "first-year students are generally higher risk" are queue-ordering/
      risk-scoring-input concerns rather than hard caps — the existing
      `capital_queue.priority_score` column and Stage 4's risk-assessment
      weights are the natural places for these respectively, but neither
      was touched this pass. Flagging explicitly rather than silently
      dropping.

### 2.8 Renewal
- [x] T-216 Every financing period requires a brand-new financing request
      (reuse the existing `is_renewal`/`previous_application_id` chaining
      already in the schema). Returning members: higher priority, updated
      documents required, FORSA Score considered as a real input to the
      renewal decision (not just displayed).
      **2026-07-05 — DONE, mostly by confirming existing mechanisms already
      satisfied this.** Every financing request already requires a fresh
      `POST /applications/me` call — no auto-renewal path exists to
      disable. FORSA Score was already a real Stage 4 risk-assessment
      input, not merely displayed. The one real gap: "returning members
      get priority" had no mechanism — `capital_queue.priority_score` was
      write-only (inserted at 4 call sites across Stage 6/9, never read or
      ordered by anything anywhere in the codebase, confirmed via grep).
      Added a flat +100 boost for `is_renewal` applications at all 4
      insertion sites, and built the read side that actually consumes it
      (see T-221's Waiting List page below) — `priority_score` had no
      observable effect on anything until this pass.

### 2.9 Fraud
- [x] T-217 Build a permanent blacklist + internal fraud record on confirmed
      fraud (forged documents, false identity, false guarantor, material
      misrepresentation) that permanently prohibits financing for that
      individual/family. This must survive and block any future membership
      request or financing request from the same identity — decide the
      matching key (national ID hash, not raw PII) up front.
      **2026-07-05 — DONE, with an honest caveat on the matching key.** New
      `POST /pipeline/runs/:id/fraud` (`PipelineService.flagFraud`) —
      deliberately a dedicated action, not folded into
      `submitHumanDecision`'s outcome set, since fraud is an identity-trust
      action (permanently blocks the student) rather than a financing-
      amount decision, and warrants its own more-restrictive permission
      (`fraud.flag`). One transaction: inserts an append-only
      `fraud_records` row (new table, migration 010, `RULE`-enforced no
      update/delete like the platform's other audit tables), sets
      `students.membership_status = 'blacklisted'` (+ history row), and
      transitions the application to the new `FRAUD_FLAGGED` status
      (terminal — no outgoing transition, reopening would undermine the
      permanent-blacklist guarantee). **Matching key caveat, decided
      explicitly rather than silently assumed solved**: the task asks for
      a national-ID-hash key, but national ID is not captured as a
      structured field anywhere in the current flow (Membership Request
      intake is deliberately minimal; it only ever exists later as an
      uploaded document image) — `fraud_records.identity_hash` is
      therefore a deterministic hash of normalized email for V1, the one
      identity signal actually collected from Visitor onward. Upgrading to
      a true national-ID-based key is a real follow-up once that's
      captured as a structured field earlier in the intake flow — this is
      flagged in the migration's own comment, not glossed over. New
      `GET /pipeline/fraud-records` + `forsa-dashboard`'s
      `FraudRecordsPage.tsx` (was an empty Phase 1 placeholder) now lists
      them.

### 2.10 Payment system
- [x] T-218 Keep the three payment methods (bank transfer, cash deposit,
      Konnect) flowing through one common workflow: Payment → Verification →
      Ledger → Receipt → FORSA Score Update. This is where T-105/T-111/the
      original audit's ledger-shape inconsistency (Konnect vs. manual path
      writing structurally different `financial_ledger` rows) and the
      missing Konnect→score-event call all get fixed together, since the spec
      now requires one unified pipeline rather than two parallel ones.
      **2026-07-05 — ledger-shape half DONE (K-14, launch blocker); Konnect
      score-event half also now DONE (K-13, fixed as Phase 2's M8 warm-up
      milestone).** New `src/payments/ledger.service.ts` is the single place
      that writes to `financial_ledger` — both `payments.service.ts`
      (manual/receipt-verification path) and `konnect.service.ts` call
      `LedgerService.recordEntries()`. This was a more serious bug than
      "structurally different": `konnect.service.ts` was inserting into
      `debit_account`/`credit_account` columns that **don't exist** in the
      live schema, violating the `entry_type` CHECK constraint — every real
      Konnect confirmation would throw a SQL error on the ledger write,
      after the payment was already marked verified. Fixed + locked down
      with tests. **K-13**: `konnect.service.ts` now calls
      `ScoreService.recordEvent` with the same on-time/late logic as the
      manual path's `verifyPayment`. Found and fixed a more severe sibling
      bug while doing this: `recordedBy: 'system'` was being inserted into
      `score_events.recorded_by` (a `UUID` column) on every automated score
      event — both this new Konnect path and the pre-existing daily
      overdue-installment cron job — throwing `invalid input syntax for
      type uuid`, silently swallowed by the cron job's `.catch()`, meaning
      `PAYMENT_OVERDUE` events were never actually recorded in production.
      Fixed by widening `ScoreService.recordEvent`'s type to `string | null`
      and passing `null` (the column is nullable) for system-triggered
      events. Both payment methods now flow through one unified pipeline
      with consistent ledger + score consequences.
- [x] T-219 Student dashboard must show complete payment history end-to-end
      (not just recent installments).
      **2026-07-05 — DONE (Phase 2 M8 warm-up).** Found the data source
      already existed: `GET /students/:id/payments` (via
      `getPaymentHistory`) already spans every payment across every
      application/financing period for a student — it just required the
      staff-only `payment.view` permission, so an actual student portal
      user 403'd on it. Added a self-scoped `GET /students/me/payments`
      (`findMyPayments`, same JWT-identity-resolution pattern as the
      existing `findMe`), and wired `forsa-student`'s `PaymentsPage.tsx`
      with a new "Complete Payment History" section that renders
      regardless of whether a *current* schedule exists — important for a
      renewed student between financing periods, whose prior-period
      payments would otherwise be invisible once that period's schedule is
      no longer "the" active one.

### 2.11 Student dashboard
- [~] T-220 Rebuild (`forsa-student`) around: Welcome, Membership Status,
      FORSA ID, Digital Student Pass, Profile Completion, Financing Status,
      Next Action, Payment Status. Explicit design goal from the spec: "every
      page must reduce anxiety" — favor clear single next-actions over dense
      status tables.
      **2026-07-05 — done with clearly-marked placeholders.** `HomePage.tsx`
      rewritten in the new field order. Real/wired: Profile Completion,
      Financing Status, Payment Status, and a new single-CTA "Next Action"
      hero card. Stubbed (visible "Preview" badge + `TODO` comments
      referencing T-201–T-206): Membership Status, FORSA ID, Digital Student
      Pass — no backend endpoints exist yet for these.

### 2.12 Admin dashboard
- [~] T-221 Add/rebuild (`forsa-dashboard`) navigation for: Membership Queue,
      Financing Queue, AI Queue, Waiting List, Payments, Guarantors,
      Universities, Digital Pass, Fraud Records, Audit Trail. Several of these
      are extensions of existing pages (Payments, Universities, Audit already
      exist); Membership Queue, Financing Queue, AI Queue, Waiting List,
      Digital Pass admin, and Fraud Records are net-new.
      **2026-07-05 — Membership Queue, Digital Pass, Fraud Records, and
      Waiting List now DONE (real data, wired this phase); Financing Queue
      and AI Queue remain pending placeholders.** Waiting List
      (`WaitingListPage.tsx`) added this milestone: new `GET
      /pipeline/capital-queue`, ordered by `priority_score DESC` — the
      first thing in the codebase to actually read that column (see T-216).
      Also built, while here: a real `HumanDecisionPanel` on
      `ApplicationDetailPage.tsx` (Milestone 7) — `pipelineApi
      .submitDecision` had existed since Phase 1 with no page ever calling
      it, so a pipeline run paused for human review had no UI path at all.

### 2.13 Finance portal
- [ ] T-222 Confirm/extend (`forsa-finance`) to fully support: payment
      verification, receipts, Konnect, ledger, late payments, exports — this
      is largely T-107(original)/T-305/T-306/T-307-class fixes from the audit,
      done properly this time rather than left as stubs (`DisbursementsPage`
      placeholder, non-functional "view receipt" button, raw-JSON export all
      need to actually work).
      **Not started as of 2026-07-05** — flagged explicitly as remaining
      Phase 2 frontend work, not silently dropped.

### 2.14 University portal
- [x] T-223 Confirm/extend (`forsa-university`) to support: student
      confirmation, tuition confirmation, enrollment confirmation. Explicit
      constraint: **university can never change a financing decision** — keep
      this portal read-only for decisions, write-capable only for the three
      confirmation actions above (net-new write capability — today it's 100%
      read-only, so this is a deliberate, narrow exception to add).
      **2026-07-05 — DONE, but found a severe pre-existing bug first and
      fixed that before adding the new write capability.** While starting
      this task, found that `forsa-university`'s login form collected
      "University ID" as a raw, user-typed text field and stored it
      directly to localStorage — zero server-side verification. Every
      subsequent "my university" API call trusted that client-supplied
      value entirely. This is the exact same class of bug as K-03/T-103
      (`forsa-partner`'s `partners[0]` issue, fixed in Phase 1) — a
      client-supplied identity trusted for tenant-scoped data access —
      except worse here, since it was a manually-typed field, not even an
      array index: any logged-in university-portal user could type a
      different university's id and immediately read that university's
      complete student/financial data. **Fixed exactly mirroring T-103's
      approach**: new migration `011_university_identity.sql`
      (`universities.user_id`, `users.university_id_linked`), new
      self-scoped `GET /universities/me` resolved via the JWT identity
      (never anything client-supplied), and — since no university
      self-registration flow exists to establish this link on its own — a
      new staff-facing `PATCH /universities/:id/link-user`. The login
      form's University ID field is now removed entirely;
      `AuthContext.tsx` resolves it server-side after login. Verified the
      full 001→011 migration chain against a real local Postgres instance.
      **Then delivered the actual T-223 ask**: `POST /applications/:id/
      university-confirm` (`ApplicationsService.confirmEnrollment`) —
      self-scoped the same way, explicitly checks `application
      .university_id === university.id` before allowing it (Forbidden
      otherwise) — inserting a new `ApplicationStatus.UNIVERSITY_CONFIRMED`
      between `CONTRACT_SIGNED` and `UNIVERSITY_PAID`. The university
      still cannot touch a financing decision itself — this is the only
      new write path, and it's one status transition, not a decision.
      5 new tests (`universities.service.spec.ts`) lock down the identity
      fix; 2 more in `applications.service.spec.ts` lock down the
      cross-university rejection. Found and fixed, in the same pass: all
      3 frontend portals' `Badge` color/label maps were missing every
      `ApplicationStatus` value added since Milestone 2 (`more_info_required`,
      `fraud_flagged`, `capital_queue`'s "Waiting List" relabel, and this
      milestone's `university_confirmed`) — fixed across `forsa-dashboard`/
      `forsa-university`/`forsa-student` together.

### 2.15 Partner portal
- [ ] T-224 Partner must only ever access their own students/referrals/
      statistics/commissions — **never trust client-side identity** for this
      (this is exactly T-103 above, generalized as a standing rule for every
      new partner-scoped feature added from here on, not just the one bug).

### 2.16 Notifications (event-driven)
- [ ] T-225 Build real event-driven notifications for at minimum: membership
      submitted, Bronze granted, Digital Pass ready, financing started,
      missing documents, AI interview (scheduled/ready), Waiting List, Silver
      approved, Gold approved, payment received, payment overdue. This
      supersedes the original 8 dead email templates (T-106) — design the
      trigger list once, covering both sets, rather than wiring twice.

### 2.17 Legal
- [ ] T-226 Rewrite/update all legal copy to reflect the membership-first
      model: Terms of Use, Privacy Policy, Membership Terms, Financing Terms,
      AI Consent, Guarantor Terms, Payment Terms, Fraud Policy. Needs legal/
      compliance sign-off before publishing — flag as a content task, not a
      pure engineering one; coordinate with whoever owns that review.

---

## Phase 3 — Testing (adversarial, not just happy-path)

Explicit instruction from the spec: **do not stop after one successful run —
attempt to break the platform, and keep fixing until no launch-blocking issue
remains.**

- [ ] T-301 Backend unit/integration tests (builds on T-109's foundation) —
      full coverage of auth, permissions, pipeline, payments, membership flow.
- [ ] T-302 Frontend tests across all 6 portals (currently zero anywhere).
- [ ] T-303 API contract tests (all 111+ endpoints, including the new
      membership/fraud/pass endpoints).
- [~] T-304 Authentication tests: login, MFA, lockout, session expiry, token
      refresh (including resolving the bearer-vs-cookie refresh-strategy
      inconsistency across portals — original audit finding).
      **2026-07-05 — the refresh-strategy inconsistency itself is FIXED**
      (K-16/K-47, launch blocker #3): confirmed against `RefreshTokenDto`
      that bearer-in-body is the only correct pattern (no cookie fallback
      exists), fixed `forsa-finance`/`forsa-guarantor` (were sending an
      empty body, 400ing on every refresh) and `forsa-partner` (was calling
      bare `axios.post()` with no configured base URL). University portal's
      separate relative-path refresh bug (K-26) not touched — different
      root cause, still open, still Post-Launch. **Automated auth test
      suite (login/MFA/lockout/session-expiry) is Phase 3 scope, still not
      built** — this update only closes the specific inconsistency, not the
      broader task.
- [ ] T-305 Permission/role-isolation tests: every role can only reach what
      it's granted (extend the audit's manual spot-checks into real automated
      tests) — cross-role and cross-tenant isolation both need coverage.
- [ ] T-306 Payment tests: manual recording, receipt verification, reversal,
      ledger correctness (debits=credits), score-event side effects.
- [ ] T-307 Konnect tests: signature verification (valid/invalid/replayed),
      webhook reachability now that T-105 is fixed, idempotent confirmation.
- [ ] T-308 Browser automation across all 6 portals — golden paths + edge
      cases per portal.
- [ ] T-309 Mobile viewport testing (Partner/Guarantor portals are
      mobile-first by design).
- [ ] T-310 Desktop viewport testing.
- [ ] T-311 Slow-network condition testing (throttled connection — surfaces
      race conditions in the token-refresh/concurrent-401-queuing logic).
- [ ] T-312 Duplicate-registration handling (membership request submitted
      twice for the same identity — should not create two Bronze memberships).
- [ ] T-313 Invalid file upload handling (wrong mime type, oversized, corrupt)
      across every document/receipt upload surface, now that T-111 makes those
      uploads real.
- [ ] T-314 Security validation pass — rerun the `security-review` skill
      against the full diff once Phase 1+2 land, independent of this list.

---

## Phase 4 — Final Deliverables

Produce and check off once Phase 1-3 are substantively complete:

- [ ] T-401 Complete implementation report.
- [ ] T-402 List of engineering fixes (can be generated largely from
      `CHANGELOG.md` at that point).
- [ ] T-403 Browser testing report (results of Phase 3's automation runs).
- [ ] T-404 Security report.
- [ ] T-405 Remaining technical debt document (carry forward anything from
      the original Phase 3/4 cleanup items below that's still open).
- [ ] T-406 Launch Readiness Report.
- [ ] T-407 Final Go / No-Go recommendation.

**After T-407 is delivered and accepted, FORSA enters feature freeze**: only
bug fixes, security fixes, compliance updates, and critical UX improvements
are permitted past that point. Record the freeze date in `DECISIONS.md` when
it happens.

---

## Phase 5 — Lower-priority cleanup (parallel-track, non-blocking)

Carried over from the original audit-derived backlog. Pick these up
opportunistically alongside Phase 1-3 work — none of them block Phase 2.

- [ ] T-501 Remove the literal unexpanded-brace-expression directories present
      in all 7 repos (debris from an unexpanded `mkdir -p path/{a,b,c}`).
- [ ] T-502 Delete `forsa-os/src/roles/` (empty dead scaffold) and other empty
      `common/` subfolders (`dto/`, `pipes/`, `guards/`, `interfaces/`).
- [ ] T-503 Fix/remove `forsa-os/src/seeds/seed-demo.ts` — confirmed broken
      against the live schema.
- [ ] T-504 Remove dead feature flags (`FEATURE_MFA_REQUIRED`,
      `FEATURE_WHATSAPP_NOTIFICATIONS`, `FEATURE_AI_DOCUMENT_VERIFICATION`,
      `FEATURE_STUDENT_PORTAL`, `FEATURE_PARTNER_PORTAL`).
- [ ] T-505 Remove orphaned duplicate files (`ApplyLayout.tsx`/`HomePage.tsx`
      in `forsa-finance`/`forsa-guarantor`, unused `PaymentsPage.tsx` in
      `forsa-finance`, unrouted broken `RegisterPage.tsx` in `forsa-guarantor`
      — the last one is subsumed by T-102 if rebuilt rather than deleted).
- [ ] T-506 Remove dead `rate_limit_buckets` table and the duplicate
      `outbox_events` "pending" partial index (defined in both migration 001
      and 002).
- [ ] T-507 `BCRYPT_ROUNDS` env var validated but never consumed (real hashing
      is argon2id) — remove or wire in.
- [ ] T-508 Replace raw SQL migrations with versioned TypeORM migrations
      (team's own `docs/PRODUCTION_CHECKLIST.md` deferred item) — do this
      *as part of* T-201's new membership migrations if feasible, rather than
      as a separate later effort.
- [ ] T-509 Replace third-party QR API (`api.qrserver.com`) dependency with a
      self-hosted QR library — relevant again now that T-205/T-206 add a
      second QR use case (Digital Student Pass verification).
- [ ] T-510 Remove duplicate `fix-quotes.js` dead twin across all 6 frontend
      repos; consider fixing the root source-generation defect.
- [ ] T-511 Add a real unauthenticated `/health` endpoint (currently
      `GET /auth/me` returning 401 is used as a de facto health check).
- [ ] T-512 Harden `Dockerfile` (multi-stage build, `HEALTHCHECK`, non-root
      `USER`) once the deployment target is finalized (see D-006).
- [ ] T-513 University/Partner portals hardcode a single tenant UUID — make it
      user-supplied/configurable like Dashboard/Finance/Guarantor.
- [ ] T-514 University portal's "Notes" feature is `localStorage`-only —
      wire to a real backend endpoint or clearly label as device-local.
- [ ] T-515 University portal's language switcher doesn't translate content
      (labels/`dir` only) — non-functional i18n.
- [x] T-516 Admin Dashboard `SettingsPage` hardcodes `localhost:3000` links —
      derive from actual env config. **DONE 2026-07-05 — see T-113 above**,
      fixed as part of the Phase 1 dashboard pass rather than deferred here.
- [ ] T-517 Row-Level Security designed but never deployed — decide whether to
      port it into a real migration or formally drop the intent (see D-007).

---

## How to add new tasks

Append to the relevant phase with the next free `T-XXX` id in that phase's
number range. Keep one-line summary + enough file/repo detail that a cold
session can act on it without re-reading the full spec.
