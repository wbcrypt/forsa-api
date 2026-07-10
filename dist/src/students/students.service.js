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
var StudentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const date_fns_1 = require("date-fns");
const encryption_util_1 = require("../common/utils/encryption.util");
const config_1 = require("@nestjs/config");
const enums_1 = require("../common/enums");
const pagination_util_1 = require("../common/utils/pagination.util");
const notifications_service_1 = require("../notifications/notifications.service");
const GUARANTOR_INVITE_TTL_DAYS = 7;
let StudentsService = StudentsService_1 = class StudentsService {
    constructor(dataSource, configService, notifications) {
        this.dataSource = dataSource;
        this.configService = configService;
        this.notifications = notifications;
        this.logger = new common_1.Logger(StudentsService_1.name);
    }
    async create(dto, tenantId, createdBy) {
        const nationalIdRef = dto.nationalId
            ? (0, encryption_util_1.encrypt)(dto.nationalId, this.configService.get('encryption.piiKey'))
            : null;
        const [student] = await this.dataSource.query(`INSERT INTO students
        (tenant_id, first_name, last_name, date_of_birth, gender, nationality,
         national_id_reference, email, phone_primary, phone_secondary,
         city, address, status, assigned_to_user_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'lead',$13,$14)
       RETURNING id, tenant_id, first_name, last_name, email, phone_primary, status, created_at`, [
            tenantId, dto.firstName, dto.lastName, dto.dateOfBirth,
            dto.gender, dto.nationality, nationalIdRef,
            dto.email, dto.phonePrimary, dto.phoneSecondary,
            dto.city, dto.address, dto.assignedToUserId, createdBy,
        ]);
        await this.dataSource.query(`INSERT INTO student_profiles (student_id, academic_level, preferred_language)
       VALUES ($1, $2, $3)`, [student.id, dto.academicLevel, dto.preferredLanguage || 'fr']);
        await this.audit(tenantId, createdBy, 'student.created', student.id, null, {
            firstName: dto.firstName, lastName: dto.lastName, email: dto.email,
        });
        return student;
    }
    async findMe(userId, tenantId) {
        const [student] = await this.dataSource.query(`SELECT s.*, sp.academic_level, fs.aggregate_score, fs.score_band,
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
       GROUP BY s.id, sp.academic_level, fs.id`, [userId, tenantId]);
        if (!student)
            throw new common_1.NotFoundException('No student profile linked to this user');
        delete student.national_id_reference;
        return student;
    }
    async updateMyProfile(userId, tenantId, dto) {
        const student = await this.findMe(userId, tenantId);
        await this.dataSource.query(`UPDATE students
       SET phone_primary = COALESCE($3, phone_primary),
           city = COALESCE($4, city),
           nationality = COALESCE($5, nationality),
           date_of_birth = COALESCE($6, date_of_birth),
           address = COALESCE($7, address),
           employment_status = COALESCE($8, employment_status),
           monthly_income = COALESCE($9, monthly_income),
           has_scholarship = COALESCE($10, has_scholarship),
           scholarship_details = COALESCE($11, scholarship_details),
           existing_loans_amount = COALESCE($12, existing_loans_amount),
           other_financial_commitments = COALESCE($13, other_financial_commitments),
           living_situation = COALESCE($14, living_situation),
           emergency_contact_name = COALESCE($15, emergency_contact_name),
           emergency_contact_phone = COALESCE($16, emergency_contact_phone),
           emergency_contact_relationship = COALESCE($17, emergency_contact_relationship),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`, [
            student.id, tenantId, dto.phonePrimary, dto.city, dto.nationality, dto.dateOfBirth, dto.address,
            dto.employmentStatus, dto.monthlyIncome, dto.hasScholarship, dto.scholarshipDetails,
            dto.existingLoansAmount, dto.otherFinancialCommitments, dto.livingSituation,
            dto.emergencyContactName, dto.emergencyContactPhone, dto.emergencyContactRelationship,
        ]);
        if (dto.academicLevel) {
            await this.dataSource.query(`INSERT INTO student_profiles (student_id, academic_level, preferred_language)
         VALUES ($1, $2, 'fr')
         ON CONFLICT (student_id) DO UPDATE SET academic_level = $2`, [student.id, dto.academicLevel]);
        }
        await this.audit(tenantId, userId, 'student.self_updated_profile', student.id, null, dto);
        return this.findMe(userId, tenantId);
    }
    async addMyGuarantor(userId, tenantId, dto) {
        const student = await this.findMe(userId, tenantId);
        return this.addGuarantor(student.id, tenantId, dto, userId);
    }
    async resendMyGuarantorInvite(userId, tenantId, guarantorId) {
        const student = await this.findMe(userId, tenantId);
        return this.resendGuarantorInvite(student.id, guarantorId, tenantId, userId);
    }
    async findAll(tenantId, pagination, filters = {}) {
        const { page = 1, limit = 20 } = pagination;
        const offset = (0, pagination_util_1.getSkip)(page, limit);
        const params = [tenantId];
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
            this.dataSource.query(`SELECT s.id, s.first_name, s.last_name, s.email, s.phone_primary,
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
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
            this.dataSource.query(`SELECT COUNT(*) FROM students s WHERE s.tenant_id = $1 ${whereExtra}`, params),
        ]);
        return (0, pagination_util_1.paginate)(data, parseInt(count.count), page, limit);
    }
    async findOne(id, tenantId, includePii = false) {
        const [student] = await this.dataSource.query(`SELECT s.*,
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
       GROUP BY s.id, sp.id, fs.id`, [id, tenantId]);
        if (!student)
            throw new common_1.NotFoundException('Student not found');
        if (includePii && student.national_id_reference) {
            try {
                student.nationalId = (0, encryption_util_1.decrypt)(student.national_id_reference, this.configService.get('encryption.piiKey'));
            }
            catch {
                student.nationalId = '[decryption error]';
            }
        }
        delete student.national_id_reference;
        return student;
    }
    async update(id, tenantId, dto, updatedBy) {
        await this.findOne(id, tenantId);
        const [updated] = await this.dataSource.query(`UPDATE students
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
       RETURNING id, first_name, last_name, email, status`, [id, tenantId, dto.firstName, dto.lastName, dto.email,
            dto.phonePrimary, dto.phoneSecondary, dto.city, dto.address, dto.assignedToUserId]);
        await this.audit(tenantId, updatedBy, 'student.updated', id, null, dto);
        return updated;
    }
    async addGuarantor(studentId, tenantId, dto, addedBy) {
        const student = await this.findOne(studentId, tenantId);
        if (!dto.email) {
            throw new common_1.BadRequestException('email is required — the invite link is sent there');
        }
        if (!dto.firstName || !dto.lastName) {
            throw new common_1.BadRequestException('firstName and lastName are required');
        }
        const [existingByEmail] = await this.dataSource.query(`SELECT id FROM guarantors WHERE tenant_id = $1 AND email = $2`, [tenantId, dto.email]);
        if (existingByEmail) {
            throw new common_1.BadRequestException('A guarantor with this email has already been added');
        }
        const nationalIdRef = dto.nationalId
            ? (0, encryption_util_1.encrypt)(dto.nationalId, this.configService.get('encryption.piiKey'))
            : null;
        const rawToken = (0, encryption_util_1.generateSecureToken)(32);
        const tokenHash = (0, encryption_util_1.hashToken)(rawToken);
        const expiresAt = (0, date_fns_1.addDays)(new Date(), GUARANTOR_INVITE_TTL_DAYS);
        const [guarantor] = await this.dataSource.query(`INSERT INTO guarantors
        (tenant_id, first_name, last_name, date_of_birth, national_id_reference,
         relationship_to_student, employment_status, employer_name, income_stability,
         email, phone_primary, contact_reliability, risk_level, document_status, created_by,
         invite_token, invite_sent_at, invite_token_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'unknown','unknown','pending',$12,$13,NOW(),$14)
       RETURNING id, email`, [
            tenantId, dto.firstName, dto.lastName, dto.dateOfBirth, nationalIdRef,
            dto.relationship, dto.employmentStatus, dto.employerName, dto.incomeStability,
            dto.email, dto.phone, addedBy, tokenHash, expiresAt,
        ]);
        const [link] = await this.dataSource.query(`INSERT INTO student_guarantors
        (student_id, guarantor_id, role, status, effective_date, added_by)
       VALUES ($1,$2,$3,'pending_invitation',CURRENT_DATE,$4)
       RETURNING *`, [studentId, guarantor.id, dto.role || 'primary', addedBy]);
        await this.audit(tenantId, addedBy, 'student.guarantor.added', studentId, null, { guarantorId: guarantor.id, role: dto.role });
        await this.sendGuarantorInviteEmail(tenantId, guarantor.id, guarantor.email, dto.firstName, student.first_name, addedBy, rawToken);
        return { guarantor, link };
    }
    async sendGuarantorInviteEmail(tenantId, guarantorId, email, guarantorFirstName, studentFirstName, triggeredBy, rawToken) {
        const inviteUrl = `${process.env.GUARANTOR_PORTAL_URL || 'https://guarantor.forsa.tn'}/invite/${rawToken}`;
        await this.notifications.send({
            tenantId,
            recipientId: guarantorId,
            recipientEmail: email,
            channel: enums_1.NotificationChannel.EMAIL,
            templateCode: 'guarantor_invited',
            variables: { guarantorFirstName, studentFirstName, inviteUrl },
            triggeredBy,
            referenceId: guarantorId,
            referenceType: 'guarantor',
        }).catch(err => this.logger.error('guarantor_invited notification failed', err));
    }
    async resendGuarantorInvite(studentId, guarantorId, tenantId, requestedBy) {
        const [guarantor] = await this.dataSource.query(`SELECT g.id, g.email, g.first_name, g.user_id, s.first_name AS student_first_name
       FROM guarantors g
       JOIN student_guarantors sg ON sg.guarantor_id = g.id AND sg.student_id = $2
       JOIN students s ON s.id = $2
       WHERE g.id = $1 AND g.tenant_id = $3`, [guarantorId, studentId, tenantId]);
        if (!guarantor)
            throw new common_1.NotFoundException('Guarantor not found for this student');
        if (guarantor.user_id)
            throw new common_1.BadRequestException('This guarantor has already activated their portal account');
        const rawToken = (0, encryption_util_1.generateSecureToken)(32);
        const tokenHash = (0, encryption_util_1.hashToken)(rawToken);
        const expiresAt = (0, date_fns_1.addDays)(new Date(), GUARANTOR_INVITE_TTL_DAYS);
        await this.dataSource.query(`UPDATE guarantors SET invite_token = $2, invite_sent_at = NOW(), invite_token_expires_at = $3 WHERE id = $1`, [guarantorId, tokenHash, expiresAt]);
        await this.sendGuarantorInviteEmail(tenantId, guarantor.id, guarantor.email, guarantor.first_name, guarantor.student_first_name, requestedBy, rawToken);
        return { success: true };
    }
    async withdrawGuarantor(studentId, guarantorId, tenantId, reason, reasonCode, withdrawnBy) {
        const [link] = await this.dataSource.query(`SELECT * FROM student_guarantors
       WHERE student_id = $1 AND guarantor_id = $2 AND status = 'active'`, [studentId, guarantorId]);
        if (!link)
            throw new common_1.NotFoundException('Active guarantor link not found');
        await this.dataSource.query(`UPDATE student_guarantors
       SET status = 'withdrawn', withdrawal_date = CURRENT_DATE,
           withdrawal_reason = $3, withdrawal_reason_code = $4
       WHERE id = $5`, [reason, reasonCode, link.id]);
        await this.openExceptionalEvent(studentId, tenantId, {
            eventType: enums_1.ExceptionalEventType.GUARANTOR_WITHDRAWAL,
            description: `Guarantor withdrawal: ${reason}`,
            affectsFinancialObligations: true,
            openedBy: withdrawnBy,
        });
        await this.audit(tenantId, withdrawnBy, 'student.guarantor.withdrawn', studentId, { status: 'active' }, { status: 'withdrawn', reason });
    }
    async openExceptionalEvent(studentId, tenantId, dto) {
        const [event] = await this.dataSource.query(`INSERT INTO student_exceptional_events
        (tenant_id, student_id, event_type, event_reason_code, description,
         affects_financial_obligations, affects_contract, opened_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open')
       RETURNING *`, [
            tenantId, studentId, dto.eventType, dto.reasonCode, dto.description,
            dto.affectsFinancialObligations || false,
            dto.affectsContract || false,
            dto.openedBy,
        ]);
        await this.audit(tenantId, dto.openedBy, 'student.exceptional_event.opened', studentId, null, { eventType: dto.eventType, description: dto.description });
        return event;
    }
    async getExceptionalEvents(studentId, tenantId) {
        await this.findOne(studentId, tenantId);
        return this.dataSource.query(`SELECT see.*, u.full_name AS opened_by_name
       FROM student_exceptional_events see
       LEFT JOIN users u ON u.id = see.opened_by
       WHERE see.student_id = $1 AND see.tenant_id = $2
       ORDER BY see.opened_at DESC`, [studentId, tenantId]);
    }
    async getApplicationHistory(studentId, tenantId) {
        await this.findOne(studentId, tenantId);
        return this.dataSource.query(`SELECT a.*, u.name AS university_name, p.name AS program_name,
              fd.decision_result, fd.approved_level, fd.approved_amount
       FROM applications a
       LEFT JOIN universities u ON u.id = a.university_id
       LEFT JOIN programs p ON p.id = a.program_id
       LEFT JOIN financing_decisions fd ON fd.application_id = a.id
         AND fd.pipeline_run_id = a.current_pipeline_run_id
       WHERE a.student_id = $1 AND a.tenant_id = $2
       ORDER BY a.created_at DESC`, [studentId, tenantId]);
    }
    async getPaymentHistory(studentId, tenantId) {
        await this.findOne(studentId, tenantId);
        return this.dataSource.query(`SELECT p.*, i.due_date, i.sequence_number, i.amount AS installment_amount,
              ps.total_amount
       FROM payments p
       JOIN installments i ON i.id = p.installment_id
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       WHERE p.student_id = $1 AND p.tenant_id = $2
       ORDER BY p.payment_date DESC`, [studentId, tenantId]);
    }
    async findMyPayments(userId, tenantId) {
        const [student] = await this.dataSource.query(`SELECT id FROM students WHERE user_id = $1 AND tenant_id = $2`, [userId, tenantId]);
        if (!student)
            throw new common_1.NotFoundException('No student profile linked to this user');
        return this.getPaymentHistory(student.id, tenantId);
    }
    async findMyApplications(userId, tenantId) {
        const [student] = await this.dataSource.query(`SELECT id FROM students WHERE user_id = $1 AND tenant_id = $2`, [userId, tenantId]);
        if (!student)
            throw new common_1.NotFoundException('No student profile linked to this user');
        return this.getApplicationHistory(student.id, tenantId);
    }
    async audit(tenantId, userId, action, targetId, prev, next) {
        await this.dataSource.query(`INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, previous_value, new_value, created_at)
       VALUES ($1,$2,$3,'students','students',$4,$5,$6,NOW())`, [tenantId, userId, action, targetId,
            prev ? JSON.stringify(prev) : null, next ? JSON.stringify(next) : null]).catch(err => this.logger.error('Audit log failed', err));
    }
};
exports.StudentsService = StudentsService;
exports.StudentsService = StudentsService = StudentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        config_1.ConfigService,
        notifications_service_1.NotificationsService])
], StudentsService);
//# sourceMappingURL=students.service.js.map