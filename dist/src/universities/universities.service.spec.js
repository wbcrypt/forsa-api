"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const universities_service_1 = require("./universities.service");
describe('UniversitiesService — T-223 identity fix', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new universities_service_1.UniversitiesService({ query });
    });
    describe('findMe', () => {
        it('resolves the university via the caller user_id, never a client-supplied id', async () => {
            query.mockResolvedValueOnce([{ id: 'uni-1', user_id: 'user-1', name: 'Test University' }]);
            const result = await service.findMe('user-1', 'tenant-1');
            expect(result).toEqual(expect.objectContaining({ id: 'uni-1' }));
            const call = query.mock.calls[0];
            expect(call[0]).toContain('WHERE user_id = $1 AND tenant_id = $2');
            expect(call[1]).toEqual(['user-1', 'tenant-1']);
        });
        it('throws NotFoundException when no university is linked to this user', async () => {
            query.mockResolvedValueOnce([]);
            await expect(service.findMe('user-2', 'tenant-1')).rejects.toThrow(common_1.NotFoundException);
        });
    });
    describe('linkUser', () => {
        it('throws NotFoundException for an unknown university', async () => {
            query.mockResolvedValueOnce([]);
            await expect(service.linkUser('missing-uni', 'user-1', 'tenant-1', 'staff-1')).rejects.toThrow(common_1.NotFoundException);
        });
        it('throws NotFoundException for an unknown user', async () => {
            query
                .mockResolvedValueOnce([{ id: 'uni-1' }])
                .mockResolvedValueOnce([]);
            await expect(service.linkUser('uni-1', 'missing-user', 'tenant-1', 'staff-1')).rejects.toThrow(common_1.NotFoundException);
        });
        it('links both sides of the relationship', async () => {
            query
                .mockResolvedValueOnce([{ id: 'uni-1' }])
                .mockResolvedValueOnce([{ id: 'user-1' }])
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);
            const result = await service.linkUser('uni-1', 'user-1', 'tenant-1', 'staff-1');
            expect(result).toEqual({ id: 'uni-1', userId: 'user-1' });
            expect(query.mock.calls[2][0]).toContain('UPDATE universities SET user_id');
            expect(query.mock.calls[3][0]).toContain('UPDATE users SET university_id_linked');
        });
    });
});
//# sourceMappingURL=universities.service.spec.js.map