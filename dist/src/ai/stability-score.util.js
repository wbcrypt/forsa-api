"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLATFORM_FEE_TND = exports.PLAN_MONTHS = void 0;
exports.computeStabilityScore = computeStabilityScore;
exports.explainStabilityScore = explainStabilityScore;
exports.PLAN_MONTHS = {
    silver: 10,
    gold: 12,
};
exports.PLATFORM_FEE_TND = 30;
const SALARY_MIDPOINT_TND = {
    under_2000: 1500,
    '2000_5000': 3500,
    '5000_10000': 7500,
    over_10000: 12000,
};
function clamp(n, min = 0, max = 100) {
    return Math.max(min, Math.min(max, n));
}
function scoreGuarantorStability(g) {
    if (!g)
        return 0;
    let score = 0;
    const employmentPoints = {
        employed: 35, full_time: 35, self_employed: 28, freelance: 20, unemployed: 0,
    };
    score += employmentPoints[g.employment_status || ''] ?? 10;
    const years = g.employment_duration_years ?? 0;
    score += clamp((years / 5) * 20, 0, 20);
    const salaryPoints = {
        over_10000: 25, '5000_10000': 20, '2000_5000': 12, under_2000: 5,
    };
    score += salaryPoints[g.salary_range || ''] ?? 0;
    const ownershipPoints = { owner: 10, family_owned: 7, tenant: 3 };
    score += ownershipPoints[g.home_ownership || ''] ?? 0;
    const salaryMidpoint = SALARY_MIDPOINT_TND[g.salary_range || ''] ?? 0;
    const loans = g.existing_loans_amount ?? 0;
    if (salaryMidpoint > 0) {
        const loanRatio = loans / salaryMidpoint;
        score += loanRatio === 0 ? 10 : loanRatio < 0.3 ? 7 : loanRatio < 0.6 ? 4 : 0;
    }
    return clamp(score);
}
function scoreHouseholdStability(student, guarantor) {
    let score = 0;
    const livingPoints = {
        with_family: 35, university_housing: 25, shared_housing: 15, independent: 20,
    };
    score += livingPoints[student?.living_situation || ''] ?? 0;
    score += student?.emergency_contact_name ? 15 : 0;
    const maritalPoints = { married: 25, single: 15, divorced: 10, widowed: 10 };
    score += maritalPoints[guarantor?.marital_status || ''] ?? 0;
    const deps = guarantor?.number_of_dependents ?? null;
    score += deps === null ? 0 : deps === 0 ? 15 : deps <= 3 ? 25 : 10;
    return clamp(score);
}
function scorePaymentCapacity(g, tuitionAmount, requestedTier) {
    const salaryMidpoint = SALARY_MIDPOINT_TND[g?.salary_range || ''] ?? 0;
    if (salaryMidpoint === 0 || !tuitionAmount)
        return 0;
    const disposable = salaryMidpoint - (g?.monthly_expenses ?? 0) - ((g?.existing_loans_amount ?? 0) * 0.03);
    const months = exports.PLAN_MONTHS[requestedTier || 'silver'];
    const requiredMonthly = tuitionAmount / months + exports.PLATFORM_FEE_TND;
    if (requiredMonthly <= 0)
        return 0;
    const ratio = disposable / requiredMonthly;
    if (ratio >= 3)
        return 100;
    if (ratio >= 2)
        return 80;
    if (ratio >= 1.5)
        return 60;
    if (ratio >= 1)
        return 40;
    if (ratio >= 0.5)
        return 20;
    return 5;
}
function scoreStudentBonus(student) {
    if (!student)
        return 0;
    let score = 0;
    if ((student.monthly_income ?? 0) > 0)
        score += 50;
    if (student.has_scholarship)
        score += 30;
    if (['part_time', 'full_time'].includes(student.employment_status || ''))
        score += 20;
    return clamp(score);
}
function computeStabilityScore(input) {
    const breakdown = {
        guarantorStability: scoreGuarantorStability(input.guarantor),
        householdStability: scoreHouseholdStability(input.student, input.guarantor),
        paymentCapacity: scorePaymentCapacity(input.guarantor, input.tuitionAmount, input.requestedTier),
        studentStabilityBonus: scoreStudentBonus(input.student),
    };
    const overall = clamp(breakdown.guarantorStability * 0.60
        + breakdown.householdStability * 0.20
        + breakdown.paymentCapacity * 0.15
        + breakdown.studentStabilityBonus * 0.05);
    return { overall: Math.round(overall * 100) / 100, breakdown };
}
function explainStabilityScore(input, result) {
    const { guarantor: g, student: s } = input;
    const { breakdown } = result;
    const riskFactors = [];
    const positiveFactors = [];
    const meetingQuestions = [];
    if (breakdown.guarantorStability < 40) {
        riskFactors.push('Guarantor stability is low — employment status, tenure, or income band suggests limited financial backing.');
        meetingQuestions.push("Confirm the guarantor's current employer and verify income proof matches the stated salary range.");
    }
    else if (breakdown.guarantorStability >= 75) {
        positiveFactors.push('Guarantor has strong, stable employment and income indicators.');
    }
    if ((g?.existing_loans_amount ?? 0) > 0) {
        meetingQuestions.push("Clarify the guarantor's other financial commitments and how they'll be managed alongside this plan.");
    }
    if (breakdown.paymentCapacity < 40) {
        riskFactors.push("Estimated payment capacity is tight — the guarantor's disposable income may not comfortably cover the estimated monthly payment plus the administrative fee.");
        meetingQuestions.push('Review the household budget in detail to confirm the monthly payment is sustainable.');
    }
    else if (breakdown.paymentCapacity >= 80) {
        positiveFactors.push("Strong payment capacity — the guarantor's disposable income comfortably covers the estimated monthly payment.");
    }
    if (breakdown.householdStability < 40) {
        riskFactors.push('Household stability indicators are limited (living situation, emergency contact, or guarantor household context).');
    }
    else if (breakdown.householdStability >= 75) {
        positiveFactors.push('Household context shows strong stability indicators.');
    }
    if (!s?.emergency_contact_name) {
        riskFactors.push('No emergency contact on file for the student.');
    }
    if (breakdown.studentStabilityBonus > 0) {
        positiveFactors.push("Student's own income and/or scholarship provide additional support — a bonus, not a requirement.");
    }
    if ((g?.number_of_dependents ?? 0) > 3) {
        meetingQuestions.push("Discuss the guarantor's overall household budget given their number of dependents.");
    }
    const fields = [g?.employment_status, g?.employment_duration_years, g?.salary_range, g?.home_ownership,
        g?.monthly_expenses, g?.existing_loans_amount, g?.number_of_dependents, g?.marital_status,
        s?.living_situation, s?.emergency_contact_name];
    const provided = fields.filter(f => f !== null && f !== undefined && f !== '').length;
    const confidenceScore = Math.round((provided / fields.length) * 100);
    if (riskFactors.length === 0)
        riskFactors.push('No significant risk factors identified from the profile data provided.');
    if (positiveFactors.length === 0)
        positiveFactors.push('Profile data is limited — request additional information at the meeting for a fuller picture.');
    if (meetingQuestions.length === 0)
        meetingQuestions.push('Confirm all profile details match the original documents presented at the meeting.');
    return { riskFactors, positiveFactors, meetingQuestions, confidenceScore };
}
//# sourceMappingURL=stability-score.util.js.map