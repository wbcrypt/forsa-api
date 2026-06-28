import { DataSource } from 'typeorm';
import { PolicyService } from '../policy/policy.service';
import { ScoreService } from '../score/score.service';
import { PaginationDto } from '../common/utils/pagination.util';
export declare class CollectionsService {
    private readonly dataSource;
    private readonly policyService;
    private readonly scoreService;
    private readonly logger;
    constructor(dataSource: DataSource, policyService: PolicyService, scoreService: ScoreService);
    getDashboard(tenantId: string): Promise<any>;
    getLateInstallments(tenantId: string, pagination: PaginationDto, filters?: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    logContactAttempt(params: {
        tenantId: string;
        installmentId: string;
        studentId: string;
        method: string;
        outcome: string;
        notes: string;
        loggedBy: string;
        nextFollowUpDate?: Date;
    }): Promise<any>;
    getContactHistory(installmentId: string, tenantId: string): Promise<any>;
    getPrioritizedWorklist(tenantId: string, assignedTo?: string): Promise<any>;
}
