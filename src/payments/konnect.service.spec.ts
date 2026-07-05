import * as crypto from 'crypto';
import axios from 'axios';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { KonnectService } from './konnect.service';
import { LedgerService } from './ledger.service';

jest.mock('axios');

// T-105/T-109 — payments.controller.ts's konnect-webhook route is now
// @Public() (route-level override, added for T-105), so this signature
// check is the ONLY thing standing between an unauthenticated internet
// request and writing a 'verified' payment. This test exists specifically
// to catch a regression in that boundary, closing the gap flagged in
// implementation/KNOWN_ISSUES.md K-05.
describe('KonnectService.processWebhook — signature verification', () => {
  const webhookSecret = 'test-webhook-secret';

  const sign = (payload: unknown) =>
    crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');

  const makeService = () => {
    const config = {
      get: (key: string) => (key === 'konnect.webhookSecret' ? webhookSecret : undefined),
    };
    const dataSource = { query: jest.fn().mockResolvedValue([]) };
    const ledger = { recordEntries: jest.fn().mockResolvedValue(undefined) };
    return new KonnectService(
      config as unknown as ConfigService,
      dataSource as unknown as DataSource,
      ledger as unknown as LedgerService,
    );
  };

  it('rejects a request with an invalid signature', async () => {
    const service = makeService();
    const payload = { order_id: 'FORSA-1', payment_ref: 'ref-1', status: 'paid' };

    await expect(service.processWebhook(payload, sign({ tampered: true })))
      .rejects.toThrow(UnauthorizedException);
  });

  it('rejects a request with no signature when a webhook secret is configured', async () => {
    const service = makeService();
    const payload = { order_id: 'FORSA-1', payment_ref: 'ref-1', status: 'paid' };

    await expect(service.processWebhook(payload, undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a request with a valid signature (passes the auth boundary)', async () => {
    const service = makeService();
    // Deliberately incomplete payload (no order_id/payment_ref) so
    // processWebhook returns early with { received: true } right after the
    // signature check, without needing to mock the downstream Konnect
    // re-verification API call or DB lookups — this isolates exactly the
    // signature-verification concern this test is for.
    const payload = { status: 'paid' };

    await expect(service.processWebhook(payload, sign(payload)))
      .resolves.toEqual({ received: true });
  });

  it('rejects a replayed signature computed over a different payload', async () => {
    const service = makeService();
    const originalPayload = { order_id: 'FORSA-1', payment_ref: 'ref-1', status: 'paid' };
    const validSignatureForOriginal = sign(originalPayload);
    const alteredPayload = { order_id: 'FORSA-1', payment_ref: 'ref-1', status: 'paid', amount: 999999 };

    await expect(service.processWebhook(alteredPayload, validSignatureForOriginal))
      .rejects.toThrow(UnauthorizedException);
  });
});

// T-109/K-14 — locks in the fix: the Konnect webhook's ledger write now goes
// through the same shared LedgerService the manual-verification path uses,
// instead of a raw INSERT referencing debit_account/credit_account columns
// that don't exist in the live schema (see ledger.service.ts for the full
// history — that old INSERT would have thrown a SQL error on every real
// confirmation, after the payment was already marked verified).
describe('KonnectService.processWebhook — ledger write on confirmed payment', () => {
  it('records a debit/credit ledger entry via LedgerService, not a raw query', async () => {
    const config = { get: () => undefined }; // no webhookSecret configured -> signature check skipped
    const paymentRow = {
      id: 'payment-1',
      installment_id: 'inst-1',
      amount: 500,
      sequence_number: 2,
      application_id: 'app-1',
      sched_tenant: 'tenant-1',
      student_id: 'student-1',
    };
    const query = jest.fn()
      .mockResolvedValueOnce([paymentRow]) // find pending payment
      .mockResolvedValueOnce(undefined)     // UPDATE payments verified
      .mockResolvedValueOnce(undefined);    // UPDATE installments paid
    const dataSource = { query };
    const ledger = { recordEntries: jest.fn().mockResolvedValue(undefined) };
    (axios.get as jest.Mock).mockResolvedValue({ data: { payment: { status: 'paid' } } });

    const service = new KonnectService(
      config as unknown as ConfigService,
      dataSource as unknown as DataSource,
      ledger as unknown as LedgerService,
    );

    const result = await service.processWebhook(
      { order_id: 'FORSA-1', payment_ref: 'ref-1', status: 'paid' },
      undefined,
    );

    expect(result).toEqual({ received: true, verified: true, installmentId: 'inst-1' });
    expect(ledger.recordEntries).toHaveBeenCalledWith(
      'tenant-1', 'app-1', 'payment-1',
      expect.objectContaining({ debitAccount: 'bank', creditAccount: 'student_receivable', amount: 500 }),
    );
    // The old broken code path inserted directly via dataSource.query — confirm
    // no query call references the nonexistent debit_account/credit_account columns.
    expect(query.mock.calls.some(c => String(c[0]).includes('debit_account'))).toBe(false);
  });
});
