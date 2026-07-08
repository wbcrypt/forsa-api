import { computeStabilityScore, explainStabilityScore, PLAN_MONTHS, PLATFORM_FEE_TND } from './stability-score.util';

// Phase 14 — Final Case Flow Refinement. V1 internal FORSA Stability
// Score: Guarantor 60% / Household 20% / Payment Capacity 15% / Student
// Bonus 5%. No documents, enrollment proof, or FORSA history as inputs —
// only structured profile data. Never produces an approve/reject outcome.

const strongGuarantor = {
  employment_status: 'employed', employment_duration_years: 8, salary_range: 'over_10000',
  home_ownership: 'owner', monthly_expenses: 1500, existing_loans_amount: 0,
  number_of_dependents: 2, marital_status: 'married',
};
const weakGuarantor = {
  employment_status: 'unemployed', employment_duration_years: 0, salary_range: 'under_2000',
  home_ownership: 'tenant', monthly_expenses: 1200, existing_loans_amount: 1000,
  number_of_dependents: 5, marital_status: null,
};
const strongStudent = {
  employment_status: 'part_time', monthly_income: 400, has_scholarship: true,
  living_situation: 'with_family', emergency_contact_name: 'Mohamed Ali',
};
const noStudentData = { employment_status: null, monthly_income: null, has_scholarship: null, living_situation: null, emergency_contact_name: null };

describe('computeStabilityScore', () => {
  it('weights guarantor stability at 60% — a strong guarantor with no student data still scores well', () => {
    const result = computeStabilityScore({ guarantor: strongGuarantor, student: null, tuitionAmount: 3000, requestedTier: 'silver' });
    expect(result.breakdown.guarantorStability).toBeGreaterThan(80);
    expect(result.overall).toBeGreaterThan(50);
  });

  it('a weak guarantor drags the overall score down even with strong student data', () => {
    const result = computeStabilityScore({ guarantor: weakGuarantor, student: strongStudent, tuitionAmount: 3000, requestedTier: 'silver' });
    expect(result.breakdown.guarantorStability).toBeLessThan(30);
    expect(result.overall).toBeLessThan(45);
  });

  it('student stability bonus contributes at most 5 points to the overall, isolated from household stability', () => {
    // Holds living_situation/emergency_contact_name constant so only the
    // bonus-eligible fields (income, scholarship, employment) vary —
    // isolating the 5% weight from the 20% household-stability weight,
    // which also reads student fields but is a separate component.
    const baseStudent = { living_situation: 'with_family', emergency_contact_name: 'X' };
    const withBonus = computeStabilityScore({ guarantor: strongGuarantor, student: { ...baseStudent, ...strongStudent }, tuitionAmount: 3000, requestedTier: 'silver' });
    const withoutBonus = computeStabilityScore({ guarantor: strongGuarantor, student: { ...baseStudent, employment_status: null, monthly_income: null, has_scholarship: null }, tuitionAmount: 3000, requestedTier: 'silver' });
    expect(withBonus.breakdown.householdStability).toBe(withoutBonus.breakdown.householdStability);
    expect(withBonus.overall - withoutBonus.overall).toBeLessThanOrEqual(5);
    expect(withBonus.overall).toBeGreaterThan(withoutBonus.overall);
  });

  it('returns all-zero breakdown when no guarantor or student data exists at all', () => {
    const result = computeStabilityScore({ guarantor: null, student: null, tuitionAmount: null, requestedTier: null });
    expect(result.overall).toBe(0);
    expect(result.breakdown.guarantorStability).toBe(0);
  });

  it('payment capacity accounts for the 30 TND platform fee and plan months, not tuition alone', () => {
    const cheap = computeStabilityScore({ guarantor: strongGuarantor, student: null, tuitionAmount: 500, requestedTier: 'gold' });
    const expensive = computeStabilityScore({ guarantor: strongGuarantor, student: null, tuitionAmount: 50000, requestedTier: 'silver' });
    expect(cheap.breakdown.paymentCapacity).toBeGreaterThan(expensive.breakdown.paymentCapacity);
  });

  it('gold plan spreads tuition over more months than silver, easing payment capacity for the same tuition', () => {
    const silver = computeStabilityScore({ guarantor: strongGuarantor, student: null, tuitionAmount: 20000, requestedTier: 'silver' });
    const gold = computeStabilityScore({ guarantor: strongGuarantor, student: null, tuitionAmount: 20000, requestedTier: 'gold' });
    expect(PLAN_MONTHS.gold).toBeGreaterThan(PLAN_MONTHS.silver);
    expect(gold.breakdown.paymentCapacity).toBeGreaterThanOrEqual(silver.breakdown.paymentCapacity);
  });

  it('the platform fee constant is exactly 30 TND/month', () => {
    expect(PLATFORM_FEE_TND).toBe(30);
  });
});

describe('explainStabilityScore', () => {
  it('never returns anything resembling an approve/reject decision', () => {
    const result = computeStabilityScore({ guarantor: strongGuarantor, student: strongStudent, tuitionAmount: 3000, requestedTier: 'silver' });
    const explanation = explainStabilityScore({ guarantor: strongGuarantor, student: strongStudent, tuitionAmount: 3000, requestedTier: 'silver' }, result);
    const allText = [...explanation.riskFactors, ...explanation.positiveFactors, ...explanation.meetingQuestions].join(' ').toLowerCase();
    expect(allText).not.toMatch(/\bapprov(e|ed|al)\b|\breject(ed)?\b/);
  });

  it('flags low guarantor stability as a risk factor and suggests verifying income at the meeting', () => {
    const result = computeStabilityScore({ guarantor: weakGuarantor, student: null, tuitionAmount: 3000, requestedTier: 'silver' });
    const explanation = explainStabilityScore({ guarantor: weakGuarantor, student: null, tuitionAmount: 3000, requestedTier: 'silver' }, result);
    expect(explanation.riskFactors.some(f => /stability is low/i.test(f))).toBe(true);
    expect(explanation.meetingQuestions.some(q => /verify income/i.test(q))).toBe(true);
  });

  it('computes a confidence score reflecting how complete the profile data actually is', () => {
    const result = computeStabilityScore({ guarantor: strongGuarantor, student: strongStudent, tuitionAmount: 3000, requestedTier: 'silver' });
    const full = explainStabilityScore({ guarantor: strongGuarantor, student: strongStudent, tuitionAmount: 3000, requestedTier: 'silver' }, result);
    const emptyResult = computeStabilityScore({ guarantor: null, student: noStudentData, tuitionAmount: null, requestedTier: null });
    const empty = explainStabilityScore({ guarantor: null, student: noStudentData, tuitionAmount: null, requestedTier: null }, emptyResult);
    expect(full.confidenceScore).toBeGreaterThan(empty.confidenceScore);
  });
});
