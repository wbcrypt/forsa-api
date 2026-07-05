# FORSA — Implementation Notes

Architecture/domain facts a cold session needs, plus the verbatim source specs
this project is built from. Don't re-derive these by re-reading the full audit
every session — come here first, then dip into
`/Users/wael/Downloads/forsa-deploy-stack-final/FORSA_PLATFORM_SPEC.md` only
for section-level detail this file doesn't cover.

---

## 1. Repo map

| Repo | Path | Role |
|---|---|---|
| `forsa-os` | `/Users/wael/Downloads/forsa-deploy-stack-final/forsa-os` | Backend — NestJS/TypeORM(mostly raw SQL)/PostgreSQL API. **This repo contains `/implementation`.** |
| `forsa-dashboard` | sibling dir | Admin/staff portal ("FORSA OS") |
| `forsa-student` | sibling dir | Student-facing portal |
| `forsa-university` | sibling dir | University portal (read-only by design, pre-Phase-2) |
| `forsa-partner` | sibling dir | Referral partner portal |
| `forsa-finance` | sibling dir | Finance/accounting portal |
| `forsa-guarantor` | sibling dir | Guarantor self-service portal |

All 6 frontend repos confirmed present and are independent git repositories
(verified 2026-07-05). None are submodules of `forsa-os`.

## 2. Backend architecture essentials

- Modular monolith, single NestJS process, `src/app.module.ts` wires ~24
  feature modules. No microservices, no message broker (uses
  `@nestjs/event-emitter` in-process pub/sub).
- Multi-tenant, single database, `tenant_id` column on every domain table.
  **No global auth guard** — guards are per-controller; a new controller that
  forgets `@UseGuards` is unauthenticated by default.
- **Only 5 TypeORM entity classes exist** (`User`, `Role`, `Permission`,
  `UserSession`, base classes). Everything else (students, applications,
  pipeline, payments, contracts, score, documents, etc.) talks to Postgres via
  raw parameterized SQL through `DataSource.query()`. Do not expect an
  entities folder to represent the schema.
- **Two schema definitions exist**: `migrations/001-004*.sql` (live, ~62
  tables) vs. `database/schema/00-08*.sql` (abandoned, ~73 tables, never
  adopted — zero of its distinguishing tables appear in application code).
  Always build against `migrations/`. See MASTER_TASK_LIST T-108/T-517.
- Redis is provisioned (env vars, docker-compose service) but **zero
  application code uses it** — no cache, no queue, no rate-limit store.
- Global `TenantInterceptor` sets a Postgres session var for RLS, but RLS
  itself was never deployed to the live schema — tenant isolation today is
  manual `WHERE tenant_id=...` filtering only, and the interceptor silently
  swallows failures.
- Password hashing: argon2id (not bcrypt, despite a `BCRYPT_ROUNDS` env var
  that's validated but never consumed).
- JWT access (15min default) + refresh (7d default), permissions baked into
  the access token at login time (not re-checked against the DB per request).
- `financing_decisions`, `audit_logs`, `security_events`, and
  `financial_ledger` are structurally append-only via Postgres `RULE`s — a
  real DB-enforced business rule, not just app-level convention. Preserve this
  pattern for any new immutable-record tables added in Phase 2 (fraud
  records, membership status history, etc.).

## 3. The 10-stage Financing Decision Pipeline (`pipeline.service.ts`)

1. Completeness Gate — 2. Eligibility Gate — 3. University & Partnership Gate
— 4. Risk Assessment — 5. Policy Evaluation — 6. Portfolio & Capital
Evaluation (→ `capital_queue` soft-block) — 7. Approval Threshold Evaluation
— 8. **Human Decision** (pauses here) — 9. Decision Generation (immutable
`financing_decisions` row) — 10. Decision Execution.

Known gap (pre-existing, must be closed by Phase 2 T-214): Stage 7 computes a
`requiredApprovers` count but Stage 8/`submitHumanDecision` never actually
checks how many reviewer decisions exist against it — a single reviewer can
finalize any decision today regardless of the dual/executive-approval
requirement the system itself computed.

## 4. FORSA Score Engine

Range 300 (min)–1000 (max), 500 default for a first-time student. Current
five dimensions/weights: `payment_reliability` 0.40,
`documentation_reliability` 0.20, `communication_reliability` 0.15,
`academic_continuity` 0.15, `guarantor_reliability` 0.10. Bands: ≥850
elite_trust, ≥700 very_good_trust, ≥580 good_trust, ≥450 medium_trust, else
high_risk. Immutable event log (`score_events`), corrections supersede rather
than mutate.

**Important**: the Phase 2 spec's "Household Stability" scoring model (35%
Household Stability / 25% Financial Capacity / 20% Academic Commitment / 10%
Documentation Quality / 10% Interview) is a **different dimension set and
weighting** than the above. These are not automatically the same system — see
`DECISIONS.md` D-008 before assuming one replaces the other.

