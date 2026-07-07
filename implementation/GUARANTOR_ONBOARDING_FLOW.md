# Guarantor Onboarding Flow

## What was wrong

Three separate, stacked problems meant the guarantor onboarding flow had never actually worked end-to-end:

1. **The admin "Add Guarantor" form had no email field at all**, and sent a single `fullName` field while the backend required separate `firstName`/`lastName` (`NOT NULL` database columns). Every real submission through the actual UI failed outright — either with a 500 (missing required columns) or silently created a guarantor with no email, making them permanently unreachable.
2. **No secure invite mechanism existed.** The schema already had `invite_token`/`invite_sent_at` columns (added in migration 004, with a comment describing exactly this intent), but nothing ever generated a token, sent an invite email, or validated one. The only way in was a `POST /guarantors/register` endpoint that matched purely on `tenant_id + email`, requiring the guarantor to already know their tenant's raw UUID — which they'd have no way to obtain.
3. **`student_guarantors.status` was hardcoded to `'active'` at creation** — there was no pending/declined state, no accept/decline flow, and admin's own student-detail view *only displayed guarantors whose status was already `'active'`* — meaning a newly-added guarantor was invisible to staff until they'd somehow already activated an account through the broken flow above.

## The flow now

```
Admin/Student adds guarantor (name + email) to a student
        ↓
Guarantor row created, status = 'pending_invitation'
Secure random token generated, hashed (SHA-256), stored with a 7-day expiry
        ↓
Invite email sent → https://guarantor.forsa.tn/invite/{raw token}
        ↓
Guarantor opens link → GET /guarantors/invite/:token (preview)
   Shows: who invited them, for which student, masked context — before
   they commit to anything.
        ↓
   ┌─────────────┴─────────────┐
   ▼                           ▼
Accept                      Decline
POST .../accept              POST .../decline
- sets password              - no account ever created
- creates users row          - student_guarantors.status = 'declined'
- token cleared (single-use) - reason recorded for staff
- student_guarantors.status
  = 'active'
        ↓
Guarantor logs in normally from then on (student.forsa.tn login page,
same as any returning user) — the invite link is one-time only.
```

Admin sees the real status (`Pending Invitation` / `Active` / `Declined`) on the student's Guarantors tab at every stage, with a **Resend Invite** action for anything still pending (issues a fresh token, invalidating the old one).

## What changed

### Backend (`forsa-os`)
- **Migration `013_guarantor_invite_flow.sql`** — adds `guarantors.invite_token_expires_at`; documents the `student_guarantors.status` lifecycle (`pending_invitation` → `active` / `declined` / `withdrawn`).
- **`students.service.ts#addGuarantor`** — now requires `email`/`firstName`/`lastName`, rejects duplicate emails, generates the invite token, creates the `student_guarantors` link as `pending_invitation`, and sends the invite email. New `resendGuarantorInvite` method issues a fresh token/email for anything still pending.
- **`students.service.ts#findOne`** — the guarantors list no longer filters to `status = 'active'` only (which made pending/declined guarantors invisible); now shows everything except `withdrawn`, plus `email`, `inviteSentAt`, `inviteExpiresAt`, `portalActivated`.
- **`guarantors.service.ts`** — `registerSelf` (tenant+email guess, no token) removed entirely. Replaced with `previewInvite` / `acceptInvite` / `declineInvite`, all resolving strictly by token hash. Each distinguishes "no such token" / "already used" / "already declined" / "expired" with a specific message, rather than one generic error.
- **`guarantors.controller.ts`** — `POST /guarantors/register` removed. New public routes: `GET /guarantors/invite/:token`, `POST /guarantors/invite/:token/accept`, `POST /guarantors/invite/:token/decline`.
- **New template `guarantor_invited`** (added to `scripts/seed.ts` and the live database) — the invite email itself.
- **`GUARANTOR_PORTAL_URL`** env var added (`docker-compose.yml`, `.env.production.example`), matching the existing `STUDENT_PORTAL_URL` pattern used for the student set-password link.

### Admin Dashboard (`forsa-dashboard`)
- "Add Guarantor" modal: replaced the single `Full Name` field with required `First Name` / `Last Name` / `Email` fields matching the backend contract; button now reads "Send Invite"; success toast reflects that an email was sent, not that a guarantor account exists yet.
- Guarantors tab: shows the real invitation status badge (`Pending Invitation` / `Active` / `Declined`), invite sent/expiry dates, and a **Resend Invite** button for anything still pending.
- New `pending_invitation`/`declined` entries added to the shared status badge color/label maps.

### Guarantor Portal (`forsa-guarantor`)
- `RegisterPage.tsx` (the old tenant-ID-guessing self-registration form) removed entirely.
- New `InvitePage.tsx` at `/invite/:token` — previews the invite, then either accepts (sets a password, auto-logs in) or declines (optional reason), each with its own clear success/error state.
- `LoginPage.tsx`'s "activate your account" link removed — there's no self-serve activation path anymore, only the emailed invite link.

## Verified end-to-end (this session, against the live local stack)

- Added a guarantor via the real `POST /students/:id/guarantors` endpoint → confirmed `student_guarantors.status = 'pending_invitation'` and a real invite email arrived in MailHog with the correct student name and a working link.
- Opened the invite link's token via `GET /guarantors/invite/:token` → correct preview data returned.
- Accepted via `POST .../accept` → real `users` row created, `student_guarantors.status` flipped to `'active'`, logged in immediately afterward and confirmed `GET /guarantors/my-student` correctly resolved to the right student.
- Confirmed admin's student-detail view now shows this guarantor as `Active`.
- Confirmed the same (now-consumed) token correctly rejects a second accept attempt ("This invite link is invalid").
- Declined a second invite via `POST .../decline` → confirmed no `users` row was ever created, `student_guarantors.status = 'declined'` with the reason recorded, admin can see this.
- Resent an invite for a third, still-pending guarantor → confirmed a second email arrived with a genuinely different token, and that the original (now-superseded) token no longer previews successfully.
- Loaded the actual `InvitePage.tsx` in a real browser against a live token — rendered correctly, zero console errors.
- All test accounts/records created for this verification were deleted afterward to keep the demo dataset clean.

## What's intentionally out of scope for this pass

- **Document upload during the accept step** — the invite flow's "accept" is deliberately just identity + password. Uploading guarantor identity/income documents happens afterward from the guarantor's own dashboard (reusing the existing `documents.service.ts` upload pattern already used for payment receipts), not as a blocking part of account activation. This keeps the invite link simple and matches how the rest of the product already treats document upload as a separate step from account creation.
- **SMS delivery** — the invite is email-only for now, consistent with every other notification in this system (no SMS provider is configured anywhere in the stack).
- **Multi-guarantor-per-student edge cases beyond what's tested** — the flow supports it structurally (`student_guarantors` is already a many-to-many join table), but only single-guarantor and two-guarantor (accept + decline) scenarios were exercised above.
