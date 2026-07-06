import { ExecutionService } from './execution.service';
export declare class ExecutionController {
    private readonly service;
    constructor(service: ExecutionService);
    execute(body: {
        executionId?: string;
        actionType: string;
        payload: any;
    }, t: string, u: string): Promise<{
        executionId: string;
        status: import("../common/enums").ExecutionStatus;
        result?: unknown;
        idempotent?: boolean;
    }>;
    getHistory(t: string, limit: number): Promise<any>;
    getDisbursements(t: string, limit: number): Promise<any>;
}
