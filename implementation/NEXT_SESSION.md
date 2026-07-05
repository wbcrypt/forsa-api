# FORSA — Next Session Pickup Point

**Read order for any new session**: this file last, after
`IMPLEMENTATION_PROGRESS.md`, `DECISIONS.md`, `KNOWN_ISSUES.md`, and
`MASTER_TASK_LIST.md`. If you're a worker session dispatched for one repo,
read your own `WORKER_*.md` prompt first — it's self-contained — but the
files above give you the full platform picture if you need it.

## Where things stand (as of 2026-07-05, end of session)

**Phase 1 (critical engineering fixes) is complete.** Every item T-101
through T-113 in `MASTER_TASK_LIST.md`'s Phase 1 section is checked off,
verified (`tsc --noEmit` + `npm run build` clean across `forsa-os`,
`forsa-student`, `forsa-dashboard`, `forsa-guarantor`, `forsa-partner`;
36/36 backend tests passing), and committed. Full detail of everything
fixed is in `MASTER_TASK_LIST.md`'s Phase 1 section and
`IMPLEMENTATION_PROGRESS.md`'s session log — don't re-derive it, read it.

**The governing rule from the 2026-07-05 Master Implementation Specification
is satisfied: Phase 2 (membership-first redesign) is now unblocked.**

Two repos were never touched by any Phase 1 work and haven't been verified
against these backend changes: `forsa-university`, `forsa-finance`. Neither
had a Phase-1-blocking item assigned, but since the backend added new
routes/columns/notification calls, it's worth a quick build/smoke check on
those two before assuming they're unaffected — low priority, do opportunistically.

## Starting Phase 2 — where to actually begin

**Do not start writing Phase 2 code before resolving the decisions below.**
Phase 2 touches the data model, all 6 frontends, and the pipeline/scoring
engines — getting the foundational shape wrong means redoing schema work
across every layer. This is worth a real design conversation with the user,
not a solo judgment call, especially for D-004.

### Step 0 — resolve gating decisions in `DECISIONS.md`

1. **D-004 (unifed status/membership model) — the single most important
   open decision.** Three status vocabularies currently coexist in concept
   (core pipeline's 16-status machine, the dashboard's V2 workflow
   vocabulary, and the new membership lifecycle: Visitor → Membership
   Request → Bronze → FORSA ID → Digital Pass → Member Dashboard → Complete
   Profile → Financing Eligibility → Financing Request → Documents → AI
   Interview → AI Assessment → Human Review → Silver/Gold → University
   Confirmation → Payment Plan → FORSA Score → Renewal). `DECISIONS.md`'s
   current recommendation is **two related but distinct state machines**:
   membership status (coarse, long-lived, per-student — bronze/silver/gold/
   waiting/fraud) and financing-request status (fine-grained, per-application,
   reusing most of the existing pipeline) — linked by `applications.student_id`.
   Confirm this reading with the user before any schema work in Step 1.
2. **D-003 (policy engine for Household Stability weights)** — decide
   whether the 35/25/20/10/10 weighting is hardcoded (matching almost every
   other threshold in the system today) or becomes the first real use of
   the currently-inert Policy Engine. The Policy Engine option adds real
   scope (needs at least one live `policy_versions` row + an approval
   step) — confirm the user wants that scope before committing to it.
3. **D-008 (Household Stability vs. FORSA Score relationship)** — confirm
   these are two separate systems (AI-advisory assessment at
   financing-request time vs. ongoing post-financing trust score), not one
   replacing the other, before implementing T-211.

### Step 1 — once D-004 is resolved: data model (T-201)

Design and write the new migration(s) for: membership records (level,
status, `forsa_id`, `member_since`), Digital Student Pass (generate-once,
status-updates-only — never recreate), fraud/blacklist records, waiting-list
entries. Follow the established convention: raw SQL in a new numbered
`migrations/00X_*.sql` file (next is `007`), applied via `npm run migrate` —
**never** add to `docs/archive/schema-superseded/`, which is the
now-archived, never-adopted design (see T-108/D-007).

### Step 2 — first vertical slice: Membership Request → Bronze (T-203/T-204)

This is the natural first end-to-end slice to build and demo, and it's also
where T-101/T-102's registration pattern finally gets its permanent home
(per D-001): a genuinely public `POST /membership-requests` endpoint
collecting only name/phone/email/city/university/programme/academic-year/
current-or-future-student — no guarantor, no financial documents — landing
in a new Admin Dashboard "Membership Queue" (nav/route scaffolding for this
already exists as a pending-state page from Phase 1's dashboard work — see
`forsa-dashboard/src/pages/pending/MembershipQueuePage.tsx`). On approval:
issue Bronze + FORSA ID + generate the Digital Student Pass, and provision
the real `users` row at that point (superseding the Phase-1-era `POST
/students/register`/`POST /guarantors/register` endpoints, which were
explicitly built as minimal/reversible per D-001).

### Step 3 — work outward from there

Follow `MASTER_TASK_LIST.md`'s Phase 2 section (T-201 through T-226) roughly
in order — each subsection notes its own dependencies. Notable ones to not
lose track of:
- T-107's full unification (the two existing status vocabularies +
  membership lifecycle) converges with T-201/T-202 — don't solve status
  vocabulary twice.
- T-210/T-211 (AI philosophy, Household Stability scoring) touch
  `src/ai/` — also fix the hardcoded invalid Anthropic model string
  (`'claude-sonnet-4-6'`) while in there (T-212), check the `claude-api`
  skill for the current valid model id list.
- T-213/T-214 (human decision outcomes, Waiting List, CEO-only override)
  is where the pre-existing dual/executive-approver enforcement gap
  (documented pre-Phase-1, Pipeline Stage 7/8) should finally get closed —
  don't build a second, parallel enforcement mechanism.

## Standing reminders

- This repo (`forsa-os`) is the only one with an `/implementation`
  directory. If working in a sibling repo, write findings to that repo's own
  status file and feed them back here.
- Don't commit anything without being asked — though as of this session,
  the user has explicitly asked for full commit + push across all touched
  repos, so check `git log`/`git status` to confirm that already happened
  before assuming there's nothing to commit.
- Update all 7 implementation files before ending a session, per the
  project's standing continuity rule.
- Every backend change in this project has been verified with `tsc
  --noEmit` + `npm run build` (+ `npm run test` where relevant) before
  being considered done — keep doing that in Phase 2, where the surface
  area (new tables, new endpoints, 6 frontends) makes it even easier for a
  silent regression to slip through.
