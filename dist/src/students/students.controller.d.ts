import { StudentsService } from './students.service';
import { PaginationDto } from '../common/utils/pagination.util';
export declare class StudentsController {
    private readonly service;
    constructor(service: StudentsService);
    findMe(u: string, t: string): Promise<any>;
    updateMyProfile(dto: any, u: string, t: string): Promise<any>;
    findMyPayments(u: string, t: string): Promise<any>;
    findMyApplications(u: string, t: string): Promise<any>;
    create(dto: any, t: string, u: string): Promise<any>;
    findAll(t: string, p: PaginationDto, f: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOne(id: string, t: string): Promise<any>;
    findOnePii(id: string, t: string): Promise<any>;
    update(id: string, dto: any, t: string, u: string): Promise<any>;
    getApplicationHistory(id: string, t: string): Promise<any>;
    getPaymentHistory(id: string, t: string): Promise<any>;
    getExceptionalEvents(id: string, t: string): Promise<any>;
    openExceptionalEvent(id: string, dto: any, t: string, u: string): Promise<any>;
    addMyGuarantor(dto: any, t: string, u: string): Promise<{
        guarantor: any;
        link: any;
    }>;
    resendMyGuarantorInvite(guarantorId: string, t: string, u: string): Promise<{
        success: boolean;
    }>;
    addGuarantor(id: string, dto: any, t: string, u: string): Promise<{
        guarantor: any;
        link: any;
    }>;
    resendGuarantorInvite(id: string, guarantorId: string, t: string, u: string): Promise<{
        success: boolean;
    }>;
    withdrawGuarantor(id: string, guarantorId: string, dto: {
        reason: string;
        reasonCode: string;
    }, t: string, u: string): Promise<void>;
}
