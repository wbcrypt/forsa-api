# FORSA Manual Testing Guide

Everything needed to start testing immediately: confirmed stack health, exact URLs, working demo accounts, step-by-step scenarios with expected results, and what to do if something breaks. Use `MANUAL_TESTING_LOG.md` alongside this guide to record results as you go.

---

## 1. Stack Health — Confirmed

Checked immediately before this guide was written:

| Check | Result |
|---|---|
| All 13 containers running | ✅ (api, dashboard, student, guarantor, university, partner, finance, homepage, nginx, postgres, redis, minio, mailhog) |
| Container restart counts | ✅ 0 restarts on every application container (postgres shows 1, from initial startup ordering — not a crash loop) |
| API health endpoint | ✅ `{"status":"ok"}` |
| Database connectivity | ✅ |
| MailHog (email capture) | ✅ reachable |
| All 7 web portals load (homepage + 6 apps) | ✅ HTTP 200, zero browser console errors on initial load |

**One thing you'll notice, not a bug:** the login endpoint is rate-limited to 5 attempts per 15 minutes per IP address, specifically to prevent brute-force password guessing. If you see `429 Too Many Requests` while testing, it means the limiter is working correctly — wait a few minutes and continue. This was triggered repeatedly during this guide's own preparation from rapid automated testing.

---

## 2. Exact URLs

| Portal | URL |
|---|---|
| Public Website | http://forsa.tn |
| Student Portal | http://student.forsa.tn |
| Guarantor Portal | http://guarantor.forsa.tn |
| University Portal | http://university.forsa.tn |
| Partner Portal | http://partner.forsa.tn |
| Admin Dashboard | http://admin.forsa.tn |
| Finance Portal | http://finance.forsa.tn |
| MailHog (email inbox) | http://localhost:8026 |
| API health check | http://localhost:3000/api/v1/health |

**Before you start:** these domains only resolve if your machine is set up to route them to `127.0.0.1`. If typing them into a normal browser doesn't work, add this to `/etc/hosts`:
```
127.0.0.1 forsa.tn student.forsa.tn guarantor.forsa.tn university.forsa.tn partner.forsa.tn admin.forsa.tn finance.forsa.tn
```

---

## 3. Demo Accounts

Every password below was just reset to a known value so you can log in immediately. `admin@forsa.tn` keeps its original real password.

| Role | Email | Password | What to test with this account |
|---|---|---|---|
| Student (Silver, active, payment due) | `yassine.trabelsi@example.tn` | `ForsaDemo2026!` | Dashboard once an application is already active; a real payment due; the Digital Pass showing Silver; has a linked, active guarantor already. |
| Student (Bronze, rejected application) | `karim.bouazizi@example.tn` | `ForsaDemo2026!` | The rejection soft-landing screen; the "Apply Again" button; confirms Bronze membership stays intact after a rejection. |
| Student (Bronze, application under review) | `sarra.jendoubi@example.tn` | `ForsaDemo2026!` | A request currently awaiting a decision; good pair with the Admin scenario below — approve or reject this one live and watch her dashboard/pass update in real time. |
| Student (Gold, fully active) | `mehdi.gharbi@example.tn` | `ForsaDemo2026!` | Gold-tier dashboard/pass appearance; fully active student view. |
| Guarantor (active, linked to Yassine) | `guarantor.trabelsi@example.tn` | `ForsaDemo2026!` | The guarantor portal's own dashboard — linked student, application status, payment schedule. |
| University | `contact@utm.tn` | `ForsaDemo2026!` | Université de Tunis El Manar's own students/applications; the Confirm Enrollment action. |
| Partner | `contact@educonnect.tn` | `ForsaDemo2026!` | Referral list scoped to this partner only. |
| Admin (Super Admin — full access) | `admin@forsa.tn` | `6ON4DNbBd8aFYlgj` | Everything: Membership Queue, Applications, guarantor status, Audit Log, all reports. |
| Finance | `finance@forsa.tn` | `ForsaDemo2026!` | Payments, receipt verification, collections, finance reports only (a narrower role than Admin — good for confirming permission boundaries). |

