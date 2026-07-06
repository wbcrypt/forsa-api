"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const permissions_guard_1 = require("./permissions.guard");
describe('PermissionsGuard', () => {
    let guard;
    let reflector;
    let dataSource;
    const makeContext = (user) => ({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
            getRequest: () => ({ user, ip: '127.0.0.1', method: 'GET', url: '/students' }),
        }),
    });
    beforeEach(() => {
        reflector = { getAllAndOverride: jest.fn() };
        dataSource = { query: jest.fn().mockResolvedValue([]) };
        guard = new permissions_guard_1.PermissionsGuard(reflector, dataSource);
    });
    it('allows through when the route requires no permissions', async () => {
        reflector.getAllAndOverride.mockReturnValue(undefined);
        await expect(guard.canActivate(makeContext(null))).resolves.toBe(true);
    });
    it('throws ForbiddenException when permissions are required but there is no user', async () => {
        reflector.getAllAndOverride.mockReturnValue(['student.view']);
        await expect(guard.canActivate(makeContext(null))).rejects.toThrow(common_1.ForbiddenException);
    });
    it('allows through when the user holds every required permission', async () => {
        reflector.getAllAndOverride.mockReturnValue(['student.view']);
        const user = { id: 'u1', tenantId: 't1', permissions: ['student.view', 'student.edit'] };
        await expect(guard.canActivate(makeContext(user))).resolves.toBe(true);
    });
    it('denies and logs a security event when the user is missing a required permission', async () => {
        reflector.getAllAndOverride.mockReturnValue(['student.view', 'student.view_pii']);
        const user = { id: 'u1', tenantId: 't1', permissions: ['student.view'] };
        await expect(guard.canActivate(makeContext(user))).rejects.toThrow(common_1.ForbiddenException);
        expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO security_events'), expect.arrayContaining(['t1', 'u1']));
    });
    it('still denies even if logging the security event fails', async () => {
        reflector.getAllAndOverride.mockReturnValue(['student.view_pii']);
        dataSource.query.mockRejectedValue(new Error('db down'));
        const user = { id: 'u1', tenantId: 't1', permissions: [] };
        await expect(guard.canActivate(makeContext(user))).rejects.toThrow(common_1.ForbiddenException);
    });
});
//# sourceMappingURL=permissions.guard.spec.js.map