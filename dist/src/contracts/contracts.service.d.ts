import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ContractType, ContractStatus } from '../common/enums';
import { PolicyService } from '../policy/policy.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class ContractsService {
    private readonly dataSource;
    private readonly configService;
    private readonly policyService;
    private readonly notifications;
    private readonly logger;
    private readonly s3;
    constructor(dataSource: DataSource, configService: ConfigService, policyService: PolicyService, notifications: NotificationsService);
    generateContract(params: {
        tenantId: string;
        applicationId: string;
        contractType: ContractType;
        financingDecisionId: string;
        generatedBy: string;
    }): Promise<any>;
    sendForSignature(contractId: string, tenantId: string, sentBy: string): Promise<{
        contractId: string;
        status: ContractStatus;
    }>;
    recordSignature(params: {
        contractId: string;
        tenantId: string;
        signatoryType: 'student' | 'forsa' | 'university' | 'guarantor';
        signatoryId: string;
        signatureReference: string;
        signedBy: string;
    }): Promise<{
        contractId: string;
        status: ContractStatus;
    }>;
    getContractsForApplication(applicationId: string, tenantId: string): Promise<any>;
    getContractDownloadUrl(contractId: string, tenantId: string, _requestedBy: string): Promise<{
        downloadUrl: string;
        expiresIn: number;
    }>;
    private audit;
}
