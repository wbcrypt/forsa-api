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
exports.PipelineController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const pipeline_service_1 = require("./pipeline.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
let PipelineController = class PipelineController {
    constructor(service) {
        this.service = service;
    }
    startRun(applicationId, body, t, u) {
        return this.service.startRun(applicationId, t, u, body.reentryFromStage);
    }
    getRun(id, t) {
        return this.service.getPipelineRun(id, t);
    }
    submitHumanDecision(id, body, t, u) {
        return this.service.submitHumanDecision(id, t, u, body.decision, body.approvedAmount, body.notes);
    }
};
exports.PipelineController = PipelineController;
__decorate([
    (0, common_1.Post)('applications/:applicationId/run'),
    (0, decorators_1.RequirePermissions)('pipeline.run'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Start a new pipeline run for an application' }),
    __param(0, (0, common_1.Param)('applicationId', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], PipelineController.prototype, "startRun", null);
__decorate([
    (0, common_1.Get)('runs/:id'),
    (0, decorators_1.RequirePermissions)('pipeline.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get pipeline run details and trace' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PipelineController.prototype, "getRun", null);
__decorate([
    (0, common_1.Post)('runs/:id/human-decision'),
    (0, decorators_1.RequirePermissions)('pipeline.review'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Submit human review decision — continues pipeline from stage 9' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], PipelineController.prototype, "submitHumanDecision", null);
exports.PipelineController = PipelineController = __decorate([
    (0, swagger_1.ApiTags)('Financing Decision Pipeline'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('pipeline'),
    __metadata("design:paramtypes", [pipeline_service_1.PipelineService])
], PipelineController);
//# sourceMappingURL=pipeline.controller.js.map