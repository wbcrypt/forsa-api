import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { PermissionsGuard } from './permissions.guard';

// T-109 — this is the sole gate for every @RequirePermissions() route in the
// platform (there is no APP_GUARD, so a controller that omits this guard is
// open by default — see K-15/T-517). It reads permissions from the JWT
// payload, not a live DB re-check, so a regression here is a straight
// privilege-escalation or lockout bug.
describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;
  let dataSource: { query: jest.Mock };

  const makeContext = (user: any): ExecutionContext => ({
    getHandler: () => ({}) as any,
    getClass: () => ({}) as any,
    switchToHttp: () => ({
      getRequest: () => ({ user, ip: '127.0.0.1', method: 'GET', url: '/students' }),
    }),
  }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    dataSource = { query: jest.fn().mockResolvedValue([]) };
    guard = new PermissionsGuard(reflector, dataSource as unknown as DataSource);
  });

  it('allows through when the route requires no permissions', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext(null))).resolves.toBe(true);
  });

  it('throws ForbiddenException when permissions are required but there is no user', async () => {
    reflector.getAllAndOverride.mockReturnValue(['student.view']);
    await expect(guard.canActivate(makeContext(null))).rejects.toThrow(ForbiddenException);
  });

  it('allows through when the user holds every required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(['student.view']);
    const user = { id: 'u1', tenantId: 't1', permissions: ['student.view', 'student.edit'] };
    await expect(guard.canActivate(makeContext(user))).resolves.toBe(true);
  });

  it('denies and logs a security event when the user is missing a required permission', async () => {
    reflector.getAllAndOverride.mockReturnValue(['student.view', 'student.view_pii']);
    const user = { id: 'u1', tenantId: 't1', permissions: ['student.view'] };

    await expect(guard.canActivate(makeContext(user))).rejects.toThrow(ForbiddenException);
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO security_events'),
      expect.arrayContaining(['t1', 'u1']),
    );
  });

  it('still denies even if logging the security event fails', async () => {
    reflector.getAllAndOverride.mockReturnValue(['student.view_pii']);
    dataSource.query.mockRejectedValue(new Error('db down'));
    const user = { id: 'u1', tenantId: 't1', permissions: [] };

    await expect(guard.canActivate(makeContext(user))).rejects.toThrow(ForbiddenException);
  });
});
