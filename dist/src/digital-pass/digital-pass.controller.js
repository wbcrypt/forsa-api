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
exports.DigitalPassController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const digital_pass_service_1 = require("./digital-pass.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
const revoke_pass_dto_1 = require("./dto/revoke-pass.dto");
let DigitalPassController = class DigitalPassController {
    constructor(service) {
        this.service = service;
    }
    verify(token) {
        return this.service.verifyByToken(token);
    }
    findMyPass(u, t) {
        return this.service.findMyPass(u, t);
    }
    findAll(t) {
        return this.service.findAll(t);
    }
    revoke(id, dto, t, u) {
        return this.service.revoke(id, t, u, dto.reason);
    }
};
exports.DigitalPassController = DigitalPassController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('pass/verify/:token'),
    (0, swagger_1.ApiOperation)({ summary: 'Public QR verification — live status check, not a static payload (T-206)' }),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DigitalPassController.prototype, "verify", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Get)('students/me/digital-pass'),
    (0, swagger_1.ApiOperation)({ summary: "Get the logged-in student's own Digital Student Pass + QR code (T-205)" }),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DigitalPassController.prototype, "findMyPass", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Get)('digital-passes'),
    (0, decorators_1.RequirePermissions)('membership.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Admin Dashboard Digital Pass list' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DigitalPassController.prototype, "findAll", null);
__decorate([
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Post)('digital-passes/:id/revoke'),
    (0, decorators_1.RequirePermissions)('membership.approve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Revoke a Digital Student Pass' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, revoke_pass_dto_1.RevokePassDto, String, String]),
    __metadata("design:returntype", void 0)
], DigitalPassController.prototype, "revoke", null);
exports.DigitalPassController = DigitalPassController = __decorate([
    (0, swagger_1.ApiTags)('Digital Student Pass'),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [digital_pass_service_1.DigitalPassService])
], DigitalPassController);
//# sourceMappingURL=digital-pass.controller.js.map