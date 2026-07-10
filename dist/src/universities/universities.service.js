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
var UniversitiesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversitiesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const enums_1 = require("../common/enums");
const pagination_util_1 = require("../common/utils/pagination.util");
let UniversitiesService = UniversitiesService_1 = class UniversitiesService {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(UniversitiesService_1.name);
    }
    async create(dto, tenantId, createdBy) {
        const [existing] = await this.dataSource.query(`SELECT id FROM universities WHERE tenant_id = $1 AND name = $2`, [tenantId, dto.name]);
        if (existing)
            throw new common_1.ConflictException('University with this name already exists');
        const [university] = await this.dataSource.query(`INSERT INTO universities
        (tenant_id, name, short_name, country_code, city, address, website,
         accreditation_status, accreditation_body, status, risk_level, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`, [
            tenantId, dto.name, dto.shortName, dto.countryCode, dto.city,
            dto.address, dto.website, dto.accreditationStatus, dto.accreditationBody,
            dto.status || enums_1.UniversityStatus.PROSPECT, dto.riskLevel || 'standard',
            dto.notes, createdBy,
        ]);
        await this.auditLog(tenantId, createdBy, 'university.created', university.id, null, dto);
        return university;
    }
    async findAllPublic(tenantId) {
        if (!tenantId)
            throw new common_1.BadRequestException('tenantId is required');
        return this.dataSource.query(`SELECT id, name, city FROM universities
       WHERE tenant_id = $1 AND status = $2
       ORDER BY name ASC`, [tenantId, enums_1.UniversityStatus.ACTIVE]);
    }
    async linkUser(id, userId, tenantId, updatedBy) {
        const [university] = await this.dataSource.query(`SELECT id FROM universities WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
        if (!university)
            throw new common_1.NotFoundException('University not found');
        const [user] = await this.dataSource.query(`SELECT id FROM users WHERE id = $1 AND tenant_id = $2`, [userId, tenantId]);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        await this.dataSource.query(`UPDATE universities SET user_id = $2 WHERE id = $1`, [id, userId]);
        await this.dataSource.query(`UPDATE users SET university_id_linked = $2 WHERE id = $1`, [userId, id]);
        await this.auditLog(tenantId, updatedBy, 'university.user_linked', id, null, { userId });
        return { id, userId };
    }
    async findMe(userId, tenantId) {
        const [university] = await this.dataSource.query(`SELECT * FROM universities WHERE user_id = $1 AND tenant_id = $2`, [userId, tenantId]);
        if (!university)
            throw new common_1.NotFoundException('No university linked to this user');
        return university;
    }
    async findAll(tenantId, pagination, filters) {
        const { page = 1, limit = 20 } = pagination;
        const offset = (0, pagination_util_1.getSkip)(page, limit);
        let whereClause = 'WHERE u.tenant_id = $1';
        const params = [tenantId];
        if (filters?.status) {
            params.push(filters.status);
            whereClause += ` AND u.status = $${params.length}`;
        }
        if (filters?.search) {
            params.push(`%${filters.search}%`);
            whereClause += ` AND (u.name ILIKE $${params.length} OR u.city ILIKE $${params.length})`;
        }
        const [data, [count]] = await Promise.all([
            this.dataSource.query(`SELECT u.*,
                COUNT(DISTINCT a.id) FILTER (WHERE a.current_status = 'active_student') AS active_students,
                COUNT(DISTINCT ua.id) FILTER (WHERE ua.status = 'active') AS active_agreements
         FROM universities u
         LEFT JOIN applications a ON a.university_id = u.id
         LEFT JOIN university_agreements ua ON ua.university_id = u.id
         ${whereClause}
         GROUP BY u.id
         ORDER BY u.name ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
            this.dataSource.query(`SELECT COUNT(*) FROM universities u ${whereClause}`, params),
        ]);
        return (0, pagination_util_1.paginate)(data, parseInt(count.count), page, limit);
    }
    async findOne(id, tenantId) {
        const [university] = await this.dataSource.query(`SELECT u.*,
              json_agg(DISTINCT uc.*) FILTER (WHERE uc.id IS NOT NULL) AS contacts,
              json_agg(DISTINCT ua.*) FILTER (WHERE ua.id IS NOT NULL) AS agreements
       FROM universities u
       LEFT JOIN university_contacts uc ON uc.university_id = u.id AND uc.status = 'active'
       LEFT JOIN university_agreements ua ON ua.university_id = u.id
       WHERE u.id = $1 AND u.tenant_id = $2
       GROUP BY u.id`, [id, tenantId]);
        if (!university)
            throw new common_1.NotFoundException('University not found');
        return university;
    }
    async update(id, tenantId, dto, updatedBy) {
        const university = await this.findOne(id, tenantId);
        const [updated] = await this.dataSource.query(`UPDATE universities
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
       RETURNING *`, [
            id, tenantId, dto.name, dto.shortName, dto.city,
            dto.address, dto.website, dto.status, dto.riskLevel, dto.notes,
        ]);
        await this.auditLog(tenantId, updatedBy, 'university.updated', id, university, dto);
        return updated;
    }
    async createAgreement(universityId, tenantId, dto, createdBy) {
        await this.findOne(universityId, tenantId);
        if (!Object.values(enums_1.PaymentModelType).includes(dto.paymentModel)) {
            throw new common_1.BadRequestException(`Invalid payment model: ${dto.paymentModel}`);
        }
        const [agreement] = await this.dataSource.query(`INSERT INTO university_agreements
        (tenant_id, university_id, version, payment_model, refund_policy,
         discount_percentage, referral_commission, financing_levels,
         max_financing_amount, currency, effective_date, expiration_date,
         status, notes, created_by)
       VALUES ($1,$2,
         (SELECT COALESCE(MAX(version), 0) + 1 FROM university_agreements
          WHERE university_id = $3),
         $4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13,$14)
       RETURNING *`, [
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
        ]);
        if (dto.paymentModel === enums_1.PaymentModelType.TRANCHE ||
            dto.paymentModel === enums_1.PaymentModelType.HYBRID) {
            if (!dto.tranches?.length) {
                throw new common_1.BadRequestException('Tranches required for tranche/hybrid payment model');
            }
            const totalPercentage = dto.tranches.reduce((sum, t) => sum + t.percentage, 0);
            if (Math.abs(totalPercentage - 100) > 0.01) {
                throw new common_1.BadRequestException('Tranche percentages must sum to 100%');
            }
            for (const tranche of dto.tranches) {
                await this.dataSource.query(`INSERT INTO agreement_tranches
            (agreement_id, tranche_sequence, percentage, trigger_type,
             trigger_condition, due_days_offset, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
                    agreement.id, tranche.sequence, tranche.percentage,
                    tranche.triggerType, JSON.stringify(tranche.triggerCondition || {}),
                    tranche.dueDaysOffset, tranche.notes,
                ]);
            }
        }
        await this.auditLog(tenantId, createdBy, 'university.agreement.created', agreement.id, null, dto);
        return agreement;
    }
    async approveAgreement(agreementId, tenantId, approvedBy) {
        const [agreement] = await this.dataSource.query(`SELECT * FROM university_agreements WHERE id = $1 AND tenant_id = $2`, [agreementId, tenantId]);
        if (!agreement)
            throw new common_1.NotFoundException('Agreement not found');
        if (agreement.status !== 'draft')
            throw new common_1.BadRequestException('Agreement must be in draft status to approve');
        await this.dataSource.query(`UPDATE university_agreements
       SET status = 'expired'
       WHERE university_id = $1 AND status = 'active' AND id != $2`, [agreement.university_id, agreementId]);
        const [updated] = await this.dataSource.query(`UPDATE university_agreements
       SET status = 'active', signed_by_forsa = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`, [agreementId, tenantId, approvedBy]);
        await this.auditLog(tenantId, approvedBy, 'university.agreement.approved', agreementId, agreement, { status: 'active' });
        return updated;
    }
    async getActiveAgreement(universityId, tenantId) {
        const [agreement] = await this.dataSource.query(`SELECT ua.*, json_agg(at.*) FILTER (WHERE at.id IS NOT NULL) AS tranches
       FROM university_agreements ua
       LEFT JOIN agreement_tranches at ON at.agreement_id = ua.id
       WHERE ua.university_id = $1 AND ua.tenant_id = $2 AND ua.status = 'active'
       GROUP BY ua.id
       ORDER BY ua.effective_date DESC
       LIMIT 1`, [universityId, tenantId]);
        return agreement || null;
    }
    async addContact(universityId, tenantId, dto) {
        await this.findOne(universityId, tenantId);
        const [contact] = await this.dataSource.query(`INSERT INTO university_contacts
        (university_id, full_name, title, role, email, phone, is_primary, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active')
       RETURNING *`, [universityId, dto.fullName, dto.title, dto.role, dto.email, dto.phone, dto.isPrimary || false]);
        return contact;
    }
    async getPerformance(universityId, tenantId) {
        const [stats] = await this.dataSource.query(`SELECT
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
       WHERE u.id = $1 AND u.tenant_id = $2`, [universityId, tenantId]);
        return stats;
    }
    async getMyPerformance(userId, tenantId) {
        const university = await this.findMe(userId, tenantId);
        return this.getPerformance(university.id, tenantId);
    }
    async createProgram(universityId, tenantId, dto) {
        await this.findOne(universityId, tenantId);
        const [program] = await this.dataSource.query(`INSERT INTO programs
        (university_id, name, code, level, duration_years, tuition_min,
         tuition_max, currency, accreditation_status, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
       RETURNING *`, [
            universityId, dto.name, dto.code, dto.level,
            dto.durationYears, dto.tuitionMin, dto.tuitionMax,
            dto.currency || 'TND', dto.accreditationStatus,
        ]);
        return program;
    }
    async findPrograms(universityId, tenantId) {
        await this.findOne(universityId, tenantId);
        return this.dataSource.query(`SELECT * FROM programs WHERE university_id = $1 AND status = 'active' ORDER BY name`, [universityId]);
    }
    async findProgramsPublic(universityId, tenantId) {
        if (!tenantId)
            throw new common_1.BadRequestException('tenantId is required');
        return this.dataSource.query(`SELECT p.id, p.name, p.tuition_amount FROM programs p
       JOIN universities u ON u.id = p.university_id
       WHERE p.university_id = $1 AND u.tenant_id = $2 AND p.status = 'active'
       ORDER BY p.name`, [universityId, tenantId]);
    }
    async initiateBusinessContinuity(universityId, tenantId, dto, initiatedBy) {
        const affectedStudents = await this.dataSource.query(dto.level === 'institution'
            ? `SELECT DISTINCT a.student_id
           FROM applications a
           WHERE a.university_id = $1 AND a.tenant_id = $2
             AND a.current_status IN ('active_student','contract_signed','university_paid')`
            : `SELECT DISTINCT a.student_id
           FROM applications a
           WHERE a.university_id = $1 AND a.tenant_id = $2
             AND a.program_id = $3
             AND a.current_status IN ('active_student','contract_signed','university_paid')`, dto.level === 'institution'
            ? [universityId, tenantId]
            : [universityId, tenantId, dto.programId]);
        const eventIds = [];
        for (const student of affectedStudents) {
            const [event] = await this.dataSource.query(`INSERT INTO student_exceptional_events
          (tenant_id, student_id, event_type, description, affects_financial_obligations,
           opened_by, status)
         VALUES ($1,$2,$3,$4,true,$5,'open')
         RETURNING id`, [
                tenantId, student.student_id, dto.eventType,
                `Business continuity event: ${dto.reason}`, initiatedBy,
            ]);
            eventIds.push(event.id);
        }
        await this.auditLog(tenantId, initiatedBy, 'university.business_continuity.initiated', universityId, null, { ...dto, affectedStudents: affectedStudents.length });
        return {
            affectedStudents: affectedStudents.length,
            exceptionalEventIds: eventIds,
            message: `Business continuity initiated for ${affectedStudents.length} students`,
        };
    }
    async auditLog(tenantId, userId, action, targetId, previous, next) {
        await this.dataSource.query(`INSERT INTO audit_logs
        (tenant_id, user_id, action_type, module, target_entity, target_id,
         previous_value, new_value, created_at)
       VALUES ($1,$2,$3,'universities','universities',$4,$5,$6,NOW())`, [tenantId, userId, action, targetId,
            previous ? JSON.stringify(previous) : null,
            next ? JSON.stringify(next) : null]).catch(err => this.logger.error('Audit log failed', err));
    }
};
exports.UniversitiesService = UniversitiesService;
exports.UniversitiesService = UniversitiesService = UniversitiesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], UniversitiesService);
//# sourceMappingURL=universities.service.js.map