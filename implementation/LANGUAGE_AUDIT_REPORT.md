# FORSA — Legal Language & Terminology Audit Report

**Date**: 6 July 2026
**Scope**: `forsa-student`, `forsa-dashboard`, `forsa-university`, `forsa-partner`, `forsa-finance`, `forsa-guarantor`, `forsa-os`

---

## Summary

FORSA's product copy was already, by design, free of the explicitly
prohibited banking/lending vocabulary — a full sweep for every literal term
on the approved policy's avoid list (`loan`, `borrower`, `lender`, `debt`,
`interest rate`, `APR`, `consumer credit`, `financing company` in English;
`prêt`, `emprunteur`, `prêteur`, `dette`, `taux d'intérêt`, `TAEG`,
`organisme de crédit`, `société de financement`, `capacité d'endettement`
in French; `قرض`, `تمويل بنكي`, `مؤسسة تمويل`, `مقترض`, `دائن`, `مديونية`,
`فائدة`, `نسبة فائدة`, `ائتمان`, `قدرة ائتمانية` in Arabic) returned **zero
matches** across all seven repositories, before any change in this pass.

The real finding was subtler and more pervasive: the bare word
**"financing"/"financement"/"تمويل"** — not itself on the prohibited list,
but the exact framing the approved policy's required terminology
(`Tuition facilitation plan` / `Plan de facilitation des frais
universitaires` / `خطة تيسير المعاليم الجامعية`) is designed to replace —
appeared in 26 places across every customer-facing portal and several
internal staff tools: application buttons, consent checkboxes, empty
states, dashboard stat labels, a contract-ready email, and backend
exception messages. All 26 are now updated to the approved terminology.
Zero required changes were skipped for scope reasons.

---

## 1. Risky terms found

