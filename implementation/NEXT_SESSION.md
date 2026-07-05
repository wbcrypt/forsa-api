# FORSA — Next Session Pickup Point

**Read order for any new session**: this file last, after
`PHASE_1_COMPLETION_REPORT.md`, `PHASE_2_PLAN.md`, `DECISIONS.md`, and
`MASTER_TASK_LIST.md`. If you're a worker session dispatched for one repo,
read your own `WORKER_*.md` prompt first — it's self-contained — but the
files above give you the full platform picture if you need it.

## Where things stand (as of 2026-07-05, end of session)

**Phase 1 + the launch-blocker hardening sprint are both complete.** Every
item T-101–T-113 is done, and all 7 launch blockers found by
`LAUNCH_BLOCKERS.md`'s audit are fixed (K-12, K-14, K-16+K-47, K-17+K-18,
K-09 stages 3-8). 57/57 backend tests passing, `tsc --noEmit`/`npm run
build` clean across `forsa-os` and every touched frontend. **Zero launch
blockers remain.** Full detail: `PHASE_1_COMPLETION_REPORT.md` — this is now
the permanent record and supersedes any Phase 1 summary in older files.

**D-004 (unified status/membership model) is resolved and approved by the
user**, including the previously-open sub-question: Silver/Gold membership
status persists permanently once earned (pure ratchet, only the fraud/
blacklist path moves it down). Documented in `DECISIONS.md`.

**Phase 2 is planned but NOT started.** `PHASE_2_PLAN.md` (new this
session) is the complete implementation plan — 12 milestones (M0–M11),
dependency-ordered, with per-milestone repo/schema/API/complexity/risk
detail and a recommended execution sequence that deviates from a naive
top-to-bottom read of `MASTER_TASK_LIST.md`'s T-201–T-226 list. **This plan
is awaiting user approval. Do not start writing Phase 2 code until that
approval is given.**

## Starting Phase 2 — where to actually begin, once approved

Read `PHASE_2_PLAN.md` in full first — don't re-derive the milestone
breakdown, dependencies, or risk list from `MASTER_TASK_LIST.md` directly,
since the plan already reorganizes and grounds those against the current
codebase (e.g., it corrects a wrong assumption in T-209 about
already-existing document-expiry tracking, and flags that T-215's
"per-family" exposure cap has no defined meaning anywhere yet).

**Three product decisions still block specific milestones and must be
resolved before that code starts** (`PHASE_2_PLAN.md` §3, `DECISIONS.md`):
1. **D-003** — Household Stability weights: Policy Engine or hardcoded? Gates M4.
2. **D-008** — Household Stability vs. the existing FORSA Score engine: two separate systems, or does one feed/replace the other? Gates M4 and M6.
3. **"Family" definition** (new, not yet a `DECISIONS.md` entry) — what defines a "family" for the per-family risk-exposure cap in T-215? Gates M5.

Everything else (D-001, D-002, D-004, D-007, D-009) is already decided and
does not block M0/M1/M2/M3/M8.

**Recommended starting sequence** (full rationale in `PHASE_2_PLAN.md` §5):
1. M0 (data model — `007_membership_lifecycle.sql`) + M8 (payment
   remainder — K-13 Konnect score event, payment history UI) in parallel;
   M8 is fully independent and a safe warm-up.
2. M1 (Membership Request → Bronze) — smallest full vertical slice through
   the new model, validates M0 before more gets built on it.
3. M2 + M3 in parallel (Digital Pass; financing-request gating + document
   freshness).
4. Resolve the 3 open decisions above.
5. M4, then M5 + M7 in parallel, then M6.
6. M9 (frontend rebuilds) — parallelize genuinely across the 5 remaining
   portal repos once each one's backend dependency has landed.
7. M10 (notifications) — wire incrementally as each milestone's trigger
   events land, not as one batched task at the end (Phase 1 already needed
   a T-106 catch-up pass for exactly this failure mode — don't repeat it).
8. M11 (legal copy) — runs in parallel the whole time, non-engineering.

## Standing reminders

- This repo (`forsa-os`) is the only one with an `/implementation`
  directory. If working in a sibling repo, write findings to that repo's own
  status file and feed them back here.
- Don't commit anything without being asked.
- Update all implementation files before ending a session, per the
  project's standing continuity rule.
- Every change in this project has been verified with `tsc --noEmit` +
  `npm run build` (+ `npm run test` where relevant) before being considered
  done — keep doing that in Phase 2, where the surface area (new tables,
  new endpoints, 6 frontends) makes it even easier for a silent regression
  to slip through.
- `forsa-os` is a shared bottleneck across nearly every Phase 2 milestone
  (unlike Phase 1's frontend work, which had 6 independent repos with zero
  merge risk) — see `PHASE_2_PLAN.md` §6, risk 1. Sequence backend-touching
  milestones seriously; only genuinely parallelize the frontend-only work
  (M9) across portal repos.
