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

### M0 — Data model & status unification (T-201, T-202) — ✅ PARTIALLY DONE 2026-07-05 (membership records only)
**Delivered**: `migrations/007_membership_lifecycle.sql` — `membership_requests`, `students.membership_status`/`member_since`/`forsa_id`, append-only `membership_status_history`, `password_setup_tokens` (D-001's set-password mechanism). **Verified by actually running the full 001-007 migration chain against a real local Postgres instance**, not just reviewed by eye — confirmed clean apply and exact schema match against the service code.
**Deliberately NOT done in this pass** (scoped out to their own milestones, not forgotten): `digital_student_passes` table (M2 — Digital Student Pass), fraud/blacklist table (M7), waiting-list table (reuses `capital_queue`, M5/M7), the `ApplicationStatus` enum's dead-V2-vocabulary retirement, `applications.financing_tier` column. Rationale: none of these block Membership Request → Bronze specifically, and adding schema for a feature before the milestone that uses it lands risks unused/speculative columns.
**Repos**: `forsa-os` only.
**Complexity actual**: **Medium**, matching the estimate — the SQL itself was simple; the real time went into deciding what belonged in this migration vs. deferred to later ones.

### M1 — Membership Request → Bronze issuance (T-203, T-204) — ✅ DONE 2026-07-05
**Delivered**: `POST /membership-requests` (`@Public()`) via new `src/membership/` module; Admin Dashboard Membership Queue (was an empty placeholder, now real list/approve/reject); on approval, provisions `students` + `users` transactionally, sets Bronze + `member_since`, emails a set-password link per D-001 (new `POST /auth/set-password` + `password_setup_tokens`, mirroring the existing session-token-hash convention — never stores the raw token). `forsa-student` gained `/join` (now the primary "no account?" link from `/login`, superseding `/register` per D-004 without removing it) and `/set-password`. Also added a genuinely public `GET /universities/public` — a gap the original task description didn't anticipate (the anonymous form needs a university picker; the existing university list route is staff-only). 8 new tests, 68/68 total passing.
**FORSA ID generation — ✅ done same-session as a follow-up** (`FORSA-<year>-<6 hex chars>`, generated in `MembershipService.approve()`, pre-transaction uniqueness check rather than a mid-transaction retry — a failed INSERT would otherwise abort the whole Postgres transaction). **Digital Student Pass remains the one deferred item** — its own milestone (M2) below.
**Repos**: `forsa-os`, `forsa-dashboard`, `forsa-student`.
**Complexity actual**: **Medium**, matching the estimate.

### M2 — Digital Student Pass (T-205, T-206) — ✅ DONE 2026-07-05
**Delivered**: new migration `008_digital_student_pass.sql` (`digital_student_passes`, one row per student, `UNIQUE(student_id)`, nullable wallet-provider columns reserved unused). `DigitalPassService.issueForStudentTx()` is called *inside* `MembershipService.approve()`'s existing transaction — a Bronze member can never exist without a pass. `GET /pass/verify/:token` (`@Public()`) is a genuinely live check every call (both pass-row status and current student membership status — a blacklist invalidates the pass immediately without a separate revoke action). QR code generated server-side via the `qrcode` package (already a dependency, used for MFA setup) as a data URL — no new frontend dependency. `forsa-student` gained `/pass` (full display, linked from a top-bar icon matching the existing Notifications-icon convention); `forsa-dashboard`'s `DigitalPassPage.tsx` (was an empty placeholder) now has real list + revoke. University/academic year read live via a join to the student's originating `membership_requests` row rather than denormalized onto the pass — one source of truth. 8 new tests, 78/78 backend tests passing. Verified by actually running the migration against a real local Postgres instance.
**Repos**: `forsa-os`, `forsa-student`, `forsa-dashboard`.
**Complexity actual**: **Medium**, matching the estimate.
**Note**: checked whether this could also resolve T-509 (replace `api.qrserver.com`, a Post-Launch item) — it doesn't; that third-party call lives in `forsa-partner`'s referral-link QR feature, genuinely unrelated to this milestone. The fix pattern is proven out and directly reusable there if picked up later.
**Can run in parallel with**: M3 (different repos/surface area, no shared files).

### M3 — Financing-request gating & document requirements (T-207, T-208, T-209) — ✅ DONE 2026-07-05
**Delivered — and scope grew significantly beyond the original estimate** once actually wiring the gate surfaced that the entire student-facing Financing Request submission flow was already broken, independent of membership at all:
1. `POST /applications` requires a staff-only `application.create` permission that no self-registered student account ever holds (no role is ever assigned at registration) — every real student call would 403.
2. `InterviewPage.tsx`'s submission payload never sent `studentId` at all (would violate the `NOT NULL` constraint).
3. `NewApplicationPage.tsx` *did* send one, but it was `user!.id` (the auth user row) instead of the actual `students.id` — a different UUID, would violate the FK constraint.
4. `applications.ai_score_overall`/`ai_recommendation`/`ai_report`/`interview_language`/`interview_transcript` — referenced by `seed-demo.ts` and the K-18 fix's frontend payload — had never actually been migrated, so AI interview data was silently discarded on every submission, gate or no gate.

None of this had ever been exercised end-to-end before. Fixed by adding a new self-scoped `POST /applications/me` (resolves the student via JWT identity, never a client-supplied one — same pattern as every other `me`-scoped route this phase has built) that both fixes (1)-(3) and implements the actual T-207 gate (`membership_status IN ('bronze','silver','gold')` required). New migration `009_financing_request.sql` adds the missing AI columns plus (T-208/T-209) `document_types.validity_months`/`documents.expires_at` — confirmed directly against the live schema that the "already scaffolded" expiry tracking this task's own description assumed does not exist. `DocumentsService.confirmUpload()` computes a real expiry at upload time; `PipelineService.stage1Completeness`'s document query now excludes expired documents from satisfying a requirement even if still marked `verified`. Also fixed `InterviewPage.tsx`'s submission error handling, which used to silently swallow any failure (including the new 403) and show a false success screen — now shows a real error state directing the user to `/join`.
**Repos**: `forsa-os`, `forsa-student`. (`forsa-guarantor` document-freshness UI not touched this pass — the enforcement lives entirely in the shared pipeline completeness check, which already covers guarantor-linked documents the same way.)
**Complexity actual**: ended up **Medium-High**, not the originally-estimated Medium — the unplanned discovery of a fully broken pre-existing flow was the majority of the real work here, not the gate itself.

### M4 — AI philosophy & Household Stability scoring (T-211; T-210 model-string half and K-18 already closed) — ✅ DONE 2026-07-05
**Delivered**: new `src/ai/household-stability.util.ts` — `HOUSEHOLD_STABILITY_WEIGHTS` (the approved D-003 split: 35/25/20/10/10) plus a pure `computeHouseholdStabilityScore()`, every call site reading from this one module. Storage matches the original recommendation exactly: the existing `applications.ai_report` JSONB blob (no new columns for the per-dimension scores themselves — only the already-added `ai_score_overall`/`ai_recommendation` from M3's migration 009 store the computed results).
**Went beyond the original scope in one necessary way**: `ai_score_overall`/`ai_recommendation` used to be stored directly from whatever the client sent, with zero server-side validation — a real trust gap, independent of D-003 but impossible to ignore once building the actual weighted-scoring function. `ApplicationsService.create()` now recomputes the score deterministically from `aiReport.scores` and derives the recommendation from fixed thresholds on that same score — never trusting a client-supplied combined figure, or the LLM's own self-reported "overall," either way (LLMs are unreliable at precise weighted arithmetic).
`forsa-student/InterviewPage.tsx`'s scoring prompt now requests the 5 canonical dimension names instead of the old, informally-named set (educational_readiness/financial_readiness/planning_readiness/commitment_readiness/interview_quality) — a consequence of this rename also required fixing `forsa-dashboard`'s `RankingPage.tsx`, which would otherwise have silently shown blank scores for every new interview submitted after this change.
**D-008 boundary respected and verified**: only `applications.ai_report`/`ai_score_overall` are touched — `src/score/score.service.ts` (the separate, ongoing FORSA Score engine) was not modified at all.
**Repos**: `forsa-os`, `forsa-student`, `forsa-dashboard` (the last one wasn't in the original plan — added once the dimension rename's downstream impact was traced).
**Complexity actual**: **Medium-High**, matching the estimate.

### M5 — Human decision outcomes, CEO override, risk rules (T-213, T-214 remainder, T-215) — ✅ DONE 2026-07-05 (T-215's two hard caps; priority/first-year-risk deferred)
**Delivered**: full outcome set (`submitHumanDecision` gained `'waiting_list'`, mapped to the existing `capital_queue` mechanism, not a parallel one — plus new `ApplicationStatus.MORE_INFO_REQUIRED`/`FRAUD_FLAGGED`, and the 6 dead V2-vocabulary enum values were finally retired since this milestone is the first real need for the replacement values). Bronze/Silver/Gold is `applications.financing_tier` (new column), set on approval and ratcheted onto `students.membership_status` in Stage 10 (upward only, per D-004). **Found and fixed a real latent bug while wiring this**: Stage 9 could already produce `DecisionResult.CAPITAL_QUEUE` but Stage 10's status-map never included it — an application soft-blocked this way never actually had its status updated.
**CEO override**: new `financing.override` permission (confirmed via schema check no such permission existed — only a generic `report.ceo` reporting one), a dedicated `overrideDecision()` method (not a branch inside `submitHumanDecision`, so the bypass can never leak into a normal decision), always flags `reviewer_decisions.is_override = true` and writes a distinct `pipeline.ceo_override` audit entry.
**Risk rules — both hard caps done**: high-risk capital cap (10% default, via each deployed application's most recent risk profile, `LEFT JOIN LATERAL`, verified against real Postgres) and the D-010-resolved family exposure cap (grouped by `student_guarantors.guarantor_id` where `role='primary'`, 100,000 TND default) — both live in Stage 6 alongside the existing university-concentration cap, three independent axes. **"Returning member priority" and "first-year higher risk" deliberately deferred** — queue-ordering/risk-scoring-input concerns, not hard caps; noted as open rather than silently dropped.
**Also built the review UI, which turned out not to exist at all**: `pipelineApi.submitDecision` existed in `forsa-dashboard` since Phase 1 but no page ever called it. New `HumanDecisionPanel` on `ApplicationDetailPage.tsx`.
**Repos**: `forsa-os`, `forsa-dashboard`.
**Complexity actual**: **High**, matching the estimate — this was the single largest milestone in the phase so far.

### D-010 (resolved during this milestone's original planning) confirmed "family" = student + primary guarantor household — implementation matches exactly.

### M6 — Renewal (T-216)
**Delivers**: every financing period requires a brand-new financing request; returning members get priority, updated documents, and FORSA Score as a real input to the renewal decision (not just displayed).
**Repos**: `forsa-os`.
**Depends on**: M4/M5 (needs the Household-Stability-vs-FORSA-Score relationship resolved — D-008 — since renewal is exactly where both systems' outputs meet), M0 (`is_renewal`/`previous_application_id` chaining already exists in schema, reused as-is).
**Complexity**: **Low-Medium** — mostly wiring an existing chaining mechanism to a real decision input; the hard part (D-008) is resolved upstream in M4, not duplicated here.

### M7 — Fraud & blacklist (T-217) — ✅ DONE 2026-07-05
**Delivered**: new `fraud_records` table (migration 010, append-only via `RULE`, matching the platform's other audit tables), a dedicated `POST /pipeline/runs/:id/fraud` (not folded into the human-decision outcome set — fraud is an identity-trust action, not a financing-amount decision, and needs its own more-restrictive `fraud.flag` permission). One transaction: fraud record + `students.membership_status = 'blacklisted'` + `FRAUD_FLAGGED` application status (terminal, no outgoing transition).
**Matching-key decision — resolved honestly, not glossed over**: the plan anticipated a national-ID-hash key, but confirmed national ID isn't captured as a structured field anywhere in the current flow (only ever an uploaded document image) — used a deterministic hash of normalized email for V1 instead (the one identity signal actually collected from Visitor onward), with the migration's own comment flagging this as a real gap to close once national ID is captured structurally earlier in intake.
**Repos**: `forsa-os`, `forsa-dashboard` (new `FraudRecordsPage.tsx`, was an empty placeholder; new `GET /pipeline/fraud-records`).
**Complexity actual**: **Medium**, matching the estimate.

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
