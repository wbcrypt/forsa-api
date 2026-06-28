import * as Joi from 'joi';
export declare const configValidationSchema: Joi.ObjectSchema<any>;
export declare const configuration: () => {
    env: string;
    port: number;
    appUrl: string;
    frontendUrl: string;
    apiPrefix: string;
    database: {
        host: string;
        port: number;
        name: string;
        appUser: string;
        appPassword: string;
        ssl: boolean;
        poolMin: number;
        poolMax: number;
    };
    jwt: {
        accessSecret: string;
        refreshSecret: string;
        accessExpiry: string;
        refreshExpiry: string;
    };
    session: {
        cookieName: string;
        cookieSecure: boolean;
        cookieSameSite: string;
        absoluteTimeoutHours: number;
        idleTimeoutMinutes: number;
    };
    encryption: {
        piiKey: string;
        mfaKey: string;
        piiKeyVersion: string;
        ivLength: number;
    };
    s3: {
        endpoint: string;
        region: string;
        bucket: string;
        accessKeyId: string;
        secretAccessKey: string;
        signedUrlExpiry: number;
        forcePathStyle: boolean;
    };
    konnect: {
        apiKey: string;
        walletId: string;
        baseUrl: string;
        webhookSecret: string;
        appName: string;
        returnUrl: string;
    };
    ai: {
        anthropicApiKey: string;
        demoMode: boolean;
    };
    redis: {
        host: string;
        port: number;
        password: string;
        tls: boolean;
        keyPrefix: string;
    };
    email: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        password: string;
        fromName: string;
        fromEmail: string;
    };
    security: {
        bcryptRounds: number;
        maxLoginAttempts: number;
        lockoutMinutes: number;
        corsOrigins: string[];
        passwordMinLength: number;
    };
    throttle: {
        ttl: number;
        limit: number;
        loginTtl: number;
        loginLimit: number;
    };
    mfa: {
        issuer: string;
        totpWindow: number;
        required: boolean;
    };
    bootstrap: {
        adminEmail: string;
        adminPassword: string;
        tenantName: string;
        tenantSlug: string;
        tenantCountry: string;
        tenantCurrency: string;
    };
    features: {
        mfaRequired: boolean;
        whatsappNotifications: boolean;
        aiDocumentVerification: boolean;
        studentPortal: boolean;
        partnerPortal: boolean;
    };
};
