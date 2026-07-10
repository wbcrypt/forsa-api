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
var ScoreService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const schedule_1 = require("@nestjs/schedule");
const policy_service_1 = require("../policy/policy.service");
const enums_1 = require("../common/enums");
const SCORE_MIN = 300;
const SCORE_MAX = 1000;
const SCORE_DEFAULT_FIRST_TIME = 500;
let ScoreService = ScoreService_1 = class ScoreService {
    constructor(dataSource, policyService) {
        this.dataSource = dataSource;
        this.policyService = policyService;
        this.logger = new common_1.Logger(ScoreService_1.name);
    }
    async recordEvent(params) {
        const pointPolicy = await this.policyService.resolve(`score.event.${params.eventCode}.points`, { tenantId: params.tenantId, studentId: params.studentId });
        const pointValue = pointPolicy
            ? pointPolicy.value
            : params.points;
        const policyVersionId = pointPolicy?.policyVersionId || params.policyVersionId;
        const [currentBalance] = await this.dataSource.query(`SELECT running_balance FROM score_running_balances
       WHERE student_id = $1 AND dimension = $2`, [params.studentId, params.dimension]);
        const previousBalance = currentBalance?.running_balance || SCORE_DEFAULT_FIRST_TIME;
        const newBalance = Math.max(SCORE_MIN, Math.min(SCORE_MAX, previousBalance + pointValue));
        const severity = params.severity || this.inferSeverity(params.eventCode);
        const [event] = await this.dataSource.query(`INSERT INTO score_events
        (tenant_id, student_id, dimension, event_code, points, previous_balance, new_balance,
         source_type, source_id, severity, description, reference_id, reference_type,
         policy_version_id, recorded_by, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true)
       RETURNING id`, [
            params.tenantId, params.studentId, params.dimension, params.eventCode,
            pointValue, previousBalance, newBalance,
            params.sourceType, params.sourceId, severity,
            params.description, params.referenceId || null, params.referenceType || null,
            policyVersionId || null, params.recordedBy,
        ]);
        await this.dataSource.query(`INSERT INTO score_running_balances (student_id, dimension, running_balance, last_event_id, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (student_id, dimension) DO UPDATE
       SET running_balance = $3, last_event_id = $4, updated_at = NOW()`, [params.studentId, params.dimension, newBalance, event.id]);
        const { aggregateScore, band } = await this.recomputeAggregate(params.studentId, params.tenantId);
        return { eventId: event.id, newBalance: aggregateScore, newBand: band };
    }
    async getScoreForMyUniversityStudent(userId, tenantId, studentId) {
        const [owned] = await this.dataSource.query(`SELECT 1
       FROM applications a
       JOIN universities uni ON uni.id = a.university_id
       WHERE a.student_id = $1 AND a.tenant_id = $2 AND uni.user_id = $3
       LIMIT 1`, [studentId, tenantId, userId]);
        if (!owned)
            throw new common_1.NotFoundException('Student not found');
        return this.getScore(studentId, tenantId);
    }
    async getScore(studentId, tenantId) {
        const [score] = await this.dataSource.query(`SELECT fs.*, json_object_agg(srb.dimension, srb.running_balance) AS dimension_balances
       FROM forsa_scores fs
       LEFT JOIN score_running_balances srb ON srb.student_id = fs.student_id
       WHERE fs.student_id = $1
       GROUP BY fs.id`, [studentId]);
        if (!score) {
            const startingScorePolicy = await this.policyService.resolve('score.starting.first_time', { tenantId });
            const startingScore = startingScorePolicy?.value || SCORE_DEFAULT_FIRST_TIME;
            const [newScore] = await this.dataSource.query(`INSERT INTO forsa_scores
          (student_id, aggregate_score, score_band, score_version, ceiling_active)
         VALUES ($1,$2,$3,'v1',false)
         RETURNING *`, [studentId, startingScore, this.getBand(startingScore)]);
            for (const dimension of Object.values(enums_1.ScoreDimension)) {
                await this.dataSource.query(`INSERT INTO score_running_balances (student_id, dimension, running_balance)
           VALUES ($1,$2,$3)
           ON CONFLICT DO NOTHING`, [studentId, dimension, startingScore]);
            }
            return newScore;
        }
        return score;
    }
    async createCorrectiveEvent(params) {
        const [original] = await this.dataSource.query(`SELECT * FROM score_events WHERE id = $1 AND student_id = $2 AND is_active = true`, [params.originalEventId, params.studentId]);
        if (!original)
            throw new common_1.NotFoundException('Original score event not found or already superseded');
        const [existing] = await this.dataSource.query(`SELECT id FROM corrective_score_events WHERE original_event_id = $1`, [params.originalEventId]);
        if (existing)
            throw new common_1.BadRequestException('This event already has a corrective event');
        await this.dataSource.query(`UPDATE score_events SET is_active = false WHERE id = $1`, [params.originalEventId]);
        const [corrective] = await this.dataSource.query(`INSERT INTO corrective_score_events
        (tenant_id, student_id, original_event_id, dimension, compensating_points,
         reason, approved_by, policy_version_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`, [
            params.tenantId, params.studentId, params.originalEventId, params.dimension,
            params.compensatingPoints, params.reason, params.approvedBy,
            params.policyVersionId || null,
        ]);
        await this.recordEvent({
            tenantId: params.tenantId,
            studentId: params.studentId,
            dimension: params.dimension,
            eventCode: 'CORRECTIVE_ADJUSTMENT',
            points: params.compensatingPoints,
            sourceType: enums_1.SourceTrustLevel.STAFF_VERIFIED,
            sourceId: params.approvedBy,
            description: `Corrective event: ${params.reason}`,
            referenceId: params.originalEventId,
            referenceType: 'score_event',
            recordedBy: params.approvedBy,
        });
        await this.checkAndUpdateCeiling(params.studentId, params.tenantId);
        return corrective.id;
    }
    async scheduledReconciliation() {
        this.logger.log('Starting scheduled score reconciliation');
        const students = await this.dataSource.query(`SELECT DISTINCT student_id FROM score_events WHERE created_at > NOW() - INTERVAL '25 hours'`);
        for (const row of students) {
            try {
                await this.reconcileStudentScore(row.student_id, 'SCHEDULED');
            }
            catch (err) {
                this.logger.error(`Reconciliation failed for student ${row.student_id}`, err);
            }
        }
    }
    async reconcileStudentScore(studentId, triggeredBy) {
        const dimensionBalances = await this.computeDimensionBalancesFromEvents(studentId);
        const storedBalances = await this.dataSource.query(`SELECT dimension, running_balance FROM score_running_balances WHERE student_id = $1`, [studentId]);
        const storedMap = Object.fromEntries(storedBalances.map(r => [r.dimension, parseFloat(r.running_balance)]));
        let hasDiscrepancy = false;
        const discrepancies = [];
        for (const [dimension, computedBalance] of Object.entries(dimensionBalances)) {
            const stored = storedMap[dimension] || SCORE_DEFAULT_FIRST_TIME;
            const diff = Math.abs(computedBalance - stored);
            if (diff > 1) {
                hasDiscrepancy = true;
                discrepancies.push({ dimension, stored, computed: computedBalance, diff });
            }
        }
        if (hasDiscrepancy) {
            await this.dataSource.query(`INSERT INTO data_integrity_events
          (entity_type, entity_id, description, details, severity, status)
         VALUES ('score','$1','Score reconciliation discrepancy detected',$2,'medium','open')`, [studentId, JSON.stringify({ discrepancies, triggeredBy, reconciledAt: new Date() })]);
            this.logger.warn(`Score discrepancy detected for student ${studentId}`, { discrepancies });
        }
    }
    async getScoreHistory(studentId, tenantId) {
        return this.dataSource.query(`SELECT se.*, cse.reason AS corrective_reason, cse.compensating_points
       FROM score_events se
       LEFT JOIN corrective_score_events cse ON cse.original_event_id = se.id
       WHERE se.student_id = $1 AND se.tenant_id = $2
       ORDER BY se.created_at DESC`, [studentId, tenantId]);
    }
    async recomputeAggregate(studentId, tenantId) {
        const weightPolicy = await this.policyService.resolve('score.dimension.weights', { tenantId });
        const weights = weightPolicy?.value || {
            [enums_1.ScoreDimension.PAYMENT_RELIABILITY]: 0.40,
            [enums_1.ScoreDimension.DOCUMENTATION_RELIABILITY]: 0.20,
            [enums_1.ScoreDimension.COMMUNICATION_RELIABILITY]: 0.15,
            [enums_1.ScoreDimension.ACADEMIC_CONTINUITY]: 0.15,
            [enums_1.ScoreDimension.GUARANTOR_RELIABILITY]: 0.10,
        };
        const effectiveBalances = await this.computeDimensionBalancesFromEvents(studentId);
        const [ceilingEvent] = await this.dataSource.query(`SELECT event_code FROM score_events
       WHERE student_id = $1 AND is_active = true
         AND event_code LIKE 'FRAUD%' OR event_code = 'CONTRACT_BREACH_SEVERE'
       LIMIT 1`, [studentId]);
        let aggregateScore = 0;
        for (const [dimension, balance] of Object.entries(effectiveBalances)) {
            const weight = weights[dimension] || 0;
            aggregateScore += balance * weight;
        }
        aggregateScore = Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(aggregateScore)));
        if (ceilingEvent) {
            const ceilingPolicy = await this.policyService.resolve(`score.ceiling.${ceilingEvent.event_code}`, { tenantId });
            const ceiling = ceilingPolicy?.value || 600;
            aggregateScore = Math.min(aggregateScore, ceiling);
        }
        const band = this.getBand(aggregateScore);
        await this.dataSource.query(`INSERT INTO forsa_scores (student_id, aggregate_score, score_band, ceiling_active)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (student_id) DO UPDATE
       SET aggregate_score = $2, score_band = $3, ceiling_active = $4, computed_at = NOW()`, [studentId, aggregateScore, band, !!ceilingEvent]);
        return { aggregateScore, band };
    }
    async computeDimensionBalancesFromEvents(studentId) {
        const balances = {};
        for (const dimension of Object.values(enums_1.ScoreDimension)) {
            const events = await this.dataSource.query(`SELECT points, created_at, severity FROM score_events
         WHERE student_id = $1 AND dimension = $2 AND is_active = true
         ORDER BY created_at ASC`, [studentId, dimension]);
            let balance = SCORE_DEFAULT_FIRST_TIME;
            const now = new Date();
            for (const event of events) {
                let points = parseFloat(event.points);
                const ageMonths = (now.getTime() - new Date(event.created_at).getTime()) / (30 * 24 * 3600 * 1000);
                if (points > 0) {
                    const decayRate = 0.02;
                    points = points * Math.exp(-decayRate * ageMonths);
                }
                else {
                    const severityFloor = event.severity === enums_1.ScoreSeverity.SEVERE ? 0.7
                        : event.severity === enums_1.ScoreSeverity.ELEVATED ? 0.5 : 0.1;
                    const decayedImpact = points * (1 - Math.min(0.9, 0.02 * ageMonths));
                    points = Math.min(points * severityFloor, decayedImpact);
                }
                balance = Math.max(SCORE_MIN, Math.min(SCORE_MAX, balance + points));
            }
            balances[dimension] = Math.round(balance);
        }
        return balances;
    }
    getBand(score) {
        if (score >= 850)
            return enums_1.ScoreBand.ELITE_TRUST;
        if (score >= 700)
            return enums_1.ScoreBand.VERY_GOOD_TRUST;
        if (score >= 580)
            return enums_1.ScoreBand.GOOD_TRUST;
        if (score >= 450)
            return enums_1.ScoreBand.MEDIUM_TRUST;
        return enums_1.ScoreBand.HIGH_RISK;
    }
    inferSeverity(eventCode) {
        if (eventCode.includes('FRAUD') || eventCode.includes('CONTRACT_BREACH')) {
            return enums_1.ScoreSeverity.SEVERE;
        }
        if (eventCode.includes('LATE') || eventCode.includes('FAIL')) {
            return enums_1.ScoreSeverity.ELEVATED;
        }
        return enums_1.ScoreSeverity.STANDARD;
    }
    async checkAndUpdateCeiling(studentId, tenantId) {
        const [activeFraud] = await this.dataSource.query(`SELECT id FROM score_events
       WHERE student_id = $1 AND tenant_id = $2 AND is_active = true
         AND (event_code LIKE 'FRAUD%' OR event_code = 'CONTRACT_BREACH_SEVERE')
       LIMIT 1`, [studentId, tenantId]);
        if (!activeFraud) {
            await this.dataSource.query(`UPDATE forsa_scores SET ceiling_active = false WHERE student_id = $1`, [studentId]);
        }
    }
};
exports.ScoreService = ScoreService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_3AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ScoreService.prototype, "scheduledReconciliation", null);
exports.ScoreService = ScoreService = ScoreService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        policy_service_1.PolicyService])
], ScoreService);
//# sourceMappingURL=score.service.js.map