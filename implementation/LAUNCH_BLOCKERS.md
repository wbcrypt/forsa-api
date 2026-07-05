# FORSA — Launch Blockers

Classifies every remaining open issue in `KNOWN_ISSUES.md` as **Launch
Blocker** (must be fixed before real users/real money touch the platform) or
**Post-Launch** (real, worth fixing, but doesn't block go-live). Built by
cross-referencing `KNOWN_ISSUES.md`, `MASTER_TASK_LIST.md`, and
`FORSA_PLATFORM_SPEC.md`'s own §20 "Risks before production" ranking.

**Scope note**: this classifies the *current* platform — Phase 1 (critical
fixes, now complete) running the existing financing-first model. It does
**not** include Phase 2 (membership-first redesign) tasks — those are a
forward-looking rebuild, not blockers against today's system. If "launch"
in your context means the *full* membership-first V1 the master spec
describes, most of Phase 2 (`MASTER_TASK_LIST.md` T-201 through T-226)
would need to move into this list too, since almost none of it exists yet
beyond nav scaffolding.

**Counts**: 33 remaining issues classified — **7 Launch Blockers**, **26
Post-Launch**. (14 issues already `FIXED` in `KNOWN_ISSUES.md` are excluded
entirely — see that file for what's already closed.)

Some `KNOWN_ISSUES.md` statuses were corrected while building this file:
K-01, K-02, K-03, and K-06 were still marked `OPEN`/`PARTIALLY FIXED` from
stale wording even though their underlying `MASTER_TASK_LIST.md` tasks
(T-101, T-102, T-103, T-106) are fully `[x]` — flipped to `FIXED`.

---

## Launch Blockers (7)

Ordered by severity. Each maps to a `KNOWN_ISSUES.md` row — see that file
for full technical detail.

### 1. K-12 — Dual/executive approver requirement computed but never enforced
Pipeline Stage 7 computes how many independent reviewer decisions a large
financing amount requires (2 for dual/executive-level); Stage 8 records that
requirement — but `submitHumanDecision` only ever reads the *most recent*
reviewer decision and finalizes on it. **A single reviewer can approve any
amount today, regardless of the size-based dual-approval control the system
itself decided was needed.** This is a real control gap on a lending
platform's largest, highest-risk decisions — exactly the kind of thing that
should not ship live. Task: T-214.

### 2. K-14 — Structurally inconsistent double-entry ledger between payment paths
The Konnect (online) path writes one `financial_ledger` row with
`debit_account`/`credit_account` columns; the manual/receipt-verified path
writes two rows, one `account` column each. Both are meant to represent the
same double-entry transaction. A platform moving real money needs one
consistent ledger shape for reconciliation/audit — as-is, any downstream
reporting or accounting reconciliation that assumes one shape will silently
miscount transactions from the other path. Task: T-218.

### 3. K-16 + K-47 — Inconsistent/broken refresh-token strategy across portals
Dashboard/University/Partner send a bearer refresh token in the request
body; Finance/Guarantor rely on `withCredentials` cookies with an
empty-body refresh call — **only one of these two patterns can actually be
correct** against the real `POST /auth/refresh` implementation, meaning at
least one portal family is likely forcing users to re-login on every
access-token expiry (15 min default). K-47 is the same class of bug found
in `forsa-partner` specifically: its refresh interceptor calls bare
`axios.post()` instead of the app's configured instance, so even the
"correct" pattern may not resolve to the right host once frontend and API
are on different origins. **This needs a live verification pass against the
deployed backend before launch** — if wrong, staff and guarantors get
logged out mid-session repeatedly, which is a real, first-day support-ticket
generator, not a cosmetic bug. Tasks: T-304 (verification), unassigned fix.

### 4. K-17 + K-18 — AI interview: invalid model + fabricated scores reaching real decisions
The hand-rolled Anthropic integration hardcodes an invalid model string
(`'claude-sonnet-4-6'`), so the real AI interview endpoint will always fail
once an API key is configured. Worse: the student portal's demo-mode
fallback triggers on **any** exception (not just a missing key — a network
blip or backend hiccup also qualifies), and in demo mode submits a
client-side `Math.random()`-generated "AI score" **as if it were real**
(`aiScoreOverall`/`aiReport`/`aiRecommendation`), which the pipeline and
scoring system then consume identically to a genuine assessment. A student
can end up with a randomly fabricated readiness score silently feeding a
real financing decision, with only a small "🎭 Demo mode" badge as
disclosure. This is a data-integrity and (arguably) fairness issue on a
platform explicitly designed around "AI advises, humans decide" — right
now a transient network error can make the AI effectively hand a random
number to the human reviewer without them necessarily noticing it wasn't
real. Tasks: T-212 (model fix), T-210 (fallback/disclosure hardening).

### 5. K-09 (remaining) — Pipeline stages 3–10 have zero test coverage
Phase 1 added tests for stages 1–2 (completeness, eligibility) plus auth,
payment ledger writes, and Konnect signature verification — but stages 3–10
(risk assessment, policy evaluation, portfolio/capital, approval-threshold
routing, human decision, decision generation, decision execution) remain
completely untested. These are the stages that actually decide who gets
financed and for how much — shipping them with zero automated coverage on
a platform already carrying the K-12 control gap above compounds the risk
of an undetected regression in the exact code path that matters most.
Recommend closing this — or at minimum stages 4–7 and 9 (the ones that
touch money/risk directly) — before real financing decisions run through
this pipeline unsupervised. Task: T-301 (Phase 3 scope, but the money-path
stages specifically should not wait for the rest of Phase 3).

---

## Post-Launch (26)

Real issues, worth scheduling, but none of these stop a responsible launch
on their own. Grouped by theme rather than re-listing full detail — see
`KNOWN_ISSUES.md` for the complete description of each.

**Financial/scoring consistency (lower severity than the blockers above)**
- K-13 — Konnect payments never fire a FORSA Score event (inconsistent with
  the manual-verification path, but doesn't miscount money — just an
  under-rewarded on-time payment).
- K-19 — Policy Engine has no live values; every threshold runs on its
  hardcoded fallback. The original audit itself frames this as a *decision*
  ("accept hardcoded for now or populate real policy versions"), not an
  automatic blocker — see `DECISIONS.md` D-003.
- K-20 — CEO report `deployed_capital` KPI over-reports (a leadership
  dashboard display bug, not a ledger/money-movement bug).
- K-21 — Document rejection doesn't create a score event (minor scoring
  completeness gap).
- K-22 — Collections' escalation ladder isn't automated despite a UI
  banner implying it is (misleading copy; staff can still act manually).

**Portal-specific gaps (none touch money movement or auth security)**
- K-15 — Row-Level Security designed but never deployed; tenant isolation
  rests on manual `WHERE tenant_id` filtering only. Flagged here rather than
  as a blocker because the original platform audit's own top-10 risk
  ranking did **not** elevate this to a launch-blocking item, and no
  cross-tenant leak was ever actually observed — but this is the single
  item in this list worth reconsidering if FORSA plans to onboard more than
  one real tenant soon. Recommend prioritizing this early post-launch, not
  letting it sit.
- K-23 — University portal "Notes" is `localStorage`-only, presented as
  saved. Misleading, but affects a secondary read-only portal, not core
  financing/payment flows. Cheap fix: relabel as "not saved" immediately;
  full backend wiring can follow.
- K-24 — University/Partner portals hardcode a single tenant UUID (fine if
  FORSA launches single-tenant, as the current demo data assumes).
- K-25 — University portal's language switcher doesn't translate content.
- K-26 — University portal's token-refresh uses a relative path (same
  class as K-16/K-47 but on a secondary, read-only portal).
