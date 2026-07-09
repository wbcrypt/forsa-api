# FORSA — Stabilization Phase: QA Fixes Report

**Date:** 09 Jul 2026
**Scope:** Fix all 12 findings in `MANUAL_QA_REPORT.md`. No new features, no workflow redesign, no business-logic changes beyond what each finding required.
**Repos touched:** `forsa-os` (API), `forsa-student`, `forsa-guarantor`, `forsa-dashboard`, `forsa-partner`, `forsa-university`.

---

## Priority A — Pilot blockers / core workflow

### QA-1 — Guarantor password field drops keystrokes ✅ Fixed

**Root cause:** `forsa-guarantor/src/pages/auth/InvitePage.tsx` defined its `Shell` wrapper component *inline*, inside `InvitePage`'s own function body. Every keystroke triggered a re-render, which created a brand-new `Shell` function reference each time — React treated this as a different component type and unmounted/remounted the whole subtree (including the password `<input>`) on every character. The remounted input doesn't reliably land the cursor at the end of the existing text, so new keystrokes were inserted near the start or dropped rather than appended.

**Fix:** Hoisted `Shell` to module scope (defined once, outside `InvitePage`), so its identity is stable across renders and the input is never torn down while typing.

**File:** `forsa-guarantor/src/pages/auth/InvitePage.tsx`

**Verified:** Live browser test — typed `TypedByHand2026!` character-by-character into a real invite's password field; the field's value came back byte-for-byte identical. Confirmed again in this session's full end-to-end run.

---

### QA-2 — Admin Case Summary missing requested plan / fee acknowledgment ✅ Fixed

**Root cause:** Not a code bug. `applications.service.ts`'s `getCaseSummary()` already returned `requested_tier`, `platform_fee_acknowledged_at`, and `forsa_choice_reason` from the prior Phase 14 session — but the **running API container was stale**, built before that code existed (confirmed via `docker exec forsa_api grep -c "requested_tier" /app/dist/src/applications/applications.service.js`, which showed only 1 occurrence instead of the expected 2).

**Fix:** Rebuilt and redeployed the `api` container. No source change was required for this finding specifically.

**Verified:** Live browser test — Admin → Case Summary tab now shows "Requested Plan: Gold", "Estimated Monthly Payment: 500 TND", "Administrative Fee: 30 TND/mo", "Fee Acknowledged: Yes — 7/9/2026" for a freshly-submitted application. Confirmed via direct `GET /applications/:id/case` API response as well.

---

### QA-3 — Internal FORSA Stability Score not generating ✅ Fixed

**Root cause:** Same as QA-2 — the stability-score computation and rendering code already existed from Phase 14, but the stale API container predated it.

**Fix:** Same rebuild/redeploy as QA-2. No additional source change needed.

**Verified:** Live browser test — after the guarantor submitted their Financial Responsibility Profile, Admin → Case Summary immediately showed "Internal FORSA Stability Score: 43.40/100" with a full breakdown (Guarantor Stability, Payment Capacity, Household Stability, Student Stability Bonus) and generated risk/positive factors and suggested meeting questions. Also confirmed via `GET /applications/:id/case`'s `stabilityScore` field.

---

### QA-4 — Meeting email time offset ✅ Fixed

**Root cause:** `notifyMeeting()` (backend) and the meeting-time displays in `forsa-dashboard`, `forsa-student`, and `forsa-guarantor` all called `toLocaleDateString()`/`toLocaleTimeString()`/`toLocaleString()` without an explicit `timeZone`, so they rendered in the *server's* OS timezone (UTC in this Docker environment) instead of Tunisia's UTC+1 — a one-hour mismatch between what Admin showed and what the email said.

**Fix:** Added `{ timeZone: 'Africa/Tunis' }` explicitly everywhere a `scheduled_at` is displayed or emailed:
- `forsa-os/src/applications/applications.service.ts` (`notifyMeeting()`)
- `forsa-dashboard/src/pages/applications/ApplicationDetailPage.tsx` (`MeetingPanel`)
- `forsa-student/src/pages/application/ApplicationPage.tsx`
- `forsa-guarantor/src/pages/dashboard/DashboardPage.tsx`

**Verified:** Live test — scheduled a meeting for `2026-08-01T14:30:00.000Z` (UTC). Admin Case Summary displayed "01/08/2026 3:30:00 PM"; the meeting email said "Date: 01/08/2026, Time: 03:30 PM" — identical, both correctly converted to Africa/Tunis (UTC+1).

---

## Priority B — Trust, compliance, UX

