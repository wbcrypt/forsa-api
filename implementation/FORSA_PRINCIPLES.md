# FORSA Principles

These are the operating principles behind FORSA's product decisions — not aspirational values, but the rules that were already being enforced in the platform before this document existed, made explicit so they stay consistent as the team and the product grow. When a future decision is unclear, it should be checked against these first.

## 1. Students always know the next step

A student should never have to guess what to do or wonder why nothing is happening. Every screen a student can land on either tells them the one concrete action available to them right now, or explicitly tells them no action is needed and why. This is why the Bronze Dashboard is a checklist, not a status dump; why a waitlisted student sees an estimated position and a "what happens next" explanation instead of a bare "you are waiting"; why a rejected application shows a working "Apply Again" button instead of just a contact email.

## 2. Membership is earned through verified actions, never requested directly

Bronze is granted by a verified Membership Request, reviewed by staff. Silver and Gold are the *result* of an approved Tuition Facilitation Plan, assigned automatically the moment that approval happens — never something a student asks for by name. If a feature ever lets a student directly request a tier upgrade, it violates this principle and should be reconsidered.

## 3. Human reviewers make all financing decisions

The AI interview and scoring pipeline inform a decision; they do not make one. Every approval, rejection, waiting-list placement, and tier assignment is the result of a specific staff member's action, recorded against their identity. Automation exists to give reviewers better information faster, not to replace their judgment.

## 4. Universities never approve financing

A partner university's only write action in the entire system is confirming enrollment and tuition *after* FORSA has already decided. A university account cannot influence, delay, or override a financing decision — that decision is made and finished before the university's involvement even begins.

## 5. Every decision is auditable

Every membership approval/rejection, application status change, guarantor invite acceptance/decline, and payment verification is recorded with who acted, when, and what changed. Nothing important happens invisibly. This is enforced structurally in places, not just by convention — the membership tier history table cannot be deleted or altered at the database level once written.

## 6. Rejection is never the end of the relationship

A rejected Membership Request doesn't blacklist an email from trying again. A rejected Tuition Facilitation Plan doesn't touch the Bronze membership the student already earned — every benefit of Bronze stays active, and reapplying is always one click away. A guarantor who declines simply declines — no account, no penalty, no dead end for the student either; a different guarantor can always be invited. The only genuinely terminal state in the entire platform is a confirmed fraud flag, and that is a deliberate, narrow exception, not the default posture toward anyone who doesn't get approved.

## 7. No orphan accounts, ever

An account exists only if it corresponds to a real, current relationship. A guarantor who declines never gets a login. A rejected Membership Request never creates a `students` row. If a relationship ends, the account tied to it doesn't linger as an unexplained, unusable artifact.

## 8. The platform should always reduce uncertainty, not add to it

When in doubt between a feature that adds information and one that adds a decision for the user to make, prefer the one that removes ambiguity. This is why the two membership-tier questions ("do I have Silver or Gold?" and "how do I get one?") were collapsed into a single automatic outcome instead of two separate things a student had to track. It's why the admin queue surfaces *why* an application is stuck (missing a guarantor, waiting on the university, overdue for review) instead of just a status code a staff member has to interpret.

## 9. Every self-scoped portal trusts only the server-resolved identity

A student, guarantor, university, or partner account's view of "my data" is always resolved server-side from their authenticated identity — never from an ID the client happens to send. This is a security principle as much as a product one: it is what makes every other principle on this list actually true in practice rather than just in the UI's happy path.

## 10. Don't build what isn't real

The product should never describe a capability it doesn't actually have. If a workflow is incomplete, the honest state is documented, not hidden behind wording that implies it works. This is why this same engagement's audits explicitly flag things like "SMS notifications are schema-ready but never actually sent" and "partner commissions calculate correctly but nothing ever triggers them" instead of quietly treating them as done.
