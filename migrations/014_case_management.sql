-- Migration 014: Case Management & Dual Applicant Workflow (Phase 13)
--
-- FORSA does not evaluate only the student — it evaluates
-- Student + Guarantor + Educational Request as one Case. This migration
-- is purely additive: it extends the student and guarantor financial
-- profiles with the fields a real underwriting decision needs, adds an
-- "expected graduation" academic field to applications, and introduces
-- case_meetings — a genuinely new capability (the pre-contract
-- verification meeting) that the product copy already referenced
-- (see guarantors.service.ts / DocumentsPage.tsx "Activation Meeting")
-- but never had a real table behind it.
--
-- Deliberately NOT touched: applications.current_status, its allowed
-- transitions, any permission/role table, or the pipeline_runs /
-- pipeline_stage_records tables — the operational pipeline and its
-- business rules are unchanged, per this phase's explicit constraints.
-- The "Case" itself is not a new physical entity either — an
-- application already *is* the case; it is exposed as one through a
-- new aggregation layer (application-stages / case.util on the backend),
-- not a new table that would duplicate applications.

-- ---------------------------------------------------------------------
-- Student: Financial + Personal profile (Step 1 of the Case wizard)
-- ---------------------------------------------------------------------
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS monthly_income NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS has_scholarship BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS scholarship_details TEXT,
  ADD COLUMN IF NOT EXISTS existing_loans_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS other_financial_commitments TEXT,
  ADD COLUMN IF NOT EXISTS living_situation VARCHAR(50),
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(100);

COMMENT ON COLUMN students.living_situation IS 'e.g. with_family | shared_housing | independent | university_housing';
COMMENT ON COLUMN students.employment_status IS 'e.g. unemployed | part_time | full_time | freelance — student''s own employment, distinct from the guarantor''s';

-- Academic: "expected graduation" — the one field from the Case wizard's
-- Academic section not already covered by applications.university_id /
-- program_id / academic_year / tuition_amount.
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS expected_graduation_date DATE;

-- ---------------------------------------------------------------------
-- Guarantor: Financial Responsibility Profile (Step 4 of the Case wizard)
-- ---------------------------------------------------------------------
ALTER TABLE guarantors
  ADD COLUMN IF NOT EXISTS employment_duration_years NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS salary_range VARCHAR(50),
  ADD COLUMN IF NOT EXISTS income_source VARCHAR(100),
  ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS number_of_dependents INTEGER,
  ADD COLUMN IF NOT EXISTS home_ownership VARCHAR(50),
  ADD COLUMN IF NOT EXISTS monthly_expenses NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS existing_loans_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS other_guarantees TEXT,
  ADD COLUMN IF NOT EXISTS supporting_other_students BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS financial_profile_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN guarantors.financial_profile_completed_at IS 'Set once the guarantor completes the Financial Responsibility Profile after accepting their invitation — distinct from portal_activated (account created) and from document_status (supporting documents)';
COMMENT ON COLUMN guarantors.salary_range IS 'Banded, not exact — e.g. under_2000 | 2000_5000 | 5000_10000 | over_10000 (TND/month)';

-- ---------------------------------------------------------------------
-- case_meetings — the pre-contract identity/original-document
-- verification meeting. Generated after "approval in principle"
-- (approved_levelN), scheduled by staff, attended by both student and
-- guarantor. This is a real capability that did not exist before this
-- migration; the product's own copy referenced an "Activation Meeting"
-- without ever having a table or endpoint behind it.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS case_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  application_id UUID NOT NULL REFERENCES applications(id),
  reference_number VARCHAR(50) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  office_location TEXT NOT NULL,
  assigned_officer_user_id UUID REFERENCES users(id),
  estimated_duration_minutes INTEGER DEFAULT 30,
  required_documents JSONB NOT NULL DEFAULT '[]',
  required_attendees JSONB NOT NULL DEFAULT '["student", "guarantor"]',
  special_instructions TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  cancellation_reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT case_meetings_reference_number_key UNIQUE (reference_number)
);

COMMENT ON COLUMN case_meetings.status IS 'scheduled | confirmed | completed | rescheduled | cancelled';
COMMENT ON TABLE case_meetings IS 'One row per scheduled meeting for a Case (an application). A Case may accumulate several rows across reschedules — the latest non-cancelled row is the current meeting.';

CREATE INDEX IF NOT EXISTS idx_case_meetings_application ON case_meetings(application_id);
CREATE INDEX IF NOT EXISTS idx_case_meetings_tenant_status ON case_meetings(tenant_id, status);