- K-27 — Finance portal `DisbursementsPage` is a placeholder (disbursement
  management still works via the Admin Dashboard).
- K-28 — Finance portal's "view receipt" button is non-functional. Now
  cheap to fix given `payments.receipt_document_id` exists (T-111) — worth
  an early post-launch pass even though it's not a blocker.
- K-29 — Finance/University/Partner report "exports" are raw JSON or
  print-dialog hacks, not real CSV/PDF.

**Dev/ops hygiene (no user-facing or financial impact)**
- K-32 — `src/seeds/seed-demo.ts` broken (a demo-data tool, not used in the
  real deploy path).
- K-33 — Partner referral QR codes depend on an unauthenticated third-party
  API with a placeholder fallback.
- K-34 — Literal unexpanded-brace-expression directories in all 7 repos.
- K-35 — Empty dead-scaffold directories (`src/roles/`, etc.).
- K-36 — Five dead feature flags.
- K-37 — Orphaned duplicate template files (finance/guarantor).
- K-38 — Dead `rate_limit_buckets` table; duplicated `outbox_events` index.
- K-39 — Unused `BCRYPT_ROUNDS` env var.
- K-40 — Raw SQL migrations instead of versioned TypeORM migrations (the
  team's own acknowledged, already-deferred item).
- K-41 — Duplicate `fix-quotes.js` dead file across all 6 frontends.
- K-42 — No dedicated `/health` endpoint (a documented workaround —
  `GET /auth/me` returning 401 — already exists; genuinely nice-to-have for
  proper uptime monitoring, recommend adding early post-launch).
- K-43 — `Dockerfile` not hardened (single-stage, no `HEALTHCHECK`, runs as
  root) — matters more once the deploy target (D-006) is finalized.
- K-44 — No `GET /roles` route to list assignable roles in the new
  role-assignment UI (falls back to manual Role ID entry — functional, just
  not polished).

---

## How to use this file

- Before declaring "ready to launch," every item in **Launch Blockers**
  should be `FIXED` in `KNOWN_ISSUES.md` (update this file's status
  alongside it — don't let the two drift, the way K-01/K-02/K-03/K-06 did
  before this pass).
- Post-Launch items should get triaged into a real post-launch backlog
  (sprint/ticket system of your choice) rather than living here
  indefinitely — this file is a launch gate snapshot, not a permanent
  backlog.
- If new issues are found before launch, classify them here immediately
  using the same test: *does this actively risk money, security, legal
  exposure, or make a core flow unusable* → Blocker; *everything else* →
  Post-Launch.
