-- Migration 008: Digital Student Pass (Phase 2 M2, T-205/T-206)
--
-- Generate-once, status-updates-only: one row per student, ever. The pass
-- is issued the moment Bronze membership is granted (same transaction as
-- MembershipService.approve()) and never recreated — only its `status`
-- (active/revoked) changes thereafter. University/academic year are NOT
-- denormalized onto this table — they're read live via the student's
-- originating membership_requests row (provisioned_student_id), keeping
-- exactly one source of truth rather than a copy that can drift.

CREATE TABLE digital_student_passes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL UNIQUE REFERENCES students(id),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  verification_token    TEXT NOT NULL UNIQUE,
  status                VARCHAR(50) NOT NULL DEFAULT 'active',
  issued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at            TIMESTAMPTZ,
  revoked_by            UUID REFERENCES users(id),
  revoked_reason        TEXT,
  -- Nullable, unused today — reserved so a future wallet-provider
  -- integration (Apple Wallet / Google Wallet) doesn't need a breaking
  -- migration to add them later.
  apple_wallet_pass_id  TEXT,
  google_wallet_pass_id TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_pass_status CHECK (status IN ('active','revoked'))
);

CREATE INDEX idx_digital_passes_token ON digital_student_passes(verification_token) WHERE status = 'active';
CREATE INDEX idx_digital_passes_tenant ON digital_student_passes(tenant_id);

COMMENT ON TABLE digital_student_passes IS 'Phase 2 T-205/T-206 — one row per student, generated once on Bronze issuance, never recreated. Status (active/revoked) is the only thing that ever changes.';
COMMENT ON COLUMN digital_student_passes.verification_token IS 'Opaque public token embedded in the QR code — GET /pass/verify/:token resolves it to a live status check, not a static payload.';
