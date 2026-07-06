import { UniversitiesService } from './universities.service';
import { PaginationDto } from '../common/utils/pagination.util';
export declare class UniversitiesController {
    private readonly service;
    constructor(service: UniversitiesService);
    create(dto: any, t: string, u: string): Promise<any>;
    findAll(t: string, p: PaginationDto, f: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findMe(u: string, t: string): Promise<any>;
    getMyPerformance(u: string, t: string): Promise<any>;
    findAllPublic(tenantId: string): Promise<any>;
    findProgramsPublic(id: string, tenantId: string): Promise<any>;
    findOne(id: string, t: string): Promise<any>;
    update(id: string, dto: any, t: string, u: string): Promise<any>;
    linkUser(id: string, body: {
        userId: string;
    }, t: string, u: string): Promise<{
        id: string;
        userId: string;
    }>;
    getPerformance(id: string, t: string): Promise<any>;
    createProgram(id: string, dto: any, t: string): Promise<any>;
    findPrograms(id: string, t: string): Promise<any>;
    addContact(id: string, dto: any, t: string): Promise<any>;
    createAgreement(id: string, dto: any, t: string, u: string): Promise<any>;
    approveAgreement(id: string, t: string, u: string): Promise<any>;
    initiateBusinessContinuity(id: string, dto: any, t: string, u: string): Promise<{
        affectedStudents: number;
        exceptionalEventIds: string[];
        message: string;
    }>;
}
