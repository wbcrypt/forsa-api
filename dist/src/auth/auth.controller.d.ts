import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { MfaService } from './services/mfa.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
export declare class AuthController {
    private readonly authService;
    private readonly mfaService;
    private readonly configService;
    constructor(authService: AuthService, mfaService: MfaService, configService: ConfigService);
    login(loginDto: LoginDto, response: Response, ipAddress: string, userAgent: string): Promise<{
        requiresMfa: boolean;
        mfaToken: string;
        message: string;
        accessToken?: undefined;
        refreshToken?: undefined;
        expiresIn?: undefined;
        tokenType?: undefined;
    } | {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        tokenType: string;
        requiresMfa?: undefined;
        mfaToken?: undefined;
        message?: undefined;
    }>;
    verifyMfa(dto: VerifyMfaDto, response: Response, ipAddress: string, userAgent: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        tokenType: string;
    }>;
    refresh(dto: RefreshTokenDto, response: Response, ipAddress: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        tokenType: string;
    }>;
    logout(user: any, response: Response, ipAddress: string): Promise<{
        message: string;
    }>;
    logoutAll(user: any, response: Response): Promise<{
        message: string;
    }>;
    getMe(user: any): Promise<{
        id: any;
        email: any;
        tenantId: any;
        permissions: any;
    }>;
    getMfaSetup(user: any): Promise<{
        secret: string;
        qrCode: string;
        message: string;
    }>;
    enableMfa(user: any, body: {
        secret: string;
        code: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    private setAuthCookie;
    private clearAuthCookie;
}
