import { calculateFinancialScore, bandForScore, FinancialScoringInput } from './financial-assessment.scoring';

const baseInput: FinancialScoringInput = {
  monthlyNetIncome: 0,
  additionalIncomeAmount: 0,
  monthlyLoanPayments: 0,
  hasPreviousUnpaidInstallments: false,
  employmentStatus: null,
  employmentType: null,
  yearsWithEmployer: null,
  hasReturnedCheque: false,
  hasSalarySeizure: false,
  hasFrequentOverdraft: false,
  approximateSavings: 0,
};

describe('calculateFinancialScore', () => {
  it('scores a strong profile as excellent, capped at 100', () => {
    const result = calculateFinancialScore({
      monthlyNetIncome: 3500,
      additionalIncomeAmount: 0,
      monthlyLoanPayments: 200,
      hasPreviousUnpaidInstallments: false,
      employmentStatus: 'employed_public',
      employmentType: 'permanent',
      yearsWithEmployer: 6,
      hasReturnedCheque: false,
      hasSalarySeizure: false,
      hasFrequentOverdraft: false,
      approximateSavings: 6000,
    });

    expect(result.finalScore).toBeLessThanOrEqual(100);
    expect(result.band).toBe('excellent');
    expect(result.incomeScore).toBe(30);
    expect(result.employmentScore).toBe(20);
    expect(result.savingsScore).toBe(10);
  });

  it('scores an all-zero / all-unknown profile as high_risk, still crediting zero debt and clean banking', () => {
    const result = calculateFinancialScore(baseInput);
    // income 0, employment unknown, savings 0 all score 0; but zero debt
    // against zero income is a defined 0 ratio (25 pts) and no banking
    // red flags were declared (15 pts) -> 40, still high_risk.
    expect(result.finalScore).toBe(40);
    expect(result.band).toBe('high_risk');
    expect(result.debtRatio).toBe(0);
    expect(result.debtRatioScore).toBe(25);
    expect(result.bankingScore).toBe(15);
  });

  it('treats loan payments against zero income as the worst-case debt ratio', () => {
    const result = calculateFinancialScore({
      ...baseInput,
      monthlyLoanPayments: 300,
    });
    expect(result.debtRatio).toBe(1);
    expect(result.debtRatioScore).toBe(0);
  });

  it('applies a 40% penalty to the debt ratio score for previous unpaid installments', () => {
    const clean = calculateFinancialScore({
      ...baseInput,
      monthlyNetIncome: 2000,
      monthlyLoanPayments: 100, // ratio 0.05 -> band score 25
    });
    const withDefault = calculateFinancialScore({
      ...baseInput,
      monthlyNetIncome: 2000,
      monthlyLoanPayments: 100,
      hasPreviousUnpaidInstallments: true,
    });
    expect(clean.debtRatioScore).toBe(25);
    expect(withDefault.debtRatioScore).toBe(15); // round(25 * 0.6)
  });

  it('deducts banking penalties independently and floors at 0', () => {
    const result = calculateFinancialScore({
      ...baseInput,
      hasReturnedCheque: true,
      hasSalarySeizure: true,
      hasFrequentOverdraft: true,
    });
    expect(result.bankingScore).toBe(0); // 15 - 6 - 7 - 4 = -2 -> floored
  });

  it('computes total income as net + additional, not the raw net figure', () => {
    const result = calculateFinancialScore({
      ...baseInput,
      monthlyNetIncome: 1000,
      additionalIncomeAmount: 500,
    });
    expect(result.totalMonthlyIncome).toBe(1500);
  });
});

describe('bandForScore', () => {
  it.each([
    [100, 'excellent'], [85, 'excellent'],
    [84, 'good'], [70, 'good'],
    [69, 'borderline'], [55, 'borderline'],
    [54, 'high_risk'], [0, 'high_risk'],
  ])('maps score %i to band %s', (score, band) => {
    expect(bandForScore(score as number)).toBe(band);
  });
});
