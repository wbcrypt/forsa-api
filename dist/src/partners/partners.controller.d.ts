import { PartnersService } from './partners.service';
import { PaginationDto } from '../common/utils/pagination.util';
import { CommissionStatus } from '../common/enums';
export declare class PartnersController {
    private readonly service;
    constructor(service: PartnersService);
    create(dto: any, t: string, u: string): Promise<any>;
    findAll(t: string, p: PaginationDto): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    getCommissions(t: string, p: PaginationDto, f: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    getMe(u: string, t: string): Promise<any>;
    getMyApplications(u: string, t: string, p: PaginationDto): Promise<import("../common/utils/pagination.util").PaginatedResult<any>>;
    getMyDashboard(u: string, t: string): Promise<any>;
    getMyCommissions(u: string, t: string, p: PaginationDto): Promise<import("../common/utils/pagination.util").PaginatedResult<any>>;
    updateMe(u: string, t: string, body: {
        name?: string;
        website?: string;
    }): Promise<any>;
    findOne(id: string, t: string): Promise<any>;
    getDashboard(id: string, t: string): Promise<any>;
    createAgreement(id: string, dto: any, t: string, u: string): Promise<any>;
    advanceCommission(id: string, body: {
        newStatus: CommissionStatus;
    }, t: string, u: string): Promise<any>;
}
