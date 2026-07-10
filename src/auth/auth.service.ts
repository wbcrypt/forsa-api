import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { addMinutes, addHours } from 'date-fns';

import { User } from '../users/entities/user.entity';
import { UserSession } from '../users/entities/user-session.entity';
import { UserStatus, SecurityEventType } from '../common/enums';
import {
  generateSecureToken,
  hashToken,
} from '../common/utils/encryption.util';
import { hashPassword, validatePasswordComplexity } from '../common/utils/password.util';
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly securityEventService: SecurityEventService,
    private readonly mfaService: MfaService,
  ) {}

  /**
   * Validates user credentials (used by LocalStrategy)
   */
  async validateCredentials(
    email: string,
    password: string,
    tenantId: string,
  ): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase(), tenantId },
    });

    if (!user) {
      // Timing-safe: still verify a dummy hash to prevent timing attacks
      await argon2.verify(
        '$argon2id$v=19$m=65536,t=3,p=4$dummy$dummyhashfortimingprotection',
        password,
      ).catch(() => {});
      return null;
    }

    if (user.isLocked) {
      throw new UnauthorizedException(
        'Account is temporarily locked. Please try again later.',
      );
    }

    if (user.status === UserStatus.DEACTIVATED) {
      throw new UnauthorizedException('Account has been deactivated.');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account is suspended. Contact support.');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      return null;
    }

    // Reset failed attempts on success
    if (user.failedLoginAttempts > 0) {
      await this.userRepository.update(user.id, {
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    }

    return user;
  }

  /**
   * Main login flow
   */
  async login(
    loginDto: LoginDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthTokens> {
    const user = await this.validateCredentials(
      loginDto.email,
      loginDto.password,
      loginDto.tenantId,
    );

    if (!user) {
      await this.securityEventService.log({
        eventType: SecurityEventType.LOGIN_FAILURE,
        severity: 'warning',
        ipAddress,
        userAgent,
        details: { email: loginDto.email, tenantId: loginDto.tenantId },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // If MFA is enabled, return a short-lived MFA token instead of full tokens
    if (user.mfaEnabled) {
      const mfaToken = await this.mfaService.createMfaChallenge(user.id);
      await this.securityEventService.log({
        tenantId: user.tenantId,
        userId: user.id,
        eventType: SecurityEventType.LOGIN_SUCCESS,
        severity: 'info',
        ipAddress,
        userAgent,
        details: { mfaRequired: true },
      });
      return {
        accessToken: '',
        refreshToken: '',
        expiresIn: 0,
        requiresMfa: true,
        mfaToken,
      };
    }

    return this.createSession(user, ipAddress, userAgent);
  }

  /**
   * Verify MFA and complete login
   */
  async verifyMfaAndLogin(
    dto: VerifyMfaDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthTokens> {
    const userId = await this.mfaService.verifyMfaChallenge(
      dto.mfaToken,
      dto.code,
    );

    if (!userId) {
      await this.securityEventService.log({
        eventType: SecurityEventType.MFA_FAILURE,
        severity: 'warning',
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid or expired MFA code');
    }

    const user = await this.userRepository.findOneOrFail({
      where: { id: userId },
    });

    await this.securityEventService.log({
      tenantId: user.tenantId,
      userId: user.id,
      eventType: SecurityEventType.MFA_SUCCESS,
      severity: 'info',
      ipAddress,
      userAgent,
    });

    return this.createSession(user, ipAddress, userAgent);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(
    dto: RefreshTokenDto,
    _ipAddress: string,
  ): Promise<AuthTokens> {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Verify session still exists and is valid
    const session = await this.sessionRepository.findOne({
      where: { id: payload.sessionId },
    });

    if (!session || !session.isValid) {
      throw new UnauthorizedException('Session has been invalidated');
    }

    // Update last active
    await this.dataSource.query(
      'UPDATE user_sessions SET last_active_at = NOW() WHERE id = $1',
      [session.id],
    );

    // Get user with fresh permissions
    const user = await this.userRepository.findOneOrFail({
      where: { id: payload.sub },
    });

    const permissions = await this.getUserPermissions(user.id, user.tenantId);
    const accessToken = await this.generateAccessToken(user, session.id, permissions);
    const refreshToken = await this.generateRefreshToken(user, session.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * D-001/T-204 — consumes a one-time password-setup token (emailed on
   * membership approval, since the account is provisioned with an
   * unusable placeholder hash, never a real invented password) and sets
   * the user's actual password. Mirrors the token_hash-lookup pattern
   * already used for sessions/MFA — the raw token is never stored.
   */
  async setPassword(rawToken: string, newPassword: string): Promise<void> {
    validatePasswordComplexity(newPassword);

    const tokenHash = hashToken(rawToken);
    // Look up the token regardless of used/expired state first, so the
    // error can actually say what happened — a real user hit this exact
    // ambiguity: clicked an already-consumed link again (having genuinely
    // set their password the first time) and saw the same generic
    // "invalid or expired" a truly bad/unknown token would show, with no
    // way to tell the two apart.
    const [tokenRow] = await this.dataSource.query<any[]>(
      `SELECT id, user_id, tenant_id, used_at, expires_at FROM password_setup_tokens
       WHERE token_hash = $1`,
      [tokenHash],
    );
    if (!tokenRow) {
      throw new BadRequestException('This set-password link is invalid. Please use the link from your email, or contact support for a new one.');
    }
    if (tokenRow.used_at) {
      throw new BadRequestException('This link has already been used to set your password. If you already completed this step, please log in instead.');
    }
    if (new Date(tokenRow.expires_at) <= new Date()) {
      throw new BadRequestException('This set-password link has expired. Please contact support for a new one.');
    }

    const passwordHash = await hashPassword(newPassword);

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE users
         SET password_hash = $2, must_change_password = false,
             status = $3, email_verified = true, password_changed_at = NOW()
         WHERE id = $1`,
        [tokenRow.user_id, passwordHash, UserStatus.ACTIVE],
      );
      await manager.query(
        `UPDATE password_setup_tokens SET used_at = NOW() WHERE id = $1`,
        [tokenRow.id],
      );
    });
  }

  /**
   * Logout — invalidates the session
   */
  async logout(sessionId: string, userId: string, ipAddress: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE user_sessions
       SET invalidated_at = NOW(), invalidation_reason = 'logout'
       WHERE id = $1 AND user_id = $2 AND invalidated_at IS NULL`,
      [sessionId, userId],
    );

    await this.securityEventService.log({
      userId,
      eventType: SecurityEventType.SESSION_INVALIDATED,
      severity: 'info',
      ipAddress,
      details: { sessionId, reason: 'logout' },
    });
  }

  /**
   * Logout from all sessions
   */
  async logoutAll(userId: string, _currentSessionId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE user_sessions
       SET invalidated_at = NOW(), invalidation_reason = 'logout'
       WHERE user_id = $1 AND invalidated_at IS NULL`,
      [userId],
    );
  }

  /**
   * Hash a password using argon2id
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Get all permission codes for a user.
   *
   * Security review finding — roles are tenant-owned rows but user_roles
   * carries no tenant_id of its own, and this query previously joined
   * straight through it with no tenant_id filter anywhere. Both call sites
   * today always pass a (userId, tenantId) pair read off the same user
   * row, so it isn't reachable with a mismatched pair right now — but
   * nothing enforced that invariant at the query level (no RLS in this
   * schema), and the identical unscoped pattern in
   * UsersService.getUserRolesAndPermissions *was* reachable with a
   * mismatched pair via a client-supplied :id. Scoping by tenant_id here
   * too, for the same reason and to stop this from becoming a footgun if
   * it's ever called with an unverified userId later.
   */
  async getUserPermissions(userId: string, tenantId: string): Promise<string[]> {
    const rows = await this.dataSource.query<{ code: string }[]>(
      `SELECT DISTINCT p.code
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.tenant_id = $2
         AND (ur.effective_until IS NULL OR ur.effective_until > CURRENT_DATE)
         AND ur.revoked_at IS NULL`,
      [userId, tenantId],
    );
    return rows.map(r => r.code);
  }

  /**
   * Validate JWT payload (used by JwtStrategy)
   */
  async validateJwtPayload(payload: JwtPayload): Promise<any> {
    // Verify session is still valid
    const session = await this.sessionRepository.findOne({
      where: { id: payload.sessionId },
    });

    if (!session || !session.isValid) {
      return null;
    }

    // Check session idle timeout
    const idleTimeoutMinutes = this.configService.get<number>(
      'session.idleTimeoutMinutes',
    ) || 60;

    const idleDeadline = addMinutes(session.lastActiveAt, idleTimeoutMinutes);
    if (new Date() > idleDeadline) {
      await this.dataSource.query(
        `UPDATE user_sessions SET invalidated_at = NOW(), invalidation_reason = 'expired'
         WHERE id = $1`,
        [session.id],
      );
      return null;
    }

    // Update last active (throttled — only if > 1 minute since last update)
    const oneMinuteAgo = addMinutes(new Date(), -1);
    if (session.lastActiveAt < oneMinuteAgo) {
      await this.dataSource.query(
        'UPDATE user_sessions SET last_active_at = NOW() WHERE id = $1',
        [session.id],
      );
    }

    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      sessionId: payload.sessionId,
      permissions: payload.permissions,
    };
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private async createSession(
    user: User,
    ipAddress: string,
    userAgent: string,
  ): Promise<AuthTokens> {
    const permissions = await this.getUserPermissions(user.id, user.tenantId);
    const sessionId = uuidv4();
    const absoluteTimeoutHours = this.configService.get<number>('session.absoluteTimeoutHours') || 12;

    // Create session record
    const rawRefreshToken = generateSecureToken(48);
    const tokenHash = hashToken(rawRefreshToken);

    await this.dataSource.query(
      `INSERT INTO user_sessions
        (id, user_id, tenant_id, session_token_hash, ip_address, user_agent,
         last_active_at, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, NOW())`,
      [
        sessionId,
        user.id,
        user.tenantId,
        tokenHash,
        ipAddress,
        userAgent,
        addHours(new Date(), absoluteTimeoutHours),
      ],
    );

    // Update last login
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
      status: UserStatus.ACTIVE,
    });

    await this.securityEventService.log({
      tenantId: user.tenantId,
      userId: user.id,
      eventType: SecurityEventType.LOGIN_SUCCESS,
      severity: 'info',
      ipAddress,
      userAgent,
      details: { sessionId },
    });

    const accessToken = await this.generateAccessToken(user, sessionId, permissions);
    const refreshToken = await this.generateRefreshToken(user, sessionId);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
    };
  }

  private async generateAccessToken(
    user: User,
    sessionId: string,
    permissions: string[],
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      sessionId,
      permissions,
    };

    return this.jwtService.sign(payload);
  }

  private async generateRefreshToken(user: User, sessionId: string): Promise<string> {
    return this.jwtService.sign(
      {
        sub: user.id,
        tenantId: user.tenantId,
        sessionId,
        type: 'refresh',
      },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiry') || '7d',
      },
    );
  }

  private async handleFailedLogin(user: User): Promise<void> {
    const maxAttempts = this.configService.get<number>('security.maxLoginAttempts') || 5;
    const lockoutMinutes = this.configService.get<number>('security.lockoutMinutes') || 30;
    const newAttempts = user.failedLoginAttempts + 1;

    const update: Partial<User> = { failedLoginAttempts: newAttempts } as any;

    if (newAttempts >= maxAttempts) {
      update.lockedUntil = addMinutes(new Date(), lockoutMinutes) as any;
      await this.securityEventService.log({
        tenantId: user.tenantId,
        userId: user.id,
        eventType: SecurityEventType.ACCOUNT_LOCKED,
        severity: 'high',
        details: { attempts: newAttempts, lockedUntil: update.lockedUntil },
      });
    }

    await this.userRepository.update(user.id, update);
  }
}