| Category | Result |
|---|---|
| Explicit prohibited terms (loan/borrower/lender/debt/credit/interest/APR + FR/AR equivalents) | **None found**, any language, any repo |
| "Financing"/"financement"/"تمويل" framing (not explicitly prohibited, but contrary to required terminology) | **26 instances** across all repos except `forsa-university`'s program logic and `forsa-guarantor`'s UI (both only had the shared `i18n.ts` copy) |
| "Credit"/"debit" as double-entry ledger accounting terms | Found in `forsa-os` (`ledger.service.ts`, `konnect.service.ts`, `reports.service.ts`) and one Finance-portal table header ("Total Credit (CR)") — **not changed**: this is standard bookkeeping vocabulary for internal Finance staff, not "credit" in the consumer-lending sense the policy targets, and mislabeling it would confuse the one audience (accountants) who needs the real term |
| "Bank" self-description risk | **None found** — the only "Bank" occurrences are `forsaBankName: 'Zitouna Bank'` (FORSA's own banking partner, disclosed for wire-transfer instructions — a normal, necessary disclosure for any organization accepting bank transfers, not FORSA describing itself as a bank) |
| False positives ruled out during the sweep | `APR` matched inside French "après" (after) in multiple files; both were verified as false positives via word-boundary re-checks, not real occurrences |

---

## 2. Files changed

**forsa-student**
- `src/pages/apply/ApplyPage.tsx` — page title, 2 consent-checkbox descriptions
- `src/pages/HomePage.tsx` — empty-state description, application status-card label
- `src/pages/application/ApplicationPage.tsx` — empty-state description, approval-banner detail
- `src/pages/apply/InterviewPage.tsx` — 2 error messages, the post-interview notice (all 3 languages)
- `src/lib/i18n.ts` — 6 strings × 3 languages (create-account subtitle, apply title/subtitle, requested-amount label, apply-to-get-started CTA)

**forsa-finance** / **forsa-guarantor**
- `src/lib/i18n.ts` — identical fixes to `forsa-student`'s (these three files were byte-for-byte identical copies; confirmed re-identical after the fix)
- `forsa-finance/src/pages/disbursements/DisbursementsPage.tsx` — description text

**forsa-partner**
- `src/pages/referrals/ReferralsPage.tsx` — WhatsApp share message, native-share text
- `src/lib/i18n.ts` — "how it works" step 2 (English only; the French/Arabic versions were already neutral)

**forsa-university**
- `src/pages/PaymentsPage.tsx` — subtitle, 2 stat-card labels, empty-state title
- `src/pages/DashboardPage.tsx` — stat-card label
- `src/pages/students/StudentsPage.tsx` — empty-state description

**forsa-dashboard**
- `src/components/ActivationChecklist.tsx` — checklist item label
- `src/lib/i18n.ts` — Queue label (3 languages) + ecosystem-note copy
- `src/pages/pending/FinancingQueuePage.tsx` — page title, description
- `src/pages/applications/ApplicationWorkflowPage.tsx` — Bronze-pathway modal copy
- `src/pages/applications/ApplicationDetailPage.tsx` — decision dropdown option
- `src/pages/universities/UniversityDetailPage.tsx` — form field label
- `src/pages/pending/FraudRecordsPage.tsx` — description text

**forsa-os**
- `scripts/seed.ts` — `contract_ready` notification template (subject + body)
- `src/payments/payments.service.ts`, `src/contracts/contracts.service.ts`, `src/applications/applications.service.ts` — 3 exception messages
- Live local database: the `notification_templates` row for `contract_ready` was also updated directly, since `ON CONFLICT DO NOTHING` means re-running the seed script alone wouldn't retroactively update an already-seeded row in any existing deployment — noting this so a production rollout applies the same update explicitly rather than assuming the seed script alone covers it.

---

## 3. Terms replaced

| Context | Before | After |
|---|---|---|
| EN | "Apply for Financing" / "financing request" / "financing amount" / "financed students" | "Apply for a Tuition Facilitation Plan" / "tuition facilitation plan request" / "tuition amount" / "supported students" |
| EN | "Financing Contract" | "Tuition Facilitation Agreement" |
| EN | "Financing Queue" / "Financing Status" / "Financing decision" | "Tuition Facilitation Queue" / "Tuition Facilitation Status" / "Tuition facilitation decision" |
| FR | "Demander un financement" / "demande de financement" | "Demander un plan de facilitation des frais universitaires" / "demande de plan de facilitation des frais universitaires" |
| FR | "Montant de financement demandé" | "Montant des frais universitaires demandé" |
| AR | "التقدم للتمويل" / "طلب التمويل" / "شروط التمويل" | "طلب خطة تيسير المعاليم الجامعية" / "طلب خطة تيسير المعاليم الجامعية" / "شروط خطة تيسير المعاليم الجامعية" |
| AR | "مبلغ التمويل المطلوب" | "مبلغ المعاليم الجامعية المطلوب" |

Every multi-language string was updated in Arabic, French, **and** English
together in the same edit — none were left partially updated.

---

## 4. Terms intentionally left for legal review

1. **"Lettres de change signed"** (`forsa-dashboard/src/components/ActivationChecklist.tsx`) —
   a specific named French legal/financial instrument (a bill of exchange /
   promissory note). This may be a real, load-bearing legal instrument type
   used in FORSA's actual signed agreements with students and universities.
   Per the audit's explicit rule not to blindly remove legal terms required
   for legal clarity, **this was not edited** — flagged here for legal
   counsel to confirm whether this instrument is still the correct legal
   mechanism under the approved "tuition facilitation" framing, or whether
   it needs to be renamed/restructured at the legal-document level (which
   this audit cannot do without the actual document).

2. **Terms of Service / Privacy Policy content** — every portal's consent
   checkboxes reference "FORSA Terms of Service" and "FORSA Privacy Policy"
   by name, but the actual legal document text does not exist anywhere in
   these seven repositories (no dedicated Terms/Privacy page component was
   found in any frontend, and no legal-copy content file exists in
   `forsa-os`). This confirms `implementation/CHANGELOG.md`'s prior note
   that **T-226 (legal copy) remains an open, separately-tracked item** —
   this audit could not review wording that isn't in the codebase. Once
   legal counsel produces the actual Terms of Service / Privacy Policy
   text, it should be checked against this same policy for consistency
   with the terminology fixed here (e.g., the legal document should also
   describe the product as a "tuition facilitation plan," not "financing,"
   for the two to read as one coherent product).

3. **Database schema identifiers** (`financing_decisions` table,
   `financing_tier`/`current_financing_level`/`max_financing_amount`
   columns, the `FinancingLevel` TypeScript enum) — these are internal
   code/schema identifiers never displayed to a user as raw text (a user
   only ever sees the labels this audit already fixed, which are computed
   from these fields). Renaming them would require a database migration —
   a structural change out of scope for a language audit, and explicitly
   excluded by this task's "do not redesign" instruction. Not flagged for
   legal review since no user-facing risk exists here; noted only for
   engineering awareness if a future pass wants full naming consistency.

---

## 5. Remaining lawyer-review items

- Confirm "Lettres de change" as a legal instrument type is still correct
  under the tuition-facilitation framing (item 1 above).
- Produce and review the actual Terms of Service / Privacy Policy text
  (T-226) — does not exist in-repo; out of this audit's reach.
- Once produced, cross-check the legal documents' own terminology against
  this report's replacements, so the product UI and the legal text describe
  the same thing the same way.
- No other legal-clarity concerns were found — this pass did not encounter
  any other instance of a legal/regulatory claim, promise, or licensing
  statement anywhere in the audited UI copy.

---

## 6. Confirmations

**Arabic and French wording were prioritized.** Every terminology fix in
this pass started from the Arabic replacement term, then French, then
English, per the approved policy's stated priority — and for every
multi-language string, all three languages were corrected together in the
same edit, never English-only followed by a later Arabic/French pass.

**No public-facing copy presents FORSA as a bank, lender, credit provider,
or loan company.** The explicit prohibited-term sweep (§1) returned zero
matches in any language, in any repository, both before and after this
pass's changes. The softer "financing" framing found and fixed in this
pass was not itself a prohibited term, but its removal further reinforces
the approved "tuition facilitation" / "membership" positioning the policy
requires. FORSA's product copy, after this pass, consistently describes
itself as a membership-based educational ecosystem and a tuition
facilitation platform — never as a source of loans or credit.

---

## 7. Verification

- `tsc --noEmit`: clean on `forsa-os` and all 6 frontend repositories.
- `npm run test` (`forsa-os`): **137/137 passing**, no test asserted on any
  of the strings changed in this pass.
- No frontend repository has an automated test suite (typecheck is the
  available verification for those six, consistent with every prior phase
  of this engagement).
- The one live-database template update (`contract_ready`) was applied
  directly to this session's local Postgres instance in addition to the
  seed-script fix, and confirmed via a direct query.

---

## 8. Launch-blocking language risk

**None remaining.** Every explicitly prohibited term was already absent.
Every instance of the softer "financing" framing found by this audit has
been corrected to the approved "tuition facilitation" terminology, in
Arabic, French, and English, across all seven repositories. The two items
flagged for lawyer review (§4–5) are legal-content gaps this audit cannot
close from inside the codebase, not language risks in the current UI —
they are follow-up items for the legal/compliance team, not something that
should hold up this specific audit's sign-off.
