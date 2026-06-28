import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApplicationStatus, FinancingLevel } from '../common/enums';
import { PaginationDto, paginate, getSkip } from '../common/utils/pagination.util';

// Valid status transitions (state machine)
const STATUS_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  [ApplicationStatus.NEW_LEAD]: [ApplicationStatus.CONTACTED, ApplicationStatus.WAITING_FOR_DOCUMENTS],
  [ApplicationStatus.CONTACTED]: [ApplicationStatus.WAITING_FOR_DOCUMENTS, ApplicationStatus.REJECTED],
  [ApplicationStatus.WAITING_FOR_DOCUMENTS]: [ApplicationStatus.DOCUMENTS_RECEIVED, ApplicationStatus.ON_HOLD],
  [ApplicationStatus.DOCUMENTS_RECEIVED]: [ApplicationStatus.UNDER_REVIEW],
  [ApplicationStatus.UNDER_REVIEW]: [
    ApplicationStatus.APPROVED_LEVEL1, ApplicationStatus.APPROVED_LEVEL2,
    ApplicationStatus.APPROVED_LEVEL3, ApplicationStatus.REJECTED,
    ApplicationStatus.ON_HOLD, ApplicationStatus.WAITING_FOR_DOCUMENTS,
    ApplicationStatus.CAPITAL_QUEUE,
  ],
  [ApplicationStatus.APPROVED_LEVEL1]: [ApplicationStatus.CONTRACT_SENT, ApplicationStatus.ON_HOLD],
  [ApplicationStatus.APPROVED_LEVEL2]: [ApplicationStatus.CONTRACT_SENT, ApplicationStatus.ON_HOLD],
  [ApplicationStatus.APPROVED_LEVEL3]: [ApplicationStatus.CONTRACT_SENT, ApplicationStatus.ON_HOLD],
  [ApplicationStatus.REJECTED]: [ApplicationStatus.APPEALING, ApplicationStatus.NEW_LEAD],
  [ApplicationStatus.ON_HOLD]: [
    ApplicationStatus.UNDER_REVIEW, ApplicationStatus.REJECTED,
    ApplicationStatus.WAITING_FOR_DOCUMENTS,
  ],
  [ApplicationStatus.CAPITAL_QUEUE]: [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.REJECTED],
  [ApplicationStatus.CONTRACT_SENT]: [ApplicationStatus.CONTRACT_SIGNED],
  [ApplicationStatus.CONTRACT_SIGNED]: [ApplicationStatus.UNIVERSITY_PAID],
  [ApplicationStatus.UNIVERSITY_PAID]: [ApplicationStatus.ACTIVE_STUDENT],
  [ApplicationStatus.ACTIVE_STUDENT]: [ApplicationStatus.COMPLETED, ApplicationStatus.WITHDRAWN],
  [ApplicationStatus.APPEALING]: [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.REJECTED],
};

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(dto: any, tenantId: string, createdBy: string) {
    const [application] = await this.dataSource.query<any[]>(
      `INSERT INTO applications
        (tenant_id, student_id, university_id, program_id,
         referral_source_id, partner_id, campaign_id,
         tuition_amount, requested_support_amount, currency,
         academic_year, current_status, lead_date, is_renewal,
         previous_application_id, assigned_to_user_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'new_lead',CURRENT_DATE,$12,$13,$14,$15)
       RETURNING *`,
      [
        tenantId, dto.studentId, dto.universityId, dto.programId,
        dto.referralSourceId, dto.partnerId, dto.campaignId,
        dto.tuitionAmount, dto.requestedSupportAmount, dto.currency || 'TND',
        dto.academicYear, dto.isRenewal || false,
        dto.previousApplicationId, dto.assignedToUserId, createdBy,
      ],
    );

    // Record initial status
    await this.dataSource.query(
      `INSERT INTO application_status_history (application_id, to_status, changed_by, notes)
       VALUES ($1, 'new_lead', $2, 'Application created')`,
      [application.id, createdBy],
    );

    await this.audit(tenantId, createdBy, 'application.created', application.id, null, dto);
    return application;
  }

  async findAll(tenantId: string, pagination: PaginationDto, filters: any = {}) {
    const { page = 1, limit = 20 } = pagination;
    const offset = getSkip(page, limit);
    const params: any[] = [tenantId];
    let whereExtra = '';

    if (filters.status) {
      params.push(filters.status);
      whereExtra += ` AND a.current_status = $${params.length}`;
    }
    if (filters.universityId) {
      params.push(filters.universityId);
      whereExtra += ` AND a.university_id = $${params.length}`;
    }
    if (filters.financingLevel) {
      params.push(filters.financingLevel);
      whereExtra += ` AND a.current_financing_level = $${params.length}`;
    }
    if (filters.assignedTo) {
      params.push(filters.assignedTo);
      whereExtra += ` AND a.assigned_to_user_id = $${params.length}`;
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      whereExtra += ` AND (s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length} OR s.email ILIKE $${params.length})`;
    }

    const [data, [count]] = await Promise.all([
      this.dataSource.query(
        `SELECT a.id, a.current_status, a.current_financing_level, a.tuition_amount,
                a.lead_date, a.academic_year, a.is_renewal,
                s.first_name, s.last_name, s.email,
                u.name AS university_name,
                p.name AS program_name,
                rs.display_name AS referral_source,
                usr.full_name AS assigned_to,
                fs.aggregate_score, fs.score_band
         FROM applications a
         JOIN students s ON s.id = a.student_id
         JOIN universities u ON u.id = a.university_id
         LEFT JOIN programs p ON p.id = a.program_id
         LEFT JOIN referral_sources rs ON rs.id = a.referral_source_id
         LEFT JOIN users usr ON usr.id = a.assigned_to_user_id
         LEFT JOIN forsa_scores fs ON fs.student_id = a.student_id
         WHERE a.tenant_id = $1 ${whereExtra}
         ORDER BY a.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) FROM applications a
         JOIN students s ON s.id = a.student_id
         WHERE a.tenant_id = $1 ${whereExtra}`,
        params,
      ),
    ]);

    return paginate(data, parseInt(count.count), page, limit);
  }

  async findOne(id: string, tenantId: string) {
    const [application] = await this.dataSource.query<any[]>(
      `SELECT a.*,
              s.first_name, s.last_name, s.email, s.phone_primary,
              u.name AS university_name, u.status AS university_status,
              p.name AS program_name, p.tuition_min, p.tuition_max,
              rs.display_name AS referral_source_name, rs.channel,
              ptr.name AS partner_name,
              fd.decision_result, fd.approved_level, fd.approved_amount,
              fd.explanation AS decision_explanation,
              fs.aggregate_score, fs.score_band
       FROM applications a
       JOIN students s ON s.id = a.student_id
       JOIN universities u ON u.id = a.university_id
       LEFT JOIN programs p ON p.id = a.program_id
       LEFT JOIN referral_sources rs ON rs.id = a.referral_source_id
       LEFT JOIN partners ptr ON ptr.id = a.partner_id
       LEFT JOIN financing_decisions fd ON fd.pipeline_run_id = a.current_pipeline_run_id
       LEFT JOIN forsa_scores fs ON fs.student_id = a.student_id
       WHERE a.id = $1 AND a.tenant_id = $2`,
      [id, tenantId],
    );

    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async transitionStatus(
    id: string,
    tenantId: string,
    newStatus: ApplicationStatus,
    changedBy: string,
    notes?: string,
    pipelineRunId?: string,
  ) {
    const application = await this.findOne(id, tenantId);
    const currentStatus = application.current_status as ApplicationStatus;

    // Validate transition
    const allowed = STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${currentStatus} → ${newStatus}`,
      );
    }

    await this.dataSource.query(
      `UPDATE applications SET current_status = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId, newStatus],
    );

    await this.dataSource.query(
      `INSERT INTO application_status_history
        (application_id, from_status, to_status, changed_by, pipeline_run_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, currentStatus, newStatus, changedBy, pipelineRunId || null, notes || null],
    );

    await this.audit(tenantId, changedBy, 'application.status.changed', id,
      { status: currentStatus }, { status: newStatus, notes });

    return { id, previousStatus: currentStatus, newStatus };
  }

  async getPipelineHistory(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.dataSource.query(
      `SELECT pr.*, pet.stage_record_ids, fd.decision_result, fd.approved_level
       FROM pipeline_runs pr
       LEFT JOIN pipeline_execution_traces pet ON pet.pipeline_run_id = pr.id
       LEFT JOIN financing_decisions fd ON fd.pipeline_run_id = pr.id
       WHERE pr.application_id = $1
       ORDER BY pr.run_number ASC`,
      [id],
    );
  }

  async getStatusHistory(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.dataSource.query(
      `SELECT ash.*, u.full_name AS changed_by_name
       FROM application_status_history ash
       LEFT JOIN users u ON u.id = ash.changed_by
       WHERE ash.application_id = $1
       ORDER BY ash.changed_at ASC`,
      [id],
    );
  }

  async assignTo(id: string, tenantId: string, assignedToUserId: string, assignedBy: string) {
    await this.findOne(id, tenantId);
    await this.dataSource.query(
      `UPDATE applications SET assigned_to_user_id = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId, assignedToUserId],
    );
    await this.audit(tenantId, assignedBy, 'application.assigned', id, null, { assignedToUserId });
    return { message: 'Application assigned' };
  }

  async submitAppeal(id: string, tenantId: string, dto: any, submittedBy: string) {
    const application = await this.findOne(id, tenantId);

    if (application.current_status !== ApplicationStatus.REJECTED) {
      throw new BadRequestException('Only rejected applications can be appealed');
    }

    // Get the most recent financing decision
    const [decision] = await this.dataSource.query<any[]>(
      `SELECT fd.id FROM financing_decisions fd
       JOIN pipeline_runs pr ON pr.id = fd.pipeline_run_id
       WHERE pr.application_id = $1
       ORDER BY pr.run_number DESC LIMIT 1`,
      [id],
    );

    if (!decision) throw new BadRequestException('No financing decision found to appeal');

    const appealDeadline = new Date();
    appealDeadline.setDate(appealDeadline.getDate() + 30); // 30 day appeal window

    const [appeal] = await this.dataSource.query<any[]>(
      `INSERT INTO application_appeals
        (tenant_id, application_id, original_decision_id, appeal_reason,
         new_evidence_description, deadline_for_review, reentry_stage)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        tenantId, id, decision.id, dto.reason,
        dto.newEvidenceDescription, appealDeadline,
        dto.reentryStage || 4,
      ],
    );

    await this.transitionStatus(id, tenantId, ApplicationStatus.APPEALING, submittedBy, 'Appeal submitted');
    await this.audit(tenantId, submittedBy, 'application.appeal.submitted', id, null, dto);

    return appeal;
  }

  private async audit(tenantId: string, userId: string, action: string, targetId: string, prev: any, next: any) {
    await this.dataSource.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, previous_value, new_value, created_at)
       VALUES ($1,$2,$3,'applications','applications',$4,$5,$6,NOW())`,
      [tenantId, userId, action, targetId,
       prev ? JSON.stringify(prev) : null, next ? JSON.stringify(next) : null],
    ).catch(err => this.logger.error('Audit log failed', err));
  }
}
