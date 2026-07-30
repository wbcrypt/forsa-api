import { ScoreBand } from './financial-assessment.constants';
import {
  DEFAULT_FINANCIAL_ASSESSMENT_POLICY, FinancialAssessmentPolicyConfig, MinThresholdBand, MaxRatioBand, TenureBand,
} from './financial-assessment-policy.constants';

// FORSA Financial Assessment scoring engine.
//
// Pure function, no DB access — called once at guarantor submission (on
// self-declared values) and again on every interview correction (on the
// current, possibly staff-corrected values). Every threshold and weight is
// read from a FinancialAssessmentPolicyConfig passed in by the caller
// (financial-assessment.service.ts resolves it per-tenant via
// FinancialAssessmentPolicyService before calling in); nothing here is
// hardcoded. The `policy` parameter defaults to
// DEFAULT_FINANCIAL_ASSESSMENT_POLICY only so this function and its unit
// tests remain usable standalone.
//
// Modular by design: SCORING_COMPONENTS is a plain array of independent
// { key, maxPoints, compute } entries. Adding a new scoring category (e.g.
// a future "credit history" component) means adding one entry to that
// array and one field to FinancialAssessmentPolicyConfig — none of the
// existing components change. The two things a new component's `key` must
// still be wired into by hand are (a) a new policy field/default for its
// own weights, and (b) a DB column + service-layer mapping to persist it
// (see financial-assessment.service.ts) — those are the deliberate,
// unavoidable seams; the scoring math itself never needs touching.

export interface FinancialScoringInput {
  monthlyNetIncome: number | null;
  additionalIncomeAmount: number | null;
  monthlyLoanPayments: number | null;
  hasPreviousUnpaidInstallments: boolean | null;
  employmentStatus: string | null;
  employmentType: string | null;
  yearsWithEmployer: number | null;
  hasReturnedCheque: boolean | null;
  hasSalarySeizure: boolean | null;
  hasFrequentOverdraft: boolean | null;
  approximateSavings: number | null;
}

export interface FinancialScoringResult {
  totalMonthlyIncome: number;
  debtRatio: number;
  incomeScore: number;
  debtRatioScore: number;
  employmentScore: number;
  bankingScore: number;
  savingsScore: number;
  finalScore: number;
  band: ScoreBand;
  /** Same 5 sub-scores as the named fields above, keyed generically — what any future component also appears under. */
  components: Record<string, number>;
}

const n = (v: number | null | undefined) => v ?? 0;

/** First band (evaluated in array order) where value >= band.min wins. Bands need not be pre-sorted — the highest-min match among all satisfied bands always wins. */
function matchMinThresholdBand(bands: MinThresholdBand[], value: number): number {
  const satisfied = bands.filter((b) => value >= b.min);
  if (satisfied.length === 0) return 0;
  return satisfied.reduce((best, b) => (b.min > best.min ? b : best)).points;
}

/** First band (lowest maxRatio) where ratio <= band.maxRatio wins. */
function matchMaxRatioBand(bands: MaxRatioBand[], ratio: number): number {
  const satisfied = bands.filter((b) => ratio <= b.maxRatio);
  if (satisfied.length === 0) return 0;
  return satisfied.reduce((best, b) => (b.maxRatio < best.maxRatio ? b : best)).points;
}

function matchTenureBand(bands: TenureBand[], years: number): number {
  const satisfied = bands.filter((b) => years >= b.minYears);
  if (satisfied.length === 0) return 0;
  return satisfied.reduce((best, b) => (b.minYears > best.minYears ? b : best)).points;
}

interface ScoringComponent {
  key: 'income' | 'debtRatio' | 'employment' | 'banking' | 'savings';
  maxPoints(policy: FinancialAssessmentPolicyConfig): number;
  compute(input: FinancialScoringInput, policy: FinancialAssessmentPolicyConfig, totalMonthlyIncome: number): number;
}

