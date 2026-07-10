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
exports.GuarantorsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const decorators_1 = require("../common/decorators");
const guarantors_service_1 = require("./guarantors.service");
const accept_guarantor_invite_dto_1 = require("./dto/accept-guarantor-invite.dto");
const financial_profile_dto_1 = require("./dto/financial-profile.dto");
let GuarantorsController = class GuarantorsController {
    constructor(service) {
        this.service = service;
    }
    previewInvite(token) {
        return this.service.previewInvite(token);
    }
    acceptInvite(token, dto) {
        return this.service.acceptInvite(token, dto);
    }
    declineInvite(token, dto) {
        return this.service.declineInvite(token, dto);
    }
    getMyStudent(userId, tenantId) { return this.service.getLinkedStudent(userId, tenantId); }
    getMyStudentPayments(userId, tenantId) { return this.service.getLinkedStudentPayments(userId, tenantId); }
    getReceiptUploadUrl(userId, tenantId, body) { return this.service.getReceiptUploadUrl(userId, tenantId, body.fileName, body.contentType); }
    confirmReceiptUpload(userId, tenantId, body) { return this.service.confirmReceiptUpload(userId, tenantId, body.documentId, body.fileSize, body.checksum); }
    submitReceipt(userId, tenantId, body) { return this.service.submitReceiptOnBehalf(userId, tenantId, body); }
    initiateKonnect(userId, tenantId, email, fullName, body) { return this.service.initiateKonnectOnBehalf(userId, tenantId, email, fullName, body); }
    getNotifications(userId, tenantId) { return this.service.getNotifications(userId, tenantId); }
    getMyCaseStatus(userId, tenantId) { return this.service.getMyCaseStatus(userId, tenantId); }
    updateMyFinancialProfile(userId, tenantId, dto) { return this.service.updateMyFinancialProfile(userId, tenantId, dto); }
};
exports.GuarantorsController = GuarantorsController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)('invite/:token'),
    (0, swagger_1.ApiOperation)({ summary: 'Preview a guarantor invite before accepting/declining — who invited you, for which student' }),
    __param(0, (0, common_1.Param)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "previewInvite", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('invite/:token/accept'),
    (0, swagger_1.ApiOperation)({ summary: 'Accept a guarantor invite — sets a password and activates portal access' }),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, accept_guarantor_invite_dto_1.AcceptGuarantorInviteDto]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "acceptInvite", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('invite/:token/decline'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Decline a guarantor invite — no account is created' }),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, accept_guarantor_invite_dto_1.DeclineGuarantorInviteDto]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "declineInvite", null);
__decorate([
    (0, common_1.Get)('my-student'),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "getMyStudent", null);
__decorate([
    (0, common_1.Get)('my-student/payments'),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "getMyStudentPayments", null);
__decorate([
    (0, common_1.Post)('my-student/payment-receipt/upload-url'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Get a presigned S3 upload URL for a payment receipt file (T-111)' }),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "getReceiptUploadUrl", null);
__decorate([
    (0, common_1.Post)('my-student/payment-receipt/confirm-upload'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Confirm a payment receipt file finished uploading to S3 (T-111)' }),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "confirmReceiptUpload", null);
__decorate([
    (0, common_1.Post)('my-student/payment-receipt'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "submitReceipt", null);
__decorate([
    (0, common_1.Post)('my-student/konnect'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('email')),
    __param(3, (0, decorators_1.CurrentUser)('fullName')),
    __param(4, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "initiateKonnect", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "getNotifications", null);
__decorate([
    (0, common_1.Get)('my-case'),
    (0, swagger_1.ApiOperation)({ summary: "The guarantor's own Case status — profile completeness, documents, meeting" }),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "getMyCaseStatus", null);
__decorate([
    (0, common_1.Patch)('my-case/financial-profile'),
    (0, swagger_1.ApiOperation)({ summary: 'Complete or update the Financial Responsibility Profile (Step 4 of the Case wizard)' }),
    __param(0, (0, decorators_1.CurrentUser)('id')),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, financial_profile_dto_1.UpdateFinancialProfileDto]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "updateMyFinancialProfile", null);
exports.GuarantorsController = GuarantorsController = __decorate([
    (0, swagger_1.ApiTags)('Guarantors'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('guarantors'),
    __metadata("design:paramtypes", [guarantors_service_1.GuarantorsService])
], GuarantorsController);
//# sourceMappingURL=guarantors.controller.js.map