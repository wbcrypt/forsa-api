-- =============================================================================
-- FORSA OS — Complete Database Schema
-- Migration 001: Initial Schema
-- Run as: psql -U forsa_migration -d forsa_os -f 001_initial_schema.sql
-- =============================================================================

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TENANTS & USERS
-- =============================================================================

CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) NOT NULL UNIQUE,
  country_code    CHAR(2) NOT NULL DEFAULT 'TN',
  default_currency CHAR(3) NOT NULL DEFAULT 'TND',
  status          VARCHAR(50) NOT NULL DEFAULT 'active',
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  email                 VARCHAR(255) NOT NULL,
  email_verified        BOOLEAN NOT NULL DEFAULT false,
  password_hash         TEXT NOT NULL,
  full_name             VARCHAR(255) NOT NULL,
  status                VARCHAR(50) NOT NULL DEFAULT 'pending_verification',
  mfa_enabled           BOOLEAN NOT NULL DEFAULT false,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  password_changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  must_change_password  BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID,
  deactivated_by        UUID,
  deactivated_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE mfa_configs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id),
  method           VARCHAR(20) NOT NULL DEFAULT 'totp',
  secret_encrypted TEXT NOT NULL,
  is_primary       BOOLEAN NOT NULL DEFAULT true,
  status           VARCHAR(20) NOT NULL DEFAULT 'active',
  verified_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE user_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id),
  tenant_id            UUID NOT NULL REFERENCES tenants(id),
  session_token_hash   TEXT NOT NULL UNIQUE,
  ip_address           INET NOT NULL,
  user_agent           TEXT,
  device_fingerprint   TEXT,
  last_active_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at           TIMESTAMPTZ NOT NULL,
  invalidated_at       TIMESTAMPTZ,
  invalidation_reason  VARCHAR(100),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(255) NOT NULL UNIQUE,
  description    TEXT,
  module         VARCHAR(100) NOT NULL,
  action         VARCHAR(100) NOT NULL,
  is_high_impact BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  name           VARCHAR(100) NOT NULL,
  description    TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  status         VARCHAR(50) NOT NULL DEFAULT 'active',
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  granted_by    UUID,
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

CREATE TABLE user_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  role_id         UUID NOT NULL REFERENCES roles(id),
  assigned_by     UUID,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  revoked_by      UUID,
  revoked_at      TIMESTAMPTZ,
  revocation_reason TEXT
);

-- =============================================================================
-- AUDIT & SECURITY
-- =============================================================================

CREATE TABLE audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID,
  user_id          UUID,
  session_id       UUID,
  action_type      VARCHAR(255) NOT NULL,
  module           VARCHAR(100) NOT NULL,
  target_entity    VARCHAR(100),
  target_id        UUID,
  previous_value   JSONB,
  new_value        JSONB,
  ip_address       INET,
  device_fingerprint TEXT,
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs are append-only — block updates and deletes
CREATE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

CREATE TABLE security_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID,
  user_id      UUID,
  session_id   UUID,
  event_type   VARCHAR(100) NOT NULL,
  severity     VARCHAR(20) NOT NULL DEFAULT 'info',
  ip_address   INET,
  user_agent   TEXT,
  endpoint     TEXT,
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE RULE no_update_security AS ON UPDATE TO security_events DO INSTEAD NOTHING;
CREATE RULE no_delete_security AS ON DELETE TO security_events DO INSTEAD NOTHING;

CREATE TABLE data_integrity_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  VARCHAR(100) NOT NULL,
  entity_id    TEXT NOT NULL,
  description  TEXT NOT NULL,
  details      JSONB,
  severity     VARCHAR(20) NOT NULL DEFAULT 'medium',
  status       VARCHAR(20) NOT NULL DEFAULT 'open',
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rate_limit_buckets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key      VARCHAR(500) NOT NULL UNIQUE,
  bucket_type     VARCHAR(100) NOT NULL,
  request_count   INT NOT NULL DEFAULT 0,
  window_start    TIMESTAMPTZ NOT NULL,
  window_end      TIMESTAMPTZ NOT NULL,
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- POLICY ENGINE
-- =============================================================================

