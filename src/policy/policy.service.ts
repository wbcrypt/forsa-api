import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PolicyScopeType, PolicyStatus } from '../common/enums';

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

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  // In-memory cache for hot policy reads (cleared on policy change)
  private cache = new Map<string, { value: unknown; versionId: string; expiresAt: Date }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Resolve the effective value of a policy key for a given context.
   * Applies precedence: Student → University → Country → Global
   * Records any conflicts detected.
   */
  async resolve(
    policyKey: string,
    context: PolicyResolutionContext,
  ): Promise<ResolvedPolicy | null> {
    const asOfDate = context.asOfDate || new Date();
    const cacheKey = this.buildCacheKey(policyKey, context);

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return { policyKey, value: cached.value, policyVersionId: cached.versionId } as any;
    }

    // Get all applicable policy versions in precedence order
    const versions = await this.dataSource.query<any[]>(
      `SELECT pv.id, pv.scope_type, pv.scope_id, pv.value, pv.priority, pv.effective_date,
              pd.policy_key
       FROM policy_versions pv
       JOIN policy_definitions pd ON pd.id = pv.policy_definition_id
       WHERE pd.policy_key = $1
         AND pd.tenant_id = $2
         AND pv.status = 'active'
         AND pv.effective_date <= $3
         AND (pv.expiration_date IS NULL OR pv.expiration_date > $3)
         AND (
           (pv.scope_type = 'global') OR
           (pv.scope_type = 'country' AND pv.scope_id::text = $4) OR
           (pv.scope_type = 'university' AND pv.scope_id = $5) OR
           (pv.scope_type = 'partner' AND pv.scope_id = $6) OR
           (pv.scope_type = 'student' AND pv.scope_id = $7) OR
           (pv.scope_type = 'program' AND pv.scope_id = $8)
         )
       ORDER BY
         CASE pv.scope_type
           WHEN 'student' THEN 1
           WHEN 'university' THEN 2
           WHEN 'program' THEN 3
           WHEN 'partner' THEN 4
           WHEN 'country' THEN 5
           WHEN 'global' THEN 6
         END ASC,
         pv.priority DESC,
         pv.effective_date DESC`,
      [
        policyKey,
        context.tenantId,
        asOfDate.toISOString(),
        context.countryCode || null,
        context.universityId || null,
        context.partnerId || null,
        context.studentId || null,
        context.programId || null,
      ],
    );

    if (!versions.length) return null;

    // Detect conflicts (same scope level, different values)
    await this.detectAndRecordConflicts(versions, context.tenantId);

    // Return highest-precedence version
    const winner = versions[0];

    const result: ResolvedPolicy = {
      policyKey,
      value: winner.value,
      policyVersionId: winner.id,
      effectiveDate: winner.effective_date,
      scopeType: winner.scope_type,
      scopeId: winner.scope_id,
      priority: winner.priority,
    };

    // Cache the result
    this.cache.set(cacheKey, {
      value: result.value,
      versionId: result.policyVersionId,
      expiresAt: new Date(Date.now() + this.CACHE_TTL_MS),
    });

    return result;
  }

  /**
   * Resolve multiple policies at once (batched for performance)
   */
  async resolveMany(
    policyKeys: string[],
    context: PolicyResolutionContext,
  ): Promise<Map<string, ResolvedPolicy>> {
    const results = new Map<string, ResolvedPolicy>();
    await Promise.all(
      policyKeys.map(async key => {
        const result = await this.resolve(key, context);
        if (result) results.set(key, result);
      }),
    );
    return results;
  }

  /**
   * Get the numeric value of a policy (with type safety)
   */
  async getNumber(policyKey: string, context: PolicyResolutionContext): Promise<number | null> {
    const policy = await this.resolve(policyKey, context);
    if (!policy) return null;
    const val = policy.value as any;
    return typeof val === 'number' ? val : parseFloat(val);
  }

  /**
   * Get a boolean policy value
   */
  async getBoolean(policyKey: string, context: PolicyResolutionContext): Promise<boolean | null> {
    const policy = await this.resolve(policyKey, context);
    if (!policy) return null;
    return Boolean(policy.value);
  }

  /**
   * Get a JSON/object policy value
   */
  async getObject<T = Record<string, unknown>>(
    policyKey: string,
    context: PolicyResolutionContext,
  ): Promise<T | null> {
    const policy = await this.resolve(policyKey, context);
    if (!policy) return null;
    return policy.value as T;
  }

  /**
   * Create a new policy version
   */
  async createVersion(params: {
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
  }): Promise<string> {
    // Get policy definition
    const [definition] = await this.dataSource.query<any[]>(
      `SELECT id FROM policy_definitions WHERE policy_key = $1 AND tenant_id = $2`,
      [params.policyKey, params.tenantId],
    );

    if (!definition) {
      throw new NotFoundException(`Policy definition not found: ${params.policyKey}`);
    }

    // Get next version number
    const [versionCount] = await this.dataSource.query<any[]>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM policy_versions
       WHERE policy_definition_id = $1
         AND scope_type = $2
         AND (scope_id = $3 OR (scope_id IS NULL AND $3 IS NULL))`,
      [definition.id, params.scopeType, params.scopeId || null],
    );

    const version = versionCount.next_version;

    const [newVersion] = await this.dataSource.query<any[]>(
      `INSERT INTO policy_versions
        (tenant_id, policy_definition_id, version, scope_type, scope_id, value,
         priority, effective_date, expiration_date, status, change_reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11)
       RETURNING id`,
      [
        params.tenantId,
        definition.id,
        version,
        params.scopeType,
        params.scopeId || null,
        JSON.stringify(params.value),
        params.priority || 0,
        params.effectiveDate.toISOString().split('T')[0],
        params.expirationDate?.toISOString().split('T')[0] || null,
        params.changeReason,
        params.createdBy,
      ],
    );

    // Invalidate cache for this policy
    this.invalidateCacheForKey(params.policyKey);

    return newVersion.id;
  }

  /**
   * Approve and activate a policy version
   */
  async approveVersion(
    versionId: string,
    tenantId: string,
    approvedBy: string,
  ): Promise<void> {
    const [version] = await this.dataSource.query<any[]>(
      `SELECT pv.id, pv.policy_definition_id, pv.scope_type, pv.scope_id, pd.policy_key
       FROM policy_versions pv
       JOIN policy_definitions pd ON pd.id = pv.policy_definition_id
       WHERE pv.id = $1 AND pv.tenant_id = $2 AND pv.status = 'draft'`,
      [versionId, tenantId],
    );

    if (!version) throw new NotFoundException('Policy version not found or not in draft status');

    // Supersede previous active versions with same scope
    await this.dataSource.query(
      `UPDATE policy_versions
       SET status = 'superseded'
       WHERE policy_definition_id = $1
         AND scope_type = $2
         AND (scope_id = $3 OR (scope_id IS NULL AND $3 IS NULL))
         AND status = 'active'
         AND id != $4`,
      [version.policy_definition_id, version.scope_type, version.scope_id, versionId],
    );

    await this.dataSource.query(
      `UPDATE policy_versions
       SET status = 'active', approved_by = $2, approved_at = NOW()
       WHERE id = $1`,
      [versionId, approvedBy],
    );

    this.invalidateCacheForKey(version.policy_key);
  }

  /**
   * Get policy version history (never deleted)
   */
  async getVersionHistory(policyKey: string, tenantId: string) {
    return this.dataSource.query(
      `SELECT pv.id, pv.version, pv.scope_type, pv.scope_id, pv.value,
              pv.priority, pv.status, pv.effective_date, pv.expiration_date,
              pv.change_reason, pv.created_at, pv.approved_at,
              u_created.full_name AS created_by_name,
              u_approved.full_name AS approved_by_name
       FROM policy_versions pv
       JOIN policy_definitions pd ON pd.id = pv.policy_definition_id
       LEFT JOIN users u_created ON u_created.id = pv.created_by
       LEFT JOIN users u_approved ON u_approved.id = pv.approved_by
       WHERE pd.policy_key = $1 AND pd.tenant_id = $2
       ORDER BY pv.version DESC, pv.created_at DESC`,
      [policyKey, tenantId],
    );
  }

  /**
   * List all policy definitions for a tenant
   */
  async listDefinitions(tenantId: string) {
    return this.dataSource.query(
      `SELECT pd.id, pd.policy_key, pd.display_name, pd.description,
              pd.module, pd.scope_type, pd.value_type, pd.is_system,
              COUNT(pv.id) FILTER (WHERE pv.status = 'active') AS active_versions,
              MAX(pv.effective_date) FILTER (WHERE pv.status = 'active') AS last_updated
       FROM policy_definitions pd
       LEFT JOIN policy_versions pv ON pv.policy_definition_id = pd.id
       WHERE pd.tenant_id = $1
       GROUP BY pd.id
       ORDER BY pd.module, pd.policy_key`,
      [tenantId],
    );
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private buildCacheKey(policyKey: string, context: PolicyResolutionContext): string {
    return [
      policyKey,
      context.tenantId,
      context.studentId || '',
      context.universityId || '',
      context.partnerId || '',
      context.programId || '',
      context.countryCode || '',
    ].join(':');
  }

  private invalidateCacheForKey(policyKey: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(policyKey + ':')) {
        this.cache.delete(key);
      }
    }
  }

  private async detectAndRecordConflicts(versions: any[], tenantId: string): Promise<void> {
    if (versions.length <= 1) return;

    // Check if any same-scope versions have different values
    const scopeGroups = new Map<string, any[]>();
    for (const v of versions) {
      const key = `${v.scope_type}:${v.scope_id}`;
      if (!scopeGroups.has(key)) scopeGroups.set(key, []);
      scopeGroups.get(key)!.push(v);
    }

    for (const [scope, group] of scopeGroups) {
      if (group.length > 1) {
        // Multiple active versions for same scope — conflict
        await this.dataSource.query(
          `INSERT INTO policy_conflicts
            (tenant_id, policy_version_a_id, policy_version_b_id, conflict_type, detected_at)
           VALUES ($1, $2, $3, 'overlapping_scope', NOW())
           ON CONFLICT DO NOTHING`,
          [tenantId, group[0].id, group[1].id],
        ).catch(() => {}); // Don't break resolution on conflict logging failure
      }
    }
  }
}
