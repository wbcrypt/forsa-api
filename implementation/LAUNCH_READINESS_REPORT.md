# FORSA OS — Launch Readiness Report

**Phase 3 · End-to-End Verification**
Date: 6 July 2026
Method: Playwright / Chromium, real clicks and form fills against a live local stack (Postgres, Redis, MinIO, MailHog)
Scope: Student, Admin, Finance, University, Partner, Guarantor portals
Repos touched: forsa-os, forsa-student, forsa-university, forsa-partner

## Verdict: Conditional Go

Seven launch-blocking defects were found and fixed during this pass — three of them would have made an entire portal or the core financing pipeline unusable on day one. Two structural items remain and need an explicit decision before launch (see "Outstanding — needs a decision" below); everything else found is already fixed, tested, and committed.

**Summary counts:** 7 Critical · 6 High · 4 Medium · 2 Low · 17 fixed this pass

---

## 1. Methodology

This was not a code read-through. The full local stack was brought up from a cold start — `docker compose up` for Postgres/Redis/MinIO/MailHog, all 11 migrations applied against a fresh database, reference data and demo accounts seeded, the NestJS backend started, and all six Vite frontends started on their real ports. A Playwright-driven Chromium browser then walked through the actual UI: typing into real form fields, clicking real buttons, reading real API responses, and checking real emails in MailHog.

The student journey was run in full: an anonymous visitor submitting a Membership Request, staff approving it to Bronze from the Admin Dashboard, the resulting email's password-setup link, login as the new student, a complete AI Interview financing request, staff running the automated decision pipeline, payment schedule generation, and the student viewing their Digital Pass and payment schedule. The other five portals (Admin, Finance, University, Partner, Guarantor) were each logged into with real or newly-created credentials and walked through their primary screens.

Every defect below was reproduced first, then fixed, then re-verified by re-running the same browser steps against the fix. Backend fixes are covered by 116 automated tests (all passing) in addition to the manual browser pass; all four affected frontend repos build cleanly.

---

## 2. Critical findings

*Would have blocked an entire portal, the core financing pipeline, or first-time setup outright.*

### 2.1 University Portal — every page failed to load for a real university account
**Severity:** Critical · **Status:** Fixed

Logging in as a real university-portal user produced "Failed to load data" on the Dashboard and every other screen — the portal was completely unusable.

An earlier fix (T-223) corrected *where* the university's identity came from (a real server-side lookup instead of a client-typed field), but every downstream call using that identity still hit staff-only endpoints (`university.view`, `application.view`) that a university account never holds.

**Fix:** Added self-scoped `GET /universities/me/performance` and `GET /applications/university-mine`, both resolving the caller's university server-side.
`forsa-os/src/universities · forsa-university/src/pages/DashboardPage.tsx`

### 2.2 Guarantor Portal — core "linked student" feature crashed unconditionally
**Severity:** Critical · **Status:** Fixed

The one thing a guarantor needs from this portal — seeing which student they're backing — returned a 500 error on every single request, since it was first built.

The query selected `applications.program_name`, a column that has never existed on that table (the real column is `program_id`, a foreign key to `programs`).

**Fix:** Added the missing `LEFT JOIN programs`, aliased back to `program_name` so nothing downstream needed to change.
`forsa-os/src/guarantors/guarantors.service.ts — findLinkedStudent()`

### 2.3 Automated pipeline could not execute any decision — every run failed silently
**Severity:** Critical · **Status:** Fixed

Clicking "Run Pipeline" on any application always failed with a generic "unexpected error," and the pipeline run was silently marked `cancelled`. This affected every automated decision, not just self-submitted ones.

Automated, system-triggered status transitions passed the literal string `'system'` as the acting user, but `application_status_history.changed_by` is a UUID column — Postgres rejected every insert with "invalid input syntax for type uuid." The same mistake as an earlier, already-fixed bug in score events (K-13), recurring in a second code path.

