import {
  Injectable, ConflictException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ExecutionStatus } from '../common/enums';
import { PaymentsService } from '../payments/payments.service';
import { ContractsService } from '../contracts/contracts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ContractType } from '../common/enums';

export interface ExecutionRequest {
  executionId: string; // Globally unique, caller-provided for idempotency
  tenantId: string;
  actionType: string;
  payload: Record<string, unknown>;
  requestedBy: string;
}

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly paymentsService: PaymentsService,
    private readonly contractsService: ContractsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Execute a high-impact action through the DEE.
   * Idempotent: same executionId returns same result without re-executing.
   * Uses transactional outbox for side effects.
   */
  async execute(request: ExecutionRequest): Promise<{
    executionId: string;
    status: ExecutionStatus;
    result?: unknown;
    idempotent?: boolean;
  }> {
    // Idempotency check — look up existing execution
    const [existing] = await this.dataSource.query<any[]>(
      `SELECT id, status, result FROM execution_ledger WHERE execution_id = $1`,
      [request.executionId],
    );

    if (existing) {
      if (existing.status === ExecutionStatus.COMMITTED) {
        return {
          executionId: request.executionId,
          status: ExecutionStatus.COMMITTED,
          result: existing.result,
          idempotent: true,
        };
      }
      if (existing.status === ExecutionStatus.EXECUTING) {
        throw new ConflictException('Execution already in progress for this ID');
      }
    }

    // Create immutable ledger entry (PENDING)
    await this.dataSource.query(
      `INSERT INTO execution_ledger
        (execution_id, tenant_id, action_type, payload, status, requested_by, created_at)
       VALUES ($1,$2,$3,$4,'pending',$5,NOW())
       ON CONFLICT (execution_id) DO NOTHING`,
      [
        request.executionId, request.tenantId, request.actionType,
        JSON.stringify(request.payload), request.requestedBy,
      ],
    );

    // Mark as EXECUTING
    await this.dataSource.query(
      `UPDATE execution_ledger SET status = 'executing', started_at = NOW()
       WHERE execution_id = $1 AND status = 'pending'`,
      [request.executionId],
    );

    let result: unknown;

    try {
      // Execute within a DB transaction
      result = await this.dataSource.transaction(async (manager) => {
        return this.dispatch(request, manager);
      });

      // Mark COMMITTED (immutable — never updated again)
      await this.dataSource.query(
        `UPDATE execution_ledger
         SET status = 'committed', completed_at = NOW(), result = $2
         WHERE execution_id = $1`,
        [request.executionId, JSON.stringify(result)],
      );

      // Process outbox events (side effects outside the transaction)
      await this.processOutbox(request.executionId, request.tenantId);

      return { executionId: request.executionId, status: ExecutionStatus.COMMITTED, result };

    } catch (err) {
      this.logger.error(`Execution failed: ${request.executionId}`, err);

      await this.dataSource.query(
        `UPDATE execution_ledger
         SET status = 'failed', completed_at = NOW(), error_message = $2
         WHERE execution_id = $1`,
        [request.executionId, (err as Error).message],
      ).catch(() => {});

      throw err;
    }
  }

  private async dispatch(request: ExecutionRequest, _manager: any): Promise<unknown> {
    const { actionType, payload, tenantId, requestedBy } = request;

    switch (actionType) {
      case 'contract.generate':
        return this.contractsService.generateContract({
          tenantId,
          applicationId: payload.applicationId as string,
          contractType: payload.contractType as ContractType,
          financingDecisionId: payload.financingDecisionId as string,
          generatedBy: requestedBy,
        });

      case 'contract.send_for_signature':
        return this.contractsService.sendForSignature(
          payload.contractId as string, tenantId, requestedBy,
        );

      case 'payment_schedule.generate':
        return this.paymentsService.generateSchedule({
          tenantId,
          applicationId: payload.applicationId as string,
          contractId: payload.contractId as string,
          generatedBy: requestedBy,
        });

      case 'payment.record':
        return this.paymentsService.recordPayment({
          tenantId,
          installmentId: payload.installmentId as string,
          amount: payload.amount as number,
          currency: payload.currency as string,
          paymentMethod: payload.paymentMethod as string,
          referenceNumber: payload.referenceNumber as string,
          paymentDate: new Date(payload.paymentDate as string),
          receivedBy: requestedBy,
          notes: payload.notes as string,
        });

      case 'payment.reverse':
        return this.paymentsService.reversePayment(
          payload.paymentId as string, tenantId,
          payload.reason as string, requestedBy,
        );

      case 'disbursement.record':
        return this.recordDisbursement(tenantId, payload, requestedBy);

      default:
        throw new BadRequestException(`Unknown action type: ${actionType}`);
    }
  }

  private async recordDisbursement(tenantId: string, payload: any, recordedBy: string) {
    const [disbursement] = await this.dataSource.query<any[]>(
      `INSERT INTO university_disbursements
        (tenant_id, university_id, application_id, amount, currency,
         payment_reference, payment_method, disbursed_at, status, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'disbursed',$9)
       RETURNING *`,
      [
        tenantId, payload.universityId, payload.applicationId,
        payload.amount, payload.currency || 'TND',
        payload.paymentReference, payload.paymentMethod,
        payload.disbursedAt || new Date(), recordedBy,
      ],
    );

    // Queue outbox event for downstream effects
    await this.dataSource.query(
      `INSERT INTO outbox_events
        (tenant_id, event_type, payload, status, created_at)
       VALUES ($1,'disbursement.recorded',$2,'pending',NOW())`,
      [tenantId, JSON.stringify({ disbursementId: disbursement.id, ...payload })],
    );

    return disbursement;
  }

  private async processOutbox(executionId: string, tenantId: string): Promise<void> {
    const events = await this.dataSource.query<any[]>(
      `SELECT * FROM outbox_events WHERE status = 'pending' AND tenant_id = $1
       ORDER BY created_at ASC LIMIT 50`,
      [tenantId],
    );

    for (const event of events) {
      try {
        await this.handleOutboxEvent(event);
        await this.dataSource.query(
          `UPDATE outbox_events SET status = 'processed', processed_at = NOW() WHERE id = $1`,
          [event.id],
        );
      } catch (err) {
        await this.dataSource.query(
          `UPDATE outbox_events SET retry_count = retry_count + 1,
           last_error = $2, status = CASE WHEN retry_count >= 5 THEN 'dead_letter' ELSE 'pending' END
           WHERE id = $1`,
          [event.id, (err as Error).message],
        );
      }
    }
  }

  private async handleOutboxEvent(event: any): Promise<void> {
    // Dispatch to appropriate handler based on event type
    this.logger.debug(`Processing outbox event: ${event.event_type}`);
    // Notifications, webhooks, etc. go here
  }

  async getExecutionHistory(tenantId: string, limit = 50) {
    return this.dataSource.query(
      `SELECT el.execution_id, el.action_type, el.status,
              el.created_at, el.completed_at, el.requested_by,
              u.full_name AS requested_by_name
       FROM execution_ledger el
       LEFT JOIN users u ON u.id = el.requested_by
       WHERE el.tenant_id = $1
       ORDER BY el.created_at DESC
       LIMIT $2`,
      [tenantId, limit],
    );
  }

  // T-222 — forsa-finance's Disbursements page was a placeholder
  // ("managed in the Admin Dashboard"). recordDisbursement() above
  // already writes real university_disbursements rows (via the DEE, on
  // tuition-payment execution) — there was simply no read path for
  // Finance to view that history. University payment *execution* still
  // only happens through the admin portal/DEE, preserving the intended
  // separation; this is read-only.
  async getDisbursements(tenantId: string, limit = 100) {
    return this.dataSource.query(
      `SELECT ud.id, ud.amount, ud.currency, ud.payment_reference,
              ud.payment_method, ud.disbursed_at, ud.status,
              un.name AS university_name,
              s.first_name, s.last_name,
              u.full_name AS recorded_by_name
       FROM university_disbursements ud
       JOIN universities un ON un.id = ud.university_id
       JOIN applications a ON a.id = ud.application_id
       JOIN students s ON s.id = a.student_id
       LEFT JOIN users u ON u.id = ud.recorded_by
       WHERE ud.tenant_id = $1
       ORDER BY ud.disbursed_at DESC
       LIMIT $2`,
      [tenantId, limit],
    );
  }
}
