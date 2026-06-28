import { DocumentsService } from './documents.service';
export declare class DocumentsController {
    private readonly service;
    constructor(service: DocumentsService);
    generateUploadUrl(body: any, t: string, u: string): Promise<{
        uploadUrl: string;
        documentId: string;
        s3Key: string;
        expiresAt: Date;
    }>;
    confirmUpload(id: string, body: {
        fileSize: number;
        checksum?: string;
    }, t: string): Promise<{
        documentId: string;
        status: import("../common/enums").DocumentStatus;
    }>;
    getDownloadUrl(id: string, t: string, u: string, ip: string): Promise<{
        downloadUrl: string;
        expiresAt: Date;
    }>;
    reviewDocument(id: string, body: {
        action: 'verify' | 'reject';
        notes?: string;
        rejectionReason?: string;
    }, t: string, u: string): Promise<{
        documentId: string;
        status: import("../common/enums").DocumentStatus;
    }>;
    getForEntity(entityType: string, entityId: string, t: string): Promise<any>;
    getChecklist(applicationId: string, t: string): Promise<{
        documentTypeCode: string;
        required: boolean;
        uploaded: boolean;
        status: any;
        fileName: any;
        uploadedAt: any;
        reviewedAt: any;
    }[]>;
}
