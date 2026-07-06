# FORSA OS — Final Bug Report

Complete ledger of every defect found across Phase 3 (browser E2E testing) and
Phase 3.5 (final engineering pass), with final disposition. Severity reflects
user-facing impact if shipped as-is. All fixes were verified by re-running the
same browser steps against the fix, not just by reading the diff.

**Final tally: 10 Critical, 11 High, 6 Medium, 3 Low — all Critical and High
items are Fixed. Zero open Critical or High items remain.**

---

## Critical

| # | Defect | Status |
|---|---|---|
| C1 | University Portal — every page failed to load for a real account (staff-only routes called by a self-service portal) | **Fixed** |
| C2 | Guarantor Portal — core "linked student" feature 500'd unconditionally (`applications.program_name` never existed) | **Fixed** |
| C3 | Automated pipeline crashed on every run (`'system'` string into a UUID column) | **Fixed** |
| C4 | Every real financing request blocked at Stage 1 (`program_id` never sent by the form) | **Fixed** |
| C5 | Login throttle used the hardcoded 900s/5 default in every environment, never the configured value — `auth.controller.ts` reads `process.env` at module-load time, before `ConfigModule.forRoot()` has populated it (AppModule's import chain resolves before its own decorator body runs) | **Fixed** — `import 'dotenv/config'` as the first line of `main.ts`. Verified live: 20 attempts succeed, the 21st correctly 429s with `retry-after: 59` (not 511/900) |
| C6 | `forsa_app`/`forsa_readonly` DB roles had zero grants on 5 Phase 2 tables — Membership Request submission failed for the actual least-privilege runtime role | **Fixed** — permanent migration (see C10) |
| C7 | Demo seed script failed on its first non-trivial insert (7 schema mismatches) | **Fixed** |
| C8 | Konnect payment initiation and receipt submission were gated behind the staff-only `payment.record` permission — 403 for every real student attempting to pay | **Fixed** |
| C9 | Konnect/receipt submission had **no ownership verification at all** — any authenticated user could act on any other student's installment by guessing its UUID; the Konnect path additionally inserted the wrong id type (auth user id, not `students.id`) into `payments.student_id`, a latent FK-violation bug masked by C8's permission gate | **Fixed** — real ownership checks added to both paths |
| C10 | Nothing in the repo (migrations, docker-compose, scripts) ever created the `forsa_app`/`forsa_readonly` roles themselves — a genuinely fresh deployment would fail to authenticate as `forsa_app` at all | **Fixed** — migration `012_db_roles_and_grants.sql` creates the roles (idempotent), grants on every current table, and uses `ALTER DEFAULT PRIVILEGES` so no future migration ever needs a manual grant again. Verified end-to-end against a genuinely fresh Postgres cluster with zero pre-existing roles |

## High

| # | Defect | Status |
|---|---|---|
| H1 | Student HomePage/Application/Documents/Payments pages silently broken (wrong endpoint + wrong id) | **Fixed** |
| H2 | Financing Request form's university/program dropdowns always empty | **Fixed** |
| H3 | Complete Payment History 500'd (`p.paid_at` doesn't exist) | **Fixed** |
| H4 | Student payment schedule/next-due view inaccessible (staff-only route) | **Fixed** |
| H5 | Partner Reports page — dead parameter + oversized page limit | **Fixed** |
| H6 | SUPER_ADMIN role's permissions frozen at role-creation time, never re-synced when new permissions are added | **Fixed** — `seed.ts` now auto-syncs every `is_system_role=true` role on every run. Verified: manually revoked 2 grants, re-ran `npm run seed`, both restored |
| H7 | University Portal Documents page entirely broken — `getChecklist`/`getDownloadUrl` both staff-only (`document.view`), no self-scoped alternative existed at all | **Fixed** |
| H8 | University Portal Payments page broken — `getSchedule` staff-only (`payment.view`) | **Fixed** |
| H9 | University Portal StudentDetailPage broken — application detail, status history, and FORSA score widget all staff-only | **Fixed** |
| H10 | Student ApplicationPage's status history call staff-only (`application.view`) | **Fixed** |
| H11 | Documents module (`documents.controller.ts`) had **zero** self-scoped or public routes — every route required a staff permission, meaning both the student's own document upload and the university's own document views were structurally impossible without new routes | **Fixed** — added `me/upload-url`, `me/:id/confirm-upload`, `university-mine/:id/download-url`, `university-mine/checklist/applications/:id` |

