"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const household_stability_util_1 = require("./household-stability.util");
describe('computeHouseholdStabilityScore', () => {
    it('matches the D-003-approved weight split exactly', () => {
        expect(household_stability_util_1.HOUSEHOLD_STABILITY_WEIGHTS).toEqual({
            householdStability: 0.35,
            financialCapacity: 0.25,
            academicCommitment: 0.20,
            documentationQuality: 0.10,
            aiInterviewAssessment: 0.10,
        });
    });
    it('computes the weighted average correctly', () => {
        const score = (0, household_stability_util_1.computeHouseholdStabilityScore)({
            householdStability: 80, financialCapacity: 60, academicCommitment: 70,
            documentationQuality: 90, aiInterviewAssessment: 50,
        });
        expect(score).toBe(71);
    });
    it('returns null when any dimension is missing', () => {
        const score = (0, household_stability_util_1.computeHouseholdStabilityScore)({
            householdStability: 80, financialCapacity: 60, academicCommitment: 70,
            documentationQuality: 90,
        });
        expect(score).toBeNull();
    });
    it('returns null for null/undefined input rather than throwing', () => {
        expect((0, household_stability_util_1.computeHouseholdStabilityScore)(null)).toBeNull();
        expect((0, household_stability_util_1.computeHouseholdStabilityScore)(undefined)).toBeNull();
    });
    it('a lower-income-but-stable household can outrank a wealthier-but-less-responsible one', () => {
        const stableLowIncome = (0, household_stability_util_1.computeHouseholdStabilityScore)({
            householdStability: 95, financialCapacity: 40, academicCommitment: 90,
            documentationQuality: 85, aiInterviewAssessment: 80,
        });
        const wealthyUnstable = (0, household_stability_util_1.computeHouseholdStabilityScore)({
            householdStability: 30, financialCapacity: 95, academicCommitment: 50,
            documentationQuality: 60, aiInterviewAssessment: 55,
        });
        expect(stableLowIncome).toBeGreaterThan(wealthyUnstable);
    });
});
//# sourceMappingURL=household-stability.util.spec.js.map