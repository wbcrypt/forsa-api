-- Migration 010: Admin decision flow (Phase 2 M5+M7, T-213/T-214/T-217)
--
-- 1. applications.financing_tier — silver/gold, set by the human decision
--    at approval time. Deliberately a SEPARATE axis from
--    current_financing_level (level1/2/3, the approval-*authority* tier by
--    dollar amount) per D-004 — these must never be conflated.
-- 2. reviewer_decisions.financing_tier — carries the reviewer's tier choice
--    through to Stage 10 (Decision Execution), which is what actually
--    ratchets students.membership_status up.
-- 3. fraud_records — permanent blacklist trail. Matching key note: national
--    ID is not structurally captured at Membership Request time (intake is
--    deliberately minimal per T-203/the spec) or anywhere else as a
--    queryable field yet — it only ever exists as an uploaded document
--    image. This table's identity_hash is therefore a deterministic hash
--    of normalized email for V1 (the one identity signal collected from
--    Visitor onward), not a true national-ID-based key. Upgrading to a
--    stronger key is a real follow-up once national ID is captured as a
--    structured field earlier in the flow — noted, not silently assumed
--    solved.

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS financing_tier VARCHAR(20);

ALTER TABLE reviewer_decisions
  ADD COLUMN IF NOT EXISTS financing_tier VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_override BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE fraud_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  student_id        UUID REFERENCES students(id),
  identity_hash      TEXT NOT NULL,
  reason            TEXT NOT NULL,
  evidence_notes    TEXT,
  flagged_by        UUID REFERENCES users(id),
  flagged_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fraud_records_identity_hash ON fraud_records(identity_hash);
CREATE INDEX idx_fraud_records_tenant ON fraud_records(tenant_id);

-- Append-only, mirrors the platform's other audit-trail tables.
CREATE RULE fraud_records_no_update AS ON UPDATE TO fraud_records DO INSTEAD NOTHING;
CREATE RULE fraud_records_no_delete AS ON DELETE TO fraud_records DO INSTEAD NOTHING;

COMMENT ON COLUMN applications.financing_tier IS 'silver/gold — set by the human decision (T-213). Separate axis from current_financing_level (level1/2/3, approval-authority tier) per D-004 — never conflate the two.';
COMMENT ON COLUMN reviewer_decisions.is_override IS 'T-214 — true only for a CEO override (bypasses the K-12 dual/executive-approver consensus requirement). Always distinctly flagged, never indistinguishable from a normal reviewer decision.';
COMMENT ON TABLE fraud_records IS 'T-217 — permanent blacklist trail. identity_hash is a deterministic hash of normalized email for V1 (national ID is not a structured field anywhere in the flow yet — see migration comment).';
