import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApplicationStatus, FinancingLevel, NotificationChannel } from '../common/enums';
import { PaginationDto, paginate, getSkip } from '../common/utils/pagination.util';
import { NotificationsService } from '../notifications/notifications.service';
import { computeHouseholdStabilityScore, deriveRecommendation } from '../ai/household-stability.util';

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

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  // T-106 — fire-and-forget email notification. Failures are logged, never
  // thrown: a notification going down must not break the underlying
  // business transaction that triggered it.
  private async notifyStudent(
    tenantId: string,
    studentId: string,
    templateCode: string,
    variables: Record<string, unknown>,
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
      referenceType: 'application',
    }).catch(err => this.logger.error(`Notification ${templateCode} failed`, err));
  }

  async create(dto: any, tenantId: string, createdBy: string) {
    // T-211/D-003 — never trust a client-supplied aiScoreOverall directly:
    // recompute the weighted Household Stability score server-side from
    // the AI's raw per-dimension scores using the approved, centralized
    // weights (household-stability.util.ts), rather than storing whatever
    // number the frontend (or the LLM's own unreliable arithmetic) sent.
    // Falls back to null — same as the K-18 demo-mode case — if the
    // report is missing, malformed, or itself demo_mode (never fabricate
    // a score either way).
    let parsedAiReport: any = null;
    if (dto.aiReport) {
      try {
        parsedAiReport = typeof dto.aiReport === 'string' ? JSON.parse(dto.aiReport) : dto.aiReport;
      } catch {
        parsedAiReport = null;
      }
    }
    const aiScoreOverall = parsedAiReport && parsedAiReport.demo_mode !== true
      ? computeHouseholdStabilityScore(parsedAiReport.scores)
      : null;
    const aiRecommendation = deriveRecommendation(aiScoreOverall);

    const [application] = await this.dataSource.query<any[]>(
      `INSERT INTO applications
        (tenant_id, student_id, university_id, program_id,
         referral_source_id, partner_id, campaign_id,
         tuition_amount, requested_support_amount, currency,
         academic_year, current_status, lead_date, is_renewal,
         previous_application_id, assigned_to_user_id, created_by,
         ai_score_overall, ai_recommendation, ai_report,
         interview_language, interview_transcript)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'new_lead',CURRENT_DATE,$12,$13,$14,$15,
               $16,$17,$18,$19,$20)
       RETURNING *`,
      [
        tenantId, dto.studentId, dto.universityId, dto.programId,
        dto.referralSourceId, dto.partnerId, dto.campaignId,
        dto.tuitionAmount, dto.requestedSupportAmount, dto.currency || 'TND',
        dto.academicYear, dto.isRenewal || false,
        dto.previousApplicationId, dto.assignedToUserId, createdBy,
        aiScoreOverall, aiRecommendation,
        dto.aiReport ? (typeof dto.aiReport === 'string' ? dto.aiReport : JSON.stringify(dto.aiReport)) : null,
        dto.interviewLanguage ?? null, dto.interviewTranscript ?? null,
      ],
    );

    // Record initial status
    await this.dataSource.query(
      `INSERT INTO application_status_history (application_id, to_status, changed_by, notes)
       VALUES ($1, 'new_lead', $2, 'Application created')`,
      [application.id, createdBy],
    );

    await this.audit(tenantId, createdBy, 'application.created', application.id, null, dto);

    await this.notifyStudent(tenantId, application.student_id, 'application_created', {
      applicationId: application.id,
    });

    return application;
  }

  // T-207 — self-scoped Financing Request submission for the student
  // portal. This is the route real students must use (the generic
  // create() above is @RequirePermissions('application.create')-gated —
  // a staff-only CRM lead-creation permission a self-registered student
  // never holds, since no role is ever assigned to those accounts today).
  // Resolves studentId server-side from the caller's own user_id, never a
  // client-supplied value, and gates on active membership (D-004: a
  // Visitor/non-member cannot reach financing).
  async createForSelf(userId: string, tenantId: string, dto: any) {
    const [student] = await this.dataSource.query<any[]>(
      `SELECT id, membership_status FROM students WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );
    if (!student) throw new NotFoundException('No student profile linked to this user');

    if (!['bronze', 'silver', 'gold'].includes(student.membership_status)) {
      throw new ForbiddenException(
        student.membership_status === 'blacklisted'
          ? 'This account cannot submit financing requests.'
          : 'Submit a Membership Request and wait for Bronze approval before requesting financing.',
      );
    }

    return this.create({ ...dto, studentId: student.id }, tenantId, userId);
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

    const approvedLevelByStatus: Partial<Record<ApplicationStatus, number>> = {
      [ApplicationStatus.APPROVED_LEVEL1]: 1,
      [ApplicationStatus.APPROVED_LEVEL2]: 2,
      [ApplicationStatus.APPROVED_LEVEL3]: 3,
    };
    if (newStatus in approvedLevelByStatus) {
      await this.notifyStudent(tenantId, application.student_id, 'application_approved', {
        programName: application.program_name || 'your program',
        universityName: application.university_name,
        approvedLevel: approvedLevelByStatus[newStatus],
      });
    } else if (newStatus === ApplicationStatus.REJECTED) {
      await this.notifyStudent(tenantId, application.student_id, 'application_rejected', {
        rejectionReason: notes || 'Not specified',
      });
    }

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
