"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const execution_service_1 = require("./execution.service");
describe('ExecutionService.getDisbursements', () => {
    it('returns disbursement history joined with university/student/recorder names, most recent first', async () => {
        const query = jest.fn().mockResolvedValue([
            { id: 'disb-1', amount: 5000, university_name: 'Université de Tunis', first_name: 'Amina', last_name: 'T' },
        ]);
        const service = new execution_service_1.ExecutionService({ query }, {}, {}, {});
        const result = await service.getDisbursements('tenant-1', 100);
        expect(result).toEqual([
            { id: 'disb-1', amount: 5000, university_name: 'Université de Tunis', first_name: 'Amina', last_name: 'T' },
        ]);
        const call = query.mock.calls[0];
        expect(call[0]).toContain('FROM university_disbursements ud');
        expect(call[0]).toContain('ORDER BY ud.disbursed_at DESC');
        expect(call[1]).toEqual(['tenant-1', 100]);
    });
});
//# sourceMappingURL=execution.service.spec.js.map