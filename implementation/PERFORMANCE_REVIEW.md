# FORSA OS — Performance Review

**Phase 3.5 · Final Engineering Pass**
Date: 6 July 2026

Scope: query patterns, connection handling, pagination, and response
sizing across `forsa-os`, informed by the actual queries touched or added
during this engagement's testing and fixes, not a synthetic load test.

---

## Verdict

No performance defect blocks launch. One real bug in this category (an
unbounded pagination request) was found and fixed during Phase 3 browser
testing; this pass's own additions were checked against the same class of
issue and are clean. The recommendations below are genuine but
non-blocking — appropriate work for the first post-launch iteration, not
before.

---

## 1. Database connection handling

Connection pooling is configured and environment-tunable
(`DB_POOL_MIN`/`DB_POOL_MAX`, defaulting to 2/20), rather than a single
shared connection or an unbounded pool. Reasonable defaults for a launch
at V1's expected scale.

## 2. Pagination

`PaginationDto` enforces `@Min(1)` and `@Max(100)` on the `limit` field
globally — a real bug (Partner Portal's Reports page requesting
`limit: 200`) was found and fixed during Phase 3 precisely because this
cap exists and correctly rejected it with a 400 rather than silently
returning an unbounded result set. Every list endpoint touched or added
during this engagement (`findAllForMyUniversity`,
`findScheduleForMyUniversityApplication`, etc.) either uses this shared
`PaginationDto` or returns a single bounded resource (one application, one
schedule) rather than an open-ended list — none of this pass's additions
introduce a new unbounded-query risk.

## 3. Query patterns

The self-scoped routes added this pass (and in Phase 3) consistently use a
single JOIN-based query to both resolve identity and fetch data in one
round trip (e.g. `findScheduleForMyUniversityApplication`'s ownership
check + `getDocumentChecklistForMyUniversity`), rather than one query to
check ownership followed by a second to fetch the resource — appropriate
for the request volume at hand, and consistent with the pattern already
established elsewhere in the codebase (`findMyScheduleForApplication`,
`confirmEnrollment`).

**One deliberate exception, not a bug**: `verifyMyInstallmentOwnership`
(new, Konnect self-scoping fix) and the subsequent
`KonnectService.initiatePayment` call are two separate round trips rather
than one combined query. This is intentional — `KonnectService` is shared
between the direct-student path and `GuarantorsService`'s
"pay-on-behalf-of-linked-student" path, which have different ownership
predicates (a student owns their own installment directly; a guarantor
owns a *link* to a student who owns the installment). Combining the checks
would require `KonnectService` to know about both callers' identity models,
coupling it to callers it shouldn't need to know about. The two-query cost
is negligible for a payment-initiation action (not a hot list endpoint)
and the separation keeps the ownership logic correctly scoped to each
caller.

## 4. Response sizing / compression

`compression` middleware is registered globally in `main.ts` — response
bodies are gzip/brotli-compressed by default, not raw JSON over the wire
for every request.

## 5. Indexing

45 `CREATE INDEX` statements exist across the migration history, including
composite indexes matching this codebase's actual common query shapes
(e.g. `idx_payments_installment_status ON payments(installment_id,
status)`, `idx_sessions_user ON user_sessions(user_id)`) rather than only
primary-key/foreign-key indexes. Not audited exhaustively against every
query added this session, but the specific queries this pass introduced
(ownership checks joining `applications`/`students`/`universities`) ride
on existing foreign-key indexes already in place from earlier migrations.

## 6. Rate limiting overhead

The global `ThrottlerGuard` (registered in `app.module.ts`, `100 req/60s`
default, tighter per-route overrides for login) uses in-process memory
storage — negligible per-request overhead at V1's expected scale, though
see `SECURITY_REVIEW.md` §5 for why this becomes a correctness (not
performance) concern once the app scales to multiple instances.

## 7. AI Interview latency

The AI Interview correctly falls back to a fast, synchronous demo-mode
response when the real Anthropic-backed endpoint is unavailable (no
production API key configured in this environment) — verified during this
pass's live re-run of the full student journey, the fallback added no
perceptible delay to the interview flow. Production behavior with a real
API key configured was not exercised in this pass (out of scope — no
production credentials available in this environment).

---

## Recommendations for the first post-launch iteration (non-blocking)

1. Add composite indexes explicitly for the new self-scoped ownership-check
   queries once real production query plans are available
   (`EXPLAIN ANALYZE` against production data volumes, not this session's
   small local dataset) — the joins are currently riding on existing
   foreign-key indexes, which is adequate at launch scale but worth
   confirming under real load.
2. Consider a Redis-backed cache for the university/partner "my dashboard"
   aggregate queries (`getPerformance`, `getMyDashboard`) if these prove to
   be hit frequently with slowly-changing data — not measured as a problem
   in this pass, just a natural next optimization once traffic exists to
   measure against.
