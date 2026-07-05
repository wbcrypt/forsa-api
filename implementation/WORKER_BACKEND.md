# Worker Prompt — Backend (forsa-os) — Phase 1 Critical Fixes

Paste this entire file as your first message to a fresh Claude Code session
opened in `/Users/wael/Downloads/forsa-deploy-stack-final/forsa-os`.

---

You are working on the FORSA backend (`forsa-os`, a NestJS/TypeORM(mostly raw
SQL)/PostgreSQL API). This is one of several parallel workers on the FORSA
platform — you own the backend repo only. Do not touch any sibling repo
(`forsa-dashboard`, `forsa-student`, `forsa-university`, `forsa-partner`,
`forsa-finance`, `forsa-guarantor`) — other sessions own those.

## Read this first (in order)

1. `implementation/IMPLEMENTATION_NOTES.md` — architecture facts and the full
   verbatim FORSA V1 Master Implementation Specification (source of truth for
   the redesign direction, though you are only doing Phase 1 right now).
2. `implementation/KNOWN_ISSUES.md` — the full bug catalog with severity.
3. `implementation/DECISIONS.md` — read D-001 (registration→account design),
   D-007 (schema archival approach) — these directly affect your work.
4. `implementation/MASTER_TASK_LIST.md` — Phase 1 section — this is your
   authoritative task list.
