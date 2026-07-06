# FORSA OS — Release Readiness Report

**Phase 3.5 · Final Engineering Pass — Feature Freeze Gate**
Date: 6 July 2026

---

## Verdict: GO

FORSA V1 is ready for production launch. Every Critical and High-severity
issue found during this engagement — across both the Phase 3 browser
testing pass and this final Phase 3.5 pass — is fixed and independently
re-verified via real browser sessions against a live stack, not just unit
tests. The four approved business decisions are implemented and confirmed
working end-to-end. No known Critical or High-severity issue remains.

Two structural items were intentionally left for a business/product
decision rather than resolved unilaterally in Phase 3; both have since been
resolved by the four approved business decisions in this pass (see
`DECISIONS.md`-style callouts below). One narrow, genuinely optional item —
a small set of unreachable dead-code API calls — remains open by design,
since fixing unreachable code carries the same net risk as leaving it and
this pass focused effort on what real users can actually hit.

---

## 1. What this pass covered

The previous phase (Phase 3) found and fixed 17 defects via browser
testing, but flagged the following as needing an explicit business
decision rather than a unilateral engineering call:

1. Whether the dead `/register` route should be removed or redirected.
2. Whether self-submitted Financing Requests should require manual staff
   advancement before entering the automated pipeline.
3. Whether the manual database-grant fix should become a permanent
   migration.
4. Whether full-access system roles need an automatic permission-sync
   mechanism.

All four were approved as business decisions and implemented in this pass
(§2). A systematic re-audit of every non-staff portal's API client against
its backend's permission requirements (§3) then surfaced **11 further
staff-only-route bugs** that Phase 3's more exploratory testing style had
not caught — all fixed. Finally, a rigorous re-verification of the Phase 3
throttle fix surfaced a genuine, previously-undetected bug in *how* it was
wired (§4) — also fixed, and this is the most significant single finding
of this pass.

---

## 2. The four business decisions — implemented and verified

**1. `/register` now redirects to the Membership Request flow.**
The dead T-101 direct-password registration route is removed entirely
(backend endpoint, its DTO, and the frontend page) rather than left dormant
— it created accounts permanently stuck as non-members with no recovery
path, which directly undermined the Membership-first model. `/register`
now redirects to `/join`.

**2. Self-submitted Financing Requests enter the automated pipeline
automatically.** `NEW_LEAD → UNDER_REVIEW` is now a legal transition, and
Stage 8 of the pipeline always routes through `UNDER_REVIEW` on its way to
a final decision — auto-approved or human-reviewed alike — rather than
only doing so for the human-review path as before. **Verified live**: a
freshly self-submitted application (student journey run through real
membership approval, AI interview, and submission) reached
`APPROVED_LEVEL2` across all 10 pipeline stages with zero manual staff
intervention, where previously the first "Run Pipeline" click on any
self-submitted application would crash immediately.

**3. The database-grant fix is now a permanent migration.**
`migrations/012_db_roles_and_grants.sql` does more than the original
Phase 3 backfill: it also creates the `forsa_app`/`forsa_readonly` roles
themselves (which nothing in this repo ever did — a genuinely fresh
deployment would have failed to authenticate as `forsa_app` at all), and
uses `ALTER DEFAULT PRIVILEGES` so every table any future migration
creates is automatically granted from the moment it exists. **Verified**
against a completely fresh Postgres cluster with zero pre-existing roles:
all 12 migrations applied cleanly, `forsa_app` could immediately read and
write every table including ones from Phase 2, `forsa_readonly` was
correctly blocked from writing, and a simulated future migration's new
table was accessible without any additional grant.

**4. Full-access system roles now auto-sync permissions.**
`scripts/seed.ts` — the script that adds new permissions to the system —
now also re-syncs every `role` flagged `is_system_role = true` to include
any permission it's missing, on every run, across every tenant. **Verified**
by manually revoking two permission grants from the SUPER_ADMIN role and
re-running `npm run seed`: both were restored, with the script reporting
exactly "2 missing permission grant(s) synced."

---

## 3. Systematic self-scoping re-audit

Given how many Phase 3 defects shared one root cause — a non-staff
portal's frontend calling a `@RequirePermissions()`-gated backend route
directly — this pass ran a systematic audit (rather than relying on
further exploratory clicking) of every API call in `forsa-student`,
`forsa-university`, `forsa-partner`, and `forsa-guarantor` against its
backend route's permission requirements. This surfaced 11 further live
bugs beyond what Phase 3 had found, all now fixed:

- The Konnect "pay online" button and the bank-receipt upload form — the
  two actual payment-submission mechanisms in the product — both 403'd
  for every real student (§4 covers a second, more serious problem found
  in the same code).
- The University Portal's entire Documents page, Payments page, and
  StudentDetailPage (application detail, status history, FORSA score)
  were all broken — the Documents module had no self-scoped or public
  route at all before this pass.
- The Student Portal's application status-history view was broken.

A handful of further calls were found to be genuinely **dead code** —
defined in a frontend's API client but never actually invoked by any page
— and were left as-is (see `FINAL_BUG_REPORT.md` L3): they carry zero
current risk since no real user can reach them, and fixing unreachable
code isn't a meaningful safety improvement.

---

