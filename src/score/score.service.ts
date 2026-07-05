import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PolicyService } from '../policy/policy.service';
import { ScoreDimension, ScoreBand, ScoreSeverity, SourceTrustLevel } from '../common/enums';

const SCORE_MIN = 300;
const SCORE_MAX = 1000;
const SCORE_DEFAULT_FIRST_TIME = 500;

@Injectable()
export class ScoreService {
  private readonly logger = new Logger(ScoreService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policyService: PolicyService,
  ) {}

  // ================================================================
  // Record a score event (immutable append-only)
  // ================================================================
  async recordEvent(params: {
    tenantId: string;
    studentId: string;
    dimension: ScoreDimension;
    eventCode: string;
    points: number;
    sourceType: SourceTrustLevel;
    sourceId: string;
    description: string;
    referenceId?: string;
    referenceType?: string;
    // K-13 warm-up finding — recorded_by is a nullable UUID column with no
    // "system actor" row to reference; passing the literal string 'system'
    // here throws "invalid input syntax for type uuid" at the DB. Automated/
    // system-triggered events (cron jobs, gateway webhooks) must pass null,
    // not a placeholder string — reserve a real string only for genuine
    // human actor UUIDs.
    recordedBy: string | null;
    policyVersionId?: string;
    severity?: ScoreSeverity;
  }): Promise<{ eventId: string; newBalance: number; newBand: ScoreBand }> {
    // Get policy for this event type (points and weights are from policy, not hardcoded)
    const pointPolicy = await this.policyService.resolve(
      `score.event.${params.eventCode}.points`,
      { tenantId: params.tenantId, studentId: params.studentId },
    );

    // If policy defines points, override the provided value
    const pointValue = pointPolicy
      ? (pointPolicy.value as number)
      : params.points;

    const policyVersionId = pointPolicy?.policyVersionId || params.policyVersionId;

    // Get current running balance for this dimension
    const [currentBalance] = await this.dataSource.query<any[]>(
      `SELECT running_balance FROM score_running_balances
       WHERE student_id = $1 AND dimension = $2`,
      [params.studentId, params.dimension],
    );

    const previousBalance = currentBalance?.running_balance || SCORE_DEFAULT_FIRST_TIME;
    const newBalance = Math.max(SCORE_MIN, Math.min(SCORE_MAX, previousBalance + pointValue));

    // Determine severity
    const severity = params.severity || this.inferSeverity(params.eventCode);

    // Insert immutable event record
    const [event] = await this.dataSource.query<any[]>(
      `INSERT INTO score_events
        (tenant_id, student_id, dimension, event_code, points, previous_balance, new_balance,
         source_type, source_id, severity, description, reference_id, reference_type,
         policy_version_id, recorded_by, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true)
       RETURNING id`,
      [
        params.tenantId, params.studentId, params.dimension, params.eventCode,
        pointValue, previousBalance, newBalance,
        params.sourceType, params.sourceId, severity,
        params.description, params.referenceId || null, params.referenceType || null,
        policyVersionId || null, params.recordedBy,
      ],
    );

    // Update running balance
    await this.dataSource.query(
      `INSERT INTO score_running_balances (student_id, dimension, running_balance, last_event_id, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (student_id, dimension) DO UPDATE
       SET running_balance = $3, last_event_id = $4, updated_at = NOW()`,
      [params.studentId, params.dimension, newBalance, event.id],
    );

    // Recompute aggregate score
    const { aggregateScore, band } = await this.recomputeAggregate(params.studentId, params.tenantId);

    return { eventId: event.id, newBalance: aggregateScore, newBand: band };
  }

