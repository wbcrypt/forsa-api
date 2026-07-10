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
var AuditInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditInterceptor = exports.AUDIT_ENTITY_KEY = exports.AUDIT_ACTION_KEY = void 0;
exports.AuditLog = AuditLog;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
exports.AUDIT_ACTION_KEY = 'audit_action';
exports.AUDIT_ENTITY_KEY = 'audit_entity';
function AuditLog(action, entity) {
    return function (target, key, descriptor) {
        Reflect.defineMetadata(exports.AUDIT_ACTION_KEY, action, descriptor.value);
        Reflect.defineMetadata(exports.AUDIT_ENTITY_KEY, entity, descriptor.value);
        return descriptor;
    };
}
let AuditInterceptor = AuditInterceptor_1 = class AuditInterceptor {
    constructor(reflector, dataSource) {
        this.reflector = reflector;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(AuditInterceptor_1.name);
    }
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const handler = context.getHandler();
        const action = this.reflector.get(exports.AUDIT_ACTION_KEY, handler);
        const entity = this.reflector.get(exports.AUDIT_ENTITY_KEY, handler);
        if (!action || !entity) {
            return next.handle();
        }
        const user = request.user;
        const tenantId = request.tenantId;
        return next.handle().pipe((0, operators_1.tap)({
            next: async (responseData) => {
                try {
                    await this.writeAuditLog({
                        tenantId,
                        userId: user?.id,
                        sessionId: user?.sessionId,
                        actionType: action,
                        module: entity.split('.')[0],
                        targetEntity: entity,
                        targetId: responseData?.id || request.params?.id,
                        newValue: this.sanitizeForAudit(responseData),
                        ipAddress: request.ip,
                        deviceFingerprint: request.headers['x-device-fingerprint'],
                        reason: request.body?.auditReason,
                    });
                }
                catch (err) {
                    this.logger.error('Audit log write failed', err);
                }
            },
            error: (err) => {
                this.logger.warn(`Action failed: ${action} on ${entity}`, {
                    userId: user?.id,
                    error: err.message,
                });
            },
        }));
    }
    sanitizeForAudit(data) {
        if (!data)
            return null;
        const sanitized = { ...data };
        const sensitiveFields = ['passwordHash', 'password', 'secretEncrypted', 'mfaSecret'];
        sensitiveFields.forEach(field => delete sanitized[field]);
        return sanitized;
    }
    async writeAuditLog(entry) {
        await this.dataSource.query(`INSERT INTO audit_logs
        (tenant_id, user_id, session_id, action_type, module, target_entity, target_id,
         previous_value, new_value, ip_address, device_fingerprint, reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())`, [
            entry.tenantId,
            entry.userId,
            entry.sessionId,
            entry.actionType,
            entry.module,
            entry.targetEntity,
            entry.targetId,
            entry.previousValue ? JSON.stringify(entry.previousValue) : null,
            entry.newValue ? JSON.stringify(entry.newValue) : null,
            entry.ipAddress,
            entry.deviceFingerprint,
            entry.reason,
        ]);
    }
};
exports.AuditInterceptor = AuditInterceptor;
exports.AuditInterceptor = AuditInterceptor = AuditInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [core_1.Reflector,
        typeorm_2.DataSource])
], AuditInterceptor);
//# sourceMappingURL=audit.interceptor.js.map