import { MembershipService } from './membership.service';
import { CreateMembershipRequestDto } from './dto/create-membership-request.dto';
import { RejectMembershipRequestDto } from './dto/reject-membership-request.dto';
export declare class MembershipController {
    private readonly service;
    constructor(service: MembershipService);
    create(dto: CreateMembershipRequestDto): Promise<{
        id: any;
        status: import("../common/enums").MembershipRequestStatus;
        createdAt: any;
    }>;
    findAll(t: string, status?: string): Promise<any>;
    findOne(id: string, t: string): Promise<any>;
    approve(id: string, t: string, u: string): Promise<{
        studentId: any;
        membershipStatus: import("../common/enums").MembershipStatus;
        forsaId: any;
    }>;
    reject(id: string, dto: RejectMembershipRequestDto, t: string, u: string): Promise<{
        id: string;
        status: import("../common/enums").MembershipRequestStatus;
    }>;
}
