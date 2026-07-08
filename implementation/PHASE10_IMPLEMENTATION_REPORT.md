# Phase 10 Implementation Report

Implements the operational gaps identified as required for a successful first university pilot, per `FORSA_OPERATIONS_MANUAL.md` §15 and the user's explicit Phase 10 scope. No speculative features, no platform redesign — every change below completes an existing, already-designed workflow rather than inventing a new one.

## 1. Guarantor Invitation Workflow — now fully student-initiated

**The gap:** the "do you have a guarantor?" question in the Apply wizard never triggered anything real. Adding a guarantor required a staff member acting on the student's behalf via a `student.edit`-gated endpoint.

**What was built:**
- `POST /students/me/guarantors` and `POST /students/me/guarantors/:guarantorId/resend-invite` — self-service endpoints resolving the student from the caller's own JWT identity (never a client-supplied ID), reusing the exact validation, secure-token generation, and email-sending logic the staff-facing endpoint already had.
- `GET /students/me` now returns the student's guarantor relationships (status, name, email, portal-activation) in the same call the Dashboard already makes — no extra round trip needed to know whether a guarantor exists.
- A new `/guarantor` page in the student portal: an invite form when no live guarantor relationship exists, or a status card (pending/active/declined) with a resend action when one does.

**Verified live:** invited a guarantor using only a student's own token (no admin token anywhere in the request chain) — a real `pending_invitation` record was created and a real invite email arrived in MailHog. Confirmed via a real browser session: submitting the form updates the Bronze Dashboard checklist's "Invite Guarantor" item to done immediately.

## 2. Bronze Dashboard Next Steps — replaced ambiguity with a checklist

**The gap:** the dashboard's only guidance before an application existed was a single generic "Start your FORSA journey" card with one CTA and no context for *why*.

**What was built:** a `OnboardingChecklist` component (shown only before an application exists) listing: Membership Approved, FORSA ID Issued, Digital Pass Issued (all pre-checked, since a Bronze member can't exist without them), Complete Profile (derived from the same 8-field completeness check the existing Profile Completion card already used), Invite Guarantor (derived from the new guarantor data above), and Submit Tuition Facilitation Request. Only the first incomplete item gets a CTA button; everything after it is visibly "up next" but not actionable yet — a student is never asked to do two things at once.

**Verified live:** a fresh Bronze account with no application, no guarantor, and an incomplete profile correctly showed exactly three items checked and "Complete Profile" highlighted as the current step; after inviting a guarantor through the new page, the checklist updated to show "Invite Guarantor" checked without a page reload (React Query cache invalidation).

## 3. Waiting List Experience — replaced with a full explanation

**The gap:** an application in `capital_queue` fell through to a generic "in progress" message identical to every other in-flight status, with no acknowledgment that this state is fundamentally different (an already-positive review, just waiting on capital).

**What was built:**
- `GET /applications/me/:id/queue-position` — computes an honest estimated position: count of other applications currently in `capital_queue` that entered the queue earlier (using `updated_at` as the entry-into-queue timestamp, since every status transition sets it), plus the total queue size. Flagged in code comments as an estimate, not a guaranteed FIFO order.
- A dedicated waiting-list section on `ApplicationPage.tsx`: explanation (explicitly "you have NOT been rejected"), a Bronze-membership-intact reassurance banner, the estimated position card, a "what happens next" explanation, and "while you wait" guidance (keep your profile/guarantor current).
- The Dashboard's Next Action card gained its own `capital_queue` branch instead of falling through to the generic case.
- All new copy translated in English, French, and Arabic.

**Verified live:** moved a real test application into `capital_queue`, confirmed the full section renders correctly (screenshot-verified) including a real computed position (#1 of 1 in this case, since it was the only queued application at test time), and that the Dashboard's next-action card shows the matching, distinct message.

## 4. Administrator Queue — computed blocker visibility

**The gap:** admins had to open each application and interpret a raw status code to figure out why it was stuck — no way to scan a list and immediately spot what needed attention.

**What was built:** the Applications list query now computes a `queue_tag` per row via a priority-ordered `CASE` expression: `urgent` (a decision-pending status untouched for 5+ days), `missing_guarantor` (in an active-review status with no live guarantor relationship), `waiting_documents`, `waiting_student`, `waiting_university`, `waiting_list`, or `ready_for_review`. The admin Applications page shows this as a new "Queue" column and a row of quick-filter chips.

**A deliberate scope decision:** the tag is **not** based on `application_documents` completeness, because that table has zero rows across the entire tenant today — nothing currently populates a required-documents checklist per application. Building a documents-based tag would have meant fabricating a signal that doesn't exist yet, which this phase's instructions explicitly rule out ("do not add speculative features").

**A known limitation:** the quick-filter chips operate on the current page's already-fetched results, not a server-side filter — accurate for a pilot-scale application volume (the tenant currently has 7 total applications), but would need to become a real query parameter before volume grows past a page size.

**Verified live:** confirmed the "Waiting List" tag appeared correctly on the test application moved into `capital_queue`, and that the "Missing Guarantor" filter chip correctly returned zero results once that same application moved on (proving the tag is computed fresh each load, not stale).

## 5. FORSA_PRINCIPLES.md

Ten principles documented, each one already an enforced behavior in the platform rather than an aspiration: students always know the next step; membership is earned, never requested; human reviewers decide, universities never do; every decision is auditable; rejection is never the end of the relationship; no orphan accounts; every self-scoped portal trusts only server-resolved identity; the platform should reduce uncertainty; don't build or describe what isn't real.

## 6. Verification performed

- **Regression:** full backend test suite, 156/156 passing across 17 suites (2 new tests added for `addMyGuarantor`'s self-scoping behavior; no existing test broke).
- **Browser testing:** real Playwright sessions against the live stack for all four features above — self-service guarantor invite via real form submission, checklist state changes, waiting-list rendering, admin queue filter chips.
- **Permission testing:** re-confirmed a university-portal account gets a clean `404` (not data leakage) when attempting the new self-service guarantor endpoint — `findMe` correctly finds no linked student for that account type; re-confirmed staff-only routes still return `403` for university/partner accounts.
- **Workflow testing:** end-to-end — self-service invite → email → Dashboard checklist update; application → `capital_queue` → waiting-list detail + Dashboard next-action + admin queue tag, all consistent with each other.
- **Full 6-portal smoke test:** clean, zero errors, both before and after this phase's changes.

## What changed in the Operations Manual

`FORSA_OPERATIONS_MANUAL.md` is updated to reflect that:
- §4 (Guarantor Journey): the invitation trigger is no longer "a student/admin adds a guarantor" as a staff-only action — a student can now do this directly.
- §9 (Administrator Workflow): the Applications list now surfaces computed queue-blocker tags.
- §15 (Pilot Readiness): the guarantor-invitation gap and the ambiguous Bronze Dashboard next-step gap are marked closed; the waiting-list and admin-queue gaps are marked closed. See `PILOT_BLOCKERS_STATUS.md` for the full before/after.
