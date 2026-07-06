import { DataSource } from 'typeorm';
import { GuarantorsService } from './guarantors.service';
import { KonnectService } from '../payments/konnect.service';
import { DocumentsService } from '../documents/documents.service';

// Phase 3 (browser E2E testing) discovery — findLinkedStudent's query
// selected a.program_name, a column that has never existed on
// applications (the real column is program_id, a FK to programs) — this
// threw "column a.program_name does not exist" on every single call,
// meaning the Guarantor Portal's core feature (see which student you're
// backing) has never worked since it was built. Locks down the fix: a
// LEFT JOIN to programs, aliased back to program_name so downstream
// consumers are unaffected.
describe('GuarantorsService.getLinkedStudent', () => {
  it('resolves program_name via a join to programs, not a nonexistent applications column', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{
        guarantor_id: 'g-1', student_id: 's-1', first_name: 'Amina', last_name: 'Trabelsi',
        student_email: 'amina@example.com', application_id: 'a-1', current_status: 'approved_level2',
        university_id: 'u-1', university_name: 'Université de Tunis', program_name: 'Licence en Informatique',
        tuition_amount: 3500,
      }]) // findLinkedStudent
      .mockResolvedValueOnce([[]]) // activation_meetings
      .mockResolvedValueOnce([[]]) // contracts
      .mockResolvedValueOnce([[]]) // payment_schedules
      .mockResolvedValueOnce([]); // installments (schedule is undefined, so this branch is skipped — see below)

    const service = new GuarantorsService(
      { query } as unknown as DataSource,
      {} as unknown as KonnectService,
      {} as unknown as DocumentsService,
    );

    const result = await service.getLinkedStudent('user-1', 'tenant-1');

    expect(result.application?.program_name).toBe('Licence en Informatique');
    const findLinkedStudentCall = query.mock.calls[0];
    expect(findLinkedStudentCall[0]).toContain('LEFT JOIN programs p ON p.id = a.program_id');
    expect(findLinkedStudentCall[0]).toContain('p.name AS program_name');
    expect(findLinkedStudentCall[0]).not.toContain('a.program_name');
  });
});
