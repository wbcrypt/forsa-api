# FORSA — Phase 2 Implementation Plan

**Status: APPROVED, IN PROGRESS.** All gating decisions (D-003, D-004, D-008,
D-010) are resolved. User approved this plan and gave a revised execution
order on 2026-07-05 — see §5a, which supersedes §5's original sequence.

Built from `FORSA_PLATFORM_SPEC.md`, `PHASE_1_COMPLETION_REPORT.md`, the current
codebase (`forsa-os` + 6 frontends), `DECISIONS.md`, and `MASTER_TASK_LIST.md`'s
Phase 2 section (T-201–T-226). Phase 2 replaces the platform's current
"financing-first" framing with a membership-first lifecycle: Visitor →
Membership Request → Bronze → FORSA ID → Digital Pass → Member Dashboard →
Financing Request → AI Interview/Assessment → Human Review → Silver/Gold →
University Confirmation → Payment Plan → Renewal.

All decisions that gate this plan are now resolved — see §3 for the
resolutions (D-003: hardcoded, centralized weights; D-008: Household
Stability and FORSA Score stay permanently separate; D-010 new: family =
student + primary guarantor household).

---

## 0. How this plan is organized

The flat T-201–T-226 list is regrouped into 12 milestones (M0–M11), ordered
by dependency, not by the original numbering. Each milestone states: what it
delivers, which repos it touches, what schema/API changes it needs, what it
depends on, its complexity, and its specific risks. §5 gives the recommended
execution sequence and explains where it deviates from a naive top-to-bottom
read of `MASTER_TASK_LIST.md`.

**Repo map**: `forsa-os` (backend, shared by nearly every milestone — see the
parallelization risk in §6) · `forsa-dashboard` · `forsa-student` ·
`forsa-university` · `forsa-partner` · `forsa-finance` · `forsa-guarantor`.

---

## 1. Milestones

### M0 — Data model & status unification (T-201, T-202)
**Delivers**: the schema foundation everything else builds on.
- New migration `007_membership_lifecycle.sql`:
  - `membership_requests` table (public intake, no auth — name/phone/email/city/university/programme/academic-year/current-or-future-student only)
  - `students.membership_status` column (`bronze`/`silver`/`gold`/`blacklisted`) + append-only `membership_status_history` table (mirrors the existing `application_status_history` pattern)
  - `students.forsa_id`, `students.member_since`
  - `digital_student_passes` table (generate-once, status-updates-only — id, student_id, issued_at, status, QR verification token; leave room for wallet-provider fields — Apple/Google Wallet pass IDs, signing certs — as nullable columns added later, not built now)
- Extend `ApplicationStatus` enum (`src/common/enums.ts`) in place: keep every real value (`new_lead`...`appealing`), drop the dead V2-dashboard duplicates (`applied`, `internal_review`, `pre_approved`, `document_verification`, `contracts_signed`, `university_payment`), add the real new steps (`ai_interview_completed`, `ai_assessment_complete`, `waiting_list`, `more_info_required`, `fraud_flagged`, `university_confirmed`). **No `ALTER TYPE` needed** — confirmed `applications.current_status` is `VARCHAR(100)`, not a native Postgres enum, so this is an application-layer change only.
- Add `applications.financing_tier` (`silver`/`gold`, set by human decision) as a column **separate from** the existing `current_financing_level` (`level1`/`level2`/`level3`, the approval-authority tier) — per D-004, these are two different axes and must not be conflated.

**Repos**: `forsa-os` only.
**Depends on**: nothing (D-004 already resolved).
**Complexity**: **Medium-High**. Not individually hard, but it's the one milestone every other milestone reads from — a modeling mistake here (e.g., getting the membership-status ratchet direction wrong, or under-scoping the digital pass table for wallet fields later) cascades into rework across M1–M9. Budget real design review time here specifically, even though the SQL itself is simple.
**Risk**: none of the new tables need backfill (no live production data yet), which meaningfully de-risks this migration — it's additive-only, no data migration logic required.