## Medium

| # | Defect | Status |
|---|---|---|
| M1 | Dead pre-Phase-2 `/register` route created accounts permanently stuck as non-members, bypassing Membership Request entirely | **Fixed** — business decision: `/register` now redirects to `/join`; the T-101 backend endpoint, its DTO, and the frontend page are removed |
| M2 | Local `.env`/`.env.local` had two config bugs (`DB_APP_PASSWORD` one char short of Joi's minimum; `CORS_ORIGINS` missing 2 of 6 frontend ports) | **Fixed locally** — git-ignored files, doesn't persist; exact values documented below |
| M3 | Seed script run-order (`seed-admin.ts` before `seed.ts`) left an admin role with zero permissions, undocumented dependency | **Resolved as a side effect of H6's fix** — `seed.ts` now syncs missing permissions onto any `is_system_role` regardless of run order |
| M4 | Demo seed script printed a hardcoded-wrong admin password in its console output | **Fixed** |
| M5 | Self-submitted financing requests required manual staff status advancement before the pipeline could process them (`NEW_LEAD` didn't permit a direct transition to `UNDER_REVIEW`) | **Fixed** — business decision: `NEW_LEAD → UNDER_REVIEW` is now legal; Stage 8 always transitions through it, auto-approve or human-review alike. Verified live: a fresh self-submitted application reached `APPROVED_LEVEL2` across all 10 stages with zero manual intervention |
| M6 | Set-password email link falls back to the hardcoded production domain (`https://student.forsa.tn`) whenever `STUDENT_PORTAL_URL` is unset — undocumented in `.env.example`, meaning any non-production environment silently gets the wrong link | **Fixed** — documented in `.env.example` with an explanatory comment |

## Low

| # | Defect | Status |
|---|---|---|
| L1 | One seeded university name missing an accent ("Universite" vs "Université") | **Fixed** (trivial data correction) |
| L2 | `forsa-guarantor`'s orphaned `HomePage.tsx` imported `studentApi`/`paymentApi`, which don't exist in that portal's `lib/api.ts` — a hard runtime crash had it ever been wired into routing (it wasn't; `App.tsx` never references it) | **Fixed** — removed; `DashboardPage.tsx` is the real, working, already-tested landing page |
| L3 | Several frontend API client functions call staff-only routes but are never actually invoked from any page (`studentApi.update`/`getScore`/`applicationApi.get` in forsa-student; `studentsApi.get`/`documentsApi.getForEntity` in forsa-university; `partnerApi.list`/`get` in forsa-partner) — latent bugs that would 403 the instant someone wires them up | **Not fixed** — confirmed unreachable (verified via repo-wide grep against every page component), zero current user impact. Worth a look next time a page is built against these |

---

## Local-only fixes that don't persist in git (documented for the next environment setup)

`.env`/`.env.local` are git-ignored by design. These fixes were applied to
this session's local files only and must be reapplied wherever these files
are actually distributed:

- `DB_APP_PASSWORD` — must be ≥20 characters (Joi validation). Also requires
  `ALTER ROLE forsa_app WITH PASSWORD '<value>'` to match if the role
  already exists with a different password (superseded by migration 012,
  which now does this as part of the normal migration run).
- `CORS_ORIGINS` — must include all 6 frontend ports (`5173`–`5178` in this
  local setup); was missing the Finance and Guarantor ports, blocking both
  portals entirely via CORS.
- `LOGIN_THROTTLE_TTL_SECONDS`/`LOGIN_THROTTLE_LIMIT` — relaxed to `60`/`20`
  for local dev convenience; now actually take effect (see C5).
- `STUDENT_PORTAL_URL` — set to `http://localhost:5174` locally; without it,
  every set-password email links to the production domain regardless of
  environment (see M6).
