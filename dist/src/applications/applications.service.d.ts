import { DataSource } from 'typeorm';
import { ApplicationStatus } from '../common/enums';
import { PaginationDto } from '../common/utils/pagination.util';
import { NotificationsService } from '../notifications/notifications.service';
import { UniversitiesService } from '../universities/universities.service';
import { ScheduleMeetingDto, UpdateMeetingStatusDto } from './dto/meeting.dto';
export declare class ApplicationsService {
    private readonly dataSource;
    private readonly notifications;
    private readonly universitiesService;
    private readonly logger;
    constructor(dataSource: DataSource, notifications: NotificationsService, universitiesService: UniversitiesService);
    private notifyStudent;
    create(dto: any, tenantId: string, createdBy: string): Promise<any>;
    private static readonly REQUIRED_DOCUMENT_TYPES;
    createForSelf(userId: string, tenantId: string, dto: any): Promise<any>;
    findAllForMyUniversity(userId: string, tenantId: string, pagination: PaginationDto, filters?: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOneForMyUniversity(userId: string, tenantId: string, applicationId: string): Promise<any>;
    getStatusHistoryForMyUniversity(userId: string, tenantId: string, applicationId: string): Promise<any>;
    getStatusHistoryForMe(userId: string, tenantId: string, applicationId: string): Promise<any>;
    getMyApplicationTimeline(userId: string, tenantId: string, applicationId: string): Promise<import("./application-stages.util").StudentMilestoneView>;
    private getCurrentMeeting;
    getQueuePositionForMe(userId: string, tenantId: string, applicationId: string): Promise<{
        inQueue: boolean;
        position: any;
        total: any;
    }>;
    findAll(tenantId: string, pagination: PaginationDto, filters?: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOne(id: string, tenantId: string): Promise<any>;
    findOneForAdmin(id: string, tenantId: string): Promise<any>;
    getCaseSummary(id: string, tenantId: string): Promise<{
        application: {
            id: any;
            current_status: any;
            adminStage: any;
            university_id: any;
            university_name: any;
            program_id: any;
            program_name: any;
            tuition_amount: any;
            academic_year: any;
            expected_graduation_date: any;
            financing_tier: any;
            created_at: any;
            requested_tier: any;
            platform_fee_acknowledged_at: any;
            forsa_choice_reason: any;
        };
        student: any;
        guarantor: any;
        documents: any;
        completeness: any;
        aiAnalysis: {
            report: any;
            recommendation: any;
            score: any;
        };
        stabilityScore: {
            overall: any;
            breakdown: any;
            explanation: any;
        };
        meeting: any;
        paymentSchedule: any;
    }>;
    scheduleMeeting(applicationId: string, tenantId: string, dto: ScheduleMeetingDto, createdBy: string): Promise<any>;
    updateMeetingStatus(meetingId: string, tenantId: string, dto: UpdateMeetingStatusDto): Promise<any>;
    private notifyMeeting;
    private getCompleteness;
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
