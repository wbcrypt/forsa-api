-- Migration 018: Financial Assessment module
--
-- NOT a loan application. This is the guarantor's pre-qualification
-- questionnaire, completed before the in-person interview (see Phase 13/14
-- Case Management — "no document upload, originals verified in person").
-- One assessment per application, filled in by the guarantor across the
-- 7-step wizard, auto-scored on submission (0-100), then reviewed/corrected
-- by interview staff who re-run the same scoring engine on the verified
-- values.
--
-- Distinct from guarantors.financial_profile_* (migration 013/014's
-- lightweight "Financial Responsibility Profile" — salary_range bucket,
-- home_ownership, etc., feeding the coarse "Stability Score" used for Case
-- readiness gating). This table is the detailed, exact-figure assessment
-- with a full scoring breakdown and a staff verification workflow; the two
-- features currently coexist.

CREATE TABLE financial_assessments (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     UUID NOT NULL REFERENCES tenants(id),
  application_id                UUID NOT NULL REFERENCES applications(id),
  student_id                    UUID NOT NULL REFERENCES students(id),
  guarantor_id                  UUID NOT NULL REFERENCES guarantors(id),

  -- Identity
  full_name                     VARCHAR(255),
  cin_reference                 TEXT, -- encrypted (AES-256-GCM, same as students.national_id_reference)
  relationship                  VARCHAR(50),
  date_of_birth                 DATE,
  phone_number                  VARCHAR(30),
  governorate                   VARCHAR(50),

  -- Employment
  employment_status             VARCHAR(50),
  employer_name                 VARCHAR(255),
  job_title                     VARCHAR(255),
  years_with_employer           NUMERIC(4,1),
  employment_type               VARCHAR(50),

  -- Income
  monthly_net_income            NUMERIC(12,2),
  additional_income_type        VARCHAR(50),
  additional_income_amount      NUMERIC(12,2),
  total_monthly_income          NUMERIC(12,2), -- server-computed: net + additional, never trusted from client

  -- Financial commitments
  monthly_loan_payments         NUMERIC(12,2) DEFAULT 0,
  has_previous_unpaid_installments BOOLEAN,

  -- Banking
  bank_name                     VARCHAR(255),
  has_returned_cheque           BOOLEAN,
  has_salary_seizure            BOOLEAN,
  has_frequent_overdraft        BOOLEAN,

  -- Savings
  approximate_savings           NUMERIC(12,2),

  -- Self-declaration / wizard state
  declared_snapshot             JSONB, -- immutable copy of every field above, frozen at submission time
  self_declaration_confirmed    BOOLEAN NOT NULL DEFAULT false,
  status                        VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | submitted
  submitted_at                  TIMESTAMPTZ,

  -- Interview verification
  verification_status           VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | verified | rejected
  verified_by                   UUID REFERENCES users(id),
  verified_at                   TIMESTAMPTZ,
  interview_notes               TEXT,

  -- Scoring (recomputed on submit, and again on every interview correction)
  income_score                  NUMERIC(5,2),
  debt_ratio_score              NUMERIC(5,2),
  employment_score              NUMERIC(5,2),
  banking_score                 NUMERIC(5,2),
  savings_score                 NUMERIC(5,2),
  final_score                   NUMERIC(5,2),
  score_band                    VARCHAR(20), -- excellent | good | borderline | high_risk
  score_calculated_at           TIMESTAMPTZ,

  created_by                    UUID,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(application_id)
);

CREATE INDEX idx_financial_assessments_tenant ON financial_assessments(tenant_id);
CREATE INDEX idx_financial_assessments_guarantor ON financial_assessments(guarantor_id);
CREATE INDEX idx_financial_assessments_verification_status ON financial_assessments(verification_status);

-- Per-field audit trail: "Store original value and verified value for
-- every editable financial field." One row is appended every time interview
-- staff changes a field away from its previously-stored value — original_value
-- is always what was stored immediately before this correction (so the very
-- first row for a field captures the guarantor's true self-declared value),
-- not a fixed pair of columns on the parent row. Append-only, mirrors the
-- score_events immutable-log pattern used elsewhere in this schema.
CREATE TABLE financial_assessment_field_corrections (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_assessment_id   UUID NOT NULL REFERENCES financial_assessments(id),
  field_name                VARCHAR(100) NOT NULL,
  original_value             TEXT,
  verified_value             TEXT,
  changed_by                UUID NOT NULL REFERENCES users(id),
  changed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_assessment_corrections_assessment ON financial_assessment_field_corrections(financial_assessment_id);

COMMENT ON TABLE financial_assessments IS 'Guarantor pre-qualification questionnaire (not a loan application) — self-declared then interview-verified, auto-scored 0-100.';
COMMENT ON TABLE financial_assessment_field_corrections IS 'Append-only audit trail of every field an interviewer corrected away from the guarantor''s declared value.';
COMMENT ON COLUMN financial_assessments.cin_reference IS 'AES-256-GCM encrypted — see src/common/utils/encryption.util.ts, same convention as students.national_id_reference.';
