# FORSA — Known Issues

Bug/defect catalog, most severe first. Source: `AUDIT_REPORT.md` (30 Jun 2026
live audit) + `FORSA_PLATFORM_SPEC.md` (full reverse-engineering pass) +
git history in `forsa-os`. Cross-referenced to `MASTER_TASK_LIST.md` task IDs.
Update the **Status** column as work lands — don't delete resolved rows,
mark them Fixed with the commit/date so the history stays intact.

Status legend: `OPEN` · `FIXED` · `WON'T FIX` (with reason) · `SUPERSEDED`
(overtaken by Phase 2 redesign, no longer applicable as originally scoped).

## Critical

| # | Issue | Repo | Task | Status |
|---|---|---|---|---|
| K-01 | Self-registration → login broken end-to-end for students (`POST /students` never creates a `users`/auth row) | forsa-os, forsa-student | T-101 | PARTIALLY FIXED (2026-07-05, forsa-student frontend half only — see MASTER_TASK_LIST T-101) |
| K-02 | Guarantor self-registration page unrouted + internally broken (`login()` missing `tenantId`, posts to wrong endpoint) | forsa-guarantor | T-102 | OPEN |
| K-03 | Partner portal first-login misattributes an arbitrary partner's data (`partners[0]` trust bug) — can leak another partner's students/commissions | forsa-partner, forsa-os | T-103 | PARTIALLY FIXED (2026-07-05, backend `GET /partners/me` endpoint done; `forsa-partner` frontend still uses `partners[0]` until that repo switches to the new endpoint) |
| K-04 | Admin Dashboard payment verification double-API-prefix bug (`/api/v1/api/v1/...` → 404s) — breaks the primary staff payment-confirmation workflow | forsa-dashboard | T-104 | FIXED (2026-07-05) |
| K-05 | Konnect webhook route guarded by `JwtAuthGuard`+`PermissionsGuard` with no `@Public()` override — server-to-server callback likely 401s despite a comment claiming otherwise | forsa-os | T-105 | FIXED (2026-07-05, route-level `@Public()`+`@SkipThrottle()` added; signature-verification test added in `konnect.service.spec.ts` per T-109) |
| K-06 | Zero business-logic call sites for `NotificationsService` — no email/in-app notification is ever sent for any event | forsa-os | T-106 | OPEN |

## High

| # | Issue | Repo | Task | Status |
|---|---|---|---|---|
| K-07 | Two incompatible application-status vocabularies live simultaneously (core pipeline vs. `ApplicationWorkflowPage` V2) — unrecognized by shared `Badge` component, unfilterable | forsa-os, forsa-dashboard | T-107 | FIXED for Phase 1 scope (2026-07-05) — dashboard `Badge`/filter rendering fixed; backend verified to already reject dead-vocabulary writes correctly (400), hardened with a real `TransitionStatusDto`. Full vocabulary unification (D-004) remains Phase 2. |
| K-08 | Two schema definitions exist (`migrations/` live vs. `database/schema/` abandoned) — risk of a new engineer building against the wrong one | forsa-os | T-108 | FIXED (2026-07-05, archived to `docs/archive/schema-superseded/` with README) |
| K-09 | Zero automated tests anywhere across all 7 repos despite full Jest scaffolding in the backend | all | T-109 | PARTIALLY FIXED (2026-07-05) — `forsa-os` now has 7 spec files / 33 tests covering auth, guards, application status transitions, payment ledger writes, Konnect signature verification, and pipeline stages 1-2. Stages 3-10, e2e tests, and all 6 frontend portals still have zero test coverage (Phase 3 / T-301 scope). |
| K-10 | Rate limiting fully inert — `ThrottlerGuard` never applied despite `ThrottlerModule` + `@Throttle` overrides being registered | forsa-os | T-110 | FIXED (2026-07-05) |
| K-11 | Receipt-upload forms (Student + Guarantor) never transmit the actual file, only the filename — Finance has nothing to inspect when verifying | forsa-student, forsa-guarantor, forsa-os | T-111 | FIXED (2026-07-05) — real S3 presigned-upload flow now wired end-to-end for both portals; see K-45/K-46 for the backend gaps that were closed to unblock it. |
| K-12 | Dual/executive multi-approver requirement computed (Stage 7) but never enforced (Stage 8) — a single reviewer can finalize any decision | forsa-os | T-214 | OPEN |
| K-13 | Konnect payment confirmations never fire a FORSA Score event, unlike the manual-verification path — same business event, inconsistent consequence | forsa-os | T-218 | OPEN |
| K-14 | `financial_ledger` rows are structurally different shape between Konnect path (single row, `debit_account`/`credit_account`) and manual path (two rows, one `account` column each) | forsa-os | T-218 | OPEN |
| K-15 | Row-Level Security designed (`database/schema/06_security.sql`) but never deployed to live schema — tenant isolation has no DB-enforced backstop | forsa-os | T-517 | OPEN |
| K-16 | Inconsistent refresh-token strategy: Dashboard/University/Partner use bearer-in-body, Finance/Guarantor use cookie+empty-body — only one can be correct against the real backend | all frontends | (Phase 3 testing, T-304) | OPEN |
| K-17 | AI interview uses a hardcoded, invalid Anthropic model string (`'claude-sonnet-4-6'`) — will fail against the real API | forsa-os | T-212 | OPEN |
| K-18 | AI demo-mode fallback triggers on *any* exception (not just missing key) and submits a client-side `Math.random()` "AI score" as if real, with only a small badge disclosure | forsa-student, forsa-os | T-210 | OPEN |
| K-19 | Policy Engine has zero live `policy_versions` — every "configurable" threshold is actually its hardcoded fallback; some seeded key names don't even match code's query keys | forsa-os | (see D-003) | OPEN |

