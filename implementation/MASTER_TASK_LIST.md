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

Per the 2026-07-05 spec's own ordering. Each bullet below is that spec's item,
expanded with the concrete detail already gathered from the audit.

- [~] T-101 **Student self-registration → real auth account.**
      `RegisterPage.tsx` (`forsa-student`) calls `POST /students`
      (`forsa-os/src/students/`), a staff-only CRM lead-creation endpoint
      (`student.create` permission) that never writes to `users`/auth and never
      stores a password — so a "registered" student cannot log in afterward.
      Needs design decision D-001 before coding (new public registration
      endpoint that creates both a `students` row and a `users` row
      transactionally, vs. other approach).
      **2026-07-05 — frontend half done, backend not started.** Student-portal
      worker: `RegisterPage.tsx` now sends `password` in the payload and shows
      an honest "account created, sign-in failed" message on post-signup login
      failure instead of a misleading "may already be registered" one; added
      `ForgotPasswordPage.tsx`/`/forgot-password` route (support-contact
      placeholder, no reset endpoint exists). **Still blocking**: `POST
      /students` is still `JwtAuthGuard`+`student.create`-gated with no
      `password` field in its DTO — anonymous registration still 401s. Backend
      half (real public endpoint + `users` row provisioning per D-001) not yet
      landed as of this checkpoint.
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
- [ ] T-109 **Add automated testing foundation.**
      Zero test files exist anywhere across all 7 repos despite full Jest
      scaffolding in `forsa-os`. Minimum bar before Phase 2 starts: auth/login
      + JWT guard tests, application `STATUS_TRANSITIONS` allow-list tests,
      payment recording + ledger-write tests, pipeline stage 1-10 tests. This
      becomes the harness Phase 3 (full test sweep) builds on.
      **2026-07-05 — NOT STARTED.** Backend worker was interrupted before
      reaching this item; confirmed zero `.spec.ts` files exist anywhere in
      `forsa-os/src` or `forsa-os/test`.

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
- [~] T-111 Receipt-upload flows (Student + Guarantor portals) transmit only
      the filename, never the file bytes — Finance staff have nothing to
      inspect. Wire a real upload using the existing S3 presigned-URL flow
      already used by `documents.service.ts`.
      **2026-07-05 — Student portal half done, blocked on 2 backend gaps.**
      `PaymentsPage.tsx`'s `ReceiptUpload` now runs the real presigned-upload
      flow (`documentApi.getUploadUrl` → S3 PUT → `confirmUpload` →
      `receiptDocumentId` sent alongside `receiptFilename` to `POST
      /payments/receipts`). **Blocked on backend**: (1) no active
      `document_types` row with code `payment_receipt` exists yet — the
      upload-url call will 400 without it; (2) `payments.submitReceipt`/the
      `payments` table don't persist `receiptDocumentId` anywhere yet — it's
      currently sent but silently dropped (harmless no-op, not yet wired).
      Guarantor portal half not started.
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
- [ ] T-201 Design and migrate new tables/columns for: membership records
      (level: bronze/silver/gold, status, `forsa_id`, `member_since`),
      Digital Student Pass (generate-once/update-status-only — never
      recreate), fraud/blacklist records, waiting-list entries. New
      `migrations/00X_membership.sql`, following the live schema convention
      (raw SQL + `scripts/migrate.ts`), not `database/schema/`.
- [ ] T-202 Decide how the new lifecycle stages (Visitor → Membership Request →
      Bronze → FORSA ID → Digital Pass → Member Dashboard → Complete Profile →
      Financing Eligibility → Financing Request → Documents → AI Interview →
      AI Assessment → Human Review → Silver/Gold → University Confirmation →
      Payment Plan → FORSA Score → Renewal) map onto the existing `applications`
      state machine and pipeline stages 1-10 — see D-004/D-008. Implement the
      resulting single, coherent status model (this is where T-107 above and
      this design converge).

### 2.2 Membership request & Bronze issuance
- [ ] T-203 Build a genuinely public `POST /membership-requests` endpoint
      (`forsa-os`) collecting only: name, phone, email, city, university,
      programme, academic year, current/future student. Explicitly no
      guarantor, no financial documents, no salary/bank statements at this
      stage.
- [ ] T-204 On approval: issue Bronze membership, generate FORSA ID, generate
      Digital Student Pass (idempotent — one-time generation, status-only
      updates thereafter). This is also the natural place to finally solve
      T-101/T-102 (registration → real `users` row) since Bronze issuance is
      the first point a real portal login should exist.

### 2.3 Digital Student Pass
- [ ] T-205 Build pass generation (FORSA logo, student name, FORSA ID, member
      since, membership level, university, academic year, QR verification,
      status). Design the data model so wallet-provider fields (Apple
      Wallet/Google Wallet pass identifiers, signing certs) can be added later
      without a breaking migration — don't build the wallet integration itself
      yet, just don't block it.
- [ ] T-206 QR verification: a scan should resolve to a live status check
      (membership valid/level/expired), not a static payload — needs a
      lightweight public verification endpoint.

### 2.4 Financing request (post-Bronze only)
- [ ] T-207 Gate the existing financing/application flow behind an active
      Bronze (or higher) membership — a visitor with no membership should not
      be able to reach it.
