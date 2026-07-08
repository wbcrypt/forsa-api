# FORSA Workflow Guide

Single source of truth for how FORSA actually operates today, verified against the running code — not an aspirational design document. Where a workflow has a known gap, it's called out explicitly rather than described as if it already worked. Companion documents: `WORKFLOW_AUDIT_REPORT.md` (verification pass), `BROWSER_TEST_REPORT.md` (live test results), `PILOT_BLOCKERS.md` (severity-ranked open items).

---

## A. Public Visitor Journey

**Role:** Anonymous visitor. **Trigger:** Lands on `forsa.tn`.

1. Homepage (FR/EN/AR) presents FORSA's three membership tiers and the "Join FORSA" CTA.
2. Visitor clicks "Rejoindre gratuitement" → `student.forsa.tn/join` (public, no auth).
3. Submits the Membership Request form: first name, last name, email, phone, city, university (optional dropdown of real partner universities), programme, academic year, current/future student.
4. `POST /membership-requests` — validated (`class-validator`), rejected with a specific per-field message if invalid (e.g., `universityId must be a UUID`).
5. **Duplicate check**: rejected if another *pending* request already exists for that email, or if the email already belongs to an active student (`students` table) — "An active FORSA membership already exists for this email. Please log in instead."
6. On success: `membership_requests` row created (`status = 'pending'`), confirmation email sent (`membership_submitted` template) to the email on file.

**System state:** `membership_requests` row created. No `students`/`users` row exists yet.
**Notification sent:** `membership_submitted` — "We've received your FORSA membership request."
**DB entities touched:** `membership_requests`.
**Success state:** Request sits at `status = 'pending'`, visible to admin in the Membership Queue.
**Failure states:** Validation error (specific field-level message); duplicate pending request; existing active member.
**Edge cases:** No university selected (optional field — `universityId` can be omitted); visitor closes the tab before submitting (no partial record is ever created — the row only exists after a full, valid submission).
**What should NOT happen:** A membership request should never silently create a `users`/login account at this stage — that only happens on Bronze approval (see B).

