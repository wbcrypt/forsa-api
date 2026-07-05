import { UnauthorizedException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { UserSession } from '../users/entities/user-session.entity';
import { SecurityEventService } from './services/security-event.service';
import { MfaService } from './services/mfa.service';
import { UserStatus } from '../common/enums';

jest.mock('argon2');

// T-109 — validateCredentials is the single choke point every login (and
// therefore every portal — admin/student/university/partner/finance/
// guarantor all share POST /auth/login) passes through: lockout, account
// status, and password verification all live here. A regression either
// locks everyone out or, worse, lets a wrong password through.
describe('AuthService.validateCredentials', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Pick<Repository<User>, 'findOne' | 'update'>>;
  let securityEventService: jest.Mocked<Pick<SecurityEventService, 'log'>>;

  const makeUser = (overrides: Partial<User> = {}): User => {
    const user = new User();
    Object.assign(user, {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'staff@forsa.tn',
      passwordHash: 'hashed',
      status: UserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      mfaEnabled: false,
      ...overrides,
    });
    return user;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository = { findOne: jest.fn(), update: jest.fn().mockResolvedValue(undefined) };
    securityEventService = { log: jest.fn().mockResolvedValue(undefined) };

    service = new AuthService(
      userRepository as unknown as Repository<User>,
      {} as unknown as Repository<UserSession>,
      {} as unknown as JwtService,
      { get: jest.fn() } as unknown as ConfigService,
      {} as unknown as DataSource,
      securityEventService as unknown as SecurityEventService,
      {} as unknown as MfaService,
    );
  });

  it('returns null for an unknown email without revealing which part was wrong', async () => {
    userRepository.findOne.mockResolvedValue(null);
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    const result = await service.validateCredentials('nobody@forsa.tn', 'whatever', 'tenant-1');

    expect(result).toBeNull();
    // Timing-attack mitigation: a dummy hash is still verified even though
    // no user was found, so failed lookups and failed password checks take
    // roughly the same time.
    expect(argon2.verify).toHaveBeenCalled();
  });

  it('throws UnauthorizedException for a locked account, before checking the password', async () => {
    const lockedUser = makeUser({ lockedUntil: new Date(Date.now() + 10 * 60 * 1000) });
    userRepository.findOne.mockResolvedValue(lockedUser);

    await expect(service.validateCredentials('staff@forsa.tn', 'anypassword', 'tenant-1'))
      .rejects.toThrow(UnauthorizedException);
    expect(argon2.verify).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException for a deactivated account', async () => {
    userRepository.findOne.mockResolvedValue(makeUser({ status: UserStatus.DEACTIVATED }));

    await expect(service.validateCredentials('staff@forsa.tn', 'anypassword', 'tenant-1'))
      .rejects.toThrow(UnauthorizedException);
  });

  it('returns null and records a failed attempt for a wrong password', async () => {
    const user = makeUser({ failedLoginAttempts: 2 });
    userRepository.findOne.mockResolvedValue(user);
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    const result = await service.validateCredentials('staff@forsa.tn', 'wrongpassword', 'tenant-1');

    expect(result).toBeNull();
    expect(userRepository.update).toHaveBeenCalledWith('user-1', expect.objectContaining({ failedLoginAttempts: 3 }));
  });

  it('locks the account once failed attempts reach the configured maximum', async () => {
    const user = makeUser({ failedLoginAttempts: 4 }); // next failure = 5th = default max
    userRepository.findOne.mockResolvedValue(user);
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    await service.validateCredentials('staff@forsa.tn', 'wrongpassword', 'tenant-1');

    expect(userRepository.update).toHaveBeenCalledWith(
      'user-1', expect.objectContaining({ failedLoginAttempts: 5, lockedUntil: expect.any(Date) }),
    );
    expect(securityEventService.log).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'account_locked' }),
    );
  });

  it('returns the user and resets the failed-attempt counter on correct credentials', async () => {
    const user = makeUser({ failedLoginAttempts: 3 });
    userRepository.findOne.mockResolvedValue(user);
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    const result = await service.validateCredentials('staff@forsa.tn', 'correctpassword', 'tenant-1');

    expect(result).toBe(user);
    expect(userRepository.update).toHaveBeenCalledWith(
      'user-1', expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
    );
  });
});
