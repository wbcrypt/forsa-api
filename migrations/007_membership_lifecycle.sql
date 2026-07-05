-- Migration 007: Membership lifecycle (Phase 2, M0 + M1)
--
-- Introduces the membership-first model per D-004: a coarse, long-lived
-- membership_status on students (bronze/silver/gold/blacklisted), separate
-- from the fine-grained per-application financing status. A Visitor is
-- anonymous (no students row at all) until a Membership Request is
-- approved, at which point a real students + users row is provisioned.
--
-- Also adds password_setup_tokens: per D-001, membership approval "emails
-- a set-password link, don't invent a password" — this is the token table
-- backing that flow (POST /auth/set-password).

CREATE TABLE membership_requests (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES tenants(id),
  first_name                  VARCHAR(100) NOT NULL,
  last_name                   VARCHAR(100) NOT NULL,
  phone                       VARCHAR(50) NOT NULL,
  email                       VARCHAR(255) NOT NULL,
  city                        VARCHAR(100) NOT NULL,
  university_id               UUID REFERENCES universities(id),
  programme                   VARCHAR(255) NOT NULL,
  academic_year               VARCHAR(20) NOT NULL,
  current_or_future_student   VARCHAR(20) NOT NULL DEFAULT 'current',
  status                      VARCHAR(50) NOT NULL DEFAULT 'pending',
  reviewed_by                 UUID REFERENCES users(id),
  reviewed_at                 TIMESTAMPTZ,
  rejection_reason            TEXT,
  provisioned_student_id      UUID REFERENCES students(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_membership_request_status
    CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT chk_current_or_future
    CHECK (current_or_future_student IN ('current','future'))
);

CREATE INDEX idx_membership_requests_tenant_status ON membership_requests(tenant_id, status);

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS membership_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS member_since DATE,
  ADD COLUMN IF NOT EXISTS forsa_id VARCHAR(50) UNIQUE;

-- No CHECK constraint on membership_status values here deliberately —
-- unlike application_status (a pure app-layer VARCHAR by existing
-- convention), this is a small, closed, rarely-changing set best enforced
-- in one place (the TypeScript enum), matching how current_status already
-- works on applications. Values: bronze / silver / gold / blacklisted.

CREATE INDEX IF NOT EXISTS idx_students_membership_status ON students(membership_status);
CREATE INDEX IF NOT EXISTS idx_students_forsa_id ON students(forsa_id);

-- Append-only, mirrors application_status_history exactly.
CREATE TABLE membership_status_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES students(id),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  previous_status   VARCHAR(50),
  new_status        VARCHAR(50) NOT NULL,
  reason            TEXT,
  changed_by        UUID REFERENCES users(id),
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_membership_status_history_student ON membership_status_history(student_id);

CREATE RULE membership_status_history_no_update AS ON UPDATE TO membership_status_history DO INSTEAD NOTHING;
CREATE RULE membership_status_history_no_delete AS ON DELETE TO membership_status_history DO INSTEAD NOTHING;

-- D-001: membership approval creates a real users row but must never
-- invent a password — a one-time, hashed (never raw) token, mirroring the
-- existing user_sessions.session_token_hash / mfa_challenges.token_hash
-- convention exactly.
CREATE TABLE password_setup_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  tenant_id    UUID NOT NULL REFERENCES tenants(id),
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_setup_tokens_hash ON password_setup_tokens(token_hash) WHERE used_at IS NULL;

COMMENT ON TABLE membership_requests IS 'Phase 2 M1 — public, unauthenticated intake (Visitor -> Membership Request). Minimal fields only: no guarantor, no financial documents at this stage.';
COMMENT ON COLUMN students.membership_status IS 'Coarse, long-lived membership tier: bronze/silver/gold/blacklisted. Pure ratchet upward (D-004) except the fraud/blacklist path (T-217) — no expiry/decay job ever moves this down from silver/gold to bronze.';
COMMENT ON COLUMN students.forsa_id IS 'Assigned once on Bronze issuance (Phase 2 M3/T-205), never regenerated.';
COMMENT ON TABLE password_setup_tokens IS 'One-time, hashed set-password tokens emailed on membership approval (D-001) — raw token is never stored, only its hash.';
