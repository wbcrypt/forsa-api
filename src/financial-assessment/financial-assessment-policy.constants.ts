import { ScoreBand } from './financial-assessment.constants';

// Everything the scoring engine (financial-assessment.scoring.ts) needs to
// compute a score, expressed as data rather than code — no threshold or
// weight is hardcoded in the engine itself. Each of the 6 groups below maps
// 1:1 to one PolicyService key (see financial-assessment-policy.service.ts),
// so a tenant admin can override any of them independently through the
// existing Policy Engine (POST /policy/versions + approve) without a
// deploy. DEFAULT_FINANCIAL_ASSESSMENT_POLICY is the fallback used whenever
// no active policy version exists for a key — its numbers are exactly the
// thresholds this module shipped with, so resolving with no tenant
// overrides configured reproduces prior behavior exactly.

/** A threshold ladder matched by "value >= min" — evaluate top-down, first (highest min) match wins. */
export interface MinThresholdBand {
  min: number;
  points: number;
}

/** A ceiling ladder matched by "ratio <= maxRatio" — evaluate top-down (lowest maxRatio first), first match wins. */
export interface MaxRatioBand {
  maxRatio: number;
  points: number;
}

export interface TenureBand {
  minYears: number;
  points: number;
}

export interface DebtRatioPolicy {
  bands: MaxRatioBand[];
  /** Multiplier applied to the matched band's points when hasPreviousUnpaidInstallments is true, e.g. 0.6 = a 40% penalty. */
  unpaidInstallmentsPenaltyFactor: number;
}

export interface EmploymentPolicy {
  maxPoints: number;
  statusPoints: Record<string, number>;
  typePoints: Record<string, number>;
  tenureBands: TenureBand[];
}

export interface BankingPolicy {
  maxPoints: number;
  deductions: {
    returnedCheque: number;
    salarySeizure: number;
    frequentOverdraft: number;
  };
}

export interface ScoreBandDefinition {
  code: ScoreBand;
  minScore: number;
  label: string;
}

export interface FinancialAssessmentPolicyConfig {
  incomeBands: MinThresholdBand[];
  debtRatio: DebtRatioPolicy;
  employment: EmploymentPolicy;
  banking: BankingPolicy;
  savingsBands: MinThresholdBand[];
  scoreBands: ScoreBandDefinition[];
}

// PolicyService keys — one per configurable group, matching the 6 groups
// named in the spec (income bands, debt-to-income ratio bands, employment
// stability weights, banking behaviour weights, savings score bands, score
// band labels).
export const FINANCIAL_ASSESSMENT_POLICY_KEYS = {
  incomeBands: 'financial_assessment.income_bands',
  debtRatio: 'financial_assessment.debt_ratio_bands',
  employment: 'financial_assessment.employment_weights',
  banking: 'financial_assessment.banking_weights',
  savingsBands: 'financial_assessment.savings_bands',
  scoreBands: 'financial_assessment.score_bands',
} as const;

export const DEFAULT_FINANCIAL_ASSESSMENT_POLICY: FinancialAssessmentPolicyConfig = {
  incomeBands: [
    { min: 3000, points: 30 },
    { min: 2000, points: 25 },
    { min: 1200, points: 18 },
    { min: 800, points: 10 },
    { min: 0.01, points: 5 },
  ],
  debtRatio: {
    bands: [
      { maxRatio: 0.10, points: 25 },
      { maxRatio: 0.20, points: 20 },
      { maxRatio: 0.35, points: 13 },
      { maxRatio: 0.50, points: 6 },
    ],
    unpaidInstallmentsPenaltyFactor: 0.6,
  },
  employment: {
    maxPoints: 20,
    statusPoints: {
      employed_public: 12,
      employed_private: 10,
      business_owner: 9,
      self_employed: 8,
      retired: 6,
      other: 4,
      unemployed: 0,
    },
    typePoints: {
      permanent: 5,
      temporary: 3,
      seasonal: 2,
      freelance: 2,
      none: 0,
    },
    tenureBands: [
      { minYears: 5, points: 3 },
      { minYears: 2, points: 2 },
      { minYears: 1, points: 1 },
    ],
  },
  banking: {
    maxPoints: 15,
    deductions: {
      returnedCheque: 6,
      salarySeizure: 7,
      frequentOverdraft: 4,
    },
  },
  savingsBands: [
    { min: 5000, points: 10 },
    { min: 2000, points: 7 },
    { min: 500, points: 4 },
    { min: 0.01, points: 2 },
  ],
  scoreBands: [
    { code: 'excellent', minScore: 85, label: 'Excellent' },
    { code: 'good', minScore: 70, label: 'Good' },
    { code: 'borderline', minScore: 55, label: 'Borderline' },
    { code: 'high_risk', minScore: 0, label: 'High Risk' },
  ],
};
