import { DataSource } from 'typeorm';
import { PaginationDto } from '../common/utils/pagination.util';
export declare class UniversitiesService {
    private readonly dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    create(dto: any, tenantId: string, createdBy: string): Promise<any>;
    findAllPublic(tenantId: string): Promise<any>;
    linkUser(id: string, userId: string, tenantId: string, updatedBy: string): Promise<{
        id: string;
        userId: string;
    }>;
    findMe(userId: string, tenantId: string): Promise<any>;
    findAll(tenantId: string, pagination: PaginationDto, filters?: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOne(id: string, tenantId: string): Promise<any>;
    update(id: string, tenantId: string, dto: any, updatedBy: string): Promise<any>;
    createAgreement(universityId: string, tenantId: string, dto: any, createdBy: string): Promise<any>;
    approveAgreement(agreementId: string, tenantId: string, approvedBy: string): Promise<any>;
    getActiveAgreement(universityId: string, tenantId: string): Promise<any>;
    addContact(universityId: string, tenantId: string, dto: any): Promise<any>;
    getPerformance(universityId: string, tenantId: string): Promise<any>;
    getMyPerformance(userId: string, tenantId: string): Promise<any>;
    createProgram(universityId: string, tenantId: string, dto: any): Promise<any>;
    findPrograms(universityId: string, tenantId: string): Promise<any>;
    findProgramsPublic(universityId: string, tenantId: string): Promise<any>;
    initiateBusinessContinuity(universityId: string, tenantId: string, dto: {
        level: 'institution' | 'faculty' | 'program';
        programId?: string;
        reason: string;
        eventType: string;
    }, initiatedBy: string): Promise<{
        affectedStudents: number;
        exceptionalEventIds: string[];
        message: string;
    }>;
    private auditLog;
}
