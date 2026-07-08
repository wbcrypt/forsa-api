import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { KonnectService } from '../payments/konnect.service'
import { DocumentsService } from '../documents/documents.service'
import { hashPassword, validatePasswordComplexity } from '../common/utils/password.util'
import { hashToken } from '../common/utils/encryption.util'
import { UserStatus } from '../common/enums'
import { AcceptGuarantorInviteDto, DeclineGuarantorInviteDto } from './dto/accept-guarantor-invite.dto'

@Injectable()
export class GuarantorsService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly konnect: KonnectService,
    private readonly documents: DocumentsService,
  ) {}

  /**
   * Look up an invite by its raw token — used by both the public preview
   * (GET, before the guarantor decides anything) and accept/decline
   * (POST). Distinguishes "no such token" from "already used/expired"
   * so the guarantor portal can show a real reason, not a generic dead end
   * (the same UX gap fixed for the student set-password flow).
   */
  private async findInviteByToken(rawToken: string) {
    const tokenHash = hashToken(rawToken)
    const [guarantor] = await this.db.query<any[]>(
      `SELECT g.id, g.tenant_id, g.email, g.first_name, g.last_name, g.user_id,
              g.invite_token_expires_at,
              sg.student_id, sg.status AS link_status,
              s.first_name AS student_first_name
       FROM guarantors g
       LEFT JOIN student_guarantors sg ON sg.guarantor_id = g.id
       LEFT JOIN students s ON s.id = sg.student_id
       WHERE g.invite_token = $1`,
      [tokenHash],
    )
    return guarantor || null
  }

  /** Public preview — shown before the guarantor commits to accept/decline. */
  async previewInvite(rawToken: string) {
    const invite = await this.findInviteByToken(rawToken)
    if (!invite) throw new BadRequestException('This invite link is invalid.')
    if (invite.user_id) throw new BadRequestException('This invite has already been used. Please log in instead.')
    if (invite.link_status === 'declined') throw new BadRequestException('This invitation was already declined.')
    if (new Date(invite.invite_token_expires_at) <= new Date()) {
      throw new BadRequestException('This invite link has expired. Ask the student\'s FORSA contact to resend it.')
    }
    return {
      guarantorFirstName: invite.first_name,
      guarantorLastName: invite.last_name,
      email: invite.email,
      tenantId: invite.tenant_id,
      studentFirstName: invite.student_first_name,
      expiresAt: invite.invite_token_expires_at,
    }
  }

  /** Accept: verifies the token, sets a password, activates portal access. */
  async acceptInvite(rawToken: string, dto: AcceptGuarantorInviteDto) {
    validatePasswordComplexity(dto.password)

    const invite = await this.findInviteByToken(rawToken)
    if (!invite) throw new BadRequestException('This invite link is invalid.')
    if (invite.user_id) throw new ConflictException('This invite has already been used. Please log in instead.')
    if (invite.link_status === 'declined') throw new BadRequestException('This invitation was already declined.')
    if (new Date(invite.invite_token_expires_at) <= new Date()) {
      throw new BadRequestException('This invite link has expired. Ask the student\'s FORSA contact to resend it.')
    }

    const existingUser = await this.db.query<any[]>(
      `SELECT id FROM users WHERE tenant_id = $1 AND email = $2`,
      [invite.tenant_id, invite.email],
    )
    if (existingUser.length) throw new ConflictException('An account with this email already exists')

    const passwordHash = await hashPassword(dto.password)

    return this.db.transaction(async (manager) => {
      const [user] = await manager.query<any[]>(
        `INSERT INTO users
          (tenant_id, email, email_verified, password_hash, full_name, status,
           must_change_password, portal_type, guarantor_id)
         VALUES ($1,$2,true,$3,$4,$5,false,'guarantor',$6)
         RETURNING id, email`,
        [invite.tenant_id, invite.email, passwordHash,
         `${invite.first_name} ${invite.last_name}`.trim(), UserStatus.ACTIVE, invite.id],
      )

      // Token is single-use: clear it so this same link can never be
      // replayed (findInviteByToken would no longer find a row for it).
      await manager.query(
        `UPDATE guarantors SET user_id = $2, portal_activated = true, invite_token = NULL WHERE id = $1`,
        [invite.id, user.id],
      )

      if (invite.student_id) {
        await manager.query(
          `UPDATE student_guarantors SET status = 'active' WHERE guarantor_id = $1 AND student_id = $2`,
          [invite.id, invite.student_id],
        )
      }

      await manager.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
         VALUES ($1,$2,'guarantor.invite_accepted','guarantors','guarantors',$3,$4,NOW())`,
        [invite.tenant_id, user.id, invite.id, JSON.stringify({ email: invite.email })],
      ).catch(() => {})

      return { guarantorId: invite.id, userId: user.id, email: user.email }
    })
  }

  /** Decline: no account is ever created — just marks the link declined for staff to see. */
  async declineInvite(rawToken: string, dto: DeclineGuarantorInviteDto) {
    const invite = await this.findInviteByToken(rawToken)
    if (!invite) throw new BadRequestException('This invite link is invalid.')
    if (invite.user_id) throw new ConflictException('This invite has already been used.')
    if (invite.link_status === 'declined') return { success: true }

    if (invite.student_id) {
      await this.db.query(
        `UPDATE student_guarantors SET status = 'declined', withdrawal_date = CURRENT_DATE, withdrawal_reason = $3
         WHERE guarantor_id = $1 AND student_id = $2`,
        [invite.id, invite.student_id, dto.reason || 'Declined by guarantor'],
      )
    }
    await this.db.query(`UPDATE guarantors SET invite_token = NULL WHERE id = $1`, [invite.id])

    await this.db.query(
      `INSERT INTO audit_logs (tenant_id, action_type, module, target_entity, target_id, new_value, created_at)
       VALUES ($1,'guarantor.invite_declined','guarantors','guarantors',$2,$3,NOW())`,
      [invite.tenant_id, invite.id, JSON.stringify({ email: invite.email, reason: dto.reason })],
    ).catch(() => {})

    return { success: true }
  }

  /**
   * Find the student linked to this guarantor user.
   * V1: one guarantor → one student.
   * V2: one guarantor → N students (via guarantor_id on multiple applications).
   */
  private async findLinkedStudent(userId: string, tenantId: string) {
    // Lookup via guarantors.user_id → student_guarantors → students → applications
    // Phase 3 (browser E2E testing) discovery — selected a.program_name,
    // a column that has never existed on applications (the real column
    // is program_id, a FK to programs) — this has thrown a 500 on every
    // call since it was built, meaning the Guarantor Portal's core
    // feature (see which student you're backing) has never worked.
    //
    // Found during manual pilot testing — applications was an INNER JOIN,
    // so a guarantor whose student hadn't submitted a Tuition Facilitation
    // application yet (a completely normal, common state — accepting an
    // invite happens independently of and often before applying) saw "No
    // linked student" even though the guarantor-student relationship
    // itself was perfectly valid and active. The guarantor relationship
    // and the application are two different things; only the second one
    // should ever be allowed to be absent. Also now excludes withdrawn
    // links, which the old query didn't filter out either.
    const [link] = await this.db.query<any[]>(
      `SELECT
         g.id AS guarantor_id,
         s.id AS student_id,
         s.first_name, s.last_name, s.email AS student_email,
         a.id AS application_id,
         a.current_status,
         a.university_id,
         u.name AS university_name,
         p.name AS program_name,
         a.tuition_amount
       FROM guarantors g
       JOIN student_guarantors sg ON sg.guarantor_id = g.id AND sg.status = 'active'
       JOIN students s ON s.id = sg.student_id
       LEFT JOIN applications a ON a.student_id = s.id AND a.tenant_id = $2
       LEFT JOIN universities u ON u.id = a.university_id
       LEFT JOIN programs p ON p.id = a.program_id
       WHERE g.user_id = $1 AND g.tenant_id = $2
       ORDER BY a.created_at DESC NULLS LAST
       LIMIT 1`,
      [userId, tenantId],
    )
    return link || null
  }

  async getLinkedStudent(userId: string, tenantId: string) {
    const link = await this.findLinkedStudent(userId, tenantId)
    if (!link) return { student: null, application: null, paymentSchedule: null, installments: [] }

    // Sanity-check discovery — this method silently failed on every call:
    // `activation_meetings` has no migration anywhere in the codebase (never
    // built), and `contracts` has no `signed_at` column (the real column is
    // `fully_signed_at`). Both errors were swallowed by .catch(() => [[]]),
    // which also doesn't match query()'s real resolved shape — destructuring
    // `[meeting] = [[]]` yields `meeting = []` (a truthy empty array), so
    // `activation_meeting: meeting || null` was rendering `[]`, not `null`.
    const activationMeeting = null

    const [contract] = await this.db.query<any[]>(
      `SELECT id, status, fully_signed_at FROM contracts
       WHERE application_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [link.application_id],
    ).catch(() => [null])

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
      // link.application_id is null when the linked student hasn't
      // submitted a Tuition Facilitation request yet — a real, normal
      // state now that this lookup no longer requires an application to
      // exist. Returning a clean `null` here (rather than an object full
      // of null fields) lets the frontend show a genuine "no application
      // yet" empty state instead of a blank-looking application card.
      application: link.application_id ? {
        id: link.application_id,
        current_status: link.current_status,
        university_name: link.university_name,
        program_name: link.program_name,
        tuition_amount: link.tuition_amount,
        activation_meeting: activationMeeting,
        contract: contract || null,
      } : null,
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

  /**
   * T-111 — presigned upload-url step of the guarantor receipt-upload flow.
   * GuarantorsController has no PermissionsGuard (self-scoped by design —
   * see the controller), so this is the guarantor-appropriate route into
   * documents.service.ts's upload flow: a guarantor portal user typically
   * holds none of the staff `document.*` permissions the generic
   * POST /documents/upload-url route requires.
   */
  async getReceiptUploadUrl(
    userId: string,
    tenantId: string,
    fileName: string,
    contentType: string,
  ) {
    const link = await this.findLinkedStudent(userId, tenantId)
    if (!link) throw new NotFoundException('No linked student found')

    return this.documents.generateUploadUrl({
      tenantId,
      entityType: 'guarantor',
      entityId: link.guarantor_id,
      documentTypeCode: 'payment_receipt',
      fileName,
      contentType,
      uploadedBy: userId,
    })
  }

  async confirmReceiptUpload(
    userId: string,
    tenantId: string,
    documentId: string,
    fileSize: number,
    checksum?: string,
  ) {
    const link = await this.findLinkedStudent(userId, tenantId)
    if (!link) throw new NotFoundException('No linked student found')

    const [doc] = await this.db.query<any[]>(
      `SELECT id FROM documents WHERE id = $1 AND tenant_id = $2 AND entity_type = 'guarantor' AND entity_id = $3`,
      [documentId, tenantId, link.guarantor_id],
    )
    if (!doc) throw new ForbiddenException('Document does not belong to your guarantor account')

    return this.documents.confirmUpload(documentId, tenantId, fileSize, checksum)
  }

  private async verifyReceiptDocument(
    receiptDocumentId: string | undefined,
    tenantId: string,
    guarantorId: string,
  ): Promise<string | null> {
    if (!receiptDocumentId) return null

    const [doc] = await this.db.query<any[]>(
      `SELECT id FROM documents
       WHERE id = $1 AND tenant_id = $2 AND entity_type = 'guarantor' AND entity_id = $3
         AND status = 'uploaded'`,
      [receiptDocumentId, tenantId, guarantorId],
    )
    if (!doc) {
      throw new BadRequestException('receiptDocumentId does not reference a completed upload for this guarantor')
    }
    return doc.id
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
      receiptDocumentId?: string
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

    // T-111 — verify a client-supplied receiptDocumentId actually belongs
    // to this guarantor before trusting it.
    const receiptDocumentId = await this.verifyReceiptDocument(
      body.receiptDocumentId, tenantId, link.guarantor_id,
    )

    // Insert or update payment record (guarantor paying on behalf)
    await this.db.query(
      `INSERT INTO payments (
         tenant_id, installment_id, student_id,
         payment_date, amount, bank_name, student_bank_ref,
         student_amount, receipt_filename, receipt_document_id, receipt_uploaded_at,
         status, payment_method, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 'receipt_uploaded', 'bank_transfer', $11)
       ON CONFLICT (installment_id) WHERE status = 'receipt_uploaded'
       DO UPDATE SET
         payment_date = $4, amount = $5, bank_name = $6,
         student_bank_ref = $7, student_amount = $8,
         receipt_filename = $9, receipt_document_id = $10, receipt_uploaded_at = NOW(),
         notes = $11`,
      [
        tenantId, body.installmentId, link.student_id,
        body.paymentDate, body.amount,
        body.bankName || null, body.referenceNumber || null,
        body.amount, body.receiptFilename || null, receiptDocumentId,
        `Paiement effectué par le garant. ${body.notes || ''}`.trim(),
      ],
    )

    // Log to audit
    await this.db.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
       VALUES ($1, $2, 'guarantor.payment_receipt_submitted', 'payments', 'installment', $3, $4, NOW())`,
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
