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
exports.CollectionsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const collections_service_1 = require("./collections.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
const pagination_util_1 = require("../common/utils/pagination.util");
let CollectionsController = class CollectionsController {
    constructor(service) {
        this.service = service;
    }
    getDashboard(t) {
        return this.service.getDashboard(t);
    }
    getLate(t, p, f) {
        return this.service.getLateInstallments(t, p, f);
    }
    getWorklist(t, u, mine) {
        return this.service.getPrioritizedWorklist(t, mine === 'true' ? u : undefined);
    }
    logContact(body, t, u) {
        return this.service.logContactAttempt({ ...body, tenantId: t, loggedBy: u });
    }
    getContactHistory(id, t) {
        return this.service.getContactHistory(id, t);
    }
};
exports.CollectionsController = CollectionsController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, decorators_1.RequirePermissions)('collections.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Collections dashboard — late, at-risk, defaulted summary' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CollectionsController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('late'),
    (0, decorators_1.RequirePermissions)('collections.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Paginated list of late installments' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_util_1.PaginationDto, Object]),
    __metadata("design:returntype", void 0)
], CollectionsController.prototype, "getLate", null);
__decorate([
    (0, common_1.Get)('worklist'),
    (0, decorators_1.RequirePermissions)('collections.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Score-prioritized collections worklist' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __param(1, (0, decorators_1.CurrentUser)('id')),
    __param(2, (0, common_1.Query)('mine')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], CollectionsController.prototype, "getWorklist", null);
__decorate([
    (0, common_1.Post)('contact-logs'),
    (0, decorators_1.RequirePermissions)('collections.log'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Log a contact attempt with a student' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CollectionsController.prototype, "logContact", null);
__decorate([
    (0, common_1.Get)('installments/:id/contact-history'),
    (0, decorators_1.RequirePermissions)('collections.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], CollectionsController.prototype, "getContactHistory", null);
exports.CollectionsController = CollectionsController = __decorate([
    (0, swagger_1.ApiTags)('Collections'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('collections'),
    __metadata("design:paramtypes", [collections_service_1.CollectionsService])
], CollectionsController);
//# sourceMappingURL=collections.controller.js.map