There is **no separate "email verification" step** before submission — the Membership Request form itself is genuinely public and unauthenticated; the first real email a visitor receives *is* the submission confirmation. (Phase 5/7 already corrected this expectation once — noting it again here since Phase 8's own request text describes an "email verification" step that does not exist as a distinct gate in the real flow.)

---

## B. Bronze Membership Journey

**Role:** Admin (approving), then the student themself. **Trigger:** Admin reviews a pending Membership Request.

1. Admin opens **Membership Queue** (`admin.forsa.tn` → Membership Queue), sees all pending requests.
2. Admin approves or rejects.
   - **Reject**: `membership_requests.status = 'rejected'`. No student/user account is created. (There is currently no applicant-facing rejection email template distinct from the application-rejection one — see Audit Report.)
   - **Approve**:
     a. A `students` row is created (`membership_status = 'bronze'`, a unique `forsa_id` generated in the form `FORSA-YYYY-XXXXXX`).
     b. A `users` row is created in the same transaction, with an unusable placeholder password hash, `portal_type = 'student'`, `status = 'pending_verification'`.
     c. A Digital Student Pass is issued in the **same transaction** as Bronze itself — a Bronze member never exists without a pass, or vice versa (`digital_student_passes` row, `status = 'active'`).
     d. A one-time password-setup token is generated (SHA-256 hashed, 48-hour expiry) and emailed.
3. Student clicks the emailed link → `student.forsa.tn/set-password?token=...` → sets a real password → `users.status = 'active'`, `must_change_password = false`, `email_verified = true`. Token is marked used (single-use; a second click on the same link now shows a specific "already used, please log in instead" message, not a generic error).
4. Student logs in → lands on the Dashboard.

**Notifications sent:** `membership_approved` ("Welcome to FORSA — Set Your Password"), `digital_pass_ready`.
**DB entities touched:** `membership_requests`, `students`, `users`, `digital_student_passes`, `membership_status_history`, `password_setup_tokens`, `audit_logs`.
**Success state:** Student has a working login, sees Bronze tier, real FORSA ID, and an issued Digital Pass on first login.
**Failure/edge states:** Set-password link expired (48h) or already used — each now shows a distinct message. Student never sets a password at all — the account exists but is permanently `pending_verification` until they do (no automatic expiry/cleanup of unclaimed Bronze accounts currently exists — see Audit Report).
**What the student can do next:** View Dashboard, Digital Pass, Profile; submit a Tuition Facilitation Plan request (C); nothing else requires action — Bronze membership itself has no further steps.
**What should NOT happen:** The student should never need to "request" Bronze a second time, and membership_status should never move backward from `bronze` except via the explicit blacklist path (fraud).

---

## C. Tuition Facilitation Journey

**Role:** Bronze/Silver/Gold student. **Trigger:** Student clicks the Dashboard's primary CTA ("Apply now").

1. `/apply` (`ApplyPage.tsx`) — the **one canonical entry point** (a second, incomplete flow existed at `/application/new` and was retired; that route now redirects here).
2. **Step 1 — Your Profile**: personal details, university + program (real partner universities/programs, dropdown), tuition amount, "Do you have a guarantor?" (yes/no).
3. **Step 2 — Legal Consent**: explicit, itemized consent that the AI does not decide, a human review committee does.
4. **Step 3 — AI Interview** (`InterviewPage.tsx`): a real conversational interview; in demo mode (no live Anthropic key) the score is honestly left null with a "manual review required" flag rather than fabricated.
5. Submit → `POST /applications/me` → resolves the student server-side from the JWT (never trusts a client-supplied student ID). Application created at `current_status = 'new_lead'`, with `ai_report`/`ai_score_overall` attached if the interview produced one.
6. **No duplicate check currently exists** — a student can submit a second Tuition Facilitation request while one is already active/pending (see Audit Report — this is a genuine, confirmed gap, distinct from the Membership Request's own duplicate check in §A, which does exist).
7. Admin runs the pipeline / reviews under **Applications**. Status moves `new_lead → under_review` (Stage 8 of the pipeline transitions here automatically for self-submitted requests).
8. Admin decision: **approve** (Level 1/2/3, with a required Silver/Gold tier selection) or **reject**.
   - **Approved**: status → `approved_levelN`; `students.membership_status` **automatically ratchets up** to the selected tier (bronze→silver→gold, never downward) — this now works identically whether the decision is made via the pipeline/human-decision screen or the manual Application Workflow screen (both were audited and fixed in Phase 7).
   - **Rejected**: status → `rejected`. Student **keeps Bronze membership in full** — FORSA ID and Digital Pass remain active. The student-facing screen explicitly reassures this (fixed in Phase 7 — was previously rendering broken placeholder text) and offers a working "Apply Again" button.
9. Approved path continues: `contract_sent` → `contract_signed` → `university_confirmed` (university portal confirms enrollment) → `university_paid` → `active_student`.
10. `active_student` can later move to `completed` or `withdrawn`.
11. Rejected applications can move to `appealing` (student-initiated appeal) or back to `new_lead` (a fresh application) — rejection is never a dead end at the state-machine level.

**Notifications sent:** `application_approved` (mentions the tier), `application_rejected` (explicitly reassuring, mentions Bronze status is unaffected), `waiting_list` (if routed to `capital_queue` — explicitly framed as "not rejected, waiting for capital," never worded as a decline).
**DB entities touched:** `applications`, `application_status_history`, `students` (`membership_status`), `membership_status_history`, `payment_schedules`/`installments` (once active), `contracts`, `notification_logs`.
**Success state:** Student reaches `active_student` with the correct membership tier, a real payment schedule, and a Digital Pass reflecting the new tier's gradient/label.
**Failure states:** Rejected (soft landing, reapply available); on-hold (needs more info, returns to review once resolved); fraud-flagged (terminal, no further transition — by design, protects the blacklist guarantee).
**What should NOT happen:** A student should never be asked to separately "request Silver" or "request Gold" — the tier is the *result* of this approval, never a distinct request type.

---

## D. Guarantor Onboarding Journey

**Role:** Student/Admin (inviting), guarantor (accepting). **Trigger:** Staff (or, per the product's intent, the student themself during the Apply flow's guarantor step) adds a guarantor with a real first name, last name, and email.

1. `POST /students/:id/guarantors` — requires `firstName`, `lastName`, `email` (all enforced; rejects a duplicate email already added as a guarantor).
2. A `guarantors` row is created; a secure random token is generated, SHA-256 hashed, stored with a 7-day expiry (`invite_token`, `invite_token_expires_at`). The `student_guarantors` link is created at `status = 'pending_invitation'` — **not** `active`.
3. Invite email sent (`guarantor_invited` template) with a link to `guarantor.forsa.tn/invite/{raw token}`.
4. Guarantor opens the link → `GET /guarantors/invite/:token` (public) — previews who invited them and for which student, without committing to anything. Distinguishes "invalid," "already used," "already declined," and "expired" with a specific message each.
5. Guarantor **accepts** (`POST .../accept`, password only) → `users` row created (`portal_type = 'guarantor'`), `guarantors.portal_activated = true`, invite token cleared (single-use — a replayed link now correctly fails), `student_guarantors.status = 'active'`. Auto-logs in immediately after.
   **or** Guarantor **declines** (`POST .../decline`, optional reason) → no account is ever created; `student_guarantors.status = 'declined'` with the reason recorded for staff.
6. Once active, the guarantor logs in normally going forward (the invite link is one-time only) and sees their linked student, application status, and payment schedule (`GET /guarantors/my-student`).
7. Admin sees the real invitation status (`Pending Invitation` / `Active` / `Declined`) on the student's Guarantors tab, with a **Resend Invite** action for anything still pending (issues a fresh token, immediately invalidating the old one).

**Notifications sent:** `guarantor_invited`.
**DB entities touched:** `guarantors`, `student_guarantors`, `users` (on accept only), `audit_logs`.
**Success state:** Guarantor has portal access, correctly scoped to exactly one student's data.
**Failure states:** Expired/already-used/already-declined token, each with a distinct message; declined invite (no orphan account, ever).
**Edge cases:** Resending an invite while the old link is still valid immediately invalidates the old one (only one live token per guarantor at a time).
**What should NOT happen:** A guarantor should never be able to self-register from scratch by guessing a tenant ID and email (the old flow this replaced) — the only way in is a token that staff/the system generated for a specific, real relationship.

---

## E. Admin Workflow

**Role:** FORSA staff (Super Admin or scoped roles via the permissions system).

1. **Review Membership Requests** — Membership Queue, approve/reject (see B).
2. **Review Tuition Facilitation Requests** — Applications list or AI Ranking (sortable by AI score/dimension), open an application, review the AI Report (household stability, financial capacity, academic commitment, documentation quality — the real per-dimension breakdown, not a fabricated single score).
3. **Approve/reject Silver/Gold** — via either the pipeline/human-decision screen (`ApplicationDetailPage.tsx`) or the manual workflow screen (`ApplicationWorkflowPage.tsx`); both now correctly ratchet the student's membership tier when a Silver/Gold selection accompanies an approval.
4. **FORSA ID / Digital Pass** are issued automatically alongside Bronze approval — there is no separate manual "issue ID" or "issue pass" admin action, by design (matches the "a Bronze member never exists without a pass" invariant in B). The Digital Pass admin page (`Digital Pass`) is a read/audit view (list + revoke), not an issuance tool.
5. **Verify notifications** — every email sent by the system is visible in MailHog locally (a real SMTP provider in production); `notification_logs` records status (`sent`/`failed`) per attempt.
6. **Audit trail** — `Audit Log` page shows every recorded `audit_logs` action (membership approvals, status changes, guarantor invite accept/decline, etc.) with actor, timestamp, and before/after values where recorded.

**What should NOT happen:** Two different admin screens should never produce different real-world outcomes for the same action (this was the case for tier assignment until Phase 7's fix — now verified consistent).

---

## F. University Workflow

**Role:** University staff (one account per partner university, self-scoped — never sees another university's data).

1. Login → Dashboard shows real KPIs for that university's own students only (`universitiesService.findMe` resolves the university from the JWT identity, forcing every query to that scope regardless of anything else the client sends).
2. **View assigned students/applications** — Students list, filterable; each row links to a detail page showing the student's own application(s), read-only.
3. **Enrollment/status tracking** — the one real write action available: **Confirm Enrollment**, which transitions an application from `contract_signed` to `university_confirmed` (only reachable from that specific prior status — attempting it earlier in the pipeline correctly fails with an invalid-transition error). This is explicitly the university's *only* ability to affect a FORSA decision; every other status change is FORSA-staff-only.
4. **Reports** — CSV/PDF export of the university's own applications.
5. **Payment/status visibility** — read-only view of payment schedules for the university's own students (no ability to record or modify a payment).

**What should NOT happen:** A university account should never be able to view or act on another university's students, or influence a FORSA approval/rejection decision — only confirm enrollment once FORSA has already decided.

---

## G. Partner Workflow

**Role:** Referral partner (agency). **Trigger:** A student's application is associated with a partner via `applications.partner_id` / `referral_source_id`.

1. Login → Dashboard shows the partner's own referred students and summary stats (referral count, approval rate).
2. **Referral tracking** — Students/Referrals list, scoped to `partner_id = <this partner>` only (self-scoped, same pattern as University).
3. **Student status** — read-only view of each referred student's application status.
4. **Commissions** — a `partner_commissions` table and a fully-built calculation function (`calculateCommission`/`createCommissionRecord` in `partners.service.ts`, correctly splitting gross amount into FORSA's share and the partner's share) **exist, but nothing in the codebase ever calls them automatically.** A commission row currently only exists if someone inserts it directly — there is no trigger anywhere (not on approval, not on payment, not on disbursement) that creates one in the course of normal operation. **This is a confirmed, real gap** — the partner-facing Commissions page has real UI and correct math once a row exists, but the row itself never gets created by any real user action today. Documented in `PILOT_BLOCKERS.md`.

**What should NOT happen:** A partner should never see another partner's referrals or commissions (verified self-scoped). A partner should never be asked to manually calculate or self-report their own commission — but today, nothing else does it for them either (the gap above).

---

## H. Finance Workflow

**Role:** Finance team (a scoped role — `FINANCE_TEAM`, distinct from Super Admin, created and verified in Phase 5).

1. **Dashboard** — collections/payments overview.
2. **Ledger** — full payment record.
3. **Verify** (`PaymentVerificationPage.tsx` / `Payment Verify` in the Admin sidebar) — a guarantor or student submits a bank-transfer receipt (`status = 'receipt_uploaded'`); finance staff verify or reject it. Verifying moves the payment to `confirmed`; rejecting requires a reason and notifies the student to resubmit.
4. **Late** — overdue installment worklist, sourced from `collections.controller.ts`'s `worklist`/`late` endpoints (installments past `grace_due_date`).
5. **Disbursements** — tracks capital deployed to universities (aggregated from `financing_decisions`/`payment_schedules` where an application has reached `active_student`/`contract_signed`/`university_paid`).
6. **Reports** — finance-specific reporting (collections rate, overdue totals, monthly collected amounts).
7. **Audit** — finance-relevant audit log view.

**Payment method today:** manual bank transfer with receipt upload only, verified by staff. A Konnect (online payment gateway) integration exists in the codebase (`konnect.service.ts`, `POST /payments/konnect/initiate` + webhook) but was not part of this session's verification pass — treat as unverified rather than confirmed-working.
**Overdue/failed states:** an installment can be `pending` → `due_soon` → `due_today` → `late` → `defaulted`; a rejected receipt returns the payment to an unpaid state with the student notified to retry (`payment_rejected`-style flow via the finance Verify screen).
**What should NOT happen:** A payment should never move to `confirmed` without a finance/admin action — there is no automatic confirmation on receipt upload alone.

---

## Cross-cutting notes

- **Terminology**: "Tuition Facilitation Plan," never "loan"/"financing"/"credit"/"interest rate" — enforced and verified clean across the admin dashboard UI and all 13 email templates as of Phase 5.
- **Notification delivery**: every workflow above that "sends" an email does so via `NotificationsService.send()`, fire-and-forget (a notification failure is logged, never allowed to break the underlying business transaction that triggered it) and recorded in `notification_logs`.
- **Membership tier is monotonic**: `bronze → silver → gold`, ratcheting only upward from an approval, with `blacklisted` as the sole exception (fraud path), never a normal downgrade.
- **Every self-scoped portal** (student, guarantor, university, partner) resolves its own identity server-side from the JWT — never trusts a client-supplied ID for "whose data is this," a pattern verified consistently across all four in this session's audits.
