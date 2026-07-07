# FORSA Pilot Readiness Report

**Question:** if a university signs tomorrow, could FORSA be used immediately?

**Answer:** Yes, for a supervised pilot with a small cohort — with the caveats below. The core student journey (Membership Request → Bronze approval → FORSA ID/Digital Pass → Tuition Facilitation request → payments → notifications) works end-to-end on real infrastructure with real data, and the highest-severity bug found this phase (a hidden AI recommendation) is fixed. What's missing is mostly operational (real secrets, a real server, real DNS) rather than product-level.

---

## Remaining blockers

These block a **public**, unsupervised launch. None block a **supervised pilot** with a small, known cohort where FORSA staff can manually work around gaps.

| # | Blocker | Why it matters | Owner |
|---|---|---|---|
| 1 | No real VPS provisioned | Everything so far has run in a local Docker dry-run (Phase 4). A pilot needs a real, publicly reachable server. | Ops |
| 2 | DNS not pointed at any server | `forsa.tn` and its 7 subdomains need real DNS records before TLS certificates can be issued. | Ops |
| 3 | No real SMTP relay | MailHog (local-only) captures every email but sends nothing externally — real students/guarantors/university staff won't receive any notification until this is swapped for a real provider. | Ops |
| 4 | No real `ANTHROPIC_API_KEY` in production | The AI readiness interview currently runs in demo mode (`AI_DEMO_MODE=true`), which is honest (it doesn't fabricate scores) but means the AI recommendation step doesn't actually run for real applicants yet. | Product/Ops |
| 5 | No TLS certificates | Local testing was HTTP-only; production must be HTTPS before handling any real personal or financial data. | Ops |

See `PRODUCTION_READINESS_REPORT.md` (Phase 6) for the full checklist to close these.

## What does NOT block a supervised pilot

- The product itself: all 5 portals load, authenticate, and render real data correctly.
- The core business workflow: verified end-to-end this phase, including real email delivery (via MailHog) and a real notification log entry.
- The highest-severity bug found (AI report field mismatch, which could have hidden the AI's recommendation from the review committee) — fixed and verified.
- Terminology discipline: no banned "loan/financing/credit/interest rate" language remains in the admin dashboard's user-facing copy (10 instances fixed) or in any of the 12 email templates (verified directly against the database).
- A real duplicate-application gap (an existing member could re-submit the public join form) — fixed and verified.

## Launch checklist

**Must-do before any real user touches the product:**
- [ ] Provision a VPS and point all 8 subdomains' DNS at it (see `PHASE4_LOCAL_DRY_RUN_REPORT.md` for exact steps).
- [ ] Issue real TLS certificates for every subdomain.
- [ ] Configure a real SMTP relay and verify at least one real email delivers end-to-end.
- [ ] Set a real `ANTHROPIC_API_KEY` and confirm `AI_DEMO_MODE=false` in production, then run one real test interview.
- [ ] Replace every demo secret (JWT secrets, encryption keys, bootstrap admin password) with freshly generated production values — never reuse anything from the local `.env` used in this dry run.
- [ ] Change the bootstrap admin password immediately after first production login.

**Should-do before public (not just supervised-pilot) launch:**
- [ ] Fix the missing `htmlFor`/`id` pairing on form fields — confirmed missing in all 6 portals; the single most repeated finding across every audit.
- [ ] Decide on and either build or intentionally defer the Guarantor portal's localization (FR/EN/AR dictionaries exist but are entirely unused — currently hardcoded French only).
- [ ] Add commission-rate/payout transparency to the Partner portal (currently shows running totals with no way to independently verify them).
- [ ] Resolve the Admin Dashboard's two parallel, divergent application-status-advancement UIs before staff start using both interchangeably on real cases.
- [ ] Decide whether the two placeholder-only sidebar pages (AI Queue, Tuition Facilitation Queue) should be hidden or built out before staff notice they do nothing.

**Nice-to-have, no urgency:**
- Mobile responsiveness gaps in fixed-width sidebars and stat grids (all 5 portals affected to varying degrees) — most acute on the portals more likely to be used on a phone (Student, Guarantor).
- Lazy-load the Admin Dashboard's routes — its production bundle is 725KB in one chunk, the only portal still flagged by Vite's own bundle-size warning.
- The remaining ~90 lower-severity findings documented in `UX_AUDIT_REPORT.md`.

## Priority fixes (if only 5 things get done before the pilot starts)

1. **DNS + VPS + TLS** — without this, nothing else in this list matters; the product cannot be reached by a real user at all.
2. **Real SMTP relay** — every notification in the product (membership confirmation, approval, payment reminders, guarantor invitations) currently goes nowhere real.
3. **Fresh production secrets** — the local `.env` generated during Phase 4 has already been used for demo testing and must never be reused in production.
4. **`htmlFor`/`id` pairing on forms** — the single most repeated, systemic finding across every portal; mechanical to fix, meaningfully improves the experience for any screen-reader user on day one.
5. **Decide the Guarantor portal's localization question explicitly** — either commit to building it before pilot (parents are plausibly the audience most likely to prefer Arabic) or consciously accept French-only for this pilot and document why, rather than leaving it as an accidental gap.

## Confidence assessment

| Area | Status |
|---|---|
| Core business workflow | ✅ Verified end-to-end |
| Data integrity / real accounts | ✅ Verified (8 real login accounts, real payment schedule, real commission) |
| Highest-severity bug (AI recommendation visibility) | ✅ Fixed and verified |
| Terminology compliance | ✅ Verified across dashboard UI and all email templates |
| Error handling | ✅ 8 scenarios tested directly against the live API, all handled gracefully |
| Infrastructure (VPS/DNS/TLS/SMTP) | ❌ Not started — explicitly out of scope for this phase per standing instructions |
| Accessibility | ⚠️ Partially fixed (icon buttons); systemic form-label gap remains |
| Full localization | ⚠️ Guarantor portal unlocalized; others complete |

**Overall: the product is ready for a supervised pilot once the infrastructure blockers above are closed. It is not yet ready for a public, self-serve launch** — primarily for operational (not product) reasons.
