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
exports.MembershipController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const membership_service_1 = require("./membership.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
const create_membership_request_dto_1 = require("./dto/create-membership-request.dto");
const reject_membership_request_dto_1 = require("./dto/reject-membership-request.dto");
let MembershipController = class MembershipController {
    constructor(service) {
        this.service = service;
    }
    create(dto) {
        return this.service.createRequest(dto);
    }
    findAll(t, status) {
        return this.service.findAll(t, status);
    }
    findOne(id, t) {
        return this.service.findOne(id, t);
    }
    approve(id, t, u) {
        return this.service.approve(id, t, u);
    }
    reject(id, dto, t, u) {
        return this.service.reject(id, t, u, dto.reason);
    }
};
exports.MembershipController = MembershipController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Public Membership Request intake (Visitor -> Membership Request, Phase 2 T-203)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_membership_request_dto_1.CreateMembershipRequestDto]),
    __metadata("design:returntype", void 0)
], MembershipController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, decorators_1.RequirePermissions)('membership.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List membership requests (Admin Dashboard Membership Queue)' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __param(1, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], MembershipController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, decorators_1.RequirePermissions)('membership.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], MembershipController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, decorators_1.RequirePermissions)('membership.approve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Approve a membership request — issues Bronze membership (T-204)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], MembershipController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, decorators_1.RequirePermissions)('membership.approve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Reject a membership request' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reject_membership_request_dto_1.RejectMembershipRequestDto, String, String]),
    __metadata("design:returntype", void 0)
], MembershipController.prototype, "reject", null);
exports.MembershipController = MembershipController = __decorate([
    (0, swagger_1.ApiTags)('Membership'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('membership-requests'),
    __metadata("design:paramtypes", [membership_service_1.MembershipService])
], MembershipController);
//# sourceMappingURL=membership.controller.js.map