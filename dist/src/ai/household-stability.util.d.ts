export declare const HOUSEHOLD_STABILITY_WEIGHTS: {
    readonly householdStability: 0.35;
    readonly financialCapacity: 0.25;
    readonly academicCommitment: 0.2;
    readonly documentationQuality: 0.1;
    readonly aiInterviewAssessment: 0.1;
};
export interface HouseholdStabilityDimensionScores {
    householdStability: number;
    financialCapacity: number;
    academicCommitment: number;
    documentationQuality: number;
    aiInterviewAssessment: number;
}
export declare function computeHouseholdStabilityScore(scores: Partial<HouseholdStabilityDimensionScores> | null | undefined): number | null;
export declare function deriveRecommendation(score: number | null): string | null;
