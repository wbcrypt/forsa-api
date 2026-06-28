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
var MfaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MfaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const speakeasy = __importStar(require("speakeasy"));
const QRCode = __importStar(require("qrcode"));
const date_fns_1 = require("date-fns");
const encryption_util_1 = require("../../common/utils/encryption.util");
let MfaService = MfaService_1 = class MfaService {
    constructor(configService, dataSource) {
        this.configService = configService;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(MfaService_1.name);
    }
    generateTotpSecret(userEmail) {
        const secret = speakeasy.generateSecret({
            name: `${this.configService.get('mfa.issuer')} (${userEmail})`,
            length: 32,
        });
        return { secret: secret.base32, otpauthUrl: secret.otpauth_url || '' };
    }
    async generateQrCode(otpauthUrl) {
        return QRCode.toDataURL(otpauthUrl);
    }
    verifyTotp(secret, code) {
        return speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token: code,
            window: this.configService.get('mfa.totpWindow') || 1,
        });
    }
    encryptSecret(secret) {
        return (0, encryption_util_1.encrypt)(secret, this.configService.get('encryption.mfaKey'));
    }
    decryptSecret(encryptedSecret) {
        return (0, encryption_util_1.decrypt)(encryptedSecret, this.configService.get('encryption.mfaKey'));
    }
    async createMfaChallenge(userId) {
        const token = (0, encryption_util_1.generateSecureToken)(32);
        const tokenHash = (0, encryption_util_1.hashToken)(token);
        const expiresAt = (0, date_fns_1.addMinutes)(new Date(), 10);
        await this.dataSource.query(`INSERT INTO mfa_challenges (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`, [tokenHash, userId, expiresAt]);
        return token;
    }
    async verifyMfaChallenge(mfaToken, totpCode) {
        const tokenHash = (0, encryption_util_1.hashToken)(mfaToken);
        const [challenge] = await this.dataSource.query(`SELECT id, user_id FROM mfa_challenges
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`, [tokenHash]);
        if (!challenge)
            return null;
        const secret = await this.getUserMfaSecret(challenge.user_id);
        if (!secret)
            return null;
        const isValid = this.verifyTotp(secret, totpCode);
        if (!isValid)
            return null;
        await this.dataSource.query(`UPDATE mfa_challenges SET used_at = NOW() WHERE id = $1`, [challenge.id]);
        return challenge.user_id;
    }
    async enableMfa(userId, secret, verificationCode) {
        const isValid = this.verifyTotp(secret, verificationCode);
        if (!isValid)
            return false;
        const encryptedSecret = this.encryptSecret(secret);
        await this.dataSource.query(`INSERT INTO mfa_configs (user_id, method, secret_encrypted, is_primary, status, verified_at)
       VALUES ($1, 'totp', $2, true, 'active', NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET secret_encrypted = $2, status = 'active', verified_at = NOW()`, [userId, encryptedSecret]);
        await this.dataSource.query(`UPDATE users SET mfa_enabled = true WHERE id = $1`, [userId]);
        return true;
    }
    async disableMfa(userId) {
        await this.dataSource.query(`UPDATE mfa_configs SET status = 'disabled' WHERE user_id = $1`, [userId]);
        await this.dataSource.query(`UPDATE users SET mfa_enabled = false WHERE id = $1`, [userId]);
    }
    async getUserMfaSecret(userId) {
        const [config] = await this.dataSource.query(`SELECT secret_encrypted FROM mfa_configs
       WHERE user_id = $1 AND status = 'active' AND is_primary = true`, [userId]);
        if (!config)
            return null;
        return this.decryptSecret(config.secret_encrypted);
    }
};
exports.MfaService = MfaService;
exports.MfaService = MfaService = MfaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_2.DataSource])
], MfaService);
//# sourceMappingURL=mfa.service.js.map