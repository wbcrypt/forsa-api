import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Try Authorization header first
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Then try httpOnly cookie
        (request) => request?.cookies?.[configService.get('session.cookieName')],
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret'),
      issuer: 'forsa-os',
      audience: 'forsa-os-app',
    });
  }

  async validate(payload: JwtPayload): Promise<any> {
    const user = await this.authService.validateJwtPayload(payload);
    if (!user) {
      throw new UnauthorizedException('Session invalid or expired');
    }
    return user;
  }
}
