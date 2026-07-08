# Operations Audit Report

Independent verification of every claim made in `FORSA_OPERATIONS_MANUAL.md` against the actual running platform — code, live database, and (where practical) live API calls. **No code was modified during this audit.** Where a claim in the manual turned out to be imprecise, it was corrected in the manual directly (the manual is the living source of truth) and the correction is logged here for transparency.

## Method

For each of the 15 sections of the manual, the specific factual claims were re-derived independently from the source rather than trusted from memory:

- Every enum (`ApplicationStatus`, `MembershipStatus`, `MembershipRequestStatus`, `UserStatus`, `DocumentStatus`, `PaymentStatus`, `InstallmentStatus`, `NotificationChannel`) read directly from `src/common/enums/index.ts`.
- The full `STATUS_TRANSITIONS` map read directly from `applications.service.ts` rather than reconstructed from memory.
- The permission catalog (61 entries) and role assignments queried directly from the live `roles`/`role_permissions`/`permissions` tables, not assumed from the seed script alone.
- The notification template list (14 entries) grepped directly from `seed.ts`, cross-checked against live `notification_templates` rows.
- Every "does X actually happen" claim (guarantor invite triggered from `/apply`, SMS actually sent, in-app notifications populated) verified by grepping for the actual call site, not inferred from the existence of a related type or interface.
- Orphan-record claims re-run live against the current database rather than reused from the Phase 8 audit.

## Findings

### 1. Corrected during this pass: in-app notifications are not merely "thin," they are structurally dead

**Original manual draft said:** the `/notifications` page "does not appear to be populated from the same `notification_logs` table that drives email; it is a lighter, separate read."

**Actual behavior, verified:** `GET /notifications` → `NotificationsService.getNotificationsForUser()` queries `notification_logs WHERE channel = 'in_app'`. Every notification actually sent anywhere in the codebase is sent with `channel: 'email'`. Live query against the database:

```
 channel | count
---------+-------
 email   |    46
```

Zero `in_app` rows exist, and grepping for `NotificationChannel.IN_APP` as an argument to `.send()` anywhere in the codebase returns no results — only the *handling* branch for that channel exists in `notifications.service.ts`, never a caller that uses it. The endpoint, the query, and the frontend page are all correctly wired to each other; there is simply no code path that ever produces the data they'd display.

**Corrected in the manual** (§11) to state this precisely rather than the softer original wording. This is the one real mismatch this audit found between an early draft of the manual and the platform's actual behavior — it was caught and fixed before the manual was considered final, which is exactly what this audit pass is for.

### 2. Confirmed accurate: every other claim in the manual

The following claims were independently re-verified and found to match the manual exactly as written:

