# Worker Prompt — Student Portal (forsa-student) — Phase 1 Fixes + Membership-First Prep

Paste this entire file as your first message to a fresh Claude Code session
opened in `/Users/wael/Downloads/forsa-deploy-stack-final/forsa-student`.

---

You are working on the FORSA student-facing portal (`forsa-student`, a React +
Vite + TypeScript + TanStack Query + Tailwind app). This is one of several
parallel workers on the FORSA platform — you own this repo only. Do not touch
`forsa-os` or any other sibling repo (`forsa-dashboard`, `forsa-university`,
`forsa-partner`, `forsa-finance`, `forsa-guarantor`) — other sessions own
those. The backend (`forsa-os`) is being fixed in parallel by another worker
— assume the fixes described below either already exist or will land shortly;
if an endpoint you need doesn't exist yet, build your UI against the
documented contract below and note the dependency clearly in your summary
rather than blocking.

## Read this first (in order)

The continuity docs live in the **backend** repo, not this one — read them
from there (you have filesystem access to sibling directories):
1. `/Users/wael/Downloads/forsa-deploy-stack-final/forsa-os/implementation/IMPLEMENTATION_NOTES.md`
   — architecture facts and the full verbatim FORSA V1 Master Implementation
   Specification. Pay special attention to: §2.11 Student Dashboard, §2.2
   Membership Request, §2.3 Digital Student Pass, §2.4 Financing Request in
   the spec text.
2. `/Users/wael/Downloads/forsa-deploy-stack-final/forsa-os/implementation/KNOWN_ISSUES.md`
   — search for `forsa-student` rows.
3. `/Users/wael/Downloads/forsa-deploy-stack-final/forsa-os/implementation/MASTER_TASK_LIST.md`
   — Phase 1 and Phase 2 sections, specifically tasks touching `forsa-student`
   (T-101, T-111, T-220).
4. Full platform audit for deep background if needed:
   `/Users/wael/Downloads/forsa-deploy-stack-final/FORSA_PLATFORM_SPEC.md`
   §2.2 (Student Portal), §4 (Student Journey), §5.1 (Registration fields) —
   read-only reference, don't edit.

**Scope for this session**: Phase 1 fixes (blocking, do these first) plus
groundwork prep for the Phase 2 membership-first model where it's low-risk to
start now (see "Membership-first prep" section below) — but the full Phase 2
rebuild is a separate, larger effort; don't try to do all of it in one pass.

## Part A — Phase 1 fixes (do these first, they're blocking)

1. **Fix build issues first.** Before anything else, run the install/build/
   typecheck commands for this repo (check `package.json` scripts — likely
   `npm install`, `npm run build`, `npm run typecheck` or equivalent) and fix
   any errors you find so you have a working baseline. Report what you found
   even if it was already clean.

2. **T-101 — Registration → login.** Currently `RegisterPage.tsx` calls
   `POST /students` (a staff-only CRM endpoint per the backend audit) then
   immediately calls `login()` — which fails because no `users` row/password
   was ever created. The backend worker is adding real account provisioning
   to this flow (or a new endpoint — check with the backend repo's
   `CHANGELOG.md`/summary for what actually landed, since it may have changed
   the endpoint shape). Your job: verify the register→login flow now works
   against whatever the backend actually implemented, adjust the request
   payload/endpoint call in `RegisterPage.tsx` if the contract changed, and
   fix the "Forgot password?" link currently pointing at a non-existent
   `/forgot-password` route (either implement a minimal page or remove the
   dead link until it's built).

3. **T-111 (frontend half) — Receipt file upload.** The payment
   receipt-submission form currently sends only the filename string, never
   the actual file bytes. Fix this to use the real S3 presigned-upload flow
   that already works elsewhere in the backend (`documents.service.ts`'s
   pattern: `POST /documents/upload-url` → PUT to S3 → `POST
   /documents/:id/confirm-upload`) — check what the backend worker exposed
   for payments specifically (may be a new endpoint, or reuse of the
   documents flow with a payment-receipt document type). Wire the actual
   `File` object through, not just its `.name`.

4. **Document upload dead code cleanup (from the audit, low-risk while
   you're in this area)**: `DocumentsPage.tsx` was deliberately repurposed
   away from upload (shows a "come to a meeting" static page) and the
   `documentApi` helpers in `lib/api.ts` are consequently unused dead code.
   Leave this as-is for now — it's a deliberate product choice, not a bug —
   unless the Phase 2 work below reintroduces a document-upload need (it
   does, for financing-request documents — see Part B).

## Part B — Membership-first prep (Phase 2 groundwork, lower risk items only)

Do not attempt the full redesign — that needs the backend's new
membership/FORSA-ID/Digital-Pass endpoints (T-201–T-206 in `forsa-os`, not yet
built as of this session) and an unresolved design decision (D-004 in
`DECISIONS.md`) about the unified status model. Build what you reasonably can
without those:

1. **Student Dashboard reshape (T-220).** The new spec wants
   `HomePage.tsx` to display: Welcome, Membership Status, FORSA ID, Digital
   Student Pass, Profile Completion, Financing Status, Next Action, Payment
   Status — replacing the current "FORSA score + latest application status +
   quick-action tiles" layout. You can start the visual/component restructure
   now using placeholder/mock data for the fields that don't have a backend
   endpoint yet (Membership Status, FORSA ID, Digital Student Pass), clearly
   marked as `TODO: wire to real endpoint once backend ships it` in a code
   comment, so the layout work isn't wasted once the API exists. Keep Payment
   Status and Financing Status wired to the real existing endpoints (those
   already work).
   The explicit design goal from the spec: **"every page must reduce
   anxiety"** — favor one clear next-action over dense status tables.

2. **Do not build**: the actual Membership Request form, Digital Student Pass
   rendering with real QR verification, or gating the financing flow behind
   Bronze membership — these all need the backend endpoints from T-201-T-206
   which don't exist yet. Stub these as clearly-marked placeholders at most,
   don't fake real functionality.

## Definition of done for this worker session

- Part A items all verified working end-to-end (manually test registration →
  login, and a receipt upload, in a local dev run if you can get the backend
  running, or at minimum confirm the request/response contracts line up).
- Report back clearly: what you changed, what you verified working, and
  **any backend contract you depended on that didn't exist yet** (this is
  important — the orchestrating session needs this to reconcile workers).
- Do not commit unless explicitly asked to by the user running this session.
- Write a short status summary at the end of your work (in your final
  message, not a new file) covering: Part A completion status per item,
  Part B what you built vs. stubbed, and open questions.
