import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Delete,
  Patch,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { MfaService } from './services/mfa.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public, CurrentUser, ClientIp, UserAgent } from '../common/decorators';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 900000, limit: 5 } }) // 5 per 15 min per IP
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful or MFA required' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @ClientIp() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    const tokens = await this.authService.login(loginDto, ipAddress, userAgent);

    if (tokens.requiresMfa) {
      return {
        requiresMfa: true,
        mfaToken: tokens.mfaToken,
        message: 'MFA verification required',
      };
    }

    this.setAuthCookie(response, tokens.accessToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
    };
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 300000, limit: 10 } }) // 10 per 5 min
  @ApiOperation({ summary: 'Verify MFA code and complete login' })
  async verifyMfa(
    @Body() dto: VerifyMfaDto,
    @Res({ passthrough: true }) response: Response,
    @ClientIp() ipAddress: string,
    @UserAgent() userAgent: string,
  ) {
    const tokens = await this.authService.verifyMfaAndLogin(dto, ipAddress, userAgent);
    this.setAuthCookie(response, tokens.accessToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) response: Response,
    @ClientIp() ipAddress: string,
  ) {
    const tokens = await this.authService.refreshTokens(dto, ipAddress);
    this.setAuthCookie(response, tokens.accessToken);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session' })
  async logout(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) response: Response,
    @ClientIp() ipAddress: string,
  ) {
    await this.authService.logout(user.sessionId, user.id, ipAddress);
    this.clearAuthCookie(response);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout all sessions' })
  async logoutAll(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logoutAll(user.id, user.sessionId);
    this.clearAuthCookie(response);
    return { message: 'All sessions logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user information' })
  async getMe(@CurrentUser() user: any) {
    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      permissions: user.permissions,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('mfa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get MFA setup QR code' })
  async getMfaSetup(@CurrentUser() user: any) {
    const { secret, otpauthUrl } = this.mfaService.generateTotpSecret(user.email);
    const qrCode = await this.mfaService.generateQrCode(otpauthUrl);

    // Return secret for manual entry + QR code
    // Secret is shown once — user must save it
    return {
      secret,
      qrCode,
      message: 'Scan QR code with your authenticator app, then verify with POST /auth/mfa/enable',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable MFA after verifying TOTP setup' })
  async enableMfa(
    @CurrentUser() user: any,
    @Body() body: { secret: string; code: string },
  ) {
    const success = await this.mfaService.enableMfa(
      user.id,
      body.secret,
      body.code,
    );

    if (!success) {
      return { success: false, message: 'Invalid verification code' };
    }

    return { success: true, message: 'MFA enabled successfully' };
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private setAuthCookie(response: Response, token: string): void {
    const cookieName = this.configService.get<string>('session.cookieName') || 'forsa_session';
    const isSecure = this.configService.get<boolean>('session.cookieSecure') !== false;

    response.cookie(cookieName, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes (matches JWT expiry)
      path: '/',
    });
  }

  private clearAuthCookie(response: Response): void {
    const cookieName = this.configService.get<string>('session.cookieName') || 'forsa_session';
    response.clearCookie(cookieName, { path: '/' });
  }
}
