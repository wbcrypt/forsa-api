import { PipelineService } from './pipeline.service';
export declare class PipelineController {
    private readonly service;
    constructor(service: PipelineService);
    startRun(applicationId: string, body: {
        reentryFromStage?: number;
    }, t: string, u: string): Promise<import("./pipeline.service").PipelineRunResult>;
    getRun(id: string, t: string): Promise<any>;
    submitHumanDecision(id: string, body: {
        decision: 'approved' | 'rejected' | 'on_hold' | 'needs_more_documents';
        approvedAmount?: number;
        notes?: string;
    }, t: string, u: string): Promise<import("./pipeline.service").PipelineRunResult>;
}
