import { computeHouseholdStabilityScore, HOUSEHOLD_STABILITY_WEIGHTS } from './household-stability.util';

// T-211/D-003 — locks down the approved V1 weights (35/25/20/10/10) and
// that the score is computed deterministically server-side, never trusted
// directly from a client/LLM-supplied "overall" figure.
describe('computeHouseholdStabilityScore', () => {
  it('matches the D-003-approved weight split exactly', () => {
    expect(HOUSEHOLD_STABILITY_WEIGHTS).toEqual({
      householdStability: 0.35,
      financialCapacity: 0.25,
      academicCommitment: 0.20,
      documentationQuality: 0.10,
      aiInterviewAssessment: 0.10,
    });
  });

  it('computes the weighted average correctly', () => {
    const score = computeHouseholdStabilityScore({
      householdStability: 80, financialCapacity: 60, academicCommitment: 70,
      documentationQuality: 90, aiInterviewAssessment: 50,
    });
    // 80*.35 + 60*.25 + 70*.20 + 90*.10 + 50*.10 = 28+15+14+9+5 = 71
    expect(score).toBe(71);
  });

  it('returns null when any dimension is missing', () => {
    const score = computeHouseholdStabilityScore({
      householdStability: 80, financialCapacity: 60, academicCommitment: 70,
      documentationQuality: 90,
      // aiInterviewAssessment missing
    } as any);
    expect(score).toBeNull();
  });

  it('returns null for null/undefined input rather than throwing', () => {
    expect(computeHouseholdStabilityScore(null)).toBeNull();
    expect(computeHouseholdStabilityScore(undefined)).toBeNull();
  });

  it('a lower-income-but-stable household can outrank a wealthier-but-less-responsible one', () => {
    // This is the exact scenario D-008/T-211 call out explicitly: household
    // stability (35%) and academic commitment (20%) dominate financial
    // capacity (25%) alone when the gap is large enough.
    const stableLowIncome = computeHouseholdStabilityScore({
      householdStability: 95, financialCapacity: 40, academicCommitment: 90,
      documentationQuality: 85, aiInterviewAssessment: 80,
    });
    const wealthyUnstable = computeHouseholdStabilityScore({
      householdStability: 30, financialCapacity: 95, academicCommitment: 50,
      documentationQuality: 60, aiInterviewAssessment: 55,
    });
    expect(stableLowIncome).toBeGreaterThan(wealthyUnstable as number);
  });
});
