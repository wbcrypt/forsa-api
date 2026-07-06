"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const digital_pass_service_1 = require("./digital-pass.service");
describe('DigitalPassService', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new digital_pass_service_1.DigitalPassService({ query });
    });
    describe('issueForStudentTx', () => {
        it('inserts exactly one active pass row via the given manager', async () => {
            const managerQuery = jest.fn().mockResolvedValue(undefined);
            const manager = { query: managerQuery };
            const result = await service.issueForStudentTx(manager, 'student-1', 'tenant-1');
            expect(result.verificationToken).toEqual(expect.any(String));
            expect(result.verificationToken.length).toBeGreaterThan(20);
            const insertCall = managerQuery.mock.calls[0];
            expect(insertCall[0]).toContain('INSERT INTO digital_student_passes');
            expect(insertCall[1]).toEqual(['student-1', 'tenant-1', result.verificationToken]);
        });
    });
    describe('verifyByToken', () => {
        it('throws NotFoundException for an unknown token', async () => {
            query.mockResolvedValueOnce([]);
            await expect(service.verifyByToken('bad-token')).rejects.toThrow(common_1.NotFoundException);
        });
        it('reports valid=true for an active pass on a non-blacklisted member', async () => {
            query.mockResolvedValueOnce([{
                    pass_status: 'active', first_name: 'Amina', last_name: 'Trabelsi',
                    forsa_id: 'FORSA-2026-ABCDEF', membership_status: 'bronze', member_since: '2026-07-05',
                    university_name: 'Test University', academic_year: '2026-2027',
                }]);
            const result = await service.verifyByToken('good-token');
            expect(result).toEqual(expect.objectContaining({
                valid: true, forsaId: 'FORSA-2026-ABCDEF', studentName: 'Amina Trabelsi',
            }));
        });
        it('reports valid=false when the pass itself is revoked', async () => {
            query.mockResolvedValueOnce([{
                    pass_status: 'revoked', first_name: 'Amina', last_name: 'Trabelsi',
                    forsa_id: 'FORSA-2026-ABCDEF', membership_status: 'bronze',
                }]);
            const result = await service.verifyByToken('revoked-token');
            expect(result.valid).toBe(false);
        });
        it('reports valid=false when the member has been blacklisted, even if the pass row itself is still active', async () => {
            query.mockResolvedValueOnce([{
                    pass_status: 'active', first_name: 'Amina', last_name: 'Trabelsi',
                    forsa_id: 'FORSA-2026-ABCDEF', membership_status: 'blacklisted',
                }]);
            const result = await service.verifyByToken('some-token');
            expect(result.valid).toBe(false);
        });
    });
    describe('revoke', () => {
        it('throws NotFoundException for an unknown pass', async () => {
            query.mockResolvedValueOnce([]);
            await expect(service.revoke('missing', 'tenant-1', 'staff-1', 'lost')).rejects.toThrow(common_1.NotFoundException);
        });
        it('rejects revoking an already-revoked pass', async () => {
            query.mockResolvedValueOnce([{ id: 'pass-1', status: 'revoked' }]);
            await expect(service.revoke('pass-1', 'tenant-1', 'staff-1', 'lost')).rejects.toThrow(common_1.BadRequestException);
        });
        it('revokes an active pass', async () => {
            query
                .mockResolvedValueOnce([{ id: 'pass-1', status: 'active' }])
                .mockResolvedValueOnce(undefined);
            const result = await service.revoke('pass-1', 'tenant-1', 'staff-1', 'Lost phone');
            expect(result).toEqual({ id: 'pass-1', status: 'revoked' });
        });
    });
});
//# sourceMappingURL=digital-pass.service.spec.js.map