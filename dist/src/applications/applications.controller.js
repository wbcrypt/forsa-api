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
exports.ApplicationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const applications_service_1 = require("./applications.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
const pagination_util_1 = require("../common/utils/pagination.util");
const transition_status_dto_1 = require("./dto/transition-status.dto");
let ApplicationsController = class ApplicationsController {
    constructor(service) {
        this.service = service;
    }
    create(dto, t, u) {
        return this.service.create(dto, t, u);
    }
    createForSelf(dto, t, u) {
        return this.service.createForSelf(u, t, dto);
    }
    findAllForMyUniversity(u, t, p, f) {
        return this.service.findAllForMyUniversity(u, t, p, f);
    }
    findOneForMyUniversity(id, u, t) {
        return this.service.findOneForMyUniversity(u, t, id);
    }
    getStatusHistoryForMyUniversity(id, u, t) {
        return this.service.getStatusHistoryForMyUniversity(u, t, id);
    }
    getStatusHistoryForMe(id, u, t) {
        return this.service.getStatusHistoryForMe(u, t, id);
    }
    findAll(t, p, f) {
        return this.service.findAll(t, p, f);
    }
    findOne(id, t) {
        return this.service.findOne(id, t);
    }
    getPipelineHistory(id, t) {
        return this.service.getPipelineHistory(id, t);
    }
    getStatusHistory(id, t) {
        return this.service.getStatusHistory(id, t);
    }
    transitionStatus(id, body, t, u) {
        return this.service.transitionStatus(id, t, body.status, u, body.notes);
    }
    confirmEnrollment(id, body, t, u) {
        return this.service.confirmEnrollment(id, t, u, body?.notes);
    }
    assign(id, body, t, u) {
        return this.service.assignTo(id, t, body.userId, u);
    }
    submitAppeal(id, dto, t, u) {
        return this.service.submitAppeal(id, t, dto, u);
    }
};
exports.ApplicationsController = ApplicationsController;
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.RequirePermissions)('application.create'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new application / lead (staff CRM path)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Submit a Financing Request as the logged-in student (T-207, gated on active membership)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "createForSelf", null);
__decorate([
    (0, common_1.Get)('university-mine'),
    (0, swagger_1.ApiOperation)({ summary: "List the logged-in university portal user's own applications" }),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, pagination_util_1.PaginationDto, Object]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "findAllForMyUniversity", null);
__decorate([
    (0, common_1.Get)('university-mine/:id'),
    (0, swagger_1.ApiOperation)({ summary: "Get one of the logged-in university portal user's own application's detail" }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentUser)('id')),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "findOneForMyUniversity", null);
__decorate([
    (0, common_1.Get)('university-mine/:id/status-history'),
    (0, swagger_1.ApiOperation)({ summary: "Get one of the logged-in university portal user's own application's status history" }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentUser)('id')),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "getStatusHistoryForMyUniversity", null);
__decorate([
    (0, common_1.Get)('me/:id/status-history'),
    (0, swagger_1.ApiOperation)({ summary: "Get the logged-in student's own application's status history" }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentUser)('id')),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "getStatusHistoryForMe", null);
__decorate([
    (0, common_1.Get)(),
    (0, decorators_1.RequirePermissions)('application.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List applications with filters' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_util_1.PaginationDto, Object]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, decorators_1.RequirePermissions)('application.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get full application detail' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/pipeline-history'),
    (0, decorators_1.RequirePermissions)('application.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all pipeline runs for this application' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "getPipelineHistory", null);
__decorate([
    (0, common_1.Get)(':id/status-history'),
    (0, decorators_1.RequirePermissions)('application.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get full status transition history' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "getStatusHistory", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, decorators_1.RequirePermissions)('application.edit'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Manually transition application status' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, transition_status_dto_1.TransitionStatusDto, String, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "transitionStatus", null);
__decorate([
    (0, common_1.Post)(':id/university-confirm'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "University portal confirms enrollment/tuition for one of its own students' applications" }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "confirmEnrollment", null);
__decorate([
    (0, common_1.Patch)(':id/assign'),
    (0, decorators_1.RequirePermissions)('application.assign'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Assign application to a staff member' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "assign", null);
__decorate([
    (0, common_1.Post)(':id/appeal'),
    (0, decorators_1.RequirePermissions)('application.appeal'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Submit appeal for a rejected application' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "submitAppeal", null);
exports.ApplicationsController = ApplicationsController = __decorate([
    (0, swagger_1.ApiTags)('Applications'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('applications'),
    __metadata("design:paramtypes", [applications_service_1.ApplicationsService])
], ApplicationsController);
//# sourceMappingURL=applications.controller.js.map