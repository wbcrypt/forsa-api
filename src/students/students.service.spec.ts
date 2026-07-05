import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { StudentsService } from './students.service';

// T-219 — findMyPayments resolves the student id server-side from the
// caller's own JWT-derived user_id, never a client-supplied id (same
// self-scoping pattern as findMe). This locks down that behavior and that
// a user with no linked student profile gets a clean 404, not a leaked
// history belonging to someone else.
describe('StudentsService.findMyPayments', () => {
  let service: StudentsService;
  let query: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    service = new StudentsService(
      { query } as unknown as DataSource,
      {} as unknown as ConfigService,
    );
  });

  it('resolves the student id from user_id and returns their full payment history', async () => {
    query
      .mockResolvedValueOnce([{ id: 'student-1' }]) // students lookup by user_id
      .mockResolvedValueOnce([{ id: 'student-1' }]) // getPaymentHistory's internal findOne existence check
      .mockResolvedValueOnce([{ id: 'payment-1', amount: 500 }, { id: 'payment-2', amount: 500 }]); // payment history rows

    const result = await service.findMyPayments('user-1', 'tenant-1');

    expect(result).toEqual([{ id: 'payment-1', amount: 500 }, { id: 'payment-2', amount: 500 }]);
    // Final query must be scoped to the resolved student-1, not any client input
    expect(query.mock.calls[2][1]).toEqual(['student-1', 'tenant-1']);
  });

  it('throws NotFoundException when no student profile is linked to this user', async () => {
    query.mockResolvedValueOnce([]); // no matching students row

    await expect(service.findMyPayments('user-2', 'tenant-1')).rejects.toThrow(NotFoundException);
  });
});
