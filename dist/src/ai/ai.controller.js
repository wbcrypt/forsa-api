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
var AiController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiController = exports.AiScoreDto = exports.AiInterviewMessageDto = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const ai_service_1 = require("./ai.service");
const swagger_1 = require("@nestjs/swagger");
class AiInterviewMessageDto {
}
exports.AiInterviewMessageDto = AiInterviewMessageDto;
class AiScoreDto {
}
exports.AiScoreDto = AiScoreDto;
let AiController = AiController_1 = class AiController {
    constructor(aiService) {
        this.aiService = aiService;
        this.logger = new common_1.Logger(AiController_1.name);
    }
    async interview(dto) {
        try {
            return await this.aiService.chat(dto.messages, dto.system, dto.max_tokens);
        }
        catch (err) {
            this.logger.error('AI interview error:', err.message);
            throw new common_1.HttpException(err.message || 'AI service error', err.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async score(dto) {
        try {
            return await this.aiService.score(dto.prompt);
        }
        catch (err) {
            this.logger.error('AI score error:', err.message);
            throw new common_1.HttpException(err.message || 'AI service error', err.status || common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async demoInterview(dto) {
        return this.aiService.demoChat(dto.messages, dto.studentData);
    }
};
exports.AiController = AiController;
__decorate([
    (0, common_1.Post)('interview'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AiInterviewMessageDto]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "interview", null);
__decorate([
    (0, common_1.Post)('score'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AiScoreDto]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "score", null);
__decorate([
    (0, common_1.Post)('demo-interview'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiController.prototype, "demoInterview", null);
exports.AiController = AiController = AiController_1 = __decorate([
    (0, swagger_1.ApiTags)('AI'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('ai'),
    __metadata("design:paramtypes", [ai_service_1.AiService])
], AiController);
//# sourceMappingURL=ai.controller.js.map