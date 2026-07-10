import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
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

  // No credit-balance/overpayment concept exists in the schema or the
  // documented payment statuses (Operations Manual §8) — recordPayment
  // must never let amount_paid exceed the installment amount.
  describe('overpayment guard', () => {
    it('accepts a payment that exactly matches the remaining balance', async () => {
      query
        .mockResolvedValueOnce([installmentRow])       // fetch installment (amount 500, paid 0)
        .mockResolvedValueOnce([{ id: 'payment-1' }])   // INSERT payments RETURNING id
        .mockResolvedValueOnce(undefined)               // UPDATE installments
        .mockResolvedValueOnce(undefined)               // audit_logs
        .mockResolvedValueOnce([{ first_name: 'Karim', last_name: 'Ben Ali', email: 'karim@example.com' }]);

      const result = await service.recordPayment({
        tenantId: 'tenant-1', installmentId: 'inst-1', amount: 500, currency: 'TND',
        paymentMethod: 'bank_transfer', referenceNumber: 'REF-EXACT',
        paymentDate: new Date(), receivedBy: 'staff-1',
      });

      expect(result.newInstallmentStatus).toBe('paid');
      expect(result.amountPaid).toBe(500);
    });

    it('accepts a partial payment below the remaining balance', async () => {
      query
        .mockResolvedValueOnce([installmentRow])       // fetch installment (amount 500, paid 0)
        .mockResolvedValueOnce([{ id: 'payment-2' }])   // INSERT payments RETURNING id
        .mockResolvedValueOnce(undefined)               // UPDATE installments
        .mockResolvedValueOnce(undefined);              // audit_logs

      const result = await service.recordPayment({
        tenantId: 'tenant-1', installmentId: 'inst-1', amount: 200, currency: 'TND',
        paymentMethod: 'bank_transfer', referenceNumber: 'REF-PARTIAL',
        paymentDate: new Date(), receivedBy: 'staff-1',
      });

      expect(result.newInstallmentStatus).toBe('partial');
      expect(result.amountPaid).toBe(200);
    });

    it('rejects a payment that exceeds the remaining balance, without writing anything', async () => {
      query.mockResolvedValueOnce([installmentRow]); // fetch installment (amount 500, paid 0)

      await expect(service.recordPayment({
        tenantId: 'tenant-1', installmentId: 'inst-1', amount: 600, currency: 'TND',
        paymentMethod: 'bank_transfer', referenceNumber: 'REF-EXCESS',
        paymentDate: new Date(), receivedBy: 'staff-1',
      })).rejects.toThrow('exceeds the remaining balance');

      expect(query).toHaveBeenCalledTimes(1); // only the installment fetch — no INSERT/UPDATE
    });

    it('rejects a payment that exceeds what remains on a partially-paid installment', async () => {
      query.mockResolvedValueOnce([{ ...installmentRow, amount_paid: '300' }]); // 200 remaining

      await expect(service.recordPayment({
        tenantId: 'tenant-1', installmentId: 'inst-1', amount: 250, currency: 'TND',
        paymentMethod: 'bank_transfer', referenceNumber: 'REF-EXCESS-2',
        paymentDate: new Date(), receivedBy: 'staff-1',
      })).rejects.toThrow('exceeds the remaining balance');

      expect(query).toHaveBeenCalledTimes(1);
    });
  });
});

