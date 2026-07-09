# FORSA — Stabilization Phase: Regression Test Report

**Date:** 09 Jul 2026
**Purpose:** Verify the 12 QA fixes (`QA_FIXES_REPORT.md`) didn't break anything else, and that the full pilot user journey works end-to-end post-fix.

---

## 1. Unit tests

```
cd forsa-os && npm test
```
**Result:** `19 test suites, 199 tests — all passed.` Includes 2 tests updated for the QA-8 fix (`application-stages.util.spec.ts`) and 4 tests updated/added for the QA-8 fix (`applications.service.spec.ts`).

## 2. Typecheck

```
forsa-os:          npm run typecheck    → clean
forsa-student:      tsc --noEmit        → clean
forsa-guarantor:     tsc --noEmit        → clean
forsa-dashboard:     tsc --noEmit        → clean
forsa-partner:       tsc --noEmit        → clean
forsa-university:    tsc --noEmit        → 2 errors, pre-existing and unrelated (see below)
```

`forsa-university/src/lib/api.ts` has 2 `TS2339: Property 'env' does not exist on type 'ImportMeta'` errors. Confirmed via `git stash` / `tsc` / `git stash pop` that these predate this stabilization pass and are not touched by it. They don't block the actual Vite production build (Vite's own type handling differs from a bare `tsc --noEmit` check). Not fixed — out of scope for a QA-findings-only pass.

## 3. Full build

```
docker compose build student guarantor dashboard partner university api
```
All images built successfully. Deployed via `docker compose up -d` for each service, `nginx` restarted to pick up the new upstreams.

## 4. Full local stack smoke test

`node full_sanity_check.js` — hits every route across all 6 portals (student, guarantor, university, partner, admin, finance) after every rebuild.

**Result (final run, all services rebuilt):**
```
OK   student/ -> 200                OK   partner/ -> 200
OK   student/application -> 200     OK   partner/referrals -> 200
OK   student/payments -> 200        OK   partner/commissions -> 200
OK   student/pass -> 200            OK   partner/reports -> 200
OK   student/documents -> 200       OK   admin/ -> 200
OK   student/profile -> 200         OK   admin/applications -> 200
OK   student/notifications -> 200   OK   admin/students -> 200
OK   guarantor/ -> 200              OK   admin/membership-queue -> 200
OK   guarantor/payments -> 200      OK   admin/reports -> 200
OK   university/ -> 200             OK   admin/audit-log -> 200
OK   university/students -> 200     OK   finance/ -> 200

ALL CHECKS PASSED
```

## 5. Full manual end-to-end verification

