import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { KonnectService } from '../payments/konnect.service'
import { hashPassword, validatePasswordComplexity } from '../common/utils/password.util'
import { UserStatus } from '../common/enums'
import { RegisterGuarantorDto } from './dto/register-guarantor.dto'

@Injectable()
export class GuarantorsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly konnect: KonnectService,
  ) {}

  /**
   * T-102 — public self-registration ("activate my portal account").
   * See RegisterGuarantorDto for why this can only ever activate an
   * existing guarantor row (created by staff), never create one.
   */
  async registerSelf(dto: RegisterGuarantorDto) {
    validatePasswordComplexity(dto.password)

    const [guarantor] = await this.db.query<any[]>(
      `SELECT id, user_id FROM guarantors WHERE tenant_id = $1 AND email = $2`,
      [dto.tenantId, dto.email],
    )
    if (!guarantor) {
      throw new NotFoundException(
        'No guarantor record found for this email. Ask the student\'s FORSA contact to add you as a guarantor first.',
      )
    }
    if (guarantor.user_id) {
      throw new ConflictException('This guarantor has already activated a portal account')
    }

    const existingUser = await this.db.query<any[]>(
      `SELECT id FROM users WHERE tenant_id = $1 AND email = $2`,
      [dto.tenantId, dto.email],
    )
    if (existingUser.length) {
      throw new ConflictException('An account with this email already exists')
    }

    const passwordHash = await hashPassword(dto.password)

    return this.db.transaction(async (manager) => {
      const [user] = await manager.query<any[]>(
        `INSERT INTO users
          (tenant_id, email, email_verified, password_hash, full_name, status,
           must_change_password, portal_type, guarantor_id)
         VALUES ($1,$2,false,$3,$4,$5,false,'guarantor',$6)
         RETURNING id, email`,
        [dto.tenantId, dto.email, passwordHash, dto.fullName, UserStatus.PENDING_VERIFICATION, guarantor.id],
      )

      await manager.query(
        `UPDATE guarantors SET user_id = $2, portal_activated = true WHERE id = $1`,
        [guarantor.id, user.id],
      )

      await manager.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
         VALUES ($1,$2,'guarantor.self_registered','guarantors','guarantors',$3,$4,NOW())`,
        [dto.tenantId, user.id, guarantor.id, JSON.stringify({ email: dto.email })],
      ).catch(() => {})

      return { guarantorId: guarantor.id, userId: user.id, email: user.email }
    })
  }

  /**
   * Find the student linked to this guarantor user.
   * V1: one guarantor → one student.
   * V2: one guarantor → N students (via guarantor_id on multiple applications).
   */
  private async findLinkedStudent(userId: string, tenantId: string) {
    // Lookup via guarantors.user_id → student_guarantors → students → applications
    const [link] = await this.db.query<any[]>(
      `SELECT
         g.id AS guarantor_id,
         s.id AS student_id,
         s.first_name, s.last_name, s.email AS student_email,
         a.id AS application_id,
         a.current_status,
         a.university_id,
         u.name AS university_name,
         a.program_name,
         a.tuition_amount
       FROM guarantors g
       JOIN student_guarantors sg ON sg.guarantor_id = g.id
       JOIN students s ON s.id = sg.student_id
       JOIN applications a ON a.student_id = s.id AND a.tenant_id = $2
       LEFT JOIN universities u ON u.id = a.university_id
       WHERE g.user_id = $1 AND g.tenant_id = $2
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [userId, tenantId],
    )
    return link || null
  }

  async getLinkedStudent(userId: string, tenantId: string) {
    const link = await this.findLinkedStudent(userId, tenantId)
    if (!link) return { student: null, application: null, paymentSchedule: null, installments: [] }

    // Activation meeting status
    const [meeting] = await this.db.query<any[]>(
      `SELECT id, scheduled_at, status FROM activation_meetings
       WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [link.application_id],
    ).catch(() => [[]])

    // Contracts
    const [contract] = await this.db.query<any[]>(
      `SELECT id, status, signed_at FROM contracts
       WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [link.application_id],
    ).catch(() => [[]])

    // Payment schedule + upcoming installment
    const [schedule] = await this.db.query<any[]>(
      `SELECT ps.*, COUNT(i.id) AS total_installments,
              SUM(CASE WHEN i.status IN ('paid','verified') THEN 1 ELSE 0 END) AS paid_count
       FROM payment_schedules ps
       LEFT JOIN installments i ON i.payment_schedule_id = ps.id
       WHERE ps.application_id = $1
       GROUP BY ps.id
       LIMIT 1`,
      [link.application_id],
    ).catch(() => [[]])

    const installments = schedule ? await this.db.query<any[]>(
      `SELECT id, sequence_number, amount, due_date, status, amount_paid, paid_at, grace_due_date
       FROM installments WHERE payment_schedule_id = $1
       ORDER BY sequence_number`,
      [schedule.id],
    ).catch(() => []) : []

    return {
      student: {
        id: link.student_id,
        first_name: link.first_name,
        last_name: link.last_name,
        email: link.student_email,
      },
      application: {
        id: link.application_id,
        current_status: link.current_status,
        university_name: link.university_name,
        program_name: link.program_name,
        tuition_amount: link.tuition_amount,
        activation_meeting: meeting || null,
        contract: contract || null,
      },
      paymentSchedule: schedule || null,
      installments,
    }
  }

  async getLinkedStudentPayments(userId: string, tenantId: string) {
    const link = await this.findLinkedStudent(userId, tenantId)
    if (!link) throw new NotFoundException('No linked student found')

    const [schedule] = await this.db.query<any[]>(
      `SELECT * FROM payment_schedules WHERE application_id = $1 LIMIT 1`,
      [link.application_id],
    )
    if (!schedule) return { schedule: null, installments: [], application: link }

    const installments = await this.db.query<any[]>(
      `SELECT id, sequence_number, amount, due_date, status, amount_paid, paid_at
       FROM installments WHERE payment_schedule_id = $1 ORDER BY sequence_number`,
      [schedule.id],
    )

    return { schedule, installments, application: link }
  }

  async submitReceiptOnBehalf(
    userId: string,
    tenantId: string,
    body: {
      installmentId: string
      paymentDate: string
      amount: number
      bankName?: string
      referenceNumber?: string
      receiptFilename?: string
      notes?: string
    },
  ) {
    const link = await this.findLinkedStudent(userId, tenantId)
    if (!link) throw new NotFoundException('No linked student found')

    // Verify this installment belongs to the linked student
    const [installment] = await this.db.query<any[]>(
      `SELECT i.*, ps.application_id
       FROM installments i
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       WHERE i.id = $1 AND ps.application_id = $2`,
      [body.installmentId, link.application_id],
    )
    if (!installment) throw new ForbiddenException('Installment does not belong to your linked student')

    // Insert or update payment record (guarantor paying on behalf)
    await this.db.query(
      `INSERT INTO payments (
         tenant_id, installment_id, student_id,
         payment_date, amount, bank_name, student_bank_ref,
         student_amount, receipt_filename, receipt_uploaded_at,
         status, payment_method, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 'receipt_uploaded', 'bank_transfer', $10)
       ON CONFLICT (installment_id) WHERE status = 'receipt_uploaded'
       DO UPDATE SET
         payment_date = $4, amount = $5, bank_name = $6,
         student_bank_ref = $7, student_amount = $8,
         receipt_filename = $9, receipt_uploaded_at = NOW(),
         notes = $10`,
      [
        tenantId, body.installmentId, link.student_id,
        body.paymentDate, body.amount,
        body.bankName || null, body.referenceNumber || null,
        body.amount, body.receiptFilename || null,
        `Paiement effectué par le garant. ${body.notes || ''}`.trim(),
      ],
    )

    // Log to audit
    await this.db.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, target_type, target_id, new_value)
       VALUES ($1, $2, 'guarantor.payment_receipt_submitted', 'installment', $3, $4)`,
      [tenantId, userId, body.installmentId, JSON.stringify({ amount: body.amount, by: 'guarantor' })],
    ).catch(() => {})

    return { success: true, message: 'Reçu soumis. L\'équipe finance vérifiera dans les 24h.' }
  }

  async initiateKonnectOnBehalf(
    userId: string,
    email: string,
    fullName: string,
    tenantId: string,
    body: { installmentId: string; paymentReference: string; amount: number },
  ) {
    const link = await this.findLinkedStudent(userId, tenantId)
    if (!link) throw new NotFoundException('No linked student found')

    // Verify installment belongs to linked student
    const [installment] = await this.db.query<any[]>(
      `SELECT i.* FROM installments i
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       WHERE i.id = $1 AND ps.application_id = $2`,
      [body.installmentId, link.application_id],
    )
    if (!installment) throw new ForbiddenException('Installment does not belong to your linked student')

    // Initiate Konnect — use guarantor email but note it's on behalf of student
    return this.konnect.initiatePayment({
      tenantId,
      installmentId: body.installmentId,
      studentId: link.student_id,
      studentEmail: email, // guarantor email for confirmation
      studentName: fullName || email,
      amount: body.amount,
      paymentReference: body.paymentReference,
    })
  }

  async getNotifications(userId: string, tenantId: string) {
    const link = await this.findLinkedStudent(userId, tenantId)
    if (!link) return { notifications: [] }

    // Get recent audit events for this student's application
    const notifications = await this.db.query<any[]>(
      `SELECT
         al.action, al.created_at, al.new_value,
         CASE al.action
           WHEN 'application.status_changed' THEN 'Mise à jour de la candidature'
           WHEN 'payment.verified' THEN 'Paiement confirmé'
           WHEN 'payment.rejected' THEN 'Reçu rejeté — veuillez soumettre à nouveau'
           WHEN 'activation_meeting.scheduled' THEN 'Réunion d\'activation planifiée'
           WHEN 'contract.signed' THEN 'Contrat signé'
           ELSE al.action
         END AS label
       FROM audit_logs al
       WHERE al.tenant_id = $1
         AND al.target_id IN (
           SELECT id FROM payments WHERE student_id = $2
           UNION SELECT $3
         )
       ORDER BY al.created_at DESC
       LIMIT 20`,
      [tenantId, link.student_id, link.application_id],
    ).catch(() => [])

    return { notifications }
  }
}