CREATE TABLE policy_definitions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  policy_key   VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description  TEXT,
  module       VARCHAR(100) NOT NULL,
  scope_type   VARCHAR(50) NOT NULL DEFAULT 'global',
  value_type   VARCHAR(50) NOT NULL DEFAULT 'json',
  is_system    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, policy_key)
);

CREATE TABLE policy_versions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id),
  policy_definition_id UUID NOT NULL REFERENCES policy_definitions(id),
  version              INT NOT NULL,
  scope_type           VARCHAR(50) NOT NULL,
  scope_id             UUID,
  value                JSONB NOT NULL,
  priority             INT NOT NULL DEFAULT 0,
  effective_date       DATE NOT NULL,
  expiration_date      DATE,
  status               VARCHAR(50) NOT NULL DEFAULT 'draft',
  change_reason        TEXT,
  created_by           UUID,
  approved_by          UUID,
  approved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE policy_conflicts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  policy_version_a_id   UUID NOT NULL REFERENCES policy_versions(id),
  policy_version_b_id   UUID NOT NULL REFERENCES policy_versions(id),
  conflict_type         VARCHAR(100) NOT NULL,
  detected_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(policy_version_a_id, policy_version_b_id)
);

-- =============================================================================
-- UNIVERSITIES & PARTNERS
-- =============================================================================

CREATE TABLE universities (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id),
  name                 VARCHAR(255) NOT NULL,
  short_name           VARCHAR(50),
  country_code         CHAR(2) NOT NULL DEFAULT 'TN',
  city                 VARCHAR(100),
  address              TEXT,
  website              VARCHAR(255),
  accreditation_status VARCHAR(50),
  accreditation_body   VARCHAR(255),
  status               VARCHAR(50) NOT NULL DEFAULT 'prospect',
  risk_level           VARCHAR(50) NOT NULL DEFAULT 'standard',
  notes                TEXT,
  created_by           UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE university_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id),
  full_name     VARCHAR(255) NOT NULL,
  title         VARCHAR(100),
  role          VARCHAR(100),
  email         VARCHAR(255),
  phone         VARCHAR(50),
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  status        VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE university_agreements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  university_id         UUID NOT NULL REFERENCES universities(id),
  version               INT NOT NULL DEFAULT 1,
  payment_model         VARCHAR(50) NOT NULL,
  refund_policy         JSONB NOT NULL DEFAULT '{}',
  discount_percentage   NUMERIC(5,2),
  referral_commission   JSONB NOT NULL DEFAULT '{}',
  financing_levels      TEXT[] NOT NULL DEFAULT '{level1,level2,level3}',
  max_financing_amount  NUMERIC(15,2),
  currency              CHAR(3) NOT NULL DEFAULT 'TND',
  effective_date        DATE NOT NULL,
  expiration_date       DATE,
  status                VARCHAR(50) NOT NULL DEFAULT 'draft',
  signed_by_forsa       UUID,
  notes                 TEXT,
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agreement_tranches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id      UUID NOT NULL REFERENCES university_agreements(id),
  tranche_sequence  INT NOT NULL,
  percentage        NUMERIC(5,2) NOT NULL,
  trigger_type      VARCHAR(50) NOT NULL DEFAULT 'date',
  trigger_condition JSONB NOT NULL DEFAULT '{}',
  due_days_offset   INT NOT NULL DEFAULT 30,
  notes             TEXT
);

