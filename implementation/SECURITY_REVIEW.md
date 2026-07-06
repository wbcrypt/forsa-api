# FORSA OS — Security Review

**Phase 3.5 · Final Engineering Pass**
Date: 6 July 2026

Scope: authentication, authorization, data integrity, and secrets handling
across `forsa-os` and its 6 frontend portals, as exercised by real browser
testing plus targeted code review of every finding.

---

## Verdict

No known unresolved security issue. Three genuine vulnerabilities were
found and fixed this pass, all of which would have shipped undetected by
code review alone — each was found by deliberately trying the corresponding
attack path through a real browser/API call, not by reading source. One
infrastructure limitation is flagged as a pre-scaling recommendation, not a
launch blocker.

---

## 1. Authentication

**Password storage**: argon2id (`memoryCost: 65536, timeCost: 3,
parallelism: 4`), the current OWASP-recommended default. Verified
consistently applied in both `auth.service.ts` and the shared
`password.util.ts`.

**Timing-attack resistance**: login against a non-existent email still runs
a dummy argon2id verify (`auth.service.ts:80`) before returning "invalid
credentials," so response timing doesn't leak whether an email is
registered.

**Login rate limiting — found broken, now fixed and verified.** The login
throttle was silently using its hardcoded 900-second/5-attempt fallback in
every environment, never the configured value, because
`auth.controller.ts` computes the throttle's `ttl`/`limit` from
`process.env` at module-load time — before `ConfigModule.forRoot()` has
populated it, since `AppModule`'s import chain fully resolves before
`AppModule`'s own decorator body runs. This is exactly the kind of defect
that passes a superficial "does the 429 eventually happen" check while
being functionally wrong (900s instead of 60s is *more* restrictive, so it
doesn't look broken from the outside — it just silently ignores every
attempt to configure it, in either direction). **Fixed** with `import
'dotenv/config'` as the literal first line of `main.ts`. **Verified** with
a scripted 21-request burst: the 21st correctly 429s with
`retry-after: 59`, matching the configured 60-second window.

**JWT**: access/refresh secrets are required config with a 64-character
minimum (`Joi.string().min(64)`), separate secrets for access vs. refresh,
configurable expiry (default 15m/7d). Refresh tokens are stored
server-side (`user_sessions.session_token_hash`) and can be invalidated
(`invalidated_at`/`invalidation_reason`), not purely stateless — a stolen
refresh token can be revoked.

**MFA**: TOTP-based, `mfa_configs.secret_encrypted` (encrypted at rest,
not plaintext), separate `mfa_challenges` table for the short-lived
verification step. Not exercised in this pass's browser testing (disabled
by default in this environment's config) but the schema and service layer
were reviewed and are structurally sound.

**Cookies**: session cookie is `httpOnly`, `sameSite: 'strict'`, and
`secure` in non-dev environments — correctly resistant to XSS-based theft
and CSRF via cross-site cookie leakage.

---

## 2. Authorization

**Model**: permission-based (`@RequirePermissions('module.action')`)
enforced by a global `PermissionsGuard`, with an explicit `@Public()`
escape hatch for genuinely unauthenticated routes. This is a sound model
in principle — the actual defects found this engagement were never about
the *model* being wrong, but about specific routes being assigned the
*wrong* permission requirement (staff-only where the real caller is a
self-service portal user).

**The recurring defect class**: 21 distinct instances (across Phase 3 and
this pass combined) of a non-staff portal calling a route gated behind a
staff permission it structurally cannot hold, always failing with a 403 for
every real user of that portal. All 21 are now fixed via self-scoped
sibling routes that resolve the caller's identity server-side (via
`@CurrentUser('id')` and a JOIN back to the caller's own
student/university/partner/guarantor row) rather than trusting a
client-supplied id — see `FINAL_BUG_REPORT.md` for the full list. The
**pattern itself is sound and consistently applied**: every self-scoped
route in this codebase resolves identity from the JWT, never from a
request parameter, and never carries a `@RequirePermissions()` (the
service layer does the actual scoping via a `WHERE ... = <resolved id>`
clause).