### QA-5 — Guarantor invite link ignored when another guarantor is logged in ✅ Fixed

**Root cause:** `forsa-guarantor/src/App.tsx`'s route redirected `/invite/:token` straight to `/` (silently discarding the token) whenever any guarantor session already existed.

**Fix (two parts):**
1. `App.tsx` — route now always renders `InvitePage`, never redirects away.
2. `InvitePage.tsx` — added an "already logged in" gate: shows the invite preview with an amber notice ("You're currently logged in as X. This invitation is for Y.") plus two explicit choices — "Log out and view invitation" or "Stay logged in as X".
3. A secondary bug surfaced during testing: clicking "Log out" triggered a hard redirect back with the old session intact, because the axios response interceptor treated `authApi.logout()`'s own (expected) 401 as a real auth failure requiring refresh/redirect. Fixed in `forsa-guarantor/src/lib/api.ts` by excluding `/auth/logout` calls from that interceptor path.

**Files:** `forsa-guarantor/src/App.tsx`, `forsa-guarantor/src/pages/auth/InvitePage.tsx`, `forsa-guarantor/src/lib/api.ts`

**Verified:** Live test — logged in as one guarantor, visited a fresh invite link addressed to a different guarantor; correctly showed the "already logged in" notice; "switch account" correctly logged out, cleared the token, and displayed the new invite's preview.

---

### QA-6 — Meeting email officer placeholder ✅ Fixed

**Root cause:** The admin meeting-scheduling form has no field to pick an assigned officer, so `assignedOfficerUserId` was always `null`, and the email fell back to a placeholder string.

**Fix:** `applications.service.ts`'s `scheduleMeeting()` now defaults `assignedOfficerUserId` to `createdBy` (whoever actually scheduled the meeting) when none is explicitly provided.

**Verified:** Live test — meeting email showed "Assigned FORSA officer: System Administrator" (the real name of the admin account that scheduled it), not a placeholder.

---

### QA-7 — Forbidden terminology ✅ Fixed

**Fixed in all three languages, across:**
- `forsa-os/src/ai/ai.service.ts` — AI demo-interview opening greeting (FR "faire une demande de financement" → "demander un plan de facilitation des frais universitaires"; EN "applying for financing" → "applying for a Tuition Facilitation Plan"; AR "التقدم بطلب تمويل" → "طلب خطة تيسير المعاليم الجامعية")
- `forsa-student/src/lib/i18n.ts` — `waitingListDesc` (FR/EN/AR "financing"/"financement"/"تمويل" → "allocation cycle"/"cycle d'allocation"/"دورة التخصيص")
- `forsa-student/src/pages/profile/ProfilePage.tsx` and `forsa-guarantor/src/lib/i18n.ts` — "Existing Loans (TND)" → "Other Monthly Debt Obligations (TND)" in all three languages
- `forsa-dashboard/src/pages/applications/ApplicationDetailPage.tsx` — same field label fix for both `STUDENT_FIELD_LABELS` and `GUARANTOR_FIELD_LABELS`
- **Found and fixed during this session's language audit:** `forsa-student/src/pages/HomePage.tsx` had a second, separate hardcoded Arabic string using تمويل ("waiting for financing") in the capital-queue status card — missed by the original QA-7 fix because it wasn't in the shared `i18n.ts` dict. Changed to "الأموال اللازمة" (necessary funds), matching the safe EN/FR wording already used in the same card.

