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
exports.ContractsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const contracts_service_1 = require("./contracts.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
let ContractsController = class ContractsController {
    constructor(service) {
        this.service = service;
    }
    generate(body, t, u) {
        return this.service.generateContract({ ...body, tenantId: t, generatedBy: u });
    }
    getForApplication(id, t) {
        return this.service.getContractsForApplication(id, t);
    }
    sendForSignature(id, t, u) {
        return this.service.sendForSignature(id, t, u);
    }
    recordSignature(id, body, t, u) {
        return this.service.recordSignature({ contractId: id, tenantId: t, signedBy: u, ...body });
    }
    getDownloadUrl(id, t, u) {
        return this.service.getContractDownloadUrl(id, t, u);
    }
};
exports.ContractsController = ContractsController;
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.RequirePermissions)('contract.generate'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate a contract for a financing decision' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "generate", null);
__decorate([
    (0, common_1.Get)('applications/:applicationId'),
    (0, decorators_1.RequirePermissions)('contract.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all contracts for an application' }),
    __param(0, (0, common_1.Param)('applicationId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "getForApplication", null);
__decorate([
    (0, common_1.Post)(':id/send'),
    (0, decorators_1.RequirePermissions)('contract.send'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Send contract for signature' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "sendForSignature", null);
__decorate([
    (0, common_1.Post)(':id/sign'),
    (0, decorators_1.RequirePermissions)('contract.sign'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Record a signature on a contract' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "recordSignature", null);
__decorate([
    (0, common_1.Get)(':id/download'),
    (0, decorators_1.RequirePermissions)('contract.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get contract download URL' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "getDownloadUrl", null);
exports.ContractsController = ContractsController = __decorate([
    (0, swagger_1.ApiTags)('Contracts'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('contracts'),
    __metadata("design:paramtypes", [contracts_service_1.ContractsService])
], ContractsController);
//# sourceMappingURL=contracts.controller.js.map