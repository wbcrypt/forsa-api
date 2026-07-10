"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PipelineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const uuid_1 = require("uuid");
const encryption_util_1 = require("../common/utils/encryption.util");
const policy_service_1 = require("../policy/policy.service");
const score_service_1 = require("../score/score.service");
const applications_service_1 = require("../applications/applications.service");
const enums_1 = require("../common/enums");
let PipelineService = PipelineService_1 = class PipelineService {
    constructor(dataSource, policyService, scoreService, applicationsService) {
        this.dataSource = dataSource;
        this.policyService = policyService;
        this.scoreService = scoreService;
        this.applicationsService = applicationsService;
        this.logger = new common_1.Logger(PipelineService_1.name);
    }
    async startRun(applicationId, tenantId, triggeredBy, reentryFromStage) {
        const application = await this.applicationsService.findOne(applicationId, tenantId);
        const [runCountRow] = await this.dataSource.query(`SELECT COALESCE(MAX(run_number), 0) + 1 AS next FROM pipeline_runs WHERE application_id = $1`, [applicationId]);
        const runNumber = runCountRow.next;
        const pipelineRunId = (0, uuid_1.v4)();
        const startStage = reentryFromStage || 1;
        await this.dataSource.query(`INSERT INTO pipeline_runs
        (id, tenant_id, application_id, run_number, status, started_at, triggered_by,
         reentry_from_stage, snapshot_application, snapshot_student)
       VALUES ($1,$2,$3,$4,'active',NOW(),$5,$6,$7,$8)`, [
            pipelineRunId, tenantId, applicationId, runNumber, triggeredBy,
            reentryFromStage || null,
            JSON.stringify(application),
            JSON.stringify({ id: application.student_id }),
        ]);
        await this.dataSource.query(`UPDATE pipeline_runs
       SET status = 'superseded'
       WHERE application_id = $1 AND status = 'active' AND id != $2`, [applicationId, pipelineRunId]);
        await this.dataSource.query(`UPDATE applications SET current_pipeline_run_id = $2 WHERE id = $1`, [applicationId, pipelineRunId]);
        const trace = [];
        let blockedAtStage;
        let blockReason;
        let requiresHumanReview = false;
        let decisionResult;
        let approvedLevel;
        let approvedAmount;
        const context = {
            tenantId,
            pipelineRunId,
            applicationId,
            application,
            studentId: application.student_id,
            universityId: application.university_id,
            programId: application.program_id,
        };
        try {
            for (let stage = startStage; stage <= 10; stage++) {
                const t0 = Date.now();
                let stageResult;
                switch (stage) {
                    case 1:
                        stageResult = await this.stage1Completeness(context);
                        break;
                    case 2:
                        stageResult = await this.stage2Eligibility(context);
                        break;
                    case 3:
                        stageResult = await this.stage3UniversityPartnership(context);
                        break;
                    case 4:
                        stageResult = await this.stage4RiskAssessment(context);
                        break;
                    case 5:
                        stageResult = await this.stage5PolicyEvaluation(context);
                        break;
                    case 6:
                        stageResult = await this.stage6PortfolioCapital(context);
                        break;
                    case 7:
                        stageResult = await this.stage7ApprovalThreshold(context);
                        break;
                    case 8:
                        stageResult = await this.stage8HumanDecision(context, trace);
                        break;
                    case 9:
                        stageResult = await this.stage9DecisionGeneration(context, trace);
                        break;
                    case 10:
                        stageResult = await this.stage10DecisionExecution(context, trace);
                        break;
                    default: continue;
                }
                const stageTrace = {
                    stage,
                    stageName: this.stageName(stage),
                    status: stageResult.status,
                    inputs: this.extractInputs(context, stage),
                    outputs: stageResult.outputs,
                    policyVersionIds: stageResult.policyVersionIds,
                    durationMs: Date.now() - t0,
                };
                trace.push(stageTrace);
                await this.persistStageRecord(pipelineRunId, tenantId, stage, stageResult, stageTrace);
                if (stageResult.status === 'blocked') {
                    blockedAtStage = stage;
                    blockReason = stageResult.outputs.blockReason;
                    if (stage === 6 && stageResult.outputs.capitalQueue) {
                        await this.applicationsService.transitionStatus(applicationId, tenantId, enums_1.ApplicationStatus.CAPITAL_QUEUE, triggeredBy, 'Placed in capital queue', pipelineRunId);
                    }
                    break;
                }
                if (stageResult.status === 'needs_review') {
                    requiresHumanReview = true;
                }
                if (stage === 9) {
                    decisionResult = stageResult.outputs.decisionResult;
                    approvedLevel = stageResult.outputs.approvedLevel;
                    approvedAmount = stageResult.outputs.approvedAmount;
                }
            }
            await this.dataSource.query(`UPDATE pipeline_runs
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1`, [pipelineRunId]);
            await this.dataSource.query(`INSERT INTO pipeline_execution_traces
          (pipeline_run_id, stage_record_ids, full_trace)
         VALUES ($1,$2,$3)
         ON CONFLICT (pipeline_run_id) DO UPDATE SET full_trace = $3`, [pipelineRunId, '{}', JSON.stringify(trace)]);
        }
        catch (err) {
            this.logger.error(`Pipeline run ${pipelineRunId} failed`, err);
            await this.dataSource.query(`UPDATE pipeline_runs SET status = 'cancelled', completed_at = NOW() WHERE id = $1`, [pipelineRunId]);
            throw err;
        }
        return {
            pipelineRunId,
            applicationId,
            runNumber,
            status: enums_1.PipelineRunStatus.COMPLETED,
            decisionResult,
            approvedLevel,
            approvedAmount,
            requiresHumanReview,
            blockedAtStage,
            blockReason,
            trace,
        };
    }
    async stage1Completeness(ctx) {
        const policyVersionIds = [];
        const missingDocs = [];
        const missingFields = [];
        if (!ctx.application.tuition_amount)
            missingFields.push('tuition_amount');
        if (!ctx.application.university_id)
            missingFields.push('university_id');
        if (!ctx.application.student_id)
            missingFields.push('student_id');
        if (!ctx.application.program_id)
            missingFields.push('program_id');
        if (!ctx.application.requested_tier)
            missingFields.push('requested_tier');
        if (!ctx.application.platform_fee_acknowledged_at)
            missingFields.push('platform_fee_acknowledgment');
        const guarantorRequired = (await this.policyService.getBoolean('guarantor.required', { tenantId: ctx.tenantId })) ?? true;
        if (guarantorRequired) {
            const [guarantor] = await this.dataSource.query(`SELECT sg.id FROM student_guarantors sg
         WHERE sg.student_id = $1 AND sg.status IN ('active', 'pending_invitation') LIMIT 1`, [ctx.studentId]);
            if (!guarantor)
                missingFields.push('guarantor');
        }
        const isComplete = missingDocs.length === 0 && missingFields.length === 0;
        if (!isComplete) {
            return {
                status: 'blocked',
                outputs: {
                    missingDocuments: missingDocs,
                    missingFields,
                    blockReason: `Completeness check failed: missing ${[...missingDocs, ...missingFields].join(', ')}`,
                },
                policyVersionIds,
            };
        }
        return {
            status: 'passed',
            outputs: { allFieldsPresent: true, paperworkNote: 'CIN/income proof/كمبيالة verified in person at the activation meeting, not digitally at this stage' },
            policyVersionIds,
        };
    }
    async stage2Eligibility(ctx) {
        const policyVersionIds = [];
        const issues = [];
        const minAgePolicy = await this.policyService.resolve('eligibility.age.minimum', { tenantId: ctx.tenantId });
        if (minAgePolicy)
            policyVersionIds.push(minAgePolicy.policyVersionId);
        const minAge = minAgePolicy?.value || 17;
        const [student] = await this.dataSource.query(`SELECT date_of_birth, nationality FROM students WHERE id = $1`, [ctx.studentId]);
        if (student) {
            const age = Math.floor((Date.now() - new Date(student.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000));
            if (age < minAge)
                issues.push(`Student must be at least ${minAge} years old (is ${age})`);
        }
        const minScorePolicy = await this.policyService.resolve('eligibility.score.minimum', { tenantId: ctx.tenantId });
        if (minScorePolicy)
            policyVersionIds.push(minScorePolicy.policyVersionId);
        const minScore = minScorePolicy?.value || 300;
        const [scoreRow] = await this.dataSource.query(`SELECT aggregate_score, score_band FROM forsa_scores WHERE student_id = $1`, [ctx.studentId]);
        const currentScore = scoreRow?.aggregate_score || 500;
        if (currentScore < minScore)
            issues.push(`FORSA Score ${currentScore} is below minimum ${minScore}`);
        const [fraudFlag] = await this.dataSource.query(`SELECT id FROM score_events
       WHERE student_id = $1 AND dimension = 'payment_reliability'
         AND event_code LIKE 'FRAUD%' AND is_active = true
       LIMIT 1`, [ctx.studentId]);
        if (fraudFlag)
            issues.push('Active fraud flag on student record');
        const [activeFinancing] = await this.dataSource.query(`SELECT id FROM applications
       WHERE student_id = $1 AND tenant_id = $2
         AND current_status IN ('active_student','contract_signed','university_paid')
         AND id != $3`, [ctx.studentId, ctx.tenantId, ctx.applicationId]);
        const allowMultiplePolicy = await this.policyService.getBoolean('eligibility.allow_concurrent_financing', { tenantId: ctx.tenantId });
        if (allowMultiplePolicy === false) {
            if (minScorePolicy)
                policyVersionIds.push(minScorePolicy.policyVersionId);
            if (activeFinancing)
                issues.push('Student has active financing agreement');
        }
        if (issues.length > 0) {
            return {
                status: 'blocked',
                outputs: { issues, blockReason: `Eligibility failed: ${issues.join('; ')}` },
                policyVersionIds,
            };
        }
        return {
            status: 'passed',
            outputs: { currentScore, scoreRow, student },
            policyVersionIds,
        };
    }
    async stage3UniversityPartnership(ctx) {
        const policyVersionIds = [];
        const [university] = await this.dataSource.query(`SELECT id, status, risk_level FROM universities WHERE id = $1 AND tenant_id = $2`, [ctx.universityId, ctx.tenantId]);
        if (!university || university.status !== 'active') {
            return {
                status: 'blocked',
                outputs: { blockReason: `University is not active (status: ${university?.status || 'not found'})` },
                policyVersionIds,
            };
        }
        const [agreement] = await this.dataSource.query(`SELECT id, payment_model, financing_levels, discount_percentage, max_financing_amount
       FROM university_agreements
       WHERE university_id = $1 AND tenant_id = $2 AND status = 'active'
         AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
       ORDER BY effective_date DESC LIMIT 1`, [ctx.universityId, ctx.tenantId]);
        if (!agreement) {
            return {
                status: 'blocked',
                outputs: { blockReason: 'No active university agreement found' },
                policyVersionIds,
            };
        }
        if (ctx.programId) {
            const [program] = await this.dataSource.query(`SELECT id, status, accreditation_status FROM programs WHERE id = $1`, [ctx.programId]);
            if (!program || program.status !== 'active') {
                return {
                    status: 'blocked',
                    outputs: { blockReason: 'Program is not active or not found' },
                    policyVersionIds,
                };
            }
        }
        const [continuityEvent] = await this.dataSource.query(`SELECT id FROM student_exceptional_events
       WHERE student_id = $1 AND status = 'open'
         AND event_type IN ('university_closure','program_cancellation','accreditation_loss')
       LIMIT 1`, [ctx.studentId]);
        if (continuityEvent) {
            return {
                status: 'needs_review',
                outputs: {
                    agreement,
                    continuityEventId: continuityEvent.id,
                    message: 'Open university continuity event — requires manual review',
                },
                policyVersionIds,
            };
        }
        return {
            status: 'passed',
            outputs: { agreement, university },
            policyVersionIds,
        };
    }
    async stage4RiskAssessment(ctx) {
        const policyVersionIds = [];
        const riskPolicies = await this.policyService.resolveMany([
            'risk.weight.score', 'risk.weight.guarantor', 'risk.weight.university',
            'risk.weight.program', 'risk.weight.income', 'risk.thresholds',
        ], { tenantId: ctx.tenantId, universityId: ctx.universityId });
        for (const [, policy] of riskPolicies) {
            policyVersionIds.push(policy.policyVersionId);
        }
        const [scoreRow] = await this.dataSource.query(`SELECT aggregate_score, score_band FROM forsa_scores WHERE student_id = $1`, [ctx.studentId]);
        const score = scoreRow?.aggregate_score || 500;
        const scoreFactor = Math.min(score / 1000, 1);
        const [guarantors] = await this.dataSource.query(`SELECT g.employment_status, g.income_stability, g.risk_level
       FROM student_guarantors sg
       JOIN guarantors g ON g.id = sg.guarantor_id
       WHERE sg.student_id = $1 AND sg.status = 'active'`, [ctx.studentId]);
        const guarantorFactor = guarantors?.risk_level === 'low' ? 0.9
            : guarantors?.risk_level === 'medium' ? 0.6
                : guarantors?.risk_level === 'high' ? 0.3 : 0.5;
        const [university] = await this.dataSource.query(`SELECT risk_level FROM universities WHERE id = $1`, [ctx.universityId]);
        const universityFactor = university?.risk_level === 'low' ? 0.9
            : university?.risk_level === 'standard' ? 0.7
                : university?.risk_level === 'elevated' ? 0.4 : 0.6;
        const requestedAmount = ctx.application.requested_support_amount || ctx.application.tuition_amount;
        const [incomeData] = await this.dataSource.query(`SELECT g.income_stability FROM guarantors g
       JOIN student_guarantors sg ON sg.guarantor_id = g.id
       WHERE sg.student_id = $1 AND sg.status = 'active'`, [ctx.studentId]);
        const incomeFactor = incomeData?.income_stability === 'stable' ? 0.9
            : incomeData?.income_stability === 'variable' ? 0.6
                : incomeData?.income_stability === 'unstable' ? 0.2 : 0.5;
        const weights = riskPolicies.get('risk.weight.score')?.value || {
            score: 0.35, guarantor: 0.25, university: 0.2, income: 0.2,
        };
        const riskScore = (scoreFactor * weights.score +
            guarantorFactor * weights.guarantor +
            universityFactor * weights.university +
            incomeFactor * weights.income);
        const thresholds = riskPolicies.get('risk.thresholds')?.value || {
            low: 0.7, medium: 0.45, high: 0,
        };
        const riskLevel = riskScore >= thresholds.low ? 'low'
            : riskScore >= thresholds.medium ? 'medium' : 'high';
        await this.dataSource.query(`INSERT INTO risk_profiles
        (pipeline_run_id, application_id, student_id, risk_score, risk_level,
         score_factor, guarantor_factor, university_factor, income_factor,
         requested_amount, policy_version_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (pipeline_run_id) DO UPDATE
       SET risk_score = $4, risk_level = $5`, [
            ctx.pipelineRunId, ctx.applicationId, ctx.studentId,
            Math.round(riskScore * 100) / 100, riskLevel,
            scoreFactor, guarantorFactor, universityFactor, incomeFactor,
            requestedAmount, policyVersionIds,
        ]);
        return {
            status: 'passed',
            outputs: { riskScore, riskLevel, factors: { scoreFactor, guarantorFactor, universityFactor, incomeFactor } },
            policyVersionIds,
        };
    }
    async stage5PolicyEvaluation(ctx) {
        const policyVersionIds = [];
        const violations = [];
        const level3Policy = await this.policyService.resolve('financing.level3.eligibility', { tenantId: ctx.tenantId, universityId: ctx.universityId });
        if (level3Policy)
            policyVersionIds.push(level3Policy.policyVersionId);
        const maxAmountPolicy = await this.policyService.resolve('financing.amount.maximum', { tenantId: ctx.tenantId, universityId: ctx.universityId });
        if (maxAmountPolicy)
            policyVersionIds.push(maxAmountPolicy.policyVersionId);
        const maxAmount = maxAmountPolicy?.value;
        const requestedAmount = ctx.application.requested_support_amount || ctx.application.tuition_amount;
        if (maxAmount && requestedAmount > maxAmount) {
            violations.push(`Requested amount ${requestedAmount} exceeds policy maximum ${maxAmount}`);
        }
        const [agreement] = await this.dataSource.query(`SELECT financing_levels, max_financing_amount FROM university_agreements
       WHERE university_id = $1 AND tenant_id = $2 AND status = 'active'
       LIMIT 1`, [ctx.universityId, ctx.tenantId]);
        if (agreement?.max_financing_amount && requestedAmount > agreement.max_financing_amount) {
            violations.push(`Amount exceeds university agreement maximum ${agreement.max_financing_amount}`);
        }
        if (ctx.application.is_renewal) {
            const renewalPolicy = await this.policyService.resolve('financing.renewal.requirements', { tenantId: ctx.tenantId, studentId: ctx.studentId });
            if (renewalPolicy)
                policyVersionIds.push(renewalPolicy.policyVersionId);
            const [latePayments] = await this.dataSource.query(`SELECT COUNT(*) AS count FROM installments i
         JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
         JOIN applications a ON a.id = ps.application_id
         WHERE a.student_id = $1 AND i.status = 'defaulted'`, [ctx.studentId]);
            const maxDefaultsForRenewal = renewalPolicy?.value?.maxDefaults || 0;
            if (parseInt(latePayments.count) > maxDefaultsForRenewal) {
                violations.push(`Student has ${latePayments.count} defaulted installments, renewal requires 0`);
            }
        }
        if (violations.length > 0) {
            return {
                status: 'blocked',
                outputs: { violations, blockReason: `Policy evaluation failed: ${violations.join('; ')}` },
                policyVersionIds,
            };
        }
        return {
            status: 'passed',
            outputs: { policyChecks: 'all_passed', requestedAmount, maxAmount },
            policyVersionIds,
        };
    }
    async stage6PortfolioCapital(ctx) {
        const policyVersionIds = [];
        const capitalPolicy = await this.policyService.resolve('portfolio.capital.available', { tenantId: ctx.tenantId });
        if (capitalPolicy)
            policyVersionIds.push(capitalPolicy.policyVersionId);
        const [portfolioStats] = await this.dataSource.query(`SELECT
         COALESCE(SUM(a.tuition_amount) FILTER (WHERE a.current_status IN
           ('contract_signed','university_paid','active_student')), 0) AS deployed_capital,
         COUNT(a.id) FILTER (WHERE a.current_status IN ('approved_level1','approved_level2','contract_sent')) AS pending_disbursements
       FROM applications a
       WHERE a.tenant_id = $1`, [ctx.tenantId]);
        const concentrationPolicy = await this.policyService.resolve('portfolio.concentration.university_max_pct', { tenantId: ctx.tenantId });
        if (concentrationPolicy)
            policyVersionIds.push(concentrationPolicy.policyVersionId);
        const maxConcentration = concentrationPolicy?.value || 40;
        const [univConcentration] = await this.dataSource.query(`SELECT
         COALESCE(SUM(a.tuition_amount), 0) AS university_total,
         (SELECT COALESCE(SUM(a2.tuition_amount), 0) FROM applications a2
          WHERE a2.tenant_id = $2
            AND a2.current_status IN ('contract_signed','university_paid','active_student')) AS portfolio_total
       FROM applications a
       WHERE a.university_id = $1 AND a.tenant_id = $2
         AND a.current_status IN ('contract_signed','university_paid','active_student')`, [ctx.universityId, ctx.tenantId]);
        let concentrationPct = 0;
        if (univConcentration?.portfolio_total > 0) {
            concentrationPct = (univConcentration.university_total / univConcentration.portfolio_total) * 100;
        }
        const capitalQueuePolicy = await this.policyService.resolve('portfolio.capital_queue.enabled', { tenantId: ctx.tenantId });
        if (concentrationPct > maxConcentration) {
            const queueEnabled = capitalQueuePolicy?.value ?? true;
            if (queueEnabled) {
                await this.dataSource.query(`INSERT INTO capital_queue
            (pipeline_run_id, application_id, reason, priority_score, queued_at)
           VALUES ($1,$2,$3,$4,NOW())
           ON CONFLICT DO NOTHING`, [
                    ctx.pipelineRunId, ctx.applicationId,
                    `University concentration at ${concentrationPct.toFixed(1)}% exceeds ${maxConcentration}% limit`,
                    500 + this.renewalPriorityBoost(ctx),
                ]);
                return {
                    status: 'blocked',
                    outputs: {
                        capitalQueue: true,
                        concentrationPct,
                        maxConcentration,
                        blockReason: `Placed in capital queue: university concentration limit`,
                    },
                    policyVersionIds,
                };
            }
        }
        const highRiskCapPolicy = await this.policyService.resolve('portfolio.risk.high_risk_max_pct', { tenantId: ctx.tenantId });
        if (highRiskCapPolicy)
            policyVersionIds.push(highRiskCapPolicy.policyVersionId);
        const maxHighRiskPct = highRiskCapPolicy?.value || 10;
        const [currentRisk] = await this.dataSource.query(`SELECT risk_level FROM risk_profiles WHERE pipeline_run_id = $1`, [ctx.pipelineRunId]);
        if (currentRisk?.risk_level === 'high') {
            const [highRiskStats] = await this.dataSource.query(`SELECT
           COALESCE(SUM(a.tuition_amount) FILTER (WHERE latest_risk.risk_level = 'high'), 0) AS high_risk_exposure,
           COALESCE(SUM(a.tuition_amount), 0) AS total_deployed
         FROM applications a
         LEFT JOIN LATERAL (
           SELECT rp.risk_level FROM risk_profiles rp
           WHERE rp.application_id = a.id
           ORDER BY rp.created_at DESC LIMIT 1
         ) latest_risk ON true
         WHERE a.tenant_id = $1
           AND a.current_status IN ('contract_signed','university_paid','active_student')`, [ctx.tenantId]);
            const requestedAmount = ctx.application.requested_support_amount || ctx.application.tuition_amount || 0;
            const projectedHighRisk = parseFloat(highRiskStats?.high_risk_exposure || 0) + requestedAmount;
            const projectedTotal = parseFloat(highRiskStats?.total_deployed || 0) + requestedAmount;
            const projectedHighRiskPct = projectedTotal > 0 ? (projectedHighRisk / projectedTotal) * 100 : 0;
            if (projectedHighRiskPct > maxHighRiskPct) {
                const queueEnabled = (capitalQueuePolicy?.value ?? true);
                if (queueEnabled) {
                    await this.dataSource.query(`INSERT INTO capital_queue
              (pipeline_run_id, application_id, reason, priority_score, queued_at)
             VALUES ($1,$2,$3,$4,NOW())
             ON CONFLICT DO NOTHING`, [
                        ctx.pipelineRunId, ctx.applicationId,
                        `High-risk exposure would reach ${projectedHighRiskPct.toFixed(1)}% of deployed capital, exceeding the ${maxHighRiskPct}% limit`,
                        400 + this.renewalPriorityBoost(ctx),
                    ]);
                    return {
                        status: 'blocked',
                        outputs: {
                            capitalQueue: true,
                            projectedHighRiskPct, maxHighRiskPct,
                            blockReason: 'Placed in capital queue: high-risk exposure limit',
                        },
                        policyVersionIds,
                    };
                }
            }
        }
        const [primaryGuarantor] = await this.dataSource.query(`SELECT guarantor_id FROM student_guarantors
       WHERE student_id = $1 AND role = 'primary' AND status = 'active' LIMIT 1`, [ctx.studentId]);
        if (primaryGuarantor) {
            const familyCapPolicy = await this.policyService.resolve('portfolio.risk.max_family_exposure', { tenantId: ctx.tenantId });
            if (familyCapPolicy)
                policyVersionIds.push(familyCapPolicy.policyVersionId);
            const maxFamilyExposure = familyCapPolicy?.value || 100000;
            const [familyStats] = await this.dataSource.query(`SELECT COALESCE(SUM(a.tuition_amount), 0) AS family_exposure
         FROM applications a
         JOIN student_guarantors sg ON sg.student_id = a.student_id AND sg.role = 'primary' AND sg.status = 'active'
         WHERE sg.guarantor_id = $1 AND a.tenant_id = $2
           AND a.current_status IN ('contract_signed','university_paid','active_student')`, [primaryGuarantor.guarantor_id, ctx.tenantId]);
            const requestedAmount = ctx.application.requested_support_amount || ctx.application.tuition_amount || 0;
            const projectedFamilyExposure = parseFloat(familyStats?.family_exposure || 0) + requestedAmount;
            if (projectedFamilyExposure > maxFamilyExposure) {
                const queueEnabled = (capitalQueuePolicy?.value ?? true);
                if (queueEnabled) {
                    await this.dataSource.query(`INSERT INTO capital_queue
              (pipeline_run_id, application_id, reason, priority_score, queued_at)
             VALUES ($1,$2,$3,$4,NOW())
             ON CONFLICT DO NOTHING`, [
                        ctx.pipelineRunId, ctx.applicationId,
                        `Family exposure would reach ${projectedFamilyExposure.toFixed(0)} TND, exceeding the ${maxFamilyExposure} TND limit for this primary guarantor household`,
                        450 + this.renewalPriorityBoost(ctx),
                    ]);
                    return {
                        status: 'blocked',
                        outputs: {
                            capitalQueue: true,
                            projectedFamilyExposure, maxFamilyExposure,
                            blockReason: 'Placed in capital queue: family exposure limit',
                        },
                        policyVersionIds,
                    };
                }
            }
        }
        const portfolioImpactScore = Math.max(0, 100 - concentrationPct);
        return {
            status: 'passed',
            outputs: { portfolioImpactScore, concentrationPct, deployedCapital: portfolioStats.deployed_capital },
            policyVersionIds,
        };
    }
    async stage7ApprovalThreshold(ctx) {
        const policyVersionIds = [];
        const requestedAmount = ctx.application.requested_support_amount || ctx.application.tuition_amount;
        const thresholdPolicy = await this.policyService.resolve('approval.thresholds', { tenantId: ctx.tenantId });
        if (thresholdPolicy)
            policyVersionIds.push(thresholdPolicy.policyVersionId);
        const thresholds = thresholdPolicy?.value || {
            auto_approve_max: 5000,
            level1_max: 15000,
            level2_max: 50000,
        };
        let approvalMode;
        let requiredApprovers;
        if (requestedAmount <= thresholds.auto_approve_max) {
            approvalMode = 'auto';
            requiredApprovers = 0;
        }
        else if (requestedAmount <= thresholds.level1_max) {
            approvalMode = 'single';
            requiredApprovers = 1;
        }
        else if (requestedAmount <= thresholds.level2_max) {
            approvalMode = 'dual';
            requiredApprovers = 2;
        }
        else {
            approvalMode = 'executive';
            requiredApprovers = 2;
        }
        const [riskProfile] = await this.dataSource.query(`SELECT risk_level FROM risk_profiles WHERE pipeline_run_id = $1`, [ctx.pipelineRunId]);
        if (riskProfile?.risk_level === 'high' && approvalMode === 'auto') {
            approvalMode = 'single';
            requiredApprovers = 1;
        }
        return {
            status: requiredApprovers === 0 ? 'passed' : 'needs_review',
            outputs: { approvalMode, requiredApprovers, requestedAmount, thresholds },
            policyVersionIds,
        };
    }
    async stage8HumanDecision(ctx, trace) {
        const stage7 = trace.find(t => t.stage === 7);
        const approvalMode = stage7?.outputs.approvalMode;
        const requiredApprovers = stage7?.outputs.requiredApprovers || 0;
        if (approvalMode === 'auto') {
            if (ctx.application?.current_status !== enums_1.ApplicationStatus.UNDER_REVIEW) {
                await this.applicationsService.transitionStatus(ctx.applicationId, ctx.tenantId, enums_1.ApplicationStatus.UNDER_REVIEW, null, 'Entered automated review (auto-approve eligible)', ctx.pipelineRunId);
            }
            return {
                status: 'passed',
                outputs: { humanDecisionRequired: false, approvalMode: 'auto' },
                policyVersionIds: [],
            };
        }
        const sequencing = requiredApprovers > 1 ? enums_1.ApprovalSequencing.SEQUENTIAL : enums_1.ApprovalSequencing.SEQUENTIAL;
        const [approvalSet] = await this.dataSource.query(`INSERT INTO multi_approval_sets
        (pipeline_run_id, application_id, tenant_id, required_approvers,
         sequencing, status, created_at)
       VALUES ($1,$2,$3,$4,$5,'pending',NOW())
       RETURNING id`, [ctx.pipelineRunId, ctx.applicationId, ctx.tenantId, requiredApprovers, sequencing]);
        if (ctx.application?.current_status !== enums_1.ApplicationStatus.UNDER_REVIEW) {
            await this.applicationsService.transitionStatus(ctx.applicationId, ctx.tenantId, enums_1.ApplicationStatus.UNDER_REVIEW, null, 'Awaiting human decision', ctx.pipelineRunId);
        }
        return {
            status: 'needs_review',
            outputs: {
                humanDecisionRequired: true,
                approvalSetId: approvalSet.id,
                requiredApprovers,
                sequencing,
                message: 'Pipeline paused — awaiting human decision',
            },
            policyVersionIds: [],
        };
    }
    async stage9DecisionGeneration(ctx, trace) {
        const policyVersionIds = [];
        const [risk] = await this.dataSource.query(`SELECT risk_level, risk_score FROM risk_profiles WHERE pipeline_run_id = $1`, [ctx.pipelineRunId]);
        const [humanDecision] = await this.dataSource.query(`SELECT decision, approved_amount, reviewer_id
       FROM reviewer_decisions
       WHERE pipeline_run_id = $1
       ORDER BY decided_at DESC LIMIT 1`, [ctx.pipelineRunId]);
        let decisionResult;
        let approvedLevel;
        let approvedAmount;
        const requestedAmount = ctx.application.requested_support_amount || ctx.application.tuition_amount;
        const [agreement] = await this.dataSource.query(`SELECT financing_levels, discount_percentage FROM university_agreements
       WHERE university_id = $1 AND tenant_id = $2 AND status = 'active' LIMIT 1`, [ctx.universityId, ctx.tenantId]);
        const availableLevels = agreement?.financing_levels || ['level1', 'level2', 'level3'];
        if (humanDecision?.decision === 'rejected') {
            decisionResult = enums_1.DecisionResult.REJECTED;
            approvedLevel = '';
            approvedAmount = 0;
        }
        else if (humanDecision?.decision === 'on_hold') {
            decisionResult = enums_1.DecisionResult.ON_HOLD;
            approvedLevel = '';
            approvedAmount = 0;
        }
        else if (humanDecision?.decision === 'waiting_list') {
            decisionResult = enums_1.DecisionResult.CAPITAL_QUEUE;
            approvedLevel = '';
            approvedAmount = 0;
            await this.dataSource.query(`INSERT INTO capital_queue (pipeline_run_id, application_id, reason, priority_score, queued_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT DO NOTHING`, [ctx.pipelineRunId, ctx.applicationId, 'Placed on Waiting List by reviewer decision', 500 + this.renewalPriorityBoost(ctx)]);
        }
        else {
            if (risk?.risk_level === 'low' && availableLevels.includes('level1')) {
                decisionResult = enums_1.DecisionResult.APPROVED_LEVEL1;
                approvedLevel = 'level1';
                approvedAmount = humanDecision?.approved_amount || requestedAmount;
            }
            else if (risk?.risk_level === 'medium' && availableLevels.includes('level2')) {
                decisionResult = enums_1.DecisionResult.APPROVED_LEVEL2;
                approvedLevel = 'level2';
                approvedAmount = humanDecision?.approved_amount || requestedAmount;
            }
            else if (availableLevels.includes('level3')) {
                decisionResult = enums_1.DecisionResult.APPROVED_LEVEL3;
                approvedLevel = 'level3';
                approvedAmount = 0;
            }
            else {
                decisionResult = enums_1.DecisionResult.REJECTED;
                approvedLevel = '';
                approvedAmount = 0;
            }
        }
        const dcs = await this.computeDcs(ctx, trace, risk);
        policyVersionIds.push(...dcs.policyVersionIds);
        const allPolicyVersionIds = trace.flatMap(t => t.policyVersionIds);
        const [decision] = await this.dataSource.query(`INSERT INTO financing_decisions
        (pipeline_run_id, application_id, tenant_id, decision_result, approved_level,
         approved_amount, currency, explanation, conditions, policy_version_ids,
         dcs_score, dcs_version, generated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       RETURNING id`, [
            ctx.pipelineRunId, ctx.applicationId, ctx.tenantId,
            decisionResult, approvedLevel || null, approvedAmount,
            ctx.application.currency || 'TND',
            this.buildExplanation(decisionResult, risk, trace),
            JSON.stringify([]),
            allPolicyVersionIds,
            dcs.score,
            dcs.version,
        ]);
        return {
            status: 'passed',
            outputs: { decisionResult, approvedLevel, approvedAmount, dcsScore: dcs.score, decisionId: decision.id },
            policyVersionIds,
        };
    }
    async stage10DecisionExecution(ctx, trace) {
        const stage9 = trace.find(t => t.stage === 9);
        const decisionResult = stage9?.outputs.decisionResult;
        const approvedLevel = stage9?.outputs.approvedLevel;
        const approvedAmount = stage9?.outputs.approvedAmount;
        if (!decisionResult) {
            return {
                status: 'blocked',
                outputs: { blockReason: 'No decision from stage 9' },
                policyVersionIds: [],
            };
        }
        const statusMap = {
            [enums_1.DecisionResult.APPROVED_LEVEL1]: enums_1.ApplicationStatus.APPROVED_LEVEL1,
            [enums_1.DecisionResult.APPROVED_LEVEL2]: enums_1.ApplicationStatus.APPROVED_LEVEL2,
            [enums_1.DecisionResult.APPROVED_LEVEL3]: enums_1.ApplicationStatus.APPROVED_LEVEL3,
            [enums_1.DecisionResult.REJECTED]: enums_1.ApplicationStatus.REJECTED,
            [enums_1.DecisionResult.ON_HOLD]: enums_1.ApplicationStatus.ON_HOLD,
            [enums_1.DecisionResult.CAPITAL_QUEUE]: enums_1.ApplicationStatus.CAPITAL_QUEUE,
        };
        const isApproved = [enums_1.DecisionResult.APPROVED_LEVEL1, enums_1.DecisionResult.APPROVED_LEVEL2, enums_1.DecisionResult.APPROVED_LEVEL3]
            .includes(decisionResult);
        let financingTier;
        if (isApproved) {
            const [winningDecision] = await this.dataSource.query(`SELECT financing_tier FROM reviewer_decisions
         WHERE pipeline_run_id = $1 AND decision = 'approved' AND financing_tier IS NOT NULL
         ORDER BY decided_at DESC LIMIT 1`, [ctx.pipelineRunId]);
            financingTier = winningDecision?.financing_tier;
        }
        const targetStatus = statusMap[decisionResult];
        if (targetStatus) {
            await this.applicationsService.transitionStatus(ctx.applicationId, ctx.tenantId, targetStatus, null, `Pipeline decision: ${decisionResult}`, ctx.pipelineRunId, financingTier);
        }
        if (approvedLevel) {
            await this.dataSource.query(`UPDATE applications SET current_financing_level = $3 WHERE id = $1 AND tenant_id = $2`, [ctx.applicationId, ctx.tenantId, approvedLevel]);
        }
        if (isApproved) {
            if (financingTier) {
                const tier = financingTier;
                await this.dataSource.query(`UPDATE applications SET financing_tier = $3 WHERE id = $1 AND tenant_id = $2`, [ctx.applicationId, ctx.tenantId, tier]);
                const tierRank = { bronze: 0, silver: 1, gold: 2, blacklisted: -1 };
                const [student] = await this.dataSource.query(`SELECT membership_status FROM students WHERE id = $1 AND tenant_id = $2`, [ctx.studentId, ctx.tenantId]);
                const currentRank = tierRank[student?.membership_status] ?? -1;
                if (tierRank[tier] > currentRank) {
                    await this.dataSource.query(`UPDATE students SET membership_status = $2 WHERE id = $1`, [ctx.studentId, tier]);
                    await this.dataSource.query(`INSERT INTO membership_status_history
              (student_id, tenant_id, previous_status, new_status, reason)
             VALUES ($1,$2,$3,$4,$5)`, [ctx.studentId, ctx.tenantId, student?.membership_status || null, tier,
                        `Financing approved at ${tier} tier (pipeline run ${ctx.pipelineRunId})`]);
                }
            }
        }
        return {
            status: 'passed',
            outputs: {
                executed: true,
                decisionResult,
                approvedLevel,
                approvedAmount,
                applicationStatus: targetStatus,
            },
            policyVersionIds: [],
        };
    }
    async submitHumanDecision(pipelineRunId, tenantId, reviewerId, decision, approvedAmount, notes, financingTier) {
        const [run] = await this.dataSource.query(`SELECT * FROM pipeline_runs WHERE id = $1 AND tenant_id = $2 AND status = 'active'`, [pipelineRunId, tenantId]);
        if (!run)
            throw new common_1.NotFoundException('Pipeline run not found or not active');
        const [existingVote] = await this.dataSource.query(`SELECT id FROM reviewer_decisions WHERE pipeline_run_id = $1 AND reviewer_id = $2`, [pipelineRunId, reviewerId]);
        if (existingVote) {
            throw new common_1.ConflictException('You have already submitted a decision for this pipeline run');
        }
        const [application] = await this.dataSource.query(`SELECT a.*, s.first_name, s.last_name, fs.aggregate_score
       FROM applications a
       JOIN students s ON s.id = a.student_id
       LEFT JOIN forsa_scores fs ON fs.student_id = a.student_id
       WHERE a.id = $1`, [run.application_id]);
        const [riskProfile] = await this.dataSource.query(`SELECT * FROM risk_profiles WHERE pipeline_run_id = $1`, [pipelineRunId]);
        await this.dataSource.query(`INSERT INTO reviewer_decisions
        (pipeline_run_id, reviewer_id, tenant_id, decision, approved_amount,
         reviewer_snapshot, notes, financing_tier, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`, [
            pipelineRunId, reviewerId, tenantId, decision,
            approvedAmount || null,
            JSON.stringify({ application, riskProfile, decidedAt: new Date() }),
            notes,
            decision === 'approved' ? (financingTier || null) : null,
        ]);
        const [approvalSet] = await this.dataSource.query(`SELECT id, required_approvers FROM multi_approval_sets
       WHERE pipeline_run_id = $1 ORDER BY created_at DESC LIMIT 1`, [pipelineRunId]);
        if (decision === 'approved' && approvalSet && approvalSet.required_approvers > 1) {
            const [{ count }] = await this.dataSource.query(`SELECT COUNT(DISTINCT reviewer_id) AS count FROM reviewer_decisions
         WHERE pipeline_run_id = $1 AND decision = 'approved'`, [pipelineRunId]);
            const approvedSoFar = parseInt(count, 10);
            if (approvedSoFar < approvalSet.required_approvers) {
                await this.dataSource.query(`UPDATE multi_approval_sets SET status = 'partially_approved' WHERE id = $1`, [approvalSet.id]);
                this.logger.log(`Pipeline run ${pipelineRunId}: ${approvedSoFar}/${approvalSet.required_approvers} required approvals — awaiting additional reviewer(s)`);
                return {
                    status: 'awaiting_additional_approver',
                    requiredApprovers: approvalSet.required_approvers,
                    approvedSoFar,
                    message: `This decision requires ${approvalSet.required_approvers} independent approvers. ${approvedSoFar} of ${approvalSet.required_approvers} have approved so far — the pipeline will not proceed until the remaining approver(s) submit their decision.`,
                };
            }
            await this.dataSource.query(`UPDATE multi_approval_sets SET status = 'approved' WHERE id = $1`, [approvalSet.id]);
        }
        else if (approvalSet) {
            await this.dataSource.query(`UPDATE multi_approval_sets SET status = $2 WHERE id = $1`, [approvalSet.id, decision === 'approved' ? 'approved' : decision]);
        }
        return this.startRun(run.application_id, tenantId, reviewerId, 9);
    }
    async findCapitalQueue(tenantId) {
        return this.dataSource.query(`SELECT cq.*, a.tuition_amount, a.is_renewal, a.current_status,
              s.first_name, s.last_name, s.forsa_id, u.name AS university_name
       FROM capital_queue cq
       JOIN applications a ON a.id = cq.application_id
       JOIN students s ON s.id = a.student_id
       LEFT JOIN universities u ON u.id = a.university_id
       WHERE a.tenant_id = $1 AND cq.dequeued_at IS NULL
       ORDER BY cq.priority_score DESC, cq.queued_at ASC`, [tenantId]);
    }
    async findAllFraudRecords(tenantId) {
        return this.dataSource.query(`SELECT fr.*, s.first_name, s.last_name, s.email, s.forsa_id
       FROM fraud_records fr
       LEFT JOIN students s ON s.id = fr.student_id
       WHERE fr.tenant_id = $1
       ORDER BY fr.flagged_at DESC`, [tenantId]);
    }
    async flagFraud(pipelineRunId, tenantId, flaggedBy, reason, evidenceNotes) {
        const [run] = await this.dataSource.query(`SELECT pr.*, a.student_id FROM pipeline_runs pr
       JOIN applications a ON a.id = pr.application_id
       WHERE pr.id = $1 AND pr.tenant_id = $2`, [pipelineRunId, tenantId]);
        if (!run)
            throw new common_1.NotFoundException('Pipeline run not found');
        const [student] = await this.dataSource.query(`SELECT id, email, membership_status FROM students WHERE id = $1 AND tenant_id = $2`, [run.student_id, tenantId]);
        if (!student)
            throw new common_1.NotFoundException('Student not found');
        const identityHash = (0, encryption_util_1.hashToken)((student.email || '').trim().toLowerCase());
        await this.dataSource.transaction(async (manager) => {
            await manager.query(`INSERT INTO fraud_records (tenant_id, student_id, identity_hash, reason, evidence_notes, flagged_by)
         VALUES ($1,$2,$3,$4,$5,$6)`, [tenantId, student.id, identityHash, reason, evidenceNotes || null, flaggedBy]);
            await manager.query(`UPDATE students SET membership_status = 'blacklisted' WHERE id = $1`, [student.id]);
            await manager.query(`INSERT INTO membership_status_history
          (student_id, tenant_id, previous_status, new_status, reason, changed_by)
         VALUES ($1,$2,$3,'blacklisted',$4,$5)`, [student.id, tenantId, student.membership_status, `Fraud confirmed: ${reason}`, flaggedBy]);
            await manager.query(`UPDATE applications SET current_status = $2 WHERE id = $1`, [run.application_id, enums_1.ApplicationStatus.FRAUD_FLAGGED]);
            await manager.query(`INSERT INTO application_status_history (application_id, to_status, changed_by, notes)
         VALUES ($1, $2, $3, $4)`, [run.application_id, enums_1.ApplicationStatus.FRAUD_FLAGGED, flaggedBy, `Fraud confirmed: ${reason}`]);
            await manager.query(`INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
         VALUES ($1,$2,'fraud.flagged','pipeline','students',$3,$4,NOW())`, [tenantId, flaggedBy, student.id, JSON.stringify({ reason, pipelineRunId })]).catch(() => { });
        });
        return { studentId: student.id, membershipStatus: 'blacklisted', applicationStatus: enums_1.ApplicationStatus.FRAUD_FLAGGED };
    }
    async overrideDecision(pipelineRunId, tenantId, ceoUserId, decision, notes, approvedAmount, financingTier) {
        const [run] = await this.dataSource.query(`SELECT * FROM pipeline_runs WHERE id = $1 AND tenant_id = $2 AND status = 'active'`, [pipelineRunId, tenantId]);
        if (!run)
            throw new common_1.NotFoundException('Pipeline run not found or not active');
        const [application] = await this.dataSource.query(`SELECT a.*, s.first_name, s.last_name, fs.aggregate_score
       FROM applications a
       JOIN students s ON s.id = a.student_id
       LEFT JOIN forsa_scores fs ON fs.student_id = a.student_id
       WHERE a.id = $1`, [run.application_id]);
        const [riskProfile] = await this.dataSource.query(`SELECT * FROM risk_profiles WHERE pipeline_run_id = $1`, [pipelineRunId]);
        await this.dataSource.query(`INSERT INTO reviewer_decisions
        (pipeline_run_id, reviewer_id, tenant_id, decision, approved_amount,
         reviewer_snapshot, notes, financing_tier, is_override, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,NOW())`, [
            pipelineRunId, ceoUserId, tenantId, decision, approvedAmount || null,
            JSON.stringify({ application, riskProfile, decidedAt: new Date() }),
            `[CEO OVERRIDE] ${notes}`,
            decision === 'approved' ? (financingTier || null) : null,
        ]);
        const [approvalSet] = await this.dataSource.query(`SELECT id FROM multi_approval_sets WHERE pipeline_run_id = $1 ORDER BY created_at DESC LIMIT 1`, [pipelineRunId]);
        if (approvalSet) {
            await this.dataSource.query(`UPDATE multi_approval_sets SET status = 'overridden' WHERE id = $1`, [approvalSet.id]);
        }
        await this.dataSource.query(`INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
       VALUES ($1,$2,'pipeline.ceo_override','pipeline','applications',$3,$4,NOW())`, [tenantId, ceoUserId, run.application_id, JSON.stringify({ decision, pipelineRunId, notes })]).catch(() => { });
        this.logger.warn(`CEO override on pipeline run ${pipelineRunId} by ${ceoUserId}: ${decision}`);
        return this.startRun(run.application_id, tenantId, ceoUserId, 9);
    }
    renewalPriorityBoost(ctx) {
        return ctx.application?.is_renewal ? 100 : 0;
    }
    async computeDcs(ctx, trace, risk) {
        const policyVersionIds = [];
        const dcsPolicy = await this.policyService.resolve('dcs.weights', { tenantId: ctx.tenantId });
        if (dcsPolicy)
            policyVersionIds.push(dcsPolicy.policyVersionId);
        const weights = dcsPolicy?.value || {
            documentCompleteness: 0.3,
            dataQuality: 0.25,
            riskCertainty: 0.25,
            policyClarity: 0.2,
        };
        const stage1 = trace.find(t => t.stage === 1);
        const docScore = stage1?.status === 'passed' ? 1.0 : 0.5;
        const riskCertainty = risk?.risk_score ? Math.abs(risk.risk_score - 0.5) * 2 : 0.5;
        const policyScore = 0.9;
        const dcsScore = Math.round((docScore * weights.documentCompleteness +
            riskCertainty * weights.riskCertainty +
            policyScore * weights.policyClarity +
            0.8 * weights.dataQuality) * 100);
        return { score: dcsScore, version: 'v1', policyVersionIds };
    }
    buildExplanation(decisionResult, risk, trace) {
        const parts = [];
        parts.push(`Decision: ${decisionResult}`);
        if (risk)
            parts.push(`Risk level: ${risk.risk_level} (score: ${risk.risk_score})`);
        const blockStage = trace.find(t => t.status === 'blocked');
        if (blockStage)
            parts.push(`Blocked at stage ${blockStage.stage}: ${blockStage.outputs.blockReason}`);
        return parts.join(' | ');
    }
    stageName(stage) {
        const names = {
            1: 'Completeness Gate', 2: 'Eligibility Gate', 3: 'University & Partnership Gate',
            4: 'Risk Assessment', 5: 'Policy Evaluation', 6: 'Portfolio & Capital Evaluation',
            7: 'Approval Threshold Evaluation', 8: 'Human Decision',
            9: 'Decision Generation', 10: 'Decision Execution',
        };
        return names[stage] || `Stage ${stage}`;
    }
    extractInputs(ctx, _stage) {
        return {
            applicationId: ctx.applicationId,
            studentId: ctx.studentId,
            universityId: ctx.universityId,
            tuitionAmount: ctx.application.tuition_amount,
            requestedAmount: ctx.application.requested_support_amount,
        };
    }
    async persistStageRecord(pipelineRunId, tenantId, stage, result, trace) {
        await this.dataSource.query(`INSERT INTO pipeline_stage_records
        (pipeline_run_id, tenant_id, stage_number, stage_name, status,
         inputs, outputs, policy_version_ids, duration_ms, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`, [
            pipelineRunId, tenantId, stage, trace.stageName, trace.status,
            JSON.stringify(trace.inputs), JSON.stringify(trace.outputs),
            trace.policyVersionIds, trace.durationMs,
        ]).catch(() => { });
    }
    async getPipelineRun(pipelineRunId, tenantId) {
        const [run] = await this.dataSource.query(`SELECT pr.*, fd.decision_result, fd.approved_level, fd.approved_amount, fd.dcs_score
       FROM pipeline_runs pr
       LEFT JOIN financing_decisions fd ON fd.pipeline_run_id = pr.id
       WHERE pr.id = $1 AND pr.tenant_id = $2`, [pipelineRunId, tenantId]);
        if (!run)
            throw new common_1.NotFoundException('Pipeline run not found');
        const [trace] = await this.dataSource.query(`SELECT full_trace FROM pipeline_execution_traces WHERE pipeline_run_id = $1`, [pipelineRunId]);
        return { ...run, trace: trace?.full_trace ? JSON.parse(trace.full_trace) : [] };
    }
};
exports.PipelineService = PipelineService;
exports.PipelineService = PipelineService = PipelineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        policy_service_1.PolicyService,
        score_service_1.ScoreService,
        applications_service_1.ApplicationsService])
], PipelineService);
//# sourceMappingURL=pipeline.service.js.map