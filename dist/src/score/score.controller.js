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
exports.ScoreController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const score_service_1 = require("./score.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
let ScoreController = class ScoreController {
    constructor(service) {
        this.service = service;
    }
    getScore(id, t) {
        return this.service.getScore(id, t);
    }
    getHistory(id, t) {
        return this.service.getScoreHistory(id, t);
    }
    recordEvent(studentId, body, t, u) {
        return this.service.recordEvent({ tenantId: t, studentId, recordedBy: u, ...body });
    }
    createCorrectiveEvent(studentId, body, t, u) {
        return this.service.createCorrectiveEvent({ tenantId: t, studentId, approvedBy: u, ...body });
    }
    reconcile(studentId, u) {
        return this.service.reconcileStudentScore(studentId, u);
    }
};
exports.ScoreController = ScoreController;
__decorate([
    (0, common_1.Get)('students/:studentId'),
    (0, decorators_1.RequirePermissions)('score.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current FORSA score and dimension breakdown' }),
    __param(0, (0, common_1.Param)('studentId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ScoreController.prototype, "getScore", null);
__decorate([
    (0, common_1.Get)('students/:studentId/history'),
    (0, decorators_1.RequirePermissions)('score.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get full immutable score event history' }),
    __param(0, (0, common_1.Param)('studentId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ScoreController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Post)('students/:studentId/events'),
    (0, decorators_1.RequirePermissions)('score.record'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Record a new score event (immutable)' }),
    __param(0, (0, common_1.Param)('studentId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], ScoreController.prototype, "recordEvent", null);
__decorate([
    (0, common_1.Post)('students/:studentId/corrective-events'),
    (0, decorators_1.RequirePermissions)('score.correct'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Create corrective event (appeal). Supersedes original event 1:1.' }),
    __param(0, (0, common_1.Param)('studentId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], ScoreController.prototype, "createCorrectiveEvent", null);
__decorate([
    (0, common_1.Post)('students/:studentId/reconcile'),
    (0, decorators_1.RequirePermissions)('score.reconcile'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Trigger manual score reconciliation for a student' }),
    __param(0, (0, common_1.Param)('studentId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ScoreController.prototype, "reconcile", null);
exports.ScoreController = ScoreController = __decorate([
    (0, swagger_1.ApiTags)('FORSA Score Engine'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('scores'),
    __metadata("design:paramtypes", [score_service_1.ScoreService])
], ScoreController);
//# sourceMappingURL=score.controller.js.map