-- Migration 009: Financing Request (Phase 2 M3, T-207/T-208/T-209)
--
-- Two unrelated gaps surfaced while wiring the Financing Request flow to
-- actually work end-to-end:
--
-- 1. applications.ai_score_overall/ai_recommendation/ai_report/
--    interview_language/interview_transcript were referenced by
--    src/seeds/seed-demo.ts and by the student portal's InterviewPage.tsx
--    payload, but were never actually migrated — every AI-interview
--    submission was silently dropping this data (the INSERT in
--    applications.service.ts#create() never referenced these columns
--    because they didn't exist).
-- 2. document_types/documents have no expiry/freshness tracking at all,
--    despite FORSA_PLATFORM_SPEC.md describing it as already scaffolded —
--    confirmed directly against the live schema this is not the case
--    (see PHASE_2_PLAN.md's M3 risk note).

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS ai_score_overall NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS ai_recommendation VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ai_report JSONB,
  ADD COLUMN IF NOT EXISTS interview_language VARCHAR(10),
  ADD COLUMN IF NOT EXISTS interview_transcript TEXT;

ALTER TABLE document_types
  ADD COLUMN IF NOT EXISTS validity_months INT;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS expires_at DATE;

CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON documents(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN applications.ai_report IS 'K-18/D-008 — Household Stability + AI interview output. demo_mode:true entries (see ai_service/InterviewPage.tsx) must never be treated as a real assessment.';
COMMENT ON COLUMN document_types.validity_months IS 'NULL = never expires. Set on document_types where the spec requires "current" documents (income proof, bank statements, etc.) — T-209.';
COMMENT ON COLUMN documents.expires_at IS 'Computed at confirm-upload time from document_types.validity_months. NULL if that type never expires.';
