-- Migration 016: Final Case Flow Refinement (Phase 14)
--
-- Core decision: "the student must NOT manually enter tuition amount or
-- requested support amount. Tuition and plan values must come from the
-- university/program configuration created by FORSA/admin." This adds a
-- single authoritative tuition_amount per program (tuition_min/tuition_max
-- remain as a display range where set, but the actual value an
-- application is created with is now always this column, looked up
-- server-side — never trusted from the client).
--
-- Also adds: the student's requested plan (Silver/Gold — a preference the
-- student expresses, not a decision; the admin still makes the actual
-- tier decision exactly as before), the 30 TND/month administrative fee
-- acknowledgment timestamp, the optional non-scoring "why FORSA" analytics
-- answer, and the V1 internal FORSA Stability Score fields (computed
-- deterministically from student + guarantor profile data — never from
-- documents, enrollment proof, or FORSA history, and never by the AI
-- itself; see STABILITY_SCORE_MODEL.md).

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS tuition_amount NUMERIC(15,2);

-- Backfill: for existing seeded programs, tuition_min is the closest
-- existing approximation of a single authoritative figure.
UPDATE programs SET tuition_amount = tuition_min WHERE tuition_amount IS NULL AND tuition_min IS NOT NULL;

COMMENT ON COLUMN programs.tuition_amount IS 'The single authoritative tuition figure a Tuition Facilitation application is created with. tuition_min/tuition_max remain for display purposes where a program covers a range of specializations, but applications.tuition_amount is always populated from this column server-side, never from client input.';

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS requested_tier VARCHAR(20),
  ADD COLUMN IF NOT EXISTS platform_fee_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS forsa_choice_reason VARCHAR(100),
  ADD COLUMN IF NOT EXISTS stability_score_overall NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS stability_score_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS stability_ai_explanation JSONB;

COMMENT ON COLUMN applications.requested_tier IS 'silver | gold — the plan the student requested at application time. Distinct from financing_tier, which is the tier an admin actually approves at decision time; a request is never auto-approved.';
COMMENT ON COLUMN applications.platform_fee_acknowledged_at IS 'Set only when the student explicitly checked "I understand that FORSA charges 30 TND/month as an administrative platform fee" before submitting — createForSelf rejects submission without it.';
COMMENT ON COLUMN applications.forsa_choice_reason IS 'Optional analytics-only answer to "Why are you choosing FORSA?" — never used in scoring or decisioning.';
COMMENT ON COLUMN applications.stability_score_overall IS 'V1 internal FORSA Stability Score — Guarantor Stability 60%, Household Stability 20%, Payment Capacity 15%, Student Stability Bonus 5%. Computed deterministically server-side once the guarantor completes their Financial Responsibility Profile; never computed or set by the AI.';
COMMENT ON COLUMN applications.stability_score_breakdown IS 'The 4 sub-scores (0-100 each) that produced stability_score_overall, for full transparency in the admin Case Summary.';
COMMENT ON COLUMN applications.stability_ai_explanation IS 'AI-generated explanation of the score: risk factors, positive factors, and suggested meeting questions. Advisory only — the AI never approves or rejects; see STABILITY_SCORE_MODEL.md.';