const SCORING_COMPONENTS: ScoringComponent[] = [
  {
    key: 'income',
    maxPoints: (policy) => Math.max(0, ...policy.incomeBands.map((b) => b.points)),
    compute: (_input, policy, totalMonthlyIncome) => matchMinThresholdBand(policy.incomeBands, totalMonthlyIncome),
  },
  {
    key: 'debtRatio',
    maxPoints: (policy) => Math.max(0, ...policy.debtRatio.bands.map((b) => b.points)),
    compute: (input, policy, totalMonthlyIncome) => {
      const loanPayments = n(input.monthlyLoanPayments);
      const ratio = totalMonthlyIncome > 0 ? loanPayments / totalMonthlyIncome : (loanPayments > 0 ? 1 : 0);
      let points = matchMaxRatioBand(policy.debtRatio.bands, ratio);
      // A history of unpaid installments is a stronger signal than the
      // current ratio alone captures — penalize on top of the ratio band.
      if (input.hasPreviousUnpaidInstallments) points = Math.round(points * policy.debtRatio.unpaidInstallmentsPenaltyFactor);
      return points;
    },
  },
  {
    key: 'employment',
    maxPoints: (policy) => policy.employment.maxPoints,
    compute: (input, policy) => {
      const status = input.employmentStatus ? (policy.employment.statusPoints[input.employmentStatus] ?? 0) : 0;
      const type = input.employmentType ? (policy.employment.typePoints[input.employmentType] ?? 0) : 0;
      const tenure = matchTenureBand(policy.employment.tenureBands, n(input.yearsWithEmployer));
      return Math.min(policy.employment.maxPoints, status + type + tenure);
    },
  },
  {
    key: 'banking',
    maxPoints: (policy) => policy.banking.maxPoints,
    compute: (input, policy) => {
      let score = policy.banking.maxPoints;
      if (input.hasReturnedCheque) score -= policy.banking.deductions.returnedCheque;
      if (input.hasSalarySeizure) score -= policy.banking.deductions.salarySeizure;
      if (input.hasFrequentOverdraft) score -= policy.banking.deductions.frequentOverdraft;
      return Math.max(0, score);
    },
  },
  {
    key: 'savings',
    maxPoints: (policy) => Math.max(0, ...policy.savingsBands.map((b) => b.points)),
    compute: (input, policy) => matchMinThresholdBand(policy.savingsBands, n(input.approximateSavings)),
  },
];

export function bandForScore(finalScore: number, policy: FinancialAssessmentPolicyConfig = DEFAULT_FINANCIAL_ASSESSMENT_POLICY): ScoreBand {
  const satisfied = policy.scoreBands.filter((b) => finalScore >= b.minScore);
  if (satisfied.length === 0) return policy.scoreBands[policy.scoreBands.length - 1]?.code ?? 'high_risk';
  return satisfied.reduce((best, b) => (b.minScore > best.minScore ? b : best)).code;
}

export function calculateFinancialScore(
  input: FinancialScoringInput,
  policy: FinancialAssessmentPolicyConfig = DEFAULT_FINANCIAL_ASSESSMENT_POLICY,
): FinancialScoringResult {
  const totalMonthlyIncome = n(input.monthlyNetIncome) + n(input.additionalIncomeAmount);
  const loanPayments = n(input.monthlyLoanPayments);
  const debtRatio = totalMonthlyIncome > 0 ? loanPayments / totalMonthlyIncome : (loanPayments > 0 ? 1 : 0);

  const components: Record<string, number> = {};
  for (const component of SCORING_COMPONENTS) {
    components[component.key] = component.compute(input, policy, totalMonthlyIncome);
  }

  const finalScore = Object.values(components).reduce((sum, v) => sum + v, 0);

  return {
    totalMonthlyIncome,
    debtRatio,
    incomeScore: components.income,
    debtRatioScore: components.debtRatio,
    employmentScore: components.employment,
    bankingScore: components.banking,
    savingsScore: components.savings,
    finalScore,
    band: bandForScore(finalScore, policy),
    components,
  };
}
