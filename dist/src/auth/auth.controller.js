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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("./auth.service");
const mfa_service_1 = require("./services/mfa.service");
const login_dto_1 = require("./dto/login.dto");
const refresh_token_dto_1 = require("./dto/refresh-token.dto");
const verify_mfa_dto_1 = require("./dto/verify-mfa.dto");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const decorators_1 = require("../common/decorators");
let AuthController = class AuthController {
    constructor(authService, mfaService, configService) {
        this.authService = authService;
        this.mfaService = mfaService;
        this.configService = configService;
    }
    async login(loginDto, response, ipAddress, userAgent) {
        const tokens = await this.authService.login(loginDto, ipAddress, userAgent);
        if (tokens.requiresMfa) {
            return {
                requiresMfa: true,
                mfaToken: tokens.mfaToken,
                message: 'MFA verification required',
            };
        }
        this.setAuthCookie(response, tokens.accessToken);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: 'Bearer',
        };
    }
    async verifyMfa(dto, response, ipAddress, userAgent) {
        const tokens = await this.authService.verifyMfaAndLogin(dto, ipAddress, userAgent);
        this.setAuthCookie(response, tokens.accessToken);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: 'Bearer',
        };
    }
    async refresh(dto, response, ipAddress) {
        const tokens = await this.authService.refreshTokens(dto, ipAddress);
        this.setAuthCookie(response, tokens.accessToken);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: 'Bearer',
        };
    }
    async logout(user, response, ipAddress) {
        await this.authService.logout(user.sessionId, user.id, ipAddress);
        this.clearAuthCookie(response);
        return { message: 'Logged out successfully' };
    }
    async logoutAll(user, response) {
        await this.authService.logoutAll(user.id, user.sessionId);
        this.clearAuthCookie(response);
        return { message: 'All sessions logged out' };
    }
    async getMe(user) {
        return {
            id: user.id,
            email: user.email,
            tenantId: user.tenantId,
            permissions: user.permissions,
        };
    }
    async getMfaSetup(user) {
        const { secret, otpauthUrl } = this.mfaService.generateTotpSecret(user.email);
        const qrCode = await this.mfaService.generateQrCode(otpauthUrl);
        return {
            secret,
            qrCode,
            message: 'Scan QR code with your authenticator app, then verify with POST /auth/mfa/enable',
        };
    }
    async enableMfa(user, body) {
        const success = await this.mfaService.enableMfa(user.id, body.secret, body.code);
        if (!success) {
            return { success: false, message: 'Invalid verification code' };
        }
        return { success: true, message: 'MFA enabled successfully' };
    }
    setAuthCookie(response, token) {
        const cookieName = this.configService.get('session.cookieName') || 'forsa_session';
        const isSecure = this.configService.get('session.cookieSecure') !== false;
        response.cookie(cookieName, token, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000,
            path: '/',
        });
    }
    clearAuthCookie(response) {
        const cookieName = this.configService.get('session.cookieName') || 'forsa_session';
        response.clearCookie(cookieName, { path: '/' });
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)({ default: { ttl: 900000, limit: 5 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Login with email and password' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Login successful or MFA required' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid credentials' }),
    (0, swagger_1.ApiResponse)({ status: 429, description: 'Too many login attempts' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, decorators_1.ClientIp)()),
    __param(3, (0, decorators_1.UserAgent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object, String, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('mfa/verify'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)({ default: { ttl: 300000, limit: 10 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Verify MFA code and complete login' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, decorators_1.ClientIp)()),
    __param(3, (0, decorators_1.UserAgent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_mfa_dto_1.VerifyMfaDto, Object, String, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyMfa", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh access token' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, decorators_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [refresh_token_dto_1.RefreshTokenDto, Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Logout current session' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, decorators_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('logout-all'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Logout all sessions' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logoutAll", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user information' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getMe", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('mfa/setup'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get MFA setup QR code' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getMfaSetup", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('mfa/enable'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Enable MFA after verifying TOTP setup' }),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "enableMfa", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Authentication'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        mfa_service_1.MfaService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map