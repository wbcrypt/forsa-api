import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../common/decorators';

// T-109 — no global @UseGuards(APP_GUARD) exists in app.module.ts; every
// controller opts in per-class. This guard's @Public() override is the only
// thing that lets the 3 public routes (login, mfa/verify, refresh) and the
// Konnect webhook (T-105) skip auth — a regression here silently reopens
// every "protected" route, or silently locks out a route meant to be public.
describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  const makeContext = (): ExecutionContext => ({
    getHandler: () => ({}) as any,
    getClass: () => ({}) as any,
  }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new JwtAuthGuard(reflector);
  });

  describe('canActivate', () => {
    it('returns true immediately for a @Public() route, without invoking passport', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const superSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        'canActivate',
      );

      const result = guard.canActivate(makeContext());

      expect(result).toBe(true);
      expect(superSpy).not.toHaveBeenCalled();
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
    });
  });

  describe('handleRequest', () => {
    it('returns the user for a @Public() route even if passport found none', () => {
      reflector.getAllAndOverride.mockReturnValue(true);
      const result = guard.handleRequest(null, null, null, makeContext());
      expect(result).toBeNull();
    });

    it('returns the user for a protected route when authentication succeeded', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const result = guard.handleRequest(null, user, null, makeContext());
      expect(result).toBe(user);
    });

    it('throws UnauthorizedException for a protected route with no user and no error', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      expect(() => guard.handleRequest(null, null, null, makeContext())).toThrow(UnauthorizedException);
    });

    it('rethrows the original error for a protected route when passport reports one', () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const err = new Error('jwt expired');
      expect(() => guard.handleRequest(err, null, null, makeContext())).toThrow(err);
    });
  });
});
