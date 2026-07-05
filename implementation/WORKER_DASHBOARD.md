# Worker Prompt — Admin Dashboard (forsa-dashboard) — Phase 1 Fixes + Membership-First Prep

Paste this entire file as your first message to a fresh Claude Code session
opened in `/Users/wael/Downloads/forsa-deploy-stack-final/forsa-dashboard`.

---

You are working on the FORSA internal admin/staff portal (`forsa-dashboard`,
"FORSA OS" — a React + Vite + TypeScript + TanStack Query + Tailwind app,
the superset portal used by staff to run the whole operation). This is one of
several parallel workers on the FORSA platform — you own this repo only. Do
not touch `forsa-os` or any other sibling repo (`forsa-student`,
`forsa-university`, `forsa-partner`, `forsa-finance`, `forsa-guarantor`) —
other sessions own those. The backend (`forsa-os`) is being fixed in parallel
by another worker — if an endpoint/contract you need doesn't exist yet, build
against the documented contract below and note the dependency clearly in your
summary rather than blocking.

## Read this first (in order)

The continuity docs live in the **backend** repo, not this one — read them
from there (you have filesystem access to sibling directories):
1. `/Users/wael/Downloads/forsa-deploy-stack-final/forsa-os/implementation/IMPLEMENTATION_NOTES.md`
   — architecture facts and the full verbatim FORSA V1 Master Implementation
   Specification. Pay special attention to §Admin Dashboard in the spec text
   (Membership Queue, Financing Queue, AI Queue, Waiting List, Payments,
   Guarantors, Universities, Digital Pass, Fraud Records, Audit Trail).
2. `/Users/wael/Downloads/forsa-deploy-stack-final/forsa-os/implementation/KNOWN_ISSUES.md`
   — search for `forsa-dashboard` rows.
3. `/Users/wael/Downloads/forsa-deploy-stack-final/forsa-os/implementation/MASTER_TASK_LIST.md`
   — Phase 1 and Phase 2 sections, specifically tasks touching
   `forsa-dashboard` (T-104, T-107, T-221, T-516, T-309).
4. Full platform audit for deep background if needed:
   `/Users/wael/Downloads/forsa-deploy-stack-final/FORSA_PLATFORM_SPEC.md`
   §2.1 and §7.1 (Admin Dashboard full page-by-page breakdown) — read-only
   reference, don't edit.

**Scope for this session**: Phase 1 fixes (blocking, do these first) plus
groundwork prep for Phase 2 where it's low-risk to start now — the full
redesign (Membership Queue, Fraud Records, Digital Pass admin, etc.) needs
backend endpoints that don't exist yet, so don't try to build all of it.

## Part A — Phase 1 fixes (do these first, they're blocking)

1. **Fix build issues first.** Run install/build/typecheck for this repo
   and fix any errors before starting feature work. Report what you found
   even if it was already clean.

2. **T-104 — Payment verification double-API-prefix bug (highest priority,
   this is the one confirmed-broken production bug assigned to you).**
   `PaymentVerificationPage.tsx` calls the API with an explicit `/api/v1/...`
   prefix on top of the shared axios client's already-prefixed base URL,
   producing `/api/v1/api/v1/payments/...` → 404. Every other page in this
   portal correctly omits the redundant prefix — find those calls in
   `PaymentVerificationPage.tsx` (check the API helper functions it uses,
   likely in `lib/api.ts` or a local API call) and strip the duplicate
   prefix so it matches the pattern used elsewhere in the codebase. Verify by
   comparing the actual request URL against, e.g., `CollectionsPage.tsx` or
   `PaymentsPage.tsx`'s working API calls.

3. **T-107 (frontend half) — Status vocabulary reconciliation.**
   `ApplicationWorkflowPage.tsx` drives applications through a different
   status vocabulary (Applied → AI Interview → Internal Review → Pre-Approved
   → Activation Meeting → Contract Signed → Approved → University Payment →
   Active Student) than the core pipeline's 16-status machine, writing
   free-text status values through the same generic status-update endpoint —
   and the shared `Badge` component's color/label map doesn't recognize these
   values, so they render unstyled/unfilterable in `ApplicationsPage.tsx`'s
   list view. For this Phase 1 pass (do NOT attempt the full Phase 2 unified
   membership+status model — that's blocked on an unresolved design decision,
   D-004 in the backend's `DECISIONS.md`): at minimum, make the `Badge`
   component and any status filter dropdowns recognize and correctly render
   **both** vocabularies so nothing shows up broken/unstyled in the UI today.
   If the backend worker's session added a rejection for out-of-enum status
   values (check their summary/`CHANGELOG.md`), verify this page's calls
   still succeed against the now-stricter backend.

4. **T-516 — Hardcoded localhost links.** `SettingsPage.tsx` hardcodes
   MFA-setup and API/Swagger links to `http://localhost:3000`. Fix to derive
   from the actual configured API base URL (whatever env-driven config this
   repo already uses for its API client — check `lib/api.ts` or equivalent
   for the pattern) so it points at the right host in any deployed
   environment.

5. **T-309 — Role-assignment UI (currently "coming in V2" banner).** Build
   a real UI for assigning/revoking roles from a user in `UsersPage.tsx` (or
   a user-detail sub-view). Backend support already exists per the audit
   (`user.role.assign` permission, `user_roles` join table with time-boxed
   grants) — this needs the API calls wired to real UI (list available
   roles, assign with optional `effective_until`, revoke). Check with the
   backend worker's summary for the exact endpoint shape if unsure.

## Part B — Membership-first prep (Phase 2 groundwork, lower risk items only)

Do not attempt the full redesign — several of these need backend endpoints
that don't exist yet (T-201-T-206, T-217 in `forsa-os`'s task list) and an
unresolved design decision (D-004) about the unified status model. Build what
you reasonably can without those:

1. **Navigation scaffolding.** The new spec adds these sections to the Admin
   Dashboard: Membership Queue, Financing Queue, AI Queue, Waiting List,
   Payments (exists), Guarantors (exists), Universities (exists), Digital
   Pass, Fraud Records, Audit Trail (exists). You can add the new nav items
   and route stubs (empty-state pages saying "backend integration pending")
   for Membership Queue, Financing Queue, AI Queue, Waiting List, Digital
   Pass, Fraud Records now — this is low-risk scaffolding that doesn't depend
   on the backend existing yet, and unblocks fast follow-up once it does. Do
   **not** fake real data in these — a clearly-labeled empty/pending state
   only.

2. **Do not build**: real Membership Queue approval logic, Fraud Records
   data, or Digital Pass admin views with actual pass data — these need
   backend endpoints from Phase 2 tasks T-201-T-206/T-217 that don't exist
   yet.

## Definition of done for this worker session

- Part A items 2-5 all fixed and manually verified (at minimum, confirm the
  corrected request URLs/behavior by inspecting network calls or reading the
  code path carefully if you can't run a live backend).
- Build/typecheck clean.
- Report back clearly: what you changed, what you verified, and **any
  backend contract you depended on that didn't exist yet**.
- Do not commit unless explicitly asked to by the user running this session.
- Write a short status summary at the end of your work (in your final
  message, not a new file) covering: Part A completion status per item,
  Part B what you scaffolded vs. skipped, and open questions.
