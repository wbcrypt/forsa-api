import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PipelineService } from './pipeline.service';
import { PolicyService } from '../policy/policy.service';
import { ScoreService } from '../score/score.service';
import { ApplicationsService } from '../applications/applications.service';

// T-109 — stages 1-2 are the first automated gates every application must
// clear before any human ever sees it (see FORSA_PLATFORM_SPEC.md §6.2).
// These call the service's private stage methods directly (a common,
// pragmatic pattern for testing gate logic in isolation without standing up
// the full 10-stage orchestration/DB).
describe('PipelineService — stage gates', () => {
  let service: PipelineService;
  let query: jest.Mock;
  let policyService: jest.Mocked<Pick<PolicyService, 'resolve' | 'getBoolean' | 'resolveMany'>>;

  beforeEach(() => {
    query = jest.fn();
    policyService = {
      resolve: jest.fn().mockResolvedValue(null),
      getBoolean: jest.fn().mockResolvedValue(null),
      resolveMany: jest.fn().mockResolvedValue(new Map()),
    };
    service = new PipelineService(
      { query } as unknown as DataSource,
      policyService as unknown as PolicyService,
      {} as unknown as ScoreService,
      {} as unknown as ApplicationsService,
    );
  });

  describe('stage1Completeness', () => {
    const baseCtx = {
      tenantId: 'tenant-1',
      universityId: 'uni-1',
      applicationId: 'app-1',
      studentId: 'student-1',
      application: {
        tuition_amount: 5000, university_id: 'uni-1', student_id: 'student-1', program_id: 'prog-1',
      },
    };

    it('blocks when required documents are missing', async () => {
      query
        .mockResolvedValueOnce([{ document_type_code: 'national_id', status: 'verified' }]) // uploaded docs
        ;
      policyService.getBoolean.mockResolvedValue(false); // guarantor not required

      const result = await (service as any).stage1Completeness(baseCtx);

      expect(result.status).toBe('blocked');
      expect(result.outputs.missingDocuments).toEqual(
        expect.arrayContaining(['bac_diploma', 'university_acceptance', 'income_proof']),
      );
    });

    it('blocks when the policy requires a guarantor and none is linked', async () => {
      query
        .mockResolvedValueOnce([
          { document_type_code: 'national_id', status: 'verified' },
          { document_type_code: 'bac_diploma', status: 'verified' },
          { document_type_code: 'university_acceptance', status: 'verified' },
          { document_type_code: 'income_proof', status: 'verified' },
        ])
        .mockResolvedValueOnce([]); // no active student_guarantors row
      policyService.getBoolean.mockResolvedValue(true); // guarantor required

      const result = await (service as any).stage1Completeness(baseCtx);

      expect(result.status).toBe('blocked');
      expect(result.outputs.missingFields).toContain('guarantor');
    });

    it('passes when all required documents are uploaded and no guarantor is required', async () => {
      query.mockResolvedValueOnce([
        { document_type_code: 'national_id', status: 'verified' },
        { document_type_code: 'bac_diploma', status: 'verified' },
        { document_type_code: 'university_acceptance', status: 'verified' },
        { document_type_code: 'income_proof', status: 'verified' },
      ]);
      policyService.getBoolean.mockResolvedValue(false);

      const result = await (service as any).stage1Completeness(baseCtx);

      expect(result.status).toBe('passed');
      // T-208/T-209 — the query itself must exclude expired documents at
      // the SQL level (a document verified 18 months ago can be stale
      // without ever being re-reviewed) — confirm this safety clause isn't
      // silently dropped by a future refactor of this query.
      const docsQueryCall = query.mock.calls[0];
      expect(docsQueryCall[0]).toContain('expires_at');
    });
  });

  describe('stage2Eligibility', () => {
    const baseCtx = { tenantId: 'tenant-1', applicationId: 'app-1', studentId: 'student-1' };

    it('blocks a student younger than the minimum eligibility age', async () => {
      const sixteenYearsAgo = new Date();
      sixteenYearsAgo.setFullYear(sixteenYearsAgo.getFullYear() - 16);
      query
        .mockResolvedValueOnce([{ date_of_birth: sixteenYearsAgo.toISOString(), nationality: 'TN' }]) // student
        .mockResolvedValueOnce([{ aggregate_score: 500, score_band: 'medium_trust' }])                // score
        .mockResolvedValueOnce([])                                                                    // no fraud flag
        .mockResolvedValueOnce([]);                                                                    // no active financing

      const result = await (service as any).stage2Eligibility(baseCtx);

      expect(result.status).toBe('blocked');
      expect(result.outputs.issues.join(' ')).toMatch(/at least 17 years old/);
    });

    it('blocks a student below the minimum FORSA score', async () => {
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
      query
        .mockResolvedValueOnce([{ date_of_birth: twentyYearsAgo.toISOString(), nationality: 'TN' }])
        .mockResolvedValueOnce([{ aggregate_score: 250, score_band: 'high_risk' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await (service as any).stage2Eligibility(baseCtx);

      expect(result.status).toBe('blocked');
      expect(result.outputs.issues.join(' ')).toMatch(/below minimum/);
    });

    it('passes an adult student with an adequate score, no fraud flag, and no active financing', async () => {
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
      query
        .mockResolvedValueOnce([{ date_of_birth: twentyYearsAgo.toISOString(), nationality: 'TN' }])
        .mockResolvedValueOnce([{ aggregate_score: 700, score_band: 'very_good_trust' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await (service as any).stage2Eligibility(baseCtx);

      expect(result.status).toBe('passed');
    });
  });

  describe('stage3UniversityPartnership', () => {
    const baseCtx = { tenantId: 'tenant-1', universityId: 'uni-1', programId: 'prog-1', studentId: 'student-1' };

    it('blocks when the university is not active', async () => {
      query.mockResolvedValueOnce([{ id: 'uni-1', status: 'suspended' }]);
      const result = await (service as any).stage3UniversityPartnership(baseCtx);
      expect(result.status).toBe('blocked');
      expect(result.outputs.blockReason).toMatch(/not active/);
    });

    it('blocks when no active university agreement exists', async () => {
      query
        .mockResolvedValueOnce([{ id: 'uni-1', status: 'active' }])
        .mockResolvedValueOnce([]); // no agreement
      const result = await (service as any).stage3UniversityPartnership(baseCtx);
      expect(result.status).toBe('blocked');
      expect(result.outputs.blockReason).toMatch(/No active university agreement/);
    });

    it('escalates to review when an open business-continuity event exists', async () => {
      query
        .mockResolvedValueOnce([{ id: 'uni-1', status: 'active' }])
        .mockResolvedValueOnce([{ id: 'agr-1', payment_model: 'concurrent' }])
        .mockResolvedValueOnce([{ id: 'prog-1', status: 'active' }])
        .mockResolvedValueOnce([{ id: 'event-1' }]); // open continuity event

      const result = await (service as any).stage3UniversityPartnership(baseCtx);
      expect(result.status).toBe('needs_review');
      expect(result.outputs.continuityEventId).toBe('event-1');
    });

    it('passes when university, agreement, and program are all active with no continuity event', async () => {
      query
        .mockResolvedValueOnce([{ id: 'uni-1', status: 'active' }])
        .mockResolvedValueOnce([{ id: 'agr-1', payment_model: 'concurrent' }])
        .mockResolvedValueOnce([{ id: 'prog-1', status: 'active' }])
        .mockResolvedValueOnce([]); // no continuity event

      const result = await (service as any).stage3UniversityPartnership(baseCtx);
      expect(result.status).toBe('passed');
    });
  });

  describe('stage4RiskAssessment', () => {
    const baseCtx = {
      tenantId: 'tenant-1', universityId: 'uni-1', studentId: 'student-1',
      applicationId: 'app-1', pipelineRunId: 'run-1',
      application: { requested_support_amount: 8000, tuition_amount: 8000 },
    };

    beforeEach(() => {
      policyService.resolveMany = jest.fn().mockResolvedValue(new Map());
    });

    it('scores a student with a low score, no guarantor, and a risky university as high risk', async () => {
      query
        .mockResolvedValueOnce([{ aggregate_score: 320 }])   // forsa_scores — near the eligibility floor
        .mockResolvedValueOnce([])                            // no active guarantor
        .mockResolvedValueOnce([{ risk_level: 'elevated' }])  // university risk
        .mockResolvedValueOnce([])                            // no guarantor income data
        .mockResolvedValueOnce(undefined);                    // INSERT risk_profiles

      const result = await (service as any).stage4RiskAssessment(baseCtx);
      expect(result.status).toBe('passed'); // stage 4 never blocks, it scores
      expect(result.outputs.riskLevel).toBe('high');
    });

    it('scores a student with a high score, low-risk guarantor, and low-risk university as low risk', async () => {
      query
        .mockResolvedValueOnce([{ aggregate_score: 950 }])
        .mockResolvedValueOnce([{ risk_level: 'low' }])
        .mockResolvedValueOnce([{ risk_level: 'low' }])
        .mockResolvedValueOnce([{ income_stability: 'stable' }])
        .mockResolvedValueOnce(undefined);

      const result = await (service as any).stage4RiskAssessment(baseCtx);
      expect(result.outputs.riskLevel).toBe('low');
    });
  });

  describe('stage5PolicyEvaluation', () => {
    const baseCtx = {
      tenantId: 'tenant-1', universityId: 'uni-1', studentId: 'student-1',
      application: { requested_support_amount: 60000, tuition_amount: 60000, is_renewal: false },
    };

    it('blocks when the requested amount exceeds the policy-configured maximum', async () => {
      policyService.resolve = jest.fn()
        .mockResolvedValueOnce(null) // level3 eligibility policy
        .mockResolvedValueOnce({ value: 50000, policyVersionId: 'pv-1' }); // max amount policy
      query.mockResolvedValueOnce([]); // no matching agreement row

      const result = await (service as any).stage5PolicyEvaluation(baseCtx);
      expect(result.status).toBe('blocked');
      expect(result.outputs.violations[0]).toMatch(/exceeds policy maximum/);
    });

    it('blocks a renewal with defaulted installments beyond the policy allowance', async () => {
      const renewalCtx = { ...baseCtx, application: { ...baseCtx.application, requested_support_amount: 5000, is_renewal: true } };
      policyService.resolve = jest.fn()
        .mockResolvedValueOnce(null) // level3
        .mockResolvedValueOnce(null) // max amount
        .mockResolvedValueOnce({ value: { maxDefaults: 0 }, policyVersionId: 'pv-2' }); // renewal requirements
      query
        .mockResolvedValueOnce([]) // no matching agreement
        .mockResolvedValueOnce([{ count: '1' }]); // 1 defaulted installment

      const result = await (service as any).stage5PolicyEvaluation(renewalCtx);
      expect(result.status).toBe('blocked');
      expect(result.outputs.violations[0]).toMatch(/defaulted installments/);
    });

    it('passes when nothing exceeds policy limits', async () => {
      policyService.resolve = jest.fn().mockResolvedValue(null);
      query.mockResolvedValueOnce([]); // no matching agreement

      const result = await (service as any).stage5PolicyEvaluation(baseCtx);
      expect(result.status).toBe('passed');
    });
  });

  describe('stage6PortfolioCapital', () => {
    const baseCtx = {
      tenantId: 'tenant-1', universityId: 'uni-1', applicationId: 'app-1', pipelineRunId: 'run-1',
      studentId: 'student-1', application: { requested_support_amount: 5000, tuition_amount: 5000 },
    };

    it('soft-blocks into the capital queue when a university exceeds the concentration cap', async () => {
      policyService.resolve = jest.fn()
        .mockResolvedValueOnce(null) // capital.available
        .mockResolvedValueOnce(null) // concentration max pct (defaults to 40)
        .mockResolvedValueOnce(null); // capital_queue.enabled (defaults to true)
      query
        .mockResolvedValueOnce([{ deployed_capital: 100000, pending_disbursements: 2 }])
        .mockResolvedValueOnce([{ university_total: 50000, portfolio_total: 100000 }]) // 50% > 40% cap
        .mockResolvedValueOnce(undefined); // INSERT capital_queue

      const result = await (service as any).stage6PortfolioCapital(baseCtx);
      expect(result.status).toBe('blocked');
      expect(result.outputs.capitalQueue).toBe(true);
    });

    it('passes when university concentration, high-risk exposure, and family exposure are all under their caps', async () => {
      policyService.resolve = jest.fn().mockResolvedValue(null);
      query
        .mockResolvedValueOnce([{ deployed_capital: 100000, pending_disbursements: 1 }])
        .mockResolvedValueOnce([{ university_total: 10000, portfolio_total: 100000 }]) // 10% < 40%
        .mockResolvedValueOnce([]) // no risk profile -> high-risk check skipped
        .mockResolvedValueOnce([]); // no primary guarantor -> family exposure check skipped

      const result = await (service as any).stage6PortfolioCapital(baseCtx);
      expect(result.status).toBe('passed');
    });

    it('T-215 — soft-blocks into the capital queue when high-risk exposure would exceed the cap', async () => {
      policyService.resolve = jest.fn().mockResolvedValue(null); // defaults: 40% concentration, 10% high-risk
      query
        .mockResolvedValueOnce([{ deployed_capital: 100000, pending_disbursements: 1 }])
        .mockResolvedValueOnce([{ university_total: 10000, portfolio_total: 100000 }]) // under concentration cap
        .mockResolvedValueOnce([{ risk_level: 'high' }]) // this application is high-risk
        .mockResolvedValueOnce([{ high_risk_exposure: 9000, total_deployed: 100000 }]) // (9000+5000)/(100000+5000) = 13.3% > 10%
        .mockResolvedValueOnce(undefined); // INSERT capital_queue

      const result = await (service as any).stage6PortfolioCapital(baseCtx);
      expect(result.status).toBe('blocked');
      expect(result.outputs.capitalQueue).toBe(true);
      expect(result.outputs.blockReason).toMatch(/high-risk exposure/i);
    });

    it('T-215/D-010 — soft-blocks into the capital queue when a primary guarantor household would exceed max family exposure', async () => {
      policyService.resolve = jest.fn().mockResolvedValue(null); // default max family exposure: 100000 TND
      query
        .mockResolvedValueOnce([{ deployed_capital: 100000, pending_disbursements: 1 }])
        .mockResolvedValueOnce([{ university_total: 10000, portfolio_total: 100000 }]) // under concentration cap
        .mockResolvedValueOnce([]) // not high-risk -> high-risk check skipped
        .mockResolvedValueOnce([{ guarantor_id: 'guarantor-1' }]) // has an active primary guarantor
        .mockResolvedValueOnce([{ family_exposure: 98000 }]) // 98000 + 5000 = 103000 > 100000 default cap
        .mockResolvedValueOnce(undefined); // INSERT capital_queue

      const result = await (service as any).stage6PortfolioCapital(baseCtx);
      expect(result.status).toBe('blocked');
      expect(result.outputs.capitalQueue).toBe(true);
      expect(result.outputs.blockReason).toMatch(/family exposure/i);
    });
  });

  describe('stage7ApprovalThreshold', () => {
    const baseCtx = (amount: number) => ({
      tenantId: 'tenant-1', pipelineRunId: 'run-1',
      application: { requested_support_amount: amount, tuition_amount: amount },
    });

    beforeEach(() => {
      policyService.resolve = jest.fn().mockResolvedValue(null); // use hardcoded default thresholds
    });

    it('auto-approves amounts at or below the auto-approve threshold, requiring zero approvers', async () => {
      query.mockResolvedValueOnce([]); // no risk profile row -> no high-risk escalation
      const result = await (service as any).stage7ApprovalThreshold(baseCtx(5000));
      expect(result.outputs.approvalMode).toBe('auto');
      expect(result.outputs.requiredApprovers).toBe(0);
      expect(result.status).toBe('passed');
    });

    it('requires a single approver between the auto and level1 thresholds', async () => {
      query.mockResolvedValueOnce([]);
      const result = await (service as any).stage7ApprovalThreshold(baseCtx(15000));
      expect(result.outputs.approvalMode).toBe('single');
      expect(result.outputs.requiredApprovers).toBe(1);
      expect(result.status).toBe('needs_review');
    });

    it('requires dual approval between the level1 and level2 thresholds', async () => {
      query.mockResolvedValueOnce([]);
      const result = await (service as any).stage7ApprovalThreshold(baseCtx(50000));
      expect(result.outputs.approvalMode).toBe('dual');
      expect(result.outputs.requiredApprovers).toBe(2);
    });

    it('requires executive sign-off above the level2 threshold', async () => {
      query.mockResolvedValueOnce([]);
      const result = await (service as any).stage7ApprovalThreshold(baseCtx(100000));
      expect(result.outputs.approvalMode).toBe('executive');
      expect(result.outputs.requiredApprovers).toBe(2);
    });

    it('escalates an otherwise-auto-approvable amount to single-approver when risk is high', async () => {
      query.mockResolvedValueOnce([{ risk_level: 'high' }]);
      const result = await (service as any).stage7ApprovalThreshold(baseCtx(2000));
      expect(result.outputs.approvalMode).toBe('single');
      expect(result.outputs.requiredApprovers).toBe(1);
    });
  });
});

// T-214/K-12 — this is the actual launch-blocker fix: Stage 7 computes how
// many independent approvers a financing amount requires, Stage 8 records
// it on multi_approval_sets — but before this fix, submitHumanDecision never
// checked it, so a single reviewer could finalize any decision regardless of
// the dual/executive-approval requirement the system itself computed.
describe('PipelineService.submitHumanDecision — dual-approver enforcement', () => {
  let service: PipelineService;
  let query: jest.Mock;

  const runRow = { id: 'run-1', application_id: 'app-1', status: 'active' };
  const applicationRow = { id: 'app-1', first_name: 'Amina', last_name: 'T', aggregate_score: 700 };

  beforeEach(() => {
    query = jest.fn();
    service = new PipelineService(
      { query } as unknown as DataSource,
      { resolve: jest.fn().mockResolvedValue(null), resolveMany: jest.fn().mockResolvedValue(new Map()) } as unknown as PolicyService,
      {} as unknown as ScoreService,
      { findOne: jest.fn() } as unknown as ApplicationsService,
    );
  });

  it('rejects a reviewer submitting a second decision on the same pipeline run', async () => {
    query
      .mockResolvedValueOnce([runRow])       // pipeline_runs lookup
      .mockResolvedValueOnce([{ id: 'existing-vote' }]); // this reviewer already voted

    await expect(
      service.submitHumanDecision('run-1', 'tenant-1', 'reviewer-1', 'approved', 60000),
    ).rejects.toThrow(ConflictException);
  });

  it('does not finalize a dual-approval-required decision after only one approval — pipeline stays paused', async () => {
    query
      .mockResolvedValueOnce([runRow])              // pipeline_runs lookup
      .mockResolvedValueOnce([])                     // no existing vote from this reviewer
      .mockResolvedValueOnce([applicationRow])        // application snapshot
      .mockResolvedValueOnce([{ risk_level: 'medium' }]) // risk profile snapshot
      .mockResolvedValueOnce(undefined)               // INSERT reviewer_decisions
      .mockResolvedValueOnce([{ id: 'set-1', required_approvers: 2 }]) // multi_approval_sets lookup
      .mockResolvedValueOnce([{ count: '1' }])        // only 1 distinct approver so far
      .mockResolvedValueOnce(undefined);              // UPDATE multi_approval_sets -> partially_approved

    const result = await service.submitHumanDecision('run-1', 'tenant-1', 'reviewer-1', 'approved', 60000);

    expect(result).toEqual(expect.objectContaining({
      status: 'awaiting_additional_approver',
      requiredApprovers: 2,
      approvedSoFar: 1,
    }));
    // Must NOT have re-fetched pipeline_runs for a stage-9 continuation —
    // startRun() begins with exactly that query, so its absence here is the
    // proof the pipeline did not proceed.
    expect(query).toHaveBeenCalledTimes(8);
  });

  it('finalizes and proceeds once the required number of distinct approvers is reached', async () => {
    query
      .mockResolvedValueOnce([runRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([applicationRow])
      .mockResolvedValueOnce([{ risk_level: 'medium' }])
      .mockResolvedValueOnce(undefined)               // INSERT reviewer_decisions
      .mockResolvedValueOnce([{ id: 'set-1', required_approvers: 2 }])
      .mockResolvedValueOnce([{ count: '2' }])        // both required approvers have now approved
      .mockResolvedValueOnce(undefined);              // UPDATE multi_approval_sets -> approved

    const startRunSpy = jest.spyOn(service, 'startRun').mockResolvedValue({ ok: true } as any);

    const result = await service.submitHumanDecision('run-1', 'tenant-1', 'reviewer-2', 'approved', 60000);

    expect(startRunSpy).toHaveBeenCalledWith('app-1', 'tenant-1', 'reviewer-2', 9);
    expect(result).toEqual({ ok: true });
  });

  it('does not require consensus for a rejection — a single reviewer can stop the process immediately', async () => {
    query
      .mockResolvedValueOnce([runRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([applicationRow])
      .mockResolvedValueOnce([{ risk_level: 'medium' }])
      .mockResolvedValueOnce(undefined)               // INSERT reviewer_decisions
      .mockResolvedValueOnce([{ id: 'set-1', required_approvers: 2 }])
      .mockResolvedValueOnce(undefined);              // UPDATE multi_approval_sets -> rejected

    const startRunSpy = jest.spyOn(service, 'startRun').mockResolvedValue({ ok: true } as any);

    const result = await service.submitHumanDecision('run-1', 'tenant-1', 'reviewer-1', 'rejected');

    expect(startRunSpy).toHaveBeenCalledWith('app-1', 'tenant-1', 'reviewer-1', 9);
    expect(result).toEqual({ ok: true });
  });
});

// T-217 — flagFraud is deliberately separate from submitHumanDecision:
// an identity-trust action (permanent blacklist), not a financing-amount
// decision.
describe('PipelineService.flagFraud', () => {
  let service: PipelineService;
  let query: jest.Mock;
  let managerQuery: jest.Mock;

  const runWithStudent = { id: 'run-1', application_id: 'app-1', student_id: 'student-1' };
  const student = { id: 'student-1', email: 'Amina@Example.com', membership_status: 'bronze' };

  beforeEach(() => {
    query = jest.fn();
    managerQuery = jest.fn();
    service = new PipelineService(
      { query, transaction: jest.fn((cb: any) => cb({ query: managerQuery })) } as unknown as DataSource,
      { resolve: jest.fn().mockResolvedValue(null), resolveMany: jest.fn().mockResolvedValue(new Map()) } as unknown as PolicyService,
      {} as unknown as ScoreService,
      {} as unknown as ApplicationsService,
    );
  });

  it('throws NotFoundException when the pipeline run does not exist', async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.flagFraud('run-1', 'tenant-1', 'staff-1', 'Forged documents')).rejects.toThrow(NotFoundException);
  });

  it('blacklists the student, records a fraud_records entry, and flags the application, all in one transaction', async () => {
    query
      .mockResolvedValueOnce([runWithStudent]) // pipeline_runs + application join
      .mockResolvedValueOnce([student]);       // students lookup

    managerQuery
      .mockResolvedValueOnce(undefined) // INSERT fraud_records
      .mockResolvedValueOnce(undefined) // UPDATE students -> blacklisted
      .mockResolvedValueOnce(undefined) // INSERT membership_status_history
      .mockResolvedValueOnce(undefined) // UPDATE applications -> fraud_flagged
      .mockResolvedValueOnce(undefined) // INSERT application_status_history
      .mockResolvedValueOnce(undefined); // INSERT audit_logs

    const result = await service.flagFraud('run-1', 'tenant-1', 'staff-1', 'Forged documents');

    expect(result).toEqual(expect.objectContaining({ studentId: 'student-1', membershipStatus: 'blacklisted' }));

    // The blacklist hash must be normalized (case/whitespace-insensitive) —
    // otherwise "Amina@Example.com" and "amina@example.com" would evade
    // the same identity check.
    const fraudInsertCall = managerQuery.mock.calls[0];
    expect(fraudInsertCall[0]).toContain('INSERT INTO fraud_records');
    expect(fraudInsertCall[1][2]).not.toContain('Amina@Example.com'); // stored as a hash, not raw email

    const studentUpdateCall = managerQuery.mock.calls[1];
    expect(studentUpdateCall[0]).toContain("membership_status = 'blacklisted'");
  });
});

// T-214 — overrideDecision bypasses K-12's consensus check entirely, on
// purpose, but must always be distinctly flagged and audited.
describe('PipelineService.overrideDecision', () => {
  let service: PipelineService;
  let query: jest.Mock;

  const runRow = { id: 'run-1', application_id: 'app-1', status: 'active' };
  const applicationRow = { id: 'app-1', first_name: 'Amina', last_name: 'T' };

  beforeEach(() => {
    query = jest.fn();
    service = new PipelineService(
      { query, transaction: jest.fn() } as unknown as DataSource,
      { resolve: jest.fn().mockResolvedValue(null), resolveMany: jest.fn().mockResolvedValue(new Map()) } as unknown as PolicyService,
      {} as unknown as ScoreService,
      {} as unknown as ApplicationsService,
    );
  });

  it('proceeds directly to stage 9 without any consensus check, and marks the decision as an override', async () => {
    query
      .mockResolvedValueOnce([runRow])         // pipeline_runs lookup
      .mockResolvedValueOnce([applicationRow]) // application snapshot
      .mockResolvedValueOnce([])               // risk profile snapshot
      .mockResolvedValueOnce(undefined)        // INSERT reviewer_decisions (is_override=true)
      .mockResolvedValueOnce([{ id: 'set-1' }]) // multi_approval_sets lookup — still pending consensus
      .mockResolvedValueOnce(undefined)        // UPDATE multi_approval_sets -> overridden
      .mockResolvedValueOnce(undefined);       // INSERT audit_logs

    const startRunSpy = jest.spyOn(service, 'startRun').mockResolvedValue({ ok: true } as any);

    const result = await service.overrideDecision('run-1', 'tenant-1', 'ceo-1', 'approved', 'Board-approved exception', 200000, 'gold');

    expect(startRunSpy).toHaveBeenCalledWith('app-1', 'tenant-1', 'ceo-1', 9);
    expect(result).toEqual({ ok: true });

    const insertCall = query.mock.calls[3];
    expect(insertCall[0]).toContain('is_override');
    expect(insertCall[0]).toContain('true');
    expect(insertCall[1]).toContain('[CEO OVERRIDE] Board-approved exception');
  });
});
