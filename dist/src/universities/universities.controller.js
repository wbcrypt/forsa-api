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
exports.UniversitiesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const universities_service_1 = require("./universities.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
const pagination_util_1 = require("../common/utils/pagination.util");
let UniversitiesController = class UniversitiesController {
    constructor(service) {
        this.service = service;
    }
    create(dto, t, u) {
        return this.service.create(dto, t, u);
    }
    findAll(t, p, f) {
        return this.service.findAll(t, p, f);
    }
    findOne(id, t) {
        return this.service.findOne(id, t);
    }
    update(id, dto, t, u) {
        return this.service.update(id, t, dto, u);
    }
    getPerformance(id, t) {
        return this.service.getPerformance(id, t);
    }
    createProgram(id, dto, t) {
        return this.service.createProgram(id, t, dto);
    }
    findPrograms(id, t) {
        return this.service.findPrograms(id, t);
    }
    addContact(id, dto, t) {
        return this.service.addContact(id, t, dto);
    }
    createAgreement(id, dto, t, u) {
        return this.service.createAgreement(id, t, dto, u);
    }
    approveAgreement(id, t, u) {
        return this.service.approveAgreement(id, t, u);
    }
    initiateBusinessContinuity(id, dto, t, u) {
        return this.service.initiateBusinessContinuity(id, t, dto, u);
    }
};
exports.UniversitiesController = UniversitiesController;
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.RequirePermissions)('university.create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, decorators_1.RequirePermissions)('university.view'),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_util_1.PaginationDto, Object]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, decorators_1.RequirePermissions)('university.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, decorators_1.RequirePermissions)('university.edit'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':id/performance'),
    (0, decorators_1.RequirePermissions)('university.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "getPerformance", null);
__decorate([
    (0, common_1.Post)(':id/programs'),
    (0, decorators_1.RequirePermissions)('university.edit'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "createProgram", null);
__decorate([
    (0, common_1.Get)(':id/programs'),
    (0, decorators_1.RequirePermissions)('university.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "findPrograms", null);
__decorate([
    (0, common_1.Post)(':id/contacts'),
    (0, decorators_1.RequirePermissions)('university.edit'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "addContact", null);
__decorate([
    (0, common_1.Post)(':id/agreements'),
    (0, decorators_1.RequirePermissions)('university.agreement.create'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "createAgreement", null);
__decorate([
    (0, common_1.Post)('agreements/:agreementId/approve'),
    (0, decorators_1.RequirePermissions)('university.agreement.approve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('agreementId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "approveAgreement", null);
__decorate([
    (0, common_1.Post)(':id/business-continuity'),
    (0, decorators_1.RequirePermissions)('exceptional_event.open'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], UniversitiesController.prototype, "initiateBusinessContinuity", null);
exports.UniversitiesController = UniversitiesController = __decorate([
    (0, swagger_1.ApiTags)('Universities'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('universities'),
    __metadata("design:paramtypes", [universities_service_1.UniversitiesService])
], UniversitiesController);
//# sourceMappingURL=universities.controller.js.map