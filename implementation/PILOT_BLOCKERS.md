# Pilot Blockers

Severity-ranked list of everything found during the Phase 8 workflow audit and live testing pass that could affect a first university pilot. Full detail behind each item is in `WORKFLOW_AUDIT_REPORT.md`; live test evidence is in `BROWSER_TEST_REPORT.md`.

**Severity key**
- **Critical** — blocks pilot / corrupts business process
- **High** — user gets stuck or loses trust
- **Medium** — confusing but usable
- **Low** — polish

---

## Critical

None found. The two items that would have belonged here — a student's membership tier silently never updating depending on which admin screen approved them, and no prevention against a student submitting duplicate Tuition Facilitation requests — were both found and fixed in this same audit pass (Phase 7 and Phase 8 respectively), and both are now verified live end-to-end.

## High

**Partner commission records are never created automatically.**
`partners.service.ts` has a fully-built, correct commission calculation function and a real database table with a working UI on top of it — but nothing in the codebase ever calls it. A commission today only exists if someone inserts it by hand. If the pilot university's ecosystem includes an active referral partner who expects to see commission tracking work, this will not function. **If no referral partner is part of this specific pilot, this drops to Medium** — it's a real gap in a real feature, but one the pilot may never touch. Closing it properly requires a business decision (commission created on approval? on first payment? on full disbursement?) that shouldn't be made unilaterally as part of an audit — flagging for a product decision before building it.

## Medium

**Unclaimed Bronze accounts never expire.** An approved Membership Request immediately creates a real login account; if the student never clicks the set-password email, that account sits forever with no automatic cleanup. Not disruptive at pilot scale (a handful of accounts, easy to spot manually), but worth a scheduled cleanup job before a wider rollout.

**Konnect (online payment gateway) integration is unverified.** The code exists and looks complete but wasn't exercised in this session (no sandbox credentials available locally). If the pilot relies only on the manual bank-transfer-plus-receipt-upload flow (which was verified working), this doesn't block anything. If online card payment is expected to work on day one, it needs a dedicated verification pass first.

## Low

**Two separate admin screens can both approve an application.** `ApplicationDetailPage.tsx` and `ApplicationWorkflowPage.tsx` remain distinct UIs. Both now produce the correct outcome (this was the Critical-severity gap fixed in Phase 7), so this is purely a UI-consolidation opportunity, not a functional risk.

**University portal has no centralized translation system.** Unlike the student/partner/dashboard portals, it doesn't use a `t()`-key lookup — content is set directly per-language in components. Functional today; would need a different approach if the university portal needs full multi-language parity with the others later.

---

## Verdict

**No Critical pilot blockers remain.** The one High-severity item (partner commissions) only matters if a referral partner is actively part of the pilot's scope — confirm that before launch and treat it as a go/no-go question specific to that scenario, not a general blocker. Every core student/guarantor/admin workflow — membership request through Bronze approval, Tuition Facilitation submission through Silver/Gold assignment, guarantor invitation through portal access, and every rejection/decline/duplicate-prevention edge case tested — is verified working end-to-end against the real running stack as of this audit.