### M1 — Membership Request → Bronze issuance (T-203, T-204)
**Delivers**: the first true end-to-end vertical slice of the new model — public visitor → staff-approved Bronze member with a real login.
- `POST /membership-requests` (`@Public()`, `forsa-os`) — validated, minimal fields only, no guarantor/financial documents at this stage
- Admin Dashboard "Membership Queue" — replaces the existing empty placeholder page (`src/pages/pending/MembershipQueuePage.tsx`, scaffolded in Phase 1) with real list/approve/reject actions
- On approval: provisions `students` row, `users` row (email a set-password link — do not invent a password), `membership_status='bronze'`, `forsa_id`, triggers Digital Pass generation (M2). This **supersedes** the Phase-1-era `POST /students/register`/`POST /guarantors/register` (per D-001 — those were deliberately built minimal/reversible specifically for this handoff)

**Repos**: `forsa-os`, `forsa-dashboard`.
**Depends on**: M0.
**Complexity**: **Medium**. Standard CRUD + approval workflow + provisioning transaction. The main subtlety is the provisioning transaction itself (students + users + FORSA ID all-or-nothing) — reuse the pattern already proven in T-101/T-102's `registerSelf`.
**Recommendation**: build this milestone first among the membership-lifecycle work — it's the smallest slice that exercises the whole new data model end-to-end, surfacing any M0 modeling mistakes while they're still cheap to fix.

### M2 — Digital Student Pass (T-205, T-206)
**Delivers**: pass generation + public QR verification.
- Pass content: FORSA logo, student name, FORSA ID, member-since date, membership level, university, academic year, QR code
- `GET /pass/verify/:token` (`@Public()`) — live status check (valid/level/expired), not a static payload
- Student portal: pass display page
- Admin Dashboard: pass admin view (reissue/revoke)