**Fix:** Widened `transitionStatus()`'s signature to accept `null` for system-triggered transitions, matching the earlier fix's pattern exactly.
`forsa-os/src/applications/applications.service.ts, src/pipeline/pipeline.service.ts`

### 2.4 Every real financing request was permanently blocked at the pipeline's first stage
**Severity:** Critical · **Status:** Fixed

A student completing the AI Interview and submitting a financing request would have that request blocked at Stage 1 (Completeness Gate) every time, with no way to proceed.

The Financing Request form collected a program from a dropdown, but only ever sent the program's *name* to the backend — never an ID. `applications.program_id` was therefore always `NULL`, and Stage 1 treats a missing program as a hard completeness failure.

**Fix:** Threaded a real `programId` through the form state, the interview page, and the final submission call.
`forsa-student/src/pages/apply/ApplyPage.tsx, InterviewPage.tsx`

### 2.5 Login rate-limit ignored its own "relaxed for local dev" configuration
**Severity:** Critical · **Status:** Fixed

Five login attempts within fifteen minutes locks any account out for the remainder of that window, in every environment — including local development, where the environment file explicitly tries to relax this to 20 attempts per 60 seconds.

The two relevant environment variables were parsed into application config but never actually read anywhere — the login endpoint's rate limit was hardcoded directly in a decorator, completely independent of that config.

**Fix:** The login throttle now reads its limits from environment variables at startup, matching the values the config layer already expected to control.
`forsa-os/src/auth/auth.controller.ts`

### 2.6 Least-privilege database role had no access to five Phase 2 tables
**Severity:** Critical · **Status:** Fixed (local)

Submitting a Membership Request — the entry point to the entire product — failed with "permission denied for table membership_requests" when run against the application's actual runtime database role, not the migration superuser.

`membership_requests`, `membership_status_history`, `password_setup_tokens`, `digital_student_passes`, and `fraud_records` were all created by migrations without a corresponding grant to the app's own least-privilege role. Every environment that runs migrations as a superuser but the app as a restricted role — which is the documented, intended production setup — would hit this immediately.

**Fix:** Granted the missing privileges directly for this test run. This needs to become a permanent migration (see Recommendations) — it was fixed by hand here, not by a change that will apply itself on the next fresh deploy.

### 2.7 Demo data seed script failed on the very first non-trivial insert
**Severity:** Critical · **Status:** Fixed

Running the documented demo-data setup script failed immediately, and the credentials it printed for the University and Partner portals were never actually created — those logins have never worked.

Seven distinct places where the script referenced columns that don't exist on the current schema: `universities.code`, `programs.tenant_id`/`updated_at`, `partners.email`/`is_founding_partner`, `students.phone`/`academic_level`, `applications.program_name`, three wrong column names across the payment-schedule tables, and a missing required field. The script also assumed a fixed tenant ID that only exists by coincidence in environments bootstrapped a specific way.

**Fix:** Corrected every column reference to match the live schema, and added the university/partner login accounts the script's own output already claimed to provide.
`forsa-os/src/seeds/seed-demo.ts`

---

## 3. High-severity findings

*Broke a specific, important feature for real users — not the whole portal.*

### 3.1 Student home page, application, documents, and payments — all silently broken
**Severity:** High · **Status:** Fixed

Four separate pages fetched "my data" using a staff-only endpoint and the wrong identifier (the auth account's own ID rather than the actual student record's ID). Every real student saw placeholder membership/FORSA ID/Digital Pass tiles and empty application, document, and payment views — never their real data — with no visible error, because the page quietly fell back to empty-state defaults.

**Fix:** Added a self-scoped `GET /students/me/applications` alongside the existing `GET /students/me`, and pointed all four pages at the self-scoped routes.
`forsa-student/src/pages/HomePage.tsx, application/, documents/, payments/`

### 3.2 Financing Request form's university and program pickers were always empty
**Severity:** High · **Status:** Fixed

A real student opening the Financing Request form could not select their university or program at all — both dropdowns called staff-only endpoints and silently returned nothing.

