# FORSA — Manual QA Report (Human-Simulated Pass)

**Tester:** Claude (Cowork), acting as a manual QA tester — real browser, real clicks, real typing, no code read/modified.
**Date:** 09 Jul 2026
**Stack tested:** Local Docker demo (`forsa-deploy-stack`), all 7 containers + nginx, as set up by Claude Code's Phase 14 session earlier the same day.
**Method:** Followed `MANUAL_TESTING_GUIDE.md`'s Scenario A → G using a brand-new student account created live (Amina TestQA) plus a brand-new guarantor account (Sami TestQA), then the existing demo accounts for University/Partner/Finance. Cross-checked every candidate issue against `KNOWN_ISSUES.md`, `PILOT_BLOCKERS_STATUS.md`, and `MANUAL_TESTING_GUIDE.md` §6 (Known Limitations) before logging it — nothing below duplicates an already-documented gap unless explicitly noted as "confirmed still present."

---

## Summary

| # | Finding | Portal(s) | Severity | Blocks pilot? | Status |
|---|---|---|---|---|---|
| QA-1 | Guarantor password field drops keystrokes — new guarantor may not be able to set a password at all | Guarantor | **Critical** | **Yes** | ✅ **Fixed** |
| QA-2 | Admin Case Summary "Case Request" card doesn't show the student's requested plan or fee acknowledgment | Admin | High | Likely yes | ✅ **Fixed** |
| QA-3 | Internal FORSA Stability Score never computed despite guarantor's Financial Responsibility Profile showing "Completed" | Admin / Guarantor | High | Likely yes | ✅ **Fixed** |
| QA-4 | Meeting time in the confirmation email doesn't match the time scheduled in Admin (1-hour offset) | Admin → email | Medium-High | Should fix | ✅ **Fixed** |
| QA-5 | Guarantor invite link silently ignored if a different guarantor is already logged in | Guarantor | Medium-High | Should fix | ✅ **Fixed** |
| QA-6 | Meeting email shows placeholder "A FORSA officer will be assigned" instead of the real officer name | Admin → email | Medium | No | ✅ **Fixed** |
| QA-7 | "Loan" / "Prêt" / "financement" terminology appears in live UI, contradicting the explicit brand ban | Student, Guarantor, Admin | Medium | No, but compliance risk | ✅ **Fixed** |
| QA-8 | Admin Overview tab's Completeness Checklist still shows the old 4-document requirement (pre-Phase14) | Admin | Low-Medium | No | ✅ **Fixed** |
| QA-9 | Raw status codes shown unstyled (`new_lead`, `scheduled`) | Guarantor, Admin | Low | No | ✅ **Fixed** |
| QA-10 | Apply wizard's "Nationalité" field shows a raw ISO code instead of a proper label/dropdown | Student | Low | No | ✅ **Fixed** |
| QA-11 | Partner Commissions page mixes untranslated English labels into an otherwise French page | Partner | Low | No | ✅ **Fixed** |
| QA-12 | Arabic toggle shows a single truncated letter ("ع") instead of a readable label | University, Partner | Info | No — same area as known K-25 | ✅ **Fixed** |

**Everything else tested passed exactly as documented** — see "What was verified working" at the end.

**Stabilization pass (09 Jul 2026):** all 12 findings fixed, rebuilt, redeployed, and re-verified live against a fresh end-to-end run (new membership request → Bronze approval → password set → apply wizard → AI interview → guarantor invite/accept/financial profile → admin Case Summary → meeting scheduling → Digital Pass). See `QA_FIXES_REPORT.md` for per-finding detail and `REGRESSION_TEST_REPORT.md` for the full test record. No pilot blockers remain.

---

## Detailed findings

### QA-1 — [CRITICAL, PILOT-BLOCKING] Guarantor password field drops keystrokes

