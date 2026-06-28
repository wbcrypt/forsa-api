import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DocumentStatus } from '../common/enums';
import { PolicyService } from '../policy/policy.service';
export declare class DocumentsService {
    private readonly dataSource;
    private readonly configService;
    private readonly policyService;
    private readonly logger;
    private readonly s3;
    private readonly bucket;
    private readonly signedUrlExpiry;
    constructor(dataSource: DataSource, configService: ConfigService, policyService: PolicyService);
    generateUploadUrl(params: {
        tenantId: string;
        entityType: 'application' | 'student' | 'guarantor' | 'contract';
        entityId: string;
        documentTypeCode: string;
        fileName: string;
        contentType: string;
        uploadedBy: string;
    }): Promise<{
        uploadUrl: string;
        documentId: string;
        s3Key: string;
        expiresAt: Date;
    }>;
    confirmUpload(documentId: string, tenantId: string, fileSize: number, checksum?: string): Promise<{
        documentId: string;
        status: DocumentStatus;
    }>;
    generateDownloadUrl(documentId: string, tenantId: string, requestedBy: string, ipAddress: string): Promise<{
        downloadUrl: string;
        expiresAt: Date;
    }>;
    reviewDocument(documentId: string, tenantId: string, action: 'verify' | 'reject', reviewedBy: string, notes?: string, rejectionReason?: string): Promise<{
        documentId: string;
        status: DocumentStatus;
    }>;
    getDocumentsForEntity(entityType: string, entityId: string, tenantId: string): Promise<any>;
    getDocumentChecklist(applicationId: string, tenantId: string): Promise<{
        documentTypeCode: string;
        required: boolean;
        uploaded: boolean;
        status: any;
        fileName: any;
        uploadedAt: any;
        reviewedAt: any;
    }[]>;
    private getExtension;
}
