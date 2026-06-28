import { DataSource } from 'typeorm';
import { ApplicationStatus } from '../common/enums';
import { PaginationDto } from '../common/utils/pagination.util';
export declare class ApplicationsService {
    private readonly dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    create(dto: any, tenantId: string, createdBy: string): Promise<any>;
    findAll(tenantId: string, pagination: PaginationDto, filters?: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOne(id: string, tenantId: string): Promise<any>;
    transitionStatus(id: string, tenantId: string, newStatus: ApplicationStatus, changedBy: string, notes?: string, pipelineRunId?: string): Promise<{
        id: string;
        previousStatus: ApplicationStatus;
        newStatus: ApplicationStatus;
    }>;
    getPipelineHistory(id: string, tenantId: string): Promise<any>;
    getStatusHistory(id: string, tenantId: string): Promise<any>;
    assignTo(id: string, tenantId: string, assignedToUserId: string, assignedBy: string): Promise<{
        message: string;
    }>;
    submitAppeal(id: string, tenantId: string, dto: any, submittedBy: string): Promise<any>;
    private audit;
}
