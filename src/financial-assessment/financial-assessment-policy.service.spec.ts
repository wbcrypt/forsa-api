import { FinancialAssessmentPolicyService } from './financial-assessment-policy.service';
import { PolicyService } from '../policy/policy.service';
import { DEFAULT_FINANCIAL_ASSESSMENT_POLICY } from './financial-assessment-policy.constants';

describe('FinancialAssessmentPolicyService.getConfig', () => {
  let service: FinancialAssessmentPolicyService;
  let getObject: jest.Mock;

  beforeEach(() => {
    getObject = jest.fn();
    service = new FinancialAssessmentPolicyService({ getObject } as unknown as PolicyService);
  });

  it('falls back to DEFAULT_FINANCIAL_ASSESSMENT_POLICY when no policy versions are configured', async () => {
    getObject.mockResolvedValue(null);
    const config = await service.getConfig('tenant-1');
    expect(config).toEqual(DEFAULT_FINANCIAL_ASSESSMENT_POLICY);
  });

  it('uses a tenant override for one group while defaulting the rest', async () => {
    const overriddenIncomeBands = [{ min: 5000, points: 30 }, { min: 0.01, points: 10 }];
    getObject.mockImplementation((key: string) =>
      Promise.resolve(key === 'financial_assessment.income_bands' ? overriddenIncomeBands : null));

    const config = await service.getConfig('tenant-1');

    expect(config.incomeBands).toEqual(overriddenIncomeBands);
    expect(config.debtRatio).toEqual(DEFAULT_FINANCIAL_ASSESSMENT_POLICY.debtRatio);
    expect(config.employment).toEqual(DEFAULT_FINANCIAL_ASSESSMENT_POLICY.employment);
    expect(config.banking).toEqual(DEFAULT_FINANCIAL_ASSESSMENT_POLICY.banking);
    expect(config.savingsBands).toEqual(DEFAULT_FINANCIAL_ASSESSMENT_POLICY.savingsBands);
    expect(config.scoreBands).toEqual(DEFAULT_FINANCIAL_ASSESSMENT_POLICY.scoreBands);
  });

  it('resolves each policy key scoped to the given tenant', async () => {
    getObject.mockResolvedValue(null);
    await service.getConfig('tenant-42');
    for (const call of getObject.mock.calls) {
      expect(call[1]).toEqual({ tenantId: 'tenant-42' });
    }
    expect(getObject).toHaveBeenCalledTimes(6);
  });
});
