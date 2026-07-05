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

**Progress (updated 2026-07-05, final)**: **all 7 blockers are now fixed**
(#1 K-12, #2 K-14, #3 K-16+K-47, #4 K-17+K-18, #5 K-09 stages 3-7 + the
Stage 8 gate). See each section below for what was actually done — none of
these fixes expand scope beyond closing the specific gap described.

Some `KNOWN_ISSUES.md` statuses were corrected while building this file:
K-01, K-02, K-03, and K-06 were still marked `OPEN`/`PARTIALLY FIXED` from
stale wording even though their underlying `MASTER_TASK_LIST.md` tasks
(T-101, T-102, T-103, T-106) are fully `[x]` — flipped to `FIXED`.

---

## Launch Blockers (7)

Ordered by severity. Each maps to a `KNOWN_ISSUES.md` row — see that file
for full technical detail.

### 1. K-12 — Dual/executive approver requirement computed but never enforced — ✅ FIXED 2026-07-05
Pipeline Stage 7 computes how many independent reviewer decisions a large
financing amount requires (2 for dual/executive-level); Stage 8 records that
requirement — but `submitHumanDecision` only ever read the *most recent*
reviewer decision and finalized on it. **A single reviewer could approve any
amount, regardless of the size-based dual-approval control the system
itself decided was needed.** Fixed: an `'approved'` decision now only
proceeds to Stage 9 once `COUNT(DISTINCT reviewer_id)` of approved decisions
on that pipeline run meets `required_approvers` — otherwise it returns
`{ status: 'awaiting_additional_approver', ... }` without advancing.
`rejected`/`on_hold`/`needs_more_documents` still proceed on a single
reviewer's say-so (deliberate — a single person stopping/pausing isn't the
risk this control guards against). Also added a same-reviewer-can't-vote-
twice guard. 4 new tests lock this down. Task: T-214.

### 2. K-14 — Structurally inconsistent double-entry ledger between payment paths — ✅ FIXED 2026-07-05
The Konnect (online) path wrote one `financial_ledger` row with
`debit_account`/`credit_account` columns; the manual/receipt-verified path
writes two rows, one `account` column each. Turned out to be worse than
"inconsistent": those `debit_account`/`credit_account` columns **don't exist**
in the live schema (only `entry_type`/`account` do), and the Konnect path's
`entry_type = 'payment'` violated the table's `CHECK (entry_type IN
('debit','credit'))` constraint — every real Konnect confirmation would throw
a SQL error on this write, *after* the payment was already marked `verified`
and the installment `paid`, silently leaving a verified payment with no
ledger entry. Fixed: extracted a shared `LedgerService`
(`src/payments/ledger.service.ts`), both payment paths now call it, one
locked-down test added confirming the Konnect path writes the correct
debit/credit pair. Task: T-218 (ledger half only — the Konnect→FORSA-Score
event gap, K-13, remains separately open and is classified Post-Launch).

### 3. K-16 + K-47 — Inconsistent/broken refresh-token strategy across portals — ✅ FIXED 2026-07-05
Dashboard/University/Partner sent a bearer refresh token in the request
body; Finance/Guarantor relied on `withCredentials` cookies with an
empty-body refresh call. Confirmed against `forsa-os/src/auth/dto/
login.dto.ts` (`RefreshTokenDto`): `refreshToken` is a **required string in
the body** — there is no cookie fallback — so Finance/Guarantor's calls were
400ing on every access-token expiry (15 min default), silently forcing
users back to `/login`. Fixed: both now store the refresh token returned at
login and send it in the body on refresh, matching the already-correct
Dashboard/University/Partner/Student pattern. K-47 (`forsa-partner`'s
refresh interceptor calling bare `axios.post('/api/v1/auth/refresh', ...)`
with no configured base URL) also fixed — now uses the correct full URL,
deliberately kept as a bare `axios` call (not the app's intercepted `api`
instance) to avoid interceptor-recursion risk if the refresh token itself
is invalid. **Not touched**: University portal's own separate relative-path
refresh bug (K-26) — different root cause, was already classified
Post-Launch, out of this pass's scope. Tasks: T-304 (was verification-only,
now superseded by the actual fix).

### 4. K-17 + K-18 — AI interview: invalid model + fabricated scores reaching real decisions — ✅ FIXED 2026-07-05
The hand-rolled Anthropic integration hardcoded an invalid model string
(`'claude-sonnet-4-6'`) — **fixed**: switched to `claude-opus-4-8` (see
`KNOWN_ISSUES.md` K-17 for a caveat: `'claude-sonnet-4-6'` turned out to
actually be a valid current model id, so this wasn't quite the live 400
the original audit described, but the fix stands regardless per the
`claude-api` skill's own default-model guidance). **K-18 also fixed**: the
student portal's demo-mode fallback used to submit a client-side
`Math.random()`-generated "AI score" **as if it were real**
(`aiScoreOverall`/`aiReport`/`aiRecommendation`), with only a small "🎭 Demo
mode" chat-UI badge as disclosure — never actually reaching the backend.
Fixed at the root: demo mode no longer fabricates a score at all;
`aiScoreOverall`/`aiRecommendation` are explicitly `null` whenever the real
`/ai/score` endpoint wasn't used, so a human reviewer sees "no AI score"
rather than a plausible-looking fake number. Confirmed safe to null out:
no backend business logic reads these two columns (grepped — only the
already-broken `seed-demo.ts` references them), and the dashboard's
`RankingPage`/`AIReportPanel` already fall back to `{}` on a missing
`scores` object without crashing. Tasks: T-212 (model fix), T-210
(demo-mode fallback hardening) — both done.

### 5. K-09 (remaining) — Pipeline stages 3–10 had zero test coverage — ✅ FIXED for stages 3-8, 2026-07-05
Phase 1 added tests for stages 1–2 (completeness, eligibility). This pass
adds stages 3 (university/partnership — active/blocked/needs-review),
4 (risk assessment — low/high risk scoring), 5 (policy evaluation — amount
ceiling + renewal-default violations), 6 (portfolio/capital — the 40%
concentration cap and its capital-queue soft-block), and 7 (approval
threshold — all four approval modes: auto/single/dual/executive, plus the
high-risk escalation rule), plus the Stage 8 human-decision gate itself
(the K-12 fix above, tested exhaustively: double-vote rejection, partial
approval not proceeding, full approval proceeding, single-reviewer
rejection proceeding). **Stages 9 (decision generation) and 10 (decision
execution) remain untested** — recommend closing those next, but the
higher-risk gates (portfolio caps, approval thresholds, the approver-count
enforcement itself) are now covered. 57 backend tests total, all passing.
Task: T-301 (Phase 3 scope — stages 9-10 + e2e tests are what's left there).

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
