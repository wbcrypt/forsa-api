import { NotFoundException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserStatus } from '../common/enums';

// Security review finding — GET /users/:id/roles took a client-supplied
// :id straight to getUserRolesAndPermissions with no tenant check at all:
// staff holding user.view in tenant A could pass any UUID and read
// another tenant's user's role names and permission codes (roles.tenant_id
// was never checked, and user_roles carries no tenant_id of its own).
// findOne({ id, tenantId }) now runs first (throws if the user isn't in
// this tenant), and the roles/permissions queries are themselves scoped
// by tenant_id too — there's no RLS in this schema, so both the
// authorization check and the query scope matter independently.
describe('UsersService.getUserRolesAndPermissions — tenant scope', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Pick<Repository<User>, 'findOne'>>;
  let query: jest.Mock;

  const makeUser = (overrides: Partial<User> = {}): User => {
    const user = new User();
    Object.assign(user, {
      id: 'user-1',
      tenantId: 'tenant-a',
      email: 'staff@forsa.tn',
      status: UserStatus.ACTIVE,
      ...overrides,
    });
    return user;
  };

  beforeEach(() => {
    userRepository = { findOne: jest.fn() };
    query = jest.fn();
    service = new UsersService(
      userRepository as unknown as Repository<User>,
      { query } as unknown as DataSource,
      {} as unknown as ConfigService,
    );
  });

  it('rejects a userId that does not belong to the caller\'s tenant, before querying roles', async () => {
    userRepository.findOne.mockResolvedValue(null); // no row for { id, tenantId: 'tenant-b' }

    await expect(
      service.getUserRolesAndPermissions('user-1', 'tenant-b'),
    ).rejects.toThrow(NotFoundException);

    expect(query).not.toHaveBeenCalled();
  });

  it('scopes the roles and permissions queries by tenant_id for a user that does belong to the tenant', async () => {
    userRepository.findOne.mockResolvedValue(makeUser());
    query
      .mockResolvedValueOnce([{ id: 'role-1', name: 'Finance Team' }])   // roles
      .mockResolvedValueOnce([{ code: 'payment.view' }]);                // permissions

    const result = await service.getUserRolesAndPermissions('user-1', 'tenant-a');

    expect(result).toEqual({
      roles: [{ id: 'role-1', name: 'Finance Team' }],
      permissions: [{ code: 'payment.view' }],
    });

    const [rolesSql, rolesParams] = query.mock.calls[0];
    expect(rolesSql).toContain('r.tenant_id = $2');
    expect(rolesParams).toEqual(['user-1', 'tenant-a']);

    const [permsSql, permsParams] = query.mock.calls[1];
    expect(permsSql).toContain('r.tenant_id = $2');
    expect(permsParams).toEqual(['user-1', 'tenant-a']);
  });
});