  // ================================================================
  // Get or initialize student score
  // ================================================================
  async getScore(studentId: string, tenantId: string) {
    const [score] = await this.dataSource.query<any[]>(
      `SELECT fs.*, json_object_agg(srb.dimension, srb.running_balance) AS dimension_balances
       FROM forsa_scores fs
       LEFT JOIN score_running_balances srb ON srb.student_id = fs.student_id
       WHERE fs.student_id = $1
       GROUP BY fs.id`,
      [studentId],
    );

    if (!score) {
      // First-time student: initialize with policy-defined starting score
      const startingScorePolicy = await this.policyService.resolve(
        'score.starting.first_time',
        { tenantId },
      );
      const startingScore = (startingScorePolicy?.value as number) || SCORE_DEFAULT_FIRST_TIME;

      const [newScore] = await this.dataSource.query<any[]>(
        `INSERT INTO forsa_scores
          (student_id, aggregate_score, score_band, score_version, ceiling_active)
         VALUES ($1,$2,$3,'v1',false)
         RETURNING *`,
        [studentId, startingScore, this.getBand(startingScore)],
      );

      // Initialize all dimension balances
      for (const dimension of Object.values(ScoreDimension)) {
        await this.dataSource.query(
          `INSERT INTO score_running_balances (student_id, dimension, running_balance)
           VALUES ($1,$2,$3)
           ON CONFLICT DO NOTHING`,
          [studentId, dimension, startingScore],
        );
      }

      return newScore;
    }

    return score;
  }