- **Portal:** Guarantor
- **URL:** `http://guarantor.forsa.tn/invite/{token}` (the "Accepter et créer mon compte" step)
- **Role/account:** Brand-new guarantor invite (Sami TestQA, invited by student Amina TestQA)
- **Steps to reproduce:**
  1. Get a fresh guarantor invite link from the invite email.
  2. Open it in a fresh (logged-out) browser session and click "Accepter et créer mon compte."
  3. Click into the "Mot de passe" field and type a password.
- **Expected:** Every typed character appears in the field.
- **Actual:** Only 1–2 of the typed characters register; the rest are silently dropped. Reproduced 4 separate ways:
  1. Bulk synthetic typing of a 20-char password → 1 character landed.
  2. Select-all + delete + retype → field ended up empty.
  3. Single click + bulk type → 1 character landed.
  4. Individual keypresses with a full 1-second pause between each of 4 letters → still only 2 landed.
  Setting the field's value directly in one operation (equivalent to paste/autofill) works perfectly — the component *can* hold a correct value, so this is specifically about the character-by-character typing/onChange path, not a fundamentally broken field.
- **Isolated to this page:** the University, Partner, and Finance login password fields all accepted normal typing correctly in the same session — this bug is local to the guarantor invite/set-password component.
- **Why it's pilot-blocking:** if a real human guarantor experiences the same character loss (very likely, since even deliberate 1-second-spaced keystrokes failed), they cannot create their account, which blocks the entire guarantor step — and a guarantor is required for every Tuition Facilitation Plan.

### QA-2 — [HIGH] Admin Case Summary "Case Request" card is empty

- **Portal:** Admin
- **URL:** `http://admin.forsa.tn/applications/{id}` → Case Summary tab
- **Role:** Super Admin (`admin@forsa.tn`)
- **Steps to reproduce:**
  1. As a student, go through the Apply wizard: select a program, select **Gold**, check the fee-acknowledgment box, complete Guarantor/Consent/AI Interview steps, submit.
  2. As Admin, open the resulting application → Case Summary tab → "Case Request" card.
