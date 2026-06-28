export declare class LoginDto {
    email: string;
    password: string;
    tenantId: string;
}
export declare class RefreshTokenDto {
    refreshToken: string;
}
export declare class VerifyMfaDto {
    mfaToken: string;
    code: string;
}
export declare class ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
export declare class SetupMfaDto {
    verificationCode: string;
}
