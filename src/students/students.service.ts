import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { addDays } from 'date-fns';
import { encrypt, decrypt, generateSecureToken, hashToken } from '../common/utils/encryption.util';
import { ConfigService } from '@nestjs/config';
import { StudentStatus, ExceptionalEventType, SourceTrustLevel, NotificationChannel } from '../common/enums';
import { PaginationDto, paginate, getSkip } from '../common/utils/pagination.util';
import { NotificationsService } from '../notifications/notifications.service';

const GUARANTOR_INVITE_TTL_DAYS = 7;

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: any, tenantId: string, createdBy: string) {
    // Encrypt PII
    const nationalIdRef = dto.nationalId
      ? encrypt(dto.nationalId, this.configService.get<string>('encryption.piiKey')!)
      : null;

    const [student] = await this.dataSource.query<any[]>(
      `INSERT INTO students
        (tenant_id, first_name, last_name, date_of_birth, gender, nationality,
         national_id_reference, email, phone_primary, phone_secondary,
         city, address, status, assigned_to_user_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'lead',$13,$14)
       RETURNING id, tenant_id, first_name, last_name, email, phone_primary, status, created_at`,
      [
        tenantId, dto.firstName, dto.lastName, dto.dateOfBirth,
        dto.gender, dto.nationality, nationalIdRef,
        dto.email, dto.phonePrimary, dto.phoneSecondary,
        dto.city, dto.address, dto.assignedToUserId, createdBy,
      ],
    );

    // Create profile
    await this.dataSource.query(
      `INSERT INTO student_profiles (student_id, academic_level, preferred_language)
       VALUES ($1, $2, $3)`,
      [student.id, dto.academicLevel, dto.preferredLanguage || 'fr'],
    );

    await this.audit(tenantId, createdBy, 'student.created', student.id, null, {
      firstName: dto.firstName, lastName: dto.lastName, email: dto.email,
    });

    return student;
  }

  /**
   * Self-service lookup for the logged-in student portal user — resolves via
   * students.user_id (the JWT identity), mirroring the guarantors.my-student
   * pattern. Never trust a client-supplied student id here.
   */
  async findMe(userId: string, tenantId: string) {
    // Phase 10 — the Bronze Dashboard checklist (§ FORSA_OPERATIONS_MANUAL.md
    // "Bronze Dashboard Next Steps") needs to know whether the student has
    // any guarantor relationship at all (and its status) without a second
    // round trip, so the "Invite Guarantor" checklist item can reflect
    // reality instead of always showing as incomplete.
    // academic_level lives on student_profiles, not students — this join
    // was missing entirely, so it was never returned here regardless of
    // whether it was ever set (discovered during manual pilot testing
    // alongside the fact that the real student-provisioning path never
    // created a student_profiles row in the first place — see approve()
    // in membership.service.ts).
    const [student] = await this.dataSource.query<any[]>(
      `SELECT s.*, sp.academic_level, fs.aggregate_score, fs.score_band,
              json_agg(DISTINCT jsonb_build_object(
                'id', sg.id, 'status', sg.status, 'guarantorId', g.id,
                'fullName', g.first_name || ' ' || g.last_name, 'email', g.email,
                'portalActivated', g.portal_activated
              )) FILTER (WHERE sg.id IS NOT NULL AND sg.status != 'withdrawn') AS guarantors
       FROM students s
       LEFT JOIN student_profiles sp ON sp.student_id = s.id
       LEFT JOIN forsa_scores fs ON fs.student_id = s.id
       LEFT JOIN student_guarantors sg ON sg.student_id = s.id
       LEFT JOIN guarantors g ON g.id = sg.guarantor_id
       WHERE s.user_id = $1 AND s.tenant_id = $2
       GROUP BY s.id, sp.academic_level, fs.id`,
      [userId, tenantId],
    );
    if (!student) throw new NotFoundException('No student profile linked to this user');
    delete student.national_id_reference;
    return student;
  }

  /**
   * Self-service profile completion — discovered missing during manual
   * pilot testing: there was no way whatsoever for a student to edit their
   * own nationality/date of birth/academic level/phone/city, so the
   * Dashboard's "Complete Profile" checklist item pointed at a page with
   * nothing editable on it. Upserts into student_profiles for
   * academicLevel since that row may not exist for students provisioned
   * before this fix.
   */
  async updateMyProfile(userId: string, tenantId: string, dto: any) {
    const student = await this.findMe(userId, tenantId);

    await this.dataSource.query(
      `UPDATE students
       SET phone_primary = COALESCE($3, phone_primary),
           city = COALESCE($4, city),
           nationality = COALESCE($5, nationality),
           date_of_birth = COALESCE($6, date_of_birth),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [student.id, tenantId, dto.phonePrimary, dto.city, dto.nationality, dto.dateOfBirth],
    );

    if (dto.academicLevel) {
      await this.dataSource.query(
        `INSERT INTO student_profiles (student_id, academic_level, preferred_language)
         VALUES ($1, $2, 'fr')
         ON CONFLICT (student_id) DO UPDATE SET academic_level = $2`,
        [student.id, dto.academicLevel],
      );
    }

    await this.audit(tenantId, userId, 'student.self_updated_profile', student.id, null, dto);
    return this.findMe(userId, tenantId);
  }

  /**
   * Phase 10 — closes the gap flagged in FORSA_OPERATIONS_MANUAL.md: the
   * "do you have a guarantor?" question in the Apply wizard never actually
   * triggered an invitation, and adding one otherwise required a staff
   * member acting on the student's behalf. This lets the student invite
   * their own guarantor directly — same validation, same secure-token
   * invite, same email — with the studentId resolved from the caller's own
   * JWT identity, never trusted from the request body.
   */
  async addMyGuarantor(userId: string, tenantId: string, dto: any) {
    const student = await this.findMe(userId, tenantId);
    return this.addGuarantor(student.id, tenantId, dto, userId);
  }

  async resendMyGuarantorInvite(userId: string, tenantId: string, guarantorId: string) {
    const student = await this.findMe(userId, tenantId);
    return this.resendGuarantorInvite(student.id, guarantorId, tenantId, userId);
  }

  async findAll(tenantId: string, pagination: PaginationDto, filters: any = {}) {
    const { page = 1, limit = 20 } = pagination;
    const offset = getSkip(page, limit);
    const params: any[] = [tenantId];
    let whereExtra = '';

    if (filters.status) {
      params.push(filters.status);
      whereExtra += ` AND s.status = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      whereExtra += ` AND (s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length} OR s.email ILIKE $${params.length})`;
    }

    if (filters.universityId) {
      params.push(filters.universityId);
      whereExtra += ` AND EXISTS (SELECT 1 FROM applications a WHERE a.student_id = s.id AND a.university_id = $${params.length})`;
    }

    const [data, [count]] = await Promise.all([
      this.dataSource.query(
        `SELECT s.id, s.first_name, s.last_name, s.email, s.phone_primary,
                s.status, s.city, s.created_at, s.membership_status, s.forsa_id,
                fs.aggregate_score, fs.score_band,
                a.current_status AS application_status,
                u.name AS university_name
         FROM students s
         LEFT JOIN forsa_scores fs ON fs.student_id = s.id
         LEFT JOIN applications a ON a.id = s.created_from_application_id
         LEFT JOIN universities u ON u.id = a.university_id
         WHERE s.tenant_id = $1 ${whereExtra}
         ORDER BY s.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) FROM students s WHERE s.tenant_id = $1 ${whereExtra}`,
        params,
      ),
    ]);

    return paginate(data, parseInt(count.count), page, limit);
  }

  async findOne(id: string, tenantId: string, includePii = false) {
    const [student] = await this.dataSource.query<any[]>(
      `SELECT s.*,
              sp.*,
              fs.aggregate_score, fs.score_band, fs.ceiling_active,
              json_agg(DISTINCT jsonb_build_object(
                'id', sg.id, 'role', sg.role, 'status', sg.status,
                'guarantorId', g.id, 'fullName', g.first_name || ' ' || g.last_name,
                'email', g.email, 'employmentStatus', g.employment_status, 'riskLevel', g.risk_level,
                'inviteSentAt', g.invite_sent_at, 'inviteExpiresAt', g.invite_token_expires_at,
                'portalActivated', g.portal_activated
              )) FILTER (WHERE sg.id IS NOT NULL AND sg.status != 'withdrawn') AS guarantors
       FROM students s
       LEFT JOIN student_profiles sp ON sp.student_id = s.id
       LEFT JOIN forsa_scores fs ON fs.student_id = s.id
       LEFT JOIN student_guarantors sg ON sg.student_id = s.id
       LEFT JOIN guarantors g ON g.id = sg.guarantor_id
       WHERE s.id = $1 AND s.tenant_id = $2
       GROUP BY s.id, sp.id, fs.id`,
      [id, tenantId],
    );

    if (!student) throw new NotFoundException('Student not found');

    // Decrypt PII only if explicitly requested and authorized
    if (includePii && student.national_id_reference) {
      try {
        student.nationalId = decrypt(
          student.national_id_reference,
          this.configService.get<string>('encryption.piiKey')!,
        );
      } catch {
        student.nationalId = '[decryption error]';
      }
    }

    // Never return encrypted reference to client
    delete student.national_id_reference;

    return student;
  }

  async update(id: string, tenantId: string, dto: any, updatedBy: string) {
    const student = await this.findOne(id, tenantId);

    const [updated] = await this.dataSource.query<any[]>(
      `UPDATE students
       SET first_name = COALESCE($3, first_name),
           last_name = COALESCE($4, last_name),
           email = COALESCE($5, email),
           phone_primary = COALESCE($6, phone_primary),
           phone_secondary = COALESCE($7, phone_secondary),
           city = COALESCE($8, city),
           address = COALESCE($9, address),
           assigned_to_user_id = COALESCE($10, assigned_to_user_id),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, first_name, last_name, email, status`,
      [id, tenantId, dto.firstName, dto.lastName, dto.email,
       dto.phonePrimary, dto.phoneSecondary, dto.city, dto.address, dto.assignedToUserId],
    );

    await this.audit(tenantId, updatedBy, 'student.updated', id, null, dto);
    return updated;
  }

  async addGuarantor(studentId: string, tenantId: string, dto: any, addedBy: string) {
    // Verify student
    const student = await this.findOne(studentId, tenantId);

    if (!dto.email) {
      throw new BadRequestException('email is required — the invite link is sent there');
    }
    if (!dto.firstName || !dto.lastName) {
      throw new BadRequestException('firstName and lastName are required');
    }

    const [existingByEmail] = await this.dataSource.query<any[]>(
      `SELECT id FROM guarantors WHERE tenant_id = $1 AND email = $2`,
      [tenantId, dto.email],
    );
    if (existingByEmail) {
      throw new BadRequestException('A guarantor with this email has already been added');
    }

    const nationalIdRef = dto.nationalId
      ? encrypt(dto.nationalId, this.configService.get<string>('encryption.piiKey')!)
      : null;

    // Guarantors never self-register from scratch — a guarantor row (and
    // the invite that activates it) can only be created here, by staff,
    // for a specific student. See guarantors.service.ts's invite/accept/
    // decline flow for the other half of this.
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = addDays(new Date(), GUARANTOR_INVITE_TTL_DAYS);

    const [guarantor] = await this.dataSource.query<any[]>(
      `INSERT INTO guarantors
        (tenant_id, first_name, last_name, date_of_birth, national_id_reference,
         relationship_to_student, employment_status, employer_name, income_stability,
         email, phone_primary, contact_reliability, risk_level, document_status, created_by,
         invite_token, invite_sent_at, invite_token_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'unknown','unknown','pending',$12,$13,NOW(),$14)
       RETURNING id, email`,
      [
        tenantId, dto.firstName, dto.lastName, dto.dateOfBirth, nationalIdRef,
        dto.relationship, dto.employmentStatus, dto.employerName, dto.incomeStability,
        dto.email, dto.phone, addedBy, tokenHash, expiresAt,
      ],
    );

    const [link] = await this.dataSource.query<any[]>(
      `INSERT INTO student_guarantors
        (student_id, guarantor_id, role, status, effective_date, added_by)
       VALUES ($1,$2,$3,'pending_invitation',CURRENT_DATE,$4)
       RETURNING *`,
      [studentId, guarantor.id, dto.role || 'primary', addedBy],
    );

    await this.audit(tenantId, addedBy, 'student.guarantor.added', studentId, null,
      { guarantorId: guarantor.id, role: dto.role });

    await this.sendGuarantorInviteEmail(tenantId, guarantor.id, guarantor.email, dto.firstName, student.first_name, addedBy, rawToken);

    return { guarantor, link };
  }

  private async sendGuarantorInviteEmail(
    tenantId: string, guarantorId: string, email: string, guarantorFirstName: string,
    studentFirstName: string, triggeredBy: string, rawToken: string,
  ) {
    const inviteUrl = `${process.env.GUARANTOR_PORTAL_URL || 'https://guarantor.forsa.tn'}/invite/${rawToken}`;
    await this.notifications.send({
      tenantId,
      recipientId: guarantorId,
      recipientEmail: email,
      channel: NotificationChannel.EMAIL,
      templateCode: 'guarantor_invited',
      variables: { guarantorFirstName, studentFirstName, inviteUrl },
      triggeredBy,
      referenceId: guarantorId,
      referenceType: 'guarantor',
    }).catch(err => this.logger.error('guarantor_invited notification failed', err));
  }

  /** Re-issue a fresh invite token/email for a guarantor still pending activation. */
  async resendGuarantorInvite(studentId: string, guarantorId: string, tenantId: string, requestedBy: string) {
    const [guarantor] = await this.dataSource.query<any[]>(
      `SELECT g.id, g.email, g.first_name, g.user_id, s.first_name AS student_first_name
       FROM guarantors g
       JOIN student_guarantors sg ON sg.guarantor_id = g.id AND sg.student_id = $2
       JOIN students s ON s.id = $2
       WHERE g.id = $1 AND g.tenant_id = $3`,
      [guarantorId, studentId, tenantId],
    );
    if (!guarantor) throw new NotFoundException('Guarantor not found for this student');
    if (guarantor.user_id) throw new BadRequestException('This guarantor has already activated their portal account');

    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = addDays(new Date(), GUARANTOR_INVITE_TTL_DAYS);

    await this.dataSource.query(
      `UPDATE guarantors SET invite_token = $2, invite_sent_at = NOW(), invite_token_expires_at = $3 WHERE id = $1`,
      [guarantorId, tokenHash, expiresAt],
    );

    await this.sendGuarantorInviteEmail(
      tenantId, guarantor.id, guarantor.email, guarantor.first_name, guarantor.student_first_name, requestedBy, rawToken,
    );

    return { success: true };
  }

  async withdrawGuarantor(
    studentId: string,
    guarantorId: string,
    tenantId: string,
    reason: string,
    reasonCode: string,
    withdrawnBy: string,
  ) {
    const [link] = await this.dataSource.query<any[]>(
      `SELECT * FROM student_guarantors
       WHERE student_id = $1 AND guarantor_id = $2 AND status = 'active'`,
      [studentId, guarantorId],
    );

    if (!link) throw new NotFoundException('Active guarantor link not found');

    // Mark existing link as withdrawn (never delete)
    await this.dataSource.query(
      `UPDATE student_guarantors
       SET status = 'withdrawn', withdrawal_date = CURRENT_DATE,
           withdrawal_reason = $3, withdrawal_reason_code = $4
       WHERE id = $5`,
      [reason, reasonCode, link.id],
    );

    // Open exceptional event
    await this.openExceptionalEvent(studentId, tenantId, {
      eventType: ExceptionalEventType.GUARANTOR_WITHDRAWAL,
      description: `Guarantor withdrawal: ${reason}`,
      affectsFinancialObligations: true,
      openedBy: withdrawnBy,
    });

    await this.audit(tenantId, withdrawnBy, 'student.guarantor.withdrawn', studentId,
      { status: 'active' }, { status: 'withdrawn', reason });
  }

  async openExceptionalEvent(studentId: string, tenantId: string, dto: any) {
    const [event] = await this.dataSource.query<any[]>(
      `INSERT INTO student_exceptional_events
        (tenant_id, student_id, event_type, event_reason_code, description,
         affects_financial_obligations, affects_contract, opened_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open')
       RETURNING *`,
      [
        tenantId, studentId, dto.eventType, dto.reasonCode, dto.description,
        dto.affectsFinancialObligations || false,
        dto.affectsContract || false,
        dto.openedBy,
      ],
    );

    await this.audit(tenantId, dto.openedBy, 'student.exceptional_event.opened', studentId,
      null, { eventType: dto.eventType, description: dto.description });

    return event;
  }

  async getExceptionalEvents(studentId: string, tenantId: string) {
    await this.findOne(studentId, tenantId);
    return this.dataSource.query(
      `SELECT see.*, u.full_name AS opened_by_name
       FROM student_exceptional_events see
       LEFT JOIN users u ON u.id = see.opened_by
       WHERE see.student_id = $1 AND see.tenant_id = $2
       ORDER BY see.opened_at DESC`,
      [studentId, tenantId],
    );
  }

  async getApplicationHistory(studentId: string, tenantId: string) {
    await this.findOne(studentId, tenantId);
    return this.dataSource.query(
      `SELECT a.*, u.name AS university_name, p.name AS program_name,
              fd.decision_result, fd.approved_level, fd.approved_amount
       FROM applications a
       LEFT JOIN universities u ON u.id = a.university_id
       LEFT JOIN programs p ON p.id = a.program_id
       LEFT JOIN financing_decisions fd ON fd.application_id = a.id
         AND fd.pipeline_run_id = a.current_pipeline_run_id
       WHERE a.student_id = $1 AND a.tenant_id = $2
       ORDER BY a.created_at DESC`,
      [studentId, tenantId],
    );
  }

  async getPaymentHistory(studentId: string, tenantId: string) {
    await this.findOne(studentId, tenantId);
    // Phase 3 (browser E2E testing) discovery — ordered by p.paid_at,
    // a column that doesn't exist on payments (the real column is
    // payment_date) — this has thrown a 500 on every call since T-219
    // built it; the "Complete Payment History" feature never actually
    // worked.
    return this.dataSource.query(
      `SELECT p.*, i.due_date, i.sequence_number, i.amount AS installment_amount,
              ps.total_amount
       FROM payments p
       JOIN installments i ON i.id = p.installment_id
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       WHERE p.student_id = $1 AND p.tenant_id = $2
       ORDER BY p.payment_date DESC`,
      [studentId, tenantId],
    );
  }

  // T-219 — self-scoped equivalent of getPaymentHistory above, resolving
  // the student id server-side from the caller's own user_id first (never
  // trusting a client-supplied id), then reusing the exact same query —
  // already spans every application/financing period, not just one.
  async findMyPayments(userId: string, tenantId: string) {
    const [student] = await this.dataSource.query<any[]>(
      `SELECT id FROM students WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    if (!student) throw new NotFoundException('No student profile linked to this user');
    return this.getPaymentHistory(student.id, tenantId);
  }

  // Phase 3 (browser E2E testing) discovery — forsa-student's HomePage.tsx
  // has called GET /students/:id and GET /students/:id/applications with
  // user.id (the auth user's own account id, not the actual students.id
  // row) since this page was first built — both are staff-only
  // (student.view). Every real student's home page has 403'd on both
  // calls since the day this page shipped, silently falling through to
  // "not a member yet"/"no application" placeholders even for a fully
  // provisioned Bronze member with a live application. GET /students/me
  // already existed (T-207-era); this is the missing applications
  // sibling, same self-scoping pattern as findMyPayments above.
  async findMyApplications(userId: string, tenantId: string) {
    const [student] = await this.dataSource.query<any[]>(
      `SELECT id FROM students WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    if (!student) throw new NotFoundException('No student profile linked to this user');
    return this.getApplicationHistory(student.id, tenantId);
  }

  private async audit(tenantId: string, userId: string, action: string, targetId: string, prev: any, next: any) {
    await this.dataSource.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, previous_value, new_value, created_at)
       VALUES ($1,$2,$3,'students','students',$4,$5,$6,NOW())`,
      [tenantId, userId, action, targetId,
       prev ? JSON.stringify(prev) : null, next ? JSON.stringify(next) : null],
    ).catch(err => this.logger.error('Audit log failed', err));
  }
}