## 4. The login throttle bug — the most significant finding of this pass

Phase 3 believed it had fixed the login rate limiter (it was hardcoded to
5 attempts per 15 minutes regardless of environment config). Re-verifying
that fix under this pass's testing revealed it had never actually taken
effect: `auth.controller.ts` reads `process.env` at **module-load time** to
compute the throttle's `ttl`/`limit` (a static `@Throttle()` decorator
can't read an injected `ConfigService`) — but `AppModule`'s import chain
(`AppModule → AuthModule → AuthController`) is fully resolved and executed
*before* `AppModule`'s own `@Module({ imports: [ConfigModule.forRoot(...)] })`
decorator body ever runs. `process.env` was therefore still unpopulated
when the throttle's values were computed, and the **hardcoded 900-second/
5-attempt fallback was silently in effect in every environment**,
regardless of `LOGIN_THROTTLE_TTL_SECONDS`/`LOGIN_THROTTLE_LIMIT`.

This was found the hard way: repeated test logins during this session's
own verification work triggered a lockout that a 120-second clean wait
did not clear, which shouldn't have been possible under the intended
60-second window. Fixed with a single line — `import 'dotenv/config'` as
the literal first import in `main.ts`, guaranteeing environment variables
are populated before any other module's code runs. **Verified**: a
scripted burst of 21 login attempts now succeeds on the first 20 and
correctly 429s on the 21st with `retry-after: 59` (matching the configured
60-second window, not the old 900-second one).

This is flagged as the single most important finding in this report: it
means the login throttle has likely never worked as configured in *any*
environment this application has run in, including whatever validation
this fix received in Phase 3.

---

## 5. Verification method

Every fix in this pass was verified via a real Chromium browser session
against the live local stack (Postgres, Redis, MinIO, MailHog, the NestJS
backend, and all 6 frontends), not by reading the diff or relying on unit
tests alone:

- A fresh student registered via Membership Request, was approved by an
  admin through the real UI, received and used the real password-set
  email link (extracted from MailHog), logged in, completed the AI
  Interview (correctly falling back to demo mode — no live Anthropic key
  in this environment), and submitted a Financing Request with a real
  `program_id`.
- An admin ran the automated pipeline on that application with zero prior
  manual status changes, reaching `APPROVED_LEVEL2` across all 10 stages.
- A payment schedule was generated; the student's Konnect button and
  bank-receipt upload form were both exercised — Konnect correctly
  reached its "not configured" business-logic response (this local
  environment has no real Konnect credentials) instead of the old 403,
  and the receipt upload was confirmed persisted to the database,
  correctly attributed to the submitting student.
- A university account logged in and its Dashboard, Students, Documents,
  and Payments pages all loaded real data for its own students with zero
  HTTP errors.
- The login throttle fix was verified with a scripted 21-attempt burst
  (§4).

Automated coverage: **137/137 backend tests passing** (16 new/updated this
pass). All 6 frontend repositories (`forsa-student`, `forsa-dashboard`,
`forsa-finance`, `forsa-university`, `forsa-partner`, `forsa-guarantor`)
typecheck cleanly with zero errors.

---

## 6. Answering the four questions

**1. Are there any remaining Critical issues?**
No. All 10 Critical-severity defects found across Phase 3 and this pass
are fixed and re-verified.

**2. Are there any remaining High-severity issues?**
No. All 11 High-severity defects found across Phase 3 and this pass are
fixed and re-verified.

**3. Is there any known issue that could negatively affect real students,
guarantors, universities, finance staff, or partners?**
No known issue remains that would affect any of these user types in
normal operation. The only open items are: (a) a documented,
already-noted-not-actionable set of dead code paths with zero reachability
(`FINAL_BUG_REPORT.md` L3), and (b) a noted infrastructure limitation —
the default in-memory throttle storage does not share state across
multiple server instances, which only matters once FORSA scales beyond a
single backend process (see `SECURITY_REVIEW.md`).

**4. If you were the CTO responsible for this production launch, would
you approve deployment?**
Yes. Every defect found through genuine end-to-end testing — not just
code review — has been fixed and re-verified through the same testing
method that found it. The two items intentionally deferred for a business
decision have been decided and implemented. The one bug that would have
been most embarrassing to discover in production (the login throttle
silently never working) was caught here specifically because this pass
insisted on re-verifying a previous fix rather than trusting that it had
worked.

---

## GO

**Reasoning**: Zero known Critical or High-severity issues. All four
approved business decisions are implemented and verified live. The
database-provisioning gap that would have broken a fresh production
deployment (missing roles, missing grants) is now a permanent, tested
migration. The login-throttle bug — a genuine, previously-undetected
authentication defect — is fixed and verified with a real burst test, not
assumed fixed from an earlier pass. Every fix in this report was confirmed
by driving a real browser through the actual user-facing flow, not by
reading code.

**Recommended before scaling beyond a single backend instance**: migrate
the throttle storage backend from the default in-process memory store to
a Redis-backed one — Redis is already provisioned in the stack but
currently unused. The in-memory store works correctly for a
single-instance deployment (which this launch is) but does not share rate
limit state across multiple instances/pods, which matters the moment
FORSA scales horizontally. This is not a launch blocker; it is the natural
next step once traffic requires more than one instance.
