"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const pipeline_service_1 = require("./pipeline.service");
describe('PipelineService — stage gates', () => {
    let service;
    let query;
    let policyService;
    beforeEach(() => {
        query = jest.fn();
        policyService = {
            resolve: jest.fn().mockResolvedValue(null),
            getBoolean: jest.fn().mockResolvedValue(null),
            resolveMany: jest.fn().mockResolvedValue(new Map()),
        };
        service = new pipeline_service_1.PipelineService({ query }, policyService, {}, {});
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
                .mockResolvedValueOnce([{ document_type_code: 'national_id', status: 'verified' }]);
            policyService.getBoolean.mockResolvedValue(false);
            const result = await service.stage1Completeness(baseCtx);
            expect(result.status).toBe('blocked');
            expect(result.outputs.missingDocuments).toEqual(expect.arrayContaining(['bac_diploma', 'university_acceptance', 'income_proof']));
        });
        it('blocks when the policy requires a guarantor and none is linked', async () => {
            query
                .mockResolvedValueOnce([
                { document_type_code: 'national_id', status: 'verified' },
                { document_type_code: 'bac_diploma', status: 'verified' },
                { document_type_code: 'university_acceptance', status: 'verified' },
                { document_type_code: 'income_proof', status: 'verified' },
            ])
                .mockResolvedValueOnce([]);
            policyService.getBoolean.mockResolvedValue(true);
            const result = await service.stage1Completeness(baseCtx);
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
            const result = await service.stage1Completeness(baseCtx);
            expect(result.status).toBe('passed');
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
                .mockResolvedValueOnce([{ date_of_birth: sixteenYearsAgo.toISOString(), nationality: 'TN' }])
                .mockResolvedValueOnce([{ aggregate_score: 500, score_band: 'medium_trust' }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            const result = await service.stage2Eligibility(baseCtx);
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
            const result = await service.stage2Eligibility(baseCtx);
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
            const result = await service.stage2Eligibility(baseCtx);
            expect(result.status).toBe('passed');
        });
    });
    describe('stage3UniversityPartnership', () => {
        const baseCtx = { tenantId: 'tenant-1', universityId: 'uni-1', programId: 'prog-1', studentId: 'student-1' };
        it('blocks when the university is not active', async () => {
            query.mockResolvedValueOnce([{ id: 'uni-1', status: 'suspended' }]);
            const result = await service.stage3UniversityPartnership(baseCtx);
            expect(result.status).toBe('blocked');
            expect(result.outputs.blockReason).toMatch(/not active/);
        });
        it('blocks when no active university agreement exists', async () => {
            query
                .mockResolvedValueOnce([{ id: 'uni-1', status: 'active' }])
                .mockResolvedValueOnce([]);
            const result = await service.stage3UniversityPartnership(baseCtx);
            expect(result.status).toBe('blocked');
            expect(result.outputs.blockReason).toMatch(/No active university agreement/);
        });
        it('escalates to review when an open business-continuity event exists', async () => {
            query
                .mockResolvedValueOnce([{ id: 'uni-1', status: 'active' }])
                .mockResolvedValueOnce([{ id: 'agr-1', payment_model: 'concurrent' }])
                .mockResolvedValueOnce([{ id: 'prog-1', status: 'active' }])
                .mockResolvedValueOnce([{ id: 'event-1' }]);
            const result = await service.stage3UniversityPartnership(baseCtx);
            expect(result.status).toBe('needs_review');
            expect(result.outputs.continuityEventId).toBe('event-1');
        });
        it('passes when university, agreement, and program are all active with no continuity event', async () => {
            query
                .mockResolvedValueOnce([{ id: 'uni-1', status: 'active' }])
                .mockResolvedValueOnce([{ id: 'agr-1', payment_model: 'concurrent' }])
                .mockResolvedValueOnce([{ id: 'prog-1', status: 'active' }])
                .mockResolvedValueOnce([]);
            const result = await service.stage3UniversityPartnership(baseCtx);
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
                .mockResolvedValueOnce([{ aggregate_score: 320 }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ risk_level: 'elevated' }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce(undefined);
            const result = await service.stage4RiskAssessment(baseCtx);
            expect(result.status).toBe('passed');
            expect(result.outputs.riskLevel).toBe('high');
        });
        it('scores a student with a high score, low-risk guarantor, and low-risk university as low risk', async () => {
            query
                .mockResolvedValueOnce([{ aggregate_score: 950 }])
                .mockResolvedValueOnce([{ risk_level: 'low' }])
                .mockResolvedValueOnce([{ risk_level: 'low' }])
                .mockResolvedValueOnce([{ income_stability: 'stable' }])
                .mockResolvedValueOnce(undefined);
            const result = await service.stage4RiskAssessment(baseCtx);
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
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ value: 50000, policyVersionId: 'pv-1' });
            query.mockResolvedValueOnce([]);
            const result = await service.stage5PolicyEvaluation(baseCtx);
            expect(result.status).toBe('blocked');
            expect(result.outputs.violations[0]).toMatch(/exceeds policy maximum/);
        });
        it('blocks a renewal with defaulted installments beyond the policy allowance', async () => {
            const renewalCtx = { ...baseCtx, application: { ...baseCtx.application, requested_support_amount: 5000, is_renewal: true } };
            policyService.resolve = jest.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ value: { maxDefaults: 0 }, policyVersionId: 'pv-2' });
            query
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ count: '1' }]);
            const result = await service.stage5PolicyEvaluation(renewalCtx);
            expect(result.status).toBe('blocked');
            expect(result.outputs.violations[0]).toMatch(/defaulted installments/);
        });
        it('passes when nothing exceeds policy limits', async () => {
            policyService.resolve = jest.fn().mockResolvedValue(null);
            query.mockResolvedValueOnce([]);
            const result = await service.stage5PolicyEvaluation(baseCtx);
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
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null);
            query
                .mockResolvedValueOnce([{ deployed_capital: 100000, pending_disbursements: 2 }])
                .mockResolvedValueOnce([{ university_total: 50000, portfolio_total: 100000 }])
                .mockResolvedValueOnce(undefined);
            const result = await service.stage6PortfolioCapital(baseCtx);
            expect(result.status).toBe('blocked');
            expect(result.outputs.capitalQueue).toBe(true);
        });
        it('passes when university concentration, high-risk exposure, and family exposure are all under their caps', async () => {
            policyService.resolve = jest.fn().mockResolvedValue(null);
            query
                .mockResolvedValueOnce([{ deployed_capital: 100000, pending_disbursements: 1 }])
                .mockResolvedValueOnce([{ university_total: 10000, portfolio_total: 100000 }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            const result = await service.stage6PortfolioCapital(baseCtx);
            expect(result.status).toBe('passed');
        });
        it('T-215 — soft-blocks into the capital queue when high-risk exposure would exceed the cap', async () => {
            policyService.resolve = jest.fn().mockResolvedValue(null);
            query
                .mockResolvedValueOnce([{ deployed_capital: 100000, pending_disbursements: 1 }])
                .mockResolvedValueOnce([{ university_total: 10000, portfolio_total: 100000 }])
                .mockResolvedValueOnce([{ risk_level: 'high' }])
                .mockResolvedValueOnce([{ high_risk_exposure: 9000, total_deployed: 100000 }])
                .mockResolvedValueOnce(undefined);
            const result = await service.stage6PortfolioCapital(baseCtx);
            expect(result.status).toBe('blocked');
            expect(result.outputs.capitalQueue).toBe(true);
            expect(result.outputs.blockReason).toMatch(/high-risk exposure/i);
        });
        it('T-215/D-010 — soft-blocks into the capital queue when a primary guarantor household would exceed max family exposure', async () => {
            policyService.resolve = jest.fn().mockResolvedValue(null);
            query
                .mockResolvedValueOnce([{ deployed_capital: 100000, pending_disbursements: 1 }])
                .mockResolvedValueOnce([{ university_total: 10000, portfolio_total: 100000 }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ guarantor_id: 'guarantor-1' }])
                .mockResolvedValueOnce([{ family_exposure: 98000 }])
                .mockResolvedValueOnce(undefined);
            const result = await service.stage6PortfolioCapital(baseCtx);
            expect(result.status).toBe('blocked');
            expect(result.outputs.capitalQueue).toBe(true);
            expect(result.outputs.blockReason).toMatch(/family exposure/i);
        });
        it('T-216 — a renewal application gets a +100 priority_score boost when soft-blocked into the queue', async () => {
            const renewalCtx = { ...baseCtx, application: { ...baseCtx.application, is_renewal: true } };
            policyService.resolve = jest.fn()
                .mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
            query
                .mockResolvedValueOnce([{ deployed_capital: 100000, pending_disbursements: 2 }])
                .mockResolvedValueOnce([{ university_total: 50000, portfolio_total: 100000 }])
                .mockResolvedValueOnce(undefined);
            await service.stage6PortfolioCapital(renewalCtx);
            const insertCall = query.mock.calls[2];
            expect(insertCall[1]).toContain(600);
        });
    });
    describe('stage7ApprovalThreshold', () => {
        const baseCtx = (amount) => ({
            tenantId: 'tenant-1', pipelineRunId: 'run-1',
            application: { requested_support_amount: amount, tuition_amount: amount },
        });
        beforeEach(() => {
            policyService.resolve = jest.fn().mockResolvedValue(null);
        });
        it('auto-approves amounts at or below the auto-approve threshold, requiring zero approvers', async () => {
            query.mockResolvedValueOnce([]);
            const result = await service.stage7ApprovalThreshold(baseCtx(5000));
            expect(result.outputs.approvalMode).toBe('auto');
            expect(result.outputs.requiredApprovers).toBe(0);
            expect(result.status).toBe('passed');
        });
        it('requires a single approver between the auto and level1 thresholds', async () => {
            query.mockResolvedValueOnce([]);
            const result = await service.stage7ApprovalThreshold(baseCtx(15000));
            expect(result.outputs.approvalMode).toBe('single');
            expect(result.outputs.requiredApprovers).toBe(1);
            expect(result.status).toBe('needs_review');
        });
        it('requires dual approval between the level1 and level2 thresholds', async () => {
            query.mockResolvedValueOnce([]);
            const result = await service.stage7ApprovalThreshold(baseCtx(50000));
            expect(result.outputs.approvalMode).toBe('dual');
            expect(result.outputs.requiredApprovers).toBe(2);
        });
        it('requires executive sign-off above the level2 threshold', async () => {
            query.mockResolvedValueOnce([]);
            const result = await service.stage7ApprovalThreshold(baseCtx(100000));
            expect(result.outputs.approvalMode).toBe('executive');
            expect(result.outputs.requiredApprovers).toBe(2);
        });
        it('escalates an otherwise-auto-approvable amount to single-approver when risk is high', async () => {
            query.mockResolvedValueOnce([{ risk_level: 'high' }]);
            const result = await service.stage7ApprovalThreshold(baseCtx(2000));
            expect(result.outputs.approvalMode).toBe('single');
            expect(result.outputs.requiredApprovers).toBe(1);
        });
    });
    describe('stage8HumanDecision', () => {
        let transitionStatus;
        let stage8Service;
        beforeEach(() => {
            transitionStatus = jest.fn().mockResolvedValue(undefined);
            stage8Service = new pipeline_service_1.PipelineService({ query }, policyService, {}, { transitionStatus });
        });
        const traceWithApprovalMode = (approvalMode, requiredApprovers = 0) => [
            { stage: 7, outputs: { approvalMode, requiredApprovers } },
        ];
        it('auto-approve path: transitions a fresh NEW_LEAD application to UNDER_REVIEW before passing', async () => {
            const ctx = { applicationId: 'app-1', tenantId: 'tenant-1', pipelineRunId: 'run-1', application: { current_status: 'new_lead' } };
            const result = await stage8Service.stage8HumanDecision(ctx, traceWithApprovalMode('auto'));
            expect(result.status).toBe('passed');
            expect(transitionStatus).toHaveBeenCalledWith('app-1', 'tenant-1', 'under_review', null, expect.any(String), 'run-1');
        });
        it('auto-approve path: does not re-transition an application already at UNDER_REVIEW', async () => {
            const ctx = { applicationId: 'app-1', tenantId: 'tenant-1', pipelineRunId: 'run-1', application: { current_status: 'under_review' } };
            await stage8Service.stage8HumanDecision(ctx, traceWithApprovalMode('auto'));
            expect(transitionStatus).not.toHaveBeenCalled();
        });
        it('human-review path: transitions a fresh NEW_LEAD application to UNDER_REVIEW', async () => {
            query.mockResolvedValueOnce([{ id: 'approval-set-1' }]);
            const ctx = { applicationId: 'app-1', tenantId: 'tenant-1', pipelineRunId: 'run-1', application: { current_status: 'new_lead' } };
            const result = await stage8Service.stage8HumanDecision(ctx, traceWithApprovalMode('dual', 2));
            expect(result.status).toBe('needs_review');
            expect(transitionStatus).toHaveBeenCalledWith('app-1', 'tenant-1', 'under_review', null, expect.any(String), 'run-1');
        });
        it('human-review path: does not re-transition an application already at UNDER_REVIEW', async () => {
            query.mockResolvedValueOnce([{ id: 'approval-set-1' }]);
            const ctx = { applicationId: 'app-1', tenantId: 'tenant-1', pipelineRunId: 'run-1', application: { current_status: 'under_review' } };
            await stage8Service.stage8HumanDecision(ctx, traceWithApprovalMode('dual', 2));
            expect(transitionStatus).not.toHaveBeenCalled();
        });
    });
});
describe('PipelineService.submitHumanDecision — dual-approver enforcement', () => {
    let service;
    let query;
    const runRow = { id: 'run-1', application_id: 'app-1', status: 'active' };
    const applicationRow = { id: 'app-1', first_name: 'Amina', last_name: 'T', aggregate_score: 700 };
    beforeEach(() => {
        query = jest.fn();
        service = new pipeline_service_1.PipelineService({ query }, { resolve: jest.fn().mockResolvedValue(null), resolveMany: jest.fn().mockResolvedValue(new Map()) }, {}, { findOne: jest.fn() });
    });
    it('rejects a reviewer submitting a second decision on the same pipeline run', async () => {
        query
            .mockResolvedValueOnce([runRow])
            .mockResolvedValueOnce([{ id: 'existing-vote' }]);
        await expect(service.submitHumanDecision('run-1', 'tenant-1', 'reviewer-1', 'approved', 60000)).rejects.toThrow(common_1.ConflictException);
    });
    it('does not finalize a dual-approval-required decision after only one approval — pipeline stays paused', async () => {
        query
            .mockResolvedValueOnce([runRow])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([applicationRow])
            .mockResolvedValueOnce([{ risk_level: 'medium' }])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([{ id: 'set-1', required_approvers: 2 }])
            .mockResolvedValueOnce([{ count: '1' }])
            .mockResolvedValueOnce(undefined);
        const result = await service.submitHumanDecision('run-1', 'tenant-1', 'reviewer-1', 'approved', 60000);
        expect(result).toEqual(expect.objectContaining({
            status: 'awaiting_additional_approver',
            requiredApprovers: 2,
            approvedSoFar: 1,
        }));
        expect(query).toHaveBeenCalledTimes(8);
    });
    it('finalizes and proceeds once the required number of distinct approvers is reached', async () => {
        query
            .mockResolvedValueOnce([runRow])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([applicationRow])
            .mockResolvedValueOnce([{ risk_level: 'medium' }])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([{ id: 'set-1', required_approvers: 2 }])
            .mockResolvedValueOnce([{ count: '2' }])
            .mockResolvedValueOnce(undefined);
        const startRunSpy = jest.spyOn(service, 'startRun').mockResolvedValue({ ok: true });
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
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([{ id: 'set-1', required_approvers: 2 }])
            .mockResolvedValueOnce(undefined);
        const startRunSpy = jest.spyOn(service, 'startRun').mockResolvedValue({ ok: true });
        const result = await service.submitHumanDecision('run-1', 'tenant-1', 'reviewer-1', 'rejected');
        expect(startRunSpy).toHaveBeenCalledWith('app-1', 'tenant-1', 'reviewer-1', 9);
        expect(result).toEqual({ ok: true });
    });
});
describe('PipelineService.flagFraud', () => {
    let service;
    let query;
    let managerQuery;
    const runWithStudent = { id: 'run-1', application_id: 'app-1', student_id: 'student-1' };
    const student = { id: 'student-1', email: 'Amina@Example.com', membership_status: 'bronze' };
    beforeEach(() => {
        query = jest.fn();
        managerQuery = jest.fn();
        service = new pipeline_service_1.PipelineService({ query, transaction: jest.fn((cb) => cb({ query: managerQuery })) }, { resolve: jest.fn().mockResolvedValue(null), resolveMany: jest.fn().mockResolvedValue(new Map()) }, {}, {});
    });
    it('throws NotFoundException when the pipeline run does not exist', async () => {
        query.mockResolvedValueOnce([]);
        await expect(service.flagFraud('run-1', 'tenant-1', 'staff-1', 'Forged documents')).rejects.toThrow(common_1.NotFoundException);
    });
    it('blacklists the student, records a fraud_records entry, and flags the application, all in one transaction', async () => {
        query
            .mockResolvedValueOnce([runWithStudent])
            .mockResolvedValueOnce([student]);
        managerQuery
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);
        const result = await service.flagFraud('run-1', 'tenant-1', 'staff-1', 'Forged documents');
        expect(result).toEqual(expect.objectContaining({ studentId: 'student-1', membershipStatus: 'blacklisted' }));
        const fraudInsertCall = managerQuery.mock.calls[0];
        expect(fraudInsertCall[0]).toContain('INSERT INTO fraud_records');
        expect(fraudInsertCall[1][2]).not.toContain('Amina@Example.com');
        const studentUpdateCall = managerQuery.mock.calls[1];
        expect(studentUpdateCall[0]).toContain("membership_status = 'blacklisted'");
    });
});
describe('PipelineService.overrideDecision', () => {
    let service;
    let query;
    const runRow = { id: 'run-1', application_id: 'app-1', status: 'active' };
    const applicationRow = { id: 'app-1', first_name: 'Amina', last_name: 'T' };
    beforeEach(() => {
        query = jest.fn();
        service = new pipeline_service_1.PipelineService({ query, transaction: jest.fn() }, { resolve: jest.fn().mockResolvedValue(null), resolveMany: jest.fn().mockResolvedValue(new Map()) }, {}, {});
    });
    it('proceeds directly to stage 9 without any consensus check, and marks the decision as an override', async () => {
        query
            .mockResolvedValueOnce([runRow])
            .mockResolvedValueOnce([applicationRow])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce([{ id: 'set-1' }])
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined);
        const startRunSpy = jest.spyOn(service, 'startRun').mockResolvedValue({ ok: true });
        const result = await service.overrideDecision('run-1', 'tenant-1', 'ceo-1', 'approved', 'Board-approved exception', 200000, 'gold');
        expect(startRunSpy).toHaveBeenCalledWith('app-1', 'tenant-1', 'ceo-1', 9);
        expect(result).toEqual({ ok: true });
        const insertCall = query.mock.calls[3];
        expect(insertCall[0]).toContain('is_override');
        expect(insertCall[0]).toContain('true');
        expect(insertCall[1]).toContain('[CEO OVERRIDE] Board-approved exception');
    });
});
describe('PipelineService.findCapitalQueue', () => {
    it('orders by priority_score DESC, then queued_at ASC, and only returns active (not yet dequeued) entries', async () => {
        const query = jest.fn().mockResolvedValue([{ id: 'q-1', priority_score: 600 }]);
        const service = new pipeline_service_1.PipelineService({ query }, { resolve: jest.fn(), resolveMany: jest.fn() }, {}, {});
        const result = await service.findCapitalQueue('tenant-1');
        expect(result).toEqual([{ id: 'q-1', priority_score: 600 }]);
        const sql = query.mock.calls[0][0];
        expect(sql).toContain('dequeued_at IS NULL');
        expect(sql).toContain('ORDER BY cq.priority_score DESC');
    });
});
//# sourceMappingURL=pipeline.service.spec.js.map