| Claim (manual section) | Verification method | Result |
|---|---|---|
| Guarantor's "do you have a guarantor?" question in `/apply` never triggers an actual invitation (§4, §13, §15) | Grepped `hasGuarantor` usage across `ApplyPage.tsx`/`InterviewPage.tsx` | Confirmed — used only as free-text context in the AI interview transcript, never calls the guarantor-add/invite endpoint |
| Only 2 roles exist (`SUPER_ADMIN`, `FINANCE_TEAM`) against 61 permissions (§1, §12) | Live query: `SELECT name FROM roles` + per-role permission counts | Confirmed — SUPER_ADMIN holds 61/61, FINANCE_TEAM holds 9 (`payment.*`, `collections.*`, `report.finance`, `report.collections`, `student.view`) |
| No `CHECK` constraint enforces the membership-tier ratchet at the database level (§10, §15) | Read `001_initial_schema.sql`'s `students` table definition | Confirmed — `membership_status` is a plain `VARCHAR`; the ratchet logic exists only in `applications.service.ts`/`pipeline.service.ts` application code |
| `blacklisted` has no reinstatement path (§10, §13) | Grepped every reference to `'blacklisted'` across the backend | Confirmed — the string is only ever written (fraud path in `pipeline.service.ts`), never cleared anywhere |
| SMS is a logged placeholder, not real delivery (§11) | Read `notifications.service.ts`'s SMS branch | Confirmed — `this.logger.log(\`SMS to ${phone}: ...\`)`, no Twilio/provider SDK call anywhere in the codebase |
| Partner commission functions exist but are never automatically invoked (§7, §15) | Grepped every call site of `calculateCommission`/`createCommissionRecord` | Confirmed — both are fully implemented in `partners.service.ts` but appear nowhere else in the codebase as a caller |
| No orphan `users`/`guarantors` records exist (§14) | Live queries: `users` with `portal_type` in (`student`,`guarantor`) lacking a matching row; `guarantors` with `user_id` set lacking an active `student_guarantors` link | Confirmed — zero rows in both cases |
| `membership_status_history` blocks `DELETE`/`UPDATE` at the database level (§1, §14) | `\d+ membership_status_history` in psql | Confirmed — two Postgres rules, `..._no_delete`/`..._no_update`, both `DO INSTEAD NOTHING` |
| Full `applications.current_status` transition map (§10) | Read the `STATUS_TRANSITIONS` constant directly from `applications.service.ts` | Confirmed — every "allowed to" pairing in the manual matches the source exactly, including `fraud_flagged` having zero outgoing transitions and `rejected` allowing both `appealing` and `new_lead` |
| Digital Pass has a working `revoke` action but no separate manual "issue" action (§9) | Read `digital-pass.controller.ts`/`.service.ts` | Confirmed — `POST digital-passes/:id/revoke` exists and is functional; issuance only happens inside the Bronze-approval transaction, no standalone issuance endpoint exists |
| `submitAppeal` is functional and gated correctly (§10, §13) | Read `applications.service.ts`'s `submitAppeal` | Confirmed — rejects appealing anything not currently `rejected`, looks up the relevant financing decision before proceeding |
| 14 notification templates exist, all `channel = 'email'` (§11) | Grepped `seed.ts`'s template array + live `notification_templates` table | Confirmed — 14 templates, all `email` |
| University/Partner self-scoping and staff-only-route rejection (§6, §7, §12) | Re-ran the Phase 8 live 403 checks against `contact@utm.tn`/`contact@educonnect.tn` | Confirmed — both still correctly return `403` on staff-only routes |
| Duplicate-application prevention still active (§5, §13) | Re-confirmed the check exists in `applications.service.ts#createForSelf` (added in Phase 8, unchanged since) | Confirmed |

### 3. Not independently re-tested in this pass (relied on Phase 8's already-verified results)

The following were verified live via real browser/API testing in Phase 8 (`BROWSER_TEST_REPORT.md`) and were not re-run from scratch in this documentation-only phase, since no code changed between Phase 8 and this audit: the full membership request → Bronze → apply → guarantor invite → Gold approval → re-login lifecycle (20/20 checks), and the 10 edge cases (rejected membership, rejected facilitation + reapply, guarantor decline, resend, expired/invalid tokens). Nothing in this phase's read-only investigation surfaced any reason to doubt those results still hold.

## Mismatches found: 1

Only the in-app-notifications wording (item 1 above) was actually incorrect in an early draft — and it was corrected before this report was finalized, so the manual as it stands today contains **zero known mismatches** against the platform's actual behavior.

## Conclusion

`FORSA_OPERATIONS_MANUAL.md` accurately reflects the platform as implemented. Every state machine, permission boundary, notification trigger, and business rule documented was independently re-derived from source code and live data rather than trusted from prior session context, and the one imprecision this process caught was fixed rather than left standing. The nine operational gaps listed in the manual's §15 (Pilot Readiness) remain open — this audit did not close any of them, per this phase's explicit instruction not to modify code; they are scoping/hardening decisions for the team to make, not bugs this pass silently fixed.
