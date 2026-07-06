import { DataSource } from 'typeorm';
import { PolicyService } from '../policy/policy.service';
import { ScoreService } from '../score/score.service';
import { ApplicationsService } from '../applications/applications.service';
import { ApplicationStatus, DecisionResult, PipelineRunStatus } from '../common/enums';
export interface PipelineRunResult {
    pipelineRunId: string;
    applicationId: string;
    runNumber: number;
    status: PipelineRunStatus;
    decisionResult?: DecisionResult;
    approvedLevel?: string;
    approvedAmount?: number;
    requiresHumanReview: boolean;
    blockedAtStage?: number;
    blockReason?: string;
    trace: PipelineStageTrace[];
}
export interface PipelineStageTrace {
    stage: number;
    stageName: string;
    status: 'passed' | 'failed' | 'blocked' | 'needs_review';
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    policyVersionIds: string[];
    durationMs: number;
}
export declare class PipelineService {
    private readonly dataSource;
    private readonly policyService;
    private readonly scoreService;
    private readonly applicationsService;
    private readonly logger;
    constructor(dataSource: DataSource, policyService: PolicyService, scoreService: ScoreService, applicationsService: ApplicationsService);
    startRun(applicationId: string, tenantId: string, triggeredBy: string, reentryFromStage?: number): Promise<PipelineRunResult>;
    private stage1Completeness;
    private stage2Eligibility;
    private stage3UniversityPartnership;
    private stage4RiskAssessment;
    private stage5PolicyEvaluation;
    private stage6PortfolioCapital;
    private stage7ApprovalThreshold;
    private stage8HumanDecision;
    private stage9DecisionGeneration;
    private stage10DecisionExecution;
    submitHumanDecision(pipelineRunId: string, tenantId: string, reviewerId: string, decision: 'approved' | 'rejected' | 'on_hold' | 'needs_more_documents' | 'waiting_list', approvedAmount?: number, notes?: string, financingTier?: 'silver' | 'gold'): Promise<PipelineRunResult | {
        status: string;
        requiredApprovers: any;
        approvedSoFar: number;
        message: string;
    }>;
    findCapitalQueue(tenantId: string): Promise<any>;
    findAllFraudRecords(tenantId: string): Promise<any>;
    flagFraud(pipelineRunId: string, tenantId: string, flaggedBy: string, reason: string, evidenceNotes?: string): Promise<{
        studentId: any;
        membershipStatus: string;
        applicationStatus: ApplicationStatus;
    }>;
    overrideDecision(pipelineRunId: string, tenantId: string, ceoUserId: string, decision: 'approved' | 'rejected', notes: string, approvedAmount?: number, financingTier?: 'silver' | 'gold'): Promise<PipelineRunResult>;
    private renewalPriorityBoost;
    private computeDcs;
    private buildExplanation;
    private stageName;
    private extractInputs;
    private persistStageRecord;
    getPipelineRun(pipelineRunId: string, tenantId: string): Promise<any>;
}