## Medium

| # | Issue | Repo | Task | Status |
|---|---|---|---|---|
| K-20 | `deployed_capital` CEO report over-reports (joins `installments` without aggregating first — 81,700 vs true 28,700 TND on demo data) | forsa-os | T-206 (Phase 1 rewrite may supersede — see T-107/D-004) | OPEN |
| K-21 | Document rejection never creates a `documentation_reliability` score event despite the dimension existing for exactly that purpose | forsa-os | (folded into T-211 Household Stability rebuild) | OPEN |
| K-22 | `PolicyService` injected into `CollectionsService` but never called — seeded escalation-policy keys + matching UI banner imply automation that doesn't exist | forsa-os, forsa-finance | T-310 (original list) | OPEN |
| K-23 | University portal "Notes" feature is `localStorage`-only, presented as saved but never reaches the backend | forsa-university | T-514 | OPEN |
| K-24 | University/Partner portals hardcode a single tenant UUID — can't serve more than one tenant without a rebuild | forsa-university, forsa-partner | T-513 | OPEN |
| K-25 | University portal's language switcher doesn't translate content (labels/`dir` only) | forsa-university | T-515 | OPEN |
| K-26 | University portal's token-refresh call uses a relative path with no API base URL — likely breaks cross-origin | forsa-university | (Phase 3 testing) | OPEN |
| K-27 | Finance portal `DisbursementsPage` is a confirmed pure placeholder | forsa-finance | T-222 | OPEN |
| K-28 | Finance portal `VerifyPage` "view receipt" button has no wired-up action | forsa-finance | T-222 | OPEN |
| K-29 | Finance/University/Partner report "export" buttons are raw JSON dumps or print-dialog hacks, not real CSV/PDF | forsa-finance, forsa-university, forsa-partner | T-222 | OPEN |
| K-30 | Admin Dashboard `SettingsPage` hardcodes `http://localhost:3000` links — wrong host in any deployed environment | forsa-dashboard | T-113/T-516 | FIXED (2026-07-05) |
| K-31 | Admin Dashboard `UsersPage` role-assignment deferred to "V2" — requires a raw undocumented API call today | forsa-dashboard | T-112 | FIXED (2026-07-05) — with a new smaller gap flagged: no `GET /roles` backend route exists to list assignable roles; UI falls back to manual Role ID entry |
| K-32 | `src/seeds/seed-demo.ts` confirmed broken against the live schema (inserts into nonexistent columns) | forsa-os | T-503 | OPEN |
| K-33 | QR code generation (Partner portal referral link) depends on an unauthenticated third-party API (`api.qrserver.com`) with only a placeholder-div fallback | forsa-partner | T-509 | OPEN |
| K-44 | No `GET /roles` backend route exists to list a tenant's assignable roles — `RolesService.findAllRoles` exists in `src/users/roles.service.ts` but is never exposed via any controller. Surfaced 2026-07-05 while building the dashboard's role-assignment UI (T-112); UI falls back to manual Role ID entry. | forsa-os | T-112 | OPEN |
| K-45 | No active `document_types` row with code `payment_receipt` exists — blocks the new student-portal receipt-upload flow's `POST /documents/upload-url` call (400s without it). Surfaced 2026-07-05 by the student portal worker while building T-111. | forsa-os | T-111 | FIXED (2026-07-05) — migration `006_receipt_upload.sql` seeds the row; also added to `scripts/seed.ts` for fresh installs. |
| K-46 | `payments.submitReceipt`/the `payments` table have no `receiptDocumentId` column — the student portal now sends one but it's silently dropped server-side (harmless no-op, but the upload isn't actually linked to the payment record yet). Surfaced 2026-07-05 by the student portal worker while building T-111. | forsa-os | T-111 | FIXED (2026-07-05) — migration `006_receipt_upload.sql` adds `payments.receipt_document_id`; `submitReceipt` now verifies and persists it (never trusts a client-supplied documentId blindly — see new `verifyReceiptDocument()` helper and its tests). |
| K-47 | `forsa-partner/src/lib/api.ts`'s 401-refresh interceptor calls `axios.post('/api/v1/auth/refresh', ...)` using the bare `axios` import instead of the configured `api` instance — a relative URL with no base URL, unlikely to resolve correctly once frontend and API are on different origins (same class of bug as K-16's cross-portal refresh-strategy inconsistency). Surfaced 2026-07-05 while fixing T-103's frontend half; not fixed this pass — narrow scope was the `partners[0]` identity bug only. | forsa-partner | (unassigned — related to K-16) | OPEN |

