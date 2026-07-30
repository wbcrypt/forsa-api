import { Injectable } from '@nestjs/common';
import { PolicyService } from '../policy/policy.service';
import {
  DEFAULT_FINANCIAL_ASSESSMENT_POLICY, FINANCIAL_ASSESSMENT_POLICY_KEYS, FinancialAssessmentPolicyConfig,
  MinThresholdBand, DebtRatioPolicy, EmploymentPolicy, BankingPolicy, ScoreBandDefinition,
} from './financial-assessment-policy.constants';

/**
 * Resolves the effective Financial Assessment scoring policy for a tenant.
 * Each of the 6 groups is an independent PolicyService key — a tenant that
 * has only overridden, say, the income bands still gets the shipped
 * defaults for everything else. No active policy version anywhere (the
 * out-of-the-box state — see migration 019, which seeds the definitions
 * but not versions) resolves to DEFAULT_FINANCIAL_ASSESSMENT_POLICY
 * unchanged, so behavior is identical until FORSA staff actually create
 * and approve an override via POST /policy/versions.
 */
@Injectable()
export class FinancialAssessmentPolicyService {
  constructor(private readonly policyService: PolicyService) {}

  async getConfig(tenantId: string): Promise<FinancialAssessmentPolicyConfig> {
    const [incomeBands, debtRatio, employment, banking, savingsBands, scoreBands] = await Promise.all([
      this.policyService.getObject<MinThresholdBand[]>(FINANCIAL_ASSESSMENT_POLICY_KEYS.incomeBands, { tenantId }),
      this.policyService.getObject<DebtRatioPolicy>(FINANCIAL_ASSESSMENT_POLICY_KEYS.debtRatio, { tenantId }),
      this.policyService.getObject<EmploymentPolicy>(FINANCIAL_ASSESSMENT_POLICY_KEYS.employment, { tenantId }),
      this.policyService.getObject<BankingPolicy>(FINANCIAL_ASSESSMENT_POLICY_KEYS.banking, { tenantId }),
      this.policyService.getObject<MinThresholdBand[]>(FINANCIAL_ASSESSMENT_POLICY_KEYS.savingsBands, { tenantId }),
      this.policyService.getObject<ScoreBandDefinition[]>(FINANCIAL_ASSESSMENT_POLICY_KEYS.scoreBands, { tenantId }),
    ]);

    return {
      incomeBands: incomeBands ?? DEFAULT_FINANCIAL_ASSESSMENT_POLICY.incomeBands,
      debtRatio: debtRatio ?? DEFAULT_FINANCIAL_ASSESSMENT_POLICY.debtRatio,
      employment: employment ?? DEFAULT_FINANCIAL_ASSESSMENT_POLICY.employment,
      banking: banking ?? DEFAULT_FINANCIAL_ASSESSMENT_POLICY.banking,
      savingsBands: savingsBands ?? DEFAULT_FINANCIAL_ASSESSMENT_POLICY.savingsBands,
      scoreBands: scoreBands ?? DEFAULT_FINANCIAL_ASSESSMENT_POLICY.scoreBands,
    };
  }
}