5. If you need deeper detail on any specific finding, the full audit is at
   `/Users/wael/Downloads/forsa-deploy-stack-final/FORSA_PLATFORM_SPEC.md` and
   `/Users/wael/Downloads/forsa-deploy-stack-final/AUDIT_REPORT.md` (read-only
   reference, don't edit these).

**Governing rule**: you are doing Phase 1 (critical engineering fixes) ONLY.
Do not start any Phase 2 (membership-first redesign) work — that's explicitly
blocked until Phase 1 is complete and is being planned separately.

## Your task list (backend-owned Phase 1 items)

Work through these in roughly this order. Check off the corresponding item in
`implementation/MASTER_TASK_LIST.md` as you complete each one, and add a line
to `implementation/CHANGELOG.md` under today's date.

1. **T-105 — Konnect webhook auth.** `POST /payments/konnect-webhook` in
   `src/payments/payments.controller.ts` is behind the controller's
   class-level `JwtAuthGuard`+`PermissionsGuard` with no route-level
   `@Public()` override, despite a comment claiming "no auth guard." Fix:
   mark that specific route `@Public()` (check `src/auth/` for how `@Public()`
   is implemented and used on the 3 existing public routes — login,
   mfa/verify, refresh — follow the same pattern). Do NOT remove or weaken
   the existing HMAC-SHA256 signature verification / anti-replay re-check
   against Konnect's API in `payments.service.ts` — that remains the real
   trust boundary for this route. Write a test (or at minimum manually verify
   via curl with a crafted signature) confirming: (a) a request with a valid
   signature and no JWT succeeds, (b) a request with an invalid/missing
   signature is rejected regardless of auth state.

2. **T-103 (backend half) — Partner identity isolation.** Add a JWT-scoped
   `GET /partners/me` endpoint (or equivalent) in `src/partners/` that
   resolves the partner record from the authenticated user's JWT identity
   server-side — do not accept a client-supplied partner ID for this route.
   Study how `src/guarantors/guarantors.controller.ts` already does exactly
   this pattern (`WHERE guarantors.user_id = <jwt id>`) as your template; the
   partners module needs the analogous linkage (check if `partners` has a
   `user_id` column already or if one needs adding via a new migration). This
   endpoint will be consumed by the `forsa-partner` frontend worker — make
   sure the response shape covers what `PartnersPage`/`DashboardPage` in that
   repo currently derive from `partners[0]` (partner id, name, commission
   summary fields).

3. **T-101/T-102 (backend half) — Real auth accounts on registration.** Per
   `DECISIONS.md` D-001, the intended flow is: a public membership-request
   endpoint (no auth) that later, on approval, provisions a real `users` row.
   For Phase 1 scope specifically (do NOT build the full Phase 2 membership
   system yet), the minimum fix is: make `POST /students` (or a new,
   genuinely public endpoint if you judge that cleaner) actually create a
   corresponding `users` row with a hashed password (argon2id, matching
   `src/auth/`'s existing hashing config) in the same transaction, so that the
   student portal's existing register→login flow works end-to-end. Apply the
   same fix for guarantors (`guarantors.user_id` linkage already exists from
   migration 004 — use it). Keep this minimal and reversible — Phase 2 will
   likely replace the entry point with a proper membership-request flow, so
   don't over-invest in the current `/students` endpoint's shape.

4. **T-106 — Connect notifications to real workflows.** Wire real calls to
   `NotificationsService` (already fully functional SMTP+template+logging
   plumbing in `src/notifications/`, just never called) into:
   `src/applications/applications.service.ts` (on creation and on each status
   transition), `src/payments/payments.service.ts` (on payment
   confirmed/overdue — the daily cron already computes due/overdue states,
   hook in there), `src/documents/documents.service.ts` (on missing-document
   detection / rejection), `src/contracts/contracts.service.ts` (contract
   ready to sign). Use the 8 existing seeded templates
   (`application_created`, `document_requested`, `application_approved`,
   `application_rejected`, `payment_due_soon`, `payment_overdue`,
   `payment_confirmed`, `contract_ready`) where they match; don't invent new
   ones yet (Phase 2 adds more).

5. **T-107 — Status vocabulary (backend half only).** Do NOT attempt the full
   unified membership+application status model here — that's Phase 2 (blocked
   on `DECISIONS.md` D-004, which needs the user's input). Your Phase 1 scope
   is narrower: make sure `STATUS_TRANSITIONS` in
   `src/applications/applications.service.ts` is the **single source of
   truth** the backend enforces, and that any status value the Admin
   Dashboard's V2 `ApplicationWorkflowPage` writes today is either (a) already
   a legal value in that map, or (b) rejected with a clear error rather than
   silently accepted as free text. If you find the V2 page writing status
   values outside the enum entirely, flag it in
   `implementation/KNOWN_ISSUES.md` rather than silently expanding the enum —
   that's a product decision for Phase 2, not yours to make unilaterally.

6. **T-108 — Remove duplicated schema sources.** Per `DECISIONS.md` D-007:
   move `database/schema/` to `docs/archive/schema-superseded/` (create the
   directory), and add a short note at the top of that directory (a
   `README.md` inside it is fine) stating it's the abandoned/never-adopted
   design and the live schema is `migrations/`. Do not delete it. Update any
   reference to `database/schema/` elsewhere in the repo (docs, comments) to
   point at the archive location or note it's superseded.

7. **T-110 — Enable rate limiting.** Register `ThrottlerGuard` as `APP_GUARD`
   in `src/app.module.ts`. Verify the existing `@Throttle` overrides on
   login/MFA-verify routes still behave as intended after this (they may need
   adjusting once the guard is actually active — check for any route that
   would now get limited but shouldn't, e.g. health checks if you add one).

8. **T-109 — Testing foundation.** Add real Jest spec files (the scaffolding
   already exists, `test/unit/`, `test/integration/`, `test/e2e/` are just
   empty). Minimum coverage for this pass:
   - Auth: login success/failure, JWT guard rejects missing/invalid tokens,
     lockout after `MAX_LOGIN_ATTEMPTS`.
   - Applications: `STATUS_TRANSITIONS` allow-list — assert illegal
     transitions are rejected, legal ones succeed and write an
     `application_status_history` row.
   - Payments: `recordPayment` writes correct ledger pairs; the Konnect
     webhook signature verification (valid/invalid/replayed cases from item 1
     above).
   - Pipeline: at least stage 1 (completeness gate) and stage 2 (eligibility
     gate) with both a passing and blocking case each.
   Run `npm run test` and `npm run typecheck` before considering this done.

## Definition of done for this worker session

- All 8 items above checked off in `implementation/MASTER_TASK_LIST.md`
  Phase 1 section (only check off backend-owned items; leave frontend-only
  ones like T-104 for the dashboard worker).
- `npm run build`, `npm run typecheck`, and `npm run test` all pass.
- `implementation/CHANGELOG.md` has a new dated entry summarizing what
  changed.
- `implementation/KNOWN_ISSUES.md` statuses updated for anything you fixed.
- Any new design question you hit that isn't already answered in
  `DECISIONS.md` — add it there as `OPEN` rather than guessing silently.
- Do not commit unless explicitly asked to by the user running this session.
- End with a concise summary: what changed, what's still open, anything the
  frontend workers (student, dashboard, partner) need to know about new
  endpoints/contracts you added (especially the new `GET /partners/me` shape
  from item 2, and any request/response shape changes from item 3).