All accounts use tenant `c34e6cc9-8135-4258-821d-8c30bec23c88` (auto-filled by each portal's login form — you shouldn't need to type it).

---

## 4. Test Scenarios

Recommended order: **A → B → C → D → E → F → G**. A and B use a brand-new account you create yourself (the real first-time-user path); C onward can reuse the demo accounts above.

### Scenario A — New Student Journey

| Step | Action | Expected Result |
|---|---|---|
| A1 | Go to http://forsa.tn | Homepage loads, shows the three membership tiers and a "Join FORSA" CTA |
| A2 | Click "Join FORSA" | Lands on the public Membership Request form (student.forsa.tn/join) |
| A3 | Fill in the form with a real-looking new email (e.g. `test.yourname.today@example.tn`) and submit | Confirmation shown; no login created yet |
| A4 | Check MailHog (http://localhost:8026) | A "Membership Request Received" email arrived at that address |
| A5 | Log into Admin (`admin@forsa.tn`), go to Membership Queue | Your new request appears as Pending |
| A6 | Approve it | Status changes to Approved; a FORSA ID is shown |
| A7 | Check MailHog again | A "Welcome to FORSA — Set Your Password" email arrived, with a set-password link |
| A8 | Click the link, set a password | Confirmation shown, redirected toward login |
| A9 | Log in with your new email + password | Lands on the Student Dashboard |
| A10 | Look at the Dashboard | See a **checklist** ("Your FORSA Journey"): Membership Approved, FORSA ID, Digital Pass all checked; "Complete Profile" highlighted as the next step |

### Scenario B — Bronze to Tuition Facilitation (continue with the same account from Scenario A)

**Updated in Phase 14 (Final Case Flow Refinement)** — the validated final V1 workflow. The wizard now has 5 steps; there is no document upload anywhere in it, and no field anywhere lets you type a tuition amount.

| Step | Action | Expected Result |
|---|---|---|
| B1 | On the Dashboard, click the checklist's current step ("Complete Profile") | Goes to Profile page |
| B2 | Fill in the remaining profile fields, save | Back on Dashboard, checklist now shows "Complete Profile" done, "Invite Guarantor" highlighted next |
| B3 | Click through to Apply (or `/apply` directly) | 5-step wizard begins: Your Profile |
| B4 | Fill in personal info, select a university, then select a program from the dropdown | **No free-text program field exists** — if the university has no programs configured, you'll see an amber notice instead of a dropdown. Once a program is selected, a **read-only "Tuition amount" row appears** — try to find a way to type into it; there isn't one |
| B5 | Select a requested plan — Silver or Gold | A panel appears showing plan structure (months), estimated monthly payment, the 30 TND/month administrative fee, and the total — the numbers should update if you switch between Silver and Gold |
| B6 | Try clicking Next without checking the fee acknowledgment | Blocked with an error |
| B7 | Check "I understand that FORSA charges 30 TND/month as an administrative platform fee," optionally answer "Why are you choosing FORSA?", continue | Step 2: Financial Situation |
| B8 | Fill in financial questions and continue | Step 3: Guarantor |
| B9 | Fill in guarantor first name, last name, email, continue | Step 4: Legal Consent |
| B10 | Accept all consent items, continue | Step 5: AI Interview begins |
| B11 | Complete the interview | Confirmation screen; **check for a guarantor-invite warning banner** — if you see one, the invite failed and needs sending manually from `/guarantor` |
| B12 | Check MailHog | A "You've Been Invited as a FORSA Guarantor" email arrived — sent only now, after the application was created, not earlier |
| B13 | Log into Admin, find your new application (Applications list) | Notice the **Queue** column — should show a tag like "Ready for Review" once it reaches Under Review |
| B14 | Open the application → **Case Summary tab** | See the new **Case Request** card (requested plan, system-loaded tuition, plan structure, estimated monthly payment, fee acknowledgment) and an **Internal FORSA Stability Score** card reading "Not yet generated — computed automatically once the guarantor completes their Financial Responsibility Profile" |
| B15 | Approve at Silver or Gold tier | Confirm the tier selector is required before confirming — note this is the admin's own decision, independent of what the student requested in B5 |
| B16 | Back in the Student Portal, refresh the Dashboard | Membership tier tile now shows Silver/Gold — matching whatever the admin picked, automatically, with no separate "upgrade" step |
| B17 | Go to `/pass` | Digital Pass visually reflects the new tier |

**Try to break it:** open your browser's dev tools, find the network request for `POST /applications/me`, and see if you can intercept/resend it with a forged `tuitionAmount`. It should have no effect — the created application should always show the real program's tuition amount.

**Alternative guarantor path:** a guarantor can also be invited independently at any time via the standalone `/guarantor` page (reachable from the Dashboard checklist) — useful before starting an application, or to replace one who declined. Both paths send the identical invitation.

### Scenario C — Guarantor Journey

| Step | Action | Expected Result |
|---|---|---|
| C1 | Open the invite link from Scenario B's email (or invite a fresh one from any Bronze+ student account) | Guarantor Portal shows a preview: who invited you, for whom — before you commit to anything |
| C2 | Click Accept, set a password | Account created; you're automatically logged in |
| C3 | Look at the guarantor dashboard | Shows the linked student's name and application status |
| C4 | **Decline test (use a second, fresh invite):** open a new invite link and click Decline instead | Confirms decline with an optional reason; **no account is created** — try logging in with that email afterward and confirm it fails |
| C5 | **Resend test:** as the student who sent the still-pending invite, click "Resend Invitation" from `/guarantor` | A new email arrives; the old invite link (if you saved it) should now say "invalid" if you try it |
| C6 | On the guarantor dashboard, look for the "Statut de mon dossier (Case)" card | **Updated in Phase 14** — shows two checkpoints (Profil financier, Réunion — no separate Documents checkpoint; paperwork is verified in person at the meeting instead) and a single next-action line |
| C7 | Click "Compléter mon profil financier" and fill in the Financial Responsibility Profile (salary range, marital status, dependents, home ownership, etc.), save | Checkpoint flips to done; the next-action line updates. **Phase 14:** this save also triggers the internal FORSA Stability Score computation for the linked application |
| C8 | As admin, open this guarantor's linked application → Case Summary tab | The exact same Financial Responsibility Profile values you just entered as the guarantor should appear in the Guarantor Summary card (same data, not a re-entry) — and the **Internal FORSA Stability Score** card should now show a real score, 4 sub-scores, risk/positive factors, and suggested meeting questions instead of "Not yet generated" |
| C9 | Click the AR/FR/EN switcher in the guarantor portal's header | **New in Phase 14** — the whole layout should mirror to right-to-left for Arabic, and the Case Status card / Financial Profile form should translate. (The pre-existing student-summary card and payment KPIs below it remain French-only for now — a known, documented gap, not something to log as a new bug.) |

### Scenario D — Admin Journey

| Step | Action | Expected Result |
|---|---|---|
| D1 | Log in as `admin@forsa.tn`, go to Membership Queue | See pending/approved/rejected requests |
| D2 | Approve one, reject another (use test data, not a real demo account) | Approved one gets Bronze + email; rejected one gets an explanatory email (no account created) |
| D3 | Go to Applications | See the full list with Status and **Queue** columns |
| D4 | Click the "Missing Guarantor" filter chip | Only applications with no guarantor and an active review status should appear |
| D5 | Open Sarra Jendoubi's application (`under_review`) | Review her AI report / documents |
| D6 | Approve her at a tier, or reject her | Watch her `membership_status` / rejection state change — log into her account afterward (or check the Students list) to confirm |
| D7 | Go to Audit Log | Every action you just took (D2, D6) should appear with your identity and a timestamp |
| D8 | Open any application, click the "📋 Case Summary" tab | Shows the **Case Request** card (requested plan, system tuition, fee acknowledgment — Phase 14), Student Summary, Guarantor Summary, the **Internal FORSA Stability Score** card (Phase 14), and Meeting Status in one place — no need to hop across Documents/Payments/AI Report tabs to reconstruct the picture |
| D9 | From the Case Summary tab, schedule a meeting (date/time, office location) | Both the student and the guarantor should receive a "Your FORSA Activation Meeting" email in MailHog with the same reference number, date, location, and **assigned officer name** (Phase 14) — and the email should explicitly state that original documents are verified in person |
| D10 | Check the required-paperwork line in that email | Should read something like: Student — National ID (CIN); Guarantor — National ID (CIN), employment/income proof, and a signed كمبيالة (Phase 14 wording, not the old 4-document list) |
| D11 | Confirm the meeting, then try Reschedule | Confirming updates the status in place; rescheduling issues a **new** reference number (check MailHog for a second email) rather than silently editing the old one |
| D12 | Check the student's `/application` page and the guarantor's dashboard | Both should show the same meeting date/time/location/reference number you just scheduled |

### Scenario E — University Journey

| Step | Action | Expected Result |
|---|---|---|
| E1 | Log in as `contact@utm.tn` | Dashboard shows only Université de Tunis El Manar's own students |
| E2 | Try to view another university's data (if you know another university's application ID, try loading it directly) | Should fail — this account should never see another university's students |
| E3 | Find an application at `contract_signed` status | Use "Confirm Enrollment" — should succeed |
| E4 | Try the same action on an application NOT at `contract_signed` | Should be rejected — this is the one write action this portal has, and only at the right moment |
| E5 | Export a report | CSV/PDF download of this university's own applications |

