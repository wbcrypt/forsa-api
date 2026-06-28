-- Migration 004: Guarantor Portal
-- Adds portal access for guarantors linked to students

-- Add portal_type to users and guarantor link
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS portal_type   VARCHAR(50) DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS guarantor_id  UUID REFERENCES guarantors(id),
  ADD COLUMN IF NOT EXISTS student_id_linked UUID REFERENCES students(id);

-- Add email + portal invite to guarantors table
ALTER TABLE guarantors
  ADD COLUMN IF NOT EXISTS email            VARCHAR(255),
  ADD COLUMN IF NOT EXISTS invite_token     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS invite_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_activated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS user_id          UUID REFERENCES users(id);

-- Index for guarantor portal lookups
CREATE INDEX IF NOT EXISTS idx_guarantors_email ON guarantors(email);
CREATE INDEX IF NOT EXISTS idx_guarantors_user  ON guarantors(user_id);
CREATE INDEX IF NOT EXISTS idx_users_portal_type ON users(portal_type, tenant_id);

COMMENT ON COLUMN guarantors.email IS 'Guarantor email for portal access and notifications';
COMMENT ON COLUMN guarantors.invite_token IS 'One-time invite token sent by email';
COMMENT ON COLUMN guarantors.portal_activated IS 'Whether guarantor has activated their portal account';
COMMENT ON COLUMN guarantors.user_id IS 'Linked user account for portal access';
