import { PolicyService } from './policy.service';
import { PolicyScopeType } from '../common/enums';
declare class CreatePolicyVersionDto {
    policyKey: string;
    scopeType: PolicyScopeType;
    scopeId?: string;
    value: unknown;
    effectiveDate: string;
    expirationDate?: string;
    priority?: number;
    changeReason: string;
}
export declare class PolicyController {
    private readonly policyService;
    constructor(policyService: PolicyService);
    listDefinitions(tenantId: string): Promise<any>;
    getHistory(key: string, tenantId: string): Promise<any>;
    resolve(key: string, tenantId: string, universityId?: string, studentId?: string, partnerId?: string): Promise<import("./policy.service").ResolvedPolicy>;
    createVersion(dto: CreatePolicyVersionDto, tenantId: string, userId: string): Promise<string>;
    approveVersion(id: string, tenantId: string, userId: string): Promise<void>;
}
export {};
