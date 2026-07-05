# FORSA — Decisions Log

Architectural/product decisions, both settled and open. Check here before
making a judgment call that a past session (or the user) may have already
made — don't re-litigate a closed decision without new information. Open
decisions block the task(s) they're linked to in `MASTER_TASK_LIST.md`.

Format: `D-XXX` id, status (`OPEN` / `DECIDED`), the question, the answer (if
decided) with rationale, and which tasks it gates.

---

### D-001 — How does registration create a real login account? — `DECIDED` (2026-07-05)
**Question**: `POST /students` never creates a `users` row/password, so
self-registered students (and guarantors) can never log in. What's the fix?
**Decision**: Follow the Phase 2 membership lifecycle rather than patching the
old flow in isolation. A visitor submits a **Membership Request** (no
password, no auth yet) → it lands in the Admin Dashboard's Membership Queue →
on human approval, the system provisions Bronze membership + FORSA ID +
Digital Student Pass **and** creates the real `users` row at that moment
(email a set-password link, don't invent a password). Guarantors follow the
same pattern via the existing `guarantors.user_id` linkage added in migration
004. **Rationale**: this is what the Phase 2 spec's own lifecycle diagram
requires (Visitor → Membership Request → Bronze → ...), so solving T-101/T-102
as a one-off patch to the current `/students`+`login()` flow would be
throwaway work.
**Open sub-question**: is Bronze approval auto-approved (fully automatic,
since "no guarantor, no financial documents" implies low risk) or does it
always sit in a human queue? The Phase 2 spec explicitly lists "Membership
Queue" under Admin Dashboard support, implying human-in-the-loop by default —
treat as human-approved unless told otherwise. Revisit if this becomes a
throughput problem.
**Gates**: T-101, T-102, T-203, T-204.

### D-002 — Should notifications actually get wired before launch? — `DECIDED` (2026-07-05)
**Question**: original audit flagged that zero business logic ever calls
`NotificationsService`. Is wiring this in scope?
**Decision**: Yes — explicitly required by the 2026-07-05 master spec
("Connect business event infrastructure to actual workflows" is a Phase 1
blocking item, and Phase 2 §Notifications lists 11 concrete trigger events).
**Rationale**: no longer a judgment call, it's a direct instruction.
**Gates**: T-106, T-225.

### D-003 — Should the new Household Stability weights live in the Policy Engine? — `DECIDED` (2026-07-05)
**Question**: the Policy Engine was designed for exactly this kind of
configurable, versioned business weight, but is currently 100% inert (no
`policy_versions` seeded). When implementing Household Stability scoring
(35/25/20/10/10 split), should those weights be hardcoded (matching how
nearly every other threshold in the system works today) or should this be the
first real use of the Policy Engine?
**Decision**: **Hardcoded for V1**, but centralized in one place (a single
named constant/config object, not scattered inline literals) so migrating to
the Policy Engine later is a swap of that one lookup, not a refactor of every
call site. **V1 weights** (approved by user 2026-07-05):
- Household Stability: 35%
- Financial Capacity: 25%
- Academic Commitment: 20%
- Documentation Quality: 10%
- AI Interview Assessment: 10%
**Rationale**: avoids committing the extra scope of standing up a real
`policy_versions` row + approval step before there's any actual need to vary
these weights per-tenant/over-time. Centralizing keeps the door open.
**Implementation note for T-211**: put these weights in one module (e.g.
`src/score/household-stability.weights.ts` or similar, exporting a single
typed object) and have the scoring function read from it — never inline the
percentages at each usage site.
**Gates**: T-211. No longer blocks starting M4.

### D-004 — What is the single unified application/membership status model? — `DECIDED` (2026-07-05)
**Question**: three status vocabularies now potentially coexist: (1) the core
pipeline's 16-status `STATUS_TRANSITIONS` machine, (2) the Admin Dashboard's
V2 `ApplicationWorkflowPage` vocabulary (Applied → ... → Active Student), and
(3) the new Phase 2 membership lifecycle (Visitor → Membership Request →
Bronze → FORSA ID → ... → Renewal). These need to become **one** coherent
model, not three.

**Proposal — two related but distinct state machines, not one merged one:**

**1. Membership Status** — coarse, long-lived, lives on `students` (new
`membership_status` column) plus a new `membership_status_history` table
(append-only, mirroring the existing `application_status_history` pattern).
Only **four** real values: `bronze` (the floor — every approved member
starts here) → `silver` (active semester financing) → `gold` (active
academic-year financing) → `blacklisted` (permanent, fraud-confirmed, blocks
all future membership/financing requests for that identity). Key insight
that resolves the model cleanly: per the spec's own Human Decision outcome
list — Bronze, Silver, Gold, Waiting List, More Info Required, Not Approved,
Fraud — **Waiting List / More Info Required / Not Approved are properties of
a *financing request*, not the membership itself**. A member whose financing
request is waitlisted or declined this cycle doesn't lose membership — they
stay Bronze. This matches "Do not reject because capital is exhausted" and
"Bronze receives ecosystem access and priority" directly. (Small supporting
signal already in the repo: `forsa-dashboard/src/lib/i18n.ts` already has
unused `bronzePathway`/`assignBronze`/`ecosystemNote` strings — "Every
applicant joins FORSA. Gold & Silver receive financing. Bronze receives
ecosystem access and priority." — this direction was already anticipated,
just never wired to anything.) Silver/Gold is a **ratchet that only moves up**
via an approved financing decision — see the one open sub-question below on
what happens at renewal.

Before any membership exists, there is no `students` row at all — a
**Visitor** is anonymous. Submitting a Membership Request creates a new,
separate `membership_requests` row (public endpoint, no auth, no password —
name/phone/email/city/university/programme/academic-year/current-or-future
only, per the spec). Only on staff approval does the system provision the
real `students` row, `users` row (superseding T-101/T-102's Phase-1-era
`POST /students/register`/`POST /guarantors/register`, which were
deliberately built minimal and reversible per this same decision), FORSA ID,
and Digital Student Pass — this is what T-203/T-204 build.

**2. Financing Request Status** — fine-grained, per-`applications`-row,
**extends the existing `ApplicationStatus` enum in place** rather than
replacing the table or inventing a parallel one. Keep every value that's
real and currently used (`new_lead` through `appealing`). Retire the V2
dashboard vocabulary's dead duplicate/decorative values (`applied`,
`ai_interview_completed`-as-currently-unused, `internal_review`,
`pre_approved`, `document_verification`, `contracts_signed` — a near-typo
duplicate of `contract_signed`, `university_payment` — a near-typo duplicate
of `university_paid`) and replace them with the real Phase 2 steps that
didn't exist before: a genuine `ai_interview_completed` (now actually wired
to AI Assessment output), `ai_assessment_complete`, `waiting_list` (reuses
the existing `capital_queue` *mechanism* — same soft-block concept — just
renamed in user-facing copy to match the spec's own outcome name, not a
second parallel enum value), `more_info_required` (distinct from
`waiting_for_documents` — this is *post*-assessment feedback, not
*pre*-submission), `fraud_flagged` (triggers the permanent blacklist and is
structurally distinct from a plain `rejected`), and `university_confirmed`
(the new University Confirmation step — university staff confirming
tuition/enrollment before a payment plan activates, a real *new*, narrowly-
scoped write capability for that portal per the spec's "University Portal"
section, otherwise still read-only).

