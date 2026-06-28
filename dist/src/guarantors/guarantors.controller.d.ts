import { GuarantorsService } from './guarantors.service';
export declare class GuarantorsController {
    private readonly service;
    constructor(service: GuarantorsService);
    getMyStudent(): Promise<{
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
    getMyStudentPayments(): Promise<{
        schedule: any;
        installments: any[];
        application: any;
    }>;
    submitReceipt(body: any): Promise<{
        success: boolean;
        message: string;
    }>;
    initiateKonnect(body: any): Promise<{
        payUrl: any;
        paymentRef: any;
        amount: number;
        reference: string;
    }>;
    getNotifications(): Promise<{
        notifications: any[];
    }>;
}