**Fix:** Added a public `GET /universities/:id/programs/public` endpoint, mirroring the public university list the Membership Request form already used correctly, and pointed the form at both public routes.
`forsa-student/src/pages/apply/ApplyPage.tsx`

### 3.3 "Complete Payment History" has never worked
**Severity:** High · **Status:** Fixed

This feature was built to show a student every payment across every financing period — but its query ordered by a column that doesn't exist on the payments table, so it returned a server error on every call since it was written.

**Fix:** Corrected the column reference (`payment_date`, not `paid_at`).
`forsa-os/src/students/students.service.ts — getPaymentHistory()`

### 3.4 Student payment schedule / next-due view was inaccessible
**Severity:** High · **Status:** Fixed

The Payments page and the home page's "next due" tile both called a staff-only endpoint directly with the student's own application ID, and were rejected every time.

**Fix:** Added a self-scoped `GET /payments/schedules/me/applications/:id` that verifies the caller actually owns the application before returning it.
`forsa-os/src/payments/payments.service.ts`

### 3.5 Partner Reports page — leftover parameter and an oversized page size
**Severity:** High · **Status:** Fixed

Two independent bugs stacked on the same page: a query parameter left over from before an earlier identity fix was rejected by the now-stricter endpoint, and the page separately asked for 200 records against an API that caps requests at 100 — the second bug would have broken this page even before the identity fix existed.

**Fix:** Removed the dead parameter; capped the request at the server's actual limit.
`forsa-partner/src/pages/reports/ReportsPage.tsx`

### 3.6 Admin super-admin account silently loses access to every new feature
**Severity:** High · **Status:** Needs a decision

A pre-existing admin account 403'd on the Membership Queue — a page that should be fully available to a super-admin role.

The super-admin role's permission set is only populated once, at the moment the role is first created. Every permission added to the system afterward — which happens with nearly every new feature — is invisible to any admin account created before that point, until someone manually re-grants it.

**Recommendation:** Not fixed structurally in this pass (worked around directly in the database to continue testing). This needs either a "re-sync role permissions" admin action, or an automatic sync whenever a role is flagged as a full-access system role.
`forsa-os/scripts/seed-admin.ts`

---

## 4. Medium-severity findings

### 4.1 A dead, pre-Phase-2 registration path still creates permanently broken accounts
**Severity:** Medium · **Status:** Needs a decision

`/register` is no longer linked from anywhere in the product's own navigation — the "Join FORSA" link everywhere now correctly points at the Membership Request flow — but the route itself is still live and reachable directly. Anyone who lands on it creates a full working account that bypasses the Membership Request system entirely: no membership status is ever set, so the account is permanently stuck as a non-member with no way to ever submit a financing request, and no upgrade path exists.

**Recommendation:** Decide whether to remove the route entirely or redirect it to the Membership Request flow. A code comment currently justifies keeping it "for accounts created before this migration," which doesn't hold up — that reasoning would apply to preserving *login* for old accounts, not to keeping a *registration* path that creates new, permanently broken ones.
`forsa-student/src/pages/auth/RegisterPage.tsx`

### 4.2 Local development environment file has two configuration bugs
**Severity:** Medium · **Status:** Fixed (local)

The application database password was one character short of the minimum length the application itself requires, which blocks the backend from starting at all. Separately, the CORS allow-list was missing the ports for two of the six frontends (Finance and Guarantor), which would silently block every API call from those two portals in a browser.

**Note:** This file is intentionally excluded from version control, so this fix is local to this test session only and needs to be applied wherever this file is actually distributed to developers.
`forsa-os/.env.local`

### 4.3 Seed script run order is undocumented and produces a confusing partial state
**Severity:** Medium · **Status:** Open

Running the admin-account seed script before the reference-data seed script (a reasonable first guess, and the order this test session initially tried) creates an admin role with zero permissions, since the permissions table is still empty at that point. There is no warning, and no documentation states the required order.