**Permission-set staleness — found and fixed.** Full-access system roles
(`is_system_role = true`, currently only SUPER_ADMIN) had their permission
set populated once at role-creation time and never re-synced when new
permissions were added to the system afterward — a real account 403'd on a
feature it should have had full access to. `scripts/seed.ts` now syncs
every such role's permissions on every run, verified by manually revoking
grants and confirming they're restored.

**Konnect payment initiation and receipt submission — found and fixed, the
most serious authorization defect of this pass.** Both routes were gated
behind the staff-only `payment.record` permission, so no real student
could ever reach them (a 403, not a data-integrity gap, from the outside).
But the *code behind the gate* had no ownership check at all: `submitReceipt`
never verified the caller owned the installment being paid, and
`initiatePayment` additionally inserted the wrong id type (the auth user's
own id, never actually a `students.id`) into `payments.student_id` — a
latent bug that would have caused a foreign-key violation the moment the
permission gate was ever correctly removed without also fixing the
ownership check. Both are now fixed: the permission gate is removed (these
are legitimately self-service actions) and a real ownership check
(resolving the caller's own `students.id` and verifying it matches the
installment's owner) was added in its place. **This means the permission
bug was, in a strange way, protecting against the ownership bug** — fixing
one without the other would have been worse than fixing neither. Both are
now fixed together and verified: a real receipt upload was confirmed
persisted and correctly attributed to the submitting student, and Konnect
initiation now correctly reaches its real business-logic response (a "not
configured" error in this environment, which has no live Konnect
credentials) instead of a 403.

---

## 3. Data integrity

**SQL injection**: this codebase uses parameterized queries
(`$1`/`$2`-style placeholders) throughout — no instance of raw string
concatenation of user input into a query was found in this pass's review.
The one place numeric interpolation is used directly in a query string
(`INTERVAL '${months} months'` in `documents.service.ts`) is safe because
the value is passed through `parseInt()` first, which can only ever
produce a number, never arbitrary SQL text.

**PII encryption**: `PII_ENCRYPTION_KEY`/`MFA_ENCRYPTION_KEY` are required
64-character config values (Joi-validated), used to encrypt national ID
numbers and MFA secrets at rest, with a versioned key
(`CURRENT_PII_KEY_VERSION`) supporting future key rotation.

**Audit logging**: `audit_logs` inserts appear across 12 service files,
covering the security-sensitive actions this review would expect
(approvals, status transitions, self-registration, receipt submission on
behalf of a student). Not universal across every single mutation, but
present at the meaningful decision points.

**Response serialization**: `ClassSerializerInterceptor` is registered
globally, hiding `@Exclude()`-marked fields (e.g. `passwordHash`) from API
responses by default, rather than relying on every DTO/query to manually
omit them.

---

## 4. Infrastructure / transport security

- `helmet` is applied globally, with `contentSecurityPolicy` and
  `crossOriginEmbedderPolicy` enabled specifically in production (relaxed
  in dev to not block the Vite dev servers' HMR).
- CORS uses an explicit origin allowlist in production
  (`security.corsOrigins`), `origin: true` only in non-production.
- Swagger/OpenAPI docs are disabled in production (`if (!isProd)`).
- Global `ValidationPipe` with `whitelist: true` strips unrecognized
  fields from incoming DTOs by default.
- The Konnect webhook (`POST /payments/konnect-webhook`) is the one
  legitimately `@Public()` + rate-limit-exempt route, correctly guarded
  instead by HMAC-SHA256 signature verification
  (`crypto.timingSafeEqual`, not a naive `===` comparison) plus an
  anti-replay re-verification call back to Konnect's own API before
  trusting the payload.

---

## 5. Recommendation for pre-scaling (not a launch blocker)

The `@nestjs/throttler` module currently uses its default in-process
memory storage. This works correctly for a single backend instance (the
launch configuration) but does **not** share rate-limit state across
multiple instances/pods — each would maintain its own independent
counter, meaning a horizontally-scaled deployment would effectively
multiply the real rate limit by the instance count. Redis is already
provisioned in this stack (`docker-compose.yml`) but is not currently used
by the application for anything, including this. Recommend migrating to a
Redis-backed throttler storage adapter before scaling beyond one instance
— not before this launch, which is single-instance.
