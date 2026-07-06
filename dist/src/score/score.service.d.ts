import { DataSource } from 'typeorm';
import { PolicyService } from '../policy/policy.service';
import { ScoreDimension, ScoreBand, ScoreSeverity, SourceTrustLevel } from '../common/enums';
export declare class ScoreService {
    private readonly dataSource;
    private readonly policyService;
    private readonly logger;
    constructor(dataSource: DataSource, policyService: PolicyService);
    recordEvent(params: {
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
        recordedBy: string | null;
        policyVersionId?: string;
        severity?: ScoreSeverity;
    }): Promise<{
        eventId: string;
        newBalance: number;
        newBand: ScoreBand;
    }>;
    getScoreForMyUniversityStudent(userId: string, tenantId: string, studentId: string): Promise<any>;
    getScore(studentId: string, tenantId: string): Promise<any>;
    createCorrectiveEvent(params: {
        tenantId: string;
        studentId: string;
        originalEventId: string;
        dimension: ScoreDimension;
        reason: string;
        compensatingPoints: number;
        approvedBy: string;
        policyVersionId?: string;
    }): Promise<string>;
    scheduledReconciliation(): Promise<void>;
    reconcileStudentScore(studentId: string, triggeredBy: string): Promise<void>;
    getScoreHistory(studentId: string, tenantId: string): Promise<any>;
    private recomputeAggregate;
    private computeDimensionBalancesFromEvents;
    private getBand;
    private inferSeverity;
    private checkAndUpdateCeiling;
}