// verifyPayment is the second write path onto installments.amount_paid
// (alongside recordPayment) — admin can substitute a self-reported
// student_amount when confirming a receipt against the real bank record.
// Same no-credit-balance rule must hold here too, or the guard in
// recordPayment is trivially bypassed via the receipt-upload flow.
describe('PaymentsService.verifyPayment — overpayment guard', () => {
  let service: PaymentsService;
  let query: jest.Mock;
  let scoreService: jest.Mocked<Pick<ScoreService, 'recordEvent'>>;
  let notifications: jest.Mocked<Pick<NotificationsService, 'send'>>;
  let ledger: jest.Mocked<Pick<LedgerService, 'recordEntries'>>;

  const paymentRow = {
    id: 'payment-1',
    status: 'receipt_uploaded',
    amount: '500',
    student_amount: '500',
    currency: 'TND',
    installment_id: 'inst-1',
    installment_amount: '500.00',
    amount_paid: '0',
    sequence_number: 3,
    application_id: 'app-1',
    sched_tenant: 'tenant-1',
    student_id: 'student-1',
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

  it('accepts a verified amount that exactly matches the remaining balance', async () => {
    query
      .mockResolvedValueOnce([paymentRow])            // fetch payment+installment
      .mockResolvedValueOnce(undefined)                // UPDATE payments
      .mockResolvedValueOnce(undefined)                // UPDATE installments
      .mockResolvedValueOnce(undefined)                // audit_logs
      .mockResolvedValueOnce([{ first_name: 'Karim', last_name: 'Ben Ali', email: 'karim@example.com' }]);

    await service.verifyPayment('payment-1', 'tenant-1', 'staff-1');

    expect(ledger.recordEntries).toHaveBeenCalledWith(
      'tenant-1', 'app-1', 'payment-1',
      expect.objectContaining({ amount: 500 }),
    );
  });

  it('accepts a verified amount below the remaining balance (partial)', async () => {
    query
      .mockResolvedValueOnce([{ ...paymentRow, student_amount: '200', amount: '200' }])
      .mockResolvedValueOnce(undefined)                // UPDATE payments
      .mockResolvedValueOnce(undefined)                // UPDATE installments
      .mockResolvedValueOnce(undefined);               // audit_logs

    await service.verifyPayment('payment-1', 'tenant-1', 'staff-1');

    const updateInstallmentCall = query.mock.calls.find(c => c[0].includes('UPDATE installments'));
    expect(updateInstallmentCall![1]).toEqual(['inst-1', 200, 'partial']);
  });

  it('rejects a verified amount that exceeds the remaining balance, without mutating anything', async () => {
    query.mockResolvedValueOnce([{ ...paymentRow, amount_paid: '300' }]); // 200 remaining, verifying 500

    await expect(
      service.verifyPayment('payment-1', 'tenant-1', 'staff-1'),
    ).rejects.toThrow('exceeds the remaining balance');

    expect(query).toHaveBeenCalledTimes(1); // only the initial fetch — payment left untouched
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
    tenantId: 'tenant-1', installmentId: 'inst-1', callerUserId: 'user-1',
    paymentDate: '2026-07-01', amount: 500, receiptDocumentId: 'doc-1',
  };

  it('rejects a receiptDocumentId that does not resolve to a completed upload for this student', async () => {
    query
      .mockResolvedValueOnce([installmentRow])       // fetch installment
      .mockResolvedValueOnce([{ id: 'student-1' }])  // ownership check: caller owns installment
      .mockResolvedValueOnce([]);                    // verifyReceiptDocument finds nothing

    await expect(service.submitReceipt(submitParams))
      .rejects.toThrow('receiptDocumentId does not reference a completed upload for this student');
  });

  it('accepts and persists a receiptDocumentId that does belong to this student', async () => {
    query
      .mockResolvedValueOnce([installmentRow])       // fetch installment
      .mockResolvedValueOnce([{ id: 'student-1' }])  // ownership check: caller owns installment
      .mockResolvedValueOnce([{ id: 'doc-1' }])       // verifyReceiptDocument finds it
      .mockResolvedValueOnce([])                      // no existing pending receipt
      .mockResolvedValueOnce([{ id: 'payment-1' }]); // INSERT payments RETURNING id

    const result = await service.submitReceipt(submitParams);

    expect(result).toEqual({ paymentId: 'payment-1', status: 'receipt_uploaded' });
    const insertCall = query.mock.calls.find(c => c[0].includes('INSERT INTO payments'));
    expect(insertCall![1]).toContain('doc-1');
  });

  it('proceeds normally when no receiptDocumentId is supplied (filename-only, legacy path)', async () => {
    query
      .mockResolvedValueOnce([installmentRow])
      .mockResolvedValueOnce([{ id: 'student-1' }]) // ownership check: caller owns installment
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'payment-1' }]);

    const { receiptDocumentId: _receiptDocumentId, ...withoutDoc } = submitParams;
    const result = await service.submitReceipt(withoutDoc);

    expect(result).toEqual({ paymentId: 'payment-1', status: 'receipt_uploaded' });
    // 4 queries: installment fetch, ownership check, existing-receipt
    // check, INSERT — no verifyReceiptDocument query when nothing was
    // supplied.
    expect(query).toHaveBeenCalledTimes(4);
  });

  // Phase 3 (browser E2E testing) discovery — this route previously had
  // no ownership check at all: any authenticated student could submit a
  // receipt against any OTHER student's installment. Locks down the fix.
  it('rejects when the caller does not own the installment', async () => {
    query
      .mockResolvedValueOnce([installmentRow]) // fetch installment (belongs to student-1)
      .mockResolvedValueOnce([]);              // ownership check: caller has no matching student row

    await expect(
      service.submitReceipt({ ...submitParams, callerUserId: 'someone-elses-user-id' }),
    ).rejects.toThrow(NotFoundException);
  });
});

// Phase 3 (browser E2E testing) discovery — the Konnect "pay online" route
// had no ownership check at all before this fix (and inserted the wrong id
// type — auth user id, not students.id — into payments.student_id).
// verifyMyInstallmentOwnership is the fix: the controller calls this first
// to get a trusted, verified studentId before ever calling KonnectService.
describe('PaymentsService.verifyMyInstallmentOwnership', () => {
  let service: PaymentsService;
  let query: jest.Mock;

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

  it('returns the students.id when the caller owns the installment', async () => {
    query.mockResolvedValueOnce([{ student_id: 'student-1' }]);
    const result = await service.verifyMyInstallmentOwnership('user-1', 'inst-1', 'tenant-1');
    expect(result).toBe('student-1');
  });

  it('rejects when the caller does not own the installment (or it does not exist)', async () => {
    query.mockResolvedValueOnce([]);
    await expect(
      service.verifyMyInstallmentOwnership('user-1', 'inst-1', 'tenant-1'),
    ).rejects.toThrow(NotFoundException);
  });
});

// Phase 3 (browser E2E testing) discovery — the university portal's
// Payments page and StudentDetailPage called the staff-only
// GET /payments/schedules/applications/:id directly, 403ing for every
// real university account.
describe('PaymentsService.findScheduleForMyUniversityApplication', () => {
  let service: PaymentsService;
  let query: jest.Mock;

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

  it('rejects when the application does not belong to the caller\'s university', async () => {
    query.mockResolvedValueOnce([]); // ownership check finds nothing

    await expect(
      service.findScheduleForMyUniversityApplication('uni-user-1', 'app-1', 'tenant-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns the schedule for the caller\'s own university application', async () => {
    query
      .mockResolvedValueOnce([{ id: 'app-1' }])       // ownership check
      .mockResolvedValueOnce([{ id: 'sched-1' }]);    // getScheduleForApplication

    const result = await service.findScheduleForMyUniversityApplication('uni-user-1', 'app-1', 'tenant-1');
    expect(result).toEqual({ id: 'sched-1' });
  });
});
