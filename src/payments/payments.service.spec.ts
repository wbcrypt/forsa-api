import { DataSource } from 'typeorm';
import { PaymentsService } from './payments.service';
import { PolicyService } from '../policy/policy.service';
import { ScoreService } from '../score/score.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { LedgerService } from './ledger.service';

// T-109/K-14 — recordPayment is the manual-staff-entry path into the
// platform's append-only double-entry financial_ledger, now routed through
// the shared LedgerService (see ledger.service.ts — before this existed,
// the Konnect path wrote a structurally different, actually broken row
// shape to this same table). This test locks down that a full payment
// writes exactly one matched debit/credit pair for the correct amount via
// that shared service.
describe('PaymentsService.recordPayment', () => {
  let service: PaymentsService;
  let query: jest.Mock;
  let scoreService: jest.Mocked<Pick<ScoreService, 'recordEvent'>>;
  let notifications: jest.Mocked<Pick<NotificationsService, 'send'>>;
  let ledger: jest.Mocked<Pick<LedgerService, 'recordEntries'>>;

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
    ledger = { recordEntries: jest.fn().mockResolvedValue(undefined) };
    service = new PaymentsService(
      { query } as unknown as DataSource,
      {} as unknown as PolicyService,
      scoreService as unknown as ScoreService,
      {} as unknown as ConfigService,
      notifications as unknown as NotificationsService,
      ledger as unknown as LedgerService,
    );
  });

  it('writes a matched debit/credit ledger pair and records an on-time score event for a full payment', async () => {
    query
      .mockResolvedValueOnce([installmentRow])       // fetch installment
      .mockResolvedValueOnce([{ id: 'payment-1' }])   // INSERT payments RETURNING id
      .mockResolvedValueOnce(undefined)               // UPDATE installments
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

    expect(ledger.recordEntries).toHaveBeenCalledWith(
      'tenant-1', 'app-1', 'payment-1',
      expect.objectContaining({ debitAccount: 'bank', creditAccount: 'student_receivable', amount: 500 }),
    );

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

// T-111/T-109 — submitReceipt now accepts a client-supplied receiptDocumentId
// (the real uploaded file, replacing the old filename-only flow). This test
// locks down that it's actually verified against the student's own uploaded
// documents, not trusted blindly — a regression here would let one
// student/guarantor attach an arbitrary documentId (including someone
// else's file) to their payment record.
describe('PaymentsService.submitReceipt — receiptDocumentId verification', () => {
  let service: PaymentsService;
  let query: jest.Mock;

  const installmentRow = {
    id: 'inst-1', status: 'pending', application_id: 'app-1',
    tenant_id: 'tenant-1', student_id: 'student-1',
  };

  beforeEach(() => {
    query = jest.fn();
    service = new PaymentsService(
      { query } as unknown as DataSource,
      {} as unknown as PolicyService,
      {} as unknown as ScoreService,
      {} as unknown as ConfigService,
      {} as unknown as NotificationsService,
      {} as unknown as LedgerService,
    );
  });

  const submitParams = {
    tenantId: 'tenant-1', installmentId: 'inst-1', studentId: 'student-1',
    paymentDate: '2026-07-01', amount: 500, receiptDocumentId: 'doc-1',
  };

  it('rejects a receiptDocumentId that does not resolve to a completed upload for this student', async () => {
    query
      .mockResolvedValueOnce([installmentRow]) // fetch installment
      .mockResolvedValueOnce([]);              // verifyReceiptDocument finds nothing

    await expect(service.submitReceipt(submitParams))
      .rejects.toThrow('receiptDocumentId does not reference a completed upload for this student');
  });

  it('accepts and persists a receiptDocumentId that does belong to this student', async () => {
    query
      .mockResolvedValueOnce([installmentRow])   // fetch installment
      .mockResolvedValueOnce([{ id: 'doc-1' }])   // verifyReceiptDocument finds it
      .mockResolvedValueOnce([])                  // no existing pending receipt
      .mockResolvedValueOnce([{ id: 'payment-1' }]); // INSERT payments RETURNING id

    const result = await service.submitReceipt(submitParams);

    expect(result).toEqual({ paymentId: 'payment-1', status: 'receipt_uploaded' });
    const insertCall = query.mock.calls.find(c => c[0].includes('INSERT INTO payments'));
    expect(insertCall![1]).toContain('doc-1');
  });

  it('proceeds normally when no receiptDocumentId is supplied (filename-only, legacy path)', async () => {
    query
      .mockResolvedValueOnce([installmentRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'payment-1' }]);

    const { receiptDocumentId, ...withoutDoc } = submitParams;
    const result = await service.submitReceipt(withoutDoc);

    expect(result).toEqual({ paymentId: 'payment-1', status: 'receipt_uploaded' });
    // Only 3 queries: installment fetch, existing-receipt check, INSERT —
    // no verifyReceiptDocument query when nothing was supplied.
    expect(query).toHaveBeenCalledTimes(3);
  });
});
