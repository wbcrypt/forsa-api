import { DataSource } from 'typeorm';
import { KonnectService } from '../payments/konnect.service';
export declare class GuarantorsService {
    private readonly db;
    private readonly konnect;
    constructor(db: DataSource, konnect: KonnectService);
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
    submitReceiptOnBehalf(userId: string, tenantId: string, body: {
        installmentId: string;
        paymentDate: string;
        amount: number;
        bankName?: string;
        referenceNumber?: string;
        receiptFilename?: string;
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
