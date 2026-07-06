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
exports.DocumentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const documents_service_1 = require("./documents.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const permissions_guard_1 = require("../auth/guards/permissions.guard");
const decorators_1 = require("../common/decorators");
let DocumentsController = class DocumentsController {
    constructor(service) {
        this.service = service;
    }
    generateUploadUrl(body, t, u) {
        return this.service.generateUploadUrl({ ...body, tenantId: t, uploadedBy: u });
    }
    generateMyUploadUrl(body, t, u) {
        return this.service.generateMyUploadUrl(u, t, body);
    }
    confirmUpload(id, body, t) {
        return this.service.confirmUpload(id, t, body.fileSize, body.checksum);
    }
    confirmMyUpload(id, body, t, u) {
        return this.service.confirmMyUpload(u, id, t, body.fileSize, body.checksum);
    }
    getDownloadUrl(id, t, u, ip) {
        return this.service.generateDownloadUrl(id, t, u, ip);
    }
    getDownloadUrlForMyUniversity(id, t, u, ip) {
        return this.service.generateDownloadUrlForMyUniversity(id, t, u, ip);
    }
    reviewDocument(id, body, t, u) {
        return this.service.reviewDocument(id, t, body.action, u, body.notes, body.rejectionReason);
    }
    getForEntity(entityType, entityId, t) {
        return this.service.getDocumentsForEntity(entityType, entityId, t);
    }
    getChecklist(applicationId, t) {
        return this.service.getDocumentChecklist(applicationId, t);
    }
    getChecklistForMyUniversity(applicationId, t, u) {
        return this.service.getDocumentChecklistForMyUniversity(applicationId, t, u);
    }
};
exports.DocumentsController = DocumentsController;
__decorate([
    (0, common_1.Post)('upload-url'),
    (0, decorators_1.RequirePermissions)('document.upload'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate a pre-signed S3 upload URL' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "generateUploadUrl", null);
__decorate([
    (0, common_1.Post)('me/upload-url'),
    (0, swagger_1.ApiOperation)({ summary: "Generate a pre-signed S3 upload URL for the logged-in student's own document" }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "generateMyUploadUrl", null);
__decorate([
    (0, common_1.Post)(':id/confirm-upload'),
    (0, decorators_1.RequirePermissions)('document.upload'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Confirm upload complete after client PUT to S3' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "confirmUpload", null);
__decorate([
    (0, common_1.Post)('me/:id/confirm-upload'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: "Confirm the logged-in student's own upload complete" }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "confirmMyUpload", null);
__decorate([
    (0, common_1.Get)(':id/download-url'),
    (0, decorators_1.RequirePermissions)('document.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Generate a short-lived pre-signed download URL' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __param(3, (0, decorators_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "getDownloadUrl", null);
__decorate([
    (0, common_1.Get)('university-mine/:id/download-url'),
    (0, swagger_1.ApiOperation)({ summary: "Generate a download URL for one of the logged-in university portal user's own students' documents" }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __param(3, (0, decorators_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "getDownloadUrlForMyUniversity", null);
__decorate([
    (0, common_1.Patch)(':id/review'),
    (0, decorators_1.RequirePermissions)('document.review'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Verify or reject a document' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __param(3, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "reviewDocument", null);
__decorate([
    (0, common_1.Get)('entity/:entityType/:entityId'),
    (0, decorators_1.RequirePermissions)('document.view'),
    (0, swagger_1.ApiOperation)({ summary: 'List documents for a student/application/guarantor' }),
    __param(0, (0, common_1.Param)('entityType')),
    __param(1, (0, common_1.Param)('entityId', common_1.ParseUUIDPipe)),
    __param(2, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "getForEntity", null);
__decorate([
    (0, common_1.Get)('checklist/applications/:applicationId'),
    (0, decorators_1.RequirePermissions)('document.view'),
    (0, swagger_1.ApiOperation)({ summary: 'Get document completeness checklist for an application' }),
    __param(0, (0, common_1.Param)('applicationId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "getChecklist", null);
__decorate([
    (0, common_1.Get)('university-mine/checklist/applications/:applicationId'),
    (0, swagger_1.ApiOperation)({ summary: "Get a document checklist for one of the logged-in university portal user's own applications" }),
    __param(0, (0, common_1.Param)('applicationId', common_1.ParseUUIDPipe)),
    __param(1, (0, decorators_1.CurrentTenant)()),
    __param(2, (0, decorators_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], DocumentsController.prototype, "getChecklistForMyUniversity", null);
exports.DocumentsController = DocumentsController = __decorate([
    (0, swagger_1.ApiTags)('Documents'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, permissions_guard_1.PermissionsGuard),
    (0, common_1.Controller)('documents'),
    __metadata("design:paramtypes", [documents_service_1.DocumentsService])
], DocumentsController);
//# sourceMappingURL=documents.controller.js.map