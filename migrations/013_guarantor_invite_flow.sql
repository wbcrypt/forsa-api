-- Migration 013: Guarantor Invite Flow
-- Completes the invite-token infrastructure migration 004 scaffolded but
-- never wired up (invite_token/invite_sent_at existed with no expiry, no
-- endpoint ever generated or validated them, and student_guarantors rows
-- were created directly as 'active' with no pending/declined state at all).

ALTER TABLE guarantors
  ADD COLUMN IF NOT EXISTS invite_token_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN guarantors.invite_token IS 'SHA-256 hash of the one-time invite token sent by email (raw token never stored)';
COMMENT ON COLUMN guarantors.invite_token_expires_at IS 'Invite link expiry — guarantor must accept/decline before this';

-- student_guarantors.status now carries the invitation lifecycle too:
-- 'pending_invitation' (default going forward, set by addGuarantor) ->
-- 'active' (accepted) or 'declined'. No CHECK constraint added since the
-- column already allows any varchar and existing rows use 'active' /
-- 'withdrawn' — enforced at the application layer, matching the rest of
-- this schema's status columns (applications.current_status, etc.).
COMMENT ON COLUMN student_guarantors.status IS 'pending_invitation | active | declined | withdrawn';
