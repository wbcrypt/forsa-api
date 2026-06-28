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
var PolicyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let PolicyService = PolicyService_1 = class PolicyService {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(PolicyService_1.name);
        this.cache = new Map();
        this.CACHE_TTL_MS = 5 * 60 * 1000;
    }
    async resolve(policyKey, context) {
        const asOfDate = context.asOfDate || new Date();
        const cacheKey = this.buildCacheKey(policyKey, context);
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > new Date()) {
            return { policyKey, value: cached.value, policyVersionId: cached.versionId };
        }
        const versions = await this.dataSource.query(`SELECT pv.id, pv.scope_type, pv.scope_id, pv.value, pv.priority, pv.effective_date,
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
         pv.effective_date DESC`, [
            policyKey,
            context.tenantId,
            asOfDate.toISOString(),
            context.countryCode || null,
            context.universityId || null,
            context.partnerId || null,
            context.studentId || null,
            context.programId || null,
        ]);
        if (!versions.length)
            return null;
        await this.detectAndRecordConflicts(versions, context.tenantId);
        const winner = versions[0];
        const result = {
            policyKey,
            value: winner.value,
            policyVersionId: winner.id,
            effectiveDate: winner.effective_date,
            scopeType: winner.scope_type,
            scopeId: winner.scope_id,
            priority: winner.priority,
        };
        this.cache.set(cacheKey, {
            value: result.value,
            versionId: result.policyVersionId,
            expiresAt: new Date(Date.now() + this.CACHE_TTL_MS),
        });
        return result;
    }
    async resolveMany(policyKeys, context) {
        const results = new Map();
        await Promise.all(policyKeys.map(async (key) => {
            const result = await this.resolve(key, context);
            if (result)
                results.set(key, result);
        }));
        return results;
    }
    async getNumber(policyKey, context) {
        const policy = await this.resolve(policyKey, context);
        if (!policy)
            return null;
        const val = policy.value;
        return typeof val === 'number' ? val : parseFloat(val);
    }
    async getBoolean(policyKey, context) {
        const policy = await this.resolve(policyKey, context);
        if (!policy)
            return null;
        return Boolean(policy.value);
    }
    async getObject(policyKey, context) {
        const policy = await this.resolve(policyKey, context);
        if (!policy)
            return null;
        return policy.value;
    }
    async createVersion(params) {
        const [definition] = await this.dataSource.query(`SELECT id FROM policy_definitions WHERE policy_key = $1 AND tenant_id = $2`, [params.policyKey, params.tenantId]);
        if (!definition) {
            throw new common_1.NotFoundException(`Policy definition not found: ${params.policyKey}`);
        }
        const [versionCount] = await this.dataSource.query(`SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM policy_versions
       WHERE policy_definition_id = $1
         AND scope_type = $2
         AND (scope_id = $3 OR (scope_id IS NULL AND $3 IS NULL))`, [definition.id, params.scopeType, params.scopeId || null]);
        const version = versionCount.next_version;
        const [newVersion] = await this.dataSource.query(`INSERT INTO policy_versions
        (tenant_id, policy_definition_id, version, scope_type, scope_id, value,
         priority, effective_date, expiration_date, status, change_reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11)
       RETURNING id`, [
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
        ]);
        this.invalidateCacheForKey(params.policyKey);
        return newVersion.id;
    }
    async approveVersion(versionId, tenantId, approvedBy) {
        const [version] = await this.dataSource.query(`SELECT pv.id, pv.policy_definition_id, pv.scope_type, pv.scope_id, pd.policy_key
       FROM policy_versions pv
       JOIN policy_definitions pd ON pd.id = pv.policy_definition_id
       WHERE pv.id = $1 AND pv.tenant_id = $2 AND pv.status = 'draft'`, [versionId, tenantId]);
        if (!version)
            throw new common_1.NotFoundException('Policy version not found or not in draft status');
        await this.dataSource.query(`UPDATE policy_versions
       SET status = 'superseded'
       WHERE policy_definition_id = $1
         AND scope_type = $2
         AND (scope_id = $3 OR (scope_id IS NULL AND $3 IS NULL))
         AND status = 'active'
         AND id != $4`, [version.policy_definition_id, version.scope_type, version.scope_id, versionId]);
        await this.dataSource.query(`UPDATE policy_versions
       SET status = 'active', approved_by = $2, approved_at = NOW()
       WHERE id = $1`, [versionId, approvedBy]);
        this.invalidateCacheForKey(version.policy_key);
    }
    async getVersionHistory(policyKey, tenantId) {
        return this.dataSource.query(`SELECT pv.id, pv.version, pv.scope_type, pv.scope_id, pv.value,
              pv.priority, pv.status, pv.effective_date, pv.expiration_date,
              pv.change_reason, pv.created_at, pv.approved_at,
              u_created.full_name AS created_by_name,
              u_approved.full_name AS approved_by_name
       FROM policy_versions pv
       JOIN policy_definitions pd ON pd.id = pv.policy_definition_id
       LEFT JOIN users u_created ON u_created.id = pv.created_by
       LEFT JOIN users u_approved ON u_approved.id = pv.approved_by
       WHERE pd.policy_key = $1 AND pd.tenant_id = $2
       ORDER BY pv.version DESC, pv.created_at DESC`, [policyKey, tenantId]);
    }
    async listDefinitions(tenantId) {
        return this.dataSource.query(`SELECT pd.id, pd.policy_key, pd.display_name, pd.description,
              pd.module, pd.scope_type, pd.value_type, pd.is_system,
              COUNT(pv.id) FILTER (WHERE pv.status = 'active') AS active_versions,
              MAX(pv.effective_date) FILTER (WHERE pv.status = 'active') AS last_updated
       FROM policy_definitions pd
       LEFT JOIN policy_versions pv ON pv.policy_definition_id = pd.id
       WHERE pd.tenant_id = $1
       GROUP BY pd.id
       ORDER BY pd.module, pd.policy_key`, [tenantId]);
    }
    buildCacheKey(policyKey, context) {
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
    invalidateCacheForKey(policyKey) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(policyKey + ':')) {
                this.cache.delete(key);
            }
        }
    }
    async detectAndRecordConflicts(versions, tenantId) {
        if (versions.length <= 1)
            return;
        const scopeGroups = new Map();
        for (const v of versions) {
            const key = `${v.scope_type}:${v.scope_id}`;
            if (!scopeGroups.has(key))
                scopeGroups.set(key, []);
            scopeGroups.get(key).push(v);
        }
        for (const [scope, group] of scopeGroups) {
            if (group.length > 1) {
                await this.dataSource.query(`INSERT INTO policy_conflicts
            (tenant_id, policy_version_a_id, policy_version_b_id, conflict_type, detected_at)
           VALUES ($1, $2, $3, 'overlapping_scope', NOW())
           ON CONFLICT DO NOTHING`, [tenantId, group[0].id, group[1].id]).catch(() => { });
            }
        }
    }
};
exports.PolicyService = PolicyService;
exports.PolicyService = PolicyService = PolicyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], PolicyService);
//# sourceMappingURL=policy.service.js.map