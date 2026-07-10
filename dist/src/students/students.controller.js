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
exports.StudentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const students_service_1 = require("./students.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
const pagination_util_1 = require("../common/utils/pagination.util");
let StudentsController = class StudentsController {
    constructor(service) {
        this.service = service;
    }
    findMe(u, t) {
        return this.service.findMe(u, t);
    }
    updateMyProfile(dto, u, t) {
        return this.service.updateMyProfile(u, t, dto);
    }
    findMyPayments(u, t) {
        return this.service.findMyPayments(u, t);
    }
    findMyApplications(u, t) {
        return this.service.findMyApplications(u, t);
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
    findOnePii(id, t) {
        return this.service.findOne(id, t, true);
    }
    update(id, dto, t, u) {
        return this.service.update(id, t, dto, u);
    }
    getApplicationHistory(id, t) {
        return this.service.getApplicationHistory(id, t);
    }
    getPaymentHistory(id, t) {
        return this.service.getPaymentHistory(id, t);
    }
    getExceptionalEvents(id, t) {
        return this.service.getExceptionalEvents(id, t);
    }
    openExceptionalEvent(id, dto, t, u) {
        return this.service.openExceptionalEvent(id, t, { ...dto, openedBy: u });
    }
    addMyGuarantor(dto, t, u) {
        return this.service.addMyGuarantor(u, t, dto);
    }
    resendMyGuarantorInvite(guarantorId, t, u) {
        return this.service.resendMyGuarantorInvite(u, t, guarantorId);
    }
    addGuarantor(id, dto, t, u) {
        return this.service.addGuarantor(id, t, dto, u);
    }
    resendGuarantorInvite(id, guarantorId, t, u) {
        return this.service.resendGuarantorInvite(id, guarantorId, t, u);
    }
    withdrawGuarantor(id, guarantorId, dto, t, u) {
        return this.service.withdrawGuarantor(id, guarantorId, t, dto.reason, dto.reasonCode, u);
    }
};
exports.StudentsController = StudentsController;
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Get the logged-in student portal user\'s own student profile (T-101)' }),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "findMe", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, swagger_1.ApiOperation)({ summary: "Update the logged-in student portal user's own profile" }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)('id')),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "updateMyProfile", null);
__decorate([
    (0, common_1.Get)('me/payments'),
    (0, swagger_1.ApiOperation)({ summary: 'Get the logged-in student portal user\'s own complete payment history, across all applications (T-219)' }),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "findMyPayments", null);
__decorate([
    (0, common_1.Get)('me/applications'),
    (0, swagger_1.ApiOperation)({ summary: 'Get the logged-in student portal user\'s own application history' }),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "findMyApplications", null);
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.RequirePermissions)('student.create'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, decorators_1.RequirePermissions)('student.view'),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_util_1.PaginationDto, Object]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, decorators_1.RequirePermissions)('student.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/pii'),
    (0, decorators_1.RequirePermissions)('student.view_pii'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "findOnePii", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, decorators_1.RequirePermissions)('student.edit'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':id/applications'),
    (0, decorators_1.RequirePermissions)('student.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "getApplicationHistory", null);
__decorate([
    (0, common_1.Get)(':id/payments'),
    (0, decorators_1.RequirePermissions)('payment.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "getPaymentHistory", null);
__decorate([
    (0, common_1.Get)(':id/exceptional-events'),
    (0, decorators_1.RequirePermissions)('exceptional_event.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "getExceptionalEvents", null);
__decorate([
    (0, common_1.Post)(':id/exceptional-events'),
    (0, decorators_1.RequirePermissions)('exceptional_event.open'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "openExceptionalEvent", null);
__decorate([
    (0, common_1.Post)('me/guarantors'),
    (0, swagger_1.ApiOperation)({ summary: 'Invite a guarantor as the logged-in student, no staff action required' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "addMyGuarantor", null);
__decorate([
    (0, common_1.Post)('me/guarantors/:guarantorId/resend-invite'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "Resend one of the logged-in student's own guarantor invitations" }),
    __param(0, (0, common_1.Param)('guarantorId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "resendMyGuarantorInvite", null);
__decorate([
    (0, common_1.Post)(':id/guarantors'),
    (0, decorators_1.RequirePermissions)('student.edit'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "addGuarantor", null);
__decorate([
    (0, common_1.Post)(':id/guarantors/:guarantorId/resend-invite'),
    (0, decorators_1.RequirePermissions)('student.edit'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('guarantorId', common_1.ParseUUIDPipe)),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "resendGuarantorInvite", null);
__decorate([
    (0, common_1.Delete)(':id/guarantors/:guarantorId'),
    (0, decorators_1.RequirePermissions)('student.edit'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Param)('guarantorId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, decorators_1.CurrentTenant)()),
    __param(4, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String, String]),
    __metadata("design:returntype", void 0)
], StudentsController.prototype, "withdrawGuarantor", null);
exports.StudentsController = StudentsController = __decorate([
    (0, swagger_1.ApiTags)('Students'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('students'),
    __metadata("design:paramtypes", [students_service_1.StudentsService])
], StudentsController);
//# sourceMappingURL=students.controller.js.map