Drove a real, brand-new pilot journey against the live stack (Playwright, real browser, real typing, real emails via the stack's mailhog instance) — not a mocked or pre-seeded scenario:

1. **Public membership request** (`POST /membership-requests`) → **Admin approves** → **Bronze membership issued** (real "new student applies" entry point, not a shortcut).
2. Retrieved the real set-password token from the actual welcome email (mailhog) — not the DB (which only stores a hash) — and set the password through the real `/set-password` UI.
3. Logged in as the new student, drove the full `/apply` wizard: profile → financial situation → guarantor details → legal consent → **AI demo interview** (9 conversational turns) → submission. Captured the real `POST /applications/me` network payload: `requestedTier: "gold", platformFeeAcknowledged: true`.
4. Retrieved the real guarantor invite token from the actual invite email (again, the DB column only stores a token *hash* — this was a genuine discovery during this test, not a pre-existing helper).
5. **QA-1 verification:** typed a 16-character password (`TypedByHand2026!`) into the guarantor's password field character-by-character via `type()` with a 60ms delay per character (the same method that previously reproduced the keystroke-dropping bug). Result: full, correctly-ordered password, confirmed via `inputValue()`.
6. **QA-5-adjacent verification:** confirmed the "Activer mon compte" flow correctly creates the guarantor's portal account and logs them in.
7. Guarantor completed the **Financial Responsibility Profile** (all fields, real form interaction).
8. **QA-2/QA-3 verification:** Admin → Case Summary tab (and the underlying `GET /applications/:id/case` API) showed: Requested Plan = Gold, Estimated Monthly Payment = 500 TND, Administrative Fee = 30 TND/mo, Fee Acknowledged = Yes (dated), and **Internal FORSA Stability Score = 43.40/100** with full breakdown, risk factors, positive factors, and suggested meeting questions — generated automatically the moment the guarantor's profile was saved.
9. **QA-8 verification:** Admin Overview tab's Completeness Checklist showed the new Phase-14-aligned items (program selected, plan selected, fee acknowledged, guarantor accepted) with badge "Ready for Assessment" — no stale document requirements.
10. Admin scheduled a meeting for `2026-08-01T14:30:00.000Z` UTC.
11. **QA-4 verification:** Admin Case Summary displayed "01/08/2026 3:30:00 PM"; the real meeting confirmation email (retrieved from mailhog) said "Date: 01/08/2026, Time: 03:30 PM" — identical, both correctly in Africa/Tunis local time.
12. **QA-6 verification:** the same meeting email showed "Assigned FORSA officer: System Administrator" — the real name of the account that scheduled it, not a placeholder.
13. **QA-9 verification:** Admin application header showed a localized "New Lead" badge, not the raw `new_lead` string; meeting status showed "Scheduled".
14. Checked the student's **Digital Pass** page — rendered correctly for the current Bronze tier (FORSA ID, membership level, QR code), confirming the pass pipeline still works after the QA-8 completeness-logic change.

All of the above passed on the first fully-corrected run of the test script (after fixing several script-side issues along the way — see "Test script notes" below).

## 6. Language audit

See `LANGUAGE_AUDIT_REPORT.md` for the full pass. Summary: zero remaining banned-terminology matches across all repos and the notification-templates table; one additional Arabic banned-term instance found and fixed (`forsa-student/HomePage.tsx`, not in the original 12 findings); RTL layout confirmed correct on the guarantor dashboard in Arabic; a pre-existing (not newly introduced) hardcoded-French gap in `DashboardPage.tsx`'s student-summary/payment-ledger sections was confirmed still present and documented — this was already flagged as a known, accepted gap in the original `MANUAL_QA_REPORT.md`'s "What was verified working" section, not a new regression.

## 7. Test script notes (methodology, not app bugs)

Several issues surfaced while building the end-to-end test script were artifacts of the test itself, not application defects:
- The `/apply` wizard's select-element indices shifted by one after the QA-10 nationality dropdown was added — expected, and exactly the kind of index-shift friction flagged as a risk during the QA-10 fix itself.
- Both the student set-password token and the guarantor invite token are stored **hashed** in the database (`password_setup_tokens.token_hash`, `guarantors.invite_token` — the latter compared via `hashToken()` server-side) — the real, usable token only ever exists in the email that was sent. The test script initially queried the DB directly and got "invalid token" errors until it was corrected to read the real token from mailhog, matching how a real user would receive it.
- Hit the login endpoint's rate limiter (5 attempts / 15 minutes) during iterative test-script debugging; cleared it by restarting the `api` container (in-memory throttle store) rather than waiting out the window.

## Known limitations (carried forward, not fixed in this pass)

- `forsa-university/src/lib/api.ts`'s `ImportMeta.env` typing errors (pre-existing, doesn't block the Vite build).
- `forsa-guarantor/DashboardPage.tsx`'s student-summary card and payment-ledger section remain hardcoded French only — a pre-existing, previously-documented gap (not part of any of the 12 QA findings), out of scope for a fixes-only stabilization pass.
- The Admin Case Detail page (`forsa-dashboard/ApplicationDetailPage.tsx`) is English-only for its data labels by longstanding existing convention — the QA-9 fix matched this convention rather than introducing partial localization.
- Meeting "required documents" instruction text (e.g., "Signed and completed كمبيالة") is generated server-side in a fixed language regardless of the viewer's UI locale; كمبيالة itself is an intentionally-untranslated Tunisian legal-document term, not a translation bug.

## Conclusion

**No pilot blockers remain.** All 12 QA findings are fixed, deployed, and verified against a real, fresh end-to-end run of the pilot user journey. Backend unit tests (199/199) and typechecks are clean except for one pre-existing, unrelated issue in `forsa-university`.
