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
var CollectionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const policy_service_1 = require("../policy/policy.service");
const score_service_1 = require("../score/score.service");
const enums_1 = require("../common/enums");
const pagination_util_1 = require("../common/utils/pagination.util");
let CollectionsService = CollectionsService_1 = class CollectionsService {
    constructor(dataSource, policyService, scoreService) {
        this.dataSource = dataSource;
        this.policyService = policyService;
        this.scoreService = scoreService;
        this.logger = new common_1.Logger(CollectionsService_1.name);
    }
    async getDashboard(tenantId) {
        const [stats] = await this.dataSource.query(`SELECT
         COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'late') AS late_count,
         COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'default_risk') AS default_risk_count,
         COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'defaulted') AS defaulted_count,
         COALESCE(SUM(i.amount - COALESCE(i.amount_paid,0)) FILTER (WHERE i.status = 'late'), 0) AS late_amount,
         COALESCE(SUM(i.amount - COALESCE(i.amount_paid,0)) FILTER (WHERE i.status = 'default_risk'), 0) AS default_risk_amount,
         COALESCE(SUM(i.amount - COALESCE(i.amount_paid,0)) FILTER (WHERE i.status = 'defaulted'), 0) AS defaulted_amount
       FROM installments i
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       WHERE ps.tenant_id = $1`, [tenantId]);
        return stats;
    }
    async getLateInstallments(tenantId, pagination, filters = {}) {
        const { page = 1, limit = 20 } = pagination;
        const offset = (0, pagination_util_1.getSkip)(page, limit);
        let whereExtra = '';
        const params = [tenantId];
        if (filters.status) {
            params.push(filters.status);
            whereExtra += ` AND i.status = $${params.length}`;
        }
        else {
            whereExtra += ` AND i.status IN ('late','default_risk','defaulted')`;
        }
        const [data, [count]] = await Promise.all([
            this.dataSource.query(`SELECT i.id, i.sequence_number, i.amount, i.amount_paid, i.due_date,
                i.grace_due_date, i.status,
                s.first_name, s.last_name, s.email, s.phone_primary,
                u.name AS university_name,
                a.id AS application_id,
                CURRENT_DATE - i.grace_due_date AS days_overdue,
                fs.aggregate_score, fs.score_band
         FROM installments i
         JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
         JOIN applications a ON a.id = ps.application_id
         JOIN students s ON s.id = a.student_id
         JOIN universities u ON u.id = a.university_id
         LEFT JOIN forsa_scores fs ON fs.student_id = a.student_id
         WHERE ps.tenant_id = $1 ${whereExtra}
         ORDER BY days_overdue DESC NULLS LAST, i.amount DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
            this.dataSource.query(`SELECT COUNT(*) FROM installments i
         JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
         WHERE ps.tenant_id = $1 ${whereExtra}`, params),
        ]);
        return (0, pagination_util_1.paginate)(data, parseInt(count.count), page, limit);
    }
    async logContactAttempt(params) {
        const [log] = await this.dataSource.query(`INSERT INTO collection_contact_logs
        (tenant_id, installment_id, student_id, contact_method, outcome,
         notes, logged_by, next_follow_up_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`, [
            params.tenantId, params.installmentId, params.studentId,
            params.method, params.outcome, params.notes, params.loggedBy,
            params.nextFollowUpDate || null,
        ]);
        if (params.outcome === 'no_answer' || params.outcome === 'refused') {
            await this.scoreService.recordEvent({
                tenantId: params.tenantId,
                studentId: params.studentId,
                dimension: enums_1.ScoreDimension.COMMUNICATION_RELIABILITY,
                eventCode: 'COLLECTION_NON_RESPONSIVE',
                points: -10,
                sourceType: enums_1.SourceTrustLevel.STAFF_VERIFIED,
                sourceId: params.loggedBy,
                description: `Collection contact: ${params.outcome}`,
                referenceId: params.installmentId,
                referenceType: 'installment',
                recordedBy: params.loggedBy,
            }).catch(() => { });
        }
        return log;
    }
    async getContactHistory(installmentId, tenantId) {
        return this.dataSource.query(`SELECT ccl.*, u.full_name AS logged_by_name
       FROM collection_contact_logs ccl
       LEFT JOIN users u ON u.id = ccl.logged_by
       WHERE ccl.installment_id = $1 AND ccl.tenant_id = $2
       ORDER BY ccl.created_at DESC`, [installmentId, tenantId]);
    }
    async getPrioritizedWorklist(tenantId, assignedTo) {
        return this.dataSource.query(`SELECT i.id, i.amount - COALESCE(i.amount_paid,0) AS outstanding,
              i.due_date, i.status,
              s.first_name, s.last_name, s.phone_primary, s.email,
              fs.aggregate_score,
              CURRENT_DATE - i.grace_due_date AS days_overdue,
              (SELECT COUNT(*) FROM collection_contact_logs ccl
               WHERE ccl.installment_id = i.id) AS contact_attempts,
              (SELECT MAX(ccl.created_at) FROM collection_contact_logs ccl
               WHERE ccl.installment_id = i.id) AS last_contact_at
       FROM installments i
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       JOIN applications a ON a.id = ps.application_id
       JOIN students s ON s.id = a.student_id
       LEFT JOIN forsa_scores fs ON fs.student_id = a.student_id
       WHERE ps.tenant_id = $1
         AND i.status IN ('late','default_risk')
         AND ($2::uuid IS NULL OR a.assigned_to_user_id = $2)
       ORDER BY
         (i.amount - COALESCE(i.amount_paid,0)) DESC,
         COALESCE(fs.aggregate_score, 500) ASC,
         days_overdue DESC NULLS LAST
       LIMIT 100`, [tenantId, assignedTo || null]);
    }
};
exports.CollectionsService = CollectionsService;
exports.CollectionsService = CollectionsService = CollectionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        policy_service_1.PolicyService,
        score_service_1.ScoreService])
], CollectionsService);
//# sourceMappingURL=collections.service.js.map