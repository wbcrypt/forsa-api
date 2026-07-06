import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DocumentStatus } from '../common/enums';
import { PolicyService } from '../policy/policy.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class DocumentsService {
    private readonly dataSource;
    private readonly configService;
    private readonly policyService;
    private readonly notifications;
    private readonly logger;
    private readonly s3;
    private readonly bucket;
    private readonly signedUrlExpiry;
    constructor(dataSource: DataSource, configService: ConfigService, policyService: PolicyService, notifications: NotificationsService);
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
    generateMyUploadUrl(callerUserId: string, tenantId: string, params: {
        documentTypeCode: string;
        fileName: string;
        contentType: string;
    }): Promise<{
        uploadUrl: string;
        documentId: string;
        s3Key: string;
        expiresAt: Date;
    }>;
    confirmMyUpload(callerUserId: string, documentId: string, tenantId: string, fileSize: number, checksum?: string): Promise<{
        documentId: string;
        status: DocumentStatus;
    }>;
    confirmUpload(documentId: string, tenantId: string, fileSize: number, checksum?: string): Promise<{
        documentId: string;
        status: DocumentStatus;
    }>;
    generateDownloadUrlForMyUniversity(documentId: string, tenantId: string, callerUserId: string, ipAddress: string): Promise<{
        downloadUrl: string;
        expiresAt: Date;
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
    getDocumentChecklistForMyUniversity(applicationId: string, tenantId: string, callerUserId: string): Promise<{
        documentTypeCode: string;
        required: boolean;
        uploaded: boolean;
        status: any;
        fileName: any;
        uploadedAt: any;
        reviewedAt: any;
    }[]>;
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