CREATE TABLE programs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id        UUID NOT NULL REFERENCES universities(id),
  name                 VARCHAR(255) NOT NULL,
  code                 VARCHAR(100),
  level                VARCHAR(50),
  duration_years       NUMERIC(3,1),
  tuition_min          NUMERIC(15,2),
  tuition_max          NUMERIC(15,2),
  currency             CHAR(3) NOT NULL DEFAULT 'TND',
  accreditation_status VARCHAR(50),
  status               VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE partners (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  name         VARCHAR(255) NOT NULL,
  type         VARCHAR(50) NOT NULL DEFAULT 'platform',
  website      VARCHAR(255),
  country_code CHAR(2),
  status       VARCHAR(50) NOT NULL DEFAULT 'active',
  notes        TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE partner_contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id),
  full_name  VARCHAR(255) NOT NULL,
  email      VARCHAR(255),
  phone      VARCHAR(50),
  role       VARCHAR(100),
  status     VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE partner_agreements (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id),
  partner_id                UUID NOT NULL REFERENCES partners(id),
  version                   INT NOT NULL DEFAULT 1,
  commission_structure      JSONB NOT NULL,
  payment_conditions        JSONB NOT NULL DEFAULT '{}',
  max_visible_information   JSONB NOT NULL DEFAULT '{}',
  allowed_reports           TEXT[] DEFAULT '{}',
  data_sharing_permissions  JSONB NOT NULL DEFAULT '{}',
  confidentiality_terms     TEXT,
  fraud_prevention_terms    TEXT,
  termination_conditions    TEXT,
  audit_rights              BOOLEAN NOT NULL DEFAULT false,
  effective_date            DATE NOT NULL,
  expiration_date           DATE,
  status                    VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_by                UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE referral_sources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  channel      VARCHAR(50) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- STUDENTS & GUARANTORS
-- =============================================================================

CREATE TABLE students (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES tenants(id),
  first_name                  VARCHAR(100) NOT NULL,
  last_name                   VARCHAR(100) NOT NULL,
  date_of_birth               DATE,
  gender                      VARCHAR(20),
  nationality                 CHAR(2),
  national_id_reference       TEXT, -- encrypted
  email                       VARCHAR(255),
  phone_primary               VARCHAR(50),
  phone_secondary             VARCHAR(50),
  city                        VARCHAR(100),
  address                     TEXT,
  status                      VARCHAR(50) NOT NULL DEFAULT 'lead',
  assigned_to_user_id         UUID REFERENCES users(id),
  created_from_application_id UUID,
  created_by                  UUID,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         UUID NOT NULL UNIQUE REFERENCES students(id),
  academic_level     VARCHAR(50),
  preferred_language VARCHAR(10) NOT NULL DEFAULT 'fr',
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE guarantors (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id),
  first_name             VARCHAR(100) NOT NULL,
  last_name              VARCHAR(100) NOT NULL,
  date_of_birth          DATE,
  national_id_reference  TEXT, -- encrypted
  relationship_to_student VARCHAR(100),
  employment_status      VARCHAR(50),
  employer_name          VARCHAR(255),
  income_stability       VARCHAR(50),
  email                  VARCHAR(255),
  phone_primary          VARCHAR(50),
  contact_reliability    VARCHAR(50) NOT NULL DEFAULT 'unknown',
  risk_level             VARCHAR(50) NOT NULL DEFAULT 'unknown',
  document_status        VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_by             UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_guarantors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id),
  guarantor_id     UUID NOT NULL REFERENCES guarantors(id),
  role             VARCHAR(50) NOT NULL DEFAULT 'primary',
  status           VARCHAR(50) NOT NULL DEFAULT 'active',
  effective_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  withdrawal_date  DATE,
  withdrawal_reason TEXT,
  withdrawal_reason_code VARCHAR(100),
  added_by         UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_exceptional_events (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                    UUID NOT NULL REFERENCES tenants(id),
  student_id                   UUID NOT NULL REFERENCES students(id),
  event_type                   VARCHAR(100) NOT NULL,
  event_reason_code            VARCHAR(100),
  description                  TEXT NOT NULL,
  affects_financial_obligations BOOLEAN NOT NULL DEFAULT false,
  affects_contract             BOOLEAN NOT NULL DEFAULT false,
  status                       VARCHAR(50) NOT NULL DEFAULT 'open',
  opened_by                    UUID,
  resolved_by                  UUID,
  resolved_at                  TIMESTAMPTZ,
  resolution_notes             TEXT,
  opened_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- APPLICATIONS & PIPELINE
-- =============================================================================

CREATE TABLE applications (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id),
  student_id               UUID NOT NULL REFERENCES students(id),
  university_id            UUID NOT NULL REFERENCES universities(id),
  program_id               UUID REFERENCES programs(id),
  referral_source_id       UUID REFERENCES referral_sources(id),
  partner_id               UUID REFERENCES partners(id),
  campaign_id              VARCHAR(255),
  tuition_amount           NUMERIC(15,2),
  requested_support_amount NUMERIC(15,2),
  currency                 CHAR(3) NOT NULL DEFAULT 'TND',
  academic_year            VARCHAR(20),
  current_status           VARCHAR(100) NOT NULL DEFAULT 'new_lead',
  current_financing_level  VARCHAR(50),
  current_pipeline_run_id  UUID,
  lead_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  is_renewal               BOOLEAN NOT NULL DEFAULT false,
  previous_application_id  UUID,
  assigned_to_user_id      UUID REFERENCES users(id),
  created_by               UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE application_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id),
  from_status     VARCHAR(100),
  to_status       VARCHAR(100) NOT NULL,
  changed_by      UUID,
  pipeline_run_id UUID,
  notes           TEXT,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE application_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id     UUID NOT NULL REFERENCES applications(id),
  document_id        UUID,
  document_type_code VARCHAR(100) NOT NULL,
  status             VARCHAR(50) NOT NULL DEFAULT 'absent',
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(application_id, document_type_code)
);

