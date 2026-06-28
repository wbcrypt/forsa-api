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
var PartnersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const enums_1 = require("../common/enums");
const pagination_util_1 = require("../common/utils/pagination.util");
const policy_service_1 = require("../policy/policy.service");
let PartnersService = PartnersService_1 = class PartnersService {
    constructor(dataSource, policyService) {
        this.dataSource = dataSource;
        this.policyService = policyService;
        this.logger = new common_1.Logger(PartnersService_1.name);
    }
    async create(dto, tenantId, createdBy) {
        const [partner] = await this.dataSource.query(`INSERT INTO partners
        (tenant_id, name, type, website, country_code, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7)
       RETURNING *`, [tenantId, dto.name, dto.type, dto.website, dto.countryCode, dto.notes, createdBy]);
        await this.audit(tenantId, createdBy, 'partner.created', partner.id, null, dto);
        return partner;
    }
    async findAll(tenantId, pagination, filters) {
        const { page = 1, limit = 20 } = pagination;
        const offset = (0, pagination_util_1.getSkip)(page, limit);
        const [data, [count]] = await Promise.all([
            this.dataSource.query(`SELECT p.*,
                COUNT(DISTINCT pc.id) AS total_referrals,
                COUNT(DISTINCT pc.id) FILTER (WHERE pc.status = 'paid') AS paid_commissions,
                COALESCE(SUM(pc.partner_share) FILTER (WHERE pc.status = 'paid'), 0) AS total_earned
         FROM partners p
         LEFT JOIN partner_commissions pc ON pc.partner_id = p.id
         WHERE p.tenant_id = $1
         GROUP BY p.id
         ORDER BY p.name ASC
         LIMIT $2 OFFSET $3`, [tenantId, limit, offset]),
            this.dataSource.query(`SELECT COUNT(*) FROM partners WHERE tenant_id = $1`, [tenantId]),
        ]);
        return (0, pagination_util_1.paginate)(data, parseInt(count.count), page, limit);
    }
    async findOne(id, tenantId) {
        const [partner] = await this.dataSource.query(`SELECT p.*,
              json_agg(DISTINCT pc.*) FILTER (WHERE pc.id IS NOT NULL) AS contacts,
              json_agg(DISTINCT pa.*) FILTER (WHERE pa.id IS NOT NULL) AS agreements
       FROM partners p
       LEFT JOIN partner_contacts pc ON pc.partner_id = p.id AND pc.status = 'active'
       LEFT JOIN partner_agreements pa ON pa.partner_id = p.id
       WHERE p.id = $1 AND p.tenant_id = $2
       GROUP BY p.id`, [id, tenantId]);
        if (!partner)
            throw new common_1.NotFoundException('Partner not found');
        return partner;
    }
    async createAgreement(partnerId, tenantId, dto, createdBy) {
        await this.findOne(partnerId, tenantId);
        const commissionStructure = dto.commissionStructure;
        if (!commissionStructure) {
            throw new common_1.BadRequestException('Commission structure is required');
        }
        const [agreement] = await this.dataSource.query(`INSERT INTO partner_agreements
        (tenant_id, partner_id, version, commission_structure, payment_conditions,
         max_visible_information, allowed_reports, data_sharing_permissions,
         confidentiality_terms, fraud_prevention_terms, termination_conditions,
         audit_rights, effective_date, expiration_date, status, created_by)
       VALUES ($1,$2,
         (SELECT COALESCE(MAX(version), 0) + 1 FROM partner_agreements WHERE partner_id = $3),
         $4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft',$15)
       RETURNING *`, [
            tenantId, partnerId, partnerId,
            JSON.stringify(commissionStructure),
            JSON.stringify(dto.paymentConditions || {}),
            JSON.stringify(dto.maxVisibleInformation || {}),
            dto.allowedReports || [],
            JSON.stringify(dto.dataSharingPermissions || {}),
            dto.confidentialityTerms,
            dto.fraudPreventionTerms,
            dto.terminationConditions,
            dto.auditRights || false,
            dto.effectiveDate,
            dto.expirationDate || null,
            createdBy,
        ]);
        await this.audit(tenantId, createdBy, 'partner.agreement.created', agreement.id, null, dto);
        return agreement;
    }
    async calculateCommission(partnerId, applicationId, tenantId) {
        const [agreement] = await this.dataSource.query(`SELECT * FROM partner_agreements
       WHERE partner_id = $1 AND tenant_id = $2 AND status = 'active'
       ORDER BY effective_date DESC LIMIT 1`, [partnerId, tenantId]);
        if (!agreement)
            throw new common_1.BadRequestException('No active partner agreement found');
        const [application] = await this.dataSource.query(`SELECT * FROM applications WHERE id = $1 AND tenant_id = $2`, [applicationId, tenantId]);
        if (!application)
            throw new common_1.NotFoundException('Application not found');
        const structure = agreement.commission_structure;
        let grossAmount = 0;
        let forsaShare = 0;
        let partnerShare = 0;
        const commissionBasis = structure.basis || 'flat_fee';
        switch (commissionBasis) {
            case 'flat_fee':
                grossAmount = structure.flat_amount || 0;
                partnerShare = grossAmount * (structure.partner_percentage / 100);
                forsaShare = grossAmount - partnerShare;
                break;
            case 'percentage_tuition':
                grossAmount = application.tuition_amount * (structure.percentage / 100);
                partnerShare = grossAmount * (structure.partner_percentage / 100);
                forsaShare = grossAmount - partnerShare;
                break;
            case 'percentage_financed':
                const financedAmount = application.tuition_amount;
                grossAmount = financedAmount * (structure.percentage / 100);
                partnerShare = grossAmount * (structure.partner_percentage / 100);
                forsaShare = grossAmount - partnerShare;
                break;
            default:
                throw new common_1.BadRequestException(`Unknown commission basis: ${commissionBasis}`);
        }
        const policyCap = await this.policyService.getNumber('commission.structure.default', { tenantId, partnerId });
        return {
            grossAmount: Math.round(grossAmount * 100) / 100,
            forsaShare: Math.round(forsaShare * 100) / 100,
            partnerShare: Math.round(partnerShare * 100) / 100,
            commissionBasis,
            policyVersionId: agreement.id,
        };
    }
    async createCommissionRecord(partnerId, partnAgreementId, applicationId, studentId, tenantId, calculation, policyVersionId) {
        const [commission] = await this.dataSource.query(`INSERT INTO partner_commissions
        (tenant_id, partner_id, partner_agreement_id, application_id, student_id,
         commission_basis, gross_amount, forsa_share, partner_share, currency,
         policy_version_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'TND',$10,'lead')
       RETURNING *`, [
            tenantId, partnerId, partnAgreementId, applicationId, studentId,
            calculation.commissionBasis, calculation.grossAmount,
            calculation.forsaShare, calculation.partnerShare,
            policyVersionId,
        ]);
        return commission;
    }
    async advanceCommissionStatus(commissionId, tenantId, newStatus, approvedBy) {
        const validTransitions = {
            [enums_1.CommissionStatus.LEAD]: [enums_1.CommissionStatus.ELIGIBLE, enums_1.CommissionStatus.CANCELLED],
            [enums_1.CommissionStatus.ELIGIBLE]: [enums_1.CommissionStatus.APPROVED, enums_1.CommissionStatus.CANCELLED],
            [enums_1.CommissionStatus.APPROVED]: [enums_1.CommissionStatus.UNIVERSITY_PAID, enums_1.CommissionStatus.CANCELLED],
            [enums_1.CommissionStatus.UNIVERSITY_PAID]: [enums_1.CommissionStatus.PAYABLE],
            [enums_1.CommissionStatus.PAYABLE]: [enums_1.CommissionStatus.PAID],
            [enums_1.CommissionStatus.PAID]: [enums_1.CommissionStatus.CLAWBACK_INITIATED],
            [enums_1.CommissionStatus.CLAWBACK_INITIATED]: [enums_1.CommissionStatus.CLAWED_BACK],
        };
        const [commission] = await this.dataSource.query(`SELECT * FROM partner_commissions WHERE id = $1 AND tenant_id = $2`, [commissionId, tenantId]);
        if (!commission)
            throw new common_1.NotFoundException('Commission not found');
        const allowed = validTransitions[commission.status] || [];
        if (!allowed.includes(newStatus)) {
            throw new common_1.BadRequestException(`Cannot transition from ${commission.status} to ${newStatus}`);
        }
        const [updated] = await this.dataSource.query(`UPDATE partner_commissions
       SET status = $3,
           approved_by = CASE WHEN $3 = 'approved' THEN $4 ELSE approved_by END,
           approved_at = CASE WHEN $3 = 'approved' THEN NOW() ELSE approved_at END,
           paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`, [commissionId, tenantId, newStatus, approvedBy]);
        await this.audit(tenantId, approvedBy, 'partner.commission.status_changed', commissionId, { status: commission.status }, { status: newStatus });
        return updated;
    }
    async getCommissions(tenantId, filters, pagination) {
        const { page = 1, limit = 20 } = pagination;
        const offset = (0, pagination_util_1.getSkip)(page, limit);
        const [data, [count]] = await Promise.all([
            this.dataSource.query(`SELECT pc.*, p.name AS partner_name, s.first_name, s.last_name,
                u.name AS university_name
         FROM partner_commissions pc
         JOIN partners p ON p.id = pc.partner_id
         JOIN students s ON s.id = pc.student_id
         JOIN applications a ON a.id = pc.application_id
         JOIN universities u ON u.id = a.university_id
         WHERE pc.tenant_id = $1
         ORDER BY pc.created_at DESC
         LIMIT $2 OFFSET $3`, [tenantId, limit, offset]),
            this.dataSource.query(`SELECT COUNT(*) FROM partner_commissions WHERE tenant_id = $1`, [tenantId]),
        ]);
        return (0, pagination_util_1.paginate)(data, parseInt(count.count), page, limit);
    }
    async getPartnerDashboard(partnerId, tenantId) {
        const [agreement] = await this.dataSource.query(`SELECT max_visible_information FROM partner_agreements
       WHERE partner_id = $1 AND tenant_id = $2 AND status = 'active'
       LIMIT 1`, [partnerId, tenantId]);
        const [stats] = await this.dataSource.query(`SELECT
         COUNT(*) AS total_leads,
         COUNT(*) FILTER (WHERE pc.status IN ('approved','university_paid','payable','paid')) AS accepted,
         COUNT(*) FILTER (WHERE a.current_status = 'rejected') AS rejected,
         COALESCE(SUM(pc.partner_share) FILTER (WHERE pc.status = 'paid'), 0) AS paid_commission,
         COALESCE(SUM(pc.partner_share) FILTER (WHERE pc.status IN ('payable','approved','university_paid')), 0) AS pending_commission,
         CASE WHEN COUNT(*) > 0 THEN
           ROUND(COUNT(*) FILTER (WHERE pc.status NOT IN ('lead','cancelled'))::numeric / COUNT(*) * 100, 2)
         ELSE 0 END AS conversion_rate
       FROM partner_commissions pc
       JOIN applications a ON a.id = pc.application_id
       WHERE pc.partner_id = $1 AND pc.tenant_id = $2`, [partnerId, tenantId]);
        return stats;
    }
    async audit(tenantId, userId, action, targetId, prev, next) {
        await this.dataSource.query(`INSERT INTO audit_logs (tenant_id, user_id, action_type, module, target_entity, target_id, previous_value, new_value, created_at)
       VALUES ($1,$2,$3,'partners','partners',$4,$5,$6,NOW())`, [tenantId, userId, action, targetId,
            prev ? JSON.stringify(prev) : null, next ? JSON.stringify(next) : null]).catch(err => this.logger.error('Audit log failed', err));
    }
};
exports.PartnersService = PartnersService;
exports.PartnersService = PartnersService = PartnersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        policy_service_1.PolicyService])
], PartnersService);
//# sourceMappingURL=partners.service.js.map