"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("./jwt-auth.guard");
const decorators_1 = require("../../common/decorators");
describe('JwtAuthGuard', () => {
    let guard;
    let reflector;
    const makeContext = () => ({
        getHandler: () => ({}),
        getClass: () => ({}),
    });
    beforeEach(() => {
        reflector = { getAllAndOverride: jest.fn() };
        guard = new jwt_auth_guard_1.JwtAuthGuard(reflector);
    });
    describe('canActivate', () => {
        it('returns true immediately for a @Public() route, without invoking passport', () => {
            reflector.getAllAndOverride.mockReturnValue(true);
            const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate');
            const result = guard.canActivate(makeContext());
            expect(result).toBe(true);
            expect(superSpy).not.toHaveBeenCalled();
            expect(reflector.getAllAndOverride).toHaveBeenCalledWith(decorators_1.IS_PUBLIC_KEY, expect.any(Array));
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
            expect(() => guard.handleRequest(null, null, null, makeContext())).toThrow(common_1.UnauthorizedException);
        });
        it('rethrows the original error for a protected route when passport reports one', () => {
            reflector.getAllAndOverride.mockReturnValue(false);
            const err = new Error('jwt expired');
            expect(() => guard.handleRequest(err, null, null, makeContext())).toThrow(err);
        });
    });
});
//# sourceMappingURL=jwt-auth.guard.spec.js.map