"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const argon2 = __importStar(require("argon2"));
const user_entity_1 = require("./entities/user.entity");
const enums_1 = require("../common/enums");
const pagination_util_1 = require("../common/utils/pagination.util");
let UsersService = UsersService_1 = class UsersService {
    constructor(userRepository, dataSource, configService) {
        this.userRepository = userRepository;
        this.dataSource = dataSource;
        this.configService = configService;
        this.logger = new common_1.Logger(UsersService_1.name);
    }
    async create(dto, tenantId, createdBy) {
        const existing = await this.userRepository.findOne({
            where: { email: dto.email.toLowerCase(), tenantId },
        });
        if (existing) {
            throw new common_1.ConflictException('A user with this email already exists');
        }
        this.validatePasswordComplexity(dto.password);
        const passwordHash = await this.hashPassword(dto.password);
        const user = this.userRepository.create({
            tenantId,
            email: dto.email.toLowerCase().trim(),
            passwordHash,
            fullName: dto.fullName,
            status: enums_1.UserStatus.PENDING_VERIFICATION,
            createdBy,
            mustChangePassword: dto.mustChangePassword ?? true,
        });
        const saved = await this.userRepository.save(user);
        if (dto.roleIds?.length) {
            for (const roleId of dto.roleIds) {
                await this.dataSource.query(`INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT DO NOTHING`, [saved.id, roleId, createdBy]);
            }
        }
        await this.writeAuditLog({
            tenantId,
            userId: createdBy,
            actionType: 'user.created',
            targetId: saved.id,
            newValue: { email: saved.email, fullName: saved.fullName },
        });
        return saved;
    }
    async findAll(tenantId, pagination) {
        const { page = 1, limit = 20 } = pagination;
        const [data, total] = await this.userRepository.findAndCount({
            where: { tenantId },
            select: ['id', 'email', 'fullName', 'status', 'mfaEnabled', 'lastLoginAt', 'createdAt'],
            order: { createdAt: 'DESC' },
            take: limit,
            skip: (0, pagination_util_1.getSkip)(page, limit),
        });
        return (0, pagination_util_1.paginate)(data, total, page, limit);
    }
    async findOne(id, tenantId) {
        const user = await this.userRepository.findOne({
            where: { id, tenantId },
            select: ['id', 'email', 'fullName', 'status', 'mfaEnabled', 'lastLoginAt', 'createdAt', 'emailVerified'],
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async findByEmail(email, tenantId) {
        return this.userRepository.findOne({
            where: { email: email.toLowerCase(), tenantId },
        });
    }
    async update(id, tenantId, dto, updatedBy) {
        const user = await this.findOne(id, tenantId);
        const previous = { fullName: user.fullName, status: user.status };
        if (dto.fullName)
            user.fullName = dto.fullName;
        if (dto.status)
            user.status = dto.status;
        const updated = await this.userRepository.save(user);
        await this.writeAuditLog({
            tenantId,
            userId: updatedBy,
            actionType: 'user.updated',
            targetId: id,
            previousValue: previous,
            newValue: { fullName: updated.fullName, status: updated.status },
        });
        return updated;
    }
    async deactivate(id, tenantId, deactivatedBy, reason) {
        await this.findOne(id, tenantId);
        if (id === deactivatedBy) {
            throw new common_1.BadRequestException('Cannot deactivate your own account');
        }
        await this.userRepository.update(id, {
            status: enums_1.UserStatus.DEACTIVATED,
            deactivatedBy,
            deactivatedAt: new Date(),
        });
        await this.dataSource.query(`UPDATE user_sessions SET invalidated_at = NOW(), invalidation_reason = 'admin_revoke'
       WHERE user_id = $1 AND invalidated_at IS NULL`, [id]);
        await this.writeAuditLog({
            tenantId,
            userId: deactivatedBy,
            actionType: 'user.deactivated',
            targetId: id,
            reason,
        });
    }
    async changePassword(userId, tenantId, currentPassword, newPassword) {
        const user = await this.userRepository.findOne({ where: { id: userId, tenantId } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const isValid = await argon2.verify(user.passwordHash, currentPassword);
        if (!isValid)
            throw new common_1.BadRequestException('Current password is incorrect');
        this.validatePasswordComplexity(newPassword);
        if (await argon2.verify(user.passwordHash, newPassword)) {
            throw new common_1.BadRequestException('New password must be different from current password');
        }
        const newHash = await this.hashPassword(newPassword);
        await this.userRepository.update(userId, {
            passwordHash: newHash,
            passwordChangedAt: new Date(),
            mustChangePassword: false,
        });
        await this.dataSource.query(`UPDATE user_sessions SET invalidated_at = NOW(), invalidation_reason = 'password_change'
       WHERE user_id = $1 AND invalidated_at IS NULL`, [userId]);
    }
    async getUserRolesAndPermissions(userId, tenantId) {
        await this.findOne(userId, tenantId);
        const roles = await this.dataSource.query(`SELECT r.id, r.name, r.description
       FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1 AND r.tenant_id = $2
         AND (ur.effective_until IS NULL OR ur.effective_until > CURRENT_DATE)
         AND ur.revoked_at IS NULL`, [userId, tenantId]);
        const permissions = await this.dataSource.query(`SELECT DISTINCT p.code, p.module, p.action, p.is_high_impact
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.tenant_id = $2
         AND (ur.effective_until IS NULL OR ur.effective_until > CURRENT_DATE)
         AND ur.revoked_at IS NULL`, [userId, tenantId]);
        return { roles, permissions };
    }
    async assignRole(userId, roleId, tenantId, assignedBy) {
        const [, role] = await Promise.all([
            this.findOne(userId, tenantId),
            this.dataSource.query(`SELECT id FROM roles WHERE id = $1 AND tenant_id = $2`, [roleId, tenantId]),
        ]);
        if (!role.length)
            throw new common_1.NotFoundException('Role not found');
        await this.dataSource.query(`INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, role_id, effective_from) DO NOTHING`, [userId, roleId, assignedBy]);
        await this.writeAuditLog({
            tenantId,
            userId: assignedBy,
            actionType: 'user.role.assigned',
            targetId: userId,
            newValue: { roleId },
        });
    }
    async revokeRole(userId, roleId, tenantId, revokedBy, reason) {
        await this.dataSource.query(`UPDATE user_roles
       SET revoked_by = $3, revoked_at = NOW(), revocation_reason = $4
       WHERE user_id = $1 AND role_id = $2 AND revoked_at IS NULL`, [userId, roleId, revokedBy, reason]);
        await this.writeAuditLog({
            tenantId,
            userId: revokedBy,
            actionType: 'user.role.revoked',
            targetId: userId,
            newValue: { roleId, reason },
        });
    }
    async hashPassword(password) {
        const rounds = this.configService.get('security.bcryptRounds') || 12;
        return argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: rounds >= 12 ? 3 : 2,
            parallelism: 4,
        });
    }
    validatePasswordComplexity(password) {
        const minLength = this.configService.get('security.passwordMinLength') || 12;
        if (password.length < minLength) {
            throw new common_1.BadRequestException(`Password must be at least ${minLength} characters`);
        }
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasDigit = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
        if (!hasUppercase || !hasLowercase || !hasDigit || !hasSpecial) {
            throw new common_1.BadRequestException('Password must contain uppercase, lowercase, digit, and special character');
        }
    }
    async writeAuditLog(entry) {
        await this.dataSource.query(`INSERT INTO audit_logs
        (tenant_id, user_id, action_type, module, target_entity, target_id,
         previous_value, new_value, reason, created_at)
       VALUES ($1,$2,$3,'users','users',$4,$5,$6,$7,NOW())`, [
            entry.tenantId,
            entry.userId,
            entry.actionType,
            entry.targetId,
            entry.previousValue ? JSON.stringify(entry.previousValue) : null,
            entry.newValue ? JSON.stringify(entry.newValue) : null,
            entry.reason || null,
        ]).catch(err => this.logger.error('Audit log failed', err));
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        config_1.ConfigService])
], UsersService);
//# sourceMappingURL=users.service.js.map