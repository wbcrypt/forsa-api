import { ScoreService } from './score.service';
import { ScoreDimension, SourceTrustLevel, ScoreSeverity } from '../common/enums';
export declare class ScoreController {
    private readonly service;
    constructor(service: ScoreService);
    getScore(id: string, t: string): Promise<any>;
    getHistory(id: string, t: string): Promise<any>;
    recordEvent(studentId: string, body: {
        dimension: ScoreDimension;
        eventCode: string;
        points: number;
        sourceType: SourceTrustLevel;
        sourceId: string;
        description: string;
        referenceId?: string;
        referenceType?: string;
        severity?: ScoreSeverity;
    }, t: string, u: string): Promise<{
        eventId: string;
        newBalance: number;
        newBand: import("../common/enums").ScoreBand;
    }>;
    createCorrectiveEvent(studentId: string, body: {
        originalEventId: string;
        dimension: ScoreDimension;
        reason: string;
        compensatingPoints: number;
    }, t: string, u: string): Promise<string>;
    reconcile(studentId: string, u: string): Promise<void>;
}