**Important clarification this proposal makes explicit**: `approved_level1/
2/3` (today's approval-*authority* tiers — auto/single-approver/dual-approver
by dollar amount) and `silver`/`gold` (financing-*duration* tiers — semester
vs. academic year) are **two different axes, not the same thing**. A Silver
(semester) financing request could still need Level 2 (dual-approver)
sign-off depending on amount. Proposal: keep `current_financing_level`
(level1/2/3) exactly as it works today, and add a new, separate
`financing_tier` field (`silver`/`gold`) set by the human decision — do not
conflate the two or collapse one into the other.

**Sub-question — RESOLVED by user 2026-07-05**: does a member's Silver/Gold
status persist after that financing period ends without renewal, or lapse
back to Bronze? **Answer: persists.** A student who earned Silver/Gold keeps
that membership status permanently — it does not reset or expire — unless
the account is blacklisted for confirmed fraud. `membership_status` is
therefore a pure ratchet with exactly one exception: `bronze → silver →
gold` moves only upward via an approved financing decision, and any level
can move to `blacklisted` (terminal), but nothing ever moves back down from
`silver`/`gold` to `bronze` on its own. Renewal financing requests are still
evaluated on their own merits each cycle (FORSA Score considered per T-216)
— that governs whether a *new* financing request is approved, not whether
the student keeps their earned membership tier. Implementation note for
T-201/T-202: no expiry/decay logic, no scheduled job to downgrade dormant
Silver/Gold members — the only write path that changes `membership_status`
downward is the fraud/blacklist flow (T-217).

