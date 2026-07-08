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
      {} as any,
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

    // Phase 3 (browser E2E testing) discovery — this ordered by
    // p.paid_at, a column that doesn't exist on payments (the real
    // column is payment_date) — every call has 500'd since T-219 built
    // it; the "Complete Payment History" feature never actually worked.
    expect(query.mock.calls[2][0]).toContain('ORDER BY p.payment_date DESC');
    expect(query.mock.calls[2][0]).not.toContain('p.paid_at');
  });

  it('throws NotFoundException when no student profile is linked to this user', async () => {
    query.mockResolvedValueOnce([]); // no matching students row

    await expect(service.findMyPayments('user-2', 'tenant-1')).rejects.toThrow(NotFoundException);
  });
});

// Phase 10 — closes the pilot blocker in FORSA_OPERATIONS_MANUAL.md: the
// "do you have a guarantor?" question never led anywhere, and adding one
// required a staff member acting on the student's behalf. addMyGuarantor
// resolves the studentId from the caller's own JWT-derived user_id via
// findMe — same self-scoping pattern as findMyPayments/findMe/createForSelf
// elsewhere in the codebase — and must never trust a client-supplied
// studentId in the request body.
describe('StudentsService.addMyGuarantor', () => {
  let service: StudentsService;
  let query: jest.Mock;
  let notifications: { send: jest.Mock };

  beforeEach(() => {
    query = jest.fn();
    notifications = { send: jest.fn().mockResolvedValue(undefined) };
    service = new StudentsService(
      { query } as unknown as DataSource,
      {} as unknown as ConfigService,
      notifications as any,
    );
  });

  it('resolves the student id from the JWT identity, never a client-supplied one', async () => {
    query
      .mockResolvedValueOnce([{ id: 'student-1', user_id: 'user-1', guarantors: null }]) // findMe
      .mockResolvedValueOnce([{ id: 'student-1' }]) // addGuarantor's internal findOne
      .mockResolvedValueOnce([]) // no existing guarantor with this email
      .mockResolvedValueOnce([{ id: 'guarantor-1', email: 'g@example.com' }]) // INSERT guarantors
      .mockResolvedValueOnce([{ id: 'link-1' }]) // INSERT student_guarantors
      .mockResolvedValueOnce(undefined); // audit log

    const dto = {
      studentId: 'someone-elses-student-id', // must be ignored
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
    query.mockResolvedValueOnce([]); // findMe finds nothing

    await expect(service.addMyGuarantor('user-2', 'tenant-1', { firstName: 'A', lastName: 'B', email: 'a@b.com' }))
      .rejects.toThrow(NotFoundException);
  });
});
