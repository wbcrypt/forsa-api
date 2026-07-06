import { DataSource } from 'typeorm';
import { MembershipStatus, MembershipRequestStatus } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { DigitalPassService } from '../digital-pass/digital-pass.service';
import { CreateMembershipRequestDto } from './dto/create-membership-request.dto';
export declare function generateForsaId(): string;
export declare class MembershipService {
    private readonly dataSource;
    private readonly notifications;
    private readonly digitalPass;
    private readonly logger;
    constructor(dataSource: DataSource, notifications: NotificationsService, digitalPass: DigitalPassService);
    createRequest(dto: CreateMembershipRequestDto): Promise<{
        id: any;
        status: MembershipRequestStatus;
        createdAt: any;
    }>;
    findAll(tenantId: string, status?: string): Promise<any>;
    findOne(id: string, tenantId: string): Promise<any>;
    approve(id: string, tenantId: string, approvedBy: string): Promise<{
        studentId: any;
        membershipStatus: MembershipStatus;
        forsaId: any;
    }>;
    reject(id: string, tenantId: string, rejectedBy: string, reason: string): Promise<{
        id: string;
        status: MembershipRequestStatus;
    }>;
}
