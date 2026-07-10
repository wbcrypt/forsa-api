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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const argon2 = __importStar(require("argon2"));
const uuid_1 = require("uuid");
const date_fns_1 = require("date-fns");
const user_entity_1 = require("../users/entities/user.entity");
const user_session_entity_1 = require("../users/entities/user-session.entity");
const enums_1 = require("../common/enums");
const encryption_util_1 = require("../common/utils/encryption.util");
const password_util_1 = require("../common/utils/password.util");
const security_event_service_1 = require("./services/security-event.service");
const mfa_service_1 = require("./services/mfa.service");
let AuthService = AuthService_1 = class AuthService {
    constructor(userRepository, sessionRepository, jwtService, configService, dataSource, securityEventService, mfaService) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
        this.jwtService = jwtService;
        this.configService = configService;
        this.dataSource = dataSource;
        this.securityEventService = securityEventService;
        this.mfaService = mfaService;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async validateCredentials(email, password, tenantId) {
        const user = await this.userRepository.findOne({
            where: { email: email.toLowerCase(), tenantId },
        });
        if (!user) {
            await argon2.verify('$argon2id$v=19$m=65536,t=3,p=4$dummy$dummyhashfortimingprotection', password).catch(() => { });
            return null;
        }
        if (user.isLocked) {
            throw new common_1.UnauthorizedException('Account is temporarily locked. Please try again later.');
        }
        if (user.status === enums_1.UserStatus.DEACTIVATED) {
            throw new common_1.UnauthorizedException('Account has been deactivated.');
        }
        if (user.status === enums_1.UserStatus.SUSPENDED) {
            throw new common_1.UnauthorizedException('Account is suspended. Contact support.');
        }
        const isPasswordValid = await argon2.verify(user.passwordHash, password);
        if (!isPasswordValid) {
            await this.handleFailedLogin(user);
            return null;
        }
        if (user.failedLoginAttempts > 0) {
            await this.userRepository.update(user.id, {
                failedLoginAttempts: 0,
                lockedUntil: null,
            });
        }
        return user;
    }
    async login(loginDto, ipAddress, userAgent) {
        const user = await this.validateCredentials(loginDto.email, loginDto.password, loginDto.tenantId);
        if (!user) {
            await this.securityEventService.log({
                eventType: enums_1.SecurityEventType.LOGIN_FAILURE,
                severity: 'warning',
                ipAddress,
                userAgent,
                details: { email: loginDto.email, tenantId: loginDto.tenantId },
            });
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (user.mfaEnabled) {
            const mfaToken = await this.mfaService.createMfaChallenge(user.id);
            await this.securityEventService.log({
                tenantId: user.tenantId,
                userId: user.id,
                eventType: enums_1.SecurityEventType.LOGIN_SUCCESS,
                severity: 'info',
                ipAddress,
                userAgent,
                details: { mfaRequired: true },
            });
            return {
                accessToken: '',
                refreshToken: '',
                expiresIn: 0,
                requiresMfa: true,
                mfaToken,
            };
        }
        return this.createSession(user, ipAddress, userAgent);
    }
    async verifyMfaAndLogin(dto, ipAddress, userAgent) {
        const userId = await this.mfaService.verifyMfaChallenge(dto.mfaToken, dto.code);
        if (!userId) {
            await this.securityEventService.log({
                eventType: enums_1.SecurityEventType.MFA_FAILURE,
                severity: 'warning',
                ipAddress,
                userAgent,
            });
            throw new common_1.UnauthorizedException('Invalid or expired MFA code');
        }
        const user = await this.userRepository.findOneOrFail({
            where: { id: userId },
        });
        await this.securityEventService.log({
            tenantId: user.tenantId,
            userId: user.id,
            eventType: enums_1.SecurityEventType.MFA_SUCCESS,
            severity: 'info',
            ipAddress,
            userAgent,
        });
        return this.createSession(user, ipAddress, userAgent);
    }
    async refreshTokens(dto, _ipAddress) {
        let payload;
        try {
            payload = this.jwtService.verify(dto.refreshToken, {
                secret: this.configService.get('jwt.refreshSecret'),
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
        const session = await this.sessionRepository.findOne({
            where: { id: payload.sessionId },
        });
        if (!session || !session.isValid) {
            throw new common_1.UnauthorizedException('Session has been invalidated');
        }
        await this.dataSource.query('UPDATE user_sessions SET last_active_at = NOW() WHERE id = $1', [session.id]);
        const user = await this.userRepository.findOneOrFail({
            where: { id: payload.sub },
        });
        const permissions = await this.getUserPermissions(user.id, user.tenantId);
        const accessToken = await this.generateAccessToken(user, session.id, permissions);
        const refreshToken = await this.generateRefreshToken(user, session.id);
        return {
            accessToken,
            refreshToken,
            expiresIn: 900,
        };
    }
    async setPassword(rawToken, newPassword) {
        (0, password_util_1.validatePasswordComplexity)(newPassword);
        const tokenHash = (0, encryption_util_1.hashToken)(rawToken);
        const [tokenRow] = await this.dataSource.query(`SELECT id, user_id, tenant_id, used_at, expires_at FROM password_setup_tokens
       WHERE token_hash = $1`, [tokenHash]);
        if (!tokenRow) {
            throw new common_1.BadRequestException('This set-password link is invalid. Please use the link from your email, or contact support for a new one.');
        }
        if (tokenRow.used_at) {
            throw new common_1.BadRequestException('This link has already been used to set your password. If you already completed this step, please log in instead.');
        }
        if (new Date(tokenRow.expires_at) <= new Date()) {
            throw new common_1.BadRequestException('This set-password link has expired. Please contact support for a new one.');
        }
        const passwordHash = await (0, password_util_1.hashPassword)(newPassword);
        await this.dataSource.transaction(async (manager) => {
            await manager.query(`UPDATE users
         SET password_hash = $2, must_change_password = false,
             status = $3, email_verified = true, password_changed_at = NOW()
         WHERE id = $1`, [tokenRow.user_id, passwordHash, enums_1.UserStatus.ACTIVE]);
            await manager.query(`UPDATE password_setup_tokens SET used_at = NOW() WHERE id = $1`, [tokenRow.id]);
        });
    }
    async logout(sessionId, userId, ipAddress) {
        await this.dataSource.query(`UPDATE user_sessions
       SET invalidated_at = NOW(), invalidation_reason = 'logout'
       WHERE id = $1 AND user_id = $2 AND invalidated_at IS NULL`, [sessionId, userId]);
        await this.securityEventService.log({
            userId,
            eventType: enums_1.SecurityEventType.SESSION_INVALIDATED,
            severity: 'info',
            ipAddress,
            details: { sessionId, reason: 'logout' },
        });
    }
    async logoutAll(userId, _currentSessionId) {
        await this.dataSource.query(`UPDATE user_sessions
       SET invalidated_at = NOW(), invalidation_reason = 'logout'
       WHERE user_id = $1 AND invalidated_at IS NULL`, [userId]);
    }
    async hashPassword(password) {
        return argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
        });
    }
    async getUserPermissions(userId, tenantId) {
        const rows = await this.dataSource.query(`SELECT DISTINCT p.code
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.tenant_id = $2
         AND (ur.effective_until IS NULL OR ur.effective_until > CURRENT_DATE)
         AND ur.revoked_at IS NULL`, [userId, tenantId]);
        return rows.map(r => r.code);
    }
    async validateJwtPayload(payload) {
        const session = await this.sessionRepository.findOne({
            where: { id: payload.sessionId },
        });
        if (!session || !session.isValid) {
            return null;
        }
        const idleTimeoutMinutes = this.configService.get('session.idleTimeoutMinutes') || 60;
        const idleDeadline = (0, date_fns_1.addMinutes)(session.lastActiveAt, idleTimeoutMinutes);
        if (new Date() > idleDeadline) {
            await this.dataSource.query(`UPDATE user_sessions SET invalidated_at = NOW(), invalidation_reason = 'expired'
         WHERE id = $1`, [session.id]);
            return null;
        }
        const oneMinuteAgo = (0, date_fns_1.addMinutes)(new Date(), -1);
        if (session.lastActiveAt < oneMinuteAgo) {
            await this.dataSource.query('UPDATE user_sessions SET last_active_at = NOW() WHERE id = $1', [session.id]);
        }
        return {
            id: payload.sub,
            email: payload.email,
            tenantId: payload.tenantId,
            sessionId: payload.sessionId,
            permissions: payload.permissions,
        };
    }
    async createSession(user, ipAddress, userAgent) {
        const permissions = await this.getUserPermissions(user.id, user.tenantId);
        const sessionId = (0, uuid_1.v4)();
        const absoluteTimeoutHours = this.configService.get('session.absoluteTimeoutHours') || 12;
        const rawRefreshToken = (0, encryption_util_1.generateSecureToken)(48);
        const tokenHash = (0, encryption_util_1.hashToken)(rawRefreshToken);
        await this.dataSource.query(`INSERT INTO user_sessions
        (id, user_id, tenant_id, session_token_hash, ip_address, user_agent,
         last_active_at, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, NOW())`, [
            sessionId,
            user.id,
            user.tenantId,
            tokenHash,
            ipAddress,
            userAgent,
            (0, date_fns_1.addHours)(new Date(), absoluteTimeoutHours),
        ]);
        await this.userRepository.update(user.id, {
            lastLoginAt: new Date(),
            status: enums_1.UserStatus.ACTIVE,
        });
        await this.securityEventService.log({
            tenantId: user.tenantId,
            userId: user.id,
            eventType: enums_1.SecurityEventType.LOGIN_SUCCESS,
            severity: 'info',
            ipAddress,
            userAgent,
            details: { sessionId },
        });
        const accessToken = await this.generateAccessToken(user, sessionId, permissions);
        const refreshToken = await this.generateRefreshToken(user, sessionId);
        return {
            accessToken,
            refreshToken,
            expiresIn: 900,
        };
    }
    async generateAccessToken(user, sessionId, permissions) {
        const payload = {
            sub: user.id,
            email: user.email,
            tenantId: user.tenantId,
            sessionId,
            permissions,
        };
        return this.jwtService.sign(payload);
    }
    async generateRefreshToken(user, sessionId) {
        return this.jwtService.sign({
            sub: user.id,
            tenantId: user.tenantId,
            sessionId,
            type: 'refresh',
        }, {
            secret: this.configService.get('jwt.refreshSecret'),
            expiresIn: this.configService.get('jwt.refreshExpiry') || '7d',
        });
    }
    async handleFailedLogin(user) {
        const maxAttempts = this.configService.get('security.maxLoginAttempts') || 5;
        const lockoutMinutes = this.configService.get('security.lockoutMinutes') || 30;
        const newAttempts = user.failedLoginAttempts + 1;
        const update = { failedLoginAttempts: newAttempts };
        if (newAttempts >= maxAttempts) {
            update.lockedUntil = (0, date_fns_1.addMinutes)(new Date(), lockoutMinutes);
            await this.securityEventService.log({
                tenantId: user.tenantId,
                userId: user.id,
                eventType: enums_1.SecurityEventType.ACCOUNT_LOCKED,
                severity: 'high',
                details: { attempts: newAttempts, lockedUntil: update.lockedUntil },
            });
        }
        await this.userRepository.update(user.id, update);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(user_session_entity_1.UserSession)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService,
        config_1.ConfigService,
        typeorm_2.DataSource,
        security_event_service_1.SecurityEventService,
        mfa_service_1.MfaService])
], AuthService);
//# sourceMappingURL=auth.service.js.map