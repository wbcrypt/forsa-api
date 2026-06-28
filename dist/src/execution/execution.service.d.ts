import { DataSource } from 'typeorm';
import { ExecutionStatus } from '../common/enums';
import { PaymentsService } from '../payments/payments.service';
import { ContractsService } from '../contracts/contracts.service';
import { NotificationsService } from '../notifications/notifications.service';
export interface ExecutionRequest {
    executionId: string;
    tenantId: string;
    actionType: string;
    payload: Record<string, unknown>;
    requestedBy: string;
}
export declare class ExecutionService {
    private readonly dataSource;
    private readonly paymentsService;
    private readonly contractsService;
    private readonly notificationsService;
    private readonly logger;
    constructor(dataSource: DataSource, paymentsService: PaymentsService, contractsService: ContractsService, notificationsService: NotificationsService);
    execute(request: ExecutionRequest): Promise<{
        executionId: string;
        status: ExecutionStatus;
        result?: unknown;
        idempotent?: boolean;
    }>;
    private dispatch;
    private recordDisbursement;
    private processOutbox;
    private handleOutboxEvent;
    getExecutionHistory(tenantId: string, limit?: number): Promise<any>;
}
