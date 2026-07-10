"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const students_service_1 = require("./students.service");
describe('StudentsService.findMyPayments', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new students_service_1.StudentsService({ query }, {}, {});
    });
    it('resolves the student id from user_id and returns their full payment history', async () => {
        query
            .mockResolvedValueOnce([{ id: 'student-1' }])
            .mockResolvedValueOnce([{ id: 'student-1' }])
            .mockResolvedValueOnce([{ id: 'payment-1', amount: 500 }, { id: 'payment-2', amount: 500 }]);
        const result = await service.findMyPayments('user-1', 'tenant-1');
        expect(result).toEqual([{ id: 'payment-1', amount: 500 }, { id: 'payment-2', amount: 500 }]);
        expect(query.mock.calls[2][1]).toEqual(['student-1', 'tenant-1']);
        expect(query.mock.calls[2][0]).toContain('ORDER BY p.payment_date DESC');
        expect(query.mock.calls[2][0]).not.toContain('p.paid_at');
    });
    it('throws NotFoundException when no student profile is linked to this user', async () => {
        query.mockResolvedValueOnce([]);
        await expect(service.findMyPayments('user-2', 'tenant-1')).rejects.toThrow(common_1.NotFoundException);
    });
});
describe('StudentsService.addMyGuarantor', () => {
    let service;
    let query;
    let notifications;
    beforeEach(() => {
        query = jest.fn();
        notifications = { send: jest.fn().mockResolvedValue(undefined) };
        service = new students_service_1.StudentsService({ query }, {}, notifications);
    });
    it('resolves the student id from the JWT identity, never a client-supplied one', async () => {
        query
            .mockResolvedValueOnce([{ id: 'student-1', user_id: 'user-1', guarantors: null }])
            .mockResolvedValueOnce([{ id: 'student-1' }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'guarantor-1', email: 'g@example.com' }])
            .mockResolvedValueOnce([{ id: 'link-1' }])
            .mockResolvedValueOnce(undefined);
        const dto = {
            studentId: 'someone-elses-student-id',
            firstName: 'Mohamed', lastName: 'Ali', email: 'g@example.com',
        };
        const result = await service.addMyGuarantor('user-1', 'tenant-1', dto);
        expect(result.guarantor).toEqual({ id: 'guarantor-1', email: 'g@example.com' });
        const insertGuarantorCall = query.mock.calls[3];
        expect(insertGuarantorCall[0]).toContain('INSERT INTO guarantors');
        const insertLinkCall = query.mock.calls[4];
        expect(insertLinkCall[0]).toContain('INSERT INTO student_guarantors');
        expect(insertLinkCall[1]).toContain('student-1');
        expect(insertLinkCall[1]).not.toContain('someone-elses-student-id');
        expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({ templateCode: 'guarantor_invited' }));
    });
    it('throws NotFoundException when no student profile is linked to this user', async () => {
        query.mockResolvedValueOnce([]);
        await expect(service.addMyGuarantor('user-2', 'tenant-1', { firstName: 'A', lastName: 'B', email: 'a@b.com' }))
            .rejects.toThrow(common_1.NotFoundException);
    });
});
//# sourceMappingURL=students.service.spec.js.map