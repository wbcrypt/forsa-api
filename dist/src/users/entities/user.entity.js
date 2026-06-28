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
exports.User = void 0;
const typeorm_1 = require("typeorm");
const class_transformer_1 = require("class-transformer");
const base_entity_1 = require("../../common/entities/base.entity");
const enums_1 = require("../../common/enums");
let User = class User extends base_entity_1.TenantScopedEntity {
    get isActive() {
        return this.status === enums_1.UserStatus.ACTIVE;
    }
    get isLocked() {
        return this.lockedUntil != null && this.lockedUntil > new Date();
    }
};
exports.User = User;
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, name: 'email' }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', name: 'email_verified', default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "emailVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', name: 'password_hash' }),
    (0, class_transformer_1.Exclude)(),
    __metadata("design:type", String)
], User.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, name: 'full_name' }),
    __metadata("design:type", String)
], User.prototype, "fullName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        name: 'status',
        default: enums_1.UserStatus.PENDING_VERIFICATION,
        enum: Object.values(enums_1.UserStatus),
    }),
    __metadata("design:type", String)
], User.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', name: 'mfa_enabled', default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "mfaEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', name: 'failed_login_attempts', default: 0 }),
    (0, class_transformer_1.Exclude)(),
    __metadata("design:type", Number)
], User.prototype, "failedLoginAttempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', name: 'locked_until', nullable: true }),
    (0, class_transformer_1.Exclude)(),
    __metadata("design:type", Date)
], User.prototype, "lockedUntil", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', name: 'last_login_at', nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "lastLoginAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'timestamptz',
        name: 'password_changed_at',
        default: () => 'NOW()',
    }),
    (0, class_transformer_1.Exclude)(),
    __metadata("design:type", Date)
], User.prototype, "passwordChangedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', name: 'must_change_password', default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "mustChangePassword", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', name: 'created_by', nullable: true }),
    __metadata("design:type", String)
], User.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', name: 'deactivated_by', nullable: true }),
    __metadata("design:type", String)
], User.prototype, "deactivatedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', name: 'deactivated_at', nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "deactivatedAt", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('users'),
    (0, typeorm_1.Index)(['tenantId', 'email'], { unique: true }),
    (0, typeorm_1.Index)(['tenantId', 'status'])
], User);
//# sourceMappingURL=user.entity.js.map