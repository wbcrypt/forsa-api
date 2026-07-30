// Closed vocabularies for the Financial Assessment questionnaire. Shared by
// the DTOs (strict @IsIn validation — unlike most free-text fields
// elsewhere, these codes are scoring inputs, so a typo must be rejected,
// not silently stored) and by GET /financial-assessment/options, which the
// guarantor/dashboard frontends use to render the wizard's dropdowns
// without duplicating this list client-side.

export const RELATIONSHIPS = [
  'father', 'mother', 'spouse', 'sibling', 'uncle_aunt', 'grandparent', 'legal_guardian', 'other',
] as const;

export const GOVERNORATES = [
  'tunis', 'ariana', 'ben_arous', 'manouba', 'nabeul', 'zaghouan', 'bizerte', 'beja',
  'jendouba', 'kef', 'siliana', 'sousse', 'monastir', 'mahdia', 'sfax', 'kairouan',
  'kasserine', 'sidi_bouzid', 'gabes', 'medenine', 'tataouine', 'gafsa', 'tozeur', 'kebili',
] as const;

export const EMPLOYMENT_STATUSES = [
  'employed_public', 'employed_private', 'self_employed', 'business_owner', 'retired', 'unemployed', 'other',
] as const;

export const EMPLOYMENT_TYPES = [
  'permanent', 'temporary', 'seasonal', 'freelance', 'none',
] as const;

export const ADDITIONAL_INCOME_TYPES = [
  'none', 'rental', 'business', 'pension', 'family_support', 'freelance', 'other',
] as const;

export const VERIFICATION_DECISIONS = ['verified', 'rejected'] as const;

export const SCORE_BANDS = ['excellent', 'good', 'borderline', 'high_risk'] as const;

// Bring-to-interview checklist (no document uploads ever happen online —
// everything is verified physically). `conditional` items are only shown
// by the frontend when applicable (e.g. loan documents only if the
// guarantor declared existing loan payments).
export const INTERVIEW_CHECKLIST = [
  { code: 'original_cin', conditional: false },
  { code: 'proof_of_employment', conditional: false },
  { code: 'last_3_payslips', conditional: false },
  { code: 'last_3_bank_statements', conditional: false },
  { code: 'loan_repayment_documents', conditional: true },
  { code: 'additional_documents', conditional: false },
] as const;

export type Relationship = typeof RELATIONSHIPS[number];
export type Governorate = typeof GOVERNORATES[number];
export type EmploymentStatus = typeof EMPLOYMENT_STATUSES[number];
export type EmploymentType = typeof EMPLOYMENT_TYPES[number];
export type AdditionalIncomeType = typeof ADDITIONAL_INCOME_TYPES[number];
export type ScoreBand = typeof SCORE_BANDS[number];
