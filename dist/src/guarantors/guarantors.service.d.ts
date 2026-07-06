import { DataSource } from 'typeorm';
import { KonnectService } from '../payments/konnect.service';
import { DocumentsService } from '../documents/documents.service';
import { RegisterGuarantorDto } from './dto/register-guarantor.dto';
export declare class GuarantorsService {
    private readonly db;
    private readonly konnect;
    private readonly documents;
    constructor(db: DataSource, konnect: KonnectService, documents: DocumentsService);
    registerSelf(dto: RegisterGuarantorDto): Promise<{
        guarantorId: any;
        userId: any;
        email: any;
    }>;
    private findLinkedStudent;
    getLinkedStudent(userId: string, tenantId: string): Promise<{
        student: {
            id: any;
            first_name: any;
            last_name: any;
            email: any;
        };
        application: {
            id: any;
            current_status: any;
            university_name: any;
            program_name: any;
            tuition_amount: any;
            activation_meeting: any;
            contract: any;
        };
        paymentSchedule: any;
        installments: any[];
    }>;
    getLinkedStudentPayments(userId: string, tenantId: string): Promise<{
        schedule: any;
        installments: any[];
        application: any;
    }>;
    getReceiptUploadUrl(userId: string, tenantId: string, fileName: string, contentType: string): Promise<{
        uploadUrl: string;
        documentId: string;
        s3Key: string;
        expiresAt: Date;
    }>;
    confirmReceiptUpload(userId: string, tenantId: string, documentId: string, fileSize: number, checksum?: string): Promise<{
        documentId: string;
        status: import("../common/enums").DocumentStatus;
    }>;
    private verifyReceiptDocument;
    submitReceiptOnBehalf(userId: string, tenantId: string, body: {
        installmentId: string;
        paymentDate: string;
        amount: number;
        bankName?: string;
        referenceNumber?: string;
        receiptFilename?: string;
        receiptDocumentId?: string;
        notes?: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    initiateKonnectOnBehalf(userId: string, email: string, fullName: string, tenantId: string, body: {
        installmentId: string;
        paymentReference: string;
        amount: number;
    }): Promise<{
        payUrl: any;
        paymentRef: any;
        amount: number;
        reference: string;
    }>;
    getNotifications(userId: string, tenantId: string): Promise<{
        notifications: any[];
    }>;
}