**D-004 is now fully decided — Phase 2 schema/code work (T-201 onward) is
unblocked.** See `NEXT_SESSION.md` for the updated starting point.

**Gates**: T-107 (fully closes once this lands), T-201, T-202, and most of
Phase 2's data-model tasks. **Status**: approved by the user 2026-07-05 —
fully decided, Phase 2 schema/code work is unblocked.

### D-005 — Should guarantor withdrawal trigger an automated consequence? — `OPEN`
**Question**: today `GUARANTOR_WITHDRAWAL` opens an exceptional-event row with
no automated effect (doesn't touch score, doesn't block payments, doesn't
retrigger pipeline review). Is this intentional (human-only response) or a gap
to close?
**Leaning**: leave as human-only for now — not mentioned anywhere in the
Phase 2 spec, so don't expand scope speculatively. Revisit only if it becomes
a real incident.
**Gates**: T-208 (spec's Phase 2 doesn't mention this explicitly — low
priority, Phase 5 cleanup list).

### D-006 — Deployment target — `OPEN`
**Question**: current docs (`docs/DEPLOYMENT.md`) describe PM2+Nginx on a VM;
`AUDIT_REPORT.md` shows the API is actually live on Render. Which is the real
target going forward, and does the Dockerfile need hardening (T-512) for that
target specifically?
**Status**: not addressed by the 2026-07-05 spec either. Low priority vs.
Phase 1/2/3 — defer until asked, but don't contradict the Render reality when
touching deploy config.

### D-007 — What to do with `database/schema/`? — `DECIDED` (2026-07-05)
**Question**: delete outright, or archive?
**Decision**: move to `docs/archive/schema-superseded/` with a top-of-file
(or directory README) note marking it superseded/never-adopted, rather than
deleting outright. **Rationale**: it has genuine historical design value (the
original, more elaborate intent) and deleting is harder to reverse than
archiving; archiving still fully satisfies "no engineer builds against the
wrong one" (T-108) as long as it's out of the live `database/`/`migrations/`
path and clearly labeled.
**Gates**: T-108.

### D-008 — How does "Household Stability" scoring relate to the existing FORSA Score engine? — `DECIDED` (2026-07-05)
**Question**: the existing FORSA Score Engine has 5 dimensions
(`payment_reliability` 0.40, `documentation_reliability` 0.20,
`communication_reliability` 0.15, `academic_continuity` 0.15,
`guarantor_reliability` 0.10) that describe an **existing member's ongoing
trust**, computed post-financing. The new Household Stability model (35%
Household Stability / 25% Financial Capacity / 20% Academic Commitment / 10%
Documentation Quality / 10% Interview) describes an **AI-advisory assessment
at financing-request time**, pre-decision. These look like two different
systems answering two different questions (ongoing trust vs. initial
financing-worthiness), not one replacing the other.
**Decision**: **They remain conceptually separate, permanently — not just for
V1.** Explicit definitions (user, 2026-07-05):
- **Household Stability** = pre-financing assessment of the family/guarantor
  dossier (AI-advisory, computed once per financing request, at
  interview/assessment time).
