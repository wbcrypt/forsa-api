import { PaymentsService } from './payments.service';
import { KonnectService } from './konnect.service';
export declare class PaymentsController {
    private readonly service;
    private readonly konnect;
    constructor(service: PaymentsService, konnect: KonnectService);
    generateSchedule(body: any, t: string, u: string): Promise<any>;
    getScheduleForApplication(id: string, t: string): Promise<any>;
    getMyScheduleForApplication(id: string, t: string, u: string): Promise<any>;
    getScheduleForMyUniversityApplication(id: string, t: string, u: string): Promise<any>;
    getSchedule(id: string, t: string): Promise<any>;
    recordPayment(body: any, t: string, u: string): Promise<{
        paymentId: any;
        newInstallmentStatus: any;
        amountPaid: number;
    }>;
    getInstallmentPayments(id: string, t: string): Promise<any>;
    reversePayment(id: string, body: {
        reason: string;
    }, t: string, u: string): Promise<{
        paymentId: string;
        status: string;
    }>;
    submitReceipt(body: {
        installmentId: string;
        paymentDate: string;
        amount: number;
        bankName?: string;
        referenceNumber?: string;
        receiptFilename?: string;
        receiptDocumentId?: string;
        notes?: string;
    }, t: string, u: string): Promise<{
        paymentId: any;
        status: string;
    }>;
    listReceipts(status: string, search: string, page: string, limit: string, t: string): Promise<{
        data: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    verifyPayment(id: string, body: {
        status: 'verified' | 'rejected';
        notes?: string;
        reason?: string;
    }, t: string, u: string): Promise<{
        paymentId: string;
        status: string;
        reason: string;
        studentEmail: any;
        studentName: string;
    }> | Promise<{
        paymentId: string;
        status: string;
        newInstallmentStatus: string;
        amountPaid: number;
    }>;
    initiateKonnect(body: {
        installmentId: string;
        paymentReference: string;
        amount: number;
    }, t: string, u: string, email: string, name: string): Promise<{
        payUrl: any;
        paymentRef: any;
        amount: number;
        reference: string;
    }>;
    konnectWebhook(payload: any, sig: string): Promise<{
        received: boolean;
        verified?: undefined;
        installmentId?: undefined;
    } | {
        received: boolean;
        verified: boolean;
        installmentId: any;
    }>;
}
