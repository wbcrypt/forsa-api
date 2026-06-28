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
const encryption_util_1 = require("../common/utils/encryption.util");
const config_1 = require("@nestjs/config");
const enums_1 = require("../common/enums");
const pagination_util_1 = require("../common/utils/pagination.util");
let StudentsService = StudentsService_1 = class StudentsService {
    constructor(dataSource, configService) {
        this.dataSource = dataSource;
        this.configService = configService;
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
                'employmentStatus', g.employment_status, 'riskLevel', g.risk_level
              )) FILTER (WHERE sg.id IS NOT NULL AND sg.status = 'active') AS guarantors
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
        const student = await this.findOne(id, tenantId);
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
        await this.findOne(studentId, tenantId);
        const nationalIdRef = dto.nationalId
            ? (0, encryption_util_1.encrypt)(dto.nationalId, this.configService.get('encryption.piiKey'))
            : null;
        const [guarantor] = await this.dataSource.query(`INSERT INTO guarantors
        (tenant_id, first_name, last_name, date_of_birth, national_id_reference,
         relationship_to_student, employment_status, employer_name, income_stability,
         email, phone_primary, contact_reliability, risk_level, document_status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'unknown','unknown','pending',$12)
       RETURNING id`, [
            tenantId, dto.firstName, dto.lastName, dto.dateOfBirth, nationalIdRef,
            dto.relationship, dto.employmentStatus, dto.employerName, dto.incomeStability,
            dto.email, dto.phone, addedBy,
        ]);
        const [link] = await this.dataSource.query(`INSERT INTO student_guarantors
        (student_id, guarantor_id, role, status, effective_date, added_by)
       VALUES ($1,$2,$3,'active',CURRENT_DATE,$4)
       RETURNING *`, [studentId, guarantor.id, dto.role || 'primary', addedBy]);
        await this.audit(tenantId, addedBy, 'student.guarantor.added', studentId, null, { guarantorId: guarantor.id, role: dto.role });
        return { guarantor, link };
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
       ORDER BY p.paid_at DESC`, [studentId, tenantId]);
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
        config_1.ConfigService])
], StudentsService);
//# sourceMappingURL=students.service.js.map