CREATE TABLE application_appeals (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id),
  application_id            UUID NOT NULL REFERENCES applications(id),
  original_decision_id      UUID NOT NULL,
  appeal_reason             TEXT NOT NULL,
  new_evidence_description  TEXT,
  deadline_for_review       DATE,
  reentry_stage             INT NOT NULL DEFAULT 4,
  status                    VARCHAR(50) NOT NULL DEFAULT 'pending',
  resolved_by               UUID,
  resolved_at               TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pipeline_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  application_id        UUID NOT NULL REFERENCES applications(id),
  run_number            INT NOT NULL,
  status                VARCHAR(50) NOT NULL DEFAULT 'active',
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  triggered_by          UUID,
  reentry_from_stage    INT,
  snapshot_application  JSONB,
  snapshot_student      JSONB,
  UNIQUE(application_id, run_number)
);

CREATE TABLE pipeline_stage_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id),
  tenant_id       UUID NOT NULL,
  stage_number    INT NOT NULL,
  stage_name      VARCHAR(100) NOT NULL,
  status          VARCHAR(50) NOT NULL,
  inputs          JSONB,
  outputs         JSONB,
  policy_version_ids TEXT[],
  duration_ms     INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pipeline_execution_traces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID NOT NULL UNIQUE REFERENCES pipeline_runs(id),
  stage_record_ids JSONB,
  full_trace      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE risk_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id    UUID NOT NULL UNIQUE REFERENCES pipeline_runs(id),
  application_id     UUID NOT NULL REFERENCES applications(id),
  student_id         UUID NOT NULL REFERENCES students(id),
  risk_score         NUMERIC(5,4) NOT NULL,
  risk_level         VARCHAR(20) NOT NULL,
  score_factor       NUMERIC(5,4),
  guarantor_factor   NUMERIC(5,4),
  university_factor  NUMERIC(5,4),
  income_factor      NUMERIC(5,4),
  requested_amount   NUMERIC(15,2),
  policy_version_ids TEXT[],
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE multi_approval_sets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id    UUID NOT NULL REFERENCES pipeline_runs(id),
  application_id     UUID NOT NULL REFERENCES applications(id),
  tenant_id          UUID NOT NULL,
  required_approvers INT NOT NULL DEFAULT 1,
  sequencing         VARCHAR(50) NOT NULL DEFAULT 'sequential',
  status             VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reviewer_decisions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id    UUID NOT NULL REFERENCES pipeline_runs(id),
  reviewer_id        UUID NOT NULL REFERENCES users(id),
  tenant_id          UUID NOT NULL,
  decision           VARCHAR(50) NOT NULL,
  approved_amount    NUMERIC(15,2),
  reviewer_snapshot  JSONB NOT NULL,
  notes              TEXT,
  decided_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE financing_decisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id     UUID NOT NULL UNIQUE REFERENCES pipeline_runs(id),
  application_id      UUID NOT NULL REFERENCES applications(id),
  tenant_id           UUID NOT NULL,
  decision_result     VARCHAR(100) NOT NULL,
  approved_level      VARCHAR(50),
  approved_amount     NUMERIC(15,2),
  currency            CHAR(3) NOT NULL DEFAULT 'TND',
  explanation         TEXT,
  conditions          JSONB,
  policy_version_ids  TEXT[],
  dcs_score           INT,
  dcs_version         VARCHAR(20),
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Financing decisions are immutable
CREATE RULE no_update_decisions AS ON UPDATE TO financing_decisions DO INSTEAD NOTHING;
CREATE RULE no_delete_decisions AS ON DELETE TO financing_decisions DO INSTEAD NOTHING;

