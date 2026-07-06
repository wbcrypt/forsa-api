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
});
//# sourceMappingURL=guarantors.service.spec.js.map