**Repos**: `forsa-os`, `forsa-student`, `forsa-dashboard`.
**Depends on**: M0 (table), M1 (needs a Bronze member to generate a pass for).
**Complexity**: **Medium**. QR generation is a well-understood library integration (no novel design); the "generate-once, update-status-only" constraint from T-205 is the one thing to get right structurally — do not let pass regeneration become implicit anywhere (e.g., don't regenerate on every profile edit).
**Can run in parallel with**: M3 (different repos/surface area, no shared files).

### M3 — Financing-request gating & document requirements (T-207, T-208, T-209)
**Delivers**: financing request flow gated behind active membership, plus real document-freshness enforcement.
- Gate: `applications` creation now requires `students.membership_status IN ('bronze','silver','gold')` — a Visitor with no membership cannot reach it
- Student documents: identity, address, university documents, tuition, academic records
- Guarantor documents: identity, employment certificate, payslips, last 3 bank statements, existing loans/commitments — **all must be current**

**Repos**: `forsa-os`, `forsa-student`, `forsa-guarantor`.
**Depends on**: M1 (needs membership to gate against).
**Complexity**: **Medium**, with one confirmed scope surprise (see risk below).
**Risk — confirmed schema gap**: `MASTER_TASK_LIST.md`'s T-209 description says to "leverage `document_types.expiry`-tracking already scaffolded per spec §8." **This does not exist.** Checked the live schema directly: `document_types` has no validity/expiry column at all (`code, display_name, category, description, is_required, is_active` only), and `documents` has no `expires_at` either. The spec's §8 text describes seed *intent*, not a built column. This milestone therefore needs its own small migration (`008_document_freshness.sql`: `document_types.validity_months` + `documents.expires_at`, computed at upload time) — budget for this as new schema work, not a "wire up existing tracking" task.

### M4 — AI philosophy & Household Stability scoring (T-211; T-210 model-string half and K-18 already closed)
**Delivers**: the new primary AI-advisory evaluation dimension (35% Household Stability / 25% Financial Capacity / 20% Academic Commitment / 10% Documentation Quality / 10% Interview), strictly advisory — never auto-sets an approval outcome.

**Repos**: `forsa-os` (`src/ai/`, `src/score/`), `forsa-student` (interview flow already built in K-18's fix — extend, don't rebuild).
**Depends on**: nothing structurally (independent of M0–M3), but **is blocked on two open decisions that must be resolved before writing code**:
- **D-003 (OPEN)**: do the 35/25/20/10/10 weights live in the (currently 100% inert) Policy Engine, or are they hardcoded like every other threshold today? Policy Engine adds real scope — at least one live `policy_versions` row plus an approval step.
- **D-008 (OPEN)**: is Household Stability a genuinely separate system from the existing 5-dimension FORSA Score engine (`payment_reliability` 0.40 / `documentation_reliability` 0.20 / `communication_reliability` 0.15 / `academic_continuity` 0.15 / `guarantor_reliability` 0.10), or does one replace the other? Current leaning in `DECISIONS.md` is "two separate systems, not a replacement" — but this has not been explicitly confirmed by the user, and building T-211 on the wrong reading is exactly the kind of rework this plan exists to prevent.

**Complexity**: **Medium-High** — the scoring logic itself is simple arithmetic; the complexity is in getting the *design* right before coding, per the two open decisions above.
**Recommended storage**: extend the existing `applications.ai_report` JSONB blob with the new fields rather than adding 9 new columns — this matches the pattern already used for the K-18 `demo_mode` flag, keeps the migration surface small, and the dashboard's `RankingPage` already parses this JSON client-side today.
**Hard gate**: do not start this milestone's code until D-003 and D-008 are explicitly answered — flagging this as the plan's single most important open item (see §3).

### M5 — Human decision outcomes, CEO override, risk rules (T-213, T-214 remainder, T-215)
**Delivers**: the full outcome set and the remaining control-tightening work around it.
- Full outcome set: Bronze, Silver, Gold, Waiting List, More Information Required, Financing Not Approved At This Time, Fraud — **Waiting List must never mean "rejected because capital is exhausted"**; reconcile with (not duplicate) the existing `capital_queue` soft-block mechanism (Pipeline Stage 6) — same underlying concept, correct user-facing name
- CEO-sole-override role: confirmed via schema check that no such role/permission exists today (only a generic `report.ceo` reporting permission) — this is genuinely new: a scoped permission (e.g. `financing.override`) restricted to a CEO-designated role, layered on top of the already-fixed (K-12) dual/executive-approver gate, not replacing it
- Risk rules: max 10% of available capital in high-risk exposure; max exposure per family (**the spec never defines what "family" means here** — shared guarantor? shared national-ID? shared household address? this needs a decision before the rule can be written, not an assumption); returning members get priority; first-year students treated as higher risk by default. Reconcile with the existing 40%-portfolio university-concentration cap (Stage 6) — these are different exposure axes and both must hold simultaneously

**Repos**: `forsa-os` (`src/pipeline/`, `src/auth/` permissions), `forsa-dashboard` (review UI, override action).
**Depends on**: M0 (status model), M4 (Household Stability output feeds the human decision).
**Complexity**: **High** — this is the single most business-logic-dense milestone, touching pipeline Stages 4/6/7/8/9 again on top of the K-12 fix already landed, plus a genuinely new permissions concept (CEO override).
**Open sub-decision to resolve before starting**: definition of "family" for the per-family exposure cap.

### M6 — Renewal (T-216)
**Delivers**: every financing period requires a brand-new financing request; returning members get priority, updated documents, and FORSA Score as a real input to the renewal decision (not just displayed).
**Repos**: `forsa-os`.
**Depends on**: M4/M5 (needs the Household-Stability-vs-FORSA-Score relationship resolved — D-008 — since renewal is exactly where both systems' outputs meet), M0 (`is_renewal`/`previous_application_id` chaining already exists in schema, reused as-is).
**Complexity**: **Low-Medium** — mostly wiring an existing chaining mechanism to a real decision input; the hard part (D-008) is resolved upstream in M4, not duplicated here.

### M7 — Fraud & blacklist (T-217)
**Delivers**: permanent blacklist + internal fraud record on confirmed fraud, blocking all future membership/financing requests for that identity.
- New table (part of `007_membership_lifecycle.sql` or a dedicated `008_fraud_records.sql`): `fraud_records` (hashed matching key, reason, evidence references, blacklisted_at)
- **Matching key decision needed**: `students.national_id_reference` today is stored *encrypted* (per the schema comment), not hashed — encryption alone does not support exact-match blacklist lookups unless it's deterministic. This milestone needs a separate deterministic hash column (e.g., HMAC-SHA256 of the normalized national ID with a server-side secret) purpose-built for blacklist matching, distinct from the existing encrypted-storage column. This is new design work, not a reuse of an existing field.

**Repos**: `forsa-os`, `forsa-dashboard` (Fraud Records admin section).
**Depends on**: M0 (blacklist status value on `membership_status`).
**Complexity**: **Medium** — the blacklist-enforcement logic itself is simple; the hashing/matching-key design is the part that needs care (get it wrong and either miss real matches or, worse, create false-positive collisions blocking an innocent applicant).
**Can run in parallel with**: M4, M5, M6 — genuinely independent of the AI/scoring/renewal work, only needs M0.

### M8 — Payment system remainder (T-218 remainder = K-13, T-219) — ✅ DONE 2026-07-05
**Delivered**: Konnect confirmations now fire a FORSA Score event, matching the manual-verification path. Student dashboard now shows complete end-to-end payment history via a new self-scoped `GET /students/me/payments`, rendered independently of whether a *current* schedule exists (important for renewed students between financing periods). **Bonus find**: fixed a live, silently-swallowed bug where `recordedBy: 'system'` was inserted into a `UUID` column (`score_events.recorded_by`), throwing on every automated score event including the pre-existing daily overdue-installment cron job — `PAYMENT_OVERDUE` events were never actually being recorded before this fix. 60/60 backend tests passing (2 new: `konnect.service.spec.ts`, new `students.service.spec.ts`).
**Repos**: `forsa-os` (`konnect.service.ts`, `score.service.ts`, `payments.service.ts`, `students.service.ts`/`students.controller.ts`, `guarantors.module.ts` — removed a redundant `KonnectService` provider redeclaration that would have broken DI resolution for the new dependency), `forsa-student` (`PaymentsPage.tsx`, `lib/api.ts`).
**Complexity**: **Low**, as predicted — no schema changes needed, reused existing query logic and permission patterns throughout.

### M9 — Frontend rebuilds (T-219 covered above; T-220 remainder, T-221 remainder, T-222, T-223, T-224)
**Delivers**: real functionality behind the Phase-1 nav scaffolding, portal by portal.
- **`forsa-student`** (T-220 remainder): wire the still-stubbed Membership Status/FORSA ID/Digital Pass tiles on the home page to real data — depends on M1/M2.
- **`forsa-dashboard`** (T-221 remainder): real functionality behind the 6 net-new nav sections (Membership Queue → M1, Financing Queue, AI Queue → M4, Waiting List → M5, Digital Pass admin → M2, Fraud Records → M7) — each sub-page's real dependency is its corresponding backend milestone, not one monolithic dashboard task.
- **`forsa-finance`** (T-222): payment verification/receipts/Konnect/ledger/late-payments/exports actually working (currently several stubs — `DisbursementsPage` placeholder, non-functional "view receipt" button, raw-JSON export) — depends on M8, otherwise independent.
- **`forsa-university`** (T-223): student/tuition/enrollment confirmation actions — a deliberate, narrow new write capability (today 100% read-only) — depends on M0's `university_confirmed` status value.
- **`forsa-partner`** (T-224): "partner sees only their own data" as a standing rule for every new partner-scoped feature from here on (the specific T-103 bug is already fixed) — mostly a review/audit task applied to whatever new partner-facing surface Phase 2 adds, low incremental work.

**Repos**: all 5 frontends except `forsa-guarantor` (guarantor work is covered under M3).
**Depends on**: varies per portal, as noted above — **this is the one milestone where true parallelization across repos is real and safe** (6 independent git repos, zero merge risk), but each portal's specific slice can only start once its corresponding backend milestone has landed.
**Complexity**: **Medium overall, Low per portal** — no single portal's remaining work is large; the size is in the count of portals, not the depth of any one.

### M10 — Notifications (T-225)
**Delivers**: real event-driven notifications for membership submitted, Bronze granted, Digital Pass ready, financing started, missing documents, AI interview scheduled/ready, Waiting List, Silver/Gold approved, payment received/overdue.
**Repos**: `forsa-os` (mostly — reuses the `NotificationsService`/template plumbing already wired in Phase 1's T-106).
**Depends on**: each event source existing (Bronze granted needs M1, Digital Pass ready needs M2, Silver/Gold approved needs M5, etc).
**Complexity**: **Low-Medium**, but **do not treat this as one terminal end-of-phase task** — see §5's reordering recommendation. Phase 1 already had to do a catch-up pass (T-106) specifically because notifications got left for "later" and nearly didn't happen; the same failure mode is avoidable this time by wiring each notification at the moment its trigger event is built, not batching all 11 at the end.

### M11 — Legal copy (T-226)
**Delivers**: Terms of Use, Privacy Policy, Membership Terms, Financing Terms, AI Consent, Guarantor Terms, Payment Terms, Fraud Policy — rewritten for the membership-first model.
**Repos**: none (content, not code) — likely surfaces as static content/CMS entries across the relevant frontends once written.
**Depends on**: nothing technical.
**Complexity**: **N/A (content task)** — flagged explicitly as needing legal/compliance sign-off from whoever owns that review, not an engineering estimate. Can start immediately, in parallel with everything else, and does not block or get blocked by any other milestone.

---

## 2. Cross-cutting schema summary

New migrations, in dependency order:
1. **`007_membership_lifecycle.sql`** (M0) — `membership_requests`, `students.membership_status` + `membership_status_history`, `students.forsa_id`/`member_since`, `digital_student_passes`, `applications.financing_tier`
2. **`008_document_freshness.sql`** (M3) — `document_types.validity_months`, `documents.expires_at` (confirmed genuinely new — not pre-existing despite the task description's assumption)
3. **`009_fraud_records.sql`** (M7) — `fraud_records` table with a purpose-built deterministic hash column for blacklist matching (distinct from the existing encrypted `national_id_reference`)

No migration needed for: status vocabulary unification (app-layer enum extension only — `applications.current_status` is `VARCHAR`, not a native enum), Household Stability scoring (recommended to live in the existing `ai_report` JSONB blob), CEO override (permissions/roles tables already exist generically — this is a seed-data change, not schema), risk-rule enforcement (query logic against existing tables, pending the "family" definition decision).

---

## 3. Decisions — RESOLVED 2026-07-05

All three decisions below are now resolved. Full text in `DECISIONS.md`.

1. **D-003 — RESOLVED: hardcoded weights for V1, centralized.** 35% Household Stability / 25% Financial Capacity / 20% Academic Commitment / 10% Documentation Quality / 10% AI Interview Assessment. Kept in one named module/config object (not inlined at each call site) so a future Policy Engine migration is a swap of one lookup, not a refactor.
2. **D-008 — RESOLVED: permanently separate, not just for V1.** Household Stability = pre-financing dossier assessment (AI-advisory, per financing request). FORSA Score = post-financing behavioral trust (per student, from payment history). May be displayed together in the Admin Dashboard review UI; never merged into one stored value or one computation.
3. **D-010 (new) — RESOLVED: family/household = student + primary guarantor.** Extended family excluded unless legally/financially responsible (i.e., unless they're themselves a registered guarantor). Per-family exposure cap = sum of exposure grouped by `student_guarantors.guarantor_id` (the `role='primary'` link, which already exists in the schema — no new table needed), not per-student alone.

Combined with the already-decided D-001, D-002, D-004, D-007, D-009 — **every
decision gating Phase 2 is now closed.**

---

## 4. API contract changes (high level)

**New public endpoints**: `POST /membership-requests`, `GET /pass/verify/:token`.
**New staff endpoints**: membership queue approve/reject, fraud record CRUD, CEO-override action on a pipeline run.
**Changed application-status values**: several dead V2-dashboard enum values retired, several genuine new ones added (§ M0) — since the retired values were confirmed dead code (never actually reachable — `STATUS_TRANSITIONS`' allow-list already rejects them, per the T-107 Phase 1 finding), this is not a breaking change for any real caller.
**Changed request bodies**: `applications` creation now requires an active membership check server-side (a new 403 case, not a shape change); document upload flows gain freshness metadata.
**No breaking changes** to any existing response shape for a currently-working endpoint.

---

## 5. Recommended execution sequence (with reordering rationale)

A naive read of `MASTER_TASK_LIST.md` top-to-bottom (T-201 → T-226) would start
Household Stability scoring (T-210/T-211) well before the membership data
model even exists, and would treat Notifications (T-225) as a single
end-of-phase task. Both would increase rework risk. Recommended order:

1. **M0** (data model) — must be first, everything reads from it.
2. **M8** (payment remainder) **in parallel with M0** — fully independent, zero schema dependency, good warm-up that de-risks nothing but also risks nothing.
3. **M1** (Membership Request → Bronze) — smallest full vertical slice through the new model; validates M0's design before more gets built on top of it.
4. **M2 + M3 in parallel** — different repos/surface area (M2: pass generation + student/dashboard display; M3: document gating + guarantor/student uploads), both depend only on M1, no shared files between them.
5. **Resolve D-003, D-008, and the "family" definition now** — before any code in M4/M5 starts, not concurrently with it.
6. **M4** (AI/Household Stability) — once the decisions above are answered.
7. **M5 (human decision outcomes/CEO override/risk rules) and M7 (fraud/blacklist) in parallel** — M5 depends on M4's output; M7 only depends on M0 and has no real coupling to M4/M5, so it does not need to wait for M4 to finish.
8. **M6** (renewal) — after M4/M5, since it consumes both Household Stability and the full decision-outcome set.
9. **M9** (frontend rebuilds) — start each portal's slice as soon as its corresponding backend milestone lands, rather than waiting for all of Phase 2's backend work to finish; genuinely parallelize across the 5 portal repos once unblocked.
10. **M10 (notifications) — woven incrementally into M1/M2/M3/M5/M8 as each trigger event is built, not scheduled as a discrete step at the end.** This is the one explicit reordering with a documented reason: Phase 1 already needed a dedicated catch-up task (T-106) because notifications were deferred to "later" and nearly shipped unwired. Wiring each notification the same session its trigger event lands costs almost nothing extra and removes an entire class of end-of-phase scramble.
11. **M11** (legal copy) — start immediately, runs the whole time in parallel on a separate, non-engineering track.

---

## 5a. User-approved execution order — SUPERSEDES §5 (2026-07-05)

The user reviewed §5 and approved proceeding with a slightly different
sequencing, splitting M1's original scope (Membership Request → Bronze →
FORSA ID) into three distinct, separately-landed steps rather than one
combined milestone, and folding M6 (renewal)/M7 (fraud) into the later
portal/decision-flow steps rather than calling them out as standalone
parallel tracks. This is the order actually being executed:

1. **Payment cleanup warm-up** (M8: K-13 Konnect score event, T-219 payment history) — if still needed; check current state first rather than assuming.
2. **Membership Request → Bronze** (M0 schema + the request/approval/provisioning half of M1) — public intake endpoint, Admin Dashboard Membership Queue, Bronze status + real `users` row provisioning on approval.
3. **FORSA ID** (the remaining half of M1) — real ID generation/assignment logic, wired into the Bronze approval flow landed in step 2.
4. **Digital Student Pass** (M2) — generation + QR verification.
5. **Financing Request** (M3) — membership gate on `applications` creation, student/guarantor document requirements + freshness.
6. **Household Stability / AI Review** (M4) — using the D-003/D-008-resolved weights and separation.
7. **Admin decision flow** (M5 + M7 folded together) — full outcome set, CEO override, risk rules (including the D-010-resolved per-family cap), fraud/blacklist enforcement.
8. **Remaining portal updates** (M9 + M6 folded together) — Finance/University/Partner remaining work, Renewal.

**Notifications (M10) remain incremental** — wire each one as its trigger event lands in the step above that builds it, per §5's original rationale (not repeated here, still holds).

**Docs are updated after every milestone, not batched at the end** — per the user's explicit instruction. Continue through the list without stopping for approval unless a genuine new business decision (not an implementation detail) is discovered.

---

## 6. Technical risks before implementation begins

1. **`forsa-os` is a shared bottleneck.** Unlike Phase 1's frontend work (6 independent repos, zero merge risk), M0/M1/M3/M4/M5/M6/M7/M8 all touch the same backend repo. True parallelization here risks merge conflicts and interleaved half-finished migrations in a way Phase 1 never had to deal with. Recommendation: sequence backend-touching milestones seriously (per §5's ordering), and only genuinely parallelize the frontend-only pieces (M9) across the 6 portal repos once each one's backend dependency has landed. Do not attempt to run M4 and M5 as literally concurrent backend workstreans against the same repo, even though they're conceptually separable — sequence them.
2. **Two open product decisions (D-003, D-008) plus one undefined term ("family," T-215) directly gate the highest-complexity milestones (M4, M5).** Starting code before these are answered is the single highest-probability source of rework in this entire plan — higher than any schema risk.
3. **The T-209 "expiry tracking already scaffolded" assumption is wrong.** Confirmed directly against the live schema — no such column exists on `document_types` or `documents`. Anyone picking up M3 needs to budget the small extra migration (`008_document_freshness.sql`), not assume it's a pure wiring task.
4. **The blacklist matching-key problem (M7) is a real design problem, not a lookup.** `national_id_reference` is stored encrypted, not hashed — encryption alone doesn't support exact-match blacklist queries unless deterministic. Get this wrong and the system either fails to catch a repeat fraud attempt (false negative) or blocks an innocent applicant on a hash collision (false positive) — this needs explicit design attention, not a quick column add.
5. **CEO-override (M5) is a genuinely new permissions concept**, not an extension of an existing one — confirmed no such role exists today (only a generic `report.ceo` reporting permission). Design it as a distinct, narrowly-scoped permission layered on top of the K-12 dual-approver gate, not a bypass of it — a CEO override that silently skips the multi-approver control would reopen the exact vulnerability K-12 just closed.
6. **Status-vocabulary retirement is lower-risk than it looks.** The V2-dashboard values being retired (`applied`, `internal_review`, etc.) were confirmed dead in the Phase 1 audit — `STATUS_TRANSITIONS`'s allow-list already rejects them. This means M0's enum change, while conceptually large, has no real migration/backfill risk attached to it.
7. **No live production data exists yet.** Every new table in this plan is additive-only with no backfill requirement — this is a meaningfully lower-risk environment than a typical schema-change project, and it will not stay this way once Phase 2 ships and real membership requests start arriving. Any schema mistake caught *after* that point becomes a real migration problem instead of a free edit.

---

## 7. What this plan deliberately does not do

- Does not write any Phase 2 code — this is a planning document only, per instruction.
- Does not fabricate calendar-time estimates — complexity is rated qualitatively (Low/Medium/High) against confirmed schema/design facts, not guessed day-counts.
- Does not resolve D-003/D-008/the "family" definition on your behalf — those are flagged, not decided, because they're product calls this plan cannot make for you.