CREATE TABLE capital_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(id),
  application_id  UUID NOT NULL REFERENCES applications(id),
  reason          TEXT NOT NULL,
  priority_score  INT NOT NULL DEFAULT 500,
  dequeued_at     TIMESTAMPTZ,
  queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- FORSA SCORE ENGINE
-- =============================================================================

CREATE TABLE forsa_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL UNIQUE REFERENCES students(id),
  aggregate_score INT NOT NULL DEFAULT 500,
  score_band      VARCHAR(50) NOT NULL DEFAULT 'medium_trust',
  score_version   VARCHAR(20) NOT NULL DEFAULT 'v1',
  ceiling_active  BOOLEAN NOT NULL DEFAULT false,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE score_running_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id),
  dimension       VARCHAR(100) NOT NULL,
  running_balance NUMERIC(7,2) NOT NULL DEFAULT 500,
  last_event_id   UUID,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, dimension)
);

CREATE TABLE score_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  student_id       UUID NOT NULL REFERENCES students(id),
  dimension        VARCHAR(100) NOT NULL,
  event_code       VARCHAR(100) NOT NULL,
  points           NUMERIC(7,2) NOT NULL,
  previous_balance NUMERIC(7,2) NOT NULL,
  new_balance      NUMERIC(7,2) NOT NULL,
  source_type      VARCHAR(50) NOT NULL,
  source_id        TEXT NOT NULL,
  severity         VARCHAR(50) NOT NULL DEFAULT 'standard',
  description      TEXT,
  reference_id     UUID,
  reference_type   VARCHAR(100),
  policy_version_id UUID,
  recorded_by      UUID,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Score events are immutable (is_active can be flipped for corrective events)
CREATE TABLE corrective_score_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL,
  student_id         UUID NOT NULL REFERENCES students(id),
  original_event_id  UUID NOT NULL UNIQUE REFERENCES score_events(id),
  dimension          VARCHAR(100) NOT NULL,
  compensating_points NUMERIC(7,2) NOT NULL,
  reason             TEXT NOT NULL,
  approved_by        UUID,
  policy_version_id  UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- DOCUMENTS
-- =============================================================================

