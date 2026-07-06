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
var ApplicationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const enums_1 = require("../common/enums");
const pagination_util_1 = require("../common/utils/pagination.util");
const notifications_service_1 = require("../notifications/notifications.service");
const household_stability_util_1 = require("../ai/household-stability.util");
const universities_service_1 = require("../universities/universities.service");
const STATUS_TRANSITIONS = {
    [enums_1.ApplicationStatus.NEW_LEAD]: [
        enums_1.ApplicationStatus.CONTACTED, enums_1.ApplicationStatus.WAITING_FOR_DOCUMENTS, enums_1.ApplicationStatus.UNDER_REVIEW,
    ],
    [enums_1.ApplicationStatus.CONTACTED]: [enums_1.ApplicationStatus.WAITING_FOR_DOCUMENTS, enums_1.ApplicationStatus.REJECTED],
    [enums_1.ApplicationStatus.WAITING_FOR_DOCUMENTS]: [enums_1.ApplicationStatus.DOCUMENTS_RECEIVED, enums_1.ApplicationStatus.ON_HOLD],
    [enums_1.ApplicationStatus.DOCUMENTS_RECEIVED]: [enums_1.ApplicationStatus.UNDER_REVIEW],
    [enums_1.ApplicationStatus.UNDER_REVIEW]: [
        enums_1.ApplicationStatus.APPROVED_LEVEL1, enums_1.ApplicationStatus.APPROVED_LEVEL2,
        enums_1.ApplicationStatus.APPROVED_LEVEL3, enums_1.ApplicationStatus.REJECTED,
        enums_1.ApplicationStatus.ON_HOLD, enums_1.ApplicationStatus.WAITING_FOR_DOCUMENTS,
        enums_1.ApplicationStatus.CAPITAL_QUEUE, enums_1.ApplicationStatus.MORE_INFO_REQUIRED,
        enums_1.ApplicationStatus.FRAUD_FLAGGED,
    ],
    [enums_1.ApplicationStatus.MORE_INFO_REQUIRED]: [
        enums_1.ApplicationStatus.UNDER_REVIEW, enums_1.ApplicationStatus.REJECTED,
    ],
    [enums_1.ApplicationStatus.APPROVED_LEVEL1]: [enums_1.ApplicationStatus.CONTRACT_SENT, enums_1.ApplicationStatus.ON_HOLD],
    [enums_1.ApplicationStatus.APPROVED_LEVEL2]: [enums_1.ApplicationStatus.CONTRACT_SENT, enums_1.ApplicationStatus.ON_HOLD],
    [enums_1.ApplicationStatus.APPROVED_LEVEL3]: [enums_1.ApplicationStatus.CONTRACT_SENT, enums_1.ApplicationStatus.ON_HOLD],
    [enums_1.ApplicationStatus.REJECTED]: [enums_1.ApplicationStatus.APPEALING, enums_1.ApplicationStatus.NEW_LEAD],
    [enums_1.ApplicationStatus.ON_HOLD]: [
        enums_1.ApplicationStatus.UNDER_REVIEW, enums_1.ApplicationStatus.REJECTED,
        enums_1.ApplicationStatus.WAITING_FOR_DOCUMENTS,
    ],
    [enums_1.ApplicationStatus.CAPITAL_QUEUE]: [enums_1.ApplicationStatus.UNDER_REVIEW, enums_1.ApplicationStatus.REJECTED],
    [enums_1.ApplicationStatus.FRAUD_FLAGGED]: [],
    [enums_1.ApplicationStatus.CONTRACT_SENT]: [enums_1.ApplicationStatus.CONTRACT_SIGNED],
    [enums_1.ApplicationStatus.CONTRACT_SIGNED]: [enums_1.ApplicationStatus.UNIVERSITY_CONFIRMED],
    [enums_1.ApplicationStatus.UNIVERSITY_CONFIRMED]: [enums_1.ApplicationStatus.UNIVERSITY_PAID],
    [enums_1.ApplicationStatus.UNIVERSITY_PAID]: [enums_1.ApplicationStatus.ACTIVE_STUDENT],
    [enums_1.ApplicationStatus.ACTIVE_STUDENT]: [enums_1.ApplicationStatus.COMPLETED, enums_1.ApplicationStatus.WITHDRAWN],
    [enums_1.ApplicationStatus.APPEALING]: [enums_1.ApplicationStatus.UNDER_REVIEW, enums_1.ApplicationStatus.REJECTED],
};
let ApplicationsService = ApplicationsService_1 = class ApplicationsService {
    constructor(dataSource, notifications, universitiesService) {
        this.dataSource = dataSource;
        this.notifications = notifications;
        this.universitiesService = universitiesService;
        this.logger = new common_1.Logger(ApplicationsService_1.name);
    }
    async notifyStudent(tenantId, studentId, templateCode, variables) {
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
            referenceType: 'application',
        }).catch(err => this.logger.error(`Notification ${templateCode} failed`, err));
    }
    async create(dto, tenantId, createdBy) {
        let parsedAiReport = null;
        if (dto.aiReport) {
            try {
                parsedAiReport = typeof dto.aiReport === 'string' ? JSON.parse(dto.aiReport) : dto.aiReport;
            }
            catch {
                parsedAiReport = null;
            }
        }
        const aiScoreOverall = parsedAiReport && parsedAiReport.demo_mode !== true
            ? (0, household_stability_util_1.computeHouseholdStabilityScore)(parsedAiReport.scores)
            : null;
        const aiRecommendation = (0, household_stability_util_1.deriveRecommendation)(aiScoreOverall);
        const [application] = await this.dataSource.query(`INSERT INTO applications
        (tenant_id, student_id, university_id, program_id,
         referral_source_id, partner_id, campaign_id,
         tuition_amount, requested_support_amount, currency,
         academic_year, current_status, lead_date, is_renewal,
         previous_application_id, assigned_to_user_id, created_by,
         ai_score_overall, ai_recommendation, ai_report,
         interview_language, interview_transcript)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'new_lead',CURRENT_DATE,$12,$13,$14,$15,
               $16,$17,$18,$19,$20)
       RETURNING *`, [
            tenantId, dto.studentId, dto.universityId, dto.programId,
            dto.referralSourceId, dto.partnerId, dto.campaignId,
            dto.tuitionAmount, dto.requestedSupportAmount, dto.currency || 'TND',
            dto.academicYear, dto.isRenewal || false,
            dto.previousApplicationId, dto.assignedToUserId, createdBy,
            aiScoreOverall, aiRecommendation,
            dto.aiReport ? (typeof dto.aiReport === 'string' ? dto.aiReport : JSON.stringify(dto.aiReport)) : null,
            dto.interviewLanguage ?? null, dto.interviewTranscript ?? null,
        ]);
        await this.dataSource.query(`INSERT INTO application_status_history (application_id, to_status, changed_by, notes)
       VALUES ($1, 'new_lead', $2, 'Application created')`, [application.id, createdBy]);
        await this.audit(tenantId, createdBy, 'application.created', application.id, null, dto);
        await this.notifyStudent(tenantId, application.student_id, 'application_created', {
            applicationId: application.id,
        });
        return application;
    }
    async createForSelf(userId, tenantId, dto) {
        const [student] = await this.dataSource.query(`SELECT id, membership_status FROM students WHERE user_id = $1 AND tenant_id = $2`, [userId, tenantId]);
        if (!student)
            throw new common_1.NotFoundException('No student profile linked to this user');
        if (!['bronze', 'silver', 'gold'].includes(student.membership_status)) {
            throw new common_1.ForbiddenException(student.membership_status === 'blacklisted'
                ? 'This account cannot submit financing requests.'
                : 'Submit a Membership Request and wait for Bronze approval before requesting financing.');
        }
        return this.create({ ...dto, studentId: student.id }, tenantId, userId);
    }
    async findAllForMyUniversity(userId, tenantId, pagination, filters = {}) {
        const university = await this.universitiesService.findMe(userId, tenantId);
        return this.findAll(tenantId, pagination, { ...filters, universityId: university.id });
    }
    async findOneForMyUniversity(userId, tenantId, applicationId) {
        const university = await this.universitiesService.findMe(userId, tenantId);
        const application = await this.findOne(applicationId, tenantId);
        if (application.university_id !== university.id) {
            throw new common_1.NotFoundException('Application not found');
        }
        return application;
    }
    async getStatusHistoryForMyUniversity(userId, tenantId, applicationId) {
        await this.findOneForMyUniversity(userId, tenantId, applicationId);
        return this.getStatusHistory(applicationId, tenantId);
    }
    async getStatusHistoryForMe(userId, tenantId, applicationId) {
        const [owned] = await this.dataSource.query(`SELECT a.id FROM applications a
       JOIN students s ON s.id = a.student_id
       WHERE a.id = $1 AND a.tenant_id = $2 AND s.user_id = $3`, [applicationId, tenantId, userId]);
        if (!owned)
            throw new common_1.NotFoundException('Application not found');
        return this.getStatusHistory(applicationId, tenantId);
    }
    async findAll(tenantId, pagination, filters = {}) {
        const { page = 1, limit = 20 } = pagination;
        const offset = (0, pagination_util_1.getSkip)(page, limit);
        const params = [tenantId];
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
            this.dataSource.query(`SELECT a.id, a.current_status, a.current_financing_level, a.tuition_amount,
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
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
            this.dataSource.query(`SELECT COUNT(*) FROM applications a
         JOIN students s ON s.id = a.student_id
         WHERE a.tenant_id = $1 ${whereExtra}`, params),
        ]);
        return (0, pagination_util_1.paginate)(data, parseInt(count.count), page, limit);
    }
    async findOne(id, tenantId) {
        const [application] = await this.dataSource.query(`SELECT a.*,
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
       WHERE a.id = $1 AND a.tenant_id = $2`, [id, tenantId]);
        if (!application)
            throw new common_1.NotFoundException('Application not found');
        return application;
    }
    async confirmEnrollment(applicationId, tenantId, universityUserId, notes) {
        const university = await this.universitiesService.findMe(universityUserId, tenantId);
        const application = await this.findOne(applicationId, tenantId);
        if (application.university_id !== university.id) {
            throw new common_1.ForbiddenException('This application does not belong to your university');
        }
        return this.transitionStatus(applicationId, tenantId, enums_1.ApplicationStatus.UNIVERSITY_CONFIRMED, universityUserId, notes);
    }
    async transitionStatus(id, tenantId, newStatus, changedBy, notes, pipelineRunId, financingTier) {
        const application = await this.findOne(id, tenantId);
        const currentStatus = application.current_status;
        const allowed = STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(newStatus)) {
            throw new common_1.BadRequestException(`Invalid status transition: ${currentStatus} → ${newStatus}`);
        }
        await this.dataSource.query(`UPDATE applications SET current_status = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [id, tenantId, newStatus]);
        await this.dataSource.query(`INSERT INTO application_status_history
        (application_id, from_status, to_status, changed_by, pipeline_run_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6)`, [id, currentStatus, newStatus, changedBy, pipelineRunId || null, notes || null]);
        await this.audit(tenantId, changedBy, 'application.status.changed', id, { status: currentStatus }, { status: newStatus, notes });
        const approvedLevelByStatus = {
            [enums_1.ApplicationStatus.APPROVED_LEVEL1]: 1,
            [enums_1.ApplicationStatus.APPROVED_LEVEL2]: 2,
            [enums_1.ApplicationStatus.APPROVED_LEVEL3]: 3,
        };
        if (newStatus in approvedLevelByStatus) {
            await this.notifyStudent(tenantId, application.student_id, 'application_approved', {
                programName: application.program_name || 'your program',
                universityName: application.university_name,
                approvedLevel: approvedLevelByStatus[newStatus],
                tierSuffix: financingTier ? ` (${financingTier.charAt(0).toUpperCase() + financingTier.slice(1)} tier)` : '',
            });
        }
        else if (newStatus === enums_1.ApplicationStatus.REJECTED) {
            await this.notifyStudent(tenantId, application.student_id, 'application_rejected', {
                rejectionReason: notes || 'Not specified',
            });
        }
        else if (newStatus === enums_1.ApplicationStatus.CAPITAL_QUEUE) {
            await this.notifyStudent(tenantId, application.student_id, 'waiting_list', {
                programName: application.program_name || 'your program',
            });
        }
        return { id, previousStatus: currentStatus, newStatus };
    }
    async getPipelineHistory(id, tenantId) {
        await this.findOne(id, tenantId);
        return this.dataSource.query(`SELECT pr.*, pet.stage_record_ids, fd.decision_result, fd.approved_level
       FROM pipeline_runs pr
       LEFT JOIN pipeline_execution_traces pet ON pet.pipeline_run_id = pr.id
       LEFT JOIN financing_decisions fd ON fd.pipeline_run_id = pr.id
       WHERE pr.application_id = $1
       ORDER BY pr.run_number ASC`, [id]);
    }
    async getStatusHistory(id, tenantId) {
        await this.findOne(id, tenantId);
        return this.dataSource.query(`SELECT ash.*, u.full_name AS changed_by_name
       FROM application_status_history ash
       LEFT JOIN users u ON u.id = ash.changed_by
       WHERE ash.application_id = $1
       ORDER BY ash.changed_at ASC`, [id]);
    }
    async assignTo(id, tenantId, assignedToUserId, assignedBy) {
        await this.findOne(id, tenantId);
        await this.dataSource.query(`UPDATE applications SET assigned_to_user_id = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`, [id, tenantId, assignedToUserId]);
        await this.audit(tenantId, assignedBy, 'application.assigned', id, null, { assignedToUserId });
        return { message: 'Application assigned' };
    }
    async submitAppeal(id, tenantId, dto, submittedBy) {
        const application = await this.findOne(id, tenantId);
        if (application.current_status !== enums_1.ApplicationStatus.REJECTED) {
            throw new common_1.BadRequestException('Only rejected applications can be appealed');
        }
        const [decision] = await this.dataSource.query(`SELECT fd.id FROM financing_decisions fd
       JOIN pipeline_runs pr ON pr.id = fd.pipeline_run_id
       WHERE pr.application_id = $1
       ORDER BY pr.run_number DESC LIMIT 1`, [id]);
        if (!decision)
            throw new common_1.BadRequestException('No financing decision found to appeal');
        const appealDeadline = new Date();
        appealDeadline.setDate(appealDeadline.getDate() + 30);
        const [appeal] = await this.dataSource.query(`INSERT INTO application_appeals
        (tenant_id, application_id, original_decision_id, appeal_reason,
         new_evidence_description, deadline_for_review, reentry_stage)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`, [
            tenantId, id, decision.id, dto.reason,
            dto.newEvidenceDescription, appealDeadline,
            dto.reentryStage || 4,
        ]);
        await this.transitionStatus(id, tenantId, enums_1.ApplicationStatus.APPEALING, submittedBy, 'Appeal submitted');
        await this.audit(tenantId, submittedBy, 'application.appeal.submitted', id, null, dto);
        return appeal;
    }
    async audit(tenantId, userId, action, targetId, prev, next) {
        await this.dataSource.query(`INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, previous_value, new_value, created_at)
       VALUES ($1,$2,$3,'applications','applications',$4,$5,$6,NOW())`, [tenantId, userId, action, targetId,
            prev ? JSON.stringify(prev) : null, next ? JSON.stringify(next) : null]).catch(err => this.logger.error('Audit log failed', err));
    }
};
exports.ApplicationsService = ApplicationsService;
exports.ApplicationsService = ApplicationsService = ApplicationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        notifications_service_1.NotificationsService,
        universities_service_1.UniversitiesService])
], ApplicationsService);
//# sourceMappingURL=applications.service.js.map