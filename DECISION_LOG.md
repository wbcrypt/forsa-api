# FORSA OS — Security/Lint Follow-up Decision Log

Decisions specific to the ESLint-cleanup security review (2026-07-10). Uses
its own `D-SEC-XXX` numbering, separate from `implementation/DECISIONS.md`'s
`D-XXX` product decisions — cross-referenced where relevant. Format matches
that log: status (`OPEN` / `DECIDED`), the question, the answer (if decided)
with rationale.

---

### D-SEC-001 — Does `max_visible_information` restrict what a partner dashboard returns? — `OPEN`

**Question**: `partner_agreements.max_visible_information` (JSONB, default
`{}`, schema comment: "permission ceiling definition") is fetched in
`PartnersService.getPartnerDashboard` but the returned value was never
applied to filter the response. Should it restrict fields, and if so, how?

**Exposure as found**: `getPartnerDashboard`/`getMyDashboard` (via
`GET /partners/:id/dashboard` and `GET /partners/me/dashboard`) always
returns `total_leads`, `accepted`, `rejected`, `paid_commission`,
`pending_commission`, `conversion_rate` for the partner's own referrals,
regardless of what `max_visible_information` contains on that partner's
active agreement. No student PII is included in this specific response.

**Why not implemented**: no document or type anywhere in the codebase
(migrations, `implementation/FORSA_OPERATIONS_MANUAL.md`,
`partners.service.ts`, the `forsa-partner` frontend) defines what keys this
JSONB column is meant to hold or how they should gate the response. There is
nothing concrete to filter by — implementing a scheme here would mean
inventing the blueprint, not implementing it.

**What the fields already match**: Operations Manual §7 ("Partner Workflow")
independently specifies partner-visible data as "referral count, approval
rate, and (once/if a commission record exists) commission amount and
status — all scoped to that partner's own referrals only." The current
`getPartnerDashboard` response satisfies that spec already, without
reference to `max_visible_information`.

**Decision needed from product**: define the intended shape of
`max_visible_information` (e.g. a field allow-list? a coarse
tier — "commission_only" vs "full"?) and which partner-facing endpoints it
should gate — likely also `getMyApplications` (returns student first/last
name, email, tuition_amount, program) and `getMyCommissions` (returns
student name), not just the dashboard stats. Until decided, the column is
inert by design (left in the query, commented, not silently dropped) rather
than gated by a guessed scheme.

**Status**: recorded as a confirmed gap, same treatment as the existing
commission-auto-trigger gap in Operations Manual §7. Not blocking — the
dashboard's current output already matches the documented spec.

---

### D-SEC-002 — Should manual/verified payments be allowed to exceed the remaining installment balance? — `DECIDED` (2026-07-10)

**Question**: `PaymentsService.recordPayment` (direct staff entry) and
`verifyPayment` (finance confirms a submitted receipt) both computed a
`remaining`/balance figure that was never checked — nothing stopped a
payment from pushing `installments.amount_paid` past `installments.amount`.

**Decision**: reject any payment/verification amount that exceeds the
installment's remaining balance, with a `BadRequestException` raised before
any row is written. No credit-balance or overpayment concept exists in the
schema or Operations Manual §8/§9: payment statuses are
`pending → confirmed`, or `reversed`/`failed`/`refunded`; installment
statuses are `pending → due_soon → due_today → paid/partial/late →
default_risk → defaulted`, or `settled`/`waived`. There is no
`overpaid`/`credit` state to receive an excess amount, so silently
accepting one would create an unreconcilable balance.

**Rationale**: this is a correctness/data-integrity fix, not a product
judgment call — the business rules as documented simply don't have anywhere
for an overpayment to go.

**Implementation**: guard added to both `recordPayment` and `verifyPayment`
(the two write paths onto `installments.amount_paid`) in
`src/payments/payments.service.ts`. Tests added in
`src/payments/payments.service.spec.ts` covering exact-balance,
partial-payment, and excessive-payment cases for both methods.

**Revisit if**: FORSA later wants to support partial refund-to-credit or
prepayment-toward-next-installment — that would need a real schema addition
(a credit-balance column/table and a corresponding status), not a relaxation
of this guard.

---

### D-SEC-003 — Unused tenant parameters: remove or enforce? — `DECIDED` (2026-07-10)

**Question**: three methods accepted a `tenantId` parameter that the lint
cleanup flagged as unused. This schema has no Row-Level Security (confirmed:
no `CREATE POLICY`/`ENABLE ROW LEVEL SECURITY` anywhere in `migrations/`,
and `docs/SECURITY_CHECKLIST.md`'s own pre-launch checklist lists "RLS
policies active" as a **not-yet-done** item) — so tenant isolation today is
entirely an application-query-scoping property. Each case was reviewed
individually rather than resolved with one rule.

**`UsersService.getUserRolesAndPermissions`** — **enforced, not removed.**
Confirmed exploitable: `GET /users/:id/roles` passes a **client-supplied**
`:id` straight through, and the query joined `user_roles → roles` with no
`tenant_id` filter anywhere (`user_roles` itself carries no `tenant_id`
column). Staff holding `user.view` in tenant A could request any UUID and
read another tenant's user's role names and permission codes — a real
cross-tenant IDOR, not theoretical. Fixed by calling `findOne(userId,
tenantId)` first (throws `NotFoundException` if the user isn't in that
tenant, matching the pattern already used by `update`/`deactivate`) and by
adding `r.tenant_id = $2` to both the roles and permissions queries.
Cross-tenant test added in `src/users/users.service.spec.ts`.

**`AuthService.getUserPermissions`** — **enforced, not removed.**
Identical query shape/gap. Both call sites always pass a `(userId,
tenantId)` pair read off the same just-fetched user row, so it wasn't
reachable with a mismatched pair today — but nothing enforced that
invariant at the query level, and the near-identical unscoped pattern in
`UsersService` *was* independently reachable (see above). Scoped the same
way for consistency and to close the gap before this function is reused
elsewhere with a less-trusted `userId`. Test added in
`src/auth/auth.service.spec.ts` asserting the query is parameterized by
both `userId` and `tenantId`.

**`ScoreService.checkAndUpdateCeiling`** — **enforced, not removed.**
`score_events.tenant_id` is a `NOT NULL` column that exists specifically to
scope rows without a join, but the ceiling-check query filtered on
`student_id` alone. `student_id` is a globally-unique key owned by exactly
one tenant permanently, so this wasn't reachable cross-tenant via a real
row — and this method's only caller (`recordCorrectiveEvent`) isn't wired
to any controller yet, so it's currently unreachable from the API at all.
Enforced anyway (`AND tenant_id = $2`) since the schema clearly intends the
check and the cost is one extra parameter, not a redesign. Test added in
`src/score/score.service.spec.ts` (invokes the private method directly, the
same pattern already used in `pipeline.service.spec.ts`).

**Why none were removed**: in every case the schema itself carries the
tenant-scoping column the query was ignoring (`roles.tenant_id`,
`score_events.tenant_id`), and with no RLS as a backstop, query-level
scoping is the only enforcement that exists. Removing the parameter would
have thrown away the one thing standing between "safe by invariant" and
"safe by construction."
