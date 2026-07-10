"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const users_service_1 = require("./users.service");
const user_entity_1 = require("./entities/user.entity");
const enums_1 = require("../common/enums");
describe('UsersService.getUserRolesAndPermissions — tenant scope', () => {
    let service;
    let userRepository;
    let query;
    const makeUser = (overrides = {}) => {
        const user = new user_entity_1.User();
        Object.assign(user, {
            id: 'user-1',
            tenantId: 'tenant-a',
            email: 'staff@forsa.tn',
            status: enums_1.UserStatus.ACTIVE,
            ...overrides,
        });
        return user;
    };
    beforeEach(() => {
        userRepository = { findOne: jest.fn() };
        query = jest.fn();
        service = new users_service_1.UsersService(userRepository, { query }, {});
    });
    it('rejects a userId that does not belong to the caller\'s tenant, before querying roles', async () => {
        userRepository.findOne.mockResolvedValue(null);
        await expect(service.getUserRolesAndPermissions('user-1', 'tenant-b')).rejects.toThrow(common_1.NotFoundException);
        expect(query).not.toHaveBeenCalled();
    });
    it('scopes the roles and permissions queries by tenant_id for a user that does belong to the tenant', async () => {
        userRepository.findOne.mockResolvedValue(makeUser());
        query
            .mockResolvedValueOnce([{ id: 'role-1', name: 'Finance Team' }])
            .mockResolvedValueOnce([{ code: 'payment.view' }]);
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
//# sourceMappingURL=users.service.spec.js.map