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
Object.defineProperty(exports, "__esModule", { value: true });
exports.configuration = exports.configValidationSchema = void 0;
const Joi = __importStar(require("joi"));
exports.configValidationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('production'),
    PORT: Joi.number().default(3000),
    APP_URL: Joi.string().uri().required(),
    FRONTEND_URL: Joi.string().uri().required(),
    API_PREFIX: Joi.string().default('api/v1'),
    DB_HOST: Joi.string().required(),
    DB_PORT: Joi.number().default(5432),
    DB_NAME: Joi.string().required(),
    DB_APP_USER: Joi.string().required(),
    DB_APP_PASSWORD: Joi.string().min(20).required(),
    DB_SSL: Joi.boolean().default(true),
    DB_POOL_MIN: Joi.number().default(2),
    DB_POOL_MAX: Joi.number().default(20),
    JWT_ACCESS_SECRET: Joi.string().min(64).required(),
    JWT_REFRESH_SECRET: Joi.string().min(64).required(),
    JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
    JWT_REFRESH_EXPIRY: Joi.string().default('7d'),
    SESSION_COOKIE_NAME: Joi.string().default('forsa_session'),
    SESSION_COOKIE_SECURE: Joi.boolean().default(true),
    PII_ENCRYPTION_KEY: Joi.string().length(64).required(),
    MFA_ENCRYPTION_KEY: Joi.string().length(64).required(),
    CURRENT_PII_KEY_VERSION: Joi.string().required(),
    S3_ENDPOINT: Joi.string().uri().required(),
    S3_REGION: Joi.string().required(),
    S3_BUCKET_NAME: Joi.string().required(),
    S3_ACCESS_KEY_ID: Joi.string().required(),
    S3_SECRET_ACCESS_KEY: Joi.string().required(),
    S3_SIGNED_URL_EXPIRY_SECONDS: Joi.number().default(300),
    REDIS_HOST: Joi.string().required(),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().required(),
    SMTP_HOST: Joi.string().required(),
    SMTP_PORT: Joi.number().default(587),
    SMTP_USER: Joi.string().email().required(),
    SMTP_PASSWORD: Joi.string().required(),
    SMTP_FROM_EMAIL: Joi.string().email().required(),
    BCRYPT_ROUNDS: Joi.number().min(10).max(14).default(12),
    MAX_LOGIN_ATTEMPTS: Joi.number().default(5),
    ACCOUNT_LOCKOUT_MINUTES: Joi.number().default(30),
    CORS_ORIGINS: Joi.string().required(),
    BOOTSTRAP_ADMIN_EMAIL: Joi.string().email().optional(),
    BOOTSTRAP_ADMIN_PASSWORD: Joi.string().min(12).optional(),
    BOOTSTRAP_TENANT_NAME: Joi.string().optional(),
    BOOTSTRAP_TENANT_SLUG: Joi.string().optional(),
    BOOTSTRAP_TENANT_COUNTRY: Joi.string().length(2).optional(),
    BOOTSTRAP_TENANT_CURRENCY: Joi.string().length(3).optional(),
});
const configuration = () => ({
    env: process.env.NODE_ENV,
    port: parseInt(process.env.PORT || '3000', 10),
    appUrl: process.env.APP_URL,
    frontendUrl: process.env.FRONTEND_URL,
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        name: process.env.DB_NAME,
        appUser: process.env.DB_APP_USER,
        appPassword: process.env.DB_APP_PASSWORD,
        ssl: process.env.DB_SSL === 'true',
        poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
        poolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),
    },
    jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
        refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    },
    session: {
        cookieName: process.env.SESSION_COOKIE_NAME || 'forsa_session',
        cookieSecure: process.env.SESSION_COOKIE_SECURE !== 'false',
        cookieSameSite: process.env.SESSION_COOKIE_SAMESITE || 'strict',
        absoluteTimeoutHours: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS || '12', 10),
        idleTimeoutMinutes: parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES || '60', 10),
    },
    encryption: {
        piiKey: process.env.PII_ENCRYPTION_KEY,
        mfaKey: process.env.MFA_ENCRYPTION_KEY,
        piiKeyVersion: process.env.CURRENT_PII_KEY_VERSION || 'pii_v1',
        ivLength: parseInt(process.env.PII_ENCRYPTION_IV_LENGTH || '16', 10),
    },
    s3: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        bucket: process.env.S3_BUCKET_NAME,
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        signedUrlExpiry: parseInt(process.env.S3_SIGNED_URL_EXPIRY_SECONDS || '300', 10),
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    },
    konnect: {
        apiKey: process.env.KONNECT_API_KEY,
        walletId: process.env.KONNECT_WALLET_ID,
        baseUrl: process.env.KONNECT_BASE_URL || 'https://api.preprod.konnect.network/api/v2',
        webhookSecret: process.env.KONNECT_WEBHOOK_SECRET,
        appName: process.env.KONNECT_APP_NAME || 'FORSA',
        returnUrl: process.env.KONNECT_RETURN_URL || 'https://student.forsa.tn/payments',
    },
    ai: {
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        demoMode: process.env.AI_DEMO_MODE === 'true' || !process.env.ANTHROPIC_API_KEY,
    },
    redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === 'true',
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'forsa:',
    },
    email: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASSWORD,
        fromName: process.env.SMTP_FROM_NAME || 'FORSA OS',
        fromEmail: process.env.SMTP_FROM_EMAIL,
    },
    security: {
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
        lockoutMinutes: parseInt(process.env.ACCOUNT_LOCKOUT_MINUTES || '30', 10),
        corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()),
        passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '12', 10),
    },
    throttle: {
        ttl: parseInt(process.env.THROTTLE_TTL_SECONDS || '60', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
        loginTtl: parseInt(process.env.LOGIN_THROTTLE_TTL_SECONDS || '900', 10),
        loginLimit: parseInt(process.env.LOGIN_THROTTLE_LIMIT || '5', 10),
    },
    mfa: {
        issuer: process.env.MFA_ISSUER || 'FORSA OS',
        totpWindow: parseInt(process.env.MFA_TOTP_WINDOW || '1', 10),
        required: process.env.FEATURE_MFA_REQUIRED === 'true',
    },
    bootstrap: {
        adminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL,
        adminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
        tenantName: process.env.BOOTSTRAP_TENANT_NAME,
        tenantSlug: process.env.BOOTSTRAP_TENANT_SLUG,
        tenantCountry: process.env.BOOTSTRAP_TENANT_COUNTRY,
        tenantCurrency: process.env.BOOTSTRAP_TENANT_CURRENCY,
    },
    features: {
        mfaRequired: process.env.FEATURE_MFA_REQUIRED === 'true',
        whatsappNotifications: process.env.FEATURE_WHATSAPP_NOTIFICATIONS === 'true',
        aiDocumentVerification: process.env.FEATURE_AI_DOCUMENT_VERIFICATION === 'true',
        studentPortal: process.env.FEATURE_STUDENT_PORTAL === 'true',
        partnerPortal: process.env.FEATURE_PARTNER_PORTAL === 'true',
    },
});
exports.configuration = configuration;
//# sourceMappingURL=configuration.js.map