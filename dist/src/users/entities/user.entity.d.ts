import { TenantScopedEntity } from '../../common/entities/base.entity';
import { UserStatus } from '../../common/enums';
export declare class User extends TenantScopedEntity {
    email: string;
    emailVerified: boolean;
    passwordHash: string;
    fullName: string;
    status: UserStatus;
    mfaEnabled: boolean;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
    lastLoginAt: Date | null;
    passwordChangedAt: Date;
    mustChangePassword: boolean;
    createdBy: string | null;
    deactivatedBy: string | null;
    deactivatedAt: Date | null;
    get isActive(): boolean;
    get isLocked(): boolean;
}
