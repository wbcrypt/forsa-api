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
exports.ExecutionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const execution_service_1 = require("./execution.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
const encryption_util_1 = require("../common/utils/encryption.util");
let ExecutionController = class ExecutionController {
    constructor(service) {
        this.service = service;
    }
    execute(body, t, u) {
        return this.service.execute({
            executionId: body.executionId || (0, encryption_util_1.generateIdempotencyKey)('exec'),
            tenantId: t,
            actionType: body.actionType,
            payload: body.payload,
            requestedBy: u,
        });
    }
    getHistory(t, limit) {
        return this.service.getExecutionHistory(t, limit || 50);
    }
};
exports.ExecutionController = ExecutionController;
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.RequirePermissions)('execution.submit'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Submit an action for execution through the DEE (idempotent)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ExecutionController.prototype, "execute", null);
__decorate([
    (0, common_1.Get)('history'),
    (0, decorators_1.RequirePermissions)('execution.view'),
    (0, swagger_1.ApiOperation)({ summary: 'View execution ledger history (immutable)' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", void 0)
], ExecutionController.prototype, "getHistory", null);
exports.ExecutionController = ExecutionController = __decorate([
    (0, swagger_1.ApiTags)('Decision Execution Engine'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('execution'),
    __metadata("design:paramtypes", [execution_service_1.ExecutionService])
], ExecutionController);
//# sourceMappingURL=execution.controller.js.map