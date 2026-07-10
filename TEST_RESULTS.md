# FORSA OS — Test Results

Latest full verification run for the ESLint-cleanup + security follow-up
work. See `SECURITY_PROGRESS.md` for what changed and why, `DECISION_LOG.md`
for the reasoning behind each fix.

## Run: 2026-07-10 (ESLint cleanup + security follow-up)

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ 0 errors (was: no config at all — lint had never run in this repo before this session) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | ✅ clean |
| Tests | `npm test` (jest) | ✅ 212/212 passing, 20/20 suites |
| Build | `npm run build` (`nest build`) | ✅ succeeds |

### Test suite detail

```
Test Suites: 20 passed, 20 total
Tests:       212 passed, 212 total
Snapshots:   0 total
```

Suites (all passing):
`applications.service.spec.ts`, `application-stages.util.spec.ts`,
`auth.service.spec.ts`, `jwt-auth.guard.spec.ts`,
`permissions.guard.spec.ts`, `digital-pass.service.spec.ts`,
`documents.service.spec.ts`, `execution.service.spec.ts`,
`guarantors.service.spec.ts`, `household-stability.util.spec.ts`,
`stability-score.util.spec.ts`, `membership.service.spec.ts`,
`partners.service.spec.ts`, `konnect.service.spec.ts`,
`payments.service.spec.ts`, `pipeline.service.spec.ts`,
`score.service.spec.ts`, `students.service.spec.ts`,
`universities.service.spec.ts`, `users.service.spec.ts` (new)

### New/changed tests this run (+13 over the prior 199)

- `src/payments/payments.service.spec.ts` (+7) — overpayment guard:
  - `recordPayment`: exact-balance accepted, partial accepted, excess
    rejected (both from-zero and from-a-partially-paid installment)
  - `verifyPayment`: exact-balance accepted, partial accepted, excess
    rejected without mutating the payment row
- `src/auth/auth.service.spec.ts` (+2) — `getUserPermissions` query is
  parameterized by `(userId, tenantId)` and scoped by `r.tenant_id`
- `src/score/score.service.spec.ts` (+2) — `checkAndUpdateCeiling` query is
  parameterized by `(studentId, tenantId)` and scoped by `tenant_id`;
  ceiling not lifted when an active fraud event exists
- `src/users/users.service.spec.ts` (new file, +2) — `getUserRolesAndPermissions`
  rejects a userId outside the caller's tenant before querying anything;
  scopes both roles and permissions queries by `tenant_id` for an in-tenant user

### Known pre-existing, unrelated warning

`A worker process has failed to exit gracefully...` — jest teardown warning,
present before this session's changes, not something this work introduced
or investigated further.

## Prior run: same-session ESLint cleanup only (pre security follow-up)

| Check | Result |
|---|---|
| Lint | ✅ 0 errors (down from 87) |
| Typecheck | ✅ clean |
| Tests | ✅ 199/199 passing, 19/19 suites |
| Build | not run at that checkpoint |
