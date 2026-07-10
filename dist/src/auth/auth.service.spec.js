"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const argon2 = __importStar(require("argon2"));
const auth_service_1 = require("./auth.service");
const user_entity_1 = require("../users/entities/user.entity");
const enums_1 = require("../common/enums");
jest.mock('argon2');
describe('AuthService.validateCredentials', () => {
    let service;
    let userRepository;
    let securityEventService;
    const makeUser = (overrides = {}) => {
        const user = new user_entity_1.User();
        Object.assign(user, {
            id: 'user-1',
            tenantId: 'tenant-1',
            email: 'staff@forsa.tn',
            passwordHash: 'hashed',
            status: enums_1.UserStatus.ACTIVE,
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
        service = new auth_service_1.AuthService(userRepository, {}, {}, { get: jest.fn() }, {}, securityEventService, {});
    });
    it('returns null for an unknown email without revealing which part was wrong', async () => {
        userRepository.findOne.mockResolvedValue(null);
        argon2.verify.mockResolvedValue(false);
        const result = await service.validateCredentials('nobody@forsa.tn', 'whatever', 'tenant-1');
        expect(result).toBeNull();
        expect(argon2.verify).toHaveBeenCalled();
    });
    it('throws UnauthorizedException for a locked account, before checking the password', async () => {
        const lockedUser = makeUser({ lockedUntil: new Date(Date.now() + 10 * 60 * 1000) });
        userRepository.findOne.mockResolvedValue(lockedUser);
        await expect(service.validateCredentials('staff@forsa.tn', 'anypassword', 'tenant-1'))
            .rejects.toThrow(common_1.UnauthorizedException);
        expect(argon2.verify).not.toHaveBeenCalled();
    });
    it('throws UnauthorizedException for a deactivated account', async () => {
        userRepository.findOne.mockResolvedValue(makeUser({ status: enums_1.UserStatus.DEACTIVATED }));
        await expect(service.validateCredentials('staff@forsa.tn', 'anypassword', 'tenant-1'))
            .rejects.toThrow(common_1.UnauthorizedException);
    });
    it('returns null and records a failed attempt for a wrong password', async () => {
        const user = makeUser({ failedLoginAttempts: 2 });
        userRepository.findOne.mockResolvedValue(user);
        argon2.verify.mockResolvedValue(false);
        const result = await service.validateCredentials('staff@forsa.tn', 'wrongpassword', 'tenant-1');
        expect(result).toBeNull();
        expect(userRepository.update).toHaveBeenCalledWith('user-1', expect.objectContaining({ failedLoginAttempts: 3 }));
    });
    it('locks the account once failed attempts reach the configured maximum', async () => {
        const user = makeUser({ failedLoginAttempts: 4 });
        userRepository.findOne.mockResolvedValue(user);
        argon2.verify.mockResolvedValue(false);
        await service.validateCredentials('staff@forsa.tn', 'wrongpassword', 'tenant-1');
        expect(userRepository.update).toHaveBeenCalledWith('user-1', expect.objectContaining({ failedLoginAttempts: 5, lockedUntil: expect.any(Date) }));
        expect(securityEventService.log).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'account_locked' }));
    });
    it('returns the user and resets the failed-attempt counter on correct credentials', async () => {
        const user = makeUser({ failedLoginAttempts: 3 });
        userRepository.findOne.mockResolvedValue(user);
        argon2.verify.mockResolvedValue(true);
        const result = await service.validateCredentials('staff@forsa.tn', 'correctpassword', 'tenant-1');
        expect(result).toBe(user);
        expect(userRepository.update).toHaveBeenCalledWith('user-1', expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }));
    });
});
describe('AuthService.getUserPermissions — tenant scope', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new auth_service_1.AuthService({}, {}, {}, { get: jest.fn() }, { query }, {}, {});
    });
    it('scopes the permissions query by both user_id and tenant_id', async () => {
        query.mockResolvedValueOnce([{ code: 'application.view' }]);
        const result = await service.getUserPermissions('user-1', 'tenant-a');
        expect(result).toEqual(['application.view']);
        const [sql, params] = query.mock.calls[0];
        expect(sql).toContain('r.tenant_id = $2');
        expect(params).toEqual(['user-1', 'tenant-a']);
    });
    it('returns no permissions for a user whose roles belong to a different tenant', async () => {
        query.mockResolvedValueOnce([]);
        const result = await service.getUserPermissions('user-1', 'tenant-b');
        expect(result).toEqual([]);
        expect(query.mock.calls[0][1]).toEqual(['user-1', 'tenant-b']);
    });
});
//# sourceMappingURL=auth.service.spec.js.map