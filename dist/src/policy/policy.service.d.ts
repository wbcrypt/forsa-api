import { DataSource } from 'typeorm';
import { PolicyScopeType } from '../common/enums';
export interface PolicyValue {
    [key: string]: unknown;
}
export interface ResolvedPolicy {
    policyKey: string;
    value: unknown;
    policyVersionId: string;
    effectiveDate: string;
    scopeType: string;
    scopeId: string | null;
    priority: number;
}
export interface PolicyResolutionContext {
    tenantId: string;
    studentId?: string;
    universityId?: string;
    partnerId?: string;
    programId?: string;
    countryCode?: string;
    asOfDate?: Date;
}
export declare class PolicyService {
    private readonly dataSource;
    private readonly logger;
    private cache;
    private readonly CACHE_TTL_MS;
    constructor(dataSource: DataSource);
    resolve(policyKey: string, context: PolicyResolutionContext): Promise<ResolvedPolicy | null>;
    resolveMany(policyKeys: string[], context: PolicyResolutionContext): Promise<Map<string, ResolvedPolicy>>;
    getNumber(policyKey: string, context: PolicyResolutionContext): Promise<number | null>;
    getBoolean(policyKey: string, context: PolicyResolutionContext): Promise<boolean | null>;
    getObject<T = Record<string, unknown>>(policyKey: string, context: PolicyResolutionContext): Promise<T | null>;
    createVersion(params: {
        tenantId: string;
        policyKey: string;
        scopeType: PolicyScopeType;
        scopeId?: string;
        value: unknown;
        effectiveDate: Date;
        expirationDate?: Date;
        priority?: number;
        changeReason: string;
        createdBy: string;
    }): Promise<string>;
    approveVersion(versionId: string, tenantId: string, approvedBy: string): Promise<void>;
    getVersionHistory(policyKey: string, tenantId: string): Promise<any>;
    listDefinitions(tenantId: string): Promise<any>;
    private buildCacheKey;
    private invalidateCacheForKey;
    private detectAndRecordConflicts;
}
