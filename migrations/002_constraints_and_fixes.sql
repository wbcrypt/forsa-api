-- Migration 002: Add missing constraints and indexes
BEGIN;

-- capital_queue: unique on pipeline_run_id so ON CONFLICT DO NOTHING works
ALTER TABLE capital_queue 
  ADD CONSTRAINT uq_capital_queue_run UNIQUE (pipeline_run_id);

-- policy_conflicts: unique constraint for ON CONFLICT DO NOTHING
ALTER TABLE policy_conflicts
  ADD CONSTRAINT uq_policy_conflict UNIQUE (policy_version_a_id, policy_version_b_id);

-- rate_limit_buckets: index for MFA challenge lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_key_type 
  ON rate_limit_buckets(bucket_key, bucket_type);

-- outbox_events: index for processing
CREATE INDEX IF NOT EXISTS idx_outbox_status_created 
  ON outbox_events(status, created_at) WHERE status = 'pending';

-- execution_ledger: index for lookup
CREATE INDEX IF NOT EXISTS idx_execution_id 
  ON execution_ledger(execution_id);

-- user_roles: unique constraint to prevent duplicate role assignments
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_active
  ON user_roles(user_id, role_id) WHERE revoked_at IS NULL;

-- notification_logs: index for in-app notification queries
CREATE INDEX IF NOT EXISTS idx_notification_recipient
  ON notification_logs(recipient_id, channel, created_at DESC);

-- collection_contact_logs: index
CREATE INDEX IF NOT EXISTS idx_contact_log_installment
  ON collection_contact_logs(installment_id);

-- forsa_scores: ensure one score record per student
-- (already has UNIQUE via the entity but add explicit constraint)
-- Already has UNIQUE(student_id) from schema

-- Add missing column: score_events needs tenant scoping index
CREATE INDEX IF NOT EXISTS idx_score_events_tenant
  ON score_events(tenant_id, student_id, created_at DESC);

-- Pipeline stage records index
CREATE INDEX IF NOT EXISTS idx_stage_records_run
  ON pipeline_stage_records(pipeline_run_id, stage_number);

COMMIT;

-- Proper MFA challenge table (replaces rate_limit_buckets hack)
CREATE TABLE IF NOT EXISTS mfa_challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  TEXT NOT NULL UNIQUE,
  user_id     UUID NOT NULL REFERENCES users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_challenge_token 
  ON mfa_challenges(token_hash) WHERE used_at IS NULL;
