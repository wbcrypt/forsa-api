import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaginationDto } from '../common/utils/pagination.util';
import { NotificationsService } from '../notifications/notifications.service';
export declare class StudentsService {
    private readonly dataSource;
    private readonly configService;
    private readonly notifications;
    private readonly logger;
    constructor(dataSource: DataSource, configService: ConfigService, notifications: NotificationsService);
    create(dto: any, tenantId: string, createdBy: string): Promise<any>;
    findMe(userId: string, tenantId: string): Promise<any>;
    updateMyProfile(userId: string, tenantId: string, dto: any): Promise<any>;
    addMyGuarantor(userId: string, tenantId: string, dto: any): Promise<{
        guarantor: any;
        link: any;
    }>;
    resendMyGuarantorInvite(userId: string, tenantId: string, guarantorId: string): Promise<{
        success: boolean;
    }>;
    findAll(tenantId: string, pagination: PaginationDto, filters?: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOne(id: string, tenantId: string, includePii?: boolean): Promise<any>;
    update(id: string, tenantId: string, dto: any, updatedBy: string): Promise<any>;
    addGuarantor(studentId: string, tenantId: string, dto: any, addedBy: string): Promise<{
        guarantor: any;
        link: any;
    }>;
    private sendGuarantorInviteEmail;
    resendGuarantorInvite(studentId: string, guarantorId: string, tenantId: string, requestedBy: string): Promise<{
        success: boolean;
    }>;
    withdrawGuarantor(studentId: string, guarantorId: string, tenantId: string, reason: string, reasonCode: string, withdrawnBy: string): Promise<void>;
    openExceptionalEvent(studentId: string, tenantId: string, dto: any): Promise<any>;
    getExceptionalEvents(studentId: string, tenantId: string): Promise<any>;
    getApplicationHistory(studentId: string, tenantId: string): Promise<any>;
    getPaymentHistory(studentId: string, tenantId: string): Promise<any>;
    findMyPayments(userId: string, tenantId: string): Promise<any>;
    findMyApplications(userId: string, tenantId: string): Promise<any>;
    private audit;
}
