import { DataSource } from 'typeorm';
import { ExecutionService } from './execution.service';
import { PaymentsService } from '../payments/payments.service';
import { ContractsService } from '../contracts/contracts.service';
import { NotificationsService } from '../notifications/notifications.service';

// T-222 — forsa-finance's Disbursements page was a placeholder deferring
// to the Admin Dashboard; recordDisbursement already wrote real
// university_disbursements rows but there was no read path. Locks down
// the query shape Finance actually needs.
describe('ExecutionService.getDisbursements', () => {
  it('returns disbursement history joined with university/student/recorder names, most recent first', async () => {
    const query = jest.fn().mockResolvedValue([
      { id: 'disb-1', amount: 5000, university_name: 'Université de Tunis', first_name: 'Amina', last_name: 'T' },
    ]);
    const service = new ExecutionService(
      { query } as unknown as DataSource,
      {} as unknown as PaymentsService,
      {} as unknown as ContractsService,
      {} as unknown as NotificationsService,
    );

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
