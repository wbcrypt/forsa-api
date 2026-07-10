import { ApplicationsService } from './applications.service';
import { PaginationDto } from '../common/utils/pagination.util';
import { TransitionStatusDto } from './dto/transition-status.dto';
import { ScheduleMeetingDto, UpdateMeetingStatusDto } from './dto/meeting.dto';
export declare class ApplicationsController {
    private readonly service;
    constructor(service: ApplicationsService);
    create(dto: any, t: string, u: string): Promise<any>;
    createForSelf(dto: any, t: string, u: string): Promise<any>;
    findAllForMyUniversity(u: string, t: string, p: PaginationDto, f: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOneForMyUniversity(id: string, u: string, t: string): Promise<any>;
    getStatusHistoryForMyUniversity(id: string, u: string, t: string): Promise<any>;
    getStatusHistoryForMe(id: string, u: string, t: string): Promise<any>;
    getQueuePositionForMe(id: string, u: string, t: string): Promise<{
        inQueue: boolean;
        position: any;
        total: any;
    }>;
    getMyApplicationTimeline(id: string, u: string, t: string): Promise<import("./application-stages.util").StudentMilestoneView>;
    findAll(t: string, p: PaginationDto, f: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOne(id: string, t: string): Promise<any>;
    getPipelineHistory(id: string, t: string): Promise<any>;
    getStatusHistory(id: string, t: string): Promise<any>;
    getCaseSummary(id: string, t: string): Promise<{
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
    scheduleMeeting(id: string, dto: ScheduleMeetingDto, t: string, u: string): Promise<any>;
    updateMeetingStatus(meetingId: string, dto: UpdateMeetingStatusDto, t: string): Promise<any>;
    transitionStatus(id: string, body: TransitionStatusDto, t: string, u: string): Promise<{
        id: string;
        previousStatus: import("../common/enums").ApplicationStatus;
        newStatus: import("../common/enums").ApplicationStatus;
    }>;
    confirmEnrollment(id: string, body: {
        notes?: string;
    }, t: string, u: string): Promise<{
        id: string;
        previousStatus: import("../common/enums").ApplicationStatus;
        newStatus: import("../common/enums").ApplicationStatus;
    }>;
    assign(id: string, body: {
        userId: string;
    }, t: string, u: string): Promise<{
        message: string;
    }>;
    submitAppeal(id: string, dto: any, t: string, u: string): Promise<any>;
}
