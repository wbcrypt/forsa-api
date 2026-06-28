import { AppendOnlyEntity } from '../../common/entities/base.entity';
export declare class UserSession extends AppendOnlyEntity {
    userId: string;
    tenantId: string;
    sessionTokenHash: string;
    ipAddress: string;
    userAgent: string | null;
    deviceFingerprint: string | null;
    lastActiveAt: Date;
    expiresAt: Date;
    invalidatedAt: Date | null;
    invalidationReason: string | null;
    get isValid(): boolean;
}
