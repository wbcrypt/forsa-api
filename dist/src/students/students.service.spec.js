"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const students_service_1 = require("./students.service");
describe('StudentsService.findMyPayments', () => {
    let service;
    let query;
    beforeEach(() => {
        query = jest.fn();
        service = new students_service_1.StudentsService({ query }, {});
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
//# sourceMappingURL=students.service.spec.js.map