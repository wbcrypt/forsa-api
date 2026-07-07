# FORSA Phase 5 — UX Audit Report

Full findings from 5 independent, code-level audits (one per portal), each conducted blind to the others, reading every page component against a fixed checklist: confusing workflows, inconsistent wording, empty/loading/error states, accessibility, mobile responsiveness, and trust signals. Live-tested against real seeded accounts where noted.

Status markers: **✅ Fixed** (see `PRODUCT_EXCELLENCE_REPORT.md` for details) · *(no marker)* = documented recommendation, not yet actioned.

---

## Student Portal

**What's already done well:** error handling surfaces the backend's specific message before falling back to a generic one across every form; `EmptyState`/`Spinner` primitives are used consistently with real, actionable copy; the Bronze-rejection soft-landing page (what's included, what happens next, direct contact) is a genuinely good trust pattern; the document-upload page repeatedly and clearly tells users never to upload ID documents online; the AI-interview consent flow is thorough and explicit that a human — not the AI — decides; demo-mode AI scoring honestly nulls the score rather than fabricating one.

**Findings:**
- ✅ **Fixed** — `rejected` status badge read as "Bronze Member" with no rejection context (`components/ui/index.tsx:16`).
- Notification cards never mark themselves read and have no click/navigation target (`pages/notifications/NotificationsPage.tsx:61-83`).
- The homepage's "Next Action" card can flip its headline right after load as an async query resolves, reading as a flickering, contradictory message on the one card meant to be a single source of truth (`pages/HomePage.tsx:64,92-93,130-139`).
- `StepProgress` hides step text labels below the `sm` breakpoint — on phones, the app's primary device, users see only numbered dots (`components/ui/index.tsx:150-153`).
- The application timeline renders a rejection history entry as an unexplained "Bronze Member" badge with no context, since that's the shared badge component (`pages/application/ApplicationPage.tsx:223-241`) — same root cause as the fix above, now resolved.
- "Application" is used generically for both the pre-Bronze Membership Request and the post-Bronze Tuition Facilitation Plan, blurring a distinction the business model depends on (`components/layout/Layout.tsx:10`, `pages/application/ApplicationPage.tsx:35,66,185,225`).
- A hardcoded "57 Permissions → Standard access" row looks like leftover debug copy in the profile settings page (`pages/profile/ProfilePage.tsx:126`).
- Three real, clickable placeholder phone numbers (`tel:+216XXXXXXXX`) ship in production — forgot-password, documents, and payments pages (`pages/auth/ForgotPasswordPage.tsx:65,71`, `pages/documents/DocumentsPage.tsx:236`, `pages/payments/PaymentsPage.tsx:491-493`).
- `MembershipRequestPage.tsx` and `SetPasswordPage.tsx` — the two pages a brand-new visitor and a freshly-approved Bronze member see first — have no locale switcher and are hardcoded English-only, breaking the trilingual promise at the highest-stakes moments.
- `ProfilePage.tsx:56-58` mixes hardcoded English labels ("City," "Nationality") with translated ones (`t('firstName')`) in the same list.
- The university/program picker shows no loading indicator between selecting a university and its programs list appearing (`pages/application/NewApplicationPage.tsx:32-36,121-134`).
- Every form's `FormField` label lacks `htmlFor`/`id` association — affects every form in the app (`components/ui/index.tsx:99-112`).
- Digital Pass and Notifications top-bar icons, the Modal close button, the payments "copy" button, and both password show/hide toggles are icon-only with no `aria-label` (`components/layout/Layout.tsx:47-56`, `components/ui/index.tsx:125-127`, `pages/payments/PaymentsPage.tsx:31-35`, `pages/auth/LoginPage.tsx:83-86`, `pages/auth/SetPasswordPage.tsx:66-69`).
- Login and Set-Password inputs mix physical (`pr-11`) and logical (`end-3`) CSS properties for the same input+icon pair — in Arabic (RTL), the icon flips side correctly but the input padding doesn't follow, so typed text can run under the icon (`pages/auth/LoginPage.tsx:82,84`, `pages/auth/SetPasswordPage.tsx:64,67`).
- The student-facing FORSA Score renders as a circular gauge visually identical to a bank credit-score dial, in tension with the "FORSA is not a bank" positioning even though the label avoids forbidden words (`pages/profile/ProfilePage.tsx:69-92`, `pages/application/ApplicationPage.tsx:108-111`).

## Guarantor Portal

**What's already done well:** Konnect payment-failure messages are specific and actionable rather than generic; the dashboard has a genuine, well-worded empty state for "no student linked yet"; payment copy consistently reinforces human review and non-bank framing; bank-transfer details ship with one-tap copy buttons per field, reducing transcription errors for parents doing a wire transfer; no banned financial terminology found anywhere in the payment flow.

**Findings:**
- ✅ **Fixed** — `rejected` status showed as "Bronze Member"/"Membre Bronze" in two separate places (`components/ui/index.tsx:15`, `pages/dashboard/DashboardPage.tsx:18`).
- ✅ **Fixed** — Guarantor portal shipped as one unsplit 314KB bundle; every sibling portal splits vendor/query/ui — the config block was simply missing (`vite.config.ts`).
- A full set of shared UI primitives (`Card`, `Alert`, `EmptyState`, `Modal`, `FormField`, `SkeletonCard`, `StepProgress`) exists but is imported by zero pages — every page hand-rolls its own loading/empty/error treatment, producing the inconsistencies below (`components/ui/index.tsx:40-171`).
- The payments page's installment query doesn't check `isLoading`/`isError`; the happy-path "all caught up" empty state can render during the initial fetch or on a genuine fetch failure — a parent can see a false "you're all paid up" message (`pages/payments/PaymentsPage.tsx:36-39,142-147`).
- The dashboard's "no student linked" message covers both a genuinely unlinked guarantor and any backend/network failure — real errors are hidden behind a business-state message (`pages/dashboard/DashboardPage.tsx:47-52`).
- The entire portal is hardcoded French with no working locale switch, despite complete FR/EN/AR dictionaries existing in `lib/i18n.ts` — confirmed via repo-wide grep that no page calls `t()` at all. Guarantors (often parents) are arguably the audience most likely to prefer Arabic.
- `ApplyLayout.tsx` is dead code, never imported anywhere — leftover student-portal template debris.
- The sidebar is a fixed, non-collapsible 208px width with no mobile breakpoint — on a phone, likely the primary device for a parent-guarantor, it can't be hidden.
- The receipt-upload form uses a fixed 2-column grid with no mobile-stacking variant, cramming 4 inputs into 2 tight columns on small screens.
- Every form label across all 4 pages lacks `htmlFor`; both password toggles and the loading spinners have no `aria-label`/`role="status"`.
- No "forgot password" link exists anywhere; a locked-out guarantor has no self-service recovery path, only re-registration.
- Login/registration require manually typing a raw organization UUID — an error-prone, unnecessary field for a non-technical parent.

## University Portal

**What's already done well:** consistent "read-only access" messaging correctly sets the mental model that university staff can view but not alter FORSA decisions; decision-finality banners are copy-disciplined with zero financing/lending language leaking through; genuinely good skeleton loading in the shared `Table` component; notes are clearly and repeatedly labeled internal-only; a real FR/AR/EN switcher with RTL support is wired at the document level.

**Findings:**
- ✅ **Fixed** — filter dropdown said "Rejected" while the status badge on the same page said "Not Approved" (`pages/students/StudentsPage.tsx:19`).
- CSV/PDF export and the dashboard's own KPI tiles are both computed from a partial fetch (`limit: 20`/`limit: 50`) while the header shows the true total — a university with more students than that page size gets silently incomplete exports and wrong stats with no disclaimer (`pages/students/StudentsPage.tsx:42-61`, `pages/dashboard/DashboardPage.tsx:26,42-46`).
- A performance query is fetched on the dashboard but never rendered anywhere — a dead network call (`pages/dashboard/DashboardPage.tsx:18-22`).
- Student search has no debounce — every keystroke fires a new request (`pages/students/StudentsPage.tsx:130-131`).
- "Confirm Enrollment" — the portal's one real write action on financial/enrollment data — fires immediately with no confirmation dialog and no success toast, only a silent cache invalidation (`pages/students/StudentDetailPage.tsx:121-129`).
- The status filter is missing 8 real statuses that appear in the table itself, so staff can't filter to students in those states (`pages/students/StudentsPage.tsx:10-20`).
- `approved_level3` displays as "Referred" while `approved_level1`/`approved_level2` display as "Approved L1"/"L2" — an approved status rendered as if it weren't (`components/ui/index.tsx:39`).
- Two native `alert()` calls break from the app's own `Alert` component used everywhere else (`pages/documents/DocumentsPage.tsx:23`, `pages/students/StudentDetailPage.tsx:69`).
- Internal staff notes save silently to `localStorage` with no confirmation and no warning that switching browsers/devices permanently loses them — risky for staff treating these as durable case records (`pages/students/StudentDetailPage.tsx:52-63`).
- The whole app shell has no responsive/mobile treatment — the fixed sidebar has no breakpoint to collapse into a drawer.
- A non-functional, unlabeled notification bell sits in the header of a portal handling real tuition/payment data — reads as unfinished (`components/layout/Layout.tsx:123-125`).
- Underlying data fields are named `max_financing_amount`/`financing_levels` — the rendered copy itself avoids the word, but any future edit is one copy-paste away from leaking it into the UI.
- No `htmlFor`/`id` pairing exists anywhere in the codebase (confirmed by project-wide grep) — login labels, the password toggle, sidebar collapse, pagination buttons, and the notes delete button are all unlabeled for screen readers.

## Partner Portal

**What's already done well:** every list view renders a real `EmptyState` rather than collapsing to blank; Students and Commissions pages consistently implement `isLoading`/`isError`/retry; sign-out requires an inline confirmation step; copy-to-clipboard actions give clear, transient success feedback with a fallback for older browsers; no banned terminology ("loan," "financing," "credit," "interest rate") found anywhere in the codebase.

**Findings:**
- ✅ **Fixed** — icon-only Alert/Modal close buttons had no `aria-label` (shared with all portals).
- The dashboard's three KPI queries never check `isError`, and `isLoading` is destructured but never used — a failed fetch leaves stale zero-value stats on screen forever with no message (`pages/dashboard/DashboardPage.tsx:14-30`).
- The Reports page has no error state at all, inconsistent with its sibling pages (`pages/reports/ReportsPage.tsx:13-21,127`).
- Applications used for reports are hard-capped at 100 (working around a server limit) with no banner telling a partner with more referrals that their exports/stats are silently truncated (`pages/reports/ReportsPage.tsx:15-19`).
- Export buttons give no feedback and no `disabled` state when there's nothing to export — clicking them does nothing, silently (`pages/reports/ReportsPage.tsx:62-79`).
- Every status badge label is hardcoded English, never localized, despite the rest of the app being fully translated — a glaring inconsistency for a Tunisia-based rollout (`components/ui/index.tsx:5-23`).
- `approved_level3` renders as the internal-sounding "Referred Out" with no explanation of what it means for the partner's commission (`components/ui/index.tsx:11`).
- No commission rate, payout ETA, or per-line invoice/reference ID is shown anywhere — a partner has no way to independently verify how any commission number was derived, the single highest-stakes trust gap in this portal given its purpose (`pages/commissions/CommissionsPage.tsx`).
- No "forgot password" link or reset route exists anywhere in the app.
- The fixed sidebar and centered content column overlap at viewport widths near the `lg` breakpoint (~1024-1200px) (`components/layout/Layout.tsx:57,95`).
- Several icon-only buttons (search-clear, pagination prev/next, password toggle) have no `aria-label`; zero `htmlFor` attributes exist anywhere in the codebase.

## Admin Dashboard

**What's already done well:** the AI Report panel carries a clear, correctly-placed disclaimer that AI assessment is advisory only; fraud/override guardrails use separate permissions and require confirmation with a reason; the newer Phase-2 pages (Membership Queue, Digital Pass, Fraud Records, Waiting List) consistently use approved terminology, a good template the older pages should match; the Ranking page has a genuinely separate, well-built mobile card layout rather than squeezing a desktop table; shared `Table`/`EmptyState`/`ErrorState`/`Pagination` primitives are well designed where actually used.

**Findings:**
- ✅ **Fixed** (highest severity) — the AI Report panel read pre-rewrite field names that no longer exist in `ai_report.scores`, and gated its empty state on a field that was never populated — meaning a reviewer's "AI Report" tab could show "No AI interview completed yet" even after a real interview, hiding the AI recommendation from the human decision entirely (`components/AIReportPanel.tsx`).
- ✅ **Fixed** — 10 instances of banned "financing" language in user-facing copy across Applications, New Application, Application Detail/Workflow, AI Report Panel, and Students pages.
- ✅ **Fixed** — the same `rejected` status rendered as three different labels ("Bronze Member" ×2, "Bronze Pathway" ×1) — standardized to "Bronze Pathway" with an accurate soft-landing description.
- Two independent, fully-editable "advance status" UIs exist for the same application (`ApplicationDetailPage.tsx` and `ApplicationWorkflowPage.tsx`), cross-linked by a button, each with its own status-transition logic that can diverge and produce conflicting histories.
- Payment work is split across three separate places (finance overview, a separate verification page, and a modal inside the application detail page) with no obvious single place to "handle a payment" for a first-time admin.
- Two of the four newest sidebar items (AI Queue, Tuition Facilitation Queue) render only a generic "backend integration pending" placeholder — half the newest nav entries do nothing at pilot launch.
- The Payments/Documents/Timeline tabs on the application detail page have no loading indicator for their lazily-enabled queries — switching tabs can show "no payment schedule yet" indistinguishably from a genuinely empty schedule.
- Several mutations (collections contact log, payment verify/reject, workflow advance/reject) discard the server's actual validation message in favor of a generic hardcoded string, inconsistent with other mutations in the same app that do surface it.
- Four pages (Membership Queue, Waiting List, Digital Pass, Fraud Records) don't check `isError` — a failed fetch silently renders the "no records yet" empty state instead of surfacing the failure; particularly risky for the fraud list, where a blank screen on error looks identical to "no fraud on file."
- Sidebar collapse, notification bell, mobile hamburger, and the Modal close button (now fixed) are icon-only with no `aria-label`; activation-checklist rows toggle state with no `aria-pressed`/`role="checkbox"`; at-risk payment severity is distinguished only by color, not also by text/icon.
- Collections worklist rows and the workflow page's custom tab bar have no responsive stacking/overflow handling on narrow viewports, unlike the shared components elsewhere in the app that do.
- The CEO Override modal lets one person finalize a decision bypassing the dual-approval requirement with no wording reinforcing that this is an exception to, not the norm of, the review-committee model.

---

## Cross-portal patterns worth calling out

A few findings recurred across three or more independently-run audits, suggesting a systemic gap rather than a one-off:

1. **No `htmlFor`/`id` pairing on any form field, anywhere, in any of the 6 portals.** Every audit independently confirmed this via repo-wide grep. This is the single highest-leverage remaining accessibility fix — it's mechanical (add `id` to each input, `htmlFor` to its label) but touches every form in every app.
2. **Icon-only buttons without `aria-label`** beyond the shared components already fixed — sidebar toggles, notification bells, password visibility toggles, pagination controls. Each portal has its own instances beyond the shared `ui/index.tsx` file.
3. **`isError` handling is inconsistent within the same app** — some pages check it and show a retry UI, sibling pages on the exact same data pattern don't and silently show an empty state instead. Worth a lint rule or shared hook enforcing the pattern rather than a page-by-page audit.
4. **The `rejected` status was mislabeled or inconsistently labeled in every single portal** before this phase's fixes — now standardized, but worth a shared constants file (or a single source of truth in the backend response) so it can't drift independently per-portal again.
