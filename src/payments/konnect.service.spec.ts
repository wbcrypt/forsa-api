import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { KonnectService } from './konnect.service';

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
    return new KonnectService(config as unknown as ConfigService, dataSource as unknown as DataSource);
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
