"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ExecutionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const enums_1 = require("../common/enums");
const payments_service_1 = require("../payments/payments.service");
const contracts_service_1 = require("../contracts/contracts.service");
const notifications_service_1 = require("../notifications/notifications.service");
let ExecutionService = ExecutionService_1 = class ExecutionService {
    constructor(dataSource, paymentsService, contractsService, notificationsService) {
        this.dataSource = dataSource;
        this.paymentsService = paymentsService;
        this.contractsService = contractsService;
        this.notificationsService = notificationsService;
        this.logger = new common_1.Logger(ExecutionService_1.name);
    }
    async execute(request) {
        const [existing] = await this.dataSource.query(`SELECT id, status, result FROM execution_ledger WHERE execution_id = $1`, [request.executionId]);
        if (existing) {
            if (existing.status === enums_1.ExecutionStatus.COMMITTED) {
                return {
                    executionId: request.executionId,
                    status: enums_1.ExecutionStatus.COMMITTED,
                    result: existing.result,
                    idempotent: true,
                };
            }
            if (existing.status === enums_1.ExecutionStatus.EXECUTING) {
                throw new common_1.ConflictException('Execution already in progress for this ID');
            }
        }
        await this.dataSource.query(`INSERT INTO execution_ledger
        (execution_id, tenant_id, action_type, payload, status, requested_by, created_at)
       VALUES ($1,$2,$3,$4,'pending',$5,NOW())
       ON CONFLICT (execution_id) DO NOTHING`, [
            request.executionId, request.tenantId, request.actionType,
            JSON.stringify(request.payload), request.requestedBy,
        ]);
        await this.dataSource.query(`UPDATE execution_ledger SET status = 'executing', started_at = NOW()
       WHERE execution_id = $1 AND status = 'pending'`, [request.executionId]);
        let result;
        try {
            result = await this.dataSource.transaction(async (manager) => {
                return this.dispatch(request, manager);
            });
            await this.dataSource.query(`UPDATE execution_ledger
         SET status = 'committed', completed_at = NOW(), result = $2
         WHERE execution_id = $1`, [request.executionId, JSON.stringify(result)]);
            await this.processOutbox(request.executionId, request.tenantId);
            return { executionId: request.executionId, status: enums_1.ExecutionStatus.COMMITTED, result };
        }
        catch (err) {
            this.logger.error(`Execution failed: ${request.executionId}`, err);
            await this.dataSource.query(`UPDATE execution_ledger
         SET status = 'failed', completed_at = NOW(), error_message = $2
         WHERE execution_id = $1`, [request.executionId, err.message]).catch(() => { });
            throw err;
        }
    }
    async dispatch(request, manager) {
        const { actionType, payload, tenantId, requestedBy } = request;
        switch (actionType) {
            case 'contract.generate':
                return this.contractsService.generateContract({
                    tenantId,
                    applicationId: payload.applicationId,
                    contractType: payload.contractType,
                    financingDecisionId: payload.financingDecisionId,
                    generatedBy: requestedBy,
                });
            case 'contract.send_for_signature':
                return this.contractsService.sendForSignature(payload.contractId, tenantId, requestedBy);
            case 'payment_schedule.generate':
                return this.paymentsService.generateSchedule({
                    tenantId,
                    applicationId: payload.applicationId,
                    contractId: payload.contractId,
                    generatedBy: requestedBy,
                });
            case 'payment.record':
                return this.paymentsService.recordPayment({
                    tenantId,
                    installmentId: payload.installmentId,
                    amount: payload.amount,
                    currency: payload.currency,
                    paymentMethod: payload.paymentMethod,
                    referenceNumber: payload.referenceNumber,
                    paymentDate: new Date(payload.paymentDate),
                    receivedBy: requestedBy,
                    notes: payload.notes,
                });
            case 'payment.reverse':
                return this.paymentsService.reversePayment(payload.paymentId, tenantId, payload.reason, requestedBy);
            case 'disbursement.record':
                return this.recordDisbursement(tenantId, payload, requestedBy);
            default:
                throw new common_1.BadRequestException(`Unknown action type: ${actionType}`);
        }
    }
    async recordDisbursement(tenantId, payload, recordedBy) {
        const [disbursement] = await this.dataSource.query(`INSERT INTO university_disbursements
        (tenant_id, university_id, application_id, amount, currency,
         payment_reference, payment_method, disbursed_at, status, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'disbursed',$9)
       RETURNING *`, [
            tenantId, payload.universityId, payload.applicationId,
            payload.amount, payload.currency || 'TND',
            payload.paymentReference, payload.paymentMethod,
            payload.disbursedAt || new Date(), recordedBy,
        ]);
        await this.dataSource.query(`INSERT INTO outbox_events
        (tenant_id, event_type, payload, status, created_at)
       VALUES ($1,'disbursement.recorded',$2,'pending',NOW())`, [tenantId, JSON.stringify({ disbursementId: disbursement.id, ...payload })]);
        return disbursement;
    }
    async processOutbox(executionId, tenantId) {
        const events = await this.dataSource.query(`SELECT * FROM outbox_events WHERE status = 'pending' AND tenant_id = $1
       ORDER BY created_at ASC LIMIT 50`, [tenantId]);
        for (const event of events) {
            try {
                await this.handleOutboxEvent(event);
                await this.dataSource.query(`UPDATE outbox_events SET status = 'processed', processed_at = NOW() WHERE id = $1`, [event.id]);
            }
            catch (err) {
                await this.dataSource.query(`UPDATE outbox_events SET retry_count = retry_count + 1,
           last_error = $2, status = CASE WHEN retry_count >= 5 THEN 'dead_letter' ELSE 'pending' END
           WHERE id = $1`, [event.id, err.message]);
            }
        }
    }
    async handleOutboxEvent(event) {
        this.logger.debug(`Processing outbox event: ${event.event_type}`);
    }
    async getExecutionHistory(tenantId, limit = 50) {
        return this.dataSource.query(`SELECT el.execution_id, el.action_type, el.status,
              el.created_at, el.completed_at, el.requested_by,
              u.full_name AS requested_by_name
       FROM execution_ledger el
       LEFT JOIN users u ON u.id = el.requested_by
       WHERE el.tenant_id = $1
       ORDER BY el.created_at DESC
       LIMIT $2`, [tenantId, limit]);
    }
    async getDisbursements(tenantId, limit = 100) {
        return this.dataSource.query(`SELECT ud.id, ud.amount, ud.currency, ud.payment_reference,
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
       LIMIT $2`, [tenantId, limit]);
    }
};
exports.ExecutionService = ExecutionService;
exports.ExecutionService = ExecutionService = ExecutionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        payments_service_1.PaymentsService,
        contracts_service_1.ContractsService,
        notifications_service_1.NotificationsService])
], ExecutionService);
//# sourceMappingURL=execution.service.js.map