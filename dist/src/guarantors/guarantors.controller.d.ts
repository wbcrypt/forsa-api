import { GuarantorsService } from './guarantors.service';
import { RegisterGuarantorDto } from './dto/register-guarantor.dto';
export declare class GuarantorsController {
    private readonly service;
    constructor(service: GuarantorsService);
    registerSelf(dto: RegisterGuarantorDto): Promise<{
        guarantorId: any;
        userId: any;
        email: any;
    }>;
    getMyStudent(userId: string, tenantId: string): Promise<{
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
    getMyStudentPayments(userId: string, tenantId: string): Promise<{
        schedule: any;
        installments: any[];
        application: any;
    }>;
    getReceiptUploadUrl(userId: string, tenantId: string, body: {
        fileName: string;
        contentType: string;
    }): Promise<{
        uploadUrl: string;
        documentId: string;
        s3Key: string;
        expiresAt: Date;
    }>;
    confirmReceiptUpload(userId: string, tenantId: string, body: {
        documentId: string;
        fileSize: number;
        checksum?: string;
    }): Promise<{
        documentId: string;
        status: import("../common/enums").DocumentStatus;
    }>;
    submitReceipt(userId: string, tenantId: string, body: any): Promise<{
        success: boolean;
        message: string;
    }>;
    initiateKonnect(userId: string, tenantId: string, email: string, fullName: string, body: any): Promise<{
        payUrl: any;
        paymentRef: any;
        amount: number;
        reference: string;
    }>;
    getNotifications(userId: string, tenantId: string): Promise<{
        notifications: any[];
    }>;
}
