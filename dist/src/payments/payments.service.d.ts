import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PolicyService } from '../policy/policy.service';
import { ScoreService } from '../score/score.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LedgerService } from './ledger.service';
export declare class PaymentsService {
    private readonly dataSource;
    private readonly policyService;
    private readonly scoreService;
    private readonly configService;
    private readonly notifications;
    private readonly ledger;
    private readonly logger;
    constructor(dataSource: DataSource, policyService: PolicyService, scoreService: ScoreService, configService: ConfigService, notifications: NotificationsService, ledger: LedgerService);
    private notifyStudent;
    generateSchedule(params: {
        tenantId: string;
        applicationId: string;
        contractId: string;
        generatedBy: string;
    }): Promise<any>;
    recordPayment(params: {
        tenantId: string;
        installmentId: string;
        amount: number;
        currency: string;
        paymentMethod: string;
        referenceNumber: string;
        paymentDate: Date;
        receivedBy: string;
        notes?: string;
    }): Promise<{
        paymentId: any;
        newInstallmentStatus: any;
        amountPaid: number;
    }>;
    reversePayment(paymentId: string, tenantId: string, reason: string, reversedBy: string): Promise<{
        paymentId: string;
        status: string;
    }>;
    getSchedule(scheduleId: string, tenantId: string): Promise<any>;
    getScheduleForApplication(applicationId: string, tenantId: string): Promise<any>;
    findMyScheduleForApplication(userId: string, applicationId: string, tenantId: string): Promise<any>;
    findScheduleForMyUniversityApplication(userId: string, applicationId: string, tenantId: string): Promise<any>;
    verifyMyInstallmentOwnership(userId: string, installmentId: string, tenantId: string): Promise<string>;
    getInstallmentPayments(installmentId: string, tenantId: string): Promise<any>;
    updateInstallmentStatuses(): Promise<void>;
    private audit;
    private verifyReceiptDocument;
    submitReceipt(params: {
        tenantId: string;
        installmentId: string;
        callerUserId: string;
        paymentDate: string;
        amount: number;
        bankName?: string;
        referenceNumber?: string;
        receiptFilename?: string;
        receiptDocumentId?: string;
        notes?: string;
    }): Promise<{
        paymentId: any;
        status: string;
    }>;
    listReceipts(params: {
        tenantId: string;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: any[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    verifyPayment(paymentId: string, tenantId: string, verifiedBy: string, notes?: string): Promise<{
        paymentId: string;
        status: string;
        newInstallmentStatus: string;
        amountPaid: number;
    }>;
    rejectPayment(paymentId: string, tenantId: string, rejectedBy: string, reason: string): Promise<{
        paymentId: string;
        status: string;
        reason: string;
        studentEmail: any;
        studentName: string;
    }>;
}
