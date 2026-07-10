"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const guarantors_service_1 = require("./guarantors.service");
describe('GuarantorsService.getLinkedStudent', () => {
    it('resolves program_name via a join to programs, not a nonexistent applications column', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce([{
                guarantor_id: 'g-1', student_id: 's-1', first_name: 'Amina', last_name: 'Trabelsi',
                student_email: 'amina@example.com', application_id: 'a-1', current_status: 'approved_level2',
                university_id: 'u-1', university_name: 'Université de Tunis', program_name: 'Licence en Informatique',
                tuition_amount: 3500,
            }])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([]);
        const service = new guarantors_service_1.GuarantorsService({ query }, {}, {});
        const result = await service.getLinkedStudent('user-1', 'tenant-1');
        expect(result.application?.program_name).toBe('Licence en Informatique');
        const findLinkedStudentCall = query.mock.calls[0];
        expect(findLinkedStudentCall[0]).toContain('LEFT JOIN programs p ON p.id = a.program_id');
        expect(findLinkedStudentCall[0]).toContain('p.name AS program_name');
        expect(findLinkedStudentCall[0]).not.toContain('a.program_name');
    });
    it('resolves the linked student even when they have no application yet', async () => {
        const query = jest.fn()
            .mockResolvedValueOnce([{
                guarantor_id: 'g-1', student_id: 's-1', first_name: 'Amina', last_name: 'Trabelsi',
                student_email: 'amina@example.com', application_id: null, current_status: null,
                university_id: null, university_name: null, program_name: null, tuition_amount: null,
            }])
            .mockResolvedValueOnce([null])
            .mockResolvedValueOnce([undefined])
            .mockResolvedValueOnce([]);
        const service = new guarantors_service_1.GuarantorsService({ query }, {}, {});
        const result = await service.getLinkedStudent('user-1', 'tenant-1');
        expect(result.student).toEqual(expect.objectContaining({ id: 's-1', first_name: 'Amina' }));
        expect(result.application).toBeNull();
        const findLinkedStudentCall = query.mock.calls[0];
        expect(findLinkedStudentCall[0]).toContain('LEFT JOIN applications a');
        expect(findLinkedStudentCall[0]).toContain("sg.status = 'active'");
    });
});
describe('GuarantorsService invite lifecycle', () => {
    function makeService(query) {
        return new guarantors_service_1.GuarantorsService({ query, transaction: (fn) => fn({ query }) }, {}, {});
    }
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    describe('previewInvite', () => {
        it('rejects a token that matches no invite', async () => {
            const query = jest.fn().mockResolvedValueOnce([]);
            const service = makeService(query);
            await expect(service.previewInvite('bad-token')).rejects.toThrow('This invite link is invalid.');
        });
        it('rejects an already-used invite (user_id already set)', async () => {
            const query = jest.fn().mockResolvedValueOnce([{ user_id: 'user-1', invite_token_expires_at: futureDate }]);
            const service = makeService(query);
            await expect(service.previewInvite('used-token')).rejects.toThrow('This invite has already been used. Please log in instead.');
        });
        it('rejects a declined invite', async () => {
            const query = jest.fn().mockResolvedValueOnce([{ user_id: null, link_status: 'declined', invite_token_expires_at: futureDate }]);
            const service = makeService(query);
            await expect(service.previewInvite('declined-token')).rejects.toThrow('This invitation was already declined.');
        });
        it('rejects an expired invite', async () => {
            const query = jest.fn().mockResolvedValueOnce([{ user_id: null, link_status: 'pending_invitation', invite_token_expires_at: pastDate }]);
            const service = makeService(query);
            await expect(service.previewInvite('expired-token')).rejects.toThrow('This invite link has expired');
        });
        it('returns the preview for a valid, pending invite', async () => {
            const query = jest.fn().mockResolvedValueOnce([{
                    id: 'g-1', tenant_id: 'tenant-1', email: 'g@example.com', first_name: 'Mohamed', last_name: 'Ali',
                    user_id: null, link_status: 'pending_invitation', invite_token_expires_at: futureDate,
                    student_id: 's-1', student_first_name: 'Amina',
                }]);
            const service = makeService(query);
            const result = await service.previewInvite('good-token');
            expect(result).toEqual(expect.objectContaining({
                guarantorFirstName: 'Mohamed', email: 'g@example.com', studentFirstName: 'Amina',
            }));
        });
    });
    describe('acceptInvite', () => {
        it('rejects a weak password before ever touching the database', async () => {
            const query = jest.fn();
            const service = makeService(query);
            await expect(service.acceptInvite('token', { password: 'short' })).rejects.toThrow();
            expect(query).not.toHaveBeenCalled();
        });
        it('rejects accepting an already-used invite', async () => {
            const query = jest.fn().mockResolvedValueOnce([{ user_id: 'user-1', invite_token_expires_at: futureDate }]);
            const service = makeService(query);
            await expect(service.acceptInvite('token', { password: 'GoodPass2026!' })).rejects.toThrow('This invite has already been used. Please log in instead.');
        });
        it('rejects accepting an expired invite', async () => {
            const query = jest.fn().mockResolvedValueOnce([{ user_id: null, invite_token_expires_at: pastDate }]);
            const service = makeService(query);
            await expect(service.acceptInvite('token', { password: 'GoodPass2026!' })).rejects.toThrow('This invite link has expired');
        });
        it('creates a real user account, activates the portal, and links the student on success', async () => {
            const query = jest.fn()
                .mockResolvedValueOnce([{
                    id: 'g-1', tenant_id: 'tenant-1', email: 'g@example.com', first_name: 'Mohamed', last_name: 'Ali',
                    user_id: null, link_status: 'pending_invitation', invite_token_expires_at: futureDate, student_id: 's-1',
                }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ id: 'user-new', email: 'g@example.com' }])
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);
            const service = makeService(query);
            const result = await service.acceptInvite('token', { password: 'GoodPass2026!' });
            expect(result).toEqual({ guarantorId: 'g-1', userId: 'user-new', email: 'g@example.com' });
            const clearTokenCall = query.mock.calls[3];
            expect(clearTokenCall[0]).toContain('invite_token = NULL');
            const linkCall = query.mock.calls[4];
            expect(linkCall[0]).toContain("SET status = 'active'");
        });
    });
    describe('declineInvite', () => {
        it('rejects a token that matches no invite', async () => {
            const query = jest.fn().mockResolvedValueOnce([]);
            const service = makeService(query);
            await expect(service.declineInvite('bad-token', {})).rejects.toThrow('This invite link is invalid.');
        });
        it('is idempotent when the invite is already declined', async () => {
            const query = jest.fn().mockResolvedValueOnce([{ user_id: null, link_status: 'declined' }]);
            const service = makeService(query);
            await expect(service.declineInvite('token', {})).resolves.toEqual({ success: true });
        });
        it('marks the link declined and never creates a user account', async () => {
            const query = jest.fn()
                .mockResolvedValueOnce([{ id: 'g-1', tenant_id: 'tenant-1', email: 'g@example.com', user_id: null, link_status: 'pending_invitation', student_id: 's-1' }])
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);
            const service = makeService(query);
            const result = await service.declineInvite('token', { reason: 'Changed my mind' });
            expect(result).toEqual({ success: true });
            expect(query.mock.calls.some(call => call[0].includes('INSERT INTO users'))).toBe(false);
            const declineCall = query.mock.calls[1];
            expect(declineCall[0]).toContain("status = 'declined'");
        });
    });
});
//# sourceMappingURL=guarantors.service.spec.js.map