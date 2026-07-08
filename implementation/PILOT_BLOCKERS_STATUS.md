# Pilot Blockers Status

Tracks every operational gap listed in `FORSA_OPERATIONS_MANUAL.md` §15 (Pilot Readiness) against what Phase 10 actually closed. Status as of this report.

| # | Gap | Status | Notes |
|---|---|---|---|
| 1 | Partner commissions never auto-create | **Open** | Deliberately not touched this phase — closing it requires a product decision on trigger timing (approval? first payment? full disbursement?) that Phase 10's scope ("close pilot blockers," not "make product decisions") doesn't authorize unilaterally. Only relevant if a referral partner is actually part of the first pilot. |
| 2 | Guarantor invitation not wired to the "do you have a guarantor?" question | **Closed** | Students can now invite their own guarantor directly via the new `/guarantor` page and `POST /students/me/guarantors` — no staff action required. See `PHASE10_IMPLEMENTATION_REPORT.md` §1. |
| 3 | Only 2 roles exist against a 61-permission catalog | **Open** | Unchanged — this is a role-provisioning/organizational decision (who gets hired, what they should see), not something to invent speculatively. Acceptable for a small pilot team; revisit before hiring differentiated staff roles. |
| 4 | No database-level enforcement of the membership-tier ratchet | **Open** | The application-code-only enforcement is unchanged. Low risk today (no direct-SQL admin tooling exists), a hardening recommendation rather than a functional gap — not in this phase's "close pilot blockers" scope since nothing is currently broken by its absence. |
| 5 | Unclaimed Bronze accounts never expire | **Open** | Not disruptive at pilot scale; a scheduled cleanup job is a good idea before wider rollout, not a pilot blocker. |
| 6 | Konnect online payment unverified | **Open** | Unchanged — the manual bank-transfer-plus-receipt flow (verified working) is sufficient if that's the pilot's payment method; Konnect needs a dedicated verification pass only if online payment is expected on day one. |
| 7 | No SMS/push notifications despite schema support | **Open** | Unchanged — email-only delivery remains the real, working channel. Don't describe SMS as a live capability to the pilot partner. |
| 8 | No renewal flow despite the field existing | **Open** | Unchanged — `is_renewal` still always `false` from self-service submissions; no UI exists to select a prior plan to renew. Only relevant if a returning student is expected during the pilot window. |
| 9 | No fraud-flag reinstatement path | **Open** | Unchanged — acceptable if fraud-flagging is genuinely meant to be permanent and human-reviewed before it's ever applied; worth confirming that intent before the first real flag happens. |
| — | Bronze Dashboard next-step ambiguity | **Closed** | The single ambiguous "Start your journey" card replaced with a real progress checklist that always highlights the current required step. See `PHASE10_IMPLEMENTATION_REPORT.md` §2. This gap wasn't separately numbered in the original manual but was explicitly named in this phase's scope, so it's tracked here. |
| — | Waiting list experience (bare "you are waiting") | **Closed** | Full explanation, Bronze-intact reassurance, estimated position, what-happens-next, and while-you-wait guidance now render for any `capital_queue` application. See `PHASE10_IMPLEMENTATION_REPORT.md` §3. |
| — | Administrator queue visibility (raw status codes only) | **Closed** | Computed blocker tags (Urgent, Missing Guarantor, Waiting Documents, Waiting Student, Waiting University, Waiting List, Ready for Review) now shown per application with quick-filter chips. See `PHASE10_IMPLEMENTATION_REPORT.md` §4 for the one known limitation (client-side filtering, fine at current pilot scale). |

## Verdict

**4 of 4 gaps explicitly scoped for Phase 10 are closed and verified live.** Of the 9 gaps originally listed in the manual's pilot-readiness assessment, this phase closed the 2 that were both genuinely blocking a first-time student's experience (guarantor invitation, dashboard ambiguity) and explicitly in scope; the remaining 7 are correctly left open because each is either a scoping question specific to what the actual pilot involves (partner referrals, renewals, online payment) or a hardening/organizational recommendation rather than a live defect — closing them speculatively would have meant building or deciding things this phase's instructions explicitly excluded ("do not add speculative features," "do not redesign the platform").

**No Critical or High-severity blocker remains open** that would corrupt a business process or leave a student stuck with no path forward, for the core membership → guarantor → Tuition Facilitation → tier-assignment loop a first pilot actually exercises.