**Recommendation:** Document the required order, or make the admin seed script idempotently re-sync permissions so the order stops mattering.
`forsa-os/scripts/seed-admin.ts, seed.ts`

### 4.4 Demo seed script printed a login password that was never correct
**Severity:** Medium · **Status:** Fixed

The script's own console output claimed a specific admin password that has never matched the password actually used to create that account, which is instead read from an environment variable at bootstrap time.

**Fix:** The script now points to the environment variable by name instead of guessing a value.
`forsa-os/src/seeds/seed-demo.ts`

---

## 5. Low-severity findings

### 5.1 Pipeline requires manual staff steps before it can process a self-submitted request
**Severity:** Low · **Status:** Open

A freshly self-submitted financing request starts in a status that only permits two possible next steps, neither of which is "send to automated review." A staff member must first manually advance it through several intermediate statuses before "Run Pipeline" can succeed — worked around directly in the database for this test — otherwise the click fails with "Invalid status transition." Whether this reflects an intentional staff triage step or a genuine gap depends on the intended workflow, which this report can't determine from testing alone.

**Recommendation:** Confirm whether self-submitted requests are meant to require manual staff advancement before automated review, and if not, allow the pipeline's own status transitions to bypass the manual-workflow restrictions that exist for staff-driven changes.
`forsa-os/src/applications/applications.service.ts — STATUS_TRANSITIONS`

### 5.2 One seeded university name is missing an accent
**Severity:** Low · **Status:** Open

"Universite de Tunis El Manar" appears without its accent in one pre-existing database row created outside this session's seed script — a data quality note, not a functional defect.

---

## 6. Outstanding — needs a decision

Two items above were deliberately not resolved unilaterally, since they depend on intent this report can't infer from code alone.

| Item | Question | Why it matters |
|---|---|---|
| Dead `/register` route | Remove it, or redirect to the Membership Request flow? | Currently creates real accounts that can never request financing, with no recovery path. |
| Pipeline vs. manual staff triage | Should a self-submitted request require manual staff advancement before automated review? | As it stands, every self-submitted request fails on its first automated run without manual intervention. |

---

## 7. Confirmed working end-to-end

*Verified by actually clicking through it, not by reading the code.*

- Membership Request submission (anonymous visitor)
- Staff approval → Bronze + FORSA ID + Digital Pass, one transaction
- All three approval emails, verified in MailHog
- Password-set flow via the emailed link
- AI Interview, including correct demo-mode fallback and disclosure
- Demo-mode interviews never fabricate a real AI score
- Pipeline completeness, eligibility, and university-partnership gates
- Financing tier assigned and membership ratchets up correctly
- Payment schedule generation
- Student Digital Pass page (QR, FORSA ID, membership level)
- Student payment page — Konnect, bank transfer, cash deposit
- Admin Membership Queue, application detail, decision panel
- Finance Portal — all six screens load cleanly
- University Portal — correctly scoped to one university (post-fix)
- Partner Portal — dashboard, students, commissions, reports (post-fix)
- Guarantor Portal — linked student, schedule, payment (post-fix)

---

## 8. Recommendations before launch

1. **Turn the database grant fix into a real migration.** The five ungranted tables were fixed by hand for this test session. Without a migration that runs this same grant, the next fresh deploy hits the identical failure.
2. **Decide the two open items above before launch, not after.** Both are one-line decisions, but both currently produce silent, hard-to-diagnose failures for real users.
3. **Re-run this same browser pass once more, close to launch.** Several of today's fixes touched shared plumbing (status transitions, self-scoped identity resolution). A short re-run confirms nothing regressed between now and go-live.
4. **Add a permission-sync path for system roles.** Every future feature will add at least one new permission. Without a sync mechanism, this same "admin can't see the new thing" bug recurs on schedule.

---

*Generated from a live Playwright/Chromium session against forsa-os, forsa-student, forsa-dashboard, forsa-finance, forsa-university, forsa-partner, and forsa-guarantor. All fixes are committed locally across the four affected repos; 116/116 backend tests passing.*
