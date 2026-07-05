# FORSA — Next Session Pickup Point

**Read order for any new session**: this file last, after
`IMPLEMENTATION_PROGRESS.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`, and
`MASTER_TASK_LIST.md`. If you're a worker session dispatched for one repo,
read your own `WORKER_*.md` prompt first — it's self-contained — but the
files above give you the full platform picture if you need it.

## Where things stand (as of 2026-07-05, end of session)

First Phase 1 batch (3 of 7 repos) is substantially done. Summary of what's
actually fixed vs. still open — full detail in `MASTER_TASK_LIST.md` Phase 1
and `IMPLEMENTATION_PROGRESS.md`'s latest entries.

**Done this session:**
- `forsa-os`: T-103 (`GET /partners/me`), T-105 (Konnect webhook `@Public()`),
  T-108 (schema archived), T-110 (rate limiting enabled), T-101 backend half
  (`POST /students/register` + `GET /students/me` now wired — service methods
  were written by the backend worker, controller routes were finished by the
  orchestrating session after the worker was cut off by a rate limit).
- `forsa-student`: T-101 frontend half, T-111 frontend half (real S3 receipt
  upload, blocked on 2 backend gaps — see below), T-220 (dashboard reshape
  with placeholders for membership/FORSA-ID/pass fields).
- `forsa-dashboard`: T-104 (payment-verify prefix bug), T-107 frontend half
  (Badge/filter recognizes both status vocabularies), T-112 (role-assignment
  UI, with a flagged backend gap), T-113/T-516 (hardcoded localhost links),
  T-221 (nav scaffolding for the 6 new Phase 2 sections — pending-state pages,
  routes, nav items, i18n labels all wired; the nav-item/i18n step specifically
  was finished by the orchestrating session after the worker was cut off).
- All changes verified with clean `tsc --noEmit`/`npm run build` in both
  repos. **Nothing committed** — left in each repo's working tree for the
  user to review.

**Still open in Phase 1 (not yet touched by anyone):**
- T-102 — guarantor self-registration (needs a `forsa-guarantor` worker).
- T-106 — notifications wiring (backend, not started).
- T-107 backend half — `STATUS_TRANSITIONS` enforcement against out-of-enum
  V2 status writes (not started; frontend half is done).
- T-109 — test suite (not started at all; zero `.spec.ts` files still exist).
- `forsa-partner` frontend half of T-103 — `loadPartner()` still uses
  `partners[0]`; needs to switch to calling the new `/partners/me` endpoint.
- Guarantor half of T-111 (receipt upload).

**New backend gaps surfaced this session** (`KNOWN_ISSUES.md` K-44/K-45/K-46):
no `GET /roles` route, no `payment_receipt` document type seeded, no
`receiptDocumentId` column on `payments`. Small, well-scoped follow-ups.

**Governing rule still applies**: Phase 2 (membership-first redesign) does
not start until every Phase 1 checkbox in `MASTER_TASK_LIST.md` is checked.
We are close but not there yet — T-102, T-106, T-107 (backend), and T-109 are
the remaining blockers.

## Immediate next steps

1. **Dispatch the remaining Phase 1 work.** Good candidates for another
   parallel batch, following the same `WORKER_*.md` pattern used this
   session (write a self-contained prompt file, spawn as a background
   Agent, one per repo):
   - `forsa-os` (continuation): T-102 (guarantor registration — same pattern
     as T-101's `registerSelf`/`findMe`, just for `guarantors.user_id`),
     T-106 (notifications wiring), T-107 backend enforcement, T-109 (test
     suite — should include the K-05/T-105 signature-verification test that
     was never written), and the two new backend gaps K-45/K-46 (needed to
     unblock T-111 fully).
   - `forsa-partner`: switch `loadPartner()` to `GET /partners/me` (backend
     side already done), fixing the platform's single highest-severity
     frontend bug.
   - `forsa-guarantor`: T-102 frontend half + guarantor half of T-111.
   - `forsa-university`, `forsa-finance`: no Phase-1-blocking items, but
     worth a quick build-health pass to confirm nothing broke.
2. **Watch for the same rate-limit failure mode.** If a background agent
   fails with "session limit" mid-task, don't just retry blindly — check
   `git status`/`git diff` in that repo first, since (per this session's
   experience) agents tend to leave clean, typechecking code with only the
   very last in-flight edit unfinished. Often faster to read the failure
   message's last line and finish that one small step directly than to
   re-dispatch a fresh agent into the same limit.
3. Before touching anything in Phase 2: resolve the `OPEN` decisions in
   `DECISIONS.md` that gate it — D-003 (policy engine usage), D-004 (unified
   status model — **this one blocks almost everything else in Phase 2**),
   and D-008 (Household Stability vs. FORSA Score relationship). D-004
   especially should probably be a design conversation with the user before
   code starts, not a solo judgment call, given how much schema work depends
   on it.
4. Do not skip ahead into Phase 2/3/4 tasks while any Phase 1 checkbox in
   `MASTER_TASK_LIST.md` is unchecked — that's the one hard rule from the
   controlling spec.

## Standing reminders

- This repo (`forsa-os`) is the only one with an `/implementation` directory.
  If you're working in a sibling repo, write your findings to that repo's own
  status file and feed them back here (or ask the orchestrating session to).
- Don't commit anything without being asked — check `git status` before
  assuming a clean start. As of end of this session, `forsa-os` and
  `forsa-dashboard` and `forsa-student` all have uncommitted changes waiting
  for review.
- Update all 7 implementation files before ending a session, per the
  project's standing continuity rule.
