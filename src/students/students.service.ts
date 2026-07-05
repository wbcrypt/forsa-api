import {
  Injectable, NotFoundException, BadRequestException, ConflictException, Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { encrypt, decrypt } from '../common/utils/encryption.util';
import { hashPassword, validatePasswordComplexity } from '../common/utils/password.util';
import { ConfigService } from '@nestjs/config';
import { StudentStatus, ExceptionalEventType, SourceTrustLevel, UserStatus } from '../common/enums';
import { PaginationDto, paginate, getSkip } from '../common/utils/pagination.util';
import { RegisterStudentDto } from './dto/register-student.dto';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
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
   * T-101 — public self-registration. Creates a `students` row AND a real
   * `users` row (hashed password) in one transaction, then links them via
   * `students.user_id`, so the student portal's register -> POST /auth/login
   * flow actually works end-to-end. See DECISIONS.md D-001 for why this is
   * intentionally a minimal, Phase-1-only shape rather than the full
   * membership-request flow.
   */
  async registerSelf(dto: RegisterStudentDto) {
    validatePasswordComplexity(dto.password);

    const existing = await this.dataSource.query<any[]>(
      `SELECT id FROM users WHERE tenant_id = $1 AND email = $2`,
      [dto.tenantId, dto.email],
    );
    if (existing.length) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await hashPassword(dto.password);

    return this.dataSource.transaction(async (manager) => {
      const [student] = await manager.query<any[]>(
        `INSERT INTO students
          (tenant_id, first_name, last_name, date_of_birth, nationality,
           email, phone_primary, city, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'lead')
         RETURNING id, tenant_id, first_name, last_name, email, status, created_at`,
        [
          dto.tenantId, dto.firstName, dto.lastName, dto.dateOfBirth || null,
          dto.nationality || null, dto.email, dto.phonePrimary || null, dto.city || null,
        ],
      );

      if (dto.academicLevel) {
        await manager.query(
          `INSERT INTO student_profiles (student_id, academic_level, preferred_language)
           VALUES ($1, $2, 'fr')`,
          [student.id, dto.academicLevel],
        );
      }

      const [user] = await manager.query<any[]>(
        `INSERT INTO users
          (tenant_id, email, email_verified, password_hash, full_name, status,
           must_change_password, portal_type, student_id_linked)
         VALUES ($1,$2,false,$3,$4,$5,false,'student',$6)
         RETURNING id, email`,
        [
          dto.tenantId, dto.email, passwordHash,
          `${dto.firstName} ${dto.lastName}`.trim(),
          UserStatus.PENDING_VERIFICATION, student.id,
        ],
      );

      await manager.query(
        `UPDATE students SET user_id = $2 WHERE id = $1`,
        [student.id, user.id],
      );

      await manager.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, new_value, created_at)
         VALUES ($1,$2,'student.self_registered','students','students',$3,$4,NOW())`,
        [dto.tenantId, user.id, student.id, JSON.stringify({ email: dto.email })],
      ).catch(() => {});

      return { studentId: student.id, userId: user.id, email: user.email };
    });
  }

  /**
   * Self-service lookup for the logged-in student portal user — resolves via
   * students.user_id (the JWT identity), mirroring the guarantors.my-student
   * pattern. Never trust a client-supplied student id here.
   */
  async findMe(userId: string, tenantId: string) {
    const [student] = await this.dataSource.query<any[]>(
      `SELECT s.*, fs.aggregate_score, fs.score_band
       FROM students s
       LEFT JOIN forsa_scores fs ON fs.student_id = s.id
       WHERE s.user_id = $1 AND s.tenant_id = $2`,
      [userId, tenantId],
    );
    if (!student) throw new NotFoundException('No student profile linked to this user');
    delete student.national_id_reference;
    return student;
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
                s.status, s.city, s.created_at,
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
                'employmentStatus', g.employment_status, 'riskLevel', g.risk_level
              )) FILTER (WHERE sg.id IS NOT NULL AND sg.status = 'active') AS guarantors
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
    await this.findOne(studentId, tenantId);

    const nationalIdRef = dto.nationalId
      ? encrypt(dto.nationalId, this.configService.get<string>('encryption.piiKey')!)
      : null;

    const [guarantor] = await this.dataSource.query<any[]>(
      `INSERT INTO guarantors
        (tenant_id, first_name, last_name, date_of_birth, national_id_reference,
         relationship_to_student, employment_status, employer_name, income_stability,
         email, phone_primary, contact_reliability, risk_level, document_status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'unknown','unknown','pending',$12)
       RETURNING id`,
      [
        tenantId, dto.firstName, dto.lastName, dto.dateOfBirth, nationalIdRef,
        dto.relationship, dto.employmentStatus, dto.employerName, dto.incomeStability,
        dto.email, dto.phone, addedBy,
      ],
    );

    const [link] = await this.dataSource.query<any[]>(
      `INSERT INTO student_guarantors
        (student_id, guarantor_id, role, status, effective_date, added_by)
       VALUES ($1,$2,$3,'active',CURRENT_DATE,$4)
       RETURNING *`,
      [studentId, guarantor.id, dto.role || 'primary', addedBy],
    );

    await this.audit(tenantId, addedBy, 'student.guarantor.added', studentId, null,
      { guarantorId: guarantor.id, role: dto.role });

    return { guarantor, link };
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
    return this.dataSource.query(
      `SELECT p.*, i.due_date, i.sequence_number, i.amount AS installment_amount,
              ps.total_amount
       FROM payments p
       JOIN installments i ON i.id = p.installment_id
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       WHERE p.student_id = $1 AND p.tenant_id = $2
       ORDER BY p.paid_at DESC`,
      [studentId, tenantId],
    );
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
