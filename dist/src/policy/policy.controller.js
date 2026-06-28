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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_2 = require("@nestjs/swagger");
const policy_service_1 = require("./policy.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
const enums_1 = require("../common/enums");
class CreatePolicyVersionDto {
}
__decorate([
    (0, swagger_2.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePolicyVersionDto.prototype, "policyKey", void 0);
__decorate([
    (0, swagger_2.ApiProperty)({ enum: enums_1.PolicyScopeType }),
    (0, class_validator_1.IsEnum)(enums_1.PolicyScopeType),
    __metadata("design:type", String)
], CreatePolicyVersionDto.prototype, "scopeType", void 0);
__decorate([
    (0, swagger_2.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreatePolicyVersionDto.prototype, "scopeId", void 0);
__decorate([
    (0, swagger_2.ApiProperty)(),
    __metadata("design:type", Object)
], CreatePolicyVersionDto.prototype, "value", void 0);
__decorate([
    (0, swagger_2.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePolicyVersionDto.prototype, "effectiveDate", void 0);
__decorate([
    (0, swagger_2.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePolicyVersionDto.prototype, "expirationDate", void 0);
__decorate([
    (0, swagger_2.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreatePolicyVersionDto.prototype, "priority", void 0);
__decorate([
    (0, swagger_2.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePolicyVersionDto.prototype, "changeReason", void 0);
let PolicyController = class PolicyController {
    constructor(policyService) {
        this.policyService = policyService;
    }
    listDefinitions(tenantId) {
        return this.policyService.listDefinitions(tenantId);
    }
    getHistory(key, tenantId) {
        return this.policyService.getVersionHistory(key, tenantId);
    }
    resolve(key, tenantId, universityId, studentId, partnerId) {
        return this.policyService.resolve(key, {
            tenantId,
            universityId,
            studentId,
            partnerId,
        });
    }
    createVersion(dto, tenantId, userId) {
        return this.policyService.createVersion({
            tenantId,
            policyKey: dto.policyKey,
            scopeType: dto.scopeType,
            scopeId: dto.scopeId,
            value: dto.value,
            effectiveDate: new Date(dto.effectiveDate),
            expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : undefined,
            priority: dto.priority,
            changeReason: dto.changeReason,
            createdBy: userId,
        });
    }
    approveVersion(id, tenantId, userId) {
        return this.policyService.approveVersion(id, tenantId, userId);
    }
};
exports.PolicyController = PolicyController;
__decorate([
    (0, common_1.Get)('definitions'),
    (0, decorators_1.RequirePermissions)('policy.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List all policy definitions' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PolicyController.prototype, "listDefinitions", null);
__decorate([
    (0, common_1.Get)('definitions/:key/history'),
    (0, decorators_1.RequirePermissions)('policy.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get version history for a policy (never deleted)' }),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PolicyController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Get)('resolve/:key'),
    (0, decorators_1.RequirePermissions)('policy.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Resolve effective policy value for a context' }),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, common_1.Query)('universityId')),
    __param(3, (0, common_1.Query)('studentId')),
    __param(4, (0, common_1.Query)('partnerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], PolicyController.prototype, "resolve", null);
__decorate([
    (0, common_1.Post)('versions'),
    (0, decorators_1.RequirePermissions)('policy.create'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new policy version (starts as draft)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreatePolicyVersionDto, String, String]),
    __metadata("design:returntype", void 0)
], PolicyController.prototype, "createVersion", null);
__decorate([
    (0, common_1.Post)('versions/:id/approve'),
    (0, decorators_1.RequirePermissions)('policy.approve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Approve and activate a draft policy version' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], PolicyController.prototype, "approveVersion", null);
exports.PolicyController = PolicyController = __decorate([
    (0, swagger_1.ApiTags)('Policy Engine'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('policy'),
    __metadata("design:paramtypes", [policy_service_1.PolicyService])
], PolicyController);
//# sourceMappingURL=policy.controller.js.map