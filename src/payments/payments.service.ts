import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { addDays, addMonths, format, isPast } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import { PolicyService } from '../policy/policy.service';
import { ScoreService } from '../score/score.service';
import { InstallmentStatus, PaymentStatus, ScoreDimension, SourceTrustLevel, NotificationChannel } from '../common/enums';
import { PaginationDto, paginate, getSkip } from '../common/utils/pagination.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policyService: PolicyService,
    private readonly scoreService: ScoreService,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  // T-106 — fire-and-forget email notification, same pattern as
  // ApplicationsService.notifyStudent. Never throws: a notification going
  // down must not break the payment transaction that triggered it.
  private async notifyStudent(
    tenantId: string,
    studentId: string,
    templateCode: string,
    variables: Record<string, unknown>,
    referenceId?: string,
  ): Promise<void> {
    const [student] = await this.dataSource.query<any[]>(
      `SELECT first_name, last_name, email FROM students WHERE id = $1 AND tenant_id = $2`,
      [studentId, tenantId],
    );
    if (!student?.email) return;

    await this.notifications.send({
      tenantId,
      recipientId: studentId,
      recipientEmail: student.email,
      channel: NotificationChannel.EMAIL,
      templateCode,
      variables: { studentName: `${student.first_name} ${student.last_name}`.trim(), ...variables },
      referenceId,
      referenceType: 'payment',
    }).catch(err => this.logger.error(`Notification ${templateCode} failed`, err));
  }

  /**
   * Generate payment schedule from a contract + university agreement.
   * All amounts, periods, and grace days come from policy/agreement — nothing hardcoded.
   */
  async generateSchedule(params: {
    tenantId: string;
    applicationId: string;
    contractId: string;
    generatedBy: string;
  }) {
    const [application] = await this.dataSource.query<any[]>(
      `SELECT a.*, ua.payment_model, ua.id AS agreement_id,
              json_agg(at.*) AS tranches
       FROM applications a
       JOIN university_agreements ua ON ua.university_id = a.university_id
         AND ua.tenant_id = a.tenant_id AND ua.status = 'active'
       LEFT JOIN agreement_tranches at ON at.agreement_id = ua.id
       WHERE a.id = $1 AND a.tenant_id = $2
       GROUP BY a.id, ua.payment_model, ua.id`,
      [params.applicationId, params.tenantId],
    );
    if (!application) throw new NotFoundException('Application not found');

    const [decision] = await this.dataSource.query<any[]>(
      `SELECT * FROM financing_decisions fd
       JOIN pipeline_runs pr ON pr.id = fd.pipeline_run_id
       WHERE pr.application_id = $1 ORDER BY pr.run_number DESC LIMIT 1`,
      [params.applicationId],
    );

    if (!decision) throw new BadRequestException('No financing decision found');

    // Get payment policy parameters
    const graceDaysPolicy = await this.policyService.resolve(
      'payment.grace_period_days', { tenantId: params.tenantId },
    );
    const graceDays = (graceDaysPolicy?.value as number) || 7;

    // All amounts via Decimal for precision
    const totalAmount = new Decimal(decision.approved_amount || application.tuition_amount);
    const paymentModel = application.payment_model;

    let installments: { dueDate: Date; amount: Decimal; sequence: number; description: string }[] = [];

    switch (paymentModel) {
      case 'advance':
        // Full amount due 30 days from now
        installments = [{
          dueDate: addDays(new Date(), 30),
          amount: totalAmount,
          sequence: 1,
          description: 'Full advance payment',
        }];
        break;

      case 'concurrent':
        // Monthly installments — number from policy
        const monthsPolicy = await this.policyService.resolve(
          'payment.concurrent.duration_months', { tenantId: params.tenantId },
        );
        const months = (monthsPolicy?.value as number) || 10;
        const monthlyAmount = totalAmount.dividedBy(months).toDecimalPlaces(2);
        const remainder = totalAmount.minus(monthlyAmount.times(months - 1));

        for (let i = 0; i < months; i++) {
          installments.push({
            dueDate: addMonths(new Date(), i + 1),
            amount: i === months - 1 ? remainder : monthlyAmount,
            sequence: i + 1,
            description: `Monthly installment ${i + 1} of ${months}`,
          });
        }
        break;

      case 'tranche':
      case 'hybrid':
        // Tranches defined in agreement
        const tranches = application.tranches || [];
        for (const tranche of tranches) {
          const trancheAmount = totalAmount.times(tranche.percentage).dividedBy(100).toDecimalPlaces(2);
          installments.push({
            dueDate: addDays(new Date(), tranche.due_days_offset || 30),
            amount: trancheAmount,
            sequence: tranche.tranche_sequence,
            description: `Tranche ${tranche.tranche_sequence}: ${tranche.percentage}%`,
          });
        }
        break;
    }

    // Create payment schedule record
    const [schedule] = await this.dataSource.query<any[]>(
      `INSERT INTO payment_schedules
        (tenant_id, application_id, contract_id, payment_model, total_amount, currency,
         grace_period_days, installment_count, generated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        params.tenantId, params.applicationId, params.contractId,
        paymentModel, totalAmount.toNumber(), decision.currency || 'TND',
        graceDays, installments.length, params.generatedBy,
      ],
    );

    // Create installment records
    for (const inst of installments) {
      await this.dataSource.query(
        `INSERT INTO installments
          (payment_schedule_id, tenant_id, sequence_number, amount, currency,
           due_date, grace_due_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
        [
          schedule.id, params.tenantId, inst.sequence,
          inst.amount.toNumber(), decision.currency || 'TND',
          format(inst.dueDate, 'yyyy-MM-dd'),
          format(addDays(inst.dueDate, graceDays), 'yyyy-MM-dd'),
        ],
      );
    }

    await this.audit(params.tenantId, params.generatedBy, 'payment_schedule.generated',
      schedule.id, null, { totalAmount: totalAmount.toNumber(), installments: installments.length });

    return this.getSchedule(schedule.id, params.tenantId);
  }

  /**
   * Record a payment against an installment.
   * Double-entry accounting — every payment creates two ledger entries.
   */
  async recordPayment(params: {
    tenantId: string;
    installmentId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    referenceNumber: string;
    paymentDate: Date;
    receivedBy: string;
    notes?: string;
  }) {
    const [installment] = await this.dataSource.query<any[]>(
      `SELECT i.*, ps.application_id, ps.tenant_id, a.student_id
       FROM installments i
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       JOIN applications a ON a.id = ps.application_id
       WHERE i.id = $1 AND ps.tenant_id = $2`,
      [params.installmentId, params.tenantId],
    );
    if (!installment) throw new NotFoundException('Installment not found');

    if (installment.status === 'paid' || installment.status === 'waived') {
      throw new BadRequestException(`Installment already ${installment.status}`);
    }

    const paymentAmount = new Decimal(params.amount);
    const installmentAmount = new Decimal(installment.amount);
    const alreadyPaid = new Decimal(installment.amount_paid || 0);
    const remaining = installmentAmount.minus(alreadyPaid);

    // Create payment record
    const [payment] = await this.dataSource.query<any[]>(
      `INSERT INTO payments
        (tenant_id, installment_id, student_id, amount, currency,
         payment_method, reference_number, payment_date, status, received_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'confirmed',$9,$10)
       RETURNING id`,
      [
        params.tenantId, params.installmentId, installment.student_id,
        paymentAmount.toNumber(), params.currency,
        params.paymentMethod, params.referenceNumber,
        format(new Date(params.paymentDate), 'yyyy-MM-dd'),
        params.receivedBy, params.notes,
      ],
    );

    // Update installment paid amount
    const newPaid = alreadyPaid.plus(paymentAmount);
    const newStatus = newPaid.greaterThanOrEqualTo(installmentAmount) ? 'paid'
      : newPaid.greaterThan(0) ? 'partial' : installment.status;

    const isLate = isPast(new Date(installment.grace_due_date));

    await this.dataSource.query(
      `UPDATE installments
       SET amount_paid = $2, status = $3, paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END
       WHERE id = $1`,
      [params.installmentId, newPaid.toNumber(), newStatus],
    );

    // Double-entry financial ledger (append-only)
    await this.recordLedgerEntries(params.tenantId, installment.application_id, payment.id, {
      debitAccount: 'bank', creditAccount: 'student_receivable',
      amount: paymentAmount.toNumber(), currency: params.currency,
      description: `Payment for installment ${installment.sequence_number}`,
    });

    // Record score event for payment (on-time or late)
    if (newStatus === 'paid') {
      const eventCode = isLate ? 'PAYMENT_LATE' : 'PAYMENT_ON_TIME';
      const points = isLate ? -20 : 15;

      await this.scoreService.recordEvent({
        tenantId: params.tenantId,
        studentId: installment.student_id,
        dimension: ScoreDimension.PAYMENT_RELIABILITY,
        eventCode,
        points,
        sourceType: SourceTrustLevel.SYSTEM_VERIFIED,
        sourceId: params.receivedBy,
        description: `Installment ${installment.sequence_number} ${isLate ? 'paid late' : 'paid on time'}`,
        referenceId: payment.id,
        referenceType: 'payment',
        recordedBy: params.receivedBy,
      });
    }

    await this.audit(params.tenantId, params.receivedBy, 'payment.recorded',
      payment.id, null, { amount: params.amount, installmentId: params.installmentId });

    if (newStatus === 'paid') {
      await this.notifyStudent(params.tenantId, installment.student_id, 'payment_confirmed', {
        amount: paymentAmount.toNumber(), currency: params.currency, paymentReference: params.referenceNumber,
      }, payment.id);
    }

    return { paymentId: payment.id, newInstallmentStatus: newStatus, amountPaid: newPaid.toNumber() };
  }

  /**
   * Reverse a payment (admin action, requires reason)
   */
  async reversePayment(
    paymentId: string,
    tenantId: string,
    reason: string,
    reversedBy: string,
  ) {
    const [payment] = await this.dataSource.query<any[]>(
      `SELECT p.*, i.payment_schedule_id
       FROM payments p
       JOIN installments i ON i.id = p.installment_id
       WHERE p.id = $1 AND p.tenant_id = $2 AND p.status IN ('confirmed', 'verified')`,
      [paymentId, tenantId],
    );
    if (!payment) throw new NotFoundException('Payment not found or not reversible');

    // Mark payment reversed
    await this.dataSource.query(
      `UPDATE payments SET status = 'reversed', reversed_at = NOW(),
       reversed_by = $2, reversal_reason = $3 WHERE id = $1`,
      [paymentId, reversedBy, reason],
    );

    // Revert installment amount
    await this.dataSource.query(
      `UPDATE installments
       SET amount_paid = GREATEST(0, amount_paid - $2),
           status = 'pending', paid_at = NULL
       WHERE id = $1`,
      [payment.installment_id, payment.amount],
    );

    // Reverse ledger entries
    await this.recordLedgerEntries(tenantId, null, payment.id, {
      debitAccount: 'student_receivable', creditAccount: 'bank',
      amount: parseFloat(payment.amount), currency: payment.currency,
      description: `Reversal of payment ${paymentId}: ${reason}`,
    });

    await this.audit(tenantId, reversedBy, 'payment.reversed', paymentId,
      { status: payment.status }, { status: 'reversed', reason });

    return { paymentId, status: 'reversed' };
  }

  async getSchedule(scheduleId: string, tenantId: string) {
    const [schedule] = await this.dataSource.query<any[]>(
      `SELECT ps.*,
              json_agg(i.* ORDER BY i.sequence_number) AS installments
       FROM payment_schedules ps
       JOIN installments i ON i.payment_schedule_id = ps.id
       WHERE ps.id = $1 AND ps.tenant_id = $2
       GROUP BY ps.id`,
      [scheduleId, tenantId],
    );
    if (!schedule) throw new NotFoundException('Payment schedule not found');
    return schedule;
  }

  async getScheduleForApplication(applicationId: string, tenantId: string) {
    const [schedule] = await this.dataSource.query<any[]>(
      `SELECT ps.*,
              json_agg(json_build_object(
                'id', i.id, 'sequence', i.sequence_number, 'amount', i.amount,
                'dueDate', i.due_date, 'graceDueDate', i.grace_due_date,
                'status', i.status, 'amountPaid', i.amount_paid,
                'payments', (SELECT json_agg(p.*) FROM payments p WHERE p.installment_id = i.id)
              ) ORDER BY i.sequence_number) AS installments
       FROM payment_schedules ps
       JOIN installments i ON i.payment_schedule_id = ps.id
       WHERE ps.application_id = $1 AND ps.tenant_id = $2
       GROUP BY ps.id`,
      [applicationId, tenantId],
    );
    return schedule || null;
  }

  async getInstallmentPayments(installmentId: string, tenantId: string) {
    return this.dataSource.query(
      `SELECT p.*, u.full_name AS received_by_name
       FROM payments p
       LEFT JOIN users u ON u.id = p.received_by
       JOIN installments i ON i.id = p.installment_id
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       WHERE p.installment_id = $1 AND ps.tenant_id = $2
       ORDER BY p.created_at DESC`,
      [installmentId, tenantId],
    );
  }

  // ================================================================
  // Scheduled: Update installment statuses daily
  // ================================================================
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async updateInstallmentStatuses(): Promise<void> {
    this.logger.log('Running daily installment status update');

    // Mark installments as due_soon (within 7 days)
    const dueSoonInstallments = await this.dataSource.query<any[]>(
      `UPDATE installments
       SET status = 'due_soon'
       WHERE status = 'pending'
         AND due_date <= CURRENT_DATE + INTERVAL '7 days'
         AND due_date > CURRENT_DATE
       RETURNING id, payment_schedule_id, amount, due_date`,
    );

    for (const inst of dueSoonInstallments) {
      const [ps] = await this.dataSource.query<any[]>(
        `SELECT ps.tenant_id, a.student_id FROM payment_schedules ps
         JOIN applications a ON a.id = ps.application_id
         WHERE ps.id = $1`,
        [inst.payment_schedule_id],
      );
      if (ps) {
        const daysUntilDue = Math.max(0, Math.ceil(
          (new Date(inst.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ));
        await this.notifyStudent(ps.tenant_id, ps.student_id, 'payment_due_soon', {
          amount: inst.amount, currency: 'TND', dueDate: format(new Date(inst.due_date), 'yyyy-MM-dd'), daysUntilDue,
        }, inst.id);
      }
    }

    // Mark as due_today
    await this.dataSource.query(
      `UPDATE installments
       SET status = 'due_today'
       WHERE status IN ('pending','due_soon')
         AND due_date = CURRENT_DATE`,
    );

    // Mark as late (past grace period)
    const lateInstallments = await this.dataSource.query<any[]>(
      `UPDATE installments
       SET status = 'late'
       WHERE status IN ('pending','due_soon','due_today','partial')
         AND grace_due_date < CURRENT_DATE
         AND amount_paid < amount
       RETURNING id, payment_schedule_id, amount, due_date`,
    );

    // Trigger score events for newly late payments
    for (const inst of lateInstallments) {
      const [ps] = await this.dataSource.query<any[]>(
        `SELECT ps.tenant_id, a.student_id FROM payment_schedules ps
         JOIN applications a ON a.id = ps.application_id
         WHERE ps.id = $1`,
        [inst.payment_schedule_id],
      );
      if (ps) {
        await this.scoreService.recordEvent({
          tenantId: ps.tenant_id,
          studentId: ps.student_id,
          dimension: ScoreDimension.PAYMENT_RELIABILITY,
          eventCode: 'PAYMENT_OVERDUE',
          points: -30,
          sourceType: SourceTrustLevel.SYSTEM_VERIFIED,
          sourceId: 'system',
          description: 'Payment overdue — grace period passed',
          referenceId: inst.id,
          referenceType: 'installment',
          recordedBy: 'system',
        }).catch(err => this.logger.error('Score event failed for overdue installment', err));

        await this.notifyStudent(ps.tenant_id, ps.student_id, 'payment_overdue', {
          amount: inst.amount, currency: 'TND', dueDate: format(new Date(inst.due_date), 'yyyy-MM-dd'),
        }, inst.id);
      }
    }

    // Mark default_risk (30+ days late)
    await this.dataSource.query(
      `UPDATE installments
       SET status = 'default_risk'
       WHERE status = 'late'
         AND grace_due_date < CURRENT_DATE - INTERVAL '30 days'`,
    );
  }

  // ================================================================
  // Double-entry ledger
  // ================================================================
  private async recordLedgerEntries(
    tenantId: string,
    applicationId: string | null,
    referenceId: string,
    entry: {
      debitAccount: string;
      creditAccount: string;
      amount: number;
      currency: string;
      description: string;
    },
  ): Promise<void> {
    const batchId = uuidv4();

    // Debit entry
    await this.dataSource.query(
      `INSERT INTO financial_ledger
        (tenant_id, application_id, entry_type, account, amount, currency,
         reference_id, reference_type, description, batch_id)
       VALUES ($1,$2,'debit',$3,$4,$5,$6,'payment',$7,$8)`,
      [tenantId, applicationId, entry.debitAccount, entry.amount, entry.currency,
       referenceId, entry.description, batchId],
    );

    // Credit entry
    await this.dataSource.query(
      `INSERT INTO financial_ledger
        (tenant_id, application_id, entry_type, account, amount, currency,
         reference_id, reference_type, description, batch_id)
       VALUES ($1,$2,'credit',$3,$4,$5,$6,'payment',$7,$8)`,
      [tenantId, applicationId, entry.creditAccount, entry.amount, entry.currency,
       referenceId, entry.description, batchId],
    );
  }

  private async audit(tenantId: string, userId: string, action: string, targetId: string, prev: any, next: any) {
    await this.dataSource.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, previous_value, new_value, created_at)
       VALUES ($1,$2,$3,'payments','payments',$4,$5,$6,NOW())`,
      [tenantId, userId, action, targetId,
       prev ? JSON.stringify(prev) : null, next ? JSON.stringify(next) : null],
    ).catch(err => this.logger.error('Audit log failed', err));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RECEIPT VERIFICATION — V1 Manual Flow
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Submit a payment receipt (called when student uploads proof of payment).
   * Creates a payment record in 'receipt_uploaded' status.
   * Admin then checks bank manually and calls verifyPayment().
   */
  async submitReceipt(params: {
    tenantId: string;
    installmentId: string;
    studentId: string;
    paymentDate: string;
    amount: number;
    bankName?: string;
    referenceNumber?: string;
    receiptFilename?: string;
    notes?: string;
  }) {
    const [installment] = await this.dataSource.query<any[]>(
      `SELECT i.*, ps.application_id, ps.tenant_id, a.student_id
       FROM installments i
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       JOIN applications a ON a.id = ps.application_id
       WHERE i.id = $1 AND ps.tenant_id = $2`,
      [params.installmentId, params.tenantId],
    );
    if (!installment) throw new NotFoundException('Installment not found');
    if (installment.status === 'paid' || installment.status === 'waived') {
      throw new BadRequestException(`Installment is already ${installment.status}`);
    }

    // Check for existing pending receipt for this installment
    const [existing] = await this.dataSource.query<any[]>(
      `SELECT id FROM payments
       WHERE installment_id = $1 AND tenant_id = $2
         AND status IN ('receipt_uploaded','pending_verification')
       LIMIT 1`,
      [params.installmentId, params.tenantId],
    );
    if (existing) {
      // Update the existing receipt submission
      await this.dataSource.query(
        `UPDATE payments
         SET receipt_filename = $2, bank_name = $3, student_bank_ref = $4,
             student_amount = $5, payment_date = $6, notes = $7,
             receipt_uploaded_at = NOW(), status = 'receipt_uploaded'
         WHERE id = $1`,
        [existing.id, params.receiptFilename, params.bankName,
         params.referenceNumber, params.amount,
         params.paymentDate, params.notes],
      );
      return { paymentId: existing.id, status: 'receipt_uploaded' };
    }

    // Create new receipt record
    const [payment] = await this.dataSource.query<any[]>(
      `INSERT INTO payments
        (tenant_id, installment_id, student_id, amount, currency,
         payment_method, reference_number, payment_date, status,
         bank_name, student_bank_ref, student_amount,
         receipt_filename, receipt_uploaded_at, notes)
       VALUES ($1,$2,$3,$4,'TND','bank_transfer',$5,$6,'receipt_uploaded',
               $7,$5,$4,$8,NOW(),$9)
       RETURNING id`,
      [
        params.tenantId, params.installmentId, installment.student_id,
        params.amount, params.referenceNumber,
        format(new Date(params.paymentDate), 'yyyy-MM-dd'),
        params.bankName, params.receiptFilename, params.notes,
      ],
    );

    this.logger.log(
      `Receipt submitted for installment ${params.installmentId} — awaiting admin verification`,
    );

    return { paymentId: payment.id, status: 'receipt_uploaded' };
  }

  /**
   * List payment receipts pending verification (admin dashboard).
   * Supports filtering by status, student name search, and pagination.
   */
  async listReceipts(params: {
    tenantId: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const offset = (page - 1) * limit;

    // Allowed status values — whitelist to prevent injection
    const ALLOWED_STATUSES = ['receipt_uploaded', 'pending_verification', 'verified', 'rejected', 'confirmed', 'reversed'];
    const statusParam = params.status && params.status !== 'all' && ALLOWED_STATUSES.includes(params.status)
      ? params.status : null;

    // Build parameterized query
    const queryParams: any[] = [params.tenantId];
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

    const rows = await this.dataSource.query<any[]>(
      `SELECT
         p.id, p.status, p.amount, p.currency, p.payment_date,
         p.bank_name, p.student_bank_ref AS reference_number,
         p.student_amount, p.receipt_filename,
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
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams,
    );

    // Count query with same filters
    const countParams: any[] = [params.tenantId];
    let cIdx = 2;
    let cStatusClause = `AND p.status IN ('receipt_uploaded','pending_verification','verified','rejected')`;
    if (statusParam) { cStatusClause = `AND p.status = $${cIdx++}`; countParams.push(statusParam); }
    let cSearchClause = '';
    if (params.search?.trim()) { cSearchClause = `AND (s.first_name ILIKE $${cIdx} OR s.last_name ILIKE $${cIdx} OR s.email ILIKE $${cIdx})`; countParams.push(`%${params.search.trim()}%`); }

    const [{ count }] = await this.dataSource.query<any[]>(
      `SELECT COUNT(*) FROM payments p JOIN students s ON s.id = p.student_id WHERE p.tenant_id = $1 ${cStatusClause} ${cSearchClause}`,
      countParams,
    );

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

  /**
   * Verify a payment receipt (admin confirms payment in bank account).
   * Updates payment to 'verified' and marks the installment as 'paid'.
   * This is the source-of-truth action — admin has checked the real bank.
   */
  async verifyPayment(
    paymentId: string,
    tenantId: string,
    verifiedBy: string,
    notes?: string,
  ) {
    const [payment] = await this.dataSource.query<any[]>(
      `SELECT p.*, i.amount AS installment_amount, i.amount_paid,
              i.sequence_number, i.grace_due_date,
              ps.application_id, ps.tenant_id AS sched_tenant,
              a.student_id
       FROM payments p
       JOIN installments i ON i.id = p.installment_id
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       JOIN applications a ON a.id = ps.application_id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [paymentId, tenantId],
    );
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'verified') {
      throw new BadRequestException('Payment already verified');
    }
    if (payment.status === 'reversed') {
      throw new BadRequestException('Cannot verify a reversed payment');
    }

    // Mark payment as verified
    await this.dataSource.query(
      `UPDATE payments
       SET status = 'verified',
           verified_at = NOW(),
           verified_by = $2,
           verification_notes = $3,
           amount = COALESCE(student_amount, amount)
       WHERE id = $1`,
      [paymentId, verifiedBy, notes || null],
    );

    // Use the verified amount (what admin confirmed in the bank)
    const verifiedAmount = new Decimal(payment.student_amount || payment.amount);
    const installmentAmount = new Decimal(payment.installment_amount);
    const alreadyPaid = new Decimal(payment.amount_paid || 0);
    const newPaid = alreadyPaid.plus(verifiedAmount);

    const newInstallmentStatus = newPaid.greaterThanOrEqualTo(installmentAmount)
      ? 'paid'
      : newPaid.greaterThan(0) ? 'partial' : 'pending';

    // Update installment
    await this.dataSource.query(
      `UPDATE installments
       SET amount_paid = $2,
           status = $3,
           paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END
       WHERE id = $1`,
      [payment.installment_id, newPaid.toNumber(), newInstallmentStatus],
    );

    // Record ledger entry
    await this.recordLedgerEntries(tenantId, payment.application_id, paymentId, {
      debitAccount: 'bank',
      creditAccount: 'student_receivable',
      amount: verifiedAmount.toNumber(),
      currency: payment.currency || 'TND',
      description: `Verified payment for installment #${payment.sequence_number}`,
    });

    // Update FORSA Score if installment fully paid
    if (newInstallmentStatus === 'paid') {
      const isLate = payment.grace_due_date && isPast(new Date(payment.grace_due_date));
      await this.scoreService.recordEvent({
        tenantId,
        studentId: payment.student_id,
        dimension: ScoreDimension.PAYMENT_RELIABILITY,
        eventCode: isLate ? 'PAYMENT_LATE' : 'PAYMENT_ON_TIME',
        points: isLate ? -20 : 15,
        sourceType: SourceTrustLevel.SYSTEM_VERIFIED,
        sourceId: verifiedBy,
        description: `Installment #${payment.sequence_number} ${isLate ? 'paid late' : 'paid on time'} — verified by admin`,
        referenceId: paymentId,
        referenceType: 'payment',
        recordedBy: verifiedBy,
      });
    }

    await this.audit(tenantId, verifiedBy, 'payment.verified', paymentId,
      { status: payment.status },
      { status: 'verified', notes, newInstallmentStatus },
    );

    if (newInstallmentStatus === 'paid') {
      await this.notifyStudent(tenantId, payment.student_id, 'payment_confirmed', {
        amount: verifiedAmount.toNumber(), currency: payment.currency || 'TND', paymentReference: payment.reference_number || paymentId,
      }, paymentId);
    }

    this.logger.log(
      `Payment ${paymentId} verified by ${verifiedBy} — installment now ${newInstallmentStatus}`,
    );

    return {
      paymentId,
      status: 'verified',
      newInstallmentStatus,
      amountPaid: newPaid.toNumber(),
    };
  }

  /**
   * Reject a payment receipt (admin determines receipt is invalid).
   * Student will be notified to resubmit a correct receipt.
   * Does NOT update the installment — it remains unpaid.
   */
  async rejectPayment(
    paymentId: string,
    tenantId: string,
    rejectedBy: string,
    reason: string,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    const [payment] = await this.dataSource.query<any[]>(
      `SELECT p.*, s.first_name, s.last_name, s.email, i.sequence_number
       FROM payments p
       JOIN students s ON s.id = p.student_id
       JOIN installments i ON i.id = p.installment_id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [paymentId, tenantId],
    );
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'verified') {
      throw new BadRequestException('Cannot reject an already verified payment');
    }
    if (payment.status === 'reversed') {
      throw new BadRequestException('Cannot reject a reversed payment');
    }

    await this.dataSource.query(
      `UPDATE payments
       SET status = 'rejected',
           rejection_reason = $2,
           verified_by = $3,
           verified_at = NOW()
       WHERE id = $1`,
      [paymentId, reason.trim(), rejectedBy],
    );

    await this.audit(tenantId, rejectedBy, 'payment.rejected', paymentId,
      { status: payment.status },
      { status: 'rejected', reason },
    );

    this.logger.log(
      `Payment ${paymentId} rejected by ${rejectedBy}: ${reason}`,
    );

    return {
      paymentId,
      status: 'rejected',
      reason,
      studentEmail: payment.email,
      studentName: `${payment.first_name} ${payment.last_name}`,
    };
  }

}
