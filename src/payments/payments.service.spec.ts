import { DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import { PolicyService } from '../policy/policy.service';
import { ScoreService } from '../score/score.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';

// T-109 — recordPayment is the manual-staff-entry path into the platform's
// append-only double-entry financial_ledger (see
// FORSA_PLATFORM_SPEC.md §14.6/§11.3 — the Konnect path writes a
// structurally different ledger row shape than this one, a known open
// inconsistency). This test locks down that a full payment writes exactly
// one matched debit/credit pair for the correct amount.
describe('PaymentsService.recordPayment', () => {
  let service: PaymentsService;
  let query: jest.Mock;
  let scoreService: jest.Mocked<Pick<ScoreService, 'recordEvent'>>;
  let notifications: jest.Mocked<Pick<NotificationsService, 'send'>>;

  const installmentRow = {
    id: 'inst-1',
    status: 'pending',
    amount: '500.00',
    amount_paid: '0',
    sequence_number: 3,
    application_id: 'app-1',
    tenant_id: 'tenant-1',
    student_id: 'student-1',
    // grace_due_date in the future -> on-time payment
    grace_due_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  };

  beforeEach(() => {
    query = jest.fn();
    scoreService = { recordEvent: jest.fn().mockResolvedValue(undefined) };
    notifications = { send: jest.fn().mockResolvedValue(undefined) };
    service = new PaymentsService(
      { query } as unknown as DataSource,
      {} as unknown as PolicyService,
      scoreService as unknown as ScoreService,
      {} as unknown as ConfigService,
      notifications as unknown as NotificationsService,
    );
  });

  it('writes a matched debit/credit ledger pair and records an on-time score event for a full payment', async () => {
    query
      .mockResolvedValueOnce([installmentRow])       // fetch installment
      .mockResolvedValueOnce([{ id: 'payment-1' }])   // INSERT payments RETURNING id
      .mockResolvedValueOnce(undefined)               // UPDATE installments
      .mockResolvedValueOnce(undefined)               // ledger debit
      .mockResolvedValueOnce(undefined)               // ledger credit
      .mockResolvedValueOnce(undefined)               // audit_logs
      .mockResolvedValueOnce([{                       // notifyStudent's student lookup
        first_name: 'Karim', last_name: 'Ben Ali', email: 'karim@example.com',
      }]);

    const result = await service.recordPayment({
      tenantId: 'tenant-1',
      installmentId: 'inst-1',
      amount: 500,
      currency: 'TND',
      paymentMethod: 'bank_transfer',
      referenceNumber: 'REF-001',
      paymentDate: new Date(),
      receivedBy: 'staff-1',
    });

    expect(result.newInstallmentStatus).toBe('paid');

    const debitCall = query.mock.calls.find(c => c[0].includes("'debit'"));
    const creditCall = query.mock.calls.find(c => c[0].includes("'credit'"));
    expect(debitCall).toBeDefined();
    expect(creditCall).toBeDefined();
    // Same batch_id (last param) ties the two rows together as one entry.
    expect(debitCall![1][debitCall![1].length - 1]).toEqual(creditCall![1][creditCall![1].length - 1]);
    // debit account = bank, credit account = student_receivable, matching amount
    expect(debitCall![1]).toEqual(expect.arrayContaining(['bank', 500]));
    expect(creditCall![1]).toEqual(expect.arrayContaining(['student_receivable', 500]));

    expect(scoreService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventCode: 'PAYMENT_ON_TIME', points: 15, studentId: 'student-1' }),
    );
    expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({ templateCode: 'payment_confirmed' }));
  });

  it('rejects recording a payment against an already-paid installment', async () => {
    query.mockResolvedValueOnce([{ ...installmentRow, status: 'paid' }]);

    await expect(service.recordPayment({
      tenantId: 'tenant-1',
      installmentId: 'inst-1',
      amount: 500,
      currency: 'TND',
      paymentMethod: 'bank_transfer',
      referenceNumber: 'REF-002',
      paymentDate: new Date(),
      receivedBy: 'staff-1',
    })).rejects.toThrow('Installment already paid');
  });
});