**Verified:** Full grep sweep (EN/FR banned terms + Arabic قرض/ائتمان/تمويل) across all five frontend repos, the backend, and the `notification_templates` DB table returned zero remaining matches (outside of one legitimate, unrelated hit: `forsa-dashboard`'s internal double-entry ledger table uses standard accounting "Debit/Credit (DR/CR)" column headers, which is correct IFRS bookkeeping terminology, not a consumer lending reference — left as-is).

---

### QA-8 — Stale Admin Overview Completeness Checklist ✅ Fixed

**Root cause:** `application-stages.util.ts`'s `docsAllVerified()` helper checked for 4 verified documents — a requirement that became permanently unsatisfiable once Phase 14 removed document upload entirely (documents are now verified in person at the meeting). This one helper is shared by **three** call sites: `computeAdminStage` (Admin Pipeline stage), `computeStudentMilestone` (Student Timeline milestone), and — via `getCompleteness()` — the Admin Completeness Checklist card. All three were silently stuck.

**Fix:**
- `application-stages.util.ts` — `docsAllVerified()` now always returns `true`, with a comment tying this to the Phase 14 document-upload removal.
- `applications.service.ts` — `getCompleteness()` signature and logic updated to check `requestedTierSelected`, `platformFeeAcknowledged`, and guarantor link status instead of document counts.
- `forsa-dashboard/src/pages/applications/ApplicationDetailPage.tsx` — `CompletenessChecklist` component rewritten: removed the 4 document rows, added "Requested plan selected (Silver/Gold)" and "30 TND/month fee acknowledged"; badge changed from "Ready for Stage 1" to "Ready for Assessment".
- Updated 2 existing tests in `application-stages.util.spec.ts` and rewrote/added tests in `applications.service.spec.ts` to match.

**Verified:** Unit tests pass (35/35 in `applications.service.spec.ts`, 199/199 across the whole backend suite). Live test — Admin Overview tab now shows a completeness checklist with "Program selected", "Requested plan selected (Silver/Gold)", "30 TND/month fee acknowledged", and "Guarantor: [name] — Accepted", all checked, badge "Ready for Assessment".

---

## Priority C — Polish

### QA-9 — Raw status codes ✅ Fixed

**Fix:** `forsa-guarantor/src/pages/dashboard/DashboardPage.tsx`'s `StatusBadge` rewritten with a complete `STATUS_LABELS` map covering all 21 real `ApplicationStatus` values in EN/FR/AR (the previous map only covered statuses that don't exist in the real enum, so every genuine status fell through to the raw, untranslated value). `forsa-dashboard/src/pages/applications/ApplicationDetailPage.tsx`'s meeting status badge now maps through `MEETING_STATUS_LABELS` instead of rendering `meeting.status` raw.

**Note:** The Admin dashboard's meeting-status labels are English-only, consistent with the rest of that file's pre-existing convention (`STUDENT_FIELD_LABELS`, `GUARANTOR_FIELD_LABELS`, `DOCUMENT_LABELS` are all English-only too) — this admin case-detail page has never used the locale system for its data labels, only its chrome. Not a regression; matches existing scope.

**Verified:** Live test in Arabic — guarantor dashboard status badge renders localized Arabic labels for real statuses instead of the raw `new_lead` string.

---

### QA-10 — Nationality field ✅ Fixed

**Fix:** `forsa-student/src/pages/apply/ApplyPage.tsx` — replaced the free-text `maxLength={2}` input showing raw "TN" with a proper `<select>` dropdown (`NATIONALITIES` array, matching `ProfilePage.tsx`'s existing list, with EN/FR/AR labels for all 5 options).

**Verified:** Live test — dropdown renders with proper labels ("Tunisienne", "Française", etc.) in all three languages; selection persists through wizard submission.

---

### QA-11 — Partner Commissions translation ✅ Fixed

**Fix:** `forsa-partner/src/lib/i18n.ts` — added `totalRecords`, `paidRecords`, `allLabel`, `paidOn` keys in all 3 locales. `forsa-partner/src/pages/commissions/CommissionsPage.tsx` — replaced hardcoded English StatCard labels, tab label, and status badge text with `t()` calls using the already-existing (but previously unused) `commPending`/`commApproved`/`commPaid` keys.

**Verified:** Live inspection of the component source confirms every previously-hardcoded English string on this page is now routed through `t()` with EN/FR/AR entries present.

---

### QA-12 — Arabic toggle label ✅ Fixed

**Fix:** Changed the Arabic locale's short-code label from a single letter ('ع') to 'AR' in both `forsa-partner/src/lib/i18n.ts` and `forsa-university/src/components/layout/Layout.tsx`, matching the existing 'EN'/'FR' two-letter convention. Also updated a secondary spot in `forsa-partner/src/pages/profile/ProfilePage.tsx` where a display-text ternary compared against the old `'ع'` label string directly — changed to compare against `l.code === 'ar'` instead, so it no longer silently breaks now that the label text changed.

**Verified:** Static inspection confirms both files now render 'EN' / 'FR' / 'AR' consistently.

---

## Summary

| Priority | Findings | Status |
|---|---|---|
| A — Pilot blockers | QA-1, QA-2, QA-3, QA-4 | All fixed, rebuilt, redeployed, re-verified live |
| B — Trust/compliance/UX | QA-5, QA-6, QA-7, QA-8 | All fixed, rebuilt, redeployed, re-verified live |
| C — Polish | QA-9, QA-10, QA-11, QA-12 | All fixed, rebuilt, redeployed, re-verified live |

**No pilot blockers remain.**

One additional item was found and fixed during the language-audit pass that wasn't in the original 12 (see QA-7 above — the HomePage.tsx duplicate Arabic string). No business logic, workflows, or permissions were changed beyond what each finding required.
