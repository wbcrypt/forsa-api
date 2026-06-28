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
const guarantors_service_1 = require("./guarantors.service");
function RequirePermissions(...perms) { return (t, k, d) => d; }
function CurrentUser(field) { return (t, k, i) => { }; }
function CurrentTenant() { return (t, k, i) => { }; }
let GuarantorsController = class GuarantorsController {
    constructor(service) {
        this.service = service;
    }
    getMyStudent() { return this.service.getLinkedStudent('', ''); }
    getMyStudentPayments() { return this.service.getLinkedStudentPayments('', ''); }
    submitReceipt(body) { return this.service.submitReceiptOnBehalf('', '', body); }
    initiateKonnect(body) { return this.service.initiateKonnectOnBehalf('', '', '', '', body); }
    getNotifications() { return this.service.getNotifications('', ''); }
};
exports.GuarantorsController = GuarantorsController;
__decorate([
    (0, common_1.Get)('my-student'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "getMyStudent", null);
__decorate([
    (0, common_1.Get)('my-student/payments'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "getMyStudentPayments", null);
__decorate([
    (0, common_1.Post)('my-student/payment-receipt'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "submitReceipt", null);
__decorate([
    (0, common_1.Post)('my-student/konnect'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "initiateKonnect", null);
__decorate([
    (0, common_1.Get)('notifications'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GuarantorsController.prototype, "getNotifications", null);
exports.GuarantorsController = GuarantorsController = __decorate([
    (0, swagger_1.ApiTags)('Guarantors'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('guarantors'),
    __metadata("design:paramtypes", [guarantors_service_1.GuarantorsService])
], GuarantorsController);
//# sourceMappingURL=guarantors.controller.js.map