- [ ] T-208 Student-side required documents for financing: identity, address,
      university documents, tuition, academic records.
- [ ] T-209 Guarantor-side required documents: identity, employment
      certificate, payslips, last 3 bank statements, existing loans, financial
      commitments. All documents must be current — add an expiry/freshness
      check (leverage `document_types.expiry`-tracking already scaffolded per
      spec §8).

### 2.5 AI philosophy & scoring model
- [ ] T-210 AI outputs (advisory only, never a decision): Household Stability,
      Financial Capacity, Academic Commitment, Documentation Quality,
      Interview Assessment, Risk Level, Recommendation, Confidence, Executive
      Summary. AI must never be able to set an approval outcome directly —
      audit the code path to guarantee `aiRecommendation` can only ever flow
      into a human-decision input, never auto-write `approved_level*`
      (this directly fixes the T-312-class fabricated-demo-score risk from the
      original audit).
- [ ] T-211 Implement Household Stability as the primary evaluation
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
- [ ] T-212 Fix the hardcoded invalid Anthropic model string
      (`'claude-sonnet-4-6'` in `forsa-os/src/ai/`) as part of this rebuild —
      use a real current model id (check the `claude-api` skill for the
      current list) and consider the official Anthropic SDK over the
      hand-rolled `axios` call.

### 2.6 Human decision & outcomes
- [ ] T-213 Implement the full outcome set: Bronze, Silver, Gold, Waiting
      List, More Information Required, Financing Not Approved At This Time,
      Fraud. Waiting List must be used specifically when funding is
      unavailable — **never reject solely because capital is exhausted**;
      this replaces/extends the existing `capital_queue` soft-block concept
      (Pipeline Stage 6) — reconcile the two rather than building a parallel
      mechanism.
- [ ] T-214 Enforce that only a human can approve financing, and that CEO is
      the sole override role — this is also where the existing but unenforced
      dual/executive multi-approver requirement (Stage 7/8 gap from the
      original audit) should finally be gated for real.

### 2.7 Risk rules
- [ ] T-215 Implement: max 10% of available capital in high-risk exposure;
      define and enforce max exposure per family; returning members get
      priority; first-year students are treated as generally higher risk than
      continuing students. Reconcile with the existing 40%-portfolio
      university-concentration cap (Stage 6) — these are different exposure
      axes (per-family/risk-tier vs. per-university) and both need to hold
      simultaneously.

### 2.8 Renewal
- [ ] T-216 Every financing period requires a brand-new financing request
      (reuse the existing `is_renewal`/`previous_application_id` chaining
      already in the schema). Returning members: higher priority, updated
      documents required, FORSA Score considered as a real input to the
      renewal decision (not just displayed).

### 2.9 Fraud
- [ ] T-217 Build a permanent blacklist + internal fraud record on confirmed
      fraud (forged documents, false identity, false guarantor, material
      misrepresentation) that permanently prohibits financing for that
      individual/family. This must survive and block any future membership
      request or financing request from the same identity — decide the
      matching key (national ID hash, not raw PII) up front.

### 2.10 Payment system
- [ ] T-218 Keep the three payment methods (bank transfer, cash deposit,
      Konnect) flowing through one common workflow: Payment → Verification →
      Ledger → Receipt → FORSA Score Update. This is where T-105/T-111/the
      original audit's ledger-shape inconsistency (Konnect vs. manual path
      writing structurally different `financial_ledger` rows) and the
      missing Konnect→score-event call all get fixed together, since the spec
      now requires one unified pipeline rather than two parallel ones.
- [ ] T-219 Student dashboard must show complete payment history end-to-end
      (not just recent installments).

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
      **2026-07-05 — nav scaffolding DONE, real functionality NOT started
      (as intended for this pass).** Routes + clearly-labeled "pending" empty
      state pages added at `src/pages/pending/*.tsx` for all 6 net-new
      sections; nav items + icons + i18n labels (en/fr/ar) wired into
      `Layout.tsx`/`i18n.ts`. No fake data — genuinely empty/pending states
      only, per the brief. Real backend-integration work for these sections
      is Phase 2 scope (T-201-T-206, T-217) and not started.

### 2.13 Finance portal
- [ ] T-222 Confirm/extend (`forsa-finance`) to fully support: payment
      verification, receipts, Konnect, ledger, late payments, exports — this
      is largely T-107(original)/T-305/T-306/T-307-class fixes from the audit,
      done properly this time rather than left as stubs (`DisbursementsPage`
      placeholder, non-functional "view receipt" button, raw-JSON export all
      need to actually work).

### 2.14 University portal
- [ ] T-223 Confirm/extend (`forsa-university`) to support: student
      confirmation, tuition confirmation, enrollment confirmation. Explicit
      constraint: **university can never change a financing decision** — keep
      this portal read-only for decisions, write-capable only for the three
      confirmation actions above (net-new write capability — today it's 100%
      read-only, so this is a deliberate, narrow exception to add).

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
- [ ] T-304 Authentication tests: login, MFA, lockout, session expiry, token
      refresh (including resolving the bearer-vs-cookie refresh-strategy
      inconsistency across portals — original audit finding).
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
