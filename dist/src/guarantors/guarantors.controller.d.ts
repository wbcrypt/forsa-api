import { GuarantorsService } from './guarantors.service';
import { AcceptGuarantorInviteDto, DeclineGuarantorInviteDto } from './dto/accept-guarantor-invite.dto';
import { UpdateFinancialProfileDto } from './dto/financial-profile.dto';
export declare class GuarantorsController {
    private readonly service;
    constructor(service: GuarantorsService);
    previewInvite(token: string): Promise<{
        guarantorFirstName: any;
        guarantorLastName: any;
        email: any;
        tenantId: any;
        studentFirstName: any;
        expiresAt: any;
    }>;
    acceptInvite(token: string, dto: AcceptGuarantorInviteDto): Promise<{
        guarantorId: any;
        userId: any;
        email: any;
    }>;
    declineInvite(token: string, dto: DeclineGuarantorInviteDto): Promise<{
        success: boolean;
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
    getMyCaseStatus(userId: string, tenantId: string): Promise<{
        invitationStatus: string;
        profileStatus: string;
        documentsStatus: any;
        meeting: any;
        nextAction: string;
    }>;
    updateMyFinancialProfile(userId: string, tenantId: string, dto: UpdateFinancialProfileDto): Promise<{
        status: string;
    }>;
}