## 5. Policy Engine

Designed to make every threshold (guarantor-required, eligibility minimums,
approval thresholds, portfolio caps, score weights) configurable at runtime,
versioned, scoped (global/country/university/partner/student/program). **In
practice it's inert**: no `policy_versions` rows are seeded/approved, and some
seeded key names don't even match what code queries for (e.g.
`score.starting_score.first_time` vs. code's `score.starting.first_time`).
Every "configurable" number today is really its hardcoded in-code fallback.

## 6. What's confirmed already fixed (per git history in this repo)

These audit-report bugs are **done** — do not re-fix, just verify they still
hold if you touch nearby code:

- `GET /payments/receipts` 500 (LIMIT/OFFSET off-by-one) — fixed commit
  `94a36b2d`.
- Guarantors controller returning 500 on every endpoint (local stub
  `CurrentUser`/`CurrentTenant` decorators shadowing real ones) — fixed
  commit `f5be99be`.
- `.env.local` accidentally committed — untracked + `.gitignore` expanded —
  fixed commit `7c6aa408`.

Full chronological detail: `CHANGELOG.md`. Everything else in the original
audit report (`AUDIT_REPORT.md`, dated 30 Jun 2026) is still open unless
`KNOWN_ISSUES.md` says otherwise.

## 7. Demo/live environment (from `AUDIT_REPORT.md`, 30 Jun 2026 — verify still current before trusting)

- API: `https://forsa-api-2ymb.onrender.com/api/v1`. Dashboard:
  `https://forsa-dashboard-ziui.onrender.com`. Other 5 portal URLs were
  unknown at audit time — check the Render dashboard.
- Tenant: `be694fc0-789a-4dec-b514-850710469c72`. Demo logins: all
  `Demo@Forsa2026` except admin (`ForsaAdmin2026`) — see `AUDIT_REPORT.md` §2
  for the full table if you need to log into the live demo.
- Known-disabled in that environment: SMTP (no emails send), Konnect API key
  (online payments error), AI (`ANTHROPIC_API_KEY` unset — interview endpoint
  errors, demo mode off).

---

## Source specs (verbatim)

### A. FORSA_PLATFORM_SPEC.md and AUDIT_REPORT.md

Not reproduced here (too large) — read directly at:
- `/Users/wael/Downloads/forsa-deploy-stack-final/FORSA_PLATFORM_SPEC.md`
- `/Users/wael/Downloads/forsa-deploy-stack-final/AUDIT_REPORT.md`

These are read-only reference documents describing the platform **as found**
before this implementation project started. Do not edit them — they're the
historical baseline. All actionable work derived from them lives in
`MASTER_TASK_LIST.md`/`KNOWN_ISSUES.md`.

### B. FORSA V1 — Master Implementation Specification (delivered 2026-07-05)

This is the authoritative forward-looking spec driving Phase 1/2/3/4 of
`MASTER_TASK_LIST.md`. Preserved verbatim below so no future session depends
on conversation memory for it.

