-- Migration 005: Phase 1 identity linkage
-- Adds the "resolve identity server-side from the JWT, never from a
-- client-supplied id" linkage for students and partners, mirroring the
-- guarantors.user_id pattern already added in migration 004.
--
-- T-101: student self-registration -> real users row (students.user_id)
-- T-103: partner portal identity isolation (partners.user_id) — GET
--        /partners/me resolves via WHERE partners.user_id = <jwt id>,
--        never via a client-supplied partner id (see K-03).

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES users(id);

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES users(id);

-- Mirrors the guarantor_id / student_id_linked convenience columns already
-- added to `users` in migration 004, for the same "which portal identity
-- does this user map to" bookkeeping.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS partner_id_linked UUID REFERENCES partners(id);

CREATE INDEX IF NOT EXISTS idx_students_user  ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_partners_user  ON partners(user_id);

COMMENT ON COLUMN students.user_id IS 'Linked user account for student self-service portal access (T-101). Self-registration creates both rows in one transaction.';
COMMENT ON COLUMN partners.user_id IS 'Linked user account for partner portal identity isolation (T-103) — always resolve the acting partner from this column keyed by the JWT user id, never from a client-supplied partner id.';
COMMENT ON COLUMN users.partner_id_linked IS 'Convenience linkage mirroring guarantor_id/student_id_linked added in migration 004.';
