-- Migration 011: University portal identity isolation (T-223 discovery)
--
-- Severe pre-existing bug found while building T-223's confirmation
-- actions: forsa-university/src/pages/auth/LoginPage.tsx collects
-- "University ID" as a raw, user-typed text input on the login form and
-- stores it directly to localStorage — never validated server-side. Every
-- API call this portal makes that's scoped "to my university" trusts that
-- client-supplied value entirely. Any university-portal user can type a
-- different university's ID and immediately see that university's
-- students, applications, and payment data. This is the exact same class
-- of bug as K-03/T-103 (forsa-partner's partners[0] identity bug, fixed
-- in Phase 1) — a client-supplied identity trusted for tenant-scoped data
-- access — except worse here, since it's a manually-typed field rather
-- than even an array index.
--
-- Fix mirrors T-103 exactly: a real server-side identity link
-- (universities.user_id), resolved via a new self-scoped GET
-- /universities/me, never from anything the client sends.

ALTER TABLE universities
  ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES users(id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS university_id_linked UUID REFERENCES universities(id);

CREATE INDEX IF NOT EXISTS idx_universities_user ON universities(user_id);

COMMENT ON COLUMN universities.user_id IS 'Linked user account for university portal identity isolation (T-223 discovery, mirrors partners.user_id/T-103) — always resolve the acting university from this column keyed by the JWT user id, never from a client-supplied university id.';
COMMENT ON COLUMN users.university_id_linked IS 'Convenience linkage mirroring partner_id_linked/student_id_linked/guarantor_id.';
