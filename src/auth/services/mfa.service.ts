import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { addMinutes } from 'date-fns';
import {
  encrypt,
  decrypt,
  generateSecureToken,
  hashToken,
} from '../../common/utils/encryption.util';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  generateTotpSecret(userEmail: string): { secret: string; otpauthUrl: string } {
    const secret = speakeasy.generateSecret({
      name: `${this.configService.get('mfa.issuer')} (${userEmail})`,
      length: 32,
    });
    return { secret: secret.base32, otpauthUrl: secret.otpauth_url || '' };
  }

  async generateQrCode(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  }

  verifyTotp(secret: string, code: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: this.configService.get<number>('mfa.totpWindow') || 1,
    });
  }

  encryptSecret(secret: string): string {
    return encrypt(secret, this.configService.get<string>('encryption.mfaKey')!);
  }

  decryptSecret(encryptedSecret: string): string {
    return decrypt(encryptedSecret, this.configService.get<string>('encryption.mfaKey')!);
  }

  /**
   * Create a short-lived MFA challenge token (used after password verification).
   * Stores user_id in mfa_challenges table.
   */
  async createMfaChallenge(userId: string): Promise<string> {
    const token = generateSecureToken(32);
    const tokenHash = hashToken(token);
    const expiresAt = addMinutes(new Date(), 10);

    await this.dataSource.query(
      `INSERT INTO mfa_challenges (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenHash, userId, expiresAt],
    );

    return token;
  }

  /**
   * Verify MFA challenge token + TOTP code.
   * Returns userId if valid, null otherwise. One-time use.
   */
  async verifyMfaChallenge(mfaToken: string, totpCode: string): Promise<string | null> {
    const tokenHash = hashToken(mfaToken);

    const [challenge] = await this.dataSource.query<any[]>(
      `SELECT id, user_id FROM mfa_challenges
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash],
    );

    if (!challenge) return null;

    // Get user's TOTP secret
    const secret = await this.getUserMfaSecret(challenge.user_id);
    if (!secret) return null;

    const isValid = this.verifyTotp(secret, totpCode);
    if (!isValid) return null;

    // Mark as used (one-time)
    await this.dataSource.query(
      `UPDATE mfa_challenges SET used_at = NOW() WHERE id = $1`,
      [challenge.id],
    );

    return challenge.user_id;
  }

  async enableMfa(userId: string, secret: string, verificationCode: string): Promise<boolean> {
    const isValid = this.verifyTotp(secret, verificationCode);
    if (!isValid) return false;

    const encryptedSecret = this.encryptSecret(secret);

    await this.dataSource.query(
      `INSERT INTO mfa_configs (user_id, method, secret_encrypted, is_primary, status, verified_at)
       VALUES ($1, 'totp', $2, true, 'active', NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET secret_encrypted = $2, status = 'active', verified_at = NOW()`,
      [userId, encryptedSecret],
    );

    await this.dataSource.query(
      `UPDATE users SET mfa_enabled = true WHERE id = $1`,
      [userId],
    );

    return true;
  }

  async disableMfa(userId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE mfa_configs SET status = 'disabled' WHERE user_id = $1`,
      [userId],
    );
    await this.dataSource.query(
      `UPDATE users SET mfa_enabled = false WHERE id = $1`,
      [userId],
    );
  }

  async getUserMfaSecret(userId: string): Promise<string | null> {
    const [config] = await this.dataSource.query<any[]>(
      `SELECT secret_encrypted FROM mfa_configs
       WHERE user_id = $1 AND status = 'active' AND is_primary = true`,
      [userId],
    );
    if (!config) return null;
    return this.decryptSecret(config.secret_encrypted);
  }
}
