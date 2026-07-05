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

### D-003 — Should the new Household Stability weights live in the Policy Engine? — `OPEN`
**Question**: the Policy Engine was designed for exactly this kind of
configurable, versioned business weight, but is currently 100% inert (no
`policy_versions` seeded). When implementing Household Stability scoring
(35/25/20/10/10 split), should those weights be hardcoded (matching how
nearly every other threshold in the system works today) or should this be the
first real use of the Policy Engine?
**Leaning**: use the Policy Engine — it's the intended mechanism and this is
a natural place to finally exercise it, but this adds scope (need at least
one real `policy_versions` row + an approval step) — confirm with the user
before committing the extra work.
**Gates**: T-211, and indirectly T-108 (policy engine's overall "do we ever
populate this" question).

### D-004 — What is the single unified application/membership status model? — `OPEN`
**Question**: three status vocabularies now potentially coexist: (1) the core
pipeline's 16-status `STATUS_TRANSITIONS` machine, (2) the Admin Dashboard's
V2 `ApplicationWorkflowPage` vocabulary (Applied → ... → Active Student), and
(3) the new Phase 2 membership lifecycle (Visitor → Membership Request →
Bronze → FORSA ID → ... → Renewal). These need to become **one** coherent
model, not three.
**Not yet decided**: whether membership status (bronze/silver/gold/waiting/
fraud) is a field on `students`/a new `memberships` table, separate from
`applications.current_status` (which would then only track the
financing-request-specific sub-journey: Documents → AI Interview → AI
Assessment → Human Review → University Confirmation → Payment Plan), or
whether it's one merged state machine. **Recommend**: two related but distinct
state machines — membership status (coarse, long-lived, per-student) and
financing-request status (fine-grained, per-application, existing pipeline
mostly reused) — linked by `applications.student_id`. Confirm before starting
T-107/T-201/T-202, since a lot of downstream schema work depends on this.
**Gates**: T-107, T-201, T-202, and most of Phase 2's data-model tasks.

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

### D-008 — How does "Household Stability" scoring relate to the existing FORSA Score engine? — `OPEN`
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
**Leaning**: keep them as two separate, related systems — Household Stability
feeds the human decision at Silver/Gold time; FORSA Score continues to govern
ongoing repayment trust, collections prioritization, and renewal priority
(T-216 explicitly says "FORSA Score considered" at renewal, implying it
persists independently). Confirm this reading before implementing T-211,
since building it as a literal replacement of the existing score engine would
be a much bigger, riskier change.
**Gates**: T-211, T-216.

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

---

## How to use this file

- Before starting any task flagged `[!]` in `MASTER_TASK_LIST.md`, check here
  first.
- When you resolve an `OPEN` decision, flip it to `DECIDED`, add the date and
  rationale, and go update the task(s) it gates.
- When you make a new judgment call mid-implementation that a future session
  might question, add it here immediately — don't rely on the commit message
  alone to explain "why."
