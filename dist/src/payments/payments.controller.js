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
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const payments_service_1 = require("./payments.service");
const konnect_service_1 = require("./konnect.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
let PaymentsController = class PaymentsController {
    constructor(service, konnect) {
        this.service = service;
        this.konnect = konnect;
    }
    generateSchedule(body, t, u) {
        return this.service.generateSchedule({ ...body, tenantId: t, generatedBy: u });
    }
    getScheduleForApplication(id, t) {
        return this.service.getScheduleForApplication(id, t);
    }
    getMyScheduleForApplication(id, t, u) {
        return this.service.findMyScheduleForApplication(u, id, t);
    }
    getScheduleForMyUniversityApplication(id, t, u) {
        return this.service.findScheduleForMyUniversityApplication(u, id, t);
    }
    getSchedule(id, t) {
        return this.service.getSchedule(id, t);
    }
    recordPayment(body, t, u) {
        return this.service.recordPayment({ ...body, tenantId: t, receivedBy: u });
    }
    getInstallmentPayments(id, t) {
        return this.service.getInstallmentPayments(id, t);
    }
    reversePayment(id, body, t, u) {
        return this.service.reversePayment(id, t, body.reason, u);
    }
    submitReceipt(body, t, u) {
        return this.service.submitReceipt({
            ...body,
            tenantId: t,
            callerUserId: u,
        });
    }
    listReceipts(status, search, page, limit, t) {
        return this.service.listReceipts({
            tenantId: t,
            status,
            search,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
        });
    }
    verifyPayment(id, body, t, u) {
        if (body.status === 'rejected') {
            return this.service.rejectPayment(id, t, u, body.reason || body.notes || '');
        }
        return this.service.verifyPayment(id, t, u, body.notes);
    }
    async initiateKonnect(body, t, u, email, name) {
        const studentId = await this.service.verifyMyInstallmentOwnership(u, body.installmentId, t);
        return this.konnect.initiatePayment({
            tenantId: t,
            installmentId: body.installmentId,
            studentId,
            studentEmail: email,
            studentName: name || email,
            amount: body.amount,
            paymentReference: body.paymentReference,
        });
    }
    konnectWebhook(payload, sig) {
        return this.konnect.processWebhook(payload, sig);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)('schedules'),
    (0, decorators_1.RequirePermissions)('payment.create'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate payment schedule from contract and agreement' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "generateSchedule", null);
__decorate([
    (0, common_1.Get)('schedules/applications/:applicationId'),
    (0, decorators_1.RequirePermissions)('payment.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get payment schedule for an application' }),
    __param(0, (0, common_1.Param)('applicationId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getScheduleForApplication", null);
__decorate([
    (0, common_1.Get)('schedules/me/applications/:applicationId'),
    (0, swagger_1.ApiOperation)({ summary: "Get the logged-in student's own payment schedule for one of their applications" }),
    __param(0, (0, common_1.Param)('applicationId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getMyScheduleForApplication", null);
__decorate([
    (0, common_1.Get)('schedules/university-mine/applications/:applicationId'),
    (0, swagger_1.ApiOperation)({ summary: "Get a payment schedule for one of the logged-in university portal user's own applications" }),
    __param(0, (0, common_1.Param)('applicationId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getScheduleForMyUniversityApplication", null);
__decorate([
    (0, common_1.Get)('schedules/:id'),
    (0, decorators_1.RequirePermissions)('payment.view'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getSchedule", null);
__decorate([
    (0, common_1.Post)('record'),
    (0, decorators_1.RequirePermissions)('payment.record'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Record a payment against an installment' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "recordPayment", null);
__decorate([
    (0, common_1.Get)('installments/:id/payments'),
    (0, decorators_1.RequirePermissions)('payment.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all payments for an installment' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getInstallmentPayments", null);
__decorate([
    (0, common_1.Post)(':id/reverse'),
    (0, decorators_1.RequirePermissions)('payment.reverse'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Reverse a confirmed payment (admin)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "reversePayment", null);
__decorate([
    (0, common_1.Post)('receipts'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Student submits payment receipt for admin verification' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "submitReceipt", null);
__decorate([
    (0, common_1.Get)('receipts'),
    (0, decorators_1.RequirePermissions)('payment.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List payment receipts for admin verification' }),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __param(4, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "listReceipts", null);
__decorate([
    (0, common_1.Patch)(':id/verify'),
    (0, decorators_1.RequirePermissions)('payment.record'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Admin verifies payment receipt after checking bank account' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "verifyPayment", null);
__decorate([
    (0, common_1.Post)('konnect/initiate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Initiate a Konnect online payment for an installment' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __param(3, (0, decorators_1.CurrentUser)('email')),
    __param(4, (0, decorators_1.CurrentUser)('fullName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "initiateKonnect", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, throttler_1.SkipThrottle)(),
    (0, common_1.Post)('konnect-webhook'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Konnect payment webhook — called by Konnect on payment completion' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-konnect-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "konnectWebhook", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, swagger_1.ApiTags)('Payments'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService,
        konnect_service_1.KonnectService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map