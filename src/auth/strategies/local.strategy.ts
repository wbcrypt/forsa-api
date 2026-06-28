import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email', passReqToCallback: true });
  }

  async validate(request: any, email: string, password: string): Promise<any> {
    const tenantId = request.body.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }

    const user = await this.authService.validateCredentials(
      email,
      password,
      tenantId,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }
}
