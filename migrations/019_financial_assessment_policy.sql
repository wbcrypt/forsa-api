-- Migration 019: Financial Assessment scoring policy definitions
--
-- Registers the 6 configurable scoring groups (income bands, debt-to-income
-- ratio bands, employment weights, banking weights, savings bands, score
-- band labels) as policy_definitions rows, so a tenant admin can override
-- any of them via the existing Policy Engine (POST /policy/versions, then
-- POST /policy/versions/:id/approve) without a code deploy — see
-- src/financial-assessment/financial-assessment-policy.service.ts.
--
-- This seeds *definitions* only, not active *versions* — same as every
-- other policy key already used by score.service.ts / pipeline.service.ts
-- (neither of which has ever had its definitions seeded either; this
-- migration actually makes Financial Assessment the first policy area in
-- this codebase where GET /policy/definitions works out of the box). With
-- no active version, FinancialAssessmentPolicyService.getConfig() falls
-- back to DEFAULT_FINANCIAL_ASSESSMENT_POLICY, so behavior is unchanged
-- until FORSA staff actually create and approve an override.
--
-- policy_definitions.tenant_id is NOT NULL (policies are per-tenant), so
-- this seeds one row per existing tenant. Any tenant created after this
-- migration runs will need the same 6 rows added at tenant-provisioning
-- time — there is currently no hook for that (a pre-existing gap in the
-- Policy Engine feature, not introduced here; flagged in the module's
-- final report as follow-up work).

INSERT INTO policy_definitions (tenant_id, policy_key, display_name, description, module, scope_type, value_type, is_system)
SELECT t.id, x.policy_key, x.display_name, x.description, 'financial_assessment', 'global', 'json', true
FROM tenants t
CROSS JOIN (VALUES
  ('financial_assessment.income_bands', 'Financial Assessment — Income Score Bands',
   'Array of {min, points} — total monthly income thresholds mapped to the 0-30 pt Income Score.'),
  ('financial_assessment.debt_ratio_bands', 'Financial Assessment — Debt-to-Income Ratio Bands',
   '{bands: [{maxRatio, points}], unpaidInstallmentsPenaltyFactor} — debt ratio thresholds for the 0-25 pt Debt Ratio Score, plus the penalty multiplier applied when previous unpaid installments were declared.'),
  ('financial_assessment.employment_weights', 'Financial Assessment — Employment Stability Weights',
   '{maxPoints, statusPoints, typePoints, tenureBands} — weights for the 0-20 pt Employment Score.'),
  ('financial_assessment.banking_weights', 'Financial Assessment — Banking Behaviour Weights',
   '{maxPoints, deductions: {returnedCheque, salarySeizure, frequentOverdraft}} — deductions for the 0-15 pt Banking Score.'),
  ('financial_assessment.savings_bands', 'Financial Assessment — Savings Score Bands',
   'Array of {min, points} — approximate savings thresholds mapped to the 0-10 pt Savings Score.'),
  ('financial_assessment.score_bands', 'Financial Assessment — Risk Band Labels',
   'Array of {code, minScore, label} — final-score cutoffs and display labels for Excellent/Good/Borderline/High Risk.')
) AS x(policy_key, display_name, description)
ON CONFLICT (tenant_id, policy_key) DO NOTHING;
