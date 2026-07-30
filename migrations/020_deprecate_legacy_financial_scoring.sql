-- Migration 020: Remove the legacy Financial Responsibility Profile /
-- Stability Score system (migrations 014 & 016), now fully superseded by
-- the Financial Assessment module (migration 018).
--
-- "There must only be ONE official financial score in the platform." The
-- Financial Assessment questionnaire + interview verification is that one
-- score going forward. All code that read or wrote these columns has been
-- removed in this same change (guarantors.service.ts#updateMyFinancialProfile
-- / #recomputeStabilityScore, the PATCH /guarantors/my-case/financial-profile
-- route, src/ai/stability-score.util.ts, and the corresponding UI in both
-- the guarantor portal and the admin Case Summary tab) — these columns are
-- confirmed unreferenced before being dropped here.
--
-- Note for a real production rollout (this repo's local/demo database has
-- only synthetic seed data): dropping columns is irreversible. A staged
-- rollout would keep this migration split into two steps — deprecate
-- in place (stop writing, comment the columns, ship a release) for one
-- full release cycle, then drop in a follow-up migration — rather than
-- doing both at once, so any downstream reporting/export job that still
-- reads these columns has a chance to surface before the data is gone.

ALTER TABLE guarantors
  DROP COLUMN IF EXISTS employment_duration_years,
  DROP COLUMN IF EXISTS salary_range,
  DROP COLUMN IF EXISTS income_source,
  DROP COLUMN IF EXISTS marital_status,
  DROP COLUMN IF EXISTS number_of_dependents,
  DROP COLUMN IF EXISTS home_ownership,
  DROP COLUMN IF EXISTS monthly_expenses,
  DROP COLUMN IF EXISTS existing_loans_amount,
  DROP COLUMN IF EXISTS other_guarantees,
  DROP COLUMN IF EXISTS supporting_other_students,
  DROP COLUMN IF EXISTS financial_profile_completed_at;

ALTER TABLE applications
  DROP COLUMN IF EXISTS stability_score_overall,
  DROP COLUMN IF EXISTS stability_score_breakdown,
  DROP COLUMN IF EXISTS stability_ai_explanation;