  // ================================================================
  // Create corrective event (for appeals / supersession)
  // One-to-one: each corrective event supersedes exactly one original event
  // ================================================================
  async createCorrectiveEvent(params: {
    tenantId: string;
    studentId: string;
    originalEventId: string;
    dimension: ScoreDimension;
    reason: string;
    compensatingPoints: number;
    approvedBy: string;
    policyVersionId?: string;
  }): Promise<string> {
    // Verify original event exists and is active
    const [original] = await this.dataSource.query<any[]>(
      `SELECT * FROM score_events WHERE id = $1 AND student_id = $2 AND is_active = true`,
      [params.originalEventId, params.studentId],
    );

    if (!original) throw new NotFoundException('Original score event not found or already superseded');

    // Check no existing corrective event for this original
    const [existing] = await this.dataSource.query<any[]>(
      `SELECT id FROM corrective_score_events WHERE original_event_id = $1`,
      [params.originalEventId],
    );
    if (existing) throw new BadRequestException('This event already has a corrective event');

    // Mark original as superseded
    await this.dataSource.query(
      `UPDATE score_events SET is_active = false WHERE id = $1`,
      [params.originalEventId],
    );

    // Create corrective event
    const [corrective] = await this.dataSource.query<any[]>(
      `INSERT INTO corrective_score_events
        (tenant_id, student_id, original_event_id, dimension, compensating_points,
         reason, approved_by, policy_version_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        params.tenantId, params.studentId, params.originalEventId, params.dimension,
        params.compensatingPoints, params.reason, params.approvedBy,
        params.policyVersionId || null,
      ],
    );

    // Apply the corrective points
    await this.recordEvent({
      tenantId: params.tenantId,
      studentId: params.studentId,
      dimension: params.dimension,
      eventCode: 'CORRECTIVE_ADJUSTMENT',
      points: params.compensatingPoints,
      sourceType: SourceTrustLevel.STAFF_VERIFIED,
      sourceId: params.approvedBy,
      description: `Corrective event: ${params.reason}`,
      referenceId: params.originalEventId,
      referenceType: 'score_event',
      recordedBy: params.approvedBy,
    });

    // Check if ceiling can be lifted
    await this.checkAndUpdateCeiling(params.studentId, params.tenantId);

    return corrective.id;
  }

  // ================================================================
  // Mandatory reconciliation (scheduled + on-demand)
  // Discrepancies trigger Data Integrity Events — no auto-correction
  // ================================================================
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledReconciliation(): Promise<void> {
    this.logger.log('Starting scheduled score reconciliation');
    const students = await this.dataSource.query<any[]>(
      `SELECT DISTINCT student_id FROM score_events WHERE created_at > NOW() - INTERVAL '25 hours'`,
    );

    for (const row of students) {
      try {
        await this.reconcileStudentScore(row.student_id, 'SCHEDULED');
      } catch (err) {
        this.logger.error(`Reconciliation failed for student ${row.student_id}`, err);
      }
    }
  }

  async reconcileStudentScore(studentId: string, triggeredBy: string): Promise<void> {
    // Compute expected aggregate from active events (apply decay at compute time)
    const dimensionBalances = await this.computeDimensionBalancesFromEvents(studentId);

    // Get stored balances
    const storedBalances = await this.dataSource.query<any[]>(
      `SELECT dimension, running_balance FROM score_running_balances WHERE student_id = $1`,
      [studentId],
    );

    const storedMap = Object.fromEntries(storedBalances.map(r => [r.dimension, parseFloat(r.running_balance)]));

    let hasDiscrepancy = false;
    const discrepancies: any[] = [];

    for (const [dimension, computedBalance] of Object.entries(dimensionBalances)) {
      const stored = storedMap[dimension] || SCORE_DEFAULT_FIRST_TIME;
      const diff = Math.abs((computedBalance as number) - stored);

      if (diff > 1) { // Allow 1 point rounding tolerance
        hasDiscrepancy = true;
        discrepancies.push({ dimension, stored, computed: computedBalance, diff });
      }
    }

    if (hasDiscrepancy) {
      // Record Data Integrity Event — do NOT auto-correct
      await this.dataSource.query(
        `INSERT INTO data_integrity_events
          (entity_type, entity_id, description, details, severity, status)
         VALUES ('score','$1','Score reconciliation discrepancy detected',$2,'medium','open')`,
        [studentId, JSON.stringify({ discrepancies, triggeredBy, reconciledAt: new Date() })],
      );

      this.logger.warn(`Score discrepancy detected for student ${studentId}`, { discrepancies });
    }
  }

  // ================================================================
  // Score event history
  // ================================================================
  async getScoreHistory(studentId: string, tenantId: string) {
    return this.dataSource.query(
      `SELECT se.*, cse.reason AS corrective_reason, cse.compensating_points
       FROM score_events se
       LEFT JOIN corrective_score_events cse ON cse.original_event_id = se.id
       WHERE se.student_id = $1 AND se.tenant_id = $2
       ORDER BY se.created_at DESC`,
      [studentId, tenantId],
    );
  }

  // ================================================================
  // Private helpers
  // ================================================================

  private async recomputeAggregate(
    studentId: string,
    tenantId: string,
  ): Promise<{ aggregateScore: number; band: ScoreBand }> {
    // Get dimension weights from policy
    const weightPolicy = await this.policyService.resolve(
      'score.dimension.weights', { tenantId },
    );

    const weights = (weightPolicy?.value as Record<string, number>) || {
      [ScoreDimension.PAYMENT_RELIABILITY]: 0.40,
      [ScoreDimension.DOCUMENTATION_RELIABILITY]: 0.20,
      [ScoreDimension.COMMUNICATION_RELIABILITY]: 0.15,
      [ScoreDimension.ACADEMIC_CONTINUITY]: 0.15,
      [ScoreDimension.GUARANTOR_RELIABILITY]: 0.10,
    };

    // Apply decay and get current effective balances
    const effectiveBalances = await this.computeDimensionBalancesFromEvents(studentId);

    // Check for ceiling-triggering events (e.g., fraud blocks Elite Trust)
    const [ceilingEvent] = await this.dataSource.query<any[]>(
      `SELECT event_code FROM score_events
       WHERE student_id = $1 AND is_active = true
         AND event_code LIKE 'FRAUD%' OR event_code = 'CONTRACT_BREACH_SEVERE'
       LIMIT 1`,
      [studentId],
    );

    let aggregateScore = 0;
    for (const [dimension, balance] of Object.entries(effectiveBalances)) {
      const weight = weights[dimension] || 0;
      aggregateScore += (balance as number) * weight;
    }

    aggregateScore = Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(aggregateScore)));

    // Apply ceiling if fraud flag active
    if (ceilingEvent) {
      const ceilingPolicy = await this.policyService.resolve(
        `score.ceiling.${ceilingEvent.event_code}`, { tenantId },
      );
      const ceiling = (ceilingPolicy?.value as number) || 600;
      aggregateScore = Math.min(aggregateScore, ceiling);
    }

    const band = this.getBand(aggregateScore);

    // Update forsa_scores record
    await this.dataSource.query(
      `INSERT INTO forsa_scores (student_id, aggregate_score, score_band, ceiling_active)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (student_id) DO UPDATE
       SET aggregate_score = $2, score_band = $3, ceiling_active = $4, computed_at = NOW()`,
      [studentId, aggregateScore, band, !!ceilingEvent],
    );

    return { aggregateScore, band };
  }

  private async computeDimensionBalancesFromEvents(
    studentId: string,
  ): Promise<Record<string, number>> {
    const balances: Record<string, number> = {};

    for (const dimension of Object.values(ScoreDimension)) {
      const events = await this.dataSource.query<any[]>(
        `SELECT points, created_at, severity FROM score_events
         WHERE student_id = $1 AND dimension = $2 AND is_active = true
         ORDER BY created_at ASC`,
        [studentId, dimension],
      );

      let balance = SCORE_DEFAULT_FIRST_TIME;
      const now = new Date();

      for (const event of events) {
        let points = parseFloat(event.points);

        // Apply category decay at compute time (events remain immutable)
        const ageMonths = (now.getTime() - new Date(event.created_at).getTime()) / (30 * 24 * 3600 * 1000);

        if (points > 0) {
          // Positive events: decay over time
          const decayRate = 0.02; // 2% per month (from policy in production)
          points = points * Math.exp(-decayRate * ageMonths);
        } else {
          // Negative events: severity floor determines minimum impact
          const severityFloor = event.severity === ScoreSeverity.SEVERE ? 0.7
            : event.severity === ScoreSeverity.ELEVATED ? 0.5 : 0.1;
          // Impact decays but never below severity floor proportion
          const decayedImpact = points * (1 - Math.min(0.9, 0.02 * ageMonths));
          points = Math.min(points * severityFloor, decayedImpact); // more negative = more impact
        }

        balance = Math.max(SCORE_MIN, Math.min(SCORE_MAX, balance + points));
      }

      balances[dimension] = Math.round(balance);
    }

    return balances;
  }

  private getBand(score: number): ScoreBand {
    if (score >= 850) return ScoreBand.ELITE_TRUST;
    if (score >= 700) return ScoreBand.VERY_GOOD_TRUST;
    if (score >= 580) return ScoreBand.GOOD_TRUST;
    if (score >= 450) return ScoreBand.MEDIUM_TRUST;
    return ScoreBand.HIGH_RISK;
  }

  private inferSeverity(eventCode: string): ScoreSeverity {
    if (eventCode.includes('FRAUD') || eventCode.includes('CONTRACT_BREACH')) {
      return ScoreSeverity.SEVERE;
    }
    if (eventCode.includes('LATE') || eventCode.includes('FAIL')) {
      return ScoreSeverity.ELEVATED;
    }
    return ScoreSeverity.STANDARD;
  }

  private async checkAndUpdateCeiling(studentId: string, tenantId: string): Promise<void> {
    // After corrective event, check if ceiling-triggering events are still active
    const [activeFraud] = await this.dataSource.query<any[]>(
      `SELECT id FROM score_events
       WHERE student_id = $1 AND is_active = true
         AND (event_code LIKE 'FRAUD%' OR event_code = 'CONTRACT_BREACH_SEVERE')
       LIMIT 1`,
      [studentId],
    );

    if (!activeFraud) {
      // Ceiling can be lifted
      await this.dataSource.query(
        `UPDATE forsa_scores SET ceiling_active = false WHERE student_id = $1`,
        [studentId],
      );
    }
  }
}
