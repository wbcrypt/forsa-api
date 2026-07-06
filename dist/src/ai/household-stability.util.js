"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HOUSEHOLD_STABILITY_WEIGHTS = void 0;
exports.computeHouseholdStabilityScore = computeHouseholdStabilityScore;
exports.deriveRecommendation = deriveRecommendation;
exports.HOUSEHOLD_STABILITY_WEIGHTS = {
    householdStability: 0.35,
    financialCapacity: 0.25,
    academicCommitment: 0.20,
    documentationQuality: 0.10,
    aiInterviewAssessment: 0.10,
};
function computeHouseholdStabilityScore(scores) {
    if (!scores)
        return null;
    const keys = Object.keys(exports.HOUSEHOLD_STABILITY_WEIGHTS);
    const values = keys.map(k => scores[k]);
    if (values.some(v => typeof v !== 'number' || Number.isNaN(v)))
        return null;
    const weighted = keys.reduce((sum, key, i) => sum + values[i] * exports.HOUSEHOLD_STABILITY_WEIGHTS[key], 0);
    return Math.round(weighted * 100) / 100;
}
function deriveRecommendation(score) {
    if (score === null)
        return null;
    if (score >= 80)
        return 'Gold Candidate';
    if (score >= 60)
        return 'Silver Candidate';
    if (score >= 40)
        return 'Referral Candidate';
    return 'Manual Review';
}
//# sourceMappingURL=household-stability.util.js.map