import { ApplicationsService } from './applications.service';
import { PaginationDto } from '../common/utils/pagination.util';
import { ApplicationStatus } from '../common/enums';
import { TransitionStatusDto } from './dto/transition-status.dto';
export declare class ApplicationsController {
    private readonly service;
    constructor(service: ApplicationsService);
    create(dto: any, t: string, u: string): Promise<any>;
    createForSelf(dto: any, t: string, u: string): Promise<any>;
    findAllForMyUniversity(u: string, t: string, p: PaginationDto, f: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOneForMyUniversity(id: string, u: string, t: string): Promise<any>;
    getStatusHistoryForMyUniversity(id: string, u: string, t: string): Promise<any>;
    getStatusHistoryForMe(id: string, u: string, t: string): Promise<any>;
    findAll(t: string, p: PaginationDto, f: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOne(id: string, t: string): Promise<any>;
    getPipelineHistory(id: string, t: string): Promise<any>;
    getStatusHistory(id: string, t: string): Promise<any>;
    transitionStatus(id: string, body: TransitionStatusDto, t: string, u: string): Promise<{
        id: string;
        previousStatus: ApplicationStatus;
        newStatus: ApplicationStatus;
    }>;
    confirmEnrollment(id: string, body: {
        notes?: string;
    }, t: string, u: string): Promise<{
        id: string;
        previousStatus: ApplicationStatus;
        newStatus: ApplicationStatus;
    }>;
    assign(id: string, body: {
        userId: string;
    }, t: string, u: string): Promise<{
        message: string;
    }>;
    submitAppeal(id: string, dto: any, t: string, u: string): Promise<any>;
}
