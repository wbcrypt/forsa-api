import { DataSource } from 'typeorm';
import { ApplicationStatus } from '../common/enums';
import { PaginationDto } from '../common/utils/pagination.util';
import { NotificationsService } from '../notifications/notifications.service';
import { UniversitiesService } from '../universities/universities.service';
export declare class ApplicationsService {
    private readonly dataSource;
    private readonly notifications;
    private readonly universitiesService;
    private readonly logger;
    constructor(dataSource: DataSource, notifications: NotificationsService, universitiesService: UniversitiesService);
    private notifyStudent;
    create(dto: any, tenantId: string, createdBy: string): Promise<any>;
    createForSelf(userId: string, tenantId: string, dto: any): Promise<any>;
    findAllForMyUniversity(userId: string, tenantId: string, pagination: PaginationDto, filters?: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOneForMyUniversity(userId: string, tenantId: string, applicationId: string): Promise<any>;
    getStatusHistoryForMyUniversity(userId: string, tenantId: string, applicationId: string): Promise<any>;
    getStatusHistoryForMe(userId: string, tenantId: string, applicationId: string): Promise<any>;
    findAll(tenantId: string, pagination: PaginationDto, filters?: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOne(id: string, tenantId: string): Promise<any>;
    confirmEnrollment(applicationId: string, tenantId: string, universityUserId: string, notes?: string): Promise<{
        id: string;
        previousStatus: ApplicationStatus;
        newStatus: ApplicationStatus;
    }>;
    transitionStatus(id: string, tenantId: string, newStatus: ApplicationStatus, changedBy: string | null, notes?: string, pipelineRunId?: string, financingTier?: 'silver' | 'gold'): Promise<{
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