CREATE TABLE document_types (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  category     VARCHAR(100) NOT NULL,
  description  TEXT,
  is_required  BOOLEAN NOT NULL DEFAULT false,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  entity_type        VARCHAR(50) NOT NULL,
  entity_id          UUID NOT NULL,
  document_type_code VARCHAR(100) NOT NULL,
  original_filename  VARCHAR(500) NOT NULL,
  s3_key             TEXT NOT NULL,
  s3_bucket          VARCHAR(255) NOT NULL,
  content_type       VARCHAR(100) NOT NULL,
  file_size_bytes    BIGINT,
  checksum_sha256    TEXT,
  status             VARCHAR(50) NOT NULL DEFAULT 'uploading',
  uploaded_by        UUID,
  uploaded_at        TIMESTAMPTZ,
  reviewed_by        UUID,
  reviewed_at        TIMESTAMPTZ,
  review_notes       TEXT,
  rejection_reason   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_access_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  tenant_id   UUID NOT NULL,
  accessed_by UUID NOT NULL,
  access_type VARCHAR(50) NOT NULL DEFAULT 'view',
  ip_address  INET,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CONTRACTS
-- =============================================================================

CREATE TABLE contracts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id),
  application_id          UUID NOT NULL REFERENCES applications(id),
  financing_decision_id   UUID NOT NULL REFERENCES financing_decisions(id),
  contract_type           VARCHAR(100) NOT NULL,
  version                 INT NOT NULL DEFAULT 1,
  status                  VARCHAR(50) NOT NULL DEFAULT 'draft',
  terms_s3_key            TEXT,
  terms_s3_bucket         VARCHAR(255),
  contract_terms_summary  JSONB,
  generated_by            UUID,
  sent_for_signature_at   TIMESTAMPTZ,
  fully_signed_at         TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contract_signatures (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id         UUID NOT NULL REFERENCES contracts(id),
  signatory_type      VARCHAR(50) NOT NULL,
  signatory_id        UUID NOT NULL,
  signature_reference TEXT NOT NULL,
  signed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PAYMENTS
-- =============================================================================

CREATE TABLE payment_schedules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  application_id     UUID NOT NULL REFERENCES applications(id),
  contract_id        UUID REFERENCES contracts(id),
  payment_model      VARCHAR(50) NOT NULL,
  total_amount       NUMERIC(15,2) NOT NULL,
  currency           CHAR(3) NOT NULL DEFAULT 'TND',
  grace_period_days  INT NOT NULL DEFAULT 7,
  installment_count  INT NOT NULL,
  generated_by       UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE installments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_schedule_id  UUID NOT NULL REFERENCES payment_schedules(id),
  tenant_id            UUID NOT NULL,
  sequence_number      INT NOT NULL,
  amount               NUMERIC(15,2) NOT NULL,
  currency             CHAR(3) NOT NULL DEFAULT 'TND',
  due_date             DATE NOT NULL,
  grace_due_date       DATE NOT NULL,
  status               VARCHAR(50) NOT NULL DEFAULT 'pending',
  amount_paid          NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  installment_id   UUID NOT NULL REFERENCES installments(id),
  student_id       UUID NOT NULL REFERENCES students(id),
  amount           NUMERIC(15,2) NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'TND',
  payment_method   VARCHAR(50) NOT NULL,
  reference_number VARCHAR(255),
  payment_date     DATE NOT NULL,
  status           VARCHAR(50) NOT NULL DEFAULT 'confirmed',
  received_by      UUID,
  reversed_at      TIMESTAMPTZ,
  reversed_by      UUID,
  reversal_reason  TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE university_disbursements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  university_id    UUID NOT NULL REFERENCES universities(id),
  application_id   UUID NOT NULL REFERENCES applications(id),
  amount           NUMERIC(15,2) NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'TND',
  payment_reference VARCHAR(255),
  payment_method   VARCHAR(50),
  disbursed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status           VARCHAR(50) NOT NULL DEFAULT 'disbursed',
  recorded_by      UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE financial_ledger (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  application_id UUID REFERENCES applications(id),
  entry_type     VARCHAR(10) NOT NULL CHECK (entry_type IN ('debit','credit')),
  account        VARCHAR(100) NOT NULL,
  amount         NUMERIC(15,2) NOT NULL,
  currency       CHAR(3) NOT NULL DEFAULT 'TND',
  reference_id   UUID,
  reference_type VARCHAR(100),
  description    TEXT,
  batch_id       UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Financial ledger is append-only
CREATE RULE no_update_ledger AS ON UPDATE TO financial_ledger DO INSTEAD NOTHING;
CREATE RULE no_delete_ledger AS ON DELETE TO financial_ledger DO INSTEAD NOTHING;

CREATE TABLE partner_commissions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id),
  partner_id           UUID NOT NULL REFERENCES partners(id),
  partner_agreement_id UUID REFERENCES partner_agreements(id),
  application_id       UUID NOT NULL REFERENCES applications(id),
  student_id           UUID NOT NULL REFERENCES students(id),
  commission_basis     VARCHAR(50) NOT NULL,
  gross_amount         NUMERIC(15,2) NOT NULL,
  forsa_share          NUMERIC(15,2) NOT NULL,
  partner_share        NUMERIC(15,2) NOT NULL,
  currency             CHAR(3) NOT NULL DEFAULT 'TND',
  policy_version_id    UUID,
  status               VARCHAR(50) NOT NULL DEFAULT 'lead',
  approved_by          UUID,
  approved_at          TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- COLLECTIONS
-- =============================================================================

CREATE TABLE collection_contact_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL,
  installment_id     UUID NOT NULL REFERENCES installments(id),
  student_id         UUID NOT NULL REFERENCES students(id),
  contact_method     VARCHAR(50) NOT NULL,
  outcome            VARCHAR(100) NOT NULL,
  notes              TEXT,
  logged_by          UUID,
  next_follow_up_date DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- EXECUTION ENGINE
-- =============================================================================

CREATE TABLE execution_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id  VARCHAR(500) NOT NULL UNIQUE,
  tenant_id     UUID NOT NULL,
  action_type   VARCHAR(255) NOT NULL,
  payload       JSONB NOT NULL,
  status        VARCHAR(50) NOT NULL DEFAULT 'pending',
  result        JSONB,
  error_message TEXT,
  requested_by  UUID,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Execution ledger entries transition to committed and then become immutable
CREATE TABLE outbox_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  event_type   VARCHAR(255) NOT NULL,
  payload      JSONB NOT NULL,
  status       VARCHAR(50) NOT NULL DEFAULT 'pending',
  retry_count  INT NOT NULL DEFAULT 0,
  last_error   TEXT,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE TABLE notification_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             VARCHAR(100) NOT NULL,
  channel          VARCHAR(50) NOT NULL,
  name             VARCHAR(255) NOT NULL,
  subject_template TEXT,
  body_template    TEXT NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(code, channel)
);

