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
const application_stages_util_1 = require("./application-stages.util");
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
         interview_language, interview_transcript, expected_graduation_date,
         requested_tier, platform_fee_acknowledged_at, forsa_choice_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'new_lead',CURRENT_DATE,$12,$13,$14,$15,
               $16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`, [
            tenantId, dto.studentId, dto.universityId, dto.programId,
            dto.referralSourceId, dto.partnerId, dto.campaignId,
            dto.tuitionAmount, dto.requestedSupportAmount, dto.currency || 'TND',
            dto.academicYear, dto.isRenewal || false,
            dto.previousApplicationId, dto.assignedToUserId, createdBy,
            aiScoreOverall, aiRecommendation,
            dto.aiReport ? (typeof dto.aiReport === 'string' ? dto.aiReport : JSON.stringify(dto.aiReport)) : null,
            dto.interviewLanguage ?? null, dto.interviewTranscript ?? null,
            dto.expectedGraduationDate ?? null,
            dto.requestedTier ?? null,
            dto.platformFeeAcknowledged ? new Date() : null,
            dto.forsaChoiceReason ?? null,
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
        const [existing] = await this.dataSource.query(`SELECT id FROM applications
       WHERE student_id = $1 AND tenant_id = $2
         AND current_status NOT IN ('rejected', 'completed', 'withdrawn')`, [student.id, tenantId]);
        if (existing) {
            throw new common_1.BadRequestException('You already have a Tuition Facilitation request in progress. Please wait for a decision before submitting another.');
        }
        const missingFields = [];
        if (!dto.programId)
            missingFields.push('program');
        if (!dto.universityId)
            missingFields.push('university');
        if (!dto.academicYear)
            missingFields.push('academic year');
        if (!dto.requestedTier || !['silver', 'gold'].includes(dto.requestedTier))
            missingFields.push('requested plan (Silver or Gold)');
        if (!dto.platformFeeAcknowledged)
            missingFields.push('administrative fee acknowledgment');
        if (missingFields.length) {
            throw new common_1.BadRequestException(`Please complete the following before submitting: ${missingFields.join(', ')}.`);
        }
        const [program] = await this.dataSource.query(`SELECT tuition_amount FROM programs WHERE id = $1 AND university_id = $2`, [dto.programId, dto.universityId]);
        if (!program || program.tuition_amount === null) {
            throw new common_1.BadRequestException('The selected program does not have a tuition amount configured yet. Please contact FORSA staff.');
        }
        const application = await this.create({ ...dto, studentId: student.id, tuitionAmount: program.tuition_amount }, tenantId, userId);
        return application;
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
    async getMyApplicationTimeline(userId, tenantId, applicationId) {
        const [owned] = await this.dataSource.query(`SELECT a.id, a.current_status, a.student_id, a.program_id,
              a.requested_tier, a.platform_fee_acknowledged_at
       FROM applications a
       JOIN students s ON s.id = a.student_id
       WHERE a.id = $1 AND a.tenant_id = $2 AND s.user_id = $3`, [applicationId, tenantId, userId]);
        if (!owned)
            throw new common_1.NotFoundException('Application not found');
        const completeness = await this.getCompleteness(owned.id, owned.student_id, !!owned.program_id, owned.requested_tier, !!owned.platform_fee_acknowledged_at);
        const meeting = await this.getCurrentMeeting(owned.id);
        return (0, application_stages_util_1.computeStudentMilestone)(owned.current_status, completeness, meeting);
    }
    async getCurrentMeeting(applicationId) {
        const [meeting] = await this.dataSource.query(`SELECT id, reference_number, scheduled_at, office_location, assigned_officer_user_id,
              estimated_duration_minutes, required_documents, required_attendees,
              special_instructions, status, cancellation_reason
       FROM case_meetings WHERE application_id = $1 AND status != 'cancelled'
       ORDER BY created_at DESC LIMIT 1`, [applicationId]);
        return meeting || null;
    }
    async getQueuePositionForMe(userId, tenantId, applicationId) {
        const [app] = await this.dataSource.query(`SELECT a.id, a.current_status, a.updated_at FROM applications a
       JOIN students s ON s.id = a.student_id
       WHERE a.id = $1 AND a.tenant_id = $2 AND s.user_id = $3`, [applicationId, tenantId, userId]);
        if (!app)
            throw new common_1.NotFoundException('Application not found');
        if (app.current_status !== enums_1.ApplicationStatus.CAPITAL_QUEUE) {
            return { inQueue: false, position: null, total: null };
        }
        const [{ total }] = await this.dataSource.query(`SELECT count(*)::int AS total FROM applications
       WHERE tenant_id = $1 AND current_status = $2`, [tenantId, enums_1.ApplicationStatus.CAPITAL_QUEUE]);
        const [{ ahead }] = await this.dataSource.query(`SELECT count(*)::int AS ahead FROM applications
       WHERE tenant_id = $1 AND current_status = $2 AND updated_at < $3`, [tenantId, enums_1.ApplicationStatus.CAPITAL_QUEUE, app.updated_at]);
        return { inQueue: true, position: ahead + 1, total };
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
                a.lead_date, a.academic_year, a.is_renewal, a.updated_at,
                a.ai_score_overall, a.ai_recommendation, a.ai_report,
                s.first_name, s.last_name, s.email,
                u.name AS university_name,
                p.name AS program_name,
                rs.display_name AS referral_source,
                usr.full_name AS assigned_to,
                fs.aggregate_score, fs.score_band,
                has_g.has_guarantor,
                -- Phase 10 — Administrator Queue visibility
                -- (FORSA_OPERATIONS_MANUAL.md §9/§15). Priority order:
                -- an overdue decision matters more than a routine "ready"
                -- tag; a missing guarantor blocks the same review a
                -- "ready" application doesn't. Not based on per-document
                -- completeness here (that level of detail is the
                -- Completeness Checklist on the application detail page —
                -- see ApplicationsService#getCompleteness, added in the
                -- workflow alignment fix) — this list-level tag stays a
                -- coarse "what's the one most important thing" signal.
                CASE
                  WHEN a.current_status IN ('new_lead','contacted','under_review','more_info_required')
                       AND a.updated_at < NOW() - INTERVAL '5 days'
                    THEN 'urgent'
                  WHEN a.current_status IN ('under_review','more_info_required','on_hold','approved_level1','approved_level2','approved_level3')
                       AND NOT has_g.has_guarantor
                    THEN 'missing_guarantor'
                  WHEN a.current_status = 'waiting_for_documents' THEN 'waiting_documents'
                  WHEN a.current_status = 'more_info_required' THEN 'waiting_student'
                  WHEN a.current_status = 'contract_signed' THEN 'waiting_university'
                  WHEN a.current_status = 'capital_queue' THEN 'waiting_list'
                  WHEN a.current_status = 'under_review' THEN 'ready_for_review'
                  ELSE NULL
                END AS queue_tag
         FROM applications a
         JOIN students s ON s.id = a.student_id
         JOIN universities u ON u.id = a.university_id
         LEFT JOIN programs p ON p.id = a.program_id
         LEFT JOIN referral_sources rs ON rs.id = a.referral_source_id
         LEFT JOIN users usr ON usr.id = a.assigned_to_user_id
         LEFT JOIN forsa_scores fs ON fs.student_id = a.student_id
         LEFT JOIN LATERAL (
           SELECT EXISTS (
             SELECT 1 FROM student_guarantors sg
             WHERE sg.student_id = a.student_id AND sg.status IN ('active', 'pending_invitation')
           ) AS has_guarantor
         ) has_g ON true
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
    async findOneForAdmin(id, tenantId) {
        const application = await this.findOne(id, tenantId);
        application.completeness = await this.getCompleteness(application.id, application.student_id, !!application.program_id, application.requested_tier, !!application.platform_fee_acknowledged_at);
        application.adminStage = (0, application_stages_util_1.computeAdminStage)(application.current_status, application.completeness);
        return application;
    }
    async getCaseSummary(id, tenantId) {
        const application = await this.findOneForAdmin(id, tenantId);
        const [student] = await this.dataSource.query(`SELECT id, first_name, last_name, email, phone_primary, date_of_birth, nationality,
              national_id_reference, address, city, employment_status, monthly_income,
              has_scholarship, scholarship_details, existing_loans_amount,
              other_financial_commitments, living_situation, emergency_contact_name,
              emergency_contact_phone, emergency_contact_relationship, membership_status
       FROM students WHERE id = $1 AND tenant_id = $2`, [application.student_id, tenantId]);
        const [guarantor] = await this.dataSource.query(`SELECT g.id, g.first_name, g.last_name, g.email, g.phone_primary, g.date_of_birth,
              g.relationship_to_student, g.employment_status, g.employer_name, g.income_stability,
              g.employment_duration_years, g.salary_range, g.income_source, g.marital_status,
              g.number_of_dependents, g.home_ownership, g.monthly_expenses, g.existing_loans_amount,
              g.other_guarantees, g.supporting_other_students, g.financial_profile_completed_at,
              g.document_status, g.portal_activated, sg.status AS link_status
       FROM student_guarantors sg
       JOIN guarantors g ON g.id = sg.guarantor_id
       WHERE sg.student_id = $1 AND sg.status != 'withdrawn'
       ORDER BY sg.created_at DESC LIMIT 1`, [application.student_id]);
        const meeting = await this.getCurrentMeeting(application.id);
        const [schedule] = await this.dataSource.query(`SELECT * FROM payment_schedules WHERE application_id = $1 LIMIT 1`, [application.id]);
        const installments = schedule ? await this.dataSource.query(`SELECT sequence_number, amount, due_date, status, amount_paid, paid_at
       FROM installments WHERE payment_schedule_id = $1 ORDER BY sequence_number`, [schedule.id]) : [];
        return {
            application: {
                id: application.id, current_status: application.current_status, adminStage: application.adminStage,
                university_id: application.university_id, university_name: application.university_name,
                program_id: application.program_id, program_name: application.program_name,
                tuition_amount: application.tuition_amount, academic_year: application.academic_year,
                expected_graduation_date: application.expected_graduation_date,
                financing_tier: application.financing_tier, created_at: application.created_at,
                requested_tier: application.requested_tier,
                platform_fee_acknowledged_at: application.platform_fee_acknowledged_at,
                forsa_choice_reason: application.forsa_choice_reason,
            },
            student: student || null,
            guarantor: guarantor || null,
            documents: application.completeness.documents,
            completeness: application.completeness,
            aiAnalysis: {
                report: application.ai_report || null,
                recommendation: application.ai_recommendation || null,
                score: application.ai_score_overall || null,
            },
            stabilityScore: {
                overall: application.stability_score_overall,
                breakdown: application.stability_score_breakdown,
                explanation: application.stability_ai_explanation,
            },
            meeting,
            paymentSchedule: schedule ? { ...schedule, installments } : null,
        };
    }
    async scheduleMeeting(applicationId, tenantId, dto, createdBy) {
        const [application] = await this.dataSource.query(`SELECT a.id, a.student_id, s.first_name, s.last_name FROM applications a
       JOIN students s ON s.id = a.student_id
       WHERE a.id = $1 AND a.tenant_id = $2`, [applicationId, tenantId]);
        if (!application)
            throw new common_1.NotFoundException('Application not found');
        const referenceNumber = `MTG-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const [meeting] = await this.dataSource.query(`INSERT INTO case_meetings
         (tenant_id, application_id, reference_number, scheduled_at, office_location,
          assigned_officer_user_id, estimated_duration_minutes, required_documents,
          required_attendees, special_instructions, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`, [
            tenantId, applicationId, referenceNumber, dto.scheduledAt, dto.officeLocation,
            dto.assignedOfficerUserId || createdBy, dto.estimatedDurationMinutes || 30,
            JSON.stringify(dto.requiredDocuments || [
                'Student: National ID (CIN)',
                'Guarantor: National ID (CIN)',
                'Guarantor: Employment / income proof (as applicable)',
                'Guarantor: Signed and completed كمبيالة (per FORSA template)',
            ]),
            JSON.stringify(dto.requiredAttendees || ['student', 'guarantor']),
            dto.specialInstructions || null, createdBy,
        ]);
        await this.notifyMeeting('meeting_scheduled', application, meeting, tenantId);
        return meeting;
    }
    async updateMeetingStatus(meetingId, tenantId, dto) {
        const [meeting] = await this.dataSource.query(`SELECT * FROM case_meetings WHERE id = $1 AND tenant_id = $2`, [meetingId, tenantId]);
        if (!meeting)
            throw new common_1.NotFoundException('Meeting not found');
        if (dto.status === 'cancelled' && !dto.cancellationReason) {
            throw new common_1.BadRequestException('A cancellation reason is required');
        }
        const [application] = await this.dataSource.query(`SELECT a.id, a.student_id, s.first_name, s.last_name FROM applications a
       JOIN students s ON s.id = a.student_id WHERE a.id = $1`, [meeting.application_id]);
        if (dto.status === 'rescheduled') {
            if (!dto.newScheduledAt)
                throw new common_1.BadRequestException('newScheduledAt is required when rescheduling');
            await this.dataSource.query(`UPDATE case_meetings SET status = 'rescheduled', updated_at = now() WHERE id = $1`, [meetingId]);
            const referenceNumber = `MTG-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            const [newMeeting] = await this.dataSource.query(`INSERT INTO case_meetings
           (tenant_id, application_id, reference_number, scheduled_at, office_location,
            assigned_officer_user_id, estimated_duration_minutes, required_documents,
            required_attendees, special_instructions, created_by)
         SELECT tenant_id, application_id, $2, $3, office_location, assigned_officer_user_id,
                estimated_duration_minutes, required_documents, required_attendees,
                special_instructions, created_by
         FROM case_meetings WHERE id = $1
         RETURNING *`, [meetingId, referenceNumber, dto.newScheduledAt]);
            await this.notifyMeeting('meeting_rescheduled', application, newMeeting, tenantId);
            return newMeeting;
        }
        const [updated] = await this.dataSource.query(`UPDATE case_meetings SET status = $2, cancellation_reason = $3, updated_at = now()
       WHERE id = $1 RETURNING *`, [meetingId, dto.status, dto.cancellationReason || null]);
        if (dto.status === 'cancelled')
            await this.notifyMeeting('meeting_cancelled', application, updated, tenantId);
        return updated;
    }
    async notifyMeeting(templateCode, application, meeting, tenantId) {
        const studentName = `${application.first_name} ${application.last_name}`.trim();
        let assignedOfficerName = 'A FORSA officer will be assigned';
        if (meeting.assigned_officer_user_id) {
            const [officer] = await this.dataSource.query(`SELECT full_name FROM users WHERE id = $1`, [meeting.assigned_officer_user_id]);
            if (officer?.full_name)
                assignedOfficerName = officer.full_name;
        }
        const meetingTz = 'Africa/Tunis';
        const variables = {
            studentName,
            meetingDate: new Date(meeting.scheduled_at).toLocaleDateString('fr-TN', { timeZone: meetingTz }),
            meetingTime: new Date(meeting.scheduled_at).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', timeZone: meetingTz }),
            officeLocation: meeting.office_location,
            referenceNumber: meeting.reference_number,
            assignedOfficerName,
            estimatedDuration: meeting.estimated_duration_minutes,
            requiredAttendees: Array.isArray(meeting.required_attendees) ? meeting.required_attendees.join(', ') : meeting.required_attendees,
            requiredDocuments: Array.isArray(meeting.required_documents) ? meeting.required_documents.join(', ') : meeting.required_documents,
            specialInstructions: meeting.special_instructions || '',
            cancellationReason: meeting.cancellation_reason || '',
        };
        const [student] = await this.dataSource.query(`SELECT email FROM students WHERE id = $1`, [application.student_id]);
        if (student?.email) {
            await this.notifications.send({
                tenantId, recipientId: application.student_id, recipientEmail: student.email,
                channel: enums_1.NotificationChannel.EMAIL, templateCode,
                variables: { ...variables, recipientName: studentName },
                referenceType: 'application',
            }).catch(err => this.logger.error(`Meeting notification ${templateCode} (student) failed`, err));
        }
        const [guarantor] = await this.dataSource.query(`SELECT g.email, g.first_name, g.last_name FROM student_guarantors sg
       JOIN guarantors g ON g.id = sg.guarantor_id
       WHERE sg.student_id = $1 AND sg.status = 'active' ORDER BY sg.created_at DESC LIMIT 1`, [application.student_id]);
        if (guarantor?.email) {
            await this.notifications.send({
                tenantId, recipientId: application.student_id, recipientEmail: guarantor.email,
                channel: enums_1.NotificationChannel.EMAIL, templateCode,
                variables: { ...variables, recipientName: `${guarantor.first_name} ${guarantor.last_name}`.trim() },
                referenceType: 'application',
            }).catch(err => this.logger.error(`Meeting notification ${templateCode} (guarantor) failed`, err));
        }
    }
    async getCompleteness(applicationId, studentId, programSelected, requestedTier, platformFeeAcknowledged) {
        const docs = await this.dataSource.query(`SELECT document_type_code, status FROM application_documents WHERE application_id = $1`, [applicationId]);
        const docByType = new Map(docs.map((d) => [d.document_type_code, d.status]));
        const documents = ApplicationsService_1.REQUIRED_DOCUMENT_TYPES.map(code => ({
            type: code,
            status: docByType.get(code) || 'absent',
        }));
        const [guarantorLink] = await this.dataSource.query(`SELECT sg.status, g.first_name, g.last_name, g.email
       FROM student_guarantors sg
       JOIN guarantors g ON g.id = sg.guarantor_id
       WHERE sg.student_id = $1 AND sg.status != 'withdrawn'
       ORDER BY sg.created_at DESC LIMIT 1`, [studentId]);
        return {
            programSelected,
            requestedTierSelected: !!requestedTier,
            platformFeeAcknowledged: !!platformFeeAcknowledged,
            documents,
            guarantor: guarantorLink ? {
                status: guarantorLink.status,
                name: `${guarantorLink.first_name} ${guarantorLink.last_name}`,
                email: guarantorLink.email,
            } : null,
            allComplete: programSelected && !!requestedTier && !!platformFeeAcknowledged
                && !!guarantorLink && ['active', 'pending_invitation'].includes(guarantorLink.status),
        };
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
        const approvedStatuses = [
            enums_1.ApplicationStatus.APPROVED_LEVEL1, enums_1.ApplicationStatus.APPROVED_LEVEL2, enums_1.ApplicationStatus.APPROVED_LEVEL3,
        ];
        if (approvedStatuses.includes(newStatus) && financingTier) {
            await this.dataSource.query(`UPDATE applications SET financing_tier = $3 WHERE id = $1 AND tenant_id = $2`, [id, tenantId, financingTier]);
            const tierRank = { bronze: 0, silver: 1, gold: 2, blacklisted: -1 };
            const [student] = await this.dataSource.query(`SELECT membership_status FROM students WHERE id = $1 AND tenant_id = $2`, [application.student_id, tenantId]);
            const currentRank = tierRank[student?.membership_status] ?? -1;
            if (tierRank[financingTier] > currentRank) {
                await this.dataSource.query(`UPDATE students SET membership_status = $2 WHERE id = $1`, [application.student_id, financingTier]);
                await this.dataSource.query(`INSERT INTO membership_status_history
            (student_id, tenant_id, previous_status, new_status, reason, changed_by)
           VALUES ($1,$2,$3,$4,$5,$6)`, [application.student_id, tenantId, student?.membership_status || null, financingTier,
                    `Tuition Facilitation Plan approved at ${financingTier} tier`, changedBy]);
            }
        }
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
            throw new common_1.BadRequestException('No tuition facilitation decision found to appeal');
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
ApplicationsService.REQUIRED_DOCUMENT_TYPES = [
    'national_id', 'bac_diploma', 'university_acceptance', 'income_proof',
];
exports.ApplicationsService = ApplicationsService = ApplicationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        notifications_service_1.NotificationsService,
        universities_service_1.UniversitiesService])
], ApplicationsService);
//# sourceMappingURL=applications.service.js.map