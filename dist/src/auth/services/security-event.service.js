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
var SecurityEventService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityEventService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let SecurityEventService = SecurityEventService_1 = class SecurityEventService {
    constructor(dataSource) {
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(SecurityEventService_1.name);
    }
    async log(params) {
        try {
            await this.dataSource.query(`INSERT INTO security_events
          (tenant_id, user_id, session_id, event_type, severity,
           ip_address, user_agent, endpoint, details, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`, [
                params.tenantId || null,
                params.userId || null,
                params.sessionId || null,
                params.eventType,
                params.severity,
                params.ipAddress || null,
                params.userAgent || null,
                params.endpoint || null,
                params.details ? JSON.stringify(params.details) : null,
            ]);
            if (params.severity === 'critical' || params.severity === 'high') {
                this.logger.warn(`Security event: ${params.eventType}`, {
                    userId: params.userId,
                    tenantId: params.tenantId,
                    ip: params.ipAddress,
                    severity: params.severity,
                });
            }
        }
        catch (err) {
            this.logger.error('Failed to write security event', err);
        }
    }
};
exports.SecurityEventService = SecurityEventService;
exports.SecurityEventService = SecurityEventService = SecurityEventService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], SecurityEventService);
//# sourceMappingURL=security-event.service.js.map