### Scenario F — Partner Journey

| Step | Action | Expected Result |
|---|---|---|
| F1 | Log in as `contact@educonnect.tn` | Dashboard shows only this partner's own referrals |
| F2 | Check the Commissions page | **Known limitation** — a commission only appears here if one was manually inserted; there is currently no automatic trigger. Don't be surprised if it's empty; see §7 below. |

### Scenario G — Finance Journey

| Step | Action | Expected Result |
|---|---|---|
| G1 | Log in as `finance@forsa.tn` | Dashboard shows payments/collections only — try navigating to Membership Queue or Applications directly by URL; should be blocked (this role holds a narrower permission set than Admin) |
| G2 | Go to Payments / Verify | Find a receipt awaiting verification |
| G3 | Verify it | Status moves to Confirmed; check the student's payment schedule reflects it |
| G4 | Go to Collections / Late | See overdue installments listed |
| G5 | Go to Reports | Finance/collections reports render with real numbers |

---

## 5. What to Write Down If Something Fails

For every failure, note in `MANUAL_TESTING_LOG.md`:
- **Role** you were testing as
- **Step** (use the scenario/step codes above, e.g. "B10")
- **Expected result** (copy from this guide)
- **Actual result** (what actually happened — be specific: exact error text, what showed instead)
- **Severity** (see scale below)
- **Screenshot** (file name/path if you took one)
- **Notes** (anything else — browser used, whether it reproduced twice, etc.)

