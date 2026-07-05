# FORSA — Changelog

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
