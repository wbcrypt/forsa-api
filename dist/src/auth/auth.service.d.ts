import { JwtService } from '@nestjs/jwt';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { UserSession } from '../users/entities/user-session.entity';
import { SecurityEventService } from './services/security-event.service';
import { MfaService } from './services/mfa.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    requiresMfa?: boolean;
    mfaToken?: string;
}
export interface JwtPayload {
    sub: string;
    email: string;
    tenantId: string;
    sessionId: string;
    permissions: string[];
    iat?: number;
    exp?: number;
}
export declare class AuthService {
    private readonly userRepository;
    private readonly sessionRepository;
    private readonly jwtService;
    private readonly configService;
    private readonly dataSource;
    private readonly securityEventService;
    private readonly mfaService;
    private readonly logger;
    constructor(userRepository: Repository<User>, sessionRepository: Repository<UserSession>, jwtService: JwtService, configService: ConfigService, dataSource: DataSource, securityEventService: SecurityEventService, mfaService: MfaService);
    validateCredentials(email: string, password: string, tenantId: string): Promise<User | null>;
    login(loginDto: LoginDto, ipAddress: string, userAgent: string): Promise<AuthTokens>;
    verifyMfaAndLogin(dto: VerifyMfaDto, ipAddress: string, userAgent: string): Promise<AuthTokens>;
    refreshTokens(dto: RefreshTokenDto, _ipAddress: string): Promise<AuthTokens>;
    setPassword(rawToken: string, newPassword: string): Promise<void>;
    logout(sessionId: string, userId: string, ipAddress: string): Promise<void>;
    logoutAll(userId: string, _currentSessionId: string): Promise<void>;
    hashPassword(password: string): Promise<string>;
    getUserPermissions(userId: string, tenantId: string): Promise<string[]>;
    validateJwtPayload(payload: JwtPayload): Promise<any>;
    private createSession;
    private generateAccessToken;
    private generateRefreshToken;
    private handleFailedLogin;
}
