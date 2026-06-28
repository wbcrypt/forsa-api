import { DataSource } from 'typeorm';
import { CommissionStatus } from '../common/enums';
import { PaginationDto } from '../common/utils/pagination.util';
import { PolicyService } from '../policy/policy.service';
export declare class PartnersService {
    private readonly dataSource;
    private readonly policyService;
    private readonly logger;
    constructor(dataSource: DataSource, policyService: PolicyService);
    create(dto: any, tenantId: string, createdBy: string): Promise<any>;
    findAll(tenantId: string, pagination: PaginationDto, filters?: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    findOne(id: string, tenantId: string): Promise<any>;
    createAgreement(partnerId: string, tenantId: string, dto: any, createdBy: string): Promise<any>;
    calculateCommission(partnerId: string, applicationId: string, tenantId: string): Promise<{
        grossAmount: number;
        forsaShare: number;
        partnerShare: number;
        commissionBasis: string;
        policyVersionId: string;
    }>;
    createCommissionRecord(partnerId: string, partnAgreementId: string, applicationId: string, studentId: string, tenantId: string, calculation: any, policyVersionId: string): Promise<any>;
    advanceCommissionStatus(commissionId: string, tenantId: string, newStatus: CommissionStatus, approvedBy: string): Promise<any>;
    getCommissions(tenantId: string, filters: any, pagination: PaginationDto): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    getPartnerDashboard(partnerId: string, tenantId: string): Promise<any>;
    private audit;
}