## Low / cosmetic / cleanup

| # | Issue | Repo | Task | Status |
|---|---|---|---|---|
| K-34 | Literal unexpanded-brace-expression directories checked into all 7 repos | all | T-501 | OPEN |
| K-35 | Empty dead-scaffold directories (`src/roles/`, `common/dto|pipes|guards|interfaces/`) | forsa-os | T-502 | OPEN |
| K-36 | Five dead feature flags, never read outside their own config mapping | forsa-os | T-504 | OPEN |
| K-37 | Orphaned duplicate files (`ApplyLayout.tsx`/`HomePage.tsx` in finance/guarantor, unused `PaymentsPage.tsx` in finance) | forsa-finance, forsa-guarantor | T-505 | OPEN |
| K-38 | `rate_limit_buckets` dead table; `outbox_events` "pending" partial index defined twice (migrations 001 and 002) | forsa-os | T-506 | OPEN |
| K-39 | `BCRYPT_ROUNDS` env var validated but never consumed | forsa-os | T-507 | OPEN |
| K-40 | Raw SQL migrations instead of versioned TypeORM migrations (team's own acknowledged deferred item) | forsa-os | T-508 | OPEN |
| K-41 | Duplicate `fix-quotes.js` dead twin across all 6 frontend repos | all frontends | T-510 | OPEN |
| K-42 | No real unauthenticated `/health` endpoint | forsa-os | T-511 | OPEN |
| K-43 | Dockerfile single-stage, no `HEALTHCHECK`, no non-root `USER` | forsa-os | T-512 | OPEN |

## Already fixed (verified against git history in `forsa-os`)

| # | Issue | Fixed by | Date |
|---|---|---|---|
| F-01 | `GET /payments/receipts` 500 — LIMIT/OFFSET off-by-one (`$${limitIdx-1}` resolved to `$1`, the tenant UUID) | commit `94a36b2d` | 2026-06-30 |
| F-02 | Guarantors controller: local no-op stub `CurrentUser`/`CurrentTenant` decorators shadowed the real ones, causing every `/guarantors/*` endpoint to 500 | commit `f5be99be` | 2026-06-30 |
| F-03 | `.env.local` accidentally committed with dev credentials | commit `7c6aa408` | 2026-06-30 |
| F-04 | Demo user passwords too short for `LoginDto @MinLength(12)` — updated in DB (not a code fix, ops action per `AUDIT_REPORT.md`) | audit-time DB update | 2026-06-30 |
| F-05 | Demo roles had 0 permissions, causing 403s everywhere — granted scoped permissions per role (DB update, not code) | audit-time DB update | 2026-06-30 |
| F-06 | AI Ranking page crashed (`limit: 200` vs API max 100) | forsa-dashboard (per audit report; verify still current if touching that repo) | 2026-06-30 |
| F-07 | Dashboard "Total Students" KPI showed active-financings count instead of true student count | forsa-dashboard (per audit report) | 2026-06-30 |
| F-08 | Seeded application statuses used non-standard values the CEO report didn't recognize | audit-time data remap | 2026-06-30 |
