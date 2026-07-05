import {
  Injectable, NotFoundException, ConflictException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UniversityStatus, PaymentModelType } from '../common/enums';
import { PaginationDto, paginate, getSkip } from '../common/utils/pagination.util';

@Injectable()
export class UniversitiesService {
  private readonly logger = new Logger(UniversitiesService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(dto: any, tenantId: string, createdBy: string) {
    const [existing] = await this.dataSource.query<any[]>(
      `SELECT id FROM universities WHERE tenant_id = $1 AND name = $2`,
      [tenantId, dto.name],
    );
    if (existing) throw new ConflictException('University with this name already exists');

    const [university] = await this.dataSource.query<any[]>(
      `INSERT INTO universities
        (tenant_id, name, short_name, country_code, city, address, website,
         accreditation_status, accreditation_body, status, risk_level, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        tenantId, dto.name, dto.shortName, dto.countryCode, dto.city,
        dto.address, dto.website, dto.accreditationStatus, dto.accreditationBody,
        dto.status || UniversityStatus.PROSPECT, dto.riskLevel || 'standard',
        dto.notes, createdBy,
      ],
    );

    await this.auditLog(tenantId, createdBy, 'university.created', university.id, null, dto);
    return university;
  }

  // Phase 2 T-203 — public, minimal projection only (no PII, no financial/
  // agreement data) for the anonymous Membership Request form.
  async findAllPublic(tenantId: string) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return this.dataSource.query(
      `SELECT id, name, city FROM universities
       WHERE tenant_id = $1 AND status = $2
       ORDER BY name ASC`,
      [tenantId, UniversityStatus.ACTIVE],
    );
  }

  async findAll(tenantId: string, pagination: PaginationDto, filters?: any) {
    const { page = 1, limit = 20 } = pagination;
    const offset = getSkip(page, limit);

    let whereClause = 'WHERE u.tenant_id = $1';
    const params: any[] = [tenantId];

    if (filters?.status) {
      params.push(filters.status);
      whereClause += ` AND u.status = $${params.length}`;
    }

    if (filters?.search) {
      params.push(`%${filters.search}%`);
      whereClause += ` AND (u.name ILIKE $${params.length} OR u.city ILIKE $${params.length})`;
    }

    const [data, [count]] = await Promise.all([
      this.dataSource.query(
        `SELECT u.*,
                COUNT(DISTINCT a.id) FILTER (WHERE a.current_status = 'active_student') AS active_students,
                COUNT(DISTINCT ua.id) FILTER (WHERE ua.status = 'active') AS active_agreements
         FROM universities u
         LEFT JOIN applications a ON a.university_id = u.id
         LEFT JOIN university_agreements ua ON ua.university_id = u.id
         ${whereClause}
         GROUP BY u.id
         ORDER BY u.name ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) FROM universities u ${whereClause}`,
        params,
      ),
    ]);

    return paginate(data, parseInt(count.count), page, limit);
  }

  async findOne(id: string, tenantId: string) {
    const [university] = await this.dataSource.query<any[]>(
      `SELECT u.*,
              json_agg(DISTINCT uc.*) FILTER (WHERE uc.id IS NOT NULL) AS contacts,
              json_agg(DISTINCT ua.*) FILTER (WHERE ua.id IS NOT NULL) AS agreements
       FROM universities u
       LEFT JOIN university_contacts uc ON uc.university_id = u.id AND uc.status = 'active'
       LEFT JOIN university_agreements ua ON ua.university_id = u.id
       WHERE u.id = $1 AND u.tenant_id = $2
       GROUP BY u.id`,
      [id, tenantId],
    );
    if (!university) throw new NotFoundException('University not found');
    return university;
  }

  async update(id: string, tenantId: string, dto: any, updatedBy: string) {
    const university = await this.findOne(id, tenantId);

    const [updated] = await this.dataSource.query<any[]>(
      `UPDATE universities
       SET name = COALESCE($3, name),
           short_name = COALESCE($4, short_name),
           city = COALESCE($5, city),
           address = COALESCE($6, address),
           website = COALESCE($7, website),
           status = COALESCE($8, status),
           risk_level = COALESCE($9, risk_level),
           notes = COALESCE($10, notes),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [
        id, tenantId, dto.name, dto.shortName, dto.city,
        dto.address, dto.website, dto.status, dto.riskLevel, dto.notes,
      ],
    );

    await this.auditLog(tenantId, updatedBy, 'university.updated', id, university, dto);
    return updated;
  }

