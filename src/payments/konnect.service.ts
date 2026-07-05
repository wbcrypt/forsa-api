// src/payments/konnect.service.ts
// Konnect payment gateway integration
// V1: Initiate payment → redirect → webhook confirmation
// Future: recurring payments, auto-reconciliation

import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common'
import * as crypto from 'crypto'
import { ConfigService } from '@nestjs/config'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import axios from 'axios'
import { LedgerService } from './ledger.service'

@Injectable()
export class KonnectService {
  private readonly logger = new Logger(KonnectService.name)
  private readonly apiKey: string
  private readonly walletId: string
  private readonly baseUrl: string
  private readonly webhookSecret: string
  private readonly appName: string
  private readonly returnUrl: string

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledger: LedgerService,
  ) {
    this.apiKey      = this.config.get('konnect.apiKey') || ''
    this.walletId    = this.config.get('konnect.walletId') || ''
    this.baseUrl     = this.config.get('konnect.baseUrl') || 'https://api.preprod.konnect.network/api/v2'
    this.webhookSecret = this.config.get('konnect.webhookSecret') || ''
    this.appName     = this.config.get('konnect.appName') || 'FORSA'
    this.returnUrl   = this.config.get('konnect.returnUrl') || 'https://student.forsa.tn/payments'
  }

  get isConfigured(): boolean {
    return !!this.apiKey && !!this.walletId
  }

  /**
   * Initiate a Konnect payment for an installment.
   * Returns a payment URL to redirect the student to.
   */
  async initiatePayment(params: {
    tenantId: string
    installmentId: string
    studentId: string
    studentEmail: string
    studentName: string
    amount: number        // In TND
    paymentReference: string  // e.g. FORSA-2026-ABC123-M03
    currency?: string
  }) {
    if (!this.isConfigured) {
      throw new BadRequestException('Konnect is not configured. Contact FORSA support.')
    }

    const amountMillimes = Math.round(params.amount * 1000) // Konnect uses millimes

    try {
      const response = await axios.post(
        `${this.baseUrl}/payments/init-payment`,
        {
          receiverWalletId: this.walletId,
          token: params.currency || 'TND',
          amount: amountMillimes,
          type: 'immediate',
          description: `FORSA — ${params.paymentReference}`,
          acceptedPaymentMethods: ['wallet', 'bank_card', 'e-DINAR'],
          lifespan: 30, // minutes
          checkoutForm: true,
          addPaymentFeesToAmount: false,
          firstName: params.studentName.split(' ')[0],
          lastName: params.studentName.split(' ').slice(1).join(' ') || params.studentName,
          email: params.studentEmail,
          orderId: params.paymentReference,
          webhook: `${this.config.get('app.url') || 'https://api.forsa.tn'}/api/v1/payments/konnect-webhook`,
          successUrl: `${this.returnUrl}?status=success&ref=${params.paymentReference}`,
          failUrl: `${this.returnUrl}?status=failed&ref=${params.paymentReference}`,
          theme: 'light',
          silentWebhook: true,
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      )

      const { payUrl, paymentRef } = response.data

      // Store the pending Konnect transaction
      await this.dataSource.query(
        `INSERT INTO payments (
           tenant_id, installment_id, student_id, amount, currency,
           payment_method, reference_number, payment_date, status, notes
         ) VALUES ($1, $2, $3, $4, 'TND', 'konnect', $5, CURRENT_DATE, 'konnect_pending', $6)
         ON CONFLICT DO NOTHING`,
        [
          params.tenantId, params.installmentId, params.studentId,
          params.amount, params.paymentReference,
          `Konnect payment initiated. Konnect ref: ${paymentRef}`,
        ],
      )

      this.logger.log(`Konnect payment initiated for ${params.paymentReference} — ${params.amount} TND`)

      return {
        payUrl,
        paymentRef,
        amount: params.amount,
        reference: params.paymentReference,
      }
    } catch (err: any) {
      this.logger.error(`Konnect initiation failed: ${err.message}`, err.response?.data)
      throw new BadRequestException(
        err.response?.data?.message || 'Failed to initiate Konnect payment. Please try again or use bank transfer.'
      )
    }
  }

  /**
   * Process Konnect webhook — called by Konnect when payment is completed.
   * This is the authoritative source of payment confirmation.
   */
  async processWebhook(payload: any, signature?: string) {
    // Verify webhook signature if secret is configured
    if (this.webhookSecret && signature) {
      const expectedSig = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex')
      const sigBuffer = Buffer.from(signature.replace('sha256=', ''), 'hex')
      const expectedBuffer = Buffer.from(expectedSig, 'hex')
      if (sigBuffer.length !== expectedBuffer.length ||
          !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        this.logger.warn('Konnect webhook: invalid signature — rejected')
        throw new UnauthorizedException('Invalid webhook signature')
      }
    } else if (this.webhookSecret && !signature) {
      this.logger.warn('Konnect webhook: signature expected but not provided')
      throw new UnauthorizedException('Webhook signature required')
    }

    const { payment_ref, order_id, status } = payload

    if (!order_id || !payment_ref) {
      this.logger.warn('Konnect webhook: missing order_id or payment_ref')
      return { received: true }
    }

    if (status !== 'paid') {
      this.logger.log(`Konnect webhook: payment ${order_id} status = ${status} (not paid)`)
      return { received: true }
    }

    // Verify with Konnect API (prevents replay attacks)
    let verified = false
    try {
      const check = await axios.get(
        `${this.baseUrl}/payments/${payment_ref}`,
        { headers: { 'x-api-key': this.apiKey }, timeout: 10000 }
      )
      verified = check.data?.payment?.status === 'paid'
    } catch (err: any) {
      this.logger.error(`Konnect verification failed: ${err.message}`)
      // Don't process if we can't verify
      return { received: true }
    }

    if (!verified) {
      this.logger.warn(`Konnect webhook: payment ${order_id} could not be verified`)
      return { received: true }
    }

    // Find the pending payment record for this reference
    const [payment] = await this.dataSource.query(
      `SELECT p.*, i.amount AS installment_amount, i.sequence_number,
              i.grace_due_date, ps.application_id, ps.tenant_id AS sched_tenant,
              a.student_id
       FROM payments p
       JOIN installments i ON i.id = p.installment_id
       JOIN payment_schedules ps ON ps.id = i.payment_schedule_id
       JOIN applications a ON a.id = ps.application_id
       WHERE p.reference_number = $1 AND p.status IN ('konnect_pending', 'receipt_uploaded')
       LIMIT 1`,
      [order_id],
    )

    if (!payment) {
      this.logger.warn(`Konnect webhook: no pending payment found for reference ${order_id}`)
      return { received: true }
    }

    // Auto-verify the payment (Konnect confirmation = bank confirmed)
    await this.dataSource.query(
      `UPDATE payments
       SET status = 'verified',
           verified_at = NOW(),
           verification_notes = $2,
           notes = COALESCE(notes, '') || ' | Konnect auto-verified: ' || $3
       WHERE id = $1`,
      [payment.id, `Auto-verified via Konnect. Payment ref: ${payment_ref}`, payment_ref],
    )

    // Update installment to paid
    await this.dataSource.query(
      `UPDATE installments
       SET status = 'paid', amount_paid = amount, paid_at = NOW()
       WHERE id = $1`,
      [payment.installment_id],
    )

    // T-109/K-14 — was a broken raw INSERT referencing debit_account/
    // credit_account columns that don't exist in the live schema (only
    // `account` does) with entry_type='payment' violating the table's
    // CHECK (entry_type IN ('debit','credit')) constraint — this failed
    // with a SQL error on every real Konnect confirmation, after the
    // payment had already been marked verified, leaving a verified payment
    // with no ledger entry. Now uses the same shared LedgerService the
    // manual/receipt-verification path uses, so both paths write the
    // identical two-row debit/credit shape.
    await this.ledger.recordEntries(payment.sched_tenant, payment.application_id, payment.id, {
      debitAccount: 'bank',
      creditAccount: 'student_receivable',
      amount: payment.amount,
      currency: 'TND',
      description: `Konnect auto-payment for installment #${payment.sequence_number}`,
    })

    this.logger.log(`✅ Konnect payment auto-verified: ${order_id} — installment #${payment.sequence_number}`)

    return { received: true, verified: true, installmentId: payment.installment_id }
  }
}