### Severity Scale

| Severity | Meaning |
|---|---|
| **Critical** | Blocks the pilot or corrupts a business process (e.g., a wrong membership tier gets assigned, a payment silently fails to record, an account gets created that shouldn't exist) |
| **High** | A user gets stuck with no way forward, or would reasonably lose trust in the platform (e.g., a broken link, a form that silently fails to submit, a confusing dead end) |
| **Medium** | Confusing but usable — the user can still get where they need to go, just not smoothly |
| **Low** | Polish — wording, spacing, a minor visual inconsistency |

---

## 6. Known Limitations

These are intentionally incomplete or out of scope — **not bugs**, don't log them as failures unless they behave differently from what's described here:

1. **Partner commissions never appear automatically.** The calculation logic is correct and tested, but nothing currently triggers it. A commission only exists if someone inserts it directly in the database.
2. **No SMS or push notifications are ever sent**, despite the system being able to display them if they existed. Every real notification today is email-only (visible in MailHog locally).
3. **Only two staff roles exist** (`SUPER_ADMIN`, `FINANCE_TEAM`) — there's no "reviewer who can't manage users" type of role yet. Any admin account you're given for testing beyond Finance holds full authority.
4. **No renewal flow.** A returning/renewing student can't flag their application as a renewal from the UI yet — every self-submitted application is treated as new.
5. **Fraud-flagged accounts have no reinstatement path.** This is currently a one-way, terminal state by design.
6. **Konnect (online card payment)** exists in the code but was not part of this testing pass — only the manual bank-transfer-plus-receipt flow is confirmed working.
7. **Unclaimed Bronze accounts never expire.** If you approve a Membership Request and never click the set-password link, that account just sits there — no automatic cleanup exists yet.
8. **A handful of pre-existing test/demo accounts** (`test.student1@example.tn` and similar) exist in the database from earlier development sessions — harmless leftovers, not part of the intended demo set. Don't test with these; use the accounts listed in §3 instead.
9. **`amira.bensalah@example.tn` shows Bronze membership despite having an `active_student` application** — this is stale seed data created before the automatic tier-assignment fix existed, not a live bug. If you see this exact account in this exact state, it's already known; if you see the *same pattern* on an account you just processed yourself (approved an application and the tier didn't update), that would be a real, new, Critical-severity finding — log it.
10. **The student portal's in-app `/notifications` page is currently always empty.** It's correctly built and correctly wired to its query — there's simply no code path that ever creates the kind of notification record it's looking for (every real notification is sent by email, not "in-app"). Don't log this as a bug; it's documented in `FORSA_OPERATIONS_MANUAL.md` §11.
11. **The Admin Applications page's queue-tag filter chips only filter the current page** of results, not the full dataset across pages — accurate at the pilot's current scale (a handful of applications), but if you load a page with many applications and page forward, the filter resets per page.
12. **Uploading a document only gets it to "uploaded," not "verified."** A staff member must review it (Documents tab → mark Verified) before the Completeness Checklist shows "Ready for Stage 1" — this is an intentional staff gate, not a bug.
13. **If you click "Run Pipeline" instead of manually approving,** it may block at Stage 3 with "no active university agreement found" for a university that doesn't have one on file. That's unrelated to document/guarantor completeness (Stage 1, which should now pass) — it's a separate, pre-existing requirement. Use the manual Advance/Approve action instead if you just want to test the Silver/Gold assignment.
14. **Any new university you add for testing needs at least one program seeded** (`programs` table, with a real `tuition_amount` set — Phase 14) before a student can select it in the Apply wizard's Program field. **Updated in Phase 14:** there is no longer a free-text fallback at all — if a university has zero programs configured, the student sees an amber "no programs configured" notice and genuinely cannot proceed, by design (tuition must come from a real program's configuration).
15. **(Phase 13) A guarantor's `documents_remaining`/`documentsStatus` on the Case Status card has no real upload flow behind it — and, as of Phase 14, has no meaningful path to become "verified" digitally at all**, since paperwork is now verified in person at the meeting instead. This field is effectively vestigial going forward; don't log it as a bug if it shows "pending" indefinitely.
16. **(Phase 13) Scheduling a meeting is not gated by `current_status`** — you can schedule one on any application regardless of its stage (deliberately; see `CASE_MANAGEMENT_ARCHITECTURE.md`'s state machine section). Don't be surprised if it's possible to schedule a meeting on an application that isn't actually at Pre-Approval yet — that's expected in this implementation, not a bug to log.
17. **(Phase 14) The backend-computed "next action" sentence (student Application page and guarantor Case Status card) is always in English**, regardless of the viewer's selected language — a known, documented gap (`PHASE14_FINAL_CASE_FLOW_REPORT.md`'s remaining risks), not something to log as a new bug.
18. **(Phase 14) The guarantor portal's newly-added language switcher only translates the Case Status card and Financial Profile form.** The rest of that dashboard (student summary card, payment KPIs, payment ledger) remains hardcoded French regardless of which language you select — a known, pre-existing gap this phase didn't fully close, not a regression.
19. **(Phase 14) Silver = 10 months, Gold = 12 months is a hardcoded assumption**, not configurable via any policy screen. If you need a different split for a real pilot, it currently requires a code change (`stability-score.util.ts`'s `PLAN_MONTHS`, mirrored client-side in `ApplyPage.tsx`).