CREATE TABLE notification_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL,
  template_id      UUID REFERENCES notification_templates(id),
  recipient_id     UUID NOT NULL,
  recipient_email  VARCHAR(255),
  recipient_phone  VARCHAR(50),
  channel          VARCHAR(50) NOT NULL,
  subject          TEXT,
  body             TEXT NOT NULL,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message    TEXT,
  reference_id     UUID,
  reference_type   VARCHAR(100),
  triggered_by     UUID,
  sent_at          TIMESTAMPTZ,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Users
CREATE INDEX idx_users_tenant_status ON users(tenant_id, status);
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_hash ON user_sessions(session_token_hash);

-- Applications
CREATE INDEX idx_applications_tenant_status ON applications(tenant_id, current_status);
CREATE INDEX idx_applications_student ON applications(student_id);
CREATE INDEX idx_applications_university ON applications(university_id);
CREATE INDEX idx_applications_assigned ON applications(assigned_to_user_id);

-- Installments
CREATE INDEX idx_installments_status ON installments(status, due_date);
CREATE INDEX idx_installments_schedule ON installments(payment_schedule_id);

-- Payments
CREATE INDEX idx_payments_installment ON payments(installment_id);
CREATE INDEX idx_payments_student ON payments(student_id, payment_date);

-- Score
CREATE INDEX idx_score_events_student ON score_events(student_id, dimension, created_at);
CREATE INDEX idx_score_events_active ON score_events(student_id, is_active);

-- Pipeline
CREATE INDEX idx_pipeline_application ON pipeline_runs(application_id, run_number);

-- Audit
CREATE INDEX idx_audit_tenant_date ON audit_logs(tenant_id, created_at);
CREATE INDEX idx_audit_target ON audit_logs(target_entity, target_id);

-- Policy
CREATE INDEX idx_policy_versions_key ON policy_versions(policy_definition_id, status, effective_date);

-- Outbox
CREATE INDEX idx_outbox_pending ON outbox_events(status, created_at) WHERE status = 'pending';

COMMIT;
