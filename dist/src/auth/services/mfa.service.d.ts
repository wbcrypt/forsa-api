import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
export declare class MfaService {
    private readonly configService;
    private readonly dataSource;
    private readonly logger;
    constructor(configService: ConfigService, dataSource: DataSource);
    generateTotpSecret(userEmail: string): {
        secret: string;
        otpauthUrl: string;
    };
    generateQrCode(otpauthUrl: string): Promise<string>;
    verifyTotp(secret: string, code: string): boolean;
    encryptSecret(secret: string): string;
    decryptSecret(encryptedSecret: string): string;
    createMfaChallenge(userId: string): Promise<string>;
    verifyMfaChallenge(mfaToken: string, totpCode: string): Promise<string | null>;
    enableMfa(userId: string, secret: string, verificationCode: string): Promise<boolean>;
    disableMfa(userId: string): Promise<void>;
    getUserMfaSecret(userId: string): Promise<string | null>;
}
