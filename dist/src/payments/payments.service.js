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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const schedule_1 = require("@nestjs/schedule");
const config_1 = require("@nestjs/config");
const date_fns_1 = require("date-fns");
const decimal_js_1 = __importDefault(require("decimal.js"));
const policy_service_1 = require("../policy/policy.service");
const score_service_1 = require("../score/score.service");
const enums_1 = require("../common/enums");
const notifications_service_1 = require("../notifications/notifications.service");
const ledger_service_1 = require("./ledger.service");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    constructor(dataSource, policyService, scoreService, configService, notifications, ledger) {
        this.dataSource = dataSource;
        this.policyService = policyService;
        this.scoreService = scoreService;
        this.configService = configService;
        this.notifications = notifications;
        this.ledger = ledger;
        this.logger = new common_1.Logger(PaymentsService_1.name);
    }
    async notifyStudent(tenantId, studentId, templateCode, variables, referenceId) {
        const [student] = await this.dataSource.query(`SELECT first_name, last_name, email FROM students WHERE id = $1 AND tenant_id = $2`, [studentId, tenantId]);
        if (!student?.email)
            return;
        await this.notifications.send({
            tenantId,
            recipientId: studentId,
            recipientEmail: student.email,
            channel: enums_1.NotificationChannel.EMAIL,
            templateCode,
            variables: { studentName: `${student.first_name} ${student.last_name}`.trim(), ...variables },
            referenceId,
            referenceType: 'payment',
        }).catch(err => this.logger.error(`Notification ${templateCode} failed`, err));
    }
    async generateSchedule(params) {
        const [application] = await this.dataSource.query(`SELECT a.*, ua.payment_model, ua.id AS agreement_id,
              json_agg(at.*) AS tranches
       FROM applications a
       JOIN university_agreements ua ON ua.university_id = a.university_id
         AND ua.tenant_id = a.tenant_id AND ua.status = 'active'
       LEFT JOIN agreement_tranches at ON at.agreement_id = ua.id
       WHERE a.id = $1 AND a.tenant_id = $2
       GROUP BY a.id, ua.payment_model, ua.id`, [params.applicationId, params.tenantId]);
        if (!application)
            throw new common_1.NotFoundException('Application not found');
        const [decision] = await this.dataSource.query(`SELECT * FROM financing_decisions fd
       JOIN pipeline_runs pr ON pr.id = fd.pipeline_run_id
       WHERE pr.application_id = $1 ORDER BY pr.run_number DESC LIMIT 1`, [params.applicationId]);
        if (!decision)
            throw new common_1.BadRequestException('No tuition facilitation decision found');
        const graceDaysPolicy = await this.policyService.resolve('payment.grace_period_days', { tenantId: params.tenantId });
        const graceDays = graceDaysPolicy?.value || 7;
        const totalAmount = new decimal_js_1.default(decision.approved_amount || application.tuition_amount);
        const paymentModel = application.payment_model;
        let installments = [];
        switch (paymentModel) {
            case 'advance':
                installments = [{
                        dueDate: (0, date_fns_1.addDays)(new Date(), 30),
                        amount: totalAmount,
                        sequence: 1,
                        description: 'Full advance payment',
                    }];
                break;
            case 'concurrent':
                const monthsPolicy = await this.policyService.resolve('payment.concurrent.duration_months', { tenantId: params.tenantId });
                const months = monthsPolicy?.value || 10;
                const monthlyAmount = totalAmount.dividedBy(months).toDecimalPlaces(2);
                const remainder = totalAmount.minus(monthlyAmount.times(months - 1));
                for (let i = 0; i < months; i++) {
                    installments.push({
                        dueDate: (0, date_fns_1.addMonths)(new Date(), i + 1),
                        amount: i === months - 1 ? remainder : monthlyAmount,
                        sequence: i + 1,
                        description: `Monthly installment ${i + 1} of ${months}`,
                    });
                }
                break;
            case 'tranche':
            case 'hybrid':
                const tranches = application.tranches || [];
                for (const tranche of tranches) {
                    const trancheAmount = totalAmount.times(tranche.percentage).dividedBy(100).toDecimalPlaces(2);
                    installments.push({
                        dueDate: (0, date_fns_1.addDays)(new Date(), tranche.due_days_offset || 30),
                        amount: trancheAmount,
                        sequence: tranche.tranche_sequence,
                        description: `Tranche ${tranche.tranche_sequence}: ${tranche.percentage}%`,
                    });
                }
                break;
        }
        const [schedule] = await this.dataSource.query(`INSERT INTO payment_schedules
        (tenant_id, application_id, contract_id, payment_model, total_amount, currency,
         grace_period_days, installment_count, generated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`, [
            params.tenantId, params.applicationId, params.contractId,
            paymentModel, totalAmount.toNumber(), decision.currency || 'TND',
            graceDays, installments.length, params.generatedBy,
        ]);
        for (const inst of installments) {
            await this.dataSource.query(`INSERT INTO installments
          (payment_schedule_id, tenant_id, sequence_number, amount, currency,
           due_date, grace_due_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`, [
                schedule.id, params.tenantId, inst.sequence,
                inst.amount.toNumber(), decision.currency || 'TND',
                (0, date_fns_1.format)(inst.dueDate, 'yyyy-MM-dd'),
                (0, date_fns_1.format)((0, date_fns_1.addDays)(inst.dueDate, graceDays), 'yyyy-MM-dd'),
            ]);
        }
        await this.audit(params.tenantId, params.generatedBy, 'payment_schedule.generated', schedule.id, null, { totalAmount: totalAmount.toNumber(), installments: installments.length });
        return this.getSchedule(schedule.id, params.tenantId);
    }
    async recordPayment(params) {
        const [installment] = await this.dataSource.query(`SELECT i.*, ps.application_id, ps.tenant_id, a.student_id
       FROM installments i
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       JOIN applications a ON a.id = ps.application_id
       WHERE i.id = $1 AND ps.tenant_id = $2`, [params.installmentId, params.tenantId]);
        if (!installment)
            throw new common_1.NotFoundException('Installment not found');
        if (installment.status === 'paid' || installment.status === 'waived') {
            throw new common_1.BadRequestException(`Installment already ${installment.status}`);
        }
        const paymentAmount = new decimal_js_1.default(params.amount);
        const installmentAmount = new decimal_js_1.default(installment.amount);
        const alreadyPaid = new decimal_js_1.default(installment.amount_paid || 0);
        const remaining = installmentAmount.minus(alreadyPaid);
        const [payment] = await this.dataSource.query(`INSERT INTO payments
        (tenant_id, installment_id, student_id, amount, currency,
         payment_method, reference_number, payment_date, status, received_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'confirmed',$9,$10)
       RETURNING id`, [
            params.tenantId, params.installmentId, installment.student_id,
            paymentAmount.toNumber(), params.currency,
            params.paymentMethod, params.referenceNumber,
            (0, date_fns_1.format)(new Date(params.paymentDate), 'yyyy-MM-dd'),
            params.receivedBy, params.notes,
        ]);
        const newPaid = alreadyPaid.plus(paymentAmount);
        const newStatus = newPaid.greaterThanOrEqualTo(installmentAmount) ? 'paid'
            : newPaid.greaterThan(0) ? 'partial' : installment.status;
        const isLate = (0, date_fns_1.isPast)(new Date(installment.grace_due_date));
        await this.dataSource.query(`UPDATE installments
       SET amount_paid = $2, status = $3, paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END
       WHERE id = $1`, [params.installmentId, newPaid.toNumber(), newStatus]);
        await this.ledger.recordEntries(params.tenantId, installment.application_id, payment.id, {
            debitAccount: 'bank', creditAccount: 'student_receivable',
            amount: paymentAmount.toNumber(), currency: params.currency,
            description: `Payment for installment ${installment.sequence_number}`,
        });
        if (newStatus === 'paid') {
            const eventCode = isLate ? 'PAYMENT_LATE' : 'PAYMENT_ON_TIME';
            const points = isLate ? -20 : 15;
            await this.scoreService.recordEvent({
                tenantId: params.tenantId,
                studentId: installment.student_id,
                dimension: enums_1.ScoreDimension.PAYMENT_RELIABILITY,
                eventCode,
                points,
                sourceType: enums_1.SourceTrustLevel.SYSTEM_VERIFIED,
                sourceId: params.receivedBy,
                description: `Installment ${installment.sequence_number} ${isLate ? 'paid late' : 'paid on time'}`,
                referenceId: payment.id,
                referenceType: 'payment',
                recordedBy: params.receivedBy,
            });
        }
        await this.audit(params.tenantId, params.receivedBy, 'payment.recorded', payment.id, null, { amount: params.amount, installmentId: params.installmentId });
        if (newStatus === 'paid') {
            await this.notifyStudent(params.tenantId, installment.student_id, 'payment_confirmed', {
                amount: paymentAmount.toNumber(), currency: params.currency, paymentReference: params.referenceNumber,
            }, payment.id);
        }
        return { paymentId: payment.id, newInstallmentStatus: newStatus, amountPaid: newPaid.toNumber() };
    }
    async reversePayment(paymentId, tenantId, reason, reversedBy) {
        const [payment] = await this.dataSource.query(`SELECT p.*, i.payment_schedule_id
       FROM payments p
       JOIN installments i ON i.id = p.installment_id
       WHERE p.id = $1 AND p.tenant_id = $2 AND p.status IN ('confirmed', 'verified')`, [paymentId, tenantId]);
        if (!payment)
            throw new common_1.NotFoundException('Payment not found or not reversible');
        await this.dataSource.query(`UPDATE payments SET status = 'reversed', reversed_at = NOW(),
       reversed_by = $2, reversal_reason = $3 WHERE id = $1`, [paymentId, reversedBy, reason]);
        await this.dataSource.query(`UPDATE installments
       SET amount_paid = GREATEST(0, amount_paid - $2),
           status = 'pending', paid_at = NULL
       WHERE id = $1`, [payment.installment_id, payment.amount]);
        await this.ledger.recordEntries(tenantId, null, payment.id, {
            debitAccount: 'student_receivable', creditAccount: 'bank',
            amount: parseFloat(payment.amount), currency: payment.currency,
            description: `Reversal of payment ${paymentId}: ${reason}`,
        });
        await this.audit(tenantId, reversedBy, 'payment.reversed', paymentId, { status: payment.status }, { status: 'reversed', reason });
        return { paymentId, status: 'reversed' };
    }
    async getSchedule(scheduleId, tenantId) {
        const [schedule] = await this.dataSource.query(`SELECT ps.*,
              json_agg(i.* ORDER BY i.sequence_number) AS installments
       FROM payment_schedules ps
       JOIN installments i ON i.payment_schedule_id = ps.id
       WHERE ps.id = $1 AND ps.tenant_id = $2
       GROUP BY ps.id`, [scheduleId, tenantId]);
        if (!schedule)
            throw new common_1.NotFoundException('Payment schedule not found');
        return schedule;
    }
    async getScheduleForApplication(applicationId, tenantId) {
        const [schedule] = await this.dataSource.query(`SELECT ps.*,
              json_agg(json_build_object(
                'id', i.id, 'sequence', i.sequence_number, 'amount', i.amount,
                'dueDate', i.due_date, 'graceDueDate', i.grace_due_date,
                'status', i.status, 'amountPaid', i.amount_paid,
                'payments', (SELECT json_agg(p.*) FROM payments p WHERE p.installment_id = i.id)
              ) ORDER BY i.sequence_number) AS installments
       FROM payment_schedules ps
       JOIN installments i ON i.payment_schedule_id = ps.id
       WHERE ps.application_id = $1 AND ps.tenant_id = $2
       GROUP BY ps.id`, [applicationId, tenantId]);
        return schedule || null;
    }
    async findMyScheduleForApplication(userId, applicationId, tenantId) {
        const [owned] = await this.dataSource.query(`SELECT a.id FROM applications a
       JOIN students s ON s.id = a.student_id
       WHERE a.id = $1 AND a.tenant_id = $2 AND s.user_id = $3`, [applicationId, tenantId, userId]);
        if (!owned)
            throw new common_1.NotFoundException('Application not found');
        return this.getScheduleForApplication(applicationId, tenantId);
    }
    async findScheduleForMyUniversityApplication(userId, applicationId, tenantId) {
        const [owned] = await this.dataSource.query(`SELECT a.id FROM applications a
       JOIN universities uni ON uni.id = a.university_id
       WHERE a.id = $1 AND a.tenant_id = $2 AND uni.user_id = $3`, [applicationId, tenantId, userId]);
        if (!owned)
            throw new common_1.NotFoundException('Application not found');
        return this.getScheduleForApplication(applicationId, tenantId);
    }
    async verifyMyInstallmentOwnership(userId, installmentId, tenantId) {
        const [row] = await this.dataSource.query(`SELECT s.id AS student_id
       FROM installments i
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       JOIN applications a ON a.id = ps.application_id
       JOIN students s ON s.id = a.student_id
       WHERE i.id = $1 AND ps.tenant_id = $2 AND s.user_id = $3`, [installmentId, tenantId, userId]);
        if (!row)
            throw new common_1.NotFoundException('Installment not found');
        return row.student_id;
    }
    async getInstallmentPayments(installmentId, tenantId) {
        return this.dataSource.query(`SELECT p.*, u.full_name AS received_by_name
       FROM payments p
       LEFT JOIN users u ON u.id = p.received_by
       JOIN installments i ON i.id = p.installment_id
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       WHERE p.installment_id = $1 AND ps.tenant_id = $2
       ORDER BY p.created_at DESC`, [installmentId, tenantId]);
    }
    async updateInstallmentStatuses() {
        this.logger.log('Running daily installment status update');
        const dueSoonInstallments = await this.dataSource.query(`UPDATE installments
       SET status = 'due_soon'
       WHERE status = 'pending'
         AND due_date <= CURRENT_DATE + INTERVAL '7 days'
         AND due_date > CURRENT_DATE
       RETURNING id, payment_schedule_id, amount, due_date`);
        for (const inst of dueSoonInstallments) {
            const [ps] = await this.dataSource.query(`SELECT ps.tenant_id, a.student_id FROM payment_schedules ps
         JOIN applications a ON a.id = ps.application_id
         WHERE ps.id = $1`, [inst.payment_schedule_id]);
            if (ps) {
                const daysUntilDue = Math.max(0, Math.ceil((new Date(inst.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                await this.notifyStudent(ps.tenant_id, ps.student_id, 'payment_due_soon', {
                    amount: inst.amount, currency: 'TND', dueDate: (0, date_fns_1.format)(new Date(inst.due_date), 'yyyy-MM-dd'), daysUntilDue,
                }, inst.id);
            }
        }
        await this.dataSource.query(`UPDATE installments
       SET status = 'due_today'
       WHERE status IN ('pending','due_soon')
         AND due_date = CURRENT_DATE`);
        const lateInstallments = await this.dataSource.query(`UPDATE installments
       SET status = 'late'
       WHERE status IN ('pending','due_soon','due_today','partial')
         AND grace_due_date < CURRENT_DATE
         AND amount_paid < amount
       RETURNING id, payment_schedule_id, amount, due_date`);
        for (const inst of lateInstallments) {
            const [ps] = await this.dataSource.query(`SELECT ps.tenant_id, a.student_id FROM payment_schedules ps
         JOIN applications a ON a.id = ps.application_id
         WHERE ps.id = $1`, [inst.payment_schedule_id]);
            if (ps) {
                await this.scoreService.recordEvent({
                    tenantId: ps.tenant_id,
                    studentId: ps.student_id,
                    dimension: enums_1.ScoreDimension.PAYMENT_RELIABILITY,
                    eventCode: 'PAYMENT_OVERDUE',
                    points: -30,
                    sourceType: enums_1.SourceTrustLevel.SYSTEM_VERIFIED,
                    sourceId: 'system',
                    description: 'Payment overdue — grace period passed',
                    referenceId: inst.id,
                    referenceType: 'installment',
                    recordedBy: null,
                }).catch(err => this.logger.error('Score event failed for overdue installment', err));
                await this.notifyStudent(ps.tenant_id, ps.student_id, 'payment_overdue', {
                    amount: inst.amount, currency: 'TND', dueDate: (0, date_fns_1.format)(new Date(inst.due_date), 'yyyy-MM-dd'),
                }, inst.id);
            }
        }
        await this.dataSource.query(`UPDATE installments
       SET status = 'default_risk'
       WHERE status = 'late'
         AND grace_due_date < CURRENT_DATE - INTERVAL '30 days'`);
    }
    async audit(tenantId, userId, action, targetId, prev, next) {
        await this.dataSource.query(`INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, previous_value, new_value, created_at)
       VALUES ($1,$2,$3,'payments','payments',$4,$5,$6,NOW())`, [tenantId, userId, action, targetId,
            prev ? JSON.stringify(prev) : null, next ? JSON.stringify(next) : null]).catch(err => this.logger.error('Audit log failed', err));
    }
    async verifyReceiptDocument(receiptDocumentId, tenantId, studentId) {
        if (!receiptDocumentId)
            return null;
        const [doc] = await this.dataSource.query(`SELECT id FROM documents
       WHERE id = $1 AND tenant_id = $2 AND entity_type = 'student' AND entity_id = $3
         AND status = 'uploaded'`, [receiptDocumentId, tenantId, studentId]);
        if (!doc) {
            throw new common_1.BadRequestException('receiptDocumentId does not reference a completed upload for this student');
        }
        return doc.id;
    }
    async submitReceipt(params) {
        const [installment] = await this.dataSource.query(`SELECT i.*, ps.application_id, ps.tenant_id, a.student_id
       FROM installments i
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       JOIN applications a ON a.id = ps.application_id
       WHERE i.id = $1 AND ps.tenant_id = $2`, [params.installmentId, params.tenantId]);
        if (!installment)
            throw new common_1.NotFoundException('Installment not found');
        const [callerStudent] = await this.dataSource.query(`SELECT id FROM students WHERE user_id = $1 AND tenant_id = $2`, [params.callerUserId, params.tenantId]);
        if (!callerStudent || callerStudent.id !== installment.student_id) {
            throw new common_1.NotFoundException('Installment not found');
        }
        if (installment.status === 'paid' || installment.status === 'waived') {
            throw new common_1.BadRequestException(`Installment is already ${installment.status}`);
        }
        const receiptDocumentId = await this.verifyReceiptDocument(params.receiptDocumentId, params.tenantId, installment.student_id);
        const [existing] = await this.dataSource.query(`SELECT id FROM payments
       WHERE installment_id = $1 AND tenant_id = $2
         AND status IN ('receipt_uploaded','pending_verification')
       LIMIT 1`, [params.installmentId, params.tenantId]);
        if (existing) {
            await this.dataSource.query(`UPDATE payments
         SET receipt_filename = $2, receipt_document_id = $3, bank_name = $4,
             student_bank_ref = $5, student_amount = $6, payment_date = $7, notes = $8,
             receipt_uploaded_at = NOW(), status = 'receipt_uploaded'
         WHERE id = $1`, [existing.id, params.receiptFilename, receiptDocumentId, params.bankName,
                params.referenceNumber, params.amount,
                params.paymentDate, params.notes]);
            return { paymentId: existing.id, status: 'receipt_uploaded' };
        }
        const [payment] = await this.dataSource.query(`INSERT INTO payments
        (tenant_id, installment_id, student_id, amount, currency,
         payment_method, reference_number, payment_date, status,
         bank_name, student_bank_ref, student_amount,
         receipt_filename, receipt_document_id, receipt_uploaded_at, notes)
       VALUES ($1,$2,$3,$4,'TND','bank_transfer',$5,$6,'receipt_uploaded',
               $7,$5,$4,$8,$9,NOW(),$10)
       RETURNING id`, [
            params.tenantId, params.installmentId, installment.student_id,
            params.amount, params.referenceNumber,
            (0, date_fns_1.format)(new Date(params.paymentDate), 'yyyy-MM-dd'),
            params.bankName, params.receiptFilename, receiptDocumentId, params.notes,
        ]);
        this.logger.log(`Receipt submitted for installment ${params.installmentId} — awaiting admin verification`);
        return { paymentId: payment.id, status: 'receipt_uploaded' };
    }
    async listReceipts(params) {
        const page = params.page || 1;
        const limit = Math.min(params.limit || 20, 100);
        const offset = (page - 1) * limit;
        const ALLOWED_STATUSES = ['receipt_uploaded', 'pending_verification', 'verified', 'rejected', 'confirmed', 'reversed'];
        const statusParam = params.status && params.status !== 'all' && ALLOWED_STATUSES.includes(params.status)
            ? params.status : null;
        const queryParams = [params.tenantId];
        let paramIdx = 2;
        let statusClause = `AND p.status IN ('receipt_uploaded','pending_verification','verified','rejected')`;
        if (statusParam) {
            statusClause = `AND p.status = $${paramIdx++}`;
            queryParams.push(statusParam);
        }
        let searchClause = '';
        if (params.search && params.search.trim()) {
            searchClause = `AND (s.first_name ILIKE $${paramIdx} OR s.last_name ILIKE $${paramIdx} OR s.email ILIKE $${paramIdx})`;
            queryParams.push(`%${params.search.trim()}%`);
            paramIdx++;
        }
        queryParams.push(limit, offset);
        const limitIdx = paramIdx++;
        const offsetIdx = paramIdx;
        const rows = await this.dataSource.query(`SELECT
         p.id, p.status, p.amount, p.currency, p.payment_date,
         p.bank_name, p.student_bank_ref AS reference_number,
         p.student_amount, p.receipt_filename, p.receipt_document_id,
         p.receipt_uploaded_at, p.verified_at, p.verification_notes,
         p.rejection_reason, p.notes,
         p.payment_method,
         s.first_name AS student_first_name, s.last_name AS student_last_name,
         s.email AS student_email,
         i.sequence_number, i.amount AS installment_amount, i.due_date,
         a.id AS application_id,
         u_v.full_name AS verified_by_name
       FROM payments p
       JOIN installments i ON i.id = p.installment_id
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       JOIN applications a ON a.id = ps.application_id
       JOIN students s ON s.id = p.student_id
       LEFT JOIN users u_v ON u_v.id = p.verified_by
       WHERE p.tenant_id = $1
         ${statusClause}
         ${searchClause}
       ORDER BY
         CASE p.status WHEN 'receipt_uploaded' THEN 0 WHEN 'pending_verification' THEN 1 ELSE 2 END,
         p.receipt_uploaded_at DESC NULLS LAST,
         p.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`, queryParams);
        const countParams = [params.tenantId];
        let cIdx = 2;
        let cStatusClause = `AND p.status IN ('receipt_uploaded','pending_verification','verified','rejected')`;
        if (statusParam) {
            cStatusClause = `AND p.status = $${cIdx++}`;
            countParams.push(statusParam);
        }
        let cSearchClause = '';
        if (params.search?.trim()) {
            cSearchClause = `AND (s.first_name ILIKE $${cIdx} OR s.last_name ILIKE $${cIdx} OR s.email ILIKE $${cIdx})`;
            countParams.push(`%${params.search.trim()}%`);
        }
        const [{ count }] = await this.dataSource.query(`SELECT COUNT(*) FROM payments p JOIN students s ON s.id = p.student_id WHERE p.tenant_id = $1 ${cStatusClause} ${cSearchClause}`, countParams);
        return {
            data: rows,
            meta: {
                total: parseInt(count, 10),
                page,
                limit,
                totalPages: Math.ceil(parseInt(count, 10) / limit),
            },
        };
    }
    async verifyPayment(paymentId, tenantId, verifiedBy, notes) {
        const [payment] = await this.dataSource.query(`SELECT p.*, i.amount AS installment_amount, i.amount_paid,
              i.sequence_number, i.grace_due_date,
              ps.application_id, ps.tenant_id AS sched_tenant,
              a.student_id
       FROM payments p
       JOIN installments i ON i.id = p.installment_id
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       JOIN applications a ON a.id = ps.application_id
       WHERE p.id = $1 AND p.tenant_id = $2`, [paymentId, tenantId]);
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        if (payment.status === 'verified') {
            throw new common_1.BadRequestException('Payment already verified');
        }
        if (payment.status === 'reversed') {
            throw new common_1.BadRequestException('Cannot verify a reversed payment');
        }
        await this.dataSource.query(`UPDATE payments
       SET status = 'verified',
           verified_at = NOW(),
           verified_by = $2,
           verification_notes = $3,
           amount = COALESCE(student_amount, amount)
       WHERE id = $1`, [paymentId, verifiedBy, notes || null]);
        const verifiedAmount = new decimal_js_1.default(payment.student_amount || payment.amount);
        const installmentAmount = new decimal_js_1.default(payment.installment_amount);
        const alreadyPaid = new decimal_js_1.default(payment.amount_paid || 0);
        const newPaid = alreadyPaid.plus(verifiedAmount);
        const newInstallmentStatus = newPaid.greaterThanOrEqualTo(installmentAmount)
            ? 'paid'
            : newPaid.greaterThan(0) ? 'partial' : 'pending';
        await this.dataSource.query(`UPDATE installments
       SET amount_paid = $2,
           status = $3,
           paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END
       WHERE id = $1`, [payment.installment_id, newPaid.toNumber(), newInstallmentStatus]);
        await this.ledger.recordEntries(tenantId, payment.application_id, paymentId, {
            debitAccount: 'bank',
            creditAccount: 'student_receivable',
            amount: verifiedAmount.toNumber(),
            currency: payment.currency || 'TND',
            description: `Verified payment for installment #${payment.sequence_number}`,
        });
        if (newInstallmentStatus === 'paid') {
            const isLate = payment.grace_due_date && (0, date_fns_1.isPast)(new Date(payment.grace_due_date));
            await this.scoreService.recordEvent({
                tenantId,
                studentId: payment.student_id,
                dimension: enums_1.ScoreDimension.PAYMENT_RELIABILITY,
                eventCode: isLate ? 'PAYMENT_LATE' : 'PAYMENT_ON_TIME',
                points: isLate ? -20 : 15,
                sourceType: enums_1.SourceTrustLevel.SYSTEM_VERIFIED,
                sourceId: verifiedBy,
                description: `Installment #${payment.sequence_number} ${isLate ? 'paid late' : 'paid on time'} — verified by admin`,
                referenceId: paymentId,
                referenceType: 'payment',
                recordedBy: verifiedBy,
            });
        }
        await this.audit(tenantId, verifiedBy, 'payment.verified', paymentId, { status: payment.status }, { status: 'verified', notes, newInstallmentStatus });
        if (newInstallmentStatus === 'paid') {
            await this.notifyStudent(tenantId, payment.student_id, 'payment_confirmed', {
                amount: verifiedAmount.toNumber(), currency: payment.currency || 'TND', paymentReference: payment.reference_number || paymentId,
            }, paymentId);
        }
        this.logger.log(`Payment ${paymentId} verified by ${verifiedBy} — installment now ${newInstallmentStatus}`);
        return {
            paymentId,
            status: 'verified',
            newInstallmentStatus,
            amountPaid: newPaid.toNumber(),
        };
    }
    async rejectPayment(paymentId, tenantId, rejectedBy, reason) {
        if (!reason?.trim()) {
            throw new common_1.BadRequestException('Rejection reason is required');
        }
        const [payment] = await this.dataSource.query(`SELECT p.*, s.first_name, s.last_name, s.email, i.sequence_number
       FROM payments p
       JOIN students s ON s.id = p.student_id
       JOIN installments i ON i.id = p.installment_id
       WHERE p.id = $1 AND p.tenant_id = $2`, [paymentId, tenantId]);
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        if (payment.status === 'verified') {
            throw new common_1.BadRequestException('Cannot reject an already verified payment');
        }
        if (payment.status === 'reversed') {
            throw new common_1.BadRequestException('Cannot reject a reversed payment');
        }
        await this.dataSource.query(`UPDATE payments
       SET status = 'rejected',
           rejection_reason = $2,
           verified_by = $3,
           verified_at = NOW()
       WHERE id = $1`, [paymentId, reason.trim(), rejectedBy]);
        await this.audit(tenantId, rejectedBy, 'payment.rejected', paymentId, { status: payment.status }, { status: 'rejected', reason });
        this.logger.log(`Payment ${paymentId} rejected by ${rejectedBy}: ${reason}`);
        return {
            paymentId,
            status: 'rejected',
            reason,
            studentEmail: payment.email,
            studentName: `${payment.first_name} ${payment.last_name}`,
        };
    }
};
exports.PaymentsService = PaymentsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_6AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PaymentsService.prototype, "updateInstallmentStatuses", null);
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        policy_service_1.PolicyService,
        score_service_1.ScoreService,
        config_1.ConfigService,
        notifications_service_1.NotificationsService,
        ledger_service_1.LedgerService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map