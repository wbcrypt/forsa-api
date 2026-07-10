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
var ReportsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let ReportsService = ReportsService_1 = class ReportsService {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(ReportsService_1.name);
    }
    async getCeoDashboard(tenantId) {
        const [portfolio, pipeline, payments, partners] = await Promise.all([
            this.dataSource.query(`SELECT
           COUNT(DISTINCT a.id) AS total_applications,
           COUNT(DISTINCT a.id) FILTER (WHERE a.current_status = 'active_student') AS active_students,
           COUNT(DISTINCT a.id) FILTER (WHERE a.current_status = 'completed') AS completed,
           COUNT(DISTINCT a.id) FILTER (WHERE a.current_status IN ('new_lead','contacted','waiting_for_documents','documents_received','under_review')) AS in_pipeline,
           COUNT(DISTINCT a.id) FILTER (WHERE a.current_status = 'rejected') AS rejected,
           COALESCE(SUM(fd.approved_amount) FILTER (WHERE a.current_status IN ('active_student','contract_signed','university_paid')), 0) AS deployed_capital,
           COALESCE(SUM(i.amount - COALESCE(i.amount_paid,0)) FILTER (WHERE i.status IN ('late','default_risk','defaulted')), 0) AS overdue_amount,
           COUNT(DISTINCT u.id) AS partner_universities
         FROM applications a
         LEFT JOIN financing_decisions fd ON fd.pipeline_run_id = a.current_pipeline_run_id
         LEFT JOIN payment_schedules ps ON ps.application_id = a.id
         LEFT JOIN installments i ON i.payment_schedule_id = ps.id
         LEFT JOIN universities u ON u.id = a.university_id AND u.status = 'active'
         WHERE a.tenant_id = $1`, [tenantId]),
            this.dataSource.query(`SELECT
           DATE_TRUNC('month', a.lead_date) AS month,
           COUNT(*) AS new_leads,
           COUNT(*) FILTER (WHERE a.current_status NOT IN ('rejected','withdrawn')) AS converted
         FROM applications a
         WHERE a.tenant_id = $1 AND a.lead_date >= NOW() - INTERVAL '6 months'
         GROUP BY 1 ORDER BY 1`, [tenantId]),
            this.dataSource.query(`SELECT
           DATE_TRUNC('month', p.payment_date) AS month,
           SUM(p.amount) AS collected,
           COUNT(*) AS payment_count
         FROM payments p
         WHERE p.tenant_id = $1 AND p.status = 'confirmed'
           AND p.payment_date >= NOW() - INTERVAL '6 months'
         GROUP BY 1 ORDER BY 1`, [tenantId]),
            this.dataSource.query(`SELECT COUNT(DISTINCT pc.partner_id) AS active_partners,
                SUM(pc.partner_share) FILTER (WHERE pc.status = 'payable') AS pending_commissions
         FROM partner_commissions pc
         WHERE pc.tenant_id = $1`, [tenantId]),
        ]);
        return {
            summary: portfolio[0],
            leadTrend: pipeline,
            collectionTrend: payments,
            partnerStats: partners[0],
        };
    }
    async getFinanceDashboard(tenantId) {
        const [ledger, receivables, disbursements] = await Promise.all([
            this.dataSource.query(`SELECT account,
                SUM(amount) FILTER (WHERE entry_type = 'debit') AS total_debit,
                SUM(amount) FILTER (WHERE entry_type = 'credit') AS total_credit
         FROM financial_ledger
         WHERE tenant_id = $1
         GROUP BY account ORDER BY account`, [tenantId]),
            this.dataSource.query(`SELECT
           SUM(i.amount - COALESCE(i.amount_paid,0)) FILTER (WHERE i.status = 'pending') AS current,
           SUM(i.amount - COALESCE(i.amount_paid,0)) FILTER (WHERE i.status IN ('due_soon','due_today')) AS due_soon,
           SUM(i.amount - COALESCE(i.amount_paid,0)) FILTER (WHERE i.status = 'late') AS late,
           SUM(i.amount - COALESCE(i.amount_paid,0)) FILTER (WHERE i.status = 'default_risk') AS default_risk,
           SUM(i.amount - COALESCE(i.amount_paid,0)) FILTER (WHERE i.status = 'defaulted') AS defaulted
         FROM installments i
         JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
         WHERE ps.tenant_id = $1`, [tenantId]),
            this.dataSource.query(`SELECT ud.*, u.name AS university_name
         FROM university_disbursements ud
         JOIN universities u ON u.id = ud.university_id
         WHERE ud.tenant_id = $1 AND ud.disbursed_at >= NOW() - INTERVAL '3 months'
         ORDER BY ud.disbursed_at DESC LIMIT 50`, [tenantId]),
        ]);
        return { ledger, receivables: receivables[0], recentDisbursements: disbursements };
    }
    async getSalesDashboard(tenantId) {
        const [funnel, bySource, byUniversity, performance] = await Promise.all([
            this.dataSource.query(`SELECT current_status, COUNT(*) AS count
         FROM applications WHERE tenant_id = $1
         GROUP BY current_status ORDER BY count DESC`, [tenantId]),
            this.dataSource.query(`SELECT rs.display_name AS source, rs.channel,
                COUNT(a.id) AS leads,
                COUNT(a.id) FILTER (WHERE a.current_status = 'active_student') AS converted,
                ROUND(COUNT(a.id) FILTER (WHERE a.current_status = 'active_student')::numeric
                      / NULLIF(COUNT(a.id),0) * 100, 1) AS conversion_rate
         FROM applications a
         JOIN referral_sources rs ON rs.id = a.referral_source_id
         WHERE a.tenant_id = $1
         GROUP BY rs.id ORDER BY leads DESC`, [tenantId]),
            this.dataSource.query(`SELECT u.name, COUNT(a.id) AS applications,
                COUNT(a.id) FILTER (WHERE a.current_status = 'active_student') AS active
         FROM applications a
         JOIN universities u ON u.id = a.university_id
         WHERE a.tenant_id = $1
         GROUP BY u.id ORDER BY applications DESC LIMIT 20`, [tenantId]),
            this.dataSource.query(`SELECT u.full_name,
                COUNT(a.id) AS assigned,
                COUNT(a.id) FILTER (WHERE a.current_status IN ('approved_level1','approved_level2','approved_level3','contract_signed','active_student')) AS closed,
                AVG(EXTRACT(EPOCH FROM (ash2.changed_at - ash1.changed_at))/86400) AS avg_days_to_close
         FROM applications a
         JOIN users u ON u.id = a.assigned_to_user_id
         JOIN application_status_history ash1 ON ash1.application_id = a.id AND ash1.from_status IS NULL
         LEFT JOIN application_status_history ash2 ON ash2.application_id = a.id AND ash2.to_status = 'contract_signed'
         WHERE a.tenant_id = $1 AND a.assigned_to_user_id IS NOT NULL
         GROUP BY u.id ORDER BY closed DESC`, [tenantId]),
        ]);
        return { funnel, bySource, byUniversity, teamPerformance: performance };
    }
    async getCollectionsDashboard(tenantId) {
        const [overview, aging, topOverdue] = await Promise.all([
            this.dataSource.query(`SELECT
           COUNT(*) FILTER (WHERE i.status = 'late') AS late_count,
           COUNT(*) FILTER (WHERE i.status = 'default_risk') AS risk_count,
           COUNT(*) FILTER (WHERE i.status = 'defaulted') AS defaulted_count,
           SUM(i.amount - COALESCE(i.amount_paid,0)) FILTER (WHERE i.status IN ('late','default_risk','defaulted')) AS total_overdue,
           AVG(CURRENT_DATE - i.grace_due_date) FILTER (WHERE i.status IN ('late','default_risk')) AS avg_days_overdue
         FROM installments i
         JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
         WHERE ps.tenant_id = $1`, [tenantId]),
            this.dataSource.query(`SELECT
           CASE
             WHEN CURRENT_DATE - i.grace_due_date BETWEEN 1 AND 15 THEN '1-15 days'
             WHEN CURRENT_DATE - i.grace_due_date BETWEEN 16 AND 30 THEN '16-30 days'
             WHEN CURRENT_DATE - i.grace_due_date BETWEEN 31 AND 60 THEN '31-60 days'
             ELSE '60+ days'
           END AS bucket,
           COUNT(*) AS count,
           SUM(i.amount - COALESCE(i.amount_paid,0)) AS amount
         FROM installments i
         JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
         WHERE ps.tenant_id = $1 AND i.status IN ('late','default_risk')
         GROUP BY 1 ORDER BY MIN(CURRENT_DATE - i.grace_due_date)`, [tenantId]),
            this.dataSource.query(`SELECT s.first_name, s.last_name, s.phone_primary,
                SUM(i.amount - COALESCE(i.amount_paid,0)) AS total_owed,
                MAX(CURRENT_DATE - i.grace_due_date) AS max_days_overdue,
                fs.aggregate_score
         FROM installments i
         JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
         JOIN applications a ON a.id = ps.application_id
         JOIN students s ON s.id = a.student_id
         LEFT JOIN forsa_scores fs ON fs.student_id = a.student_id
         WHERE ps.tenant_id = $1 AND i.status IN ('late','default_risk','defaulted')
         GROUP BY s.id, fs.aggregate_score
         ORDER BY total_owed DESC
         LIMIT 20`, [tenantId]),
        ]);
        return { overview: overview[0], aging, topOverdue };
    }
    async getPartnerDashboard(tenantId) {
        return this.dataSource.query(`SELECT p.name, p.type,
              COUNT(pc.id) AS total_referrals,
              COUNT(pc.id) FILTER (WHERE pc.status NOT IN ('lead','cancelled')) AS accepted,
              COALESCE(SUM(pc.partner_share) FILTER (WHERE pc.status = 'paid'), 0) AS paid_commissions,
              COALESCE(SUM(pc.partner_share) FILTER (WHERE pc.status IN ('payable','approved')), 0) AS pending_commissions,
              ROUND(COUNT(pc.id) FILTER (WHERE pc.status NOT IN ('lead','cancelled'))::numeric
                    / NULLIF(COUNT(pc.id),0) * 100, 1) AS conversion_rate
       FROM partners p
       LEFT JOIN partner_commissions pc ON pc.partner_id = p.id AND pc.tenant_id = $1
       WHERE p.tenant_id = $1
       GROUP BY p.id
       ORDER BY total_referrals DESC`, [tenantId]);
    }
    async getAuditReport(tenantId, filters) {
        const params = [tenantId];
        let whereExtra = '';
        if (filters.module) {
            params.push(filters.module);
            whereExtra += ` AND al.module = $${params.length}`;
        }
        if (filters.userId) {
            params.push(filters.userId);
            whereExtra += ` AND al.user_id = $${params.length}`;
        }
        if (filters.from) {
            params.push(filters.from);
            whereExtra += ` AND al.created_at >= $${params.length}`;
        }
        if (filters.to) {
            params.push(filters.to);
            whereExtra += ` AND al.created_at <= $${params.length}`;
        }
        const limit = filters.limit || 200;
        params.push(limit);
        return this.dataSource.query(`SELECT al.*, u.full_name AS user_name, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.tenant_id = $1 ${whereExtra}
       ORDER BY al.created_at DESC
       LIMIT $${params.length}`, params);
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = ReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], ReportsService);
//# sourceMappingURL=reports.service.js.map