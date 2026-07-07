# The Bronze → Silver/Gold Journey

## The concern

Students should never have to wonder "how do I upgrade?" — because upgrading was never supposed to be the objective. The real objective is applying for a Tuition Facilitation Plan; the membership level (Silver/Gold) is the *result* of that application being approved, not something a student requests directly.

## What was actually wrong

Three concrete, confirmed problems — not just wording issues:

1. **Two competing "Apply" entry points existed, with different steps.** The Dashboard's own primary CTA linked to `/apply` (`ApplyPage.tsx` — profile, consent, then a real AI interview). But the "My Application" status page's own empty state and its "Apply now" button linked to a *different* page, `/application/new` (`NewApplicationPage.tsx`) — a simpler 3-step form (University → Details → Review) that skipped the AI interview and the guarantor question entirely. A student could get either journey depending on which screen they happened to click "Apply" from, with no indication they were different.

2. **The rejected-application soft-landing screen was silently broken.** `ApplicationPage.tsx` referenced translation keys (`bronzeTitle`, `bronzeDesc`, `bronzeWhat`, `bronzeItem1`-`6`, `bronzeNext`, `bronzeNextDesc`, `bronzeContact`) that were never defined anywhere in `i18n.ts`. The lookup function's fallback returns the key itself when nothing matches, so a rejected student saw literal text like `bronzeTitle` / `bronzeDesc` instead of the reassuring "you're still a full member, here's what's included, here's what happens next" message this screen was clearly designed to show. There was also no way to actually apply again from this screen — only a mailto link.

3. **The most serious gap: manually approving an application through one of the two admin screens never actually changed the student's membership tier.** The Admin Dashboard has two separate "advance application status" UIs (`ApplicationDetailPage.tsx` and `ApplicationWorkflowPage.tsx` — a pre-existing divergence flagged in the Phase 5 UX audit). `ApplicationDetailPage.tsx` goes through the pipeline's `human-decision` endpoint, which already correctly ratchets `students.membership_status` up to match the approved tier (bronze → silver → gold, never downward). `ApplicationWorkflowPage.tsx` calls a completely different, simpler endpoint (`PATCH /applications/:id/status`) that only ever changed `applications.current_status` — it had no tier parameter and no ratchet logic at all. An admin approving a student's Tuition Facilitation Plan through this second screen would see the application marked "Approved," send an email that *mentioned* a tier, and the student's actual `membership_status` would never move — leaving them exactly stuck wondering why they still show as Bronze.

## What changed

### The journey now, in order

```
Homepage
   ↓
Membership Request (public, no auth)
   ↓
Bronze Membership (FORSA ID + Digital Pass issued automatically)
   ↓
Student Dashboard
   Primary CTA: "Apply now" -> Tuition Facilitation Plan request
   (one single entry point: /apply)
   ↓
Multi-step wizard (ApplyPage.tsx -> InterviewPage.tsx)
   Profile & academic info (university, program, tuition amount)
   -> Guarantor question -> Legal consent -> AI readiness interview -> Submit
   ↓
Admin Review (either admin screen — both now behave identically)
   ↓
Decision
   ├─ Approved (Silver or Gold tier selected by the reviewer)
   │     -> students.membership_status automatically ratchets up to match
   │     -> student is never asked to "request" the new tier
   └─ Not approved
         -> stays Bronze, full membership intact, real reassurance shown
         -> clear "Apply Again" button, not just a contact email
```

### Specific changes

- **`NewApplicationPage.tsx` removed** along with its route. `/application/new` now redirects to `/apply`. Every "Apply" link in the student portal (`HomePage.tsx`'s primary CTA, `ApplicationPage.tsx`'s empty state, and the new "Apply Again" button) now points at the same single flow.
- **`applications.service.ts#transitionStatus`** (the endpoint `ApplicationWorkflowPage.tsx` calls) now accepts an optional `financingTier` and, when the target status is an approved level, runs the exact same ratchet-only-upward logic the pipeline path already had: update `applications.financing_tier`, compare against the student's current tier rank, and only move `students.membership_status` up, never down, recording the change in `membership_status_history`.
- **`TransitionStatusDto`** gained the `financingTier` field (validated as `'silver' | 'gold'`).
- **`ApplicationWorkflowPage.tsx`'s "Advance" modal** now shows a required Facilitation Tier selector whenever the next status is an approval level, with copy explicitly stating "The student's membership level will be updated to match automatically" — so the reviewer never has to separately remember to change anything for the student.
- **Missing `bronze*`/`applyAgain` translation keys added** in all three languages (EN/FR/AR), with real reassurance copy matching the tone already established elsewhere in the product (matches the equivalent fix already made to the rejection email template in Phase 5). `statusRejected` also corrected from "Bronze Member" to "Not Approved" for consistency with the same fix applied elsewhere in Phase 5.
- **"Apply Again" button added** to the rejected-application view, linking to `/apply` — closing the loop the old contact-only version left open.

## Verified

- Manually approved a real test application (Sarra's, `under_review` → `approved_level2`) via `PATCH /applications/:id/status` with `financingTier: "silver"` — confirmed `students.membership_status` flipped from `bronze` to `silver` automatically, with a `membership_status_history` row recorded. Reverted afterward to keep demo data consistent.
- Logged in as a real rejected student (Karim) and loaded `/application` in a live browser — confirmed real French reassurance text renders (not raw translation keys) and the "Postuler à nouveau" button is present and links to `/apply`.
- Loaded `/application/new` directly — confirmed it redirects cleanly to `/apply` with zero console errors.
- Full portal-wide smoke test (all 6 portals, every core page) — zero errors after these changes.

## What's unchanged, deliberately

- The AI interview itself (`InterviewPage.tsx`) and its scoring logic were not touched — this task was about the *journey* around applying, not the interview mechanics.
- The two admin "advance status" UIs (`ApplicationDetailPage.tsx` / `ApplicationWorkflowPage.tsx`) still exist as two separate screens — unifying them into one is a larger refactor tracked separately (see the Phase 5 UX audit). This fix makes their *behavior* consistent (both now correctly assign the tier), not their existence as two screens.