  async createAgreement(universityId: string, tenantId: string, dto: any, createdBy: string) {
    const university = await this.findOne(universityId, tenantId);

    // Validate payment model
    if (!Object.values(PaymentModelType).includes(dto.paymentModel)) {
      throw new BadRequestException(`Invalid payment model: ${dto.paymentModel}`);
    }

    const [agreement] = await this.dataSource.query<any[]>(
      `INSERT INTO university_agreements
        (tenant_id, university_id, version, payment_model, refund_policy,
         discount_percentage, referral_commission, financing_levels,
         max_financing_amount, currency, effective_date, expiration_date,
         status, notes, created_by)
       VALUES ($1,$2,
         (SELECT COALESCE(MAX(version), 0) + 1 FROM university_agreements
          WHERE university_id = $3),
         $4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13,$14)
       RETURNING *`,
      [
        tenantId, universityId, universityId,
        dto.paymentModel,
        JSON.stringify(dto.refundPolicy || {}),
        dto.discountPercentage || null,
        JSON.stringify(dto.referralCommission || {}),
        dto.financingLevels || ['level1', 'level2', 'level3'],
        dto.maxFinancingAmount || null,
        dto.currency || 'TND',
        dto.effectiveDate,
        dto.expirationDate || null,
        dto.notes, createdBy,
      ],
    );

    // Create tranches if hybrid/tranche model
    if (
      dto.paymentModel === PaymentModelType.TRANCHE ||
      dto.paymentModel === PaymentModelType.HYBRID
    ) {
      if (!dto.tranches?.length) {
        throw new BadRequestException('Tranches required for tranche/hybrid payment model');
      }

      // Validate tranches sum to 100%
      const totalPercentage = dto.tranches.reduce((sum: number, t: any) => sum + t.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new BadRequestException('Tranche percentages must sum to 100%');
      }

      for (const tranche of dto.tranches) {
        await this.dataSource.query(
          `INSERT INTO agreement_tranches
            (agreement_id, tranche_sequence, percentage, trigger_type,
             trigger_condition, due_days_offset, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            agreement.id, tranche.sequence, tranche.percentage,
            tranche.triggerType, JSON.stringify(tranche.triggerCondition || {}),
            tranche.dueDaysOffset, tranche.notes,
          ],
        );
      }
    }

    await this.auditLog(tenantId, createdBy, 'university.agreement.created', agreement.id, null, dto);
    return agreement;
  }

  async approveAgreement(agreementId: string, tenantId: string, approvedBy: string) {
    const [agreement] = await this.dataSource.query<any[]>(
      `SELECT * FROM university_agreements WHERE id = $1 AND tenant_id = $2`,
      [agreementId, tenantId],
    );
    if (!agreement) throw new NotFoundException('Agreement not found');
    if (agreement.status !== 'draft') throw new BadRequestException('Agreement must be in draft status to approve');

    // Deactivate previous active agreement for same university
    await this.dataSource.query(
      `UPDATE university_agreements
       SET status = 'expired'
       WHERE university_id = $1 AND status = 'active' AND id != $2`,
      [agreement.university_id, agreementId],
    );

    const [updated] = await this.dataSource.query<any[]>(
      `UPDATE university_agreements
       SET status = 'active', signed_by_forsa = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [agreementId, tenantId, approvedBy],
    );

    await this.auditLog(tenantId, approvedBy, 'university.agreement.approved', agreementId, agreement, { status: 'active' });
    return updated;
  }

  async getActiveAgreement(universityId: string, tenantId: string) {
    const [agreement] = await this.dataSource.query<any[]>(
      `SELECT ua.*, json_agg(at.*) FILTER (WHERE at.id IS NOT NULL) AS tranches
       FROM university_agreements ua
       LEFT JOIN agreement_tranches at ON at.agreement_id = ua.id
       WHERE ua.university_id = $1 AND ua.tenant_id = $2 AND ua.status = 'active'
       GROUP BY ua.id
       ORDER BY ua.effective_date DESC
       LIMIT 1`,
      [universityId, tenantId],
    );
    return agreement || null;
  }

  async addContact(universityId: string, tenantId: string, dto: any) {
    // Verify university exists
    await this.findOne(universityId, tenantId);

    const [contact] = await this.dataSource.query<any[]>(
      `INSERT INTO university_contacts
        (university_id, full_name, title, role, email, phone, is_primary, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active')
       RETURNING *`,
      [universityId, dto.fullName, dto.title, dto.role, dto.email, dto.phone, dto.isPrimary || false],
    );

    return contact;
  }

  async getPerformance(universityId: string, tenantId: string) {
    const [stats] = await this.dataSource.query<any[]>(
      `SELECT
         COUNT(DISTINCT a.id) AS total_applications,
         COUNT(DISTINCT a.id) FILTER (WHERE a.current_status = 'active_student') AS active_students,
         COUNT(DISTINCT a.id) FILTER (WHERE a.current_status = 'completed') AS completed_students,
         COALESCE(SUM(ud.amount) FILTER (WHERE ud.status = 'disbursed'), 0) AS total_disbursed,
         COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'confirmed'), 0) AS total_collected,
         COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'defaulted') AS defaulted_installments
       FROM universities u
       LEFT JOIN applications a ON a.university_id = u.id AND a.tenant_id = $2
       LEFT JOIN university_disbursements ud ON ud.university_id = u.id AND ud.tenant_id = $2
       LEFT JOIN payment_schedules ps ON ps.application_id = a.id
       LEFT JOIN installments i ON i.payment_schedule_id = ps.id
       LEFT JOIN payments p ON p.installment_id = i.id
       WHERE u.id = $1 AND u.tenant_id = $2`,
      [universityId, tenantId],
    );

    return stats;
  }

  async createProgram(universityId: string, tenantId: string, dto: any) {
    await this.findOne(universityId, tenantId);

    const [program] = await this.dataSource.query<any[]>(
      `INSERT INTO programs
        (university_id, name, code, level, duration_years, tuition_min,
         tuition_max, currency, accreditation_status, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
       RETURNING *`,
      [
        universityId, dto.name, dto.code, dto.level,
        dto.durationYears, dto.tuitionMin, dto.tuitionMax,
        dto.currency || 'TND', dto.accreditationStatus,
      ],
    );

    return program;
  }

  async findPrograms(universityId: string, tenantId: string) {
    await this.findOne(universityId, tenantId);
    return this.dataSource.query(
      `SELECT * FROM programs WHERE university_id = $1 AND status = 'active' ORDER BY name`,
      [universityId],
    );
  }

  // Business Continuity — operate at institution/faculty/program level
  async initiateBusinessContinuity(
    universityId: string,
    tenantId: string,
    dto: {
      level: 'institution' | 'faculty' | 'program';
      programId?: string;
      reason: string;
      eventType: string;
    },
    initiatedBy: string,
  ) {
    // Open exceptional events for all affected students
    const affectedStudents = await this.dataSource.query<any[]>(
      dto.level === 'institution'
        ? `SELECT DISTINCT a.student_id
           FROM applications a
           WHERE a.university_id = $1 AND a.tenant_id = $2
             AND a.current_status IN ('active_student','contract_signed','university_paid')`
        : `SELECT DISTINCT a.student_id
           FROM applications a
           WHERE a.university_id = $1 AND a.tenant_id = $2
             AND a.program_id = $3
             AND a.current_status IN ('active_student','contract_signed','university_paid')`,
      dto.level === 'institution'
        ? [universityId, tenantId]
        : [universityId, tenantId, dto.programId],
    );

    const eventIds: string[] = [];
    for (const student of affectedStudents) {
      const [event] = await this.dataSource.query<any[]>(
        `INSERT INTO student_exceptional_events
          (tenant_id, student_id, event_type, description, affects_financial_obligations,
           opened_by, status)
         VALUES ($1,$2,$3,$4,true,$5,'open')
         RETURNING id`,
        [
          tenantId, student.student_id, dto.eventType,
          `Business continuity event: ${dto.reason}`, initiatedBy,
        ],
      );
      eventIds.push(event.id);
    }

    await this.auditLog(
      tenantId, initiatedBy, 'university.business_continuity.initiated',
      universityId, null, { ...dto, affectedStudents: affectedStudents.length },
    );

    return {
      affectedStudents: affectedStudents.length,
      exceptionalEventIds: eventIds,
      message: `Business continuity initiated for ${affectedStudents.length} students`,
    };
  }

  private async auditLog(
    tenantId: string, userId: string, action: string,
    targetId: string, previous: any, next: any,
  ) {
    await this.dataSource.query(
      `INSERT INTO audit_logs
        (tenant_id, user_id, action_type, module, target_entity, target_id,
         previous_value, new_value, created_at)
       VALUES ($1,$2,$3,'universities','universities',$4,$5,$6,NOW())`,
      [tenantId, userId, action, targetId,
       previous ? JSON.stringify(previous) : null,
       next ? JSON.stringify(next) : null],
    ).catch(err => this.logger.error('Audit log failed', err));
  }
}