> # FORSA V1 — MASTER IMPLEMENTATION SPECIFICATION
>
> Use FORSA_PLATFORM_SPEC.md as the baseline.
>
> Implement the following changes while preserving production quality.
>
> ## Phase 1 — Critical Engineering Fixes
>
> Complete BEFORE any redesign.
>
> * Fix student/guarantor authentication so registration creates real authentication accounts.
> * Fix partner portal identity isolation.
> * Fix Admin Dashboard payment verification endpoint.
> * Fix Konnect webhook authentication while maintaining signature verification.
> * Connect business event infrastructure to actual workflows.
> * Unify application status vocabulary.
> * Remove duplicated schema sources where appropriate.
> * Add automated testing foundation.
>
> No redesign starts before these are complete.
>
> ---
>
> ## Phase 2 — New Operating Model
>
> Replace financing-first with membership-first.
>
> Official lifecycle:
>
> Visitor
>
> ↓
>
> Membership Request
>
> ↓
>
> Bronze Membership
>
> ↓
>
> FORSA ID
>
> ↓
>
> Digital Student Pass
>
> ↓
>
> Member Dashboard
>
> ↓
>
> Complete Profile
>
> ↓
>
> Financing Eligibility
>
> ↓
>
> Financing Request
>
> ↓
>
> Documents
>
> ↓
>
> AI Interview
>
> ↓
>
> AI Assessment
>
> ↓
>
> Human Review
>
> ↓
>
> Silver / Gold
>
> ↓
>
> University Confirmation
>
> ↓
>
> Payment Plan
>
> ↓
>
> FORSA Score
>
> ↓
>
> Renewal
>
> ---
>
> ## Membership Levels
>
> Bronze
>
> * FORSA ID
> * Digital Student Pass
> * Dashboard
> * Learning ecosystem
> * Partner benefits
> * Referral eligibility
> * Future financing eligibility
>
> Silver
>
> Semester financing.
>
> Gold
>
> Academic year financing.
>
> Gold represents FORSA's highest level of trust.
>
> ---
>
> ## Digital Student Pass
>
> Generate automatically.
>
> Never recreate.
>
> Only update status.
>
> Display:
>
> * FORSA Logo
> * Student Name
> * FORSA ID
> * Member Since
> * Membership Level
> * University
> * Academic Year
> * QR Verification
> * Status
>
> Prepare architecture for future Apple Wallet / Google Wallet integration.
>
> ---
>
> ## Membership Request
>
> Simple.
>
> Collect only:
>
> * Name
> * Phone
> * Email
> * City
> * University
> * Programme
> * Academic Year
> * Current/Future Student
>
> No guarantor.
>
> No financial documents.
>
> No salary.
>
> No bank statements.
>
> After approval:
>
> Issue Bronze Membership.
>
> Issue FORSA ID.
>
> Generate Digital Student Pass.
>
> ---
>
> ## Financing Request
>
> Unlocked only after Bronze Membership.
>
> Student provides:
>
> * Identity
> * Address
> * University documents
> * Tuition
> * Academic records
>
> Guarantor provides:
>
> * Identity
> * Employment certificate
> * Payslips
> * Last 3 bank statements
> * Existing loans
> * Financial commitments
>
> All documents must be current.
>
> ---
>
> ## AI Philosophy
>
> AI advises.
>
> Humans decide.
>
> AI outputs:
>
> * Household Stability
> * Financial Capacity
> * Academic Commitment
> * Documentation Quality
> * Interview Assessment
> * Risk Level
> * Recommendation
> * Confidence
> * Executive Summary
>
> AI never approves financing.
>
> Only humans approve.
>
> CEO is the only override.
>
> ---
>
> ## Household Stability
>
> Primary evaluation philosophy.
>
> FORSA finances:
>
> Commitment.
>
> Responsibility.
>
> Stability.
>
> Not wealth.
>
> Recommended weights:
>
> 35% Household Stability
>
> 25% Financial Capacity
>
> 20% Academic Commitment
>
> 10% Documentation Quality
>
> 10% Interview
>
> A lower-income but highly stable household should outrank a wealthier but
> less responsible household when both can realistically sustain the payment
> plan.
>
> ---
>
> ## Human Decision
>
> Possible outcomes:
>
> * Bronze
> * Silver
> * Gold
> * Waiting List
> * More Information Required
> * Financing Not Approved At This Time
> * Fraud
>
> Waiting List is used when funding is unavailable.
>
> Do not reject because capital is exhausted.
>
> ---
>
> ## Risk Rules
>
> Maximum high-risk exposure:
>
> 10% of available capital.
>
> Define maximum exposure per family.
>
> Returning members receive priority.
>
> First-year students generally represent higher risk than continuing
> students.
>
> ---
>
> ## Renewal
>
> Every financing period requires a new financing request.
>
> Returning members:
>
> * Higher priority
> * Updated documents
> * FORSA Score considered
>
> ---
>
> ## Fraud
>
> Confirmed fraud results in:
>
> * Permanent blacklist
> * Internal fraud record
> * Financing permanently prohibited
>
> Examples:
>
> * Forged documents
> * False identity
> * False guarantor
> * Material misrepresentation
>
> ---
>
> ## Payment System
>
> Support:
>
> * Bank transfer
> * Cash deposit
> * Konnect online payment
>
> Common workflow:
>
> Payment
>
> ↓
>
> Verification
>
> ↓
>
> Ledger
>
> ↓
>
> Receipt
>
> ↓
>
> FORSA Score Update
>
> Student dashboard must display complete payment history.
>
> ---
>
> ## Student Dashboard
>
> Display:
>
> * Welcome
> * Membership Status
> * FORSA ID
> * Digital Student Pass
> * Profile Completion
> * Financing Status
> * Next Action
> * Payment Status
>
> Every page must reduce anxiety.
>
> ---
>
> ## Admin Dashboard
>
> Support:
>
> * Membership Queue
> * Financing Queue
> * AI Queue
> * Waiting List
> * Payments
> * Guarantors
> * Universities
> * Digital Pass
> * Fraud Records
> * Audit Trail
>
> ---
>
> ## Finance Portal
>
> Support:
>
> * Payment verification
> * Receipts
> * Konnect
> * Ledger
> * Late payments
> * Exports
>
> ---
>
> ## University Portal
>
> Support:
>
> * Student confirmation
> * Tuition confirmation
> * Enrollment confirmation
>
> University cannot change financing decisions.
>
> ---
>
> ## Partner Portal
>
> Partner only accesses their own:
>
> * Students
> * Referrals
> * Statistics
> * Commissions
>
> Never trust client-side identity.
>
> ---
>
> ## Notifications
>
> Implement event-driven notifications.
>
> Examples:
>
> * Membership submitted
> * Bronze granted
> * Digital Pass ready
> * Financing started
> * Missing documents
> * AI interview
> * Waiting List
> * Silver approved
> * Gold approved
> * Payment received
> * Payment overdue
>
> ---
>
> ## Legal
>
> Update:
>
> * Terms of Use
> * Privacy Policy
> * Membership Terms
> * Financing Terms
> * AI Consent
> * Guarantor Terms
> * Payment Terms
> * Fraud Policy
>
> All wording must reflect the new Membership-first model.
>
> ---
>
> ## Testing
>
> Run:
>
> * Backend tests
> * Frontend tests
> * API tests
> * Authentication tests
> * Permission tests
> * Payment tests
> * Konnect tests
> * Browser automation
> * Mobile
> * Desktop
> * Slow network
> * Duplicate registrations
> * Invalid files
> * Role isolation
> * Security validation
>
> Do not stop after one successful run.
>
> Attempt to break the platform.
>
> Continue fixing issues until no launch-blocking issues remain.
>
> ---
>
> ## Final Deliverables
>
> Produce:
>
> 1. Complete implementation report.
> 2. List of engineering fixes.
> 3. Browser testing report.
> 4. Security report.
> 5. Remaining technical debt.
> 6. Launch Readiness Report.
> 7. Final Go / No-Go recommendation.
>
> After completion, FORSA enters feature freeze.
>
> Only bug fixes, security fixes, compliance updates and critical UX
> improvements are allowed after this point.