- **Expected** (per `PHASE14_FINAL_CASE_FLOW_REPORT.md`): Requested Plan = Gold, Plan Structure = 12 mois, Estimated Monthly Payment = 208.33 TND, Fee Acknowledged = yes.
- **Actual:** Requested Plan "—", Plan Structure "—", Estimated Monthly Payment "—", Fee Acknowledged "Not yet" — even though System-Loaded Tuition (2 500 TND) and Administrative Fee (30 TND/mo) on the same card display correctly, and the application itself was created successfully (confirmation email received, visible in the Applications list).
- **Reproduced twice** (fresh page load and a full hard navigation/reload).
- **Open question for the fix:** is `requested_tier`/`platform_fee_acknowledged_at` actually being saved and this is a read/render bug in the Case Summary component, or is it not being saved at all (which would also mean the "createForSelf rejects submission without fee acknowledgment" guarantee from Phase14 isn't really being enforced)? Worth checking the DB row directly before deciding the fix.

### QA-3 — [HIGH] Internal FORSA Stability Score never computes

- **Portal:** Admin / Guarantor
- **URL:** `http://admin.forsa.tn/applications/{id}` → Case Summary tab, "Internal FORSA Stability Score" card
- **Steps to reproduce:**
  1. As the guarantor, fill in and save the Financial Responsibility Profile ("Compléter mon profil financier").
  2. Confirm the guarantor dashboard shows the checkpoint flip to done.
  3. As Admin, open the same application's Case Summary tab.
- **Expected** (per `PHASE14_FINAL_CASE_FLOW_REPORT.md`, explicitly verified in that report): "a real guarantor completed their profile via the portal and the score, breakdown, and AI explanation appeared immediately in the admin Case Summary."
- **Actual:** The Guarantor Summary card correctly shows "Financial Profile: Completed" with all the values I entered (Home Ownership: owner, Monthly Expenses: 800.00, etc.) — but the Stability Score card directly below it still reads "Not yet generated — computed automatically once the guarantor completes their Financial Responsibility Profile," even after a full page reload.
- **Severity note:** this directly contradicts the Phase14 report's own explicit live-verification claim using fresh, independent test data — worth checking whether the auto-trigger (`guarantors.service.ts#recomputeStabilityScore`) is actually being called, or is failing silently.

### QA-4 — [MEDIUM-HIGH] Meeting email time doesn't match what admin scheduled

- **Portal:** Admin → student/guarantor email
- **Steps to reproduce:**
  1. In Admin Case Summary, schedule an Activation Meeting for `20/07/2026 10:00`.
  2. Check the resulting email (MailHog).
- **Expected:** Email states the same time (10:00).
- **Actual:** Admin panel shows "Date & Time: 20/07/2026 10:00:00" correctly, but the email sent to the student says "**Time: 09:00 AM**" — a 1-hour discrepancy consistent with a timezone-handling bug (local time saved/shown in Admin vs. a different offset used when formatting the email).
- **Real-world impact:** student or guarantor could show up at the wrong time for an in-person identity/document verification meeting.

### QA-5 — [MEDIUM-HIGH] Guarantor invite link silently ignored if a different guarantor is already logged in

- **Portal:** Guarantor
- **URL:** `http://guarantor.forsa.tn/invite/{token}`
- **Steps to reproduce:**
  1. While already logged in as guarantor A (e.g. a leftover session on a shared/reused browser), open a fresh invite link intended for guarantor B (a different student's case).
- **Expected** (Scenario C1): "Guarantor Portal shows a preview: who invited you, for whom — before you commit to anything."
- **Actual:** The invite token is silently ignored — the app just shows guarantor A's own existing dashboard, with no indication the invite link was processed at all. Logging out first and revisiting the exact same link correctly shows the invite preview for guarantor B.
- **Impact:** no cross-account data leak was observed (it only ever showed the already-logged-in user's *own* legitimate data), but it's confusing/misleading and could cause a guarantor to think an invite failed, or to act on the wrong case.

### QA-6 — [MEDIUM] Meeting email shows a placeholder instead of the real officer name

- **Portal:** Admin → student/guarantor email
- **Steps:** Same as QA-4 — meeting scheduled by `admin@forsa.tn` (Super Admin).
- **Expected** (per `PHASE14_FINAL_CASE_FLOW_REPORT.md`): "both student and guarantor now receive the assigned officer's name (looked up from `users.full_name`)."
- **Actual:** Email shows generic fallback text "**A FORSA officer will be assigned**" instead of a real name.
- **Likely cause:** `admin@forsa.tn`'s `full_name` may be empty/null in the seeded DB, or the lookup itself isn't returning a value — worth a quick check of both.

### QA-7 — [MEDIUM] "Loan" / "Prêt" / "financement" terminology appears live, contradicting the explicit brand ban

`FORSA_BRAND_GUIDE.md` §10 states: *"Never describe FORSA as: a bank, a lender, a credit institution, **a loan provider**, or a finance company — in any of the three languages, including synonyms (French '**financement**', 'crédit', '**prêt**'... English 'financing', '**loan**', 'credit')."*

Found live in three places:
1. **Student Portal** (`student.forsa.tn/profile`, Financial Profile section) — field labeled **"Existing Loans (TND)"**.
2. **Admin** (`admin.forsa.tn/applications/{id}`, Case Summary → Guarantor Summary card) — same field, same label, surfaced from the guarantor's data.
3. **Guarantor Portal** (`guarantor.forsa.tn`, "Compléter mon profil financier" form) — French equivalent, field labeled **"Prêts existants (TND)"**.
4. Also noticed: the AI Interview's opening message (in demo mode) contains the phrase *"faire une demande de **financement**"* — likely a canned demo-mode string rather than the real AI system prompt, but still user-facing and in violation of the same rule.

`PHASE14_FINAL_CASE_FLOW_REPORT.md` states a terminology audit found "zero pre-existing violations" — that audit was scoped to *new Phase 14 copy* in the three student-facing frontends, so it correctly didn't catch this pre-existing field, which lives outside Phase14's changed files.

### QA-8 — [LOW-MEDIUM] Admin Overview tab's Completeness Checklist is stale (pre-Phase14)

- **Portal:** Admin
- **URL:** `admin.forsa.tn/applications/{id}` → **Overview** tab (not Case Summary)
- **Actual:** The checklist still lists the old 4 required document types (National ID Card, Bac Diploma, University Acceptance Letter, Income Proof) as required/unchecked, with an "Incomplete" badge — even though Phase14 removed the document requirement from Stage 1 entirely and replaced it with `requested_tier` + `platform_fee_acknowledged_at` checks.
- **Note:** the actual pipeline gate itself may still be correct (Phase14's own report claims Stage 1 passes) — this looks like a UI component nobody updated to match the new gate, which will confuse admin staff into thinking documents are still required.

### QA-9 / QA-10 / QA-11 / QA-12 — Low severity / cosmetic

- **QA-9:** Guarantor dashboard header badge shows raw `new_lead`; Admin Meeting Status badge shows raw `scheduled` — both unstyled/untranslated instead of a human label.
- **QA-10:** The Apply wizard's "Nationalité" field is a plain free-text box pre-filled with the raw code `TN`, unlike the Student Profile page's proper "Nationality" dropdown (which shows "Tunisian").
- **QA-11:** Partner portal's Commissions page mixes English labels ("TOTAL RECORDS", "PAID RECORDS") into an otherwise fully French page.
- **QA-12 (informational):** University and Partner portals' Arabic toggle button renders as a single truncated letter ("ع") instead of a full label. This is the same underlying gap as the already-documented **K-25** ("University portal's language switcher doesn't translate content") — confirmed still present, and confirmed to also affect the Partner portal login page the same way. Recommend folding into the K-25 fix rather than treating as new.

---

## What was verified working (no action needed)

- **Scenario A (new student journey):** homepage → "Join FORSA" → membership request → MailHog confirmation email → Admin approval → welcome/set-password email → login → Dashboard checklist. All exactly as documented.
- **Scenario B (Apply wizard):** 5 steps, no document upload anywhere, no free-text tuition field, tuition auto-loads read-only from the selected program, Gold plan math verified correct (2 500 TND ÷ 12 = 208.33 + 30 TND fee = 238.33 TND total), fee acknowledgment required, guarantor invited only after successful submission.
- **Scenario C (guarantor):** invite preview, accept flow (once the QA-1 workaround is applied), Case Status checkpoints, Financial Responsibility Profile save, EN/FR/AR switcher (RTL mirroring confirmed correct on the newly-converted Case Status card; the pre-existing French-only sections below it are exactly the documented, intentional gap — not a new bug).
- **Scenario D (admin):** Membership Queue approve, Applications list, Audit Log (every action correctly attributed with identity + timestamp), meeting scheduling produces a reference number and matching emails to both parties, required-paperwork wording matches the Phase14 template exactly (including the Arabic كمبيالة term).
- **Scenario E (university):** dashboard correctly scoped to the university's own students only.
- **Scenario F (partner):** dashboard and Commissions page correctly scoped to the partner's own referrals; the "commissions don't auto-trigger" behavior matches the documented known limitation exactly.
- **Scenario G (finance):** dashboard correctly scoped to payments/collections; direct URL navigation to admin-only routes (e.g. `/membership-queue`) is blocked/redirected.
- Cross-checked every candidate finding against `KNOWN_ISSUES.md` and `MANUAL_TESTING_GUIDE.md` §6 — no already-documented known limitation was found to behave differently than documented.

---

## Recommended fix order

1. **QA-1** — Guarantor password field (blocks the pilot outright; fix first)
2. **QA-2** and **QA-3** — Case Summary not showing requested plan/fee-ack, and Stability Score not auto-computing (both undermine the core admin review tool Phase14 was built around; likely worth investigating together since both involve data written during the same `createForSelf`/guarantor-profile-save calls)
3. **QA-4** — Meeting time timezone offset (real-world scheduling risk)
4. **QA-5** — Guarantor invite link ignored when already logged in
5. **QA-6** — Officer name placeholder in meeting email
6. **QA-7** — Terminology cleanup (loan/prêt/financement)
7. **QA-8** — Stale Completeness Checklist on Overview tab
8. **QA-9 – QA-12** — Cosmetic/polish, batch together whenever convenient

---

## Suggested task for Claude Code

```
Fix the following issues found during a manual QA pass (see MANUAL_QA_REPORT.md
in forsa-os/implementation/ for full repro steps, screenshots context, and severity):

1. [CRITICAL] Guarantor invite/set-password page (forsa-guarantor): the password
   input drops keystrokes when typed character-by-character (confirmed even with
   1-second delays between keys) but accepts a value set all at once. Find the
   component and check for a re-render/remount happening on every keystroke
   (e.g. a changing `key` prop, or state that resets the input's value from a
   stale prop each render) that's racing with the native input event.

2. [HIGH] Admin Case Summary "Case Request" card (forsa-dashboard reading from
   forsa-os): Requested Plan / Plan Structure / Estimated Monthly Payment / Fee
   Acknowledged all show empty/"Not yet" for a freshly submitted application,
   even though the student selected Gold and checked the fee-acknowledgment box.
   Check whether requested_tier/platform_fee_acknowledged_at are actually being
   persisted by createForSelf, or just not being read back correctly by the
   Case Summary endpoint/component.

3. [HIGH] Stability Score auto-trigger (forsa-os guarantors.service.ts
   recomputeStabilityScore): completing the guarantor's Financial Responsibility
   Profile correctly flips "Financial Profile" to Completed, but the Stability
   Score card never leaves "Not yet generated." Check whether the trigger is
   actually being called on profile save, and whether it's failing silently.

4. [MEDIUM] Meeting scheduling emails show a time 1 hour off from what was
   entered in Admin (10:00 entered → email says 09:00 AM) — timezone handling
   bug between storage/display and email formatting.

5. [MEDIUM] Meeting scheduling emails show "A FORSA officer will be assigned"
   instead of the actual assigned officer's name — check whether the admin
   user's full_name is populated and whether the lookup is wired correctly.

6. [MEDIUM] Guarantor invite links (forsa-guarantor /invite/:token) are
   silently ignored if a different guarantor is already logged in — should
   either show the invite preview regardless (prompting to switch accounts)
   or clearly tell the user they're logged in as someone else.

7. [MEDIUM] Terminology cleanup: rename "Existing Loans (TND)" /
   "Prêts existants (TND)" fields (present in forsa-student profile,
   forsa-guarantor financial profile form, and forsa-dashboard's Guarantor
   Summary card) to avoid "loan"/"prêt" per FORSA_BRAND_GUIDE.md §10 — suggest
   "Other Monthly Debt Obligations" / "Autres engagements financiers mensuels"
   or similar. Also check the AI interview's demo-mode opening message for the
   phrase "demande de financement."

8. [LOW] Admin application detail page's Overview tab Completeness Checklist
   still lists the old 4 required documents (National ID, Bac Diploma,
   University Acceptance Letter, Income Proof) as required/incomplete — update
   it to reflect Phase14's actual Stage 1 checks (requested_tier,
   platform_fee_acknowledged_at) so it doesn't mislead staff.

9. [LOW, batch together] Raw status codes shown unstyled ("new_lead" on
   forsa-guarantor dashboard, "scheduled" on the admin Meeting Status badge);
   forsa-student Apply wizard's Nationalité field is a raw-code text input
   instead of a labeled dropdown like the Profile page's; forsa-partner
   Commissions page has two English labels on an otherwise French page.

Do not touch anything related to the already-documented open items in
KNOWN_ISSUES.md or MANUAL_TESTING_GUIDE.md §6 (Known Limitations) — those are
intentional/out of scope and already tracked separately.
```
