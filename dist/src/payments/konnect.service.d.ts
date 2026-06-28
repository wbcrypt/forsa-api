import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
export declare class KonnectService {
    private readonly config;
    private readonly dataSource;
    private readonly logger;
    private readonly apiKey;
    private readonly walletId;
    private readonly baseUrl;
    private readonly webhookSecret;
    private readonly appName;
    private readonly returnUrl;
    constructor(config: ConfigService, dataSource: DataSource);
    get isConfigured(): boolean;
    initiatePayment(params: {
        tenantId: string;
        installmentId: string;
        studentId: string;
        studentEmail: string;
        studentName: string;
        amount: number;
        paymentReference: string;
        currency?: string;
    }): Promise<{
        payUrl: any;
        paymentRef: any;
        amount: number;
        reference: string;
    }>;
    processWebhook(payload: any, signature?: string): Promise<{
        received: boolean;
        verified?: undefined;
        installmentId?: undefined;
    } | {
        received: boolean;
        verified: boolean;
        installmentId: any;
    }>;
}
