"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const membership_service_1 = require("./membership.service");
const enums_1 = require("../common/enums");
describe('MembershipService', () => {
    let service;
    let query;
    let managerQuery;
    let notifications;
    let digitalPass;
    const pendingRequest = {
        id: 'req-1', tenant_id: 'tenant-1', status: 'pending',
        first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com',
        phone: '+21620000000', city: 'Tunis',
    };
    beforeEach(() => {
        query = jest.fn();
        managerQuery = jest.fn();
        notifications = { send: jest.fn().mockResolvedValue(undefined) };
        digitalPass = { issueForStudentTx: jest.fn().mockResolvedValue({ verificationToken: 'tok' }) };
        const dataSource = {
            query,
            transaction: jest.fn((cb) => cb({ query: managerQuery })),
        };
        service = new membership_service_1.MembershipService(dataSource, notifications, digitalPass);
    });
    describe('createRequest', () => {
        it('rejects a duplicate pending request for the same email', async () => {
            query.mockResolvedValueOnce([{ id: 'existing-req' }]);
            await expect(service.createRequest({
                tenantId: 'tenant-1', firstName: 'A', lastName: 'B', phone: '123',
                email: 'a@b.com', city: 'Tunis', programme: 'CS', academicYear: '2026-2027',
                currentOrFutureStudent: 'current',
            })).rejects.toThrow(common_1.BadRequestException);
        });
        it('creates a pending request when none already exists', async () => {
            query
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ id: 'new-req', created_at: new Date() }]);
            const result = await service.createRequest({
                tenantId: 'tenant-1', firstName: 'Amina', lastName: 'Trabelsi', phone: '123',
                email: 'amina@example.com', city: 'Tunis', programme: 'CS', academicYear: '2026-2027',
                currentOrFutureStudent: 'current',
            });
            expect(result).toEqual(expect.objectContaining({ id: 'new-req', status: 'pending' }));
            expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
                templateCode: 'membership_submitted',
                recipientId: 'new-req',
                recipientEmail: 'amina@example.com',
            }));
        });
    });
    describe('approve', () => {
        it('rejects approving a request that is not pending', async () => {
            query.mockResolvedValueOnce([{ ...pendingRequest, status: 'approved' }]);
            await expect(service.approve('req-1', 'tenant-1', 'staff-1')).rejects.toThrow(common_1.BadRequestException);
        });
        it('rejects when an account with this email already exists', async () => {
            query
                .mockResolvedValueOnce([pendingRequest])
                .mockResolvedValueOnce([{ id: 'existing-user' }]);
            await expect(service.approve('req-1', 'tenant-1', 'staff-1')).rejects.toThrow(common_1.BadRequestException);
        });
        it('provisions students + users transactionally, issues Bronze + a FORSA ID, and emails a set-password link', async () => {
            query
                .mockResolvedValueOnce([pendingRequest])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);
            managerQuery
                .mockResolvedValueOnce([{ id: 'student-1', first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com', forsa_id: 'FORSA-2026-ABCDEF' }])
                .mockResolvedValueOnce([{ id: 'user-1', email: 'amina@example.com' }])
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);
            const result = await service.approve('req-1', 'tenant-1', 'staff-1');
            expect(result).toEqual({ studentId: 'student-1', membershipStatus: enums_1.MembershipStatus.BRONZE, forsaId: 'FORSA-2026-ABCDEF' });
            const studentsInsertCall = managerQuery.mock.calls[0];
            expect(studentsInsertCall[0]).toContain('INSERT INTO students');
            expect(studentsInsertCall[1]).toContain(enums_1.MembershipStatus.BRONZE);
            expect(studentsInsertCall[1][studentsInsertCall[1].length - 1]).toMatch(/^FORSA-\d{4}-[0-9A-F]{6}$/);
            const usersInsertCall = managerQuery.mock.calls[1];
            expect(usersInsertCall[0]).toContain('INSERT INTO users');
            expect(digitalPass.issueForStudentTx).toHaveBeenCalledWith(expect.anything(), 'student-1', 'tenant-1');
            expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
                templateCode: 'membership_approved',
                recipientEmail: 'amina@example.com',
                variables: expect.objectContaining({
                    forsaId: 'FORSA-2026-ABCDEF',
                    setPasswordUrl: expect.stringContaining('/set-password?token='),
                }),
            }));
            expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
                templateCode: 'digital_pass_ready',
                recipientEmail: 'amina@example.com',
            }));
        });
        it('retries FORSA ID generation on a collision before inserting', async () => {
            query
                .mockResolvedValueOnce([pendingRequest])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ id: 'other-student' }])
                .mockResolvedValueOnce([]);
            managerQuery
                .mockResolvedValueOnce([{ id: 'student-1', first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@example.com', forsa_id: 'FORSA-2026-111111' }])
                .mockResolvedValueOnce([{ id: 'user-1', email: 'amina@example.com' }])
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(undefined);
            const result = await service.approve('req-1', 'tenant-1', 'staff-1');
            expect(result.forsaId).toBe('FORSA-2026-111111');
            expect(query).toHaveBeenCalledTimes(4);
        });
    });
    describe('generateForsaId', () => {
        it('produces the expected FORSA-<year>-<6 hex chars> format', () => {
            const id = (0, membership_service_1.generateForsaId)();
            expect(id).toMatch(new RegExp(`^FORSA-${new Date().getFullYear()}-[0-9A-F]{6}$`));
        });
    });
    describe('reject', () => {
        it('rejects rejecting a request that is not pending', async () => {
            query.mockResolvedValueOnce([{ ...pendingRequest, status: 'rejected' }]);
            await expect(service.reject('req-1', 'tenant-1', 'staff-1', 'Incomplete info')).rejects.toThrow(common_1.BadRequestException);
        });
        it('marks a pending request rejected with a reason', async () => {
            query
                .mockResolvedValueOnce([pendingRequest])
                .mockResolvedValueOnce(undefined);
            const result = await service.reject('req-1', 'tenant-1', 'staff-1', 'Incomplete info');
            expect(result).toEqual({ id: 'req-1', status: 'rejected' });
        });
        it('emails the applicant that their request was not approved', async () => {
            query
                .mockResolvedValueOnce([pendingRequest])
                .mockResolvedValueOnce(undefined);
            await service.reject('req-1', 'tenant-1', 'staff-1', 'Incomplete info');
            expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
                templateCode: 'membership_rejected',
                recipientEmail: 'amina@example.com',
                variables: expect.objectContaining({ firstName: 'Amina' }),
            }));
        });
    });
    describe('findOne', () => {
        it('throws NotFoundException when no request matches', async () => {
            query.mockResolvedValueOnce([]);
            await expect(service.findOne('missing', 'tenant-1')).rejects.toThrow(common_1.NotFoundException);
        });
    });
});
//# sourceMappingURL=membership.service.spec.js.map