# Manual Testing Findings — Critical Workflow Alignment Issue

Documents the most significant issue found during manual pilot testing: the admin pipeline and the student-facing application wizard had silently drifted apart, to the point that **every** self-submitted Tuition Facilitation request was created guaranteed to fail at the very first stage of review. This is a companion document to `WORKFLOW_AUDIT_REPORT.md` and `PILOT_BLOCKERS_STATUS.md` — those cover the broader audit; this one is a focused incident report for this specific finding and its fix.

## What was reported

> "The admin pipeline requires fields/documents that the student application flow does not collect. Admin pipeline blocks at Stage 1 because required data is missing: national_id, bac_diploma, university_acceptance, income_proof, program_id. Student flow allows submission without collecting these properly. Guarantor invite is not clearly tied to the application lifecycle."

## Root cause

`pipeline.service.ts`'s Stage 1 ("Completeness Gate") has always checked, for every application: 4 specific verified/under-review documents (`national_id`, `bac_diploma`, `university_acceptance`, `income_proof`), `program_id`/`university_id`/`tuition_amount` being present, and (per policy) an active guarantor relationship. This gate is old and was never the problem.

The problem was on the other side: `applications.service.ts#createForSelf` — the endpoint the student portal's Apply wizard actually calls — had **no validation of any of this at all**. It would happily create an application with `program_id: null` and zero documents, hand it back to the student as "submitted successfully," and that application would then sit permanently blocked at Stage 1 the moment any admin or the automated pipeline touched it. Nothing in the UI ever told the student a document or a guarantor was needed before submitting, because nothing in the UI ever asked.

A second, compounding discovery made while investigating this: the `programs` table was **completely empty** across the entire tenant. Even a perfectly-behaved client sending a real `programId` would have had nothing valid to send — the one hard requirement Stage 1 places on `program_id` was unsatisfiable by construction, independent of anything the wizard did or didn't collect. This had nothing to do with the reported symptom directly but would have blocked the fix from actually working end-to-end, so it was fixed in the same pass (5 real programs seeded for the one existing partner university).

## What was fixed

See `PHASE10_IMPLEMENTATION_REPORT.md`-style detail is intentionally not repeated here — full technical detail is in the commit messages for this change across `forsa-os`, `forsa-student`, and `forsa-dashboard`. Summary:

1. **The Apply wizard gained two mandatory steps**: Documents (upload all 4 required types) and Guarantor (name + email), inserted between the existing Financial step and Legal Consent. Submission is blocked client-side until both are complete.
2. **`createForSelf` now validates server-side**, independent of the client: rejects with a specific message if required fields are missing, rejects with a specific message listing exactly which documents are missing, and — only once genuinely complete — creates the application and links the pre-uploaded documents into it.
3. **Guarantor invitation happens only after the application exists** — the student portal calls the guarantor-invite endpoint immediately after a successful application creation, never before. If the invite call itself fails, the application is not rolled back (it's already valid); the student sees a warning pointing to the standalone `/guarantor` page to send it manually.
4. **Stage 1's guarantor check now defaults to required** (previously silently disabled — see below) and **accepts a still-pending invitation as satisfying the gate**, so a guarantor who hasn't responded yet doesn't block the application from reaching a human reviewer.
5. **The admin application detail page gained a Completeness Checklist** — program selected, each required document's real status, guarantor status — mirroring exactly what Stage 1 checks, so staff never have to reverse-engineer a blocked pipeline run from a raw error string.

## A related gap found and fixed in the same pass

Stage 1's guarantor requirement is gated behind a `guarantor.required` policy lookup. No such policy row has ever existed in this tenant, and the old code (`if (guarantorRequired)`) treated the resulting `null` as "not required" — meaning **the guarantor requirement was silently never enforced at all**, tenant-wide, until this fix. It now defaults to required when unconfigured, which is the behavior the product has always actually wanted (a Tuition Facilitation Plan with no guarantor on file was never the intended end state).

## Verification performed

Full live verification against the running stack, documented in detail in the corresponding commit messages:

- A fresh Bronze student's submission attempt was correctly rejected with no documents and no program (`"Please complete the following before submitting: program."`).
- After seeding a real program and uploading one document at a time, the rejection message correctly narrowed to exactly what remained missing.
- Once genuinely complete, submission succeeded; the created application's `application_documents` rows correctly reference the pre-uploaded documents.
- A guarantor invite was sent immediately after application creation and arrived by email.
- The admin Completeness Checklist correctly showed each document, the guarantor's pending status, and `allComplete: false` until documents were marked reviewed by staff — then `true` once they were, with the guarantor still only pending acceptance (confirming pending doesn't block the gate).
- **Running the actual pipeline against this application: Stage 1 ("Completeness Gate") passed.** (It then blocked at Stage 3 for an unrelated, pre-existing reason — no active university agreement on file for the test university — which is outside this fix's scope and noted separately in the Operations Manual.)
- Manual admin approval at Gold tier correctly updated the student's `membership_status`, and the student's Dashboard and Digital Pass reflected it immediately on re-login.
- 164 backend tests passing (10 new/updated specifically for this fix), full 6-portal smoke test clean.

## Why this wasn't caught earlier

Every prior phase's browser and API testing exercised the *application creation and decision* flow without documents or a guarantor attached to the test data — those were seeded directly into the database for testing convenience elsewhere in this engagement, which is exactly why the gap didn't surface until a genuinely fresh, end-to-end manual test walked through the real student-facing wizard as an actual applicant would. This is the value of the manual testing pass this finding came from — automated/API-level testing had been implicitly working around the gap rather than exposing it.
