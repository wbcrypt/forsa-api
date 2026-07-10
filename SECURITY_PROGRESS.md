# FORSA OS — Security Progress Log

Tracks security-relevant findings from the 2026-07-10 ESLint-cleanup follow-up
review and their disposition. See `DECISION_LOG.md` for the reasoning behind
each call, and `docs/SECURITY_CHECKLIST.md` for the broader pre-launch
checklist this feeds into.

## Context

An ESLint cleanup (87 lint errors, first working `.eslintrc.js` this repo
has had) surfaced several unused-variable findings that turned out to be
symptoms of real gaps rather than dead code. Per instruction, those three
were not left as "flagged and ignored" — each was investigated against the
actual schema/business rules and either fixed or explicitly recorded as a
product decision.

## Findings and disposition

### 1. Partner dashboard visibility (`max_visible_information`) — recorded as product decision, not implemented

- **Investigated**: whether `partner_agreements.max_visible_information`
  (JSONB "permission ceiling") is supposed to restrict
  `PartnersService.getPartnerDashboard`'s response.
- **Finding**: fetched, never applied. No blueprint (doc, DTO, type) defines
  its shape anywhere in the codebase.
- **Action**: not implemented — inventing a filtering scheme without a
  defined shape would be guessing, not implementing. The current response
  already matches Operations Manual §7's independently-documented
  partner-visibility spec. Comment in `partners.service.ts` corrected to
  stop claiming a restriction that doesn't happen; full writeup in
  `DECISION_LOG.md` D-SEC-001, including which other partner-facing
  endpoints (`getMyApplications`, `getMyCommissions`) would also need
  gating once the shape is defined.
- **Status**: `OPEN` — needs a product decision before implementation.

### 2. Manual payment overpayment — fixed

- **Investigated**: `PaymentsService.recordPayment` and `verifyPayment`
  against Operations Manual §8/§9's documented payment/installment status
  machines, to check whether overpayment/credit-balance is a supported
  concept.
- **Finding**: it isn't — no status exists for it in either state machine.
  Both methods computed a remaining-balance figure and never checked it.
- **Action**: added a server-side guard to both methods (the two write
  paths onto `installments.amount_paid`) rejecting any amount that exceeds
  the remaining balance, `BadRequestException`, before any row is written.
- **Tests**: `src/payments/payments.service.spec.ts` — exact-balance,
  partial-payment, and excessive-payment cases for both `recordPayment` and
  `verifyPayment` (7 new tests total).
- **Status**: `DECIDED`/fixed. See `DECISION_LOG.md` D-SEC-002.

### 3. Unused tenant parameters — reviewed individually, two enforced (one a confirmed IDOR), one enforced defensively

No RLS exists in this schema yet (confirmed: no `CREATE POLICY` /
`ENABLE ROW LEVEL SECURITY` in any migration; `docs/SECURITY_CHECKLIST.md`
lists RLS as a pre-launch item, not yet done). Tenant isolation today is
entirely query-scoping at the application layer, so each flagged parameter
was checked against the actual query and call sites rather than assumed
safe.

- **`UsersService.getUserRolesAndPermissions`** — **confirmed exploitable
  cross-tenant IDOR.** `GET /users/:id/roles` passes a client-supplied `:id`
  directly into a query with no tenant filter; staff in tenant A could read
  tenant B's user's roles/permissions. Fixed: `findOne(userId, tenantId)`
  ownership check added, plus `tenant_id` filter on both underlying
  queries. Cross-tenant test added (new file:
  `src/users/users.service.spec.ts`).
- **`AuthService.getUserPermissions`** — same unscoped query shape; not
  independently reachable with a mismatched tenant today (both call sites
  pass a self-consistent pair), but fixed the same way for consistency and
  to close the gap before the pattern gets reused elsewhere. Test added in
  `src/auth/auth.service.spec.ts`.
- **`ScoreService.checkAndUpdateCeiling`** — `student_id` is a globally
  unique key, so no real cross-tenant leak was possible via this specific
  query; caller (`recordCorrectiveEvent`) also isn't wired to any
  controller yet. Enforced anyway (`score_events.tenant_id` is `NOT NULL`
  and clearly meant to be checked). Test added in
  `src/score/score.service.spec.ts`.
- **Status**: `DECIDED`/fixed, all three. See `DECISION_LOG.md` D-SEC-003
  for full per-case reasoning.

## Verification performed

- `npm run lint` — clean (0 errors)
- `npm run typecheck` (`tsc --noEmit`) — clean
- `npm test` (jest) — 212/212 passing (was 199 before this follow-up; +13
  new tests: 7 overpayment-guard, 6 tenant-scope)
- `npm run build` (`nest build`) — succeeds

See `TEST_RESULTS.md` for the full run detail.

## Outstanding

- D-SEC-001 (partner visibility scheme) is an open product decision, not a
  bug — no code action pending until product defines the shape.
- Not in scope for this pass (noted, not investigated further): Konnect's
  own webhook-driven balance update path in `konnect.service.ts` mirrors
  similar payment-confirmation logic to `verifyPayment` but wasn't reviewed
  for the same overpayment guard — worth a follow-up look given the
  Operations Manual already flags Konnect as "exists, unverified" pending
  real sandbox credentials.
