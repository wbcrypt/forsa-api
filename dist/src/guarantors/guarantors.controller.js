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
const register_guarantor_dto_1 = require("./dto/register-guarantor.dto");
let GuarantorsController = class GuarantorsController {
    constructor(service) {
        this.service = service;
    }
    registerSelf(dto) {
        return this.service.registerSelf(dto);
    }
    getMyStudent(userId, tenantId) { return this.service.getLinkedStudent(userId, tenantId); }
    getMyStudentPayments(userId, tenantId) { return this.service.getLinkedStudentPayments(userId, tenantId); }
    getReceiptUploadUrl(userId, tenantId, body) { return this.service.getReceiptUploadUrl(userId, tenantId, body.fileName, body.contentType); }
    confirmReceiptUpload(userId, tenantId, body) { return this.service.confirmReceiptUpload(userId, tenantId, body.documentId, body.fileSize, body.checksum); }
    submitReceipt(userId, tenantId, body) { return this.service.submitReceiptOnBehalf(userId, tenantId, body); }
    initiateKonnect(userId, tenantId, email, fullName, body) { return this.service.initiateKonnectOnBehalf(userId, tenantId, email, fullName, body); }
    getNotifications(userId, tenantId) { return this.service.getNotifications(userId, tenantId); }
};
exports.GuarantorsController = GuarantorsController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('register'),
    (0, swagger_1.ApiOperation)({ summary: 'Public guarantor self-registration — activates portal access for an existing guarantor record (T-102)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_guarantor_dto_1.RegisterGuarantorDto]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "registerSelf", null);
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
exports.GuarantorsController = GuarantorsController = __decorate([
    (0, swagger_1.ApiTags)('Guarantors'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('guarantors'),
    __metadata("design:paramtypes", [guarantors_service_1.GuarantorsService])
], GuarantorsController);
//# sourceMappingURL=guarantors.controller.js.map