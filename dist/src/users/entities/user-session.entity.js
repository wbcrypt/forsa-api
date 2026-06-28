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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSession = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("../../common/entities/base.entity");
let UserSession = class UserSession extends base_entity_1.AppendOnlyEntity {
    get isValid() {
        return !this.invalidatedAt && this.expiresAt > new Date();
    }
};
exports.UserSession = UserSession;
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', name: 'user_id' }),
    __metadata("design:type", String)
], UserSession.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', name: 'tenant_id' }),
    __metadata("design:type", String)
], UserSession.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', name: 'session_token_hash', unique: true }),
    __metadata("design:type", String)
], UserSession.prototype, "sessionTokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'inet', name: 'ip_address' }),
    __metadata("design:type", String)
], UserSession.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', name: 'user_agent', nullable: true }),
    __metadata("design:type", String)
], UserSession.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', name: 'device_fingerprint', nullable: true }),
    __metadata("design:type", String)
], UserSession.prototype, "deviceFingerprint", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', name: 'last_active_at' }),
    __metadata("design:type", Date)
], UserSession.prototype, "lastActiveAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', name: 'expires_at' }),
    __metadata("design:type", Date)
], UserSession.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', name: 'invalidated_at', nullable: true }),
    __metadata("design:type", Date)
], UserSession.prototype, "invalidatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, name: 'invalidation_reason', nullable: true }),
    __metadata("design:type", String)
], UserSession.prototype, "invalidationReason", void 0);
exports.UserSession = UserSession = __decorate([
    (0, typeorm_1.Entity)('user_sessions'),
    (0, typeorm_1.Index)(['sessionTokenHash'], { unique: true }),
    (0, typeorm_1.Index)(['userId'])
], UserSession);
//# sourceMappingURL=user-session.entity.js.map