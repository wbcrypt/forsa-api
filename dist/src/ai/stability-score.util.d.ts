export declare const PLAN_MONTHS: Record<'silver' | 'gold', number>;
export declare const PLATFORM_FEE_TND = 30;
export interface GuarantorProfileInput {
    employment_status?: string | null;
    employment_duration_years?: number | null;
    salary_range?: string | null;
    home_ownership?: string | null;
    monthly_expenses?: number | null;
    existing_loans_amount?: number | null;
    number_of_dependents?: number | null;
    marital_status?: string | null;
}
export interface StudentProfileInput {
    employment_status?: string | null;
    monthly_income?: number | null;
    has_scholarship?: boolean | null;
    living_situation?: string | null;
    emergency_contact_name?: string | null;
}
export interface StabilityScoreInput {
    guarantor: GuarantorProfileInput | null;
    student: StudentProfileInput | null;
    tuitionAmount: number | null;
    requestedTier: 'silver' | 'gold' | null;
}
export interface StabilityScoreBreakdown {
    guarantorStability: number;
    householdStability: number;
    paymentCapacity: number;
    studentStabilityBonus: number;
}
export interface StabilityScoreResult {
    overall: number;
    breakdown: StabilityScoreBreakdown;
}
export declare function computeStabilityScore(input: StabilityScoreInput): StabilityScoreResult;
export interface StabilityExplanation {
    riskFactors: string[];
    positiveFactors: string[];
    meetingQuestions: string[];
    confidenceScore: number;
}
export declare function explainStabilityScore(input: StabilityScoreInput, result: StabilityScoreResult): StabilityExplanation;