- **FORSA Score** = post-financing behavioral trust score, based on payment
  history and member behavior over time.
**It is acceptable to display them together** in the Admin Dashboard's
review UI (e.g., side-by-side on the same decision screen) if that's useful
for a reviewer — **but they must never be merged into one number, one
column, or one stored field.** Keep separate storage (Household Stability in
`applications.ai_report` JSONB per financing request; FORSA Score in the
existing `forsa_scores` table per student) and separate computation logic —
do not let a future refactor quietly collapse them because they "look
similar." Household Stability feeds the human decision at Silver/Gold time;
FORSA Score continues to govern ongoing repayment trust, collections
prioritization, and renewal priority (T-216's "FORSA Score considered" at
renewal refers to this score, not Household Stability).
**Gates**: T-211, T-216. No longer blocks starting M4/M6.

### D-009 — Parallel-session work split (2026-07-05) — `DECIDED`
**Decision**: Phase 1 work is being split across parallel Claude Code
sessions for speed, one per repo, each with a fully self-contained prompt
(see `WORKER_BACKEND.md`, `WORKER_STUDENT.md`, `WORKER_DASHBOARD.md`). First
batch covers `forsa-os` (backend), `forsa-student`, `forsa-dashboard`.
`forsa-partner`, `forsa-university`, `forsa-finance`, `forsa-guarantor` are
not yet dispatched — do that in a follow-up batch once these three land,
using the same worker-prompt pattern.
**Coordination rule**: each worker operates in its own independent git repo —
no shared branch, no merge coordination needed between workers. Each worker
must update this `/implementation` workspace (which lives only in `forsa-os`)
via its own summary handed back to the orchestrating session, since only the
`forsa-os` checkout has this directory — workers in other repos should write
their findings/status into their own repo's `IMPLEMENTATION_STATUS.md` (or
equivalent) and the orchestrator reconciles it back into
`IMPLEMENTATION_PROGRESS.md`/`CHANGELOG.md` here.
**Gates**: none — this is a process decision, not a product one.

### D-010 — What defines a "family"/"household" for the per-family risk-exposure cap? — `DECIDED` (2026-07-05)
**Question**: T-215 requires "max exposure per family" as a risk rule, but
neither the original spec nor any existing schema concept defines what
"family" means for this purpose.
**Decision**: for V1, **family/household = student + primary guarantor**.
Extended family (grandparents, aunts/uncles, siblings' households, etc.) is
**explicitly excluded** unless that person is legally or financially
responsible for the student (i.e., is itself registered as a guarantor on
the application — in which case they're already "primary guarantor" by
definition, not an exception case).
**Exposure limit meaning**: "max exposure per family" means **max total
outstanding financing exposure per primary-guarantor household** — i.e.,
grouped by the guarantor identity, not by student identity alone. A single
guarantor backing multiple students (e.g., financing two children, or a
guarantor linked to more than one unrelated student) has their exposure
summed across all of them for this cap; a student's own individual exposure
alone is not what's being capped here — that's a different, already-existing
concept (per-application/per-student financing limits).
**Implementation note for T-215**: group by `student_guarantors.guarantor_id`
(the primary/active guarantor link) when computing this cap, not by
`applications.student_id` alone. Matches this decision's household
definition exactly — no new "family" table/concept needed, this reuses the
existing guarantor linkage.
**Gates**: T-215. **Implemented 2026-07-05** — `stage6PortfolioCapital` groups by `student_guarantors.guarantor_id` (`role='primary'`, `status='active'`) exactly as decided, no new schema needed.

---

## How to use this file

- Before starting any task flagged `[!]` in `MASTER_TASK_LIST.md`, check here
  first.
- When you resolve an `OPEN` decision, flip it to `DECIDED`, add the date and
  rationale, and go update the task(s) it gates.
- When you make a new judgment call mid-implementation that a future session
  might question, add it here immediately — don't rely on the commit message
  alone to explain "why."
