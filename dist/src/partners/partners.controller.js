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
exports.PartnersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const partners_service_1 = require("./partners.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
const pagination_util_1 = require("../common/utils/pagination.util");
let PartnersController = class PartnersController {
    constructor(service) {
        this.service = service;
    }
    create(dto, t, u) {
        return this.service.create(dto, t, u);
    }
    findAll(t, p) {
        return this.service.findAll(t, p);
    }
    getCommissions(t, p, f) {
        return this.service.getCommissions(t, f, p);
    }
    getMe(u, t) {
        return this.service.findMe(u, t);
    }
    getMyApplications(u, t, p) {
        return this.service.getMyApplications(u, t, p);
    }
    getMyDashboard(u, t) {
        return this.service.getMyDashboard(u, t);
    }
    getMyCommissions(u, t, p) {
        return this.service.getMyCommissions(u, t, p);
    }
    updateMe(u, t, body) {
        return this.service.updateMe(u, t, body);
    }
    findOne(id, t) {
        return this.service.findOne(id, t);
    }
    getDashboard(id, t) {
        return this.service.getPartnerDashboard(id, t);
    }
    createAgreement(id, dto, t, u) {
        return this.service.createAgreement(id, t, dto, u);
    }
    advanceCommission(id, body, t, u) {
        return this.service.advanceCommissionStatus(id, t, body.newStatus, u);
    }
};
exports.PartnersController = PartnersController;
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.RequirePermissions)('partner.create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, decorators_1.RequirePermissions)('partner.view'),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_util_1.PaginationDto]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('commissions'),
    (0, decorators_1.RequirePermissions)('partner.commission.approve'),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_util_1.PaginationDto, Object]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "getCommissions", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "getMe", null);
__decorate([
    (0, common_1.Get)('me/applications'),
    (0, swagger_1.ApiOperation)({ summary: "List the logged-in partner's own referred applications (T-224 identity fix)" }),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, pagination_util_1.PaginationDto]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "getMyApplications", null);
__decorate([
    (0, common_1.Get)('me/dashboard'),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "getMyDashboard", null);
__decorate([
    (0, common_1.Get)('me/commissions'),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, pagination_util_1.PaginationDto]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "getMyCommissions", null);
__decorate([
    (0, common_1.Patch)('me'),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, decorators_1.RequirePermissions)('partner.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/dashboard'),
    (0, decorators_1.RequirePermissions)('partner.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Post)(':id/agreements'),
    (0, decorators_1.RequirePermissions)('partner.edit'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "createAgreement", null);
__decorate([
    (0, common_1.Post)('commissions/:id/advance'),
    (0, decorators_1.RequirePermissions)('partner.commission.approve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "advanceCommission", null);
exports.PartnersController = PartnersController = __decorate([
    (0, swagger_1.ApiTags)('Partners & Referrals'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('partners'),
    __metadata("design:paramtypes", [partners_service_1.PartnersService])
], PartnersController);
//# sourceMappingURL=partners.controller.js.map