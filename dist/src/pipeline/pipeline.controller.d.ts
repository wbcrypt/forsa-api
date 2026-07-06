import { PipelineService } from './pipeline.service';
export declare class PipelineController {
    private readonly service;
    constructor(service: PipelineService);
    startRun(applicationId: string, body: {
        reentryFromStage?: number;
    }, t: string, u: string): Promise<import("./pipeline.service").PipelineRunResult>;
    getRun(id: string, t: string): Promise<any>;
    findCapitalQueue(t: string): Promise<any>;
    findAllFraudRecords(t: string): Promise<any>;
    submitHumanDecision(id: string, body: {
        decision: 'approved' | 'rejected' | 'on_hold' | 'needs_more_documents' | 'waiting_list';
        approvedAmount?: number;
        notes?: string;
        financingTier?: 'silver' | 'gold';
    }, t: string, u: string): Promise<import("./pipeline.service").PipelineRunResult | {
        status: string;
        requiredApprovers: any;
        approvedSoFar: number;
        message: string;
    }>;
    flagFraud(id: string, body: {
        reason: string;
        evidenceNotes?: string;
    }, t: string, u: string): Promise<{
        studentId: any;
        membershipStatus: string;
        applicationStatus: import("../common/enums").ApplicationStatus;
    }>;
    overrideDecision(id: string, body: {
        decision: 'approved' | 'rejected';
        approvedAmount?: number;
        notes: string;
        financingTier?: 'silver' | 'gold';
    }, t: string, u: string): Promise<import("./pipeline.service").PipelineRunResult>;
}
