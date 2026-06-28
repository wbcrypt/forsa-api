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
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reports_service_1 = require("./reports.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
let ReportsController = class ReportsController {
    constructor(service) {
        this.service = service;
    }
    getCeo(t) {
        return this.service.getCeoDashboard(t);
    }
    getFinance(t) {
        return this.service.getFinanceDashboard(t);
    }
    getSales(t) {
        return this.service.getSalesDashboard(t);
    }
    getCollections(t) {
        return this.service.getCollectionsDashboard(t);
    }
    getPartners(t) {
        return this.service.getPartnerDashboard(t);
    }
    getAudit(t, module, userId, from, to, limit) {
        return this.service.getAuditReport(t, { module, userId, from, to, limit });
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)('ceo'),
    (0, decorators_1.RequirePermissions)('report.ceo'),
    (0, swagger_1.ApiOperation)({ summary: 'CEO overview dashboard' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getCeo", null);
__decorate([
    (0, common_1.Get)('finance'),
    (0, decorators_1.RequirePermissions)('report.finance'),
    (0, swagger_1.ApiOperation)({ summary: 'Finance dashboard — ledger, receivables, disbursements' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getFinance", null);
__decorate([
    (0, common_1.Get)('sales'),
    (0, decorators_1.RequirePermissions)('report.sales'),
    (0, swagger_1.ApiOperation)({ summary: 'Sales funnel, conversion rates, team performance' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getSales", null);
__decorate([
    (0, common_1.Get)('collections'),
    (0, decorators_1.RequirePermissions)('report.collections'),
    (0, swagger_1.ApiOperation)({ summary: 'Collections dashboard — aging, overdue, risk buckets' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getCollections", null);
__decorate([
    (0, common_1.Get)('partners'),
    (0, decorators_1.RequirePermissions)('report.partners'),
    (0, swagger_1.ApiOperation)({ summary: 'Partner referral and commission report' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getPartners", null);
__decorate([
    (0, common_1.Get)('audit'),
    (0, decorators_1.RequirePermissions)('report.audit'),
    (0, swagger_1.ApiOperation)({ summary: 'Full audit log report' }),
    __param(0, (0, decorators_1.CurrentTenant)()),
    __param(1, (0, common_1.Query)('module')),
    __param(2, (0, common_1.Query)('userId')),
    __param(3, (0, common_1.Query)('from')),
    __param(4, (0, common_1.Query)('to')),
    __param(5, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, Number]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getAudit", null);
exports.ReportsController = ReportsController = __decorate([
    (0, swagger_1.ApiTags)('Reports & Analytics'